import { useEffect, useRef, useState } from "react";
import { getJson } from "../api";
import { getBootstrap, loadBootstrap } from "../bootstrap";

const STORAGE_KEY = "appSettings";

const DEFAULT_SETTINGS = {
  sidebarOrientation: "vertical",
  localAuthEnabled: true,
  featureFlags: {
    enableUserSettings: true,
    enableUserProfile: true,
    sidebarHeaderWhite: false,
  },
  hasMicrosoftClient: false,
};

function normalizeSettings(data) {
  if (!data || typeof data !== "object") return null;
  return {
    ...DEFAULT_SETTINGS,
    ...data,
    featureFlags: {
      ...DEFAULT_SETTINGS.featureFlags,
      ...(data.featureFlags || {}),
    },
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

export default function useAppSettings() {
  const bootstrap = getBootstrap();
  const bootstrapSettings = bootstrap.appSettings || null;
  const cachedSettings = bootstrapSettings || getStoredSettings();
  const hasCachedSettingsRef = useRef(Boolean(cachedSettings));
  const [settings, setSettings] = useState(cachedSettings || DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    let mounted = true;
    const fallbackFetch = () => {
      getJson("/settings")
        .then((data) => {
          if (!mounted) return;
          const merged = normalizeSettings(data);
          if (!merged) return;
          setSettings(merged);
          storeSettings(merged);
        })
        .catch(() => {
          if (mounted && !hasCachedSettingsRef.current) setSettings(DEFAULT_SETTINGS);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    };

    loadBootstrap()
      .then((bootstrapData) => {
        if (!mounted) return;
        const merged = normalizeSettings(bootstrapData?.appSettings);
        if (merged) {
          setSettings(merged);
          storeSettings(merged);
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
  }, []);

  return { settings, loading, hasCache: Boolean(cachedSettings) };
}
