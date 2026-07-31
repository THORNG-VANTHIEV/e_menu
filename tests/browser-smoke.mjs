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
  features: [
    {name: "prefers-color-scheme", value: "dark"},
    {name: "prefers-reduced-motion", value: "no-preference"}
  ]
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
await evaluate(`Promise.all([
  document.fonts.load('16px "Hanuman"'),
  document.fonts.load('600 16px "Hanuman"'),
  document.fonts.load('32px "Khmer OS Bassac"')
]).then(() => true)`, true);

const initial = await evaluate(`({
  cards: document.querySelectorAll(".menu-card").length,
  lang: document.documentElement.lang,
  errorHidden: document.querySelector("#error-state").hidden,
  loadingHidden: document.querySelector("#menu-loading").hidden,
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  qrReady: Boolean(document.querySelector("#menu-qr-code canvas, #menu-qr-code img")),
  theme: document.documentElement.dataset.theme,
  themePreference: document.querySelector('input[name="theme"]:checked')?.value,
  themePrimary: getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
  themeAccent: getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim(),
  themeBackground: getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
  browserThemeColor: document.querySelector('meta[name="theme-color"]').content,
  heroSlides: document.querySelectorAll("[data-hero-slide]").length,
  heroInterval: document.querySelector("#hero-slider").dataset.intervalMs,
  heroIndex: document.querySelector("#home").dataset.heroIndex,
  heroTitle: document.querySelector("#hero-title").textContent,
  sharedBusinessLogo: document.querySelector("#header-logo").currentSrc
    === document.querySelector(".footer-brand img").currentSrc,
  businessLogosReady: [document.querySelector("#header-logo"), document.querySelector(".footer-brand img")]
    .every((image) => image.complete && image.naturalWidth === 192 && image.naturalHeight === 192),
  bodyFont: getComputedStyle(document.body).fontFamily,
  heroTitleFont: getComputedStyle(document.querySelector("#hero-title")).fontFamily,
  heroTitleLineHeight: parseFloat(getComputedStyle(document.querySelector("#hero-title")).lineHeight),
  heroTitleFontSize: parseFloat(getComputedStyle(document.querySelector("#hero-title")).fontSize),
  uiFont: getComputedStyle(document.querySelector("#language-button")).fontFamily,
  heroCtaFont: getComputedStyle(document.querySelector(".hero__cta")).fontFamily,
  heroCtaBackground: getComputedStyle(document.querySelector(".hero__cta")).backgroundColor,
  heroCtaColor: getComputedStyle(document.querySelector(".hero__cta")).color,
  heroCtaAlignment: (() => {
    const buttonRect = document.querySelector(".hero__cta").getBoundingClientRect();
    const textRect = document.querySelector(".hero__cta span").getBoundingClientRect();
    return Math.abs((buttonRect.top + buttonRect.bottom - textRect.top - textRect.bottom) / 2);
  })(),
  localFontsReady: document.fonts.check('16px "Hanuman"')
    && document.fonts.check('600 16px "Hanuman"')
    && document.fonts.check('32px "Khmer OS Bassac"'),
  menuNameFontWeight: getComputedStyle(document.querySelector(".menu-card h3")).fontWeight,
  heroTitleFontWeight: getComputedStyle(document.querySelector("#hero-title")).fontWeight,
  menuNameLineHeight: parseFloat(getComputedStyle(document.querySelector(".menu-card h3")).lineHeight),
  menuNameFontSize: parseFloat(getComputedStyle(document.querySelector(".menu-card h3")).fontSize),
  menuNameInnerOverflow: getComputedStyle(document.querySelector(".menu-card__open")).overflow
})`);
assert.equal(initial.cards, 8, "all sample dishes should render");
assert.equal(initial.lang, "km", "Khmer should be the first-visit language");
assert.equal(initial.errorHidden, true, "the data error state should stay hidden");
assert.equal(initial.loadingHidden, true, "the loading state should complete");
assert.ok(initial.overflow <= 0, `390px layout overflowed by ${initial.overflow}px`);
assert.equal(initial.qrReady, true, "the deployment-aware menu QR code should render");
assert.equal(initial.theme, "light", "light should be rendered on the first visit");
assert.equal(initial.themePreference, "light", "Settings should select light on the first visit");
assert.equal(initial.themePrimary, "#4d2a1d", "light mode should use brand espresso for primary actions");
assert.equal(initial.themeAccent, "#d8925e", "light mode should use the exact brand caramel accent");
assert.equal(initial.themeBackground, "#fff9f4", "light mode should use the warm cream-derived background");
assert.equal(initial.browserThemeColor, "#4d2a1d", "light mode should tint browser chrome with brand espresso");
assert.equal(initial.heroSlides, 3, "the hero should render all three configured covers");
assert.equal(initial.heroInterval, "10000", "the hero should use a ten-second interval");
assert.equal(initial.heroIndex, "0", "the first cover should be active initially");
assert.equal(initial.sharedBusinessLogo, true, "the app bar and footer should use the same business logo");
assert.equal(initial.businessLogosReady, true, "both visible business logos should load at 192px");
assert.match(initial.bodyFont, /Hanuman/, "Khmer content should use the local Hanuman font");
assert.match(initial.heroTitleFont, /Khmer OS Bassac/, "the Khmer hero title should use the local Bassac font");
assert.ok(
  initial.heroTitleLineHeight / initial.heroTitleFontSize >= 1.15
    && initial.heroTitleLineHeight / initial.heroTitleFontSize <= 1.2,
  "the wrapped Khmer hero title should use compact, readable line spacing"
);
assert.match(initial.uiFont, /Noto Sans Khmer/, "compact Khmer controls should retain Noto Sans Khmer");
assert.match(initial.heroCtaFont, /Noto Sans Khmer/, "Khmer button-styled links should use the UI font");
assert.equal(initial.heroCtaBackground, "rgb(216, 146, 94)", "the light hero CTA should use the brand accent");
assert.equal(initial.heroCtaColor, "rgb(43, 26, 20)", "the hero CTA should use accessible espresso text");
assert.ok(initial.heroCtaAlignment <= 0.5, "the Khmer hero CTA text should be vertically centered");
assert.equal(initial.localFontsReady, true, "both Hanuman weights and Bassac Regular should load");
assert.equal(initial.menuNameFontWeight, "600", "Khmer menu names should use genuine Hanuman Semibold");
assert.equal(initial.heroTitleFontWeight, "400", "Bassac display titles should retain their genuine Regular weight");
assert.ok(
  initial.menuNameLineHeight / initial.menuNameFontSize >= 1.6,
  "Khmer menu names should have enough line height for Hanuman upper marks"
);
assert.equal(initial.menuNameInnerOverflow, "visible", "the menu-name button should not clip Khmer glyphs");
if (process.env.CAPTURE_SCREENSHOTS === "1") {
  await captureScreenshot("/private/tmp/e-menu-cdp-390.png");
  await evaluate(`document.querySelector("#menu").scrollIntoView()`);
  await delay(200);
  await captureScreenshot("/private/tmp/e-menu-cdp-390-khmer-menu.png");
  await evaluate(`document.querySelector("#home").scrollIntoView()`);
  await delay(200);
}

