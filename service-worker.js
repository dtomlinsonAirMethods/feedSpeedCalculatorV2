const CACHE_NAME = "feedSpeedCalculator-v1";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./material.json",
  "./thread.json",
  "./ipt.json",
  "./favicon.ico",
  "./manifest.json"
];

self.addEventListener("install", (e) => {
  console.log("Installing service worker...");
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  console.log("Service worker activated");
  e.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("Removing old cache", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log("📦 Serving from cache:", e.request.url);
        return cachedResponse;
      }
      return fetch(e.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return response;
        })
        .catch(() => {
          console.warn("⚠️ Offline and not cached:", e.request.url);
        });
    })
  );
});
