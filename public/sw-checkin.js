// Scoped to /checkin only (see registration in src/app/checkin/page.tsx) — the rest of the app
// (registration, payment) must never be served stale from cache. Stale-while-revalidate: serve
// from cache immediately if present (works with zero connectivity at the gate), refresh the
// cache from the network in the background whenever it's reachable.
const CACHE_NAME = "checkin-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    }),
  );
});