async function swipeHero(fromX, toX, pointerId, pointerType = "touch") {
  await evaluate(`(() => {
    const hero = document.querySelector("#home");
    const pointerOptions = {
      bubbles: true,
      cancelable: true,
      pointerId: ${pointerId},
      pointerType: ${JSON.stringify(pointerType)},
      isPrimary: true,
      button: 0
    };
    hero.dispatchEvent(new PointerEvent("pointerdown", {...pointerOptions, clientX: ${fromX}}));
    hero.dispatchEvent(new PointerEvent("pointermove", {...pointerOptions, clientX: ${toX}}));
    hero.dispatchEvent(new PointerEvent("pointerup", {...pointerOptions, clientX: ${toX}}));
  })()`);
  await delay(750);
}

await swipeHero(340, 90, 41);
assert.equal(await evaluate(`document.querySelector("#home").dataset.heroIndex`), "1", "swiping left should show the next cover");
assert.equal(
  await evaluate(`document.querySelector("#hero-title").textContent`),
  initial.heroTitle,
  "the business name should remain fixed while the background changes"
);
await swipeHero(90, 340, 42, "mouse");
assert.equal(await evaluate(`document.querySelector("#home").dataset.heroIndex`), "0", "mouse-dragging right should show the previous cover");

async function rapidlySwipeHero(fromX, toX, count, firstPointerId) {
  await evaluate(`(() => {
    const hero = document.querySelector("#home");
    for (let index = 0; index < ${count}; index += 1) {
      const pointerOptions = {
        bubbles: true,
        cancelable: true,
        pointerId: ${firstPointerId} + index,
        pointerType: "touch",
        isPrimary: true,
        button: 0
      };
      hero.dispatchEvent(new PointerEvent("pointerdown", {...pointerOptions, clientX: ${fromX}}));
      hero.dispatchEvent(new PointerEvent("pointermove", {...pointerOptions, clientX: ${toX}}));
      hero.dispatchEvent(new PointerEvent("pointerup", {...pointerOptions, clientX: ${toX}}));
    }
  })()`);
  await delay(750);
  return evaluate(`({
    index: document.querySelector("#home").dataset.heroIndex,
    visibleSlides: [...document.querySelector("#hero-track").children].filter((slide) => {
      const rect = slide.getBoundingClientRect();
      return rect.right > 0 && rect.left < window.innerWidth;
    }).length,
    transform: document.querySelector("#hero-track").style.transform
  })`);
}

