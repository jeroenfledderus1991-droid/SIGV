import { useCallback, useEffect, useRef, useState } from "react";
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
  const initialUserRef = useRef(getInitialUser());
  const [user, setUser] = useState(initialUserRef.current);
  const [loading, setLoading] = useState(enabled && !initialUserRef.current);
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
      setLoading(false);
      setReady(true);
      return;
    }
    let mounted = true;
    const immediateUser = getInitialUser();
    if (immediateUser) {
      setUser(immediateUser);
      storeUser(immediateUser);
      setLoading(false);
      setReady(true);
      return () => {
        mounted = false;
      };
    }
    setLoading(true);
    setReady(false);
    loadBootstrap()
      .then((bootstrap) => {
        if (!mounted) return;
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
  return { user, loading, refresh, logout, hasCache, ready };
}
