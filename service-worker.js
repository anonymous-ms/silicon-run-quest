const CACHE = 'silicon-run-canonical-2026-10-27-v2';
const VERSION = '2026-10-27-v2';

const LOCAL = [
  './',
  `./index.html?v=${VERSION}`,
  `./manifest.webmanifest?v=${VERSION}`,
  `./css/styles.css?v=${VERSION}`,
  `./js/silicon-run.js?v=${VERSION}`,
  `./icons/icon-192.png?v=${VERSION}`,
  `./icons/icon-512.png?v=${VERSION}`
];

const THREE = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js?v=0.152.2';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    try {
      await cache.add(new Request(THREE, { mode: 'no-cors' }));
    } catch (e) {
      // ignore CDN prefetch failure
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(key => key !== CACHE)
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore chrome-extension and non-HTTP(S) requests
  if (!url.protocol.startsWith('http')) return;

  // Bypass for CDN / third-party assets; let browser fetch fresh copy
  if (url.origin !== self.location.origin) {
    return;
  }

  // Always use fresh HTML for app shell navigations
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For local app assets, always prefer network, then fallback to cache
  if (['script', 'style', 'image', 'font', 'manifest'].includes(event.request.destination) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.png') || url.pathname.endsWith('.webmanifest')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
