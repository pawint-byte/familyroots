const CACHE_NAME = 'familyroots-v2-network-only';
const CACHE_PREFIX = 'familyroots-';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((name) => name.startsWith(CACHE_PREFIX))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Intentionally no fetch handler. HTTP cache headers are the source of truth:
// HTML and this worker are never stored, while content-hashed assets are immutable.
