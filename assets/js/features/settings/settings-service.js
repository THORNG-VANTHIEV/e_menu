import {STORAGE_KEYS} from "../../config.js";
import {readString, writeString} from "../../shared/storage.js";

export function loadSettings(business) {
  return {
    language: readString(STORAGE_KEYS.language, ["km", "en"], "km"),
    theme: readString(STORAGE_KEYS.theme, ["light", "dark", "system"], "system"),
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

export function applyTheme(preference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    resolved === "dark" ? "#101713" : "#174c3c"
  );
  return resolved;
}

export function persistSetting(name, value) {
  const key = STORAGE_KEYS[name];
  if (key) writeString(key, value);
}
