export type ThemePreference = "light" | "dark";

const STORAGE_KEY = "memoato:theme";
const COOKIE_KEY = "memoato_theme";

function readCookie(name: string): string | null {
  try {
    const m = new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}=([^;]*)`).exec(
      document.cookie ?? "",
    );
    return m ? decodeURIComponent(m[1] ?? "") : null;
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string): void {
  const maxAge = 60 * 60 * 24 * 365; // 1 year
  const base = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  try {
    if (typeof window !== "undefined" && window.location.hostname.endsWith("memoato.com")) {
      document.cookie = `${base}; Domain=.memoato.com`;
      return;
    }
  } catch {
    // ignore
  }
  try {
    document.cookie = base;
  } catch {
    // ignore
  }
}

export function readThemePreference(): ThemePreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)?.trim();
    if (raw === "dark" || raw === "light") return raw;
  } catch {
    // ignore
  }
  const cookie = readCookie(COOKIE_KEY);
  if (cookie === "dark" || cookie === "light") return cookie;
  return null;
}

export function persistThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  writeCookie(COOKIE_KEY, pref);
}

export function applyThemePreference(pref: ThemePreference): void {
  const isDark = pref === "dark";
  const el = document.documentElement;
  el.classList.toggle("dark", isDark);
  (el as any).style.colorScheme = isDark ? "dark" : "light";
  const meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (meta) meta.setAttribute("content", isDark ? "#0A0A0A" : "#ffffff");
  window.dispatchEvent(new Event("memoato:theme"));
}

