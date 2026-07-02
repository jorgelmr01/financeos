/* FinanceOS service worker — offline app shell + runtime caching.
   Bump CACHE when shipping new assets so clients pick them up.
   The Tesseract OCR assets under vendor/tesseract/ are deliberately NOT in the
   precache shell (~9MB) — they're fetched lazily the first time someone imports
   a scanned statement, then cached on use by the same-origin handler below. */
const CACHE = 'financeos-v24';

/* Local app shell — everything needed to boot fully offline.
   (lessons.js loads lazily and is runtime-cached on first use.) */
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './vendor/pdf.min.js',
  './vendor/pdf.worker.min.js',
  './js/utils.js',
  './js/i18n.js',
  './js/instruments.js',
  './js/store.js',
  './js/budget.js',
  './js/statements.js',
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

  /* Google Fonts are immutable — cache-first is safe and fastest. */
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  /* Our own HTML/CSS/JS: network-first so a new deploy shows up on the next
     reload, falling back to the cache only when offline. This avoids the
     "I deployed but still see the old app" trap of a cache-first worker. */
  e.respondWith(
    fetch(req).then((res) => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) =>
      hit || (req.mode === 'navigate' ? caches.match('./index.html', { ignoreSearch: true }) : undefined)
    ))
  );
});
