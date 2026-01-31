import { useEffect, useState } from "react";
import { getJson } from "../api";

const DEFAULT_STATE = {
  allowedPaths: [],
  roles: [],
};

export default function usePermissions(enabled = true) {
  const [permissions, setPermissions] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    let mounted = true;
    if (!enabled) {
      setPermissions(DEFAULT_STATE);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    getJson("/auth/permissions")
      .then((data) => {
        if (!mounted) return;
        setPermissions({
          allowedPaths: data.allowedPaths || [],
          roles: data.roles || [],
        });
      })
      .catch(() => {
        if (mounted) setPermissions(DEFAULT_STATE);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return { permissions, loading };
}
