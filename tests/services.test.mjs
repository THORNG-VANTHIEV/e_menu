import test from "node:test";
import assert from "node:assert/strict";
import {filterAndSortMenu, normalizeSearch} from "../assets/js/features/menu/menu-service.js";
import {
  addCartRow,
  changeCartQuantity,
  emptyCart,
  getCartTotals,
  unitPriceCents
} from "../assets/js/features/cart/cart-service.js";
import {centsToKhr, formatPrice, roundTo, toCents} from "../assets/js/shared/currency.js";
import {DEFAULT_THEME, getThemeToggleTarget} from "../assets/js/features/settings/settings-service.js";
import {HERO_SLIDE_INTERVAL_MS} from "../assets/js/features/hero/hero-slider.js";

const item = {
  id: "beef-lok-lak",
  name: {km: "ឡុកឡាក់សាច់គោ", en: "Beef Lok Lak"},
  description: {km: "បាយសាច់គោ", en: "Beef with rice"},
  keywords: ["pepper"],
  categoryId: "rice",
  basePrice: {amount: 4.5},
  variants: [
    {id: "regular", priceDelta: 0, available: true},
    {id: "large", priceDelta: 1.25, available: true}
  ],
  addOns: [
    {id: "egg", price: 0.75, available: true},
    {id: "sold", price: 9, available: false}
  ],
  flags: {available: true, recommended: true, vegetarian: false, halal: true},
  spicyLevel: 1,
  sortOrder: 10
};

const business = {
  currency: {usdToKhr: 4100, khrRounding: 100},
  order: {discountPercent: 5, discountMinimumUsd: 10}
};

test("normalizes search and finds either language", () => {
  assert.equal(normalizeSearch("  BEEF   Lok  "), "beef lok");
  const filters = {
    query: "សាច់គោ",
    categoryId: "all",
    availableOnly: false,
    recommendedOnly: false,
    dietary: [],
    spicyLevels: [],
    sort: "default",
    favoritesOnly: false
  };
  assert.deepEqual(filterAndSortMenu([item], filters, [], "km").map(({id}) => id), [item.id]);
});

test("combines category, dietary, spice and availability filters", () => {
  const filters = {
    query: "",
    categoryId: "rice",
    availableOnly: true,
    recommendedOnly: true,
    dietary: ["halal"],
    spicyLevels: [1],
    sort: "default",
    favoritesOnly: false
  };
  assert.equal(filterAndSortMenu([item], filters).length, 1);
  assert.equal(filterAndSortMenu([item], {...filters, dietary: ["vegetarian"]}).length, 0);
});

test("uses integer cents and configured KHR rounding", () => {
  assert.equal(toCents(3.5), 350);
  assert.equal(roundTo(14357, 100), 14400);
  assert.equal(centsToKhr(350, business.currency), 14400);
  assert.match(formatPrice(350, business, "dual", "en").secondary, /14,400/);
});

test("cart price includes only selected available options", () => {
  assert.equal(unitPriceCents(item, "large", ["egg", "sold"]), 650);
});

test("identical cart selections merge but different notes stay separate", () => {
  let cart = emptyCart();
  cart = addCartRow(cart, item, {variantId: "regular", addOnIds: ["egg"], note: "No onion", quantity: 1});
  cart = addCartRow(cart, item, {variantId: "regular", addOnIds: ["egg"], note: "No onion", quantity: 2});
  assert.equal(cart.rows.length, 1);
  assert.equal(cart.rows[0].quantity, 3);
  cart = addCartRow(cart, item, {variantId: "regular", addOnIds: ["egg"], note: "No garlic", quantity: 1});
  assert.equal(cart.rows.length, 2);
});

test("quantity is clamped and discounts use integer cents", () => {
  let cart = addCartRow(emptyCart(), item, {variantId: "large", addOnIds: ["egg"], note: "", quantity: 2}, 20);
  cart = changeCartQuantity(cart, cart.rows[0].key, 50, 20);
  assert.equal(cart.rows[0].quantity, 20);
  const totals = getCartTotals(cart, business);
  assert.equal(totals.subtotalCents, 13000);
  assert.equal(totals.discountCents, 650);
  assert.equal(totals.totalCents, 12350);
});

test("header theme shortcut changes dark to light and light to dark in one action", () => {
  assert.equal(getThemeToggleTarget("dark"), "light");
  assert.equal(getThemeToggleTarget("light"), "dark");
});

test("light is the first-visit default theme", () => {
  assert.equal(DEFAULT_THEME, "light");
});

test("hero slideshow advances every five seconds", () => {
  assert.equal(HERO_SLIDE_INTERVAL_MS, 5_000);
});
