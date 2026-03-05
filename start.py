import argparse
import os
import re
import shutil
import subprocess
import sys
import ctypes
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Set, Tuple

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


def as_bool(value: Optional[str]) -> bool:
    if value is None:
        return False
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def copy_text_to_clipboard(text: str) -> bool:
    if os.name != "nt":
        return False
    try:
        # Most reliable on Windows shells.
        result = subprocess.run(["clip"], input=text, text=True, capture_output=True)
        if result.returncode == 0:
            return True
    except Exception:
        pass
    try:
        CF_UNICODETEXT = 13
        GMEM_MOVEABLE = 0x0002

        user32 = ctypes.windll.user32
        kernel32 = ctypes.windll.kernel32

        kernel32.GlobalAlloc.argtypes = [ctypes.c_uint, ctypes.c_size_t]
        kernel32.GlobalAlloc.restype = ctypes.c_void_p
        kernel32.GlobalLock.argtypes = [ctypes.c_void_p]
        kernel32.GlobalLock.restype = ctypes.c_void_p
        kernel32.GlobalUnlock.argtypes = [ctypes.c_void_p]
        kernel32.GlobalUnlock.restype = ctypes.c_int
        kernel32.GlobalFree.argtypes = [ctypes.c_void_p]
        kernel32.GlobalFree.restype = ctypes.c_void_p
        user32.OpenClipboard.argtypes = [ctypes.c_void_p]
        user32.OpenClipboard.restype = ctypes.c_int
        user32.EmptyClipboard.argtypes = []
        user32.EmptyClipboard.restype = ctypes.c_int
        user32.SetClipboardData.argtypes = [ctypes.c_uint, ctypes.c_void_p]
        user32.SetClipboardData.restype = ctypes.c_void_p
        user32.CloseClipboard.argtypes = []
        user32.CloseClipboard.restype = ctypes.c_int

        if not user32.OpenClipboard(0):
            return False
        try:
            if not user32.EmptyClipboard():
                return False

            data = ctypes.create_unicode_buffer(text)
            data_size = ctypes.sizeof(data)
            h_global = kernel32.GlobalAlloc(GMEM_MOVEABLE, data_size)
            if not h_global:
                return False

            locked_mem = kernel32.GlobalLock(h_global)
            if not locked_mem:
                kernel32.GlobalFree(h_global)
                return False
            try:
                ctypes.memmove(locked_mem, ctypes.addressof(data), data_size)
            finally:
                kernel32.GlobalUnlock(h_global)

            if not user32.SetClipboardData(CF_UNICODETEXT, h_global):
                kernel32.GlobalFree(h_global)
                return False

            # Ownership transfers to system on successful SetClipboardData.
            return True
        finally:
            user32.CloseClipboard()
    except Exception:
        return False


def show_warning_message_box(title: str, message: str, allow_cancel: bool = False) -> bool:
    if os.name != "nt":
        return True
    try:
        MB_OK = 0x00000000
        MB_OKCANCEL = 0x00000001
        MB_ICONWARNING = 0x00000030
        IDOK = 1
        style = (MB_OKCANCEL if allow_cancel else MB_OK) | MB_ICONWARNING
        result = ctypes.windll.user32.MessageBoxW(0, message, title, style)
        if allow_cancel:
            return result == IDOK
        return True
    except Exception:
        # Silent fallback: warning is still printed in console output.
        return True


