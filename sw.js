// ルートの後始末用 Service Worker（自己解除）。
// マルチテナント化でアプリを /<店舗>/ 配下へ移した際、以前ルート範囲(/)に
// 登録されていた旧アプリのSWを退役させるためのもの。
// 旧SWはナビゲーション時に /sw.js の更新を確認するため、これに置き換わり、
// 全キャッシュを消去→自身を登録解除→リロードして最新表示にする。
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    try {
      var keys = await caches.keys();
      await Promise.all(keys.map(function (k) { return caches.delete(k); }));
    } catch (e) {}
    try { await self.registration.unregister(); } catch (e) {}
    try {
      var cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
    } catch (e) {}
  })());
});
