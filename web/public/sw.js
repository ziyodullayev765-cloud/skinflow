/* SkinFlow service worker: cache-first for immutable static assets, never caches API calls. */
const VERSION = "sf-v2";
const STATIC_CACHE = `${VERSION}-static`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(["/assets/icons/app.svg", "/assets/avatars/default.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/uploads/")) return;

  // /assets (artwork, sounds) may be updated in place: serve cached copy but refresh it in the background.
  if (url.pathname.startsWith("/assets/")) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        const fresh = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || fresh;
      }),
    );
    return;
  }

  const cacheable = url.pathname.startsWith("/static/");
  if (cacheable) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  // Navigations: network first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
  }
});
