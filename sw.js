const CACHE_NAME = "partezettel-shell-v12";
const SHELL_FILES = [
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-First: Immer zuerst versuchen, die aktuelle Version aus dem Netz zu holen.
// Nur wenn gar keine Verbindung besteht, wird auf den Cache zurückgegriffen.
// So wirken Code-Änderungen sofort, ohne dass Nutzer manuell den Cache löschen müssen.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
