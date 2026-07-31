export const APP_VERSION = "1.0.17";

export const DATA_PATHS = Object.freeze({
  business: "./data/business.json",
  categories: "./data/categories.json",
  menuItems: "./data/menu-items.json",
  promotions: "./data/promotions.json",
  translations: "./data/translations.json"
});

export const STORAGE_KEYS = Object.freeze({
  language: "emenu:v1:language",
  theme: "emenu:v1:theme",
  currency: "emenu:v1:currency",
  favorites: "emenu:v1:favorites",
  cart: "emenu:v1:cart",
  table: "emenu:v1:table"
});

export const DEFAULT_FILTERS = Object.freeze({
  query: "",
  categoryId: "all",
  availableOnly: false,
  recommendedOnly: false,
  dietary: [],
  spicyLevels: [],
  sort: "default",
  favoritesOnly: false
});

export const PAGE_SIZE = 24;
export const SEARCH_DEBOUNCE_MS = 200;
export const IMAGE_PLACEHOLDER = "./assets/images/placeholders/menu-placeholder.svg";
