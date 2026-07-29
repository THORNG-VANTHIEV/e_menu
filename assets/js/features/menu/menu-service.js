import {getItemStartingPriceCents} from "../../shared/currency.js";

export function normalizeSearch(value) {
  return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function searchableText(item) {
  return normalizeSearch([
    item.name?.km,
    item.name?.en,
    item.description?.km,
    item.description?.en,
    ...(item.keywords || [])
  ].filter(Boolean).join(" "));
}

export function getActiveFilterCount(filters) {
  return Number(filters.availableOnly)
    + Number(filters.recommendedOnly)
    + (filters.dietary?.length || 0)
    + (filters.spicyLevels?.length || 0)
    + Number(filters.favoritesOnly);
}

export function filterAndSortMenu(items, filters, favorites = [], language = "en") {
  const query = normalizeSearch(filters.query);
  const favoriteSet = new Set(favorites);

  const filtered = items.filter((item) => {
    if (query && !searchableText(item).includes(query)) return false;
    if (filters.categoryId !== "all" && item.categoryId !== filters.categoryId) return false;
    if (filters.availableOnly && !item.flags?.available) return false;
    if (filters.recommendedOnly && !item.flags?.recommended) return false;
    if (filters.favoritesOnly && !favoriteSet.has(item.id)) return false;
    if (filters.dietary?.some((key) => !item.flags?.[key])) return false;
    if (filters.spicyLevels?.length && !filters.spicyLevels.includes(Number(item.spicyLevel))) return false;
    return true;
  });

  return filtered.sort((left, right) => {
    if (filters.sort === "price-asc") {
      return getItemStartingPriceCents(left) - getItemStartingPriceCents(right);
    }
    if (filters.sort === "price-desc") {
      return getItemStartingPriceCents(right) - getItemStartingPriceCents(left);
    }
    if (filters.sort === "name") {
      const leftName = left.name?.[language] || left.name?.en || left.name?.km || "";
      const rightName = right.name?.[language] || right.name?.en || right.name?.km || "";
      return leftName.localeCompare(rightName, language === "km" ? "km" : "en");
    }
    return Number(left.sortOrder) - Number(right.sortOrder);
  });
}
