const CACHE_NAME = "partezettel-shell-v342";
const LIB_CACHE = "partezettel-libs-v1";   // Bibliotheken (three.js) bleiben über App-Versionen hinweg erhalten
const THREE_PREFIX = "https://cdn.jsdelivr.net/npm/three@0.160.0/";
const SHELL_FILES = ["./index.html", "./style.css", "./app.js", "./tree3d.js", "./config.js", "./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("partezettel-shell-") && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // 3D-Bibliothek: einmal laden, danach aus dem Zwischenspeicher (auch offline).
  if (event.request.url.startsWith(THREE_PREFIX)) {
    event.respondWith(
      caches.open(LIB_CACHE).then(async cache => {
        const treffer = await cache.match(event.request);
        if (treffer) return treffer;
        const antwort = await fetch(event.request);
        if (antwort.ok) cache.put(event.request, antwort.clone());
        return antwort;
      })
    );
    return;
  }

  // Eigene Dateien: zuerst das Netz (immer aktuell), ohne Netz der Zwischenspeicher.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(antwort => {
          const kopie = antwort.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, kopie));
          return antwort;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
  }
});
