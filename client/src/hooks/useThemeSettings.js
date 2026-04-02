import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "../api";
import { getBootstrap, loadBootstrap, setBootstrap } from "../bootstrap";
import {
  DEFAULT_CONTAINER_TINT,
  DEFAULT_TABLE_TINT,
  getContainerTintRgb,
  getTableTintRgb,
  normalizeContainerTint,
  normalizeTableTint,
} from "../tableTintPresets";

const DEFAULT_SETTINGS = {
  theme: "light",
  accentColor: "#121c5a",
  accentTextColor: "#ffffff",
  sidebarVariant: "white",
  gradientIntensity: 30,
  tableTint: DEFAULT_TABLE_TINT,
  containerTint: DEFAULT_CONTAINER_TINT,
};
const STORAGE_KEY = "themeSettings";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return [18, 28, 90];
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
  const tableTint = normalizeTableTint(input.tableTint ?? input.table_tint);
  const containerTint = normalizeContainerTint(input.containerTint ?? input.container_tint);
  return {
    ...DEFAULT_SETTINGS,
    theme,
    accentColor,
    accentTextColor,
    sidebarVariant,
    gradientIntensity,
    tableTint,
    containerTint,
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
  root.style.setProperty("--table-tint-rgb", getTableTintRgb(settings.tableTint));
  root.style.setProperty("--container-tint-rgb", getContainerTintRgb(settings.containerTint));

  body.classList.remove("theme-light", "theme-dark", "theme-auto");
  body.classList.add(`theme-${settings.theme}`);
}

function syncBootstrapThemeSettings(settings) {
  const bootstrap = getBootstrap();
  if (!bootstrap || typeof bootstrap !== "object") return;
  setBootstrap({
    ...bootstrap,
    themeSettings: {
      ...(bootstrap.themeSettings || {}),
      theme: settings.theme,
      accentColor: settings.accentColor,
      accentTextColor: settings.accentTextColor,
      sidebarVariant: settings.sidebarVariant,
      gradientIntensity: settings.gradientIntensity,
      tableTint: settings.tableTint,
      containerTint: settings.containerTint,
    },
  });
}

export default function useThemeSettings(enabled = true) {
  const bootstrap = getBootstrap();
  const bootstrapSettings = enabled ? normalizeSettings(bootstrap.themeSettings) : null;
  const cachedSettings = enabled ? bootstrapSettings || getStoredSettings() : null;
  const [settings, setSettings] = useState(() => cachedSettings || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(enabled && !cachedSettings);

  useEffect(() => {
    let mounted = true;
    const initialBootstrapSettings = enabled ? normalizeSettings(getBootstrap().themeSettings) : null;
    const stored = initialBootstrapSettings ? null : getStoredSettings();
    const updateLocalState = (nextSettings, nextLoading) => {
      Promise.resolve().then(() => {
        if (!mounted) return;
        if (nextSettings) setSettings(nextSettings);
        if (typeof nextLoading === "boolean") setLoading(nextLoading);
      });
    };
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
            tableTint: data.table_tint || data.tableTint || DEFAULT_SETTINGS.tableTint,
            containerTint: data.container_tint || data.containerTint || DEFAULT_SETTINGS.containerTint,
          };
          setSettings(merged);
          applyThemeSettings(merged);
          storeSettings(merged);
          syncBootstrapThemeSettings(merged);
        })
        .catch(() => {
          if (!stored) {
            applyThemeSettings(DEFAULT_SETTINGS);
            setSettings(DEFAULT_SETTINGS);
            syncBootstrapThemeSettings(DEFAULT_SETTINGS);
          }
        })
        .finally(() => setLoading(false));
    };
    if (!enabled) {
      applyThemeSettings(DEFAULT_SETTINGS);
      return () => {
        mounted = false;
      };
    }

    if (initialBootstrapSettings) {
      applyThemeSettings(initialBootstrapSettings);
      storeSettings(initialBootstrapSettings);
      syncBootstrapThemeSettings(initialBootstrapSettings);
      updateLocalState(initialBootstrapSettings, false);
    } else if (stored) {
      applyThemeSettings(stored);
      syncBootstrapThemeSettings(stored);
      updateLocalState(stored, false);
    } else {
      applyThemeSettings(DEFAULT_SETTINGS);
      syncBootstrapThemeSettings(DEFAULT_SETTINGS);
      updateLocalState(null, true);
    }

    loadBootstrap()
      .then((bootstrapData) => {
        if (!mounted) return;
        const fromBootstrap = normalizeSettings(bootstrapData?.themeSettings);
        if (fromBootstrap) {
          setSettings(fromBootstrap);
          applyThemeSettings(fromBootstrap);
          storeSettings(fromBootstrap);
          syncBootstrapThemeSettings(fromBootstrap);
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
        table_tint: merged.tableTint,
        container_tint: merged.containerTint,
      }).catch(() => null);
      syncBootstrapThemeSettings(merged);
      return merged;
    });
  }, []);

  return {
    settings: enabled ? settings : DEFAULT_SETTINGS,
    updateSettings,
    loading: enabled ? loading : false,
    hasCache: enabled ? Boolean(cachedSettings) : false,
  };
}
