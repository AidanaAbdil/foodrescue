// Service worker: the small script phones keep running for an installed app.
// It does one thing: if a page can't load because there's no internet, show
// /offline.html instead of the browser's error. Pages are NOT cached, so
// prices, stock and orders are always live.
//
// Changing this file? Bump the version so phones pick up the new copy.
const CACHE = "offline-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Remove caches from older versions of this file.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only full page loads; everything else goes straight to the network.
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
