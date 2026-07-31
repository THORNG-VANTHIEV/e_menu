import {STORAGE_KEYS} from "../../config.js";
import {readString, writeString} from "../../shared/storage.js";

export const DEFAULT_THEME = "light";

export function loadSettings(business) {
  return {
    language: readString(STORAGE_KEYS.language, ["km", "en"], "km"),
    theme: readString(STORAGE_KEYS.theme, ["light", "dark", "system"], DEFAULT_THEME),
    currency: readString(
      STORAGE_KEYS.currency,
      ["USD", "KHR", "dual"],
      business?.currency?.displayMode || business?.currency?.default || "dual"
    )
  };
}

export function resolveTheme(preference) {
  if (preference !== "system") return preference;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Return the explicit opposite of the theme currently visible to the user.
 * The header icon is a two-state shortcut; "system" remains available in Settings.
 */
export function getThemeToggleTarget(resolvedTheme) {
  return resolvedTheme === "dark" ? "light" : "dark";
}

export function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    resolved === "dark" ? "#160f0c" : "#4d2a1d"
  );
  return resolved;
}

export function persistSetting(name, value) {
  const key = STORAGE_KEYS[name];
  if (key) writeString(key, value);
}
