const CACHE_NAME = "flota-shell-v2";
const SHELL_ASSETS = ["./", "./index.html", "./css/styles.css", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Never cache Firebase/Firestore/Storage/Google API calls — always go to network.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    // { cache: "no-store" } bypasses the browser's own HTTP cache too — with
    // a plain fetch(), a Cache-Control header from GitHub Pages could hand
    // back a stale response that then gets re-saved into our own cache,
    // making a deploy take up to ~10 minutes to actually show up.
    fetch(event.request, { cache: "no-store" })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
