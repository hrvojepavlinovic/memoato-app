import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "wasp/client/auth";
import { getProfile, setThemePreference, useQuery } from "wasp/client/operations";
import type { ThemePreference } from "./theme";
import { applyThemePreference, persistThemePreference, readThemePreference } from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useAuth();
  const profileQuery = useQuery(getProfile, undefined, { enabled: !!user, retry: false });
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return "dark";
    return readThemePreference() ?? "light";
  });

  useEffect(() => {
    if (!profileQuery.isSuccess || !profileQuery.data) return;
    if (!profileQuery.data.themePreference) return;
    const pref = profileQuery.data.themePreference === "dark" ? "dark" : "light";
    setPreferenceState(pref);
  }, [profileQuery.isSuccess, profileQuery.data?.themePreference]);

  useEffect(() => {
    applyThemePreference(preference);
    persistThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    const onStorage = () => {
      const next = readThemePreference();
      if (!next) return;
      setPreferenceState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPreference = useCallback<ThemeContextValue["setPreference"]>(
    (pref) => {
      setPreferenceState(pref);
      if (!user) return;
      setThemePreference({ preference: pref }).catch(() => {
        // Ignore; we already updated local UI.
      });
    },
    [user],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      isDark: preference === "dark",
      setPreference,
    }),
    [preference, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
