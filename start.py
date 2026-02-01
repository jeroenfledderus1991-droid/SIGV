import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set

ROOT = Path(__file__).resolve().parent


def read_env_file(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        value = value.strip().strip("\"'")
        env[key.strip()] = value
    return env


def extract_port_from_url(value: str) -> Optional[int]:
    match = re.search(r":(\d+)", value)
    if not match:
        return None
    try:
        return int(match.group(1))
    except ValueError:
        return None


def extract_client_port(env: Dict[str, str], fallback_env: Dict[str, str]) -> Optional[int]:
    for key in ("CLIENT_PORT", "VITE_PORT"):
        value = env.get(key) or fallback_env.get(key)
        if value:
            try:
                return int(value)
            except ValueError:
                pass

    cors_origin = env.get("CORS_ORIGIN") or fallback_env.get("CORS_ORIGIN")
    if cors_origin:
        port = extract_port_from_url(cors_origin)
        if port:
            return port

    vite_config = ROOT / "client" / "vite.config.js"
    if vite_config.is_file():
        content = vite_config.read_text(encoding="utf-8")
        match = re.search(r"\bport\s*:\s*(\d+)", content)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                return None

    return None


def gather_ports() -> List[int]:
    env = read_env_file(ROOT / ".env")
    fallback_env = read_env_file(ROOT / ".env.example")

    ports: List[int] = []

    express_port = env.get("EXPRESS_PORT") or fallback_env.get("EXPRESS_PORT") or "5010"
    try:
        ports.append(int(express_port))
    except ValueError:
        pass

    dotnet_port = env.get("DOTNET_PORT") or fallback_env.get("DOTNET_PORT")
    if dotnet_port:
        try:
            ports.append(int(dotnet_port))
        except ValueError:
            pass

    client_port = extract_client_port(env, fallback_env)
    if client_port:
        ports.append(client_port)

    deduped: List[int] = []
    seen: Set[int] = set()
    for port in ports:
        if port not in seen:
            seen.add(port)
            deduped.append(port)
    return deduped


def find_pids_for_ports(ports: Iterable[int]) -> Dict[int, Set[int]]:
    port_set = {int(port) for port in ports}
    results: Dict[int, Set[int]] = {port: set() for port in port_set}

    try:
        output = subprocess.check_output(["netstat", "-ano", "-p", "tcp"], text=True)
    except subprocess.SubprocessError:
        return results

    line_re = re.compile(r"^\s*TCP\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s*$", re.IGNORECASE)

    for line in output.splitlines():
        match = line_re.match(line)
        if not match:
            continue
        local_address = match.group(1)
        state = match.group(3).upper()
        pid_text = match.group(4)

        if state != "LISTENING":
            continue

        port = extract_port_from_address(local_address)
        if port is None or port not in port_set:
            continue

        try:
            pid = int(pid_text)
        except ValueError:
            continue
        results[port].add(pid)

    return results


def extract_port_from_address(address: str) -> Optional[int]:
    if address.startswith("["):
        end_idx = address.rfind(":")
        if end_idx == -1:
            return None
        port_text = address[end_idx + 1 :]
    else:
        if ":" not in address:
            return None
        port_text = address.rsplit(":", 1)[1]

    try:
        return int(port_text)
    except ValueError:
        return None


def kill_ports(ports: Iterable[int]) -> None:
    pid_map = find_pids_for_ports(ports)
    killed_any = False

    for port, pids in pid_map.items():
        for pid in sorted(pids):
            try:
                subprocess.check_call(["taskkill", "/PID", str(pid), "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print(f"Stopped PID {pid} on port {port}.")
                killed_any = True
            except subprocess.SubprocessError:
                print(f"Failed to stop PID {pid} on port {port}.")

    if not killed_any:
        print("No processes found on the configured ports.")


def remove_node_modules(root: Path) -> None:
    for dirpath, dirnames, _ in os.walk(root):
        if "node_modules" in dirnames:
            target = Path(dirpath) / "node_modules"
            print(f"Removing {target}...")
            try:
                shutil.rmtree(target)
            except OSError as exc:
                print(f"Failed to remove {target}: {exc}")
            dirnames.remove("node_modules")


def clean_up() -> None:
    remove_node_modules(ROOT)
    ports = gather_ports()
    if ports:
        kill_ports(ports)
    else:
        print("No ports configured for cleanup.")


def run() -> int:
    pnpm_cmd = None
    for candidate in ("pnpm", "pnpm.cmd"):
        candidate_path = shutil.which(candidate)
        if candidate_path:
            pnpm_cmd = [candidate_path]
            break

    if pnpm_cmd is None:
        corepack_path = shutil.which("corepack")
        if corepack_path:
            pnpm_cmd = [corepack_path, "pnpm"]

    if pnpm_cmd is None:
        print("pnpm is not installed or not on PATH (or via corepack).")
        return 1

    for path in (ROOT, ROOT / "client", ROOT / "server"):
        if (path / "package.json").is_file():
            print(f"Installing dependencies in {path}...")
            result = subprocess.run([*pnpm_cmd, "install"], cwd=path)
            if result.returncode != 0:
                return result.returncode

    print("Starting dev servers...")
    return subprocess.call([*pnpm_cmd, "run", "dev"], cwd=ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description="Clean up node_modules, free app ports, and run the dev stack.")
    parser.add_argument(
        "command",
        nargs="?",
        choices=("clean_up", "run", "all"),
        default="all",
        help="clean_up: remove node_modules and free ports, run: install deps and start dev, all: both",
    )
    args = parser.parse_args()

    if args.command in ("clean_up", "all"):
        clean_up()
    if args.command in ("run", "all"):
        return run()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
