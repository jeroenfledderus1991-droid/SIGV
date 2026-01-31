import { useEffect, useState } from "react";
import { getJson } from "../api";

const DEFAULT_SETTINGS = {
  sidebarOrientation: "vertical",
  featureFlags: {
    enableUserSettings: true,
    enableUserProfile: true,
  },
  hasMicrosoftClient: false,
};

export default function useAppSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getJson("/settings")
      .then((data) => {
        if (!mounted) return;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data,
          featureFlags: {
            ...DEFAULT_SETTINGS.featureFlags,
            ...(data.featureFlags || {}),
          },
        });
      })
      .catch(() => {
        if (mounted) setSettings(DEFAULT_SETTINGS);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { settings, loading };
}
