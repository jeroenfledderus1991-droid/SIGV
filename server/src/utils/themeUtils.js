function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const TINT_RGB_MAP = Object.freeze({
  neutral: "223,227,234",
  mint: "214,236,225",
  sky: "212,226,244",
  sand: "236,227,212",
  peach: "243,223,212",
  lavender: "229,221,243",
  rose: "246,211,223",
  aqua: "199,238,240",
  lime: "217,241,169",
  sunset: "255,188,153",
  coral: "255,159,147",
  canary: "255,227,127",
});

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [44, 95, 65];
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
}

function mixWithBlack(hex, intensity) {
  const ratio = clamp(intensity, 0, 100) / 100;
  const boosted = Math.pow(ratio, 0.65);
  const [r, g, b] = hexToRgb(hex);
  const mixed = [r, g, b].map((value) => Math.round(value * (1 - boosted)));
  return `rgb(${mixed.join(",")})`;
}

function normalizeTint(value, fallback) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return fallback;
  if (TINT_RGB_MAP[key]) return key;
  const asHex = normalizeHex(key, "");
  if (asHex) return asHex.toLowerCase();
  return fallback;
}

function getTintRgb(value, fallback) {
  const normalized = normalizeTint(value, fallback);
  if (TINT_RGB_MAP[normalized]) return TINT_RGB_MAP[normalized];
  return hexToRgb(normalized).join(",");
}

function normalizeTableTint(value, fallback = "mint") {
  return normalizeTint(value, fallback);
}

function normalizeContainerTint(value, fallback = "mint") {
  return normalizeTint(value, fallback);
}

function getTableTintRgb(value, fallback = "mint") {
  return getTintRgb(value, fallback);
}

function getContainerTintRgb(value, fallback = "mint") {
  return getTintRgb(value, fallback);
}

module.exports = {
  clamp,
  normalizeHex,
  mixWithBlack,
  normalizeTableTint,
  normalizeContainerTint,
  getTableTintRgb,
  getContainerTintRgb,
};
