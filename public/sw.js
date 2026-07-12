/* ============================================================
   OneXp SiteShot — Service Worker
   Network-first strategy: always fetches fresh content from
   the server. Falls back to cache only when offline.
   This ensures every deploy update reflects immediately.
   ============================================================ */

const CACHE_NAME = 'onexp-siteshot-v1';

// Static assets to pre-cache on install
const PRECACHE_ASSETS = [
  '/css/styles.css',
  '/js/main.js',
  '/assets/logo.png',
  '/assets/hero.png',
  '/manifest.json',
  '/offline',
];

// ---- Install: pre-cache static assets ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately — don't wait for old SW to die
  self.skipWaiting();
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// ---- Fetch: Network-first strategy ----
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and browser extensions
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip screenshot API calls — never cache these
  if (event.request.url.includes('/api/screenshot')) return;
  if (event.request.url.includes('/api/v1/screenshot')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Clone and cache fresh response for offline fallback
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          // Only cache successful responses
          if (networkResponse.status === 200) {
            cache.put(event.request, responseClone);
          }
        });
        return networkResponse;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // If navigating to a page not in cache, show offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline');
          }
          return new Response('Network error', { status: 503 });
        });
      })
  );
});

// ---- Message: force update from app ----
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
