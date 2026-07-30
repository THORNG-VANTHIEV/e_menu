import {DEFAULT_FILTERS} from "../config.js";

export function createStore(initialState = {}) {
  let state = {
    business: null,
    categories: [],
    menuItems: [],
    promotions: [],
    filters: {...DEFAULT_FILTERS},
    settings: {language: "km", currency: "dual", theme: "dark"},
    favorites: [],
    cart: {schemaVersion: 1, rows: [], table: "", note: ""},
    network: {online: navigator.onLine},
    visibleCount: 24,
    ...initialState
  };
  const listeners = new Set();

  return {
    getState: () => state,
    setState(update, reason = "update") {
      const next = typeof update === "function" ? update(state) : {...state, ...update};
      if (next === state) return state;
      state = next;
      listeners.forEach((listener) => listener(state, reason));
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}