def extract_warning_items(stdout: str) -> List[Tuple[str, str]]:
    """
    Extract (file, detail) tuples from guardrail output lines.
    Detail examples:
    - Client network call outside api.js
    - File size 512/500
    - DB read from tbl_*: SELECT TOP 1 ...
    """
    items: List[Tuple[str, str]] = []
    current_section = ""
    for raw in stdout.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith("== ") and line.endswith(" =="):
            current_section = line
            continue
        if line.startswith("WARNING: Found disallowed network calls"):
            current_section = "CLIENT_NET"
            continue
        if "SELECT FROM tbl_* detected" in line:
            current_section = "DB_TBL_READS"
            continue
        if line.startswith("Found ") and "file(s) above 500 lines" in line:
            current_section = "FILE_SIZE_500"
            continue
        if line.startswith("HIGH WARNING:") and "above 700 lines" in line:
            current_section = "FILE_SIZE_700"
            continue

        if not line.startswith("- "):
            continue
        payload = line[2:]

        # Case 1: "path (512/500)"
        m_size = re.match(r"^(.*)\s+\((\d+/\d+)\)\s*$", payload)
        if m_size:
            file_path = m_size.group(1).strip().replace("\\", "/")
            ratio = m_size.group(2)
            detail = f"File size {ratio}"
            items.append((file_path, detail))
            continue

        # Case 2: "path: detail"
        if ":" in payload:
            file_path, detail = payload.split(":", 1)
            file_path = file_path.strip().replace("\\", "/")
            detail = detail.strip()
            if current_section == "DB_TBL_READS":
                detail = f"DB read from tbl_*: {detail}"
            items.append((file_path, detail))
            continue

        # Case 3: plain path
        file_path = payload.strip().replace("\\", "/")
        if current_section == "CLIENT_NET":
            items.append((file_path, "Client network call outside client/src/api.js"))
        else:
            items.append((file_path, "Warning detected"))

    return items


def summarize_warning_items(items: List[Tuple[str, str]]) -> List[Tuple[str, List[str]]]:
    grouped: Dict[str, List[str]] = {}
    for file_path, detail in items:
        grouped.setdefault(file_path, [])
        if detail not in grouped[file_path]:
            grouped[file_path].append(detail)
    return [(k, grouped[k]) for k in grouped]


def build_fix_prompt(warnings: List[Tuple[str, List[str]]]) -> str:
    files_block = "\n".join(f"- {p}" for p, _ in warnings) if warnings else "- (geen bestanden gevonden)"
    return (
        "Fix-aanpak (kort):\n"
        "Los onderstaande guardrail-waarschuwingen gericht op zonder functioneel gedrag te breken.\n\n"
        "Doelen:\n"
        "1) Behoud bestaande functionaliteit.\n"
        "2) Houd files binnen AGENTS.md-modulariteitsregels.\n"
        "3) Pas alleen noodzakelijke wijzigingen toe.\n"
        "4) Geef na afloop een korte impactsamenvatting en eventuele risico's.\n\n"
        "Bestanden:\n"
        f"{files_block}\n\n"
        "Acties:\n"
        "- Analyseer per bestand de concrete warning.\n"
        "- Voer kleine, betekenisvolle refactors uit.\n"
        "- Controleer met: npm run guardrails:strict\n"
        "- Valideer build/start waar relevant."
    )


