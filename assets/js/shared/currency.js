export function toCents(amount) {
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function roundTo(value, increment) {
  if (!Number.isFinite(increment) || increment <= 0) return Math.round(value);
  return Math.round(value / increment) * increment;
}

export function centsToKhr(cents, currencyConfig) {
  const rate = Number(currencyConfig?.usdToKhr) || 4100;
  const rounding = Number(currencyConfig?.khrRounding) || 100;
  return roundTo((cents * rate) / 100, rounding);
}

export function formatPrice(cents, business, mode = "dual", language = "en") {
  const safeCents = Math.max(0, Math.round(Number(cents) || 0));
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(safeCents / 100);
  const khrValue = centsToKhr(safeCents, business?.currency);
  const khr = `${new Intl.NumberFormat(language === "km" ? "km-KH" : "en-US").format(khrValue)} ៛`;

  if (mode === "USD") return {primary: usd, secondary: ""};
  if (mode === "KHR") return {primary: khr, secondary: ""};
  return {primary: usd, secondary: `≈ ${khr}`};
}

export function getItemStartingPriceCents(item) {
  const base = toCents(item?.basePrice?.amount);
  const availableVariants = (item?.variants || []).filter((variant) => variant.available);
  if (!availableVariants.length) return base;
  return base + Math.min(...availableVariants.map((variant) => toCents(variant.priceDelta)));
}
