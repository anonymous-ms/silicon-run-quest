const CACHE = 'silicon-run-v8.3-label-workstation-2026-10-23';
const LOCAL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css',
  './js/loader.v83.js', './js/base.v83.js', './js/parallel-wafers.v83.js',
  './js/design-workstation.v83.js', './js/bootstrap.v83.js',
  './icons/icon-192.png', './icons/icon-512.png'
];
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(LOCAL);
    try { await cache.add(new Request(THREE, { mode: 'no-cors' })); } catch (_) {}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate' || ['script', 'style'].includes(event.request.destination)) {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const network = fetch(event.request).then(async response => {
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    }).catch(() => null);
    return cached || await network || Response.error();
  })());
});
