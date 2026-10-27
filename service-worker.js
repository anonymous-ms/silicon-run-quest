const CACHE = 'silicon-run-canonical-2026-10-27.1';
const LOCAL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/silicon-run.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    self.skipWaiting();
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    try {
      await cache.add(new Request(THREE, { mode: 'no-cors' }));
    } catch (error) {
      // CDN may reject the no-cors request during install; the browser will fetch it on demand.
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    self.clients.claim();
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const isLocalAsset = event.request.url.startsWith(self.location.origin) && (
    event.request.mode === 'navigate' ||
    ['script', 'style', 'image', 'font'].includes(event.request.destination)
  );

  if (!isLocalAsset) return;

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request, { cache: 'no-store' });
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (error) {
      return caches.match(event.request) || caches.match('./') || Response.error();
    }
  })());
});
