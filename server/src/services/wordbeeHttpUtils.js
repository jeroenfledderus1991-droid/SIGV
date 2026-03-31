function sleep(ms) {
  const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function parseRetryAfterMs(value) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.floor(seconds * 1000);
  const asDate = Date.parse(value);
  if (!Number.isFinite(asDate)) return 0;
  const diff = asDate - Date.now();
  return diff > 0 ? diff : 0;
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function extractErrorText(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload.error === "string") return payload.error;
  if (payload.error && typeof payload.error === "object") {
    return pickFirstValue(
      payload.error.message,
      payload.error.type,
      payload.error.code,
      payload.error.error_description
    );
  }
  return pickFirstValue(payload.message, payload.detail, payload.title, payload.error_description);
}

module.exports = {
  sleep,
  parseRetryAfterMs,
  extractErrorText,
};