const rapidLeft = await rapidlySwipeHero(340, 70, 7, 100);
assert.equal(rapidLeft.index, "1", "seven rapid left swipes should wrap to the second cover");
assert.ok(rapidLeft.visibleSlides > 0, `rapid left swipes left the hero blank at ${rapidLeft.transform}`);
const rapidRight = await rapidlySwipeHero(70, 340, 8, 200);
assert.equal(rapidRight.index, "2", "eight rapid right swipes should wrap to the third cover");
assert.ok(rapidRight.visibleSlides > 0, `rapid right swipes left the hero blank at ${rapidRight.transform}`);

await evaluate(`document.querySelector('[data-hero-dot="0"]').click()`);
await delay(10_200);
assert.equal(
  await evaluate(`document.querySelector("#home").dataset.heroIndex`),
  "1",
  "the hero should advance automatically after ten seconds"
);
await evaluate(`document.querySelector('[data-hero-dot="0"]').click()`);
await delay(750);

await evaluate(`document.querySelector("#theme-button").click()`);
await delay(100);
const firstTheme = await evaluate(`({
  rendered: document.documentElement.dataset.theme,
  stored: localStorage.getItem("emenu:v1:theme"),
  primary: getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
  accent: getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim(),
  background: getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim(),
  browserThemeColor: document.querySelector('meta[name="theme-color"]').content
})`);
assert.equal(firstTheme.rendered, "dark", "one click from rendered light mode should switch to dark");
assert.equal(firstTheme.stored, "dark", "the explicit dark preference should be stored");
assert.equal(firstTheme.primary, "#d8925e", "dark mode should use brand caramel for primary actions");
assert.equal(firstTheme.accent, "#e6ab7c", "dark mode should use the lighter caramel accent");
assert.equal(firstTheme.background, "#160f0c", "dark mode should use the chocolate background");
assert.equal(firstTheme.browserThemeColor, "#160f0c", "dark mode should tint browser chrome with the chocolate background");
if (process.env.CAPTURE_SCREENSHOTS === "1") {
  await captureScreenshot("/private/tmp/e-menu-cdp-390-brand-dark.png");
}
await evaluate(`document.querySelector("#theme-button").click()`);
await delay(100);
const secondTheme = await evaluate(`({
  rendered: document.documentElement.dataset.theme,
  browserThemeColor: document.querySelector('meta[name="theme-color"]').content
})`);
assert.equal(secondTheme.rendered, "light", "one click from dark mode should switch back to light");
assert.equal(secondTheme.browserThemeColor, "#4d2a1d", "switching back should restore the light browser color");

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
assert.match(
  await evaluate(`getComputedStyle(document.body).fontFamily`),
  /Inter/,
  "English should continue using Inter"
);

