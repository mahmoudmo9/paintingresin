// Offline cache. Bump VERSION whenever any file changes.
const VERSION = 'rr-v1.0.1';
const CORE = [
  './', 'index.html', 'style.css', 'app.js', 'data.js', 'manifest.webmanifest',
  'icon-180.png', 'icon-192.png', 'icon-512.png',
  'vazirmatn-arabic-400-normal.woff2', 'vazirmatn-arabic-500-normal.woff2', 'vazirmatn-arabic-700-normal.woff2',
  'vazirmatn-latin-400-normal.woff2', 'vazirmatn-latin-500-normal.woff2', 'vazirmatn-latin-700-normal.woff2'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isStatic = /\.(woff2|png)$/.test(new URL(req.url).pathname);
  if (isStatic) {
    // fonts and icons: cache first
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })));
    return;
  }
  // pages, code and data: network first so updates show, cache when offline
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
});
