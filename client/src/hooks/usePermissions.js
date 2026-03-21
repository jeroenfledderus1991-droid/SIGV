import { useEffect, useRef, useState } from "react";
import { getJson } from "../api";
import { getBootstrap, loadBootstrap } from "../bootstrap";

const STORAGE_KEY = "permissions";

const DEFAULT_STATE = {
  allowedPaths: [],
  roles: [],
};

function normalizePermissions(data) {
  if (!data || typeof data !== "object") return null;
  return {
    allowedPaths: Array.isArray(data.allowedPaths) ? data.allowedPaths : [],
    roles: Array.isArray(data.roles) ? data.roles : [],
  };
}

function getStoredPermissions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizePermissions(JSON.parse(raw));
  } catch {
    return null;
  }
}

function storePermissions(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return;
  }
}

export default function usePermissions(enabled = true) {
  const bootstrap = getBootstrap();
  const bootstrapPermissions = enabled ? bootstrap.permissions : null;
  const cachedPermissions = enabled ? bootstrapPermissions || getStoredPermissions() : null;
  const hasCachedPermissionsRef = useRef(Boolean(cachedPermissions));
  const [permissions, setPermissions] = useState(cachedPermissions || DEFAULT_STATE);
  const [loading, setLoading] = useState(enabled && !cachedPermissions);

  useEffect(() => {
    let mounted = true;
    const fallbackFetch = () => {
      getJson("/auth/permissions")
        .then((data) => {
          if (!mounted) return;
          const next = normalizePermissions(data);
          if (!next) return;
          setPermissions(next);
          storePermissions(next);
        })
        .catch(() => {
          if (mounted && !hasCachedPermissionsRef.current) setPermissions(DEFAULT_STATE);
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    };
    if (!enabled) {
      storePermissions(DEFAULT_STATE);
      return () => {
        mounted = false;
      };
    }

    loadBootstrap()
      .then((bootstrapData) => {
        if (!mounted) return;
        const next = normalizePermissions(bootstrapData?.permissions);
        if (next) {
          setPermissions(next);
          storePermissions(next);
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

  return {
    permissions: enabled ? permissions : DEFAULT_STATE,
    loading: enabled ? loading : false,
    hasCache: enabled ? Boolean(cachedPermissions) : false,
  };
}
