const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function hasLocalizedName(value) {
  return Boolean(value && typeof value === "object" && (value.km || value.en));
}

export function validateBusiness(value) {
  return Boolean(
    value
    && Number.isInteger(value.schemaVersion)
    && SLUG_PATTERN.test(value.id || "")
    && hasLocalizedName(value.name)
    && Array.isArray(value.openingHours)
  );
}

export function validateCategories(records) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  return records.filter((category) => {
    const valid = category
      && SLUG_PATTERN.test(category.id || "")
      && !seen.has(category.id)
      && hasLocalizedName(category.name)
      && Number.isFinite(Number(category.sortOrder))
      && category.active !== false;
    if (!valid) {
      console.warn("[data] Skipping invalid category:", category?.id ?? category);
      return false;
    }
    seen.add(category.id);
    return true;
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

function validVariantSet(variants) {
  if (!Array.isArray(variants)) return false;
  if (!variants.length) return true;
  const available = variants.filter((variant) => variant?.available);
  const defaultCount = available.filter((variant) => variant.default).length;
  return defaultCount === 1 && variants.every((variant) => (
    SLUG_PATTERN.test(variant.id || "")
    && hasLocalizedName(variant.name)
    && Number(variant.priceDelta) >= 0
  ));
}

function validAddOns(addOns) {
  return Array.isArray(addOns) && addOns.every((addOn) => (
    SLUG_PATTERN.test(addOn?.id || "")
    && hasLocalizedName(addOn.name)
    && Number(addOn.price) >= 0
  ));
}

export function validateMenuItems(records, categoryIds, allowFallbackCategory = false) {
  if (!Array.isArray(records)) return [];
  const seen = new Set();
  return records.filter((item) => {
    const spicyLevel = Number(item?.spicyLevel);
    const valid = item
      && SLUG_PATTERN.test(item.id || "")
      && !seen.has(item.id)
      && (allowFallbackCategory || categoryIds.has(item.categoryId))
      && hasLocalizedName(item.name)
      && Number(item.basePrice?.amount) >= 0
      && Number.isInteger(spicyLevel)
      && spicyLevel >= 0
      && spicyLevel <= 3
      && validVariantSet(item.variants)
      && validAddOns(item.addOns)
      && Number.isFinite(Number(item.sortOrder));
    if (!valid) {
      console.warn("[data] Skipping invalid menu item:", item?.id ?? item);
      return false;
    }
    seen.add(item.id);
    return true;
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function validatePromotions(records) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((promotion) => promotion && SLUG_PATTERN.test(promotion.id || "") && promotion.active !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}

export function validateTranslations(value) {
  return Boolean(value && typeof value.km === "object" && typeof value.en === "object");
}
