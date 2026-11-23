// Network-first service worker: when you're online the app always loads the newest
// files from the server; the cached copy is only used when offline (or if the
// server doesn't answer within a few seconds), so the app still works in the gym
// without signal. Your logged data lives in localStorage and is never touched here.
const CACHE_NAME = 'minmax-tracker-v2';
const ASSETS = ['./', './index.html', './manifest.json'];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((a) =>
        fetch(a, { cache: 'no-cache' }).then((r) => { if (r.ok) return cache.put(a, r); })
      ))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const res = await Promise.race([
        fetch(req, { cache: 'no-cache' }), // 'no-cache' skips GitHub Pages' short HTTP cache
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS)),
      ]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const cached = await cache.match(req, { ignoreSearch: true });
      return cached || (await cache.match('./index.html')) || Response.error();
    }
  })());
});
