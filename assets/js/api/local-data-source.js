import {DATA_PATHS} from "../config.js";
import {
  validateBusiness,
  validateCategories,
  validateMenuItems,
  validatePromotions,
  validateTranslations
} from "../shared/validators.js";

async function fetchJSON(path) {
  const response = await fetch(path, {headers: {"Accept": "application/json"}});
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  return response.json();
}

export async function loadLocalData() {
  const entries = await Promise.allSettled(
    Object.entries(DATA_PATHS).map(async ([key, path]) => [key, await fetchJSON(path)])
  );
  const loaded = {};
  const errors = {};

  entries.forEach((result, index) => {
    const key = Object.keys(DATA_PATHS)[index];
    if (result.status === "fulfilled") {
      loaded[result.value[0]] = result.value[1];
    } else {
      errors[key] = result.reason;
      console.error(`[data] Could not load ${key}:`, result.reason);
    }
  });

  if (!validateBusiness(loaded.business)) {
    throw new Error("Business information is missing or invalid.");
  }
  if (!validateTranslations(loaded.translations)) {
    throw new Error("Interface translations are missing or invalid.");
  }
  if (!Array.isArray(loaded.menuItems)) {
    throw new Error("Menu data is missing or invalid.");
  }

  let categories = validateCategories(loaded.categories);
  const categoryFileFailed = categories.length === 0;
  if (categoryFileFailed) {
    categories = [{
      id: "fallback-menu",
      slug: "menu",
      name: {km: "មីនុយ", en: "Menu"},
      icon: "bi-grid",
      sortOrder: 0,
      active: true
    }];
  }

  const categoryIds = new Set(categories.map((category) => category.id));
  let menuItems = validateMenuItems(loaded.menuItems, categoryIds, categoryFileFailed);
  if (categoryFileFailed) {
    menuItems = menuItems.map((item) => ({...item, categoryId: "fallback-menu"}));
  }

  return {
    business: loaded.business,
    categories,
    menuItems,
    promotions: validatePromotions(loaded.promotions),
    translations: loaded.translations,
    warnings: errors
  };
}
