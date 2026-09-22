import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getStoredTokens, clearStoredTokens } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      setUser(null);
      clearStoredTokens();
    }
  }, []);

  useEffect(() => {
    // Only bother calling /me if there's some chance of a session — a
    // stored token or a same-origin cookie we can't inspect directly —
    // avoids a guaranteed-401 network call on every fresh page load.
    const tokens = getStoredTokens();
    if (!tokens?.accessToken) {
      setLoading(false);
      return;
    }
    refreshMe().finally(() => setLoading(false));
  }, [refreshMe]);

  const login = useCallback(async (email, password) => {
    const { user } = await api.login({ email, password });
    setUser(user);
    return user;
  }, []);

  const signup = useCallback(async (body) => {
    const { user } = await api.signup(body);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => {});
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (body) => {
    const { user } = await api.updateProfile(body);
    setUser(user);
    return user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateProfile, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
