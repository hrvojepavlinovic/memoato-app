export type NextUpPreference = "show" | "hide";

const storageKey = "memoato:nextUp";

export function readNextUpPreference(): NextUpPreference {
  try {
    const v = window.localStorage.getItem(storageKey);
    if (v === "hide" || v === "show") return v;
  } catch {
    // Ignore.
  }
  return "show";
}

export function persistNextUpPreference(pref: NextUpPreference): void {
  try {
    window.localStorage.setItem(storageKey, pref);
  } catch {
    // Ignore.
  }
}

