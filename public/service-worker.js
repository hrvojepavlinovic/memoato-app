// NOTE: Keep this version in sync with deployments.
// We intentionally bump it when the app bundle changes to avoid serving stale HTML/JS.
const CACHE_NAME = "memoato-cache-v8";
const PRECACHE_URLS = [
  "/android-chrome-192x192.png?v=7",
  "/android-chrome-512x512.png?v=7",
  "/android-chrome-maskable-192x192.png?v=7",
  "/android-chrome-maskable-512x512.png?v=7",
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/favicon-16x16.png",
  "/logo.png",
  "/manifest.webmanifest",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.origin) return;

  // Never persist navigations: URLs can contain reset, verification, or OAuth tokens.
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }

  // Only cache the fixed, public application assets listed above. In particular,
  // do not cache API/operation responses or arbitrary query-string URLs.
  if (url.search || !PRECACHE_URLS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          return response;
        })
        .catch(() => cached ?? Promise.reject("offline"));
    }),
  );
});
