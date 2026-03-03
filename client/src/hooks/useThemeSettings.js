import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "../api";
import { getBootstrap, loadBootstrap } from "../bootstrap";

const DEFAULT_SETTINGS = {
  theme: "light",
  accentColor: "#2c5f41",
  accentTextColor: "#ffffff",
  sidebarVariant: "accent-gradient",
  gradientIntensity: 30,
};
const STORAGE_KEY = "themeSettings";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function normalizeHex(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(trimmed)) return fallback;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function normalizeSettings(input) {
  if (!input || typeof input !== "object") return null;
  const theme = ["light", "dark", "auto"].includes(input.theme) ? input.theme : DEFAULT_SETTINGS.theme;
  const accentColor = normalizeHex(input.accentColor, DEFAULT_SETTINGS.accentColor);
  const accentTextColor = normalizeHex(input.accentTextColor, DEFAULT_SETTINGS.accentTextColor);
  const sidebarVariant = typeof input.sidebarVariant === "string" ? input.sidebarVariant : DEFAULT_SETTINGS.sidebarVariant;
  const gradientIntensity = Number.isFinite(Number(input.gradientIntensity))
    ? clamp(Number(input.gradientIntensity), 0, 100)
    : DEFAULT_SETTINGS.gradientIntensity;
  return {
    ...DEFAULT_SETTINGS,
    theme,
    accentColor,
    accentTextColor,
    sidebarVariant,
    gradientIntensity,
  };
}

function getStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function storeSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    return;
  }
}

function applyThemeSettings(settings) {
  const root = document.documentElement;
  const body = document.body;

  body.dataset.theme = settings.theme;

  root.style.setProperty("--accent-color", settings.accentColor);
  root.style.setProperty("--accent-text-color", settings.accentTextColor);
  root.style.setProperty("--accent-color-rgb", hexToRgb(settings.accentColor).join(","));
  root.style.setProperty("--accent-hover", `${settings.accentColor}E6`);
  root.style.setProperty("--sidebar-accent-second", mixWithBlack(settings.accentColor, settings.gradientIntensity));

  body.classList.remove("theme-light", "theme-dark", "theme-auto");
  body.classList.add(`theme-${settings.theme}`);
}

export default function useThemeSettings(enabled = true) {
  const bootstrap = getBootstrap();
  const bootstrapSettings = enabled ? normalizeSettings(bootstrap.themeSettings) : null;
  const cachedSettings = enabled ? bootstrapSettings || getStoredSettings() : null;
  const [settings, setSettings] = useState(() => cachedSettings || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(enabled && !cachedSettings);

  useEffect(() => {
    let mounted = true;
    const stored = bootstrapSettings ? null : getStoredSettings();
    const fallbackFetch = () => {
      getJson("/user-settings")
        .then((data) => {
          if (!mounted) return;
          const merged = {
            ...DEFAULT_SETTINGS,
            theme: data.theme || DEFAULT_SETTINGS.theme,
            accentColor: data.accent_color || DEFAULT_SETTINGS.accentColor,
            accentTextColor: data.accent_text_color || DEFAULT_SETTINGS.accentTextColor,
            sidebarVariant: data.sidebar_variant || DEFAULT_SETTINGS.sidebarVariant,
            gradientIntensity: Number.isFinite(data.gradient_intensity)
              ? data.gradient_intensity
              : DEFAULT_SETTINGS.gradientIntensity,
          };
          setSettings(merged);
          applyThemeSettings(merged);
          storeSettings(merged);
        })
        .catch(() => {
          if (!stored) {
            applyThemeSettings(DEFAULT_SETTINGS);
            setSettings(DEFAULT_SETTINGS);
          }
        })
        .finally(() => setLoading(false));
    };
    if (!enabled) {
      applyThemeSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    if (bootstrapSettings) {
      setSettings(bootstrapSettings);
      applyThemeSettings(bootstrapSettings);
      storeSettings(bootstrapSettings);
      setLoading(false);
    } else if (stored) {
      setSettings(stored);
      applyThemeSettings(stored);
      setLoading(false);
    } else {
      applyThemeSettings(DEFAULT_SETTINGS);
      setLoading(true);
    }

    loadBootstrap()
      .then((bootstrapData) => {
        if (!mounted) return;
        const fromBootstrap = normalizeSettings(bootstrapData?.themeSettings);
        if (fromBootstrap) {
          setSettings(fromBootstrap);
          applyThemeSettings(fromBootstrap);
          storeSettings(fromBootstrap);
          setLoading(false);
          return;
        }
        fallbackFetch();
      })
      .catch(() => {
        fallbackFetch();
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  const updateSettings = useCallback((next) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      applyThemeSettings(merged);
      storeSettings(merged);
      postJson("/user-settings", {
        theme: merged.theme,
        accent_color: merged.accentColor,
        accent_text_color: merged.accentTextColor,
        sidebar_variant: merged.sidebarVariant,
        gradient_intensity: merged.gradientIntensity,
      }).catch(() => null);
      return merged;
    });
  }, []);

  return { settings, updateSettings, loading, hasCache: Boolean(cachedSettings) };
}
