const CACHE = 'silicon-run-v4-pinch-ghost-hands';
const LOCAL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.min.js';
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(async cache => { await cache.addAll(LOCAL); try { await cache.add(new Request(THREE,{mode:'no-cors'})); } catch (_) {} }).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => { if(event.request.method!=='GET')return; event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response;}))); });
