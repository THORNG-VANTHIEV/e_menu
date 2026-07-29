/**
 * Read a JSON value without allowing malformed browser data to break the app.
 * The corrupt key is removed while unrelated local state is preserved.
 */
export function readJSON(key, fallback, validate = () => true) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (!validate(value)) throw new TypeError(`Invalid data stored at ${key}`);
    return value;
  } catch (error) {
    console.warn(`[storage] Resetting ${key}:`, error);
    try {
      localStorage.removeItem(key);
    } catch {
      // Storage can be unavailable in strict privacy modes.
    }
    return fallback;
  }
}

export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`[storage] Could not save ${key}:`, error);
    return false;
  }
}

export function readString(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeString(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // A clear action should remain non-fatal.
  }
}
