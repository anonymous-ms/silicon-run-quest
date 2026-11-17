const CACHE = 'silicon-run-photoresist-2026-11-16-v6';
const LOCAL = [
  './', './index.html', './manifest.webmanifest', './css/styles.css', './css/developer-layout.css',
  './js/photoresist-chamber.js', './js/circuit-symbols.js', './js/silicon-run.js',
  './js/silicon-run-core.js', './js/parallel-wafer-runtime.js',
  './js/design-workstation-runtime.js', './js/design-world-runtime.js',
  './js/cleanroom-lod.js', './js/cleanroom-debug.js', './js/cleanroom-realism.js', './js/cleanroom-pedagogy.js', './js/cleanroom-audio.js',
  './js/silicon-run-startup.js',
  './icons/icon-192.png', './icons/icon-512.png'
];
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';
self.addEventListener('install', event => { event.waitUntil((async () => { const cache = await caches.open(CACHE); await cache.addAll(LOCAL); try { await cache.add(new Request(THREE, { mode: 'no-cors' })); } catch (_) {} await self.skipWaiting(); })()); });
self.addEventListener('activate', event => { event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))); await self.clients.claim(); })()); });
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  if (['script', 'style'].includes(event.request.destination)) {
    event.respondWith(fetch(event.request).then(async response => {
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    }).catch(async () => (await caches.match(event.request)) || Response.error()));
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
