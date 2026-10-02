import { startLogin } from "@/const";
import { useCallback, useEffect, useState } from "react";

type HEMIPUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
};

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [user, setUser] = useState<HEMIPUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<HEMIPUser | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/session", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (response.status === 401) {
        setUser(null);
        return null;
      }
      if (!response.ok) throw new Error("Impossible de vérifier la session HEMIP.");
      const payload = (await response.json()) as { user?: HEMIPUser | null };
      setUser(payload.user ?? null);
      return payload.user ?? null;
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("Service de session indisponible.");
      setError(nextError);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || user) return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) window.location.assign(redirectPath);
    else startLogin();
  }, [loading, redirectOnUnauthenticated, redirectPath, user]);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const csrfResponse = await fetch("/auth/csrf", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!csrfResponse.ok) throw new Error("Impossible de préparer la déconnexion.");
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
      const response = await fetch("/auth/signout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfToken, callbackUrl: "/" }).toString(),
      });
      if (!response.ok) throw new Error("La déconnexion HEMIP a échoué.");
      setUser(null);
    } catch (cause) {
      const nextError = cause instanceof Error ? cause : new Error("La déconnexion HEMIP a échoué.");
      setError(nextError);
      throw nextError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, loading, error, isAuthenticated: Boolean(user), refresh, logout };
}
