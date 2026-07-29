import {existsSync, readFileSync} from "node:fs";
import {resolve} from "node:path";
import {
  validateBusiness,
  validateCategories,
  validateMenuItems,
  validatePromotions,
  validateTranslations
} from "../assets/js/shared/validators.js";

const root = resolve(import.meta.dirname, "..");
const readJSON = (path) => JSON.parse(readFileSync(resolve(root, path), "utf8"));

const business = readJSON("data/business.json");
const categories = validateCategories(readJSON("data/categories.json"));
const categoryIds = new Set(categories.map((category) => category.id));
const menuItems = validateMenuItems(readJSON("data/menu-items.json"), categoryIds);
const promotions = validatePromotions(readJSON("data/promotions.json"));
const translations = readJSON("data/translations.json");
const manifest = readJSON("manifest.webmanifest");

const errors = [];
if (!validateBusiness(business)) errors.push("business.json does not satisfy the application contract");
if (!categories.length) errors.push("No valid active categories were found");
if (!menuItems.length) errors.push("No valid menu items were found");
if (!validateTranslations(translations)) errors.push("translations.json needs km and en dictionaries");
if (!manifest.icons?.some((icon) => icon.sizes === "192x192")) errors.push("Manifest is missing a 192x192 icon");
if (!manifest.icons?.some((icon) => icon.sizes === "512x512")) errors.push("Manifest is missing a 512x512 icon");

const ids = new Set();
for (const item of menuItems) {
  if (ids.has(item.id)) errors.push(`Duplicate menu item ID: ${item.id}`);
  ids.add(item.id);
  for (const path of [item.image]) {
    if (!existsSync(resolve(root, path.replace(/^\.\//, "")))) errors.push(`Missing asset: ${path}`);
  }
}

for (const path of [business.logo, business.cover, ...manifest.icons.map((icon) => icon.src)]) {
  if (!existsSync(resolve(root, path.replace(/^\.\//, "")))) errors.push(`Missing asset: ${path}`);
}

const precacheSource = readFileSync(resolve(root, "precache-manifest.js"), "utf8");
const precachePaths = [...precacheSource.matchAll(/"(\.\/[^"]+)"/g)].map((match) => match[1]);
for (const path of precachePaths) {
  if (path === "./") continue;
  if (!existsSync(resolve(root, path.replace(/^\.\//, "")))) errors.push(`Precache file does not exist: ${path}`);
}

if (errors.length) {
  errors.forEach((error) => console.error(`✗ ${error}`));
  process.exitCode = 1;
} else {
  console.log(`✓ Validated 1 business, ${categories.length} categories, ${menuItems.length} items and ${promotions.length} promotion(s)`);
  console.log(`✓ Checked ${precachePaths.length} precached resources and PWA icon sizes`);
}
