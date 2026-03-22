const DEFAULT_TINT_SWATCH = "#dfe3ea";

const BASE_TINT_PRESETS = Object.freeze([
  { value: "neutral", label: "Neutraal", swatch: "#dfe3ea" },
  { value: "mint", label: "Mint", swatch: "#d6ece1" },
  { value: "sky", label: "Luchtblauw", swatch: "#d4e2f4" },
  { value: "sand", label: "Zand", swatch: "#ece3d4" },
  { value: "peach", label: "Perzik", swatch: "#f3dfd4" },
  { value: "lavender", label: "Lavendel", swatch: "#e5ddf3" },
  { value: "rose", label: "Roze", swatch: "#f6d3df" },
  { value: "aqua", label: "Aqua", swatch: "#c7eef0" },
  { value: "lime", label: "Limoen", swatch: "#d9f1a9" },
  { value: "sunset", label: "Sunset", swatch: "#ffbc99" },
  { value: "coral", label: "Koraal", swatch: "#ff9f93" },
  { value: "canary", label: "Geel", swatch: "#ffe37f" },
]);

const PRESET_BY_VALUE = Object.freeze(
  BASE_TINT_PRESETS.reduce((acc, preset) => {
    acc[preset.value] = preset;
    return acc;
  }, {})
);

function isValidHex(value) {
  return /^#?[0-9a-fA-F]{6}$/.test(String(value || "").trim());
}

function normalizeHex(value) {
  if (!isValidHex(value)) return "";
  const trimmed = String(value || "").trim();
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

function hexToRgbString(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return "223,227,234";
  const clean = normalized.slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16));
  return channels.join(",");
}

const TINT_RGB_MAP = Object.freeze(
  Object.entries(PRESET_BY_VALUE).reduce((acc, [key, preset]) => {
    acc[key] = hexToRgbString(preset.swatch);
    return acc;
  }, {})
);

export const DEFAULT_TABLE_TINT = "mint";
export const DEFAULT_CONTAINER_TINT = "mint";
export const TABLE_TINT_PRESETS = BASE_TINT_PRESETS;
export const CONTAINER_TINT_PRESETS = BASE_TINT_PRESETS;

function normalizeTint(value, fallback) {
  const normalizedKey = String(value || "").trim().toLowerCase();
  if (!normalizedKey) return fallback;
  if (TINT_RGB_MAP[normalizedKey]) return normalizedKey;
  const normalizedHex = normalizeHex(normalizedKey);
  if (normalizedHex) return normalizedHex;
  return fallback;
}

function tintToRgb(value, fallback) {
  const normalized = normalizeTint(value, fallback);
  if (TINT_RGB_MAP[normalized]) return TINT_RGB_MAP[normalized];
  return hexToRgbString(normalized);
}

function tintToSwatch(value, fallback) {
  const normalized = normalizeTint(value, fallback);
  if (PRESET_BY_VALUE[normalized]) return PRESET_BY_VALUE[normalized].swatch;
  if (normalized.startsWith("#")) return normalized;
  return DEFAULT_TINT_SWATCH;
}

export function normalizeTableTint(value) {
  return normalizeTint(value, DEFAULT_TABLE_TINT);
}

export function normalizeContainerTint(value) {
  return normalizeTint(value, DEFAULT_CONTAINER_TINT);
}

export function getTableTintRgb(value) {
  return tintToRgb(value, DEFAULT_TABLE_TINT);
}

export function getContainerTintRgb(value) {
  return tintToRgb(value, DEFAULT_CONTAINER_TINT);
}

export function resolveTableTintSwatch(value) {
  return tintToSwatch(value, DEFAULT_TABLE_TINT);
}

export function resolveContainerTintSwatch(value) {
  return tintToSwatch(value, DEFAULT_CONTAINER_TINT);
}

export function isCustomTint(value) {
  const normalized = normalizeTint(value, "");
  return normalized.startsWith("#");
}
