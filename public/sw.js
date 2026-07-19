const CACHE = "surebook-shell-v1";
const OFFLINE = "/offline";
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE))));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
