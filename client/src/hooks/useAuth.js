import { useCallback, useEffect, useState } from "react";
import { getJson, postJson } from "../api";

export default function useAuth(enabled = true) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return getJson("/auth/me")
      .then((data) => {
        setUser(data);
        return data;
      })
      .catch(() => {
        setUser(null);
        return null;
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = useCallback(() => {
    return postJson("/auth/logout")
      .catch(() => null)
      .finally(() => {
        setUser(null);
      });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setUser(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, enabled]);

  return { user, loading, refresh, logout };
}