def show_selectable_warning_ui(title: str, content: str) -> bool:
    if os.name != "nt":
        return True
    try:
        import tkinter as tk
    except Exception:
        return show_warning_message_box(title, content[:1900], allow_cancel=True)

    try:
        proceed = {"value": False}

        def on_ok() -> None:
            proceed["value"] = True
            root.destroy()

        def on_cancel() -> None:
            copied = copy_text_to_clipboard(content)
            if not copied:
                root.clipboard_clear()
                root.clipboard_append(content)
                root.update()
            proceed["value"] = False
            root.destroy()

        root = tk.Tk()
        root.title(title)
        root.geometry("980x680")
        root.minsize(820, 520)
        root.attributes("-topmost", True)
        root.protocol("WM_DELETE_WINDOW", on_cancel)

        container = tk.Frame(root)
        container.pack(fill=tk.BOTH, expand=True, padx=12, pady=12)

        info = tk.Label(
            container,
            text="Guardrail warnings detected. Select and copy text below.",
            anchor="w",
            justify="left",
        )
        info.pack(fill=tk.X, pady=(0, 8))

        text_wrap = tk.Frame(container)
        text_wrap.pack(fill=tk.BOTH, expand=True)

        text = tk.Text(text_wrap, wrap=tk.WORD, font=("Consolas", 10))
        yscroll = tk.Scrollbar(text_wrap, orient=tk.VERTICAL, command=text.yview)
        text.configure(yscrollcommand=yscroll.set)

        yscroll.pack(side=tk.RIGHT, fill=tk.Y)
        text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        text.insert("1.0", content)
        text.configure(state=tk.NORMAL)  # keep selectable/copyable
        text.focus_set()

        button_row = tk.Frame(container)
        button_row.pack(fill=tk.X, pady=(10, 0))

        cancel_btn = tk.Button(button_row, text="Cancel", width=12, command=on_cancel)
        cancel_btn.pack(side=tk.RIGHT, padx=(8, 0))

        ok_btn = tk.Button(button_row, text="OK", width=12, command=on_ok)
        ok_btn.pack(side=tk.RIGHT)

        root.mainloop()
        return proceed["value"]
    except Exception:
        return show_warning_message_box(title, content[:1900], allow_cancel=True)


def run_guardrails_signal(env: Dict[str, str], pnpm_cmd: List[str]) -> bool:
    enabled = as_bool(env.get("GUARDRAILS_ENABLED"))
    if not enabled and "GUARDRAILS_ENABLED" not in env:
        # Backward compatibility with previous flag name.
        enabled = as_bool(env.get("BUILDING_WARNINGS"))
    if not enabled:
        return True

    mode_raw = str(env.get("GUARDRAILS_MODE", "strict")).strip().lower()
    script_map = {
        "signal": "guardrails",
        "strict": "guardrails:strict",
        "enforce": "guardrails:enforce",
        "enforce:strict": "guardrails:enforce:strict",
        "enforce_strict": "guardrails:enforce:strict",
    }
    script_name = script_map.get(mode_raw, "guardrails:strict")

    print(f"Running guardrails warning scan (mode={script_name})...")
    result = subprocess.run(
        [*pnpm_cmd, "run", script_name],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )

    # Always print output so warnings are visible in terminal logs.
    if result.stdout:
        print(result.stdout, end="" if result.stdout.endswith("\n") else "\n")
    if result.stderr:
        print(result.stderr, end="" if result.stderr.endswith("\n") else "\n")

    combined = f"{result.stdout}\n{result.stderr}".upper()
    has_warning_signal = "WARNING" in combined
    if has_warning_signal:
        warning_items = extract_warning_items(result.stdout)
        warning_summary = summarize_warning_items(warning_items)
        if warning_summary:
            list_lines: List[str] = []
            for file_path, details in warning_summary[:15]:
                list_lines.append(f"- {file_path}")
                for d in details[:2]:
                    list_lines.append(f"    * {d}")
            if len(warning_summary) > 15:
                list_lines.append(f"... en {len(warning_summary) - 15} extra bestanden")
            warning_list = "\n".join(list_lines)
        else:
            warning_list = "- (geen bestanden herkend)"
        prompt = build_fix_prompt(warning_summary)
        full_text = (
            "Guardrails found warnings during startup.\n"
            f"Mode: {script_name}\n\n"
            "Bestanden met waarschuwingen:\n"
            f"{warning_list}\n\n"
            "Snelle fix-prompt:\n"
            f"{prompt}\n"
        )
        return show_selectable_warning_ui("Build Warnings Detected", full_text)

    return True


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

    env = {
        **read_env_file(ROOT / ".env.example"),
        **read_env_file(ROOT / ".env"),
        **os.environ,
    }
    should_continue = run_guardrails_signal(env, pnpm_cmd)
    if not should_continue:
        print("Startup cancelled by user from guardrail warning dialog.")
        return 1

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
