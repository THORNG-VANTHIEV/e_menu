/* global PRECACHE_URLS */
importScripts("./precache-manifest.js");

const VERSION = "v1.0.48";
const STATIC_CACHE = `emenu-static-${VERSION}`;
const DATA_CACHE = `emenu-data-${VERSION}`;
const IMAGE_CACHE = `emenu-images-${VERSION}`;
const CACHE_PREFIX = "emenu-";
const scopeUrl = new URL(self.registration.scope);

function scopedUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const results = await Promise.allSettled(PRECACHE_URLS.map(async (path) => {
      const url = scopedUrl(path);
      const response = await fetch(new Request(url, {cache: "reload"}));
      if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
      await cache.put(url, response);
    }));
    const failures = results
      .map((result, index) => ({result, path: PRECACHE_URLS[index]}))
      .filter(({result}) => result.status === "rejected");
    if (failures.length) {
      failures.forEach(({path, result}) => console.error(`[sw] Precache failed for ${path}:`, result.reason));
      throw new Error(`Precache failed for ${failures.length} resource(s)`);
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const current = new Set([STATIC_CACHE, DATA_CACHE, IMAGE_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && !current.has(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, {ignoreSearch: true}))
      || (await cache.match(scopedUrl("./index.html")))
      || (await cache.match(scopedUrl("./offline.html")));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request, {ignoreSearch: true});
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      await cache.put(request, response.clone());
      const clients = await self.clients.matchAll({type: "window"});
      for (const client of clients) {
        client.postMessage({type: "DATA_CACHE_UPDATED", url: request.url});
      }
    }
    return response;
  }).catch(() => null);
  return cached || (await network) || new Response(
    JSON.stringify({error: "offline"}),
    {status: 503, headers: {"Content-Type": "application/json"}}
  );
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, {ignoreSearch: true});
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    if (request.destination === "image") {
      return (await caches.match(scopedUrl("./assets/images/placeholders/menu-placeholder.svg")))
        || Response.error();
    }
    return Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const {request} = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scopeUrl.origin || !url.pathname.startsWith(scopeUrl.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.endsWith(".json")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
  if (["style", "script", "font", "manifest"].includes(request.destination)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