await evaluate(`(() => {
  const input = document.querySelector("#search-input");
  input.value = "កាហ្វេ";
  input.dispatchEvent(new Event("input", {bubbles: true}));
})()`);
await delay(350);
assert.equal(await evaluate(`document.querySelectorAll(".menu-card").length`), 1, "Khmer search should work while UI is English");
await evaluate(`document.querySelector("#clear-search-button").click()`);
await delay(100);

await evaluate(`document.querySelector("#language-button").click()`);
await delay(150);
assert.equal(await evaluate(`document.documentElement.lang`), "km", "responsive checks should exercise Khmer typography");

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
  responsive.push(await evaluate(`(() => {
    const title = document.querySelector("#header-business-name");
    const titleStyle = getComputedStyle(title);
    const canvas = document.createElement("canvas").getContext("2d");
    canvas.font = titleStyle.font;
    const titleMetrics = canvas.measureText(title.textContent);
    return {
      width: window.innerWidth,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      mobileNav: getComputedStyle(document.querySelector(".mobile-nav")).display,
      desktopNav: getComputedStyle(document.querySelector(".desktop-nav")).display,
      appBarTitleClientWidth: title.clientWidth,
      appBarTitleScrollWidth: title.scrollWidth,
      appBarTitleLineHeight: parseFloat(titleStyle.lineHeight),
      appBarTitleInkHeight: titleMetrics.actualBoundingBoxAscent + titleMetrics.actualBoundingBoxDescent
    };
  })()`));
}
responsive.forEach((result) => {
  assert.ok(result.overflow <= 0, `${result.width}px layout overflowed by ${result.overflow}px`);
  assert.ok(
    result.appBarTitleLineHeight >= result.appBarTitleInkHeight,
    `${result.width}px app-bar title line box clips Khmer marks`
  );
  assert.ok(
    result.appBarTitleClientWidth >= result.appBarTitleScrollWidth,
    `${result.width}px app-bar title is horizontally clipped`
  );
  if (result.width < 768) assert.notEqual(result.mobileNav, "none", "mobile nav should be visible below 768px");
  if (result.width >= 768) assert.equal(result.mobileNav, "none", "mobile nav should hide at desktop width");
});
if (process.env.CAPTURE_SCREENSHOTS === "1") {
  await evaluate(`document.querySelector("#menu").scrollIntoView()`);
  await delay(200);
  await captureScreenshot("/private/tmp/e-menu-cdp-1440-menu.png");
}

await evaluate(`Promise.all([
  document.fonts.load('16px "Hanuman"'),
  document.fonts.load('600 16px "Hanuman"'),
  document.fonts.load('32px "Khmer OS Bassac"')
]).then(() => true)`, true);
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
  overflow: document.documentElement.scrollWidth - window.innerWidth,
  bodyFont: getComputedStyle(document.body).fontFamily,
  heroTitleFont: getComputedStyle(document.querySelector("#hero-title")).fontFamily,
  menuNameFontWeight: getComputedStyle(document.querySelector(".menu-card h3")).fontWeight,
  localFontsReady: document.fonts.check('16px "Hanuman"')
    && document.fonts.check('600 16px "Hanuman"')
    && document.fonts.check('32px "Khmer OS Bassac"')
})`);
assert.equal(offline.cards, 8, "cached dishes should render offline");
assert.equal(offline.errorHidden, true, "offline reload should not show a data error");
assert.ok(offline.overflow <= 0, "offline page should not overflow");
assert.match(offline.bodyFont, /Hanuman/, "Hanuman should remain active offline");
assert.match(offline.heroTitleFont, /Khmer OS Bassac/, "Bassac should remain active offline");
assert.equal(offline.menuNameFontWeight, "600", "Hanuman Semibold should remain active offline");
assert.equal(offline.localFontsReady, true, "both Hanuman weights and Bassac should load from the offline cache");
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
