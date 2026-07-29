import {STORAGE_KEYS} from "../../config.js";
import {readJSON, writeJSON} from "../../shared/storage.js";

const validFavoriteList = (value) => Array.isArray(value) && value.every((id) => typeof id === "string");

export function loadFavorites(validItemIds) {
  const stored = readJSON(STORAGE_KEYS.favorites, [], validFavoriteList);
  const allowed = new Set(validItemIds);
  const cleaned = [...new Set(stored.filter((id) => allowed.has(id)))];
  if (cleaned.length !== stored.length) writeJSON(STORAGE_KEYS.favorites, cleaned);
  return cleaned;
}

export function toggleFavorite(favorites, itemId) {
  const next = favorites.includes(itemId)
    ? favorites.filter((id) => id !== itemId)
    : [...favorites, itemId];
  writeJSON(STORAGE_KEYS.favorites, next);
  return next;
}

export function clearFavorites() {
  writeJSON(STORAGE_KEYS.favorites, []);
  return [];
}
