import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {
  validateBusiness,
  validateCategories,
  validateMenuItems,
  validateTranslations
} from "../assets/js/shared/validators.js";

const readJSON = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), "utf8"));

test("sample business, categories, menu and translations satisfy contracts", async () => {
  const business = await readJSON("business.json");
  const categories = validateCategories(await readJSON("categories.json"));
  const menu = validateMenuItems(
    await readJSON("menu-items.json"),
    new Set(categories.map((category) => category.id))
  );
  const translations = await readJSON("translations.json");
  assert.equal(validateBusiness(business), true);
  assert.equal(typeof business.contact?.mapUrl, "string");
  assert.equal(typeof business.contact?.mapUrl2, "string");
  assert.equal(categories.length, 4);
  assert.equal(menu.length, 57);
  assert.equal(validateTranslations(translations), true);
  assert.equal(typeof translations.km.location1, "string");
  assert.equal(typeof translations.km.location2, "string");
  assert.equal(typeof translations.en.location1, "string");
  assert.equal(typeof translations.en.location2, "string");
});

test("invalid records are skipped without discarding valid records", () => {
  const categories = validateCategories([
    {id: "rice", name: {en: "Rice"}, sortOrder: 1, active: true},
    {id: "Bad ID", name: {en: "Bad"}, sortOrder: 2, active: true}
  ]);
  assert.deepEqual(categories.map(({id}) => id), ["rice"]);
});
