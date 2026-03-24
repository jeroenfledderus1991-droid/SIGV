import { postJsonSafe } from "../api.js";
const MAX_EVENTS_PER_SESSION = 40;
const DEDUPE_WINDOW_MS = 30_000;
const seenEvents = new Map();
let sentCount = 0;
let initialized = false;

const IGNORED_PATTERNS = [
  "bootstrap-autofill-overlay.js",
  "autofillfielddata.autocompletetype is null",
  "-moz-osx-font-smoothing",
  "font-smooth",
  "regelset genegeerd vanwege foute selector",
  "request failed with 401",
  "ongeldige inloggegevens",
  "te veel mislukte pogingen",
  "csrf token mismatch",
];

function toText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeErrorInput(input) {
  if (!input) return { message: "", stackTrace: "" };
  if (input instanceof Error) {
    return {
      message: toText(input.message),
      stackTrace: toText(input.stack),
    };
  }
  if (typeof input === "string") {
    return {
      message: toText(input),
      stackTrace: "",
    };
  }
  return {
    message: toText(input.message || input.error || input.reason),
    stackTrace: toText(input.stack),
  };
}

function shouldIgnore({ message, stackTrace, sourceUrl }) {
  const haystack = `${message} ${stackTrace} ${sourceUrl}`.toLowerCase();
  if (!haystack.trim()) return true;
  if (sourceUrl && /^(chrome|moz|safari)-extension:\/\//i.test(sourceUrl)) return true;
  return IGNORED_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function shouldDropByDedupe(key) {
  const now = Date.now();
  const previous = seenEvents.get(key);
  seenEvents.set(key, now);
  if (!previous) return false;
  return now - previous < DEDUPE_WINDOW_MS;
}

function buildPayload({ message, stackTrace, category, sourceUrl, lineNumber, columnNumber, extra }) {
  return {
    message: toText(message).slice(0, 1024),
    stackTrace: toText(stackTrace).slice(0, 4000),
    category: toText(category).slice(0, 80) || "client_error",
    sourceUrl: toText(sourceUrl).slice(0, 1024),
    lineNumber: Number.isFinite(lineNumber) ? lineNumber : null,
    columnNumber: Number.isFinite(columnNumber) ? columnNumber : null,
    userPath: `${window.location.pathname}${window.location.search || ""}`.slice(0, 255),
    metadata: extra && typeof extra === "object" ? extra : null,
  };
}

async function report(payload) {
  if (sentCount >= MAX_EVENTS_PER_SESSION) return;
  const message = payload?.message || "";
  const stackTrace = payload?.stackTrace || "";
  const sourceUrl = payload?.sourceUrl || "";
  if (shouldIgnore({ message, stackTrace, sourceUrl })) return;
  const dedupeKey = `${payload.category}|${message}|${sourceUrl}`;
  if (shouldDropByDedupe(dedupeKey)) return;
  sentCount += 1;
  await postJsonSafe("/system-errors/client", payload);
}

function parseConsoleArgs(args) {
  const normalized = args.map((arg) => normalizeErrorInput(arg));
  const primary = normalized.find((entry) => entry.message) || normalized[0] || { message: "", stackTrace: "" };
  return {
    message: primary.message || normalized.map((entry) => entry.message).filter(Boolean).join(" | ").slice(0, 1024),
    stackTrace: primary.stackTrace,
    category: "console_error",
  };
}

export function initClientErrorLogging() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  window.addEventListener("error", (event) => {
    const info = normalizeErrorInput(event.error || event.message);
    const payload = buildPayload({
      message: info.message || toText(event.message),
      stackTrace: info.stackTrace,
      category: "window_error",
      sourceUrl: event.filename,
      lineNumber: event.lineno,
      columnNumber: event.colno,
    });
    void report(payload);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const info = normalizeErrorInput(event.reason);
    const payload = buildPayload({
      message: info.message || "Unhandled promise rejection",
      stackTrace: info.stackTrace,
      category: "unhandled_rejection",
      sourceUrl: "",
    });
    void report(payload);
  });

  const originalConsoleError = console.error.bind(console);
  console.error = (...args) => {
    const parsed = parseConsoleArgs(args);
    const payload = buildPayload({
      message: parsed.message,
      stackTrace: parsed.stackTrace,
      category: parsed.category,
      sourceUrl: "",
    });
    void report(payload);
    originalConsoleError(...args);
  };
}
