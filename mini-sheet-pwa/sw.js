// Service worker: precache + offline. File locali: network-first (niente cache "vecchia" che inganna), fallback cache.
const V = 'mini-sheet-v2';  // cambiare versione a ogni modifica dei file
const LOCAL = ['./', './index.html', './manifest.json', './css/style.css', './js/app.js', './js/engine.js', './js/coordinates.js', './icons/icon-192.png', './icons/icon-512.png'];
const CDN = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css';
self.addEventListener('install', e => e.waitUntil((async () => {
  const c = await caches.open(V); await c.addAll(LOCAL);
  try { const req = new Request(CDN, { mode: 'no-cors' }); await c.put(req, await fetch(req)); } catch { }  // risposta opaca ok
  self.skipWaiting();
})()));
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== V) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  if (new URL(req.url).origin === location.origin) {       // locale: rete prima, cache se offline
    e.respondWith(fetch(req).then(res => { if (res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(req, cp)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('./index.html'))));
  } else e.respondWith(caches.match(req).then(h => h || fetch(req)));   // CDN: cache prima
});
