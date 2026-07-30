// Service Worker: アプリシェルをキャッシュし、オフラインでも起動できるようにする。
// API（script.google.com）へのPOSTは横取りせず素通しする。
const CACHE = 'pos-pwa-v17';
const SHELL = [
  './',
  './index.html',
  './takeout.html',
  './kds.html',
  './admin.html',
  './manage.html',
  './coupons.html',
  './recipe.html',
  './drink_inv.html',
  './members.html',
  './sales.html',
  './attendance.html',
  './users.html',
  './menu_editor.html',
  './inventory.html',
  './settings.html',
  './clock.html',
  './styles.css',
  './config.js',
  './api.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // GET以外・別オリジン（API）は素通し
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ページ遷移はネット優先→失敗時キャッシュのindex
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 静的資産はキャッシュ優先
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => hit))
  );
});
