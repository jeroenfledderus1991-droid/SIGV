import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "../api";
import { getBootstrap, loadBootstrap } from "../bootstrap";

const STORAGE_KEY = "authUser";

function getStoredUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function storeUser(user) {
  try {
    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    return;
  }
}

function getInitialUser() {
  const bootstrap = getBootstrap();
  return bootstrap.user || getStoredUser();
}

export default function useAuth(enabled = true) {
  const initialUser = getInitialUser();
  const [user, setUser] = useState(initialUser);
  const [loading, setLoading] = useState(enabled);
  const [ready, setReady] = useState(!enabled);

  const refresh = useCallback(() => {
    setLoading(true);
    return getJson("/auth/me")
      .then((data) => {
        setUser(data);
        storeUser(data);
        return data;
      })
      .catch(() => {
        setUser(null);
        storeUser(null);
        return null;
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    return postJson("/auth/logout")
      .catch(() => null)
      .finally(() => {
        setUser(null);
        storeUser(null);
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let mounted = true;
    const updateLocalState = ({ nextUser, nextLoading, nextReady }) => {
      Promise.resolve().then(() => {
        if (!mounted) return;
        if (nextUser !== undefined) setUser(nextUser);
        if (typeof nextLoading === "boolean") setLoading(nextLoading);
        if (typeof nextReady === "boolean") setReady(nextReady);
      });
    };
    updateLocalState({ nextLoading: true, nextReady: false });
    loadBootstrap()
      .then((bootstrap) => {
        if (!mounted) return;
        if (bootstrap && Object.prototype.hasOwnProperty.call(bootstrap, "user")) {
          const bootstrapUser = bootstrap.user || null;
          setUser(bootstrapUser);
          storeUser(bootstrapUser);
          setLoading(false);
          setReady(true);
          return;
        }
        if (bootstrap?.user) {
          setUser(bootstrap.user);
          storeUser(bootstrap.user);
          setLoading(false);
          setReady(true);
          return;
        }
        refresh().finally(() => {
          if (mounted) setReady(true);
        });
      })
      .catch(() => {
        if (mounted) {
          refresh().finally(() => {
            if (mounted) setReady(true);
          });
        }
      });
    return () => {
      mounted = false;
    };
  }, [refresh, enabled]);

  const hasCache = Boolean(user || getInitialUser());
  return {
    user,
    loading: enabled ? loading : false,
    refresh,
    logout,
    hasCache,
    ready: enabled ? ready : true,
  };
}
