// Service worker: allt hämtas network-first med cache som reserv, så att listan går att läsa offline.
const VERSION = 'jullov-v2';
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const IMAGES = `${VERSION}-images`;

const SHELL_FILES = [
  '/', '/index.html', '/manifest.webmanifest', '/css/app.css', '/css/print.css',
  '/js/app.js', '/js/api.js', '/js/dom.js', '/js/ui.js',
  '/js/lib/dates.js', '/js/lib/meals.js',
  '/js/views/common.js', '/js/views/wishes.js', '/js/views/plan.js', '/js/views/handla.js', '/js/views/print.js', '/js/views/settings.js', '/js/views/modals.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png',
  '/fonts/cormorant/cormorant-garamond-latin-600-normal.woff2', '/fonts/cormorant/cormorant-garamond-latin-700-normal.woff2',
  '/fonts/inter/inter-latin-400-normal.woff2', '/fonts/inter/inter-latin-500-normal.woff2',
  '/fonts/inter/inter-latin-600-normal.woff2', '/fonts/inter/inter-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (!hit) throw new Error('offline');
    // Markera att svaret kommer från cachen så att appen kan visa "Offline"
    const headers = new Headers(hit.headers);
    headers.set('x-from-cache', '1');
    return new Response(hit.body, { status: hit.status, headers });
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Versionskontrollen och exporten ska alltid vara färska
  if (url.pathname === '/api/rev' || url.pathname === '/api/export') return;
  if (url.pathname.startsWith('/api/')) return e.respondWith(networkFirst(req, DATA));
  if (url.pathname.startsWith('/uploads/')) return e.respondWith(networkFirst(req, IMAGES));
  e.respondWith(networkFirst(req, SHELL));
});
