const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function parseJsonFromStdout(stdoutText) {
  const trimmed = String(stdoutText || "").trim();
  if (!trimmed) return null;
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < 0 || lastBrace < firstBrace) return null;
  const candidate = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function sanitizeFilename(value, fallback) {
  const name = String(value || "").trim();
  if (!name) return fallback;
  return name.replace(/[^\w.\- ]/g, "_");
}

function runPythonReportScript({ scriptPath, year, month, timeoutMs = 180000 }) {
  return new Promise((resolve, reject) => {
    const args = [scriptPath, "--year", String(year), "--month", String(month)];
    const pythonCommand = process.platform === "win32" ? "python" : (process.env.PYTHON_BIN || "python3");
    const child = spawn(pythonCommand, args, {
      cwd: path.resolve(path.dirname(scriptPath), ".."),
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error("PDF rapport generatie duurde te lang en is afgebroken."));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Python rapportscript faalde (${code}). ${stderr || stdout || "Unknown error"}`));
        return;
      }
      const parsed = parseJsonFromStdout(stdout);
      if (!parsed || !parsed.output) {
        reject(new Error("Rapportscript gaf geen geldig outputpad terug."));
        return;
      }
      resolve(parsed);
    });
  });
}

function createWordbeeReportService() {
  const scriptPath = path.resolve(__dirname, "..", "..", "..", "scripts", "generate_wordbee_client_report.py");

  async function generateReportPdf(year, month) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error("Ongeldige periode voor rapportage.");
    }
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Rapportscript niet gevonden: ${scriptPath}`);
    }

    const scriptResult = await runPythonReportScript({ scriptPath, year, month });
    const outputPath = path.resolve(String(scriptResult.output));
    if (!fs.existsSync(outputPath)) {
      throw new Error(`Gegenereerd rapportbestand niet gevonden: ${outputPath}`);
    }

    const defaultFilename = `Voorbeeldrapportage-opdrachtgever-${year}-${String(month).padStart(2, "0")}.pdf`;
    return {
      outputPath,
      filename: sanitizeFilename(path.basename(outputPath), defaultFilename),
      metadata: scriptResult,
    };
  }

  return {
    generateReportPdf,
  };
}

module.exports = {
  createWordbeeReportService,
};
