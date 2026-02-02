import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ThemePreference } from "./theme";
import { applyThemePreference, persistThemePreference, readThemePreference } from "./theme";

type ThemeContextValue = {
  preference: ThemePreference;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) return "dark";
    return readThemePreference() ?? "light";
  });

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

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      isDark: preference === "dark",
      setPreference: setPreferenceState,
    }),
    [preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

