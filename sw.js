/* FinanceOS service worker — offline app shell + runtime caching.
   Bump CACHE when shipping new assets so clients pick them up. */
const CACHE = 'financeos-v2';

/* Local app shell — everything needed to boot fully offline. */
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/utils.js',
  './js/store.js',
  './js/budget.js',
  './js/ui.js',
  './js/learn.js',
  './js/pages.js',
  './js/app.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Live financial data (quotes, FX rates, dividends) must never be served
     stale — let those requests go straight to the network, untouched. */
  if (url.origin !== self.location.origin && !/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    return;
  }

  /* Navigations: network-first so updates land, fall back to cached shell offline. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }

  /* Everything else (local assets + Google Fonts): cache-first, then fill the cache. */
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
