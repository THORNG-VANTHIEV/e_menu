import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";

const debugPort = process.env.CHROME_DEBUG_PORT || "9222";
const appUrl = process.env.APP_URL || "http://127.0.0.1:4173/";
const targets = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
const target = targets.find((entry) => entry.type === "page");
if (!target) throw new Error("No Chrome page target is available");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, {once: true});
  socket.addEventListener("error", reject, {once: true});
});

let messageId = 0;
const pending = new Map();
const listeners = new Map();
const runtimeErrors = [];
const consoleErrors = [];

socket.addEventListener("message", ({data}) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const {resolve, reject} = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    runtimeErrors.push(message.params.exceptionDetails?.text || "Runtime exception");
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    consoleErrors.push(message.params.entry.text);
  }
  const callbacks = listeners.get(message.method);
  callbacks?.forEach((callback) => callback(message.params));
});

function send(method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({id, method, params}));
  return new Promise((resolve, reject) => pending.set(id, {resolve, reject}));
}

function once(method, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const callbacks = listeners.get(method) || new Set();
    const timer = setTimeout(() => {
      callbacks.delete(handler);
      reject(new Error(`Timed out waiting for ${method}`));
    }, timeout);
    const handler = (params) => {
      clearTimeout(timer);
      callbacks.delete(handler);
      resolve(params);
    };
    callbacks.add(handler);
    listeners.set(method, callbacks);
  });
}

async function evaluate(expression, awaitPromise = false) {
  const response = await send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
    userGesture: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result.value;
}

async function delay(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function navigate(url) {
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", {url});
  await loaded;
  await delay(1200);
}

async function captureScreenshot(path) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(path, Buffer.from(result.data, "base64"));
}

await Promise.all([
  send("Page.enable"),
  send("Runtime.enable"),
  send("Log.enable"),
  send("Network.enable")
]);
await send("Storage.clearDataForOrigin", {
  origin: new URL(appUrl).origin,
  storageTypes: "all"
});
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true
});
await send("Emulation.setEmulatedMedia", {
  features: [{name: "prefers-color-scheme", value: "dark"}]
});
await navigate(appUrl);
await evaluate(`Promise.all([
  navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
  caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
]).then(() => {
  localStorage.clear();
  sessionStorage.clear();
  return true;
})`, true);
await navigate("about:blank");
runtimeErrors.length = 0;
consoleErrors.length = 0;
await navigate(appUrl);

const initial = await evaluate(`({
  cards: document.querySelectorAll(".menu-card").length,
  lang: document.documentElement.lang,
  errorHidden: document.querySelector("#error-state").hidden,
  loadingHidden: document.querySelector("#menu-loading").hidden,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  qrReady: Boolean(document.querySelector("#menu-qr-code canvas, #menu-qr-code img")),
  theme: document.documentElement.dataset.theme,
  themePreference: document.querySelector('input[name="theme"]:checked')?.value
})`);
assert.equal(initial.cards, 8, "all sample dishes should render");
assert.equal(initial.lang, "km", "Khmer should be the first-visit language");
assert.equal(initial.errorHidden, true, "the data error state should stay hidden");
assert.equal(initial.loadingHidden, true, "the loading state should complete");
assert.ok(initial.overflow <= 0, `390px layout overflowed by ${initial.overflow}px`);
assert.equal(initial.qrReady, true, "the deployment-aware menu QR code should render");
assert.equal(initial.theme, "dark", "dark should be rendered on the first visit");
assert.equal(initial.themePreference, "dark", "Settings should select dark on the first visit");
if (process.env.CAPTURE_SCREENSHOTS === "1") {
  await captureScreenshot("/private/tmp/e-menu-cdp-390.png");
}

await evaluate(`document.querySelector("#theme-button").click()`);
await delay(100);
const firstTheme = await evaluate(`({
  rendered: document.documentElement.dataset.theme,
  stored: localStorage.getItem("emenu:v1:theme")
})`);
assert.equal(firstTheme.rendered, "light", "one click from rendered dark mode should switch to light");
assert.equal(firstTheme.stored, "light", "the explicit light preference should be stored");
await evaluate(`document.querySelector("#theme-button").click()`);
await delay(100);
assert.equal(
  await evaluate(`document.documentElement.dataset.theme`),
  "dark",
  "one click from light mode should switch back to dark"
);

