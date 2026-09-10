// Minimal service worker: caches the app shell's static assets so the
// client-side app can keep running (and IndexedDB-backed offline recording
// can keep working) when a farmer loses connectivity mid-session. It does
// NOT try to cache or serve dynamic authenticated HTML — that would require
// a much more involved per-user caching strategy than this MVP needs.
const CACHE_NAME = "poultry360-shell-v1";
const SHELL_ASSETS = ["/manifest.json", "/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never intercept Supabase calls
  if (!SHELL_ASSETS.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached ?? fetch(request)),
  );
});
