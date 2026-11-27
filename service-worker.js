const CACHE_NAME = "tripsplit-shell-v9";
const APP_FILES = [
  "./",
  "./index.html",
  "./trip.html",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(
        names.filter(name => name.startsWith("tripsplit-shell-") && name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle files hosted by this app. Supabase/API traffic is never cached.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        // iOS Home Screen navigation may not match the original cached request
        // exactly, so fall back to the known app-shell file by pathname.
        const isTripPage = url.pathname.endsWith("/trip.html");
        const shellUrl = new URL(isTripPage ? "./trip.html" : "./index.html", self.registration.scope).href;
        const cachedPage = await cache.match(shellUrl);
        if (cachedPage) return cachedPage;

        const cachedRoot = await cache.match(new URL("./", self.registration.scope).href);
        if (cachedRoot) return cachedRoot;

        return new Response(
          "TripSplit is offline. Connect to Wi-Fi or mobile data and try again.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
