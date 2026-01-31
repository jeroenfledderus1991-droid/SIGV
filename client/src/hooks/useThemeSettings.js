import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "../api";

const DEFAULT_SETTINGS = {
  theme: "light",
  accentColor: "#2c5f41",
  accentTextColor: "#ffffff",
  sidebarVariant: "accent-gradient",
  gradientIntensity: 30,
};

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
  const [r, g, b] = hexToRgb(hex);
  const mixed = [r, g, b].map((value) => Math.round(value * (1 - ratio)));
  return `rgb(${mixed.join(",")})`;
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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      applyThemeSettings(DEFAULT_SETTINGS);
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
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
      })
      .catch(() => {
        applyThemeSettings(DEFAULT_SETTINGS);
      })
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, [enabled]);

  const updateSettings = useCallback((next) => {
    setSettings((prev) => {
      const merged = { ...prev, ...next };
      applyThemeSettings(merged);
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

  return { settings, updateSettings, loading };
}