await evaluate(`document.querySelector("[data-favorite]").click()`);
await delay(100);
await evaluate(`document.querySelector("[data-show-favorites]").click()`);
await delay(100);
assert.equal(
  await evaluate(`document.querySelectorAll(".menu-card").length`),
  1,
  "Favorites view should show the saved dish"
);
assert.equal(
  await evaluate(`document.querySelector("#clear-filters-button").dataset.i18n`),
  "clearFavorites",
  "the Favorites action should be labelled as clearing favorites"
);
await evaluate(`document.querySelector("#clear-filters-button").click()`);
await delay(50);
assert.equal(
  await evaluate(`document.querySelector("#confirm-dialog").open`),
  true,
  "clearing Favorites should ask for confirmation"
);
await evaluate(`document.querySelector("#confirm-action-button").click()`);
await delay(100);
const clearedFavorites = await evaluate(`({
  cards: document.querySelectorAll(".menu-card").length,
  emptyVisible: !document.querySelector("#empty-state").hidden,
  favoritesViewActive: !document.querySelector("#active-filters").hidden,
  clearActionHidden: document.querySelector("#clear-filters-button").hidden,
  stored: JSON.parse(localStorage.getItem("emenu:v1:favorites") || "[]")
})`);
assert.equal(clearedFavorites.cards, 0, "clearing Favorites should remove every saved dish");
assert.equal(clearedFavorites.emptyVisible, true, "the empty Favorites state should remain visible");
assert.equal(clearedFavorites.favoritesViewActive, true, "clearing Favorites should not leave the Favorites view");
assert.equal(clearedFavorites.clearActionHidden, true, "the clear action should hide after Favorites is empty");
assert.deepEqual(clearedFavorites.stored, [], "cleared Favorites should be persisted");
await evaluate(`document.querySelector('.mobile-nav [data-show-menu]').click()`);
await delay(100);
assert.equal(
  await evaluate(`document.querySelectorAll(".menu-card").length`),
  8,
  "Menu navigation should exit Favorites mode and restore all dishes"
);

await evaluate(`document.querySelector("[data-open-item]").click()`);
await delay(100);
assert.equal(await evaluate(`document.querySelector("#detail-dialog").open`), true, "item detail should open");
assert.ok(await evaluate(`document.querySelector("#detail-total").textContent.length`) > 0, "detail total should render");
await evaluate(`document.querySelector("#detail-dialog [data-close-dialog]").click()`);

await evaluate(`document.querySelector('[data-quick-add="fish-amok"]').click()`);
await delay(100);
assert.equal(await evaluate(`document.querySelector("[data-cart-count]").textContent`), "1", "quick add should update the cart");
await evaluate(`document.querySelector("[data-open-cart]").click()`);
await delay(100);
assert.equal(await evaluate(`document.querySelectorAll(".cart-row").length`), 1, "cart dialog should render its row");
await evaluate(`document.querySelector("#cart-dialog [data-close-dialog]").click()`);

await evaluate(`document.querySelector("#language-button").click()`);
await delay(150);
assert.equal(await evaluate(`document.documentElement.lang`), "en", "language should change without reloading");

await evaluate(`(() => {
  const input = document.querySelector("#search-input");
  input.value = "កាហ្វេ";
  input.dispatchEvent(new Event("input", {bubbles: true}));
})()`);
await delay(350);
assert.equal(await evaluate(`document.querySelectorAll(".menu-card").length`), 1, "Khmer search should work while UI is English");
await evaluate(`document.querySelector("#clear-search-button").click()`);
await delay(100);

const widths = [320, 360, 576, 768, 1024, 1440];
const responsive = [];
for (const width of widths) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 768 ? 844 : 900,
    deviceScaleFactor: 1,
    mobile: width < 768
  });
  await delay(80);
  responsive.push(await evaluate(`({
    width: window.innerWidth,
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    mobileNav: getComputedStyle(document.querySelector(".mobile-nav")).display,
    desktopNav: getComputedStyle(document.querySelector(".desktop-nav")).display
  })`));
}
responsive.forEach((result) => {
  assert.ok(result.overflow <= 0, `${result.width}px layout overflowed by ${result.overflow}px`);
  if (result.width < 768) assert.notEqual(result.mobileNav, "none", "mobile nav should be visible below 768px");
  if (result.width >= 768) assert.equal(result.mobileNav, "none", "mobile nav should hide at desktop width");
});
if (process.env.CAPTURE_SCREENSHOTS === "1") {
  await evaluate(`document.querySelector("#menu").scrollIntoView()`);
  await delay(200);
  await captureScreenshot("/private/tmp/e-menu-cdp-1440-menu.png");
}

await evaluate(`navigator.serviceWorker.ready.then(() => true)`, true);
await delay(300);
const pwa = await evaluate(`navigator.serviceWorker.getRegistration().then((registration) => ({
  active: Boolean(registration?.active),
  cacheCount: caches.keys().then((keys) => keys.filter((key) => key.startsWith("emenu-")).length)
})).then(async (value) => ({...value, cacheCount: await value.cacheCount}))`, true);
assert.equal(pwa.active, true, "service worker should activate");
assert.ok(pwa.cacheCount >= 1, "PWA caches should exist");

await send("Network.emulateNetworkConditions", {
  offline: true,
  latency: 0,
  downloadThroughput: 0,
  uploadThroughput: 0
});
await navigate(appUrl);
const offline = await evaluate(`({
  cards: document.querySelectorAll(".menu-card").length,
  errorHidden: document.querySelector("#error-state").hidden,
  overflow: document.documentElement.scrollWidth - window.innerWidth
})`);
assert.equal(offline.cards, 8, "cached dishes should render offline");
assert.equal(offline.errorHidden, true, "offline reload should not show a data error");
assert.ok(offline.overflow <= 0, "offline page should not overflow");
await send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1
});

assert.deepEqual(runtimeErrors, [], `runtime errors: ${runtimeErrors.join("; ")}`);
assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join("; ")}`);

console.log(`✓ Browser rendered ${initial.cards} dishes, exercised details/cart/language/search and activated the PWA`);
console.log(`✓ Responsive overflow checks passed at ${widths.join(", ")}px`);
console.log("✓ Cached menu rendered after Chrome network was switched offline");
socket.close();
