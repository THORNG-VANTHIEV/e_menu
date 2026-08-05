import {STORAGE_KEYS} from "../../config.js";
import {toCents} from "../../shared/currency.js";
import {readJSON, writeJSON} from "../../shared/storage.js";

export const CART_SCHEMA_VERSION = 1;

export function emptyCart() {
  return {schemaVersion: CART_SCHEMA_VERSION, rows: [], table: "", note: ""};
}

function validStoredCart(value) {
  return Boolean(
    value
    && value.schemaVersion === CART_SCHEMA_VERSION
    && Array.isArray(value.rows)
    && typeof value.table === "string"
    && typeof value.note === "string"
  );
}

export function unitPriceCents(item, variantId = "", addOnIds = []) {
  const variant = (item.variants || []).find((entry) => entry.id === variantId && entry.available);
  const selectedAddOns = (item.addOns || []).filter((entry) => addOnIds.includes(entry.id) && entry.available);
  return toCents(item.basePrice.amount)
    + toCents(variant?.priceDelta || 0)
    + selectedAddOns.reduce((sum, addOn) => sum + toCents(addOn.price), 0);
}

function rowKey(itemId, variantId, addOnIds, note) {
  return [itemId, variantId || "", [...addOnIds].sort().join(","), note.trim()].join("|");
}

export function addCartRow(cart, item, selection, maximum = 20) {
  const variantId = selection.variantId || "";
  const addOnIds = [...new Set(selection.addOnIds || [])].sort();
  const note = String(selection.note || "").trim().slice(0, 240);
  const quantity = Math.max(1, Math.min(maximum, Math.floor(Number(selection.quantity) || 1)));
  const key = rowKey(item.id, variantId, addOnIds, note);
  const existingIndex = cart.rows.findIndex((row) => row.key === key);
  const rows = cart.rows.map((row) => ({...row}));
  const price = unitPriceCents(item, variantId, addOnIds);

  if (existingIndex >= 0) {
    rows[existingIndex].quantity = Math.min(maximum, rows[existingIndex].quantity + quantity);
    rows[existingIndex].unitPriceCents = price;
  } else {
    rows.push({
      key,
      itemId: item.id,
      variantId,
      addOnIds,
      note,
      quantity,
      unitPriceCents: price
    });
  }
  return {...cart, rows};
}

export function changeCartQuantity(cart, key, delta, maximum = 20) {
  return {
    ...cart,
    rows: cart.rows.map((row) => row.key === key
      ? {...row, quantity: Math.max(1, Math.min(maximum, row.quantity + delta))}
      : row)
  };
}

export function removeCartRow(cart, key) {
  return {...cart, rows: cart.rows.filter((row) => row.key !== key)};
}

export function updateCartDetails(cart, details) {
  return {
    ...cart,
    table: String(details.table ?? cart.table).slice(0, 60),
    note: String(details.note ?? cart.note).slice(0, 500)
  };
}

export function getCartCount(cart) {
  return cart.rows.reduce((total, row) => total + row.quantity, 0);
}

export function createCartSignature(cart) {
  return JSON.stringify({
    schemaVersion: cart.schemaVersion,
    rows: cart.rows.map((row) => ({
      key: row.key,
      quantity: row.quantity,
      unitPriceCents: row.unitPriceCents
    })),
    table: cart.table,
    note: cart.note
  });
}

export function getCartTotals(cart, business) {
  const subtotalCents = cart.rows.reduce(
    (total, row) => total + row.unitPriceCents * row.quantity,
    0
  );
  const threshold = toCents(business?.order?.discountMinimumUsd || 0);
  const percent = Number(business?.order?.discountPercent) || 0;
  const discountCents = subtotalCents >= threshold
    ? Math.round((subtotalCents * percent) / 100)
    : 0;
  return {
    subtotalCents,
    discountCents,
    totalCents: Math.max(0, subtotalCents - discountCents)
  };
}

export function saveCart(cart) {
  writeJSON(STORAGE_KEYS.cart, cart);
  return cart;
}

export function loadCart(items, maximum = 20) {
  const stored = readJSON(STORAGE_KEYS.cart, emptyCart(), validStoredCart);
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const rows = stored.rows.flatMap((row) => {
    const item = itemMap.get(row.itemId);
    if (!item || !item.flags?.available) return [];
    const variant = row.variantId
      ? (item.variants || []).find((entry) => entry.id === row.variantId && entry.available)
      : null;
    if (row.variantId && !variant) return [];
    const addOnIds = Array.isArray(row.addOnIds)
      ? row.addOnIds.filter((id) => item.addOns?.some((entry) => entry.id === id && entry.available))
      : [];
    const note = typeof row.note === "string" ? row.note.slice(0, 240) : "";
    const key = rowKey(item.id, row.variantId || "", addOnIds, note);
    return [{
      key,
      itemId: item.id,
      variantId: row.variantId || "",
      addOnIds,
      note,
      quantity: Math.max(1, Math.min(maximum, Math.floor(Number(row.quantity) || 1))),
      unitPriceCents: unitPriceCents(item, row.variantId || "", addOnIds)
    }];
  });
  const cleaned = {...stored, schemaVersion: CART_SCHEMA_VERSION, rows};
  saveCart(cleaned);
  return cleaned;
}

export function createOrderReference(now = new Date()) {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("");
  const time = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0")
  ].join("");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ML-${date}-${time}-${suffix}`;
}
