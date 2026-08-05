// API クライアント ＋ オフライン送信キュー（IndexedDB）
// GASは Content-Type: text/plain でPOSTするとプリフライトを回避できる。
(function () {
  const CFG = window.APP_CONFIG;
  const API = {};

  // ---- ロード中オーバーレイ（全アクション共通の待機表示。完了で自動クローズ）----
  // api.js は全ページが読み込むため、ここに置くだけで共通部品になる。
  const _load = (function () {
    let count = 0, el = null, txt = null, hideTimer = null;
    function ensure() {
      if (el || typeof document === 'undefined' || !document.body) return;
      const st = document.createElement('style');
      st.textContent = '@keyframes izspin{to{transform:rotate(360deg)}}'
        + '#izLoad{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.42);opacity:0;transition:opacity .15s;}'
        + '#izLoad.on{opacity:1;}'
        + '#izLoad .box{background:#fff;border-radius:14px;padding:20px 26px;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 12px 40px rgba(0,0,0,.28);min-width:150px;}'
        + '#izLoad .sp{width:34px;height:34px;border:3px solid #e5e7eb;border-top-color:#0f172a;border-radius:50%;animation:izspin .8s linear infinite;}'
        + '#izLoad .tx{font-size:14px;font-weight:800;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Noto Sans JP\',sans-serif;}';
      document.head.appendChild(st);
      el = document.createElement('div'); el.id = 'izLoad';
      el.innerHTML = '<div class="box"><div class="sp"></div><div class="tx" id="izLoadTx"></div></div>';
      document.body.appendChild(el);
      txt = el.querySelector('#izLoadTx');
    }
    function defMsg() { try { return (localStorage.getItem('lang') === 'en') ? 'Please wait…' : '処理中…'; } catch (e) { return '処理中…'; } }
    return {
      show: function (msg) {
        count++; ensure(); if (!el) return;
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        if (txt) txt.textContent = msg || defMsg();
        el.style.display = 'flex'; void el.offsetWidth; el.classList.add('on');
      },
      hide: function () {
        count = Math.max(0, count - 1); if (count > 0 || !el) return;
        el.classList.remove('on');
        hideTimer = setTimeout(function () { if (count === 0 && el) el.style.display = 'none'; }, 160);
      }
    };
  })();
  API.loading = _load; // 手動利用も可（API.loading.show('...') / .hide()）

  // 定期ポーリング等、待機表示を出さない（点滅防止）アクション
  const BG_ACTIONS = { checkToken: 1, getOrders: 1, checkoutStatus: 1, bootstrap: 1, getSettings: 1, getStaffCalls: 1 };
  const BG_RPC = { getPrintQueue: 1, getPrintQueueCounts: 1, getSettings: 1 };

  // ---- 低レベル POST ----
  API.post = async function (action, payload) {
    payload = payload || {};
    const silent = !!payload.__silent || BG_ACTIONS[action] || (action === 'rpc' && BG_RPC[payload.fn]);
    const send = Object.assign({}, payload); delete send.__silent; delete send.__msg;
    const body = JSON.stringify(Object.assign({ action: action }, send));
    if (!silent) _load.show(payload.__msg);
    try {
      const res = await fetch(CFG.API_URL + '?api=1', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      });
      const json = await res.json();
      if (!json.ok) { const e = new Error(json.error || 'api_error'); e.__server = true; throw e; }
      return json;
    } finally {
      if (!silent) _load.hide();
    }
  };

  // ---- IndexedDB（送信待ち注文の保管） ----
  function openDB() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open('pos-pwa', 1);
      r.onupgradeneeded = function () {
        const db = r.result;
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id' });
        }
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  function tx(store, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
    }));
  }
  API.queuePut = (rec) => tx('outbox', 'readwrite', (s) => s.put(rec));
  API.queueDel = (id) => tx('outbox', 'readwrite', (s) => s.delete(id));
  API.queueAll = () => tx('outbox', 'readonly', (s) => {
    return new Promise((resolve) => {
      const items = [];
      s.openCursor().onsuccess = (e) => {
        const cur = e.target.result;
        if (cur) { items.push(cur.value); cur.continue(); }
        else resolve(items);
      };
    });
  });

  // ---- 注文送信（オフライン耐性つき） ----
  // 返り値: 'sent'（サーバ確定） / 'queued'（オフライン保留）
  // clientId でサーバ側が冪等化するため、再送しても二重登録されない。
  API.submitOrder = async function (order) {
    if (!order.clientId) order.clientId = 'c-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    // オフラインが自明なら即キュー（無駄な待ち時間を回避）
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      await API.queuePut({ id: order.clientId, order: order, ts: Date.now(), attempts: 0 });
      return 'queued';
    }
    try {
      const res = await API.post('submitOrder', { order: order });
      const d = res && res.data;
      if (d && d !== 'OK') { return 'rejected:' + d; }   // サーバが拒否（例: Invalid table）。キューせず即エラー通知
      return 'sent';
    } catch (err) {
      await API.queuePut({ id: order.clientId, order: order, ts: Date.now(), attempts: 0 });
      return 'queued';
    }
  };

  // ---- 送信待ちの再送（online復帰・定期・起動時に呼ぶ） ----
  // ネットワーク不通なら中断して次の機会に。サーバ到達済みの業務エラーは
  // 再送しても無駄なので試行上限で破棄し、キューの目詰まりを防ぐ。
  API.flush = async function () {
    const pending = await API.queueAll();
    let sent = 0, dropped = 0;
    for (const rec of pending) {
      try {
        await API.post('submitOrder', { order: rec.order, __silent: true });
        await API.queueDel(rec.id);
        sent++;
      } catch (err) {
        if (err && err.__server) {
          rec.attempts = (rec.attempts || 0) + 1;
          if (rec.attempts >= 5) { await API.queueDel(rec.id); dropped++; }
          else { await API.queuePut(rec); }
          continue; // 次の保留分へ
        }
        break; // ネットワーク不通。次の機会に。
      }
    }
    const remaining = await API.pendingCount();
    return { sent: sent, dropped: dropped, remaining: remaining };
  };

  API.pendingCount = async function () {
    const all = await API.queueAll();
    return all.length;
  };

  window.API = API;

  // ---- テスト環境バッジ（config.jsで TEST_ENV:true のときだけ表示。本番では出ない）----
  if (CFG && CFG.TEST_ENV && typeof document !== 'undefined') {
    var _mkBadge = function () {
      if (document.getElementById('izTestBadge')) return;
      var b = document.createElement('div');
      b.id = 'izTestBadge';
      b.textContent = '🧪 TEST';
      b.style.cssText = 'position:fixed;left:0;bottom:0;z-index:2147483647;background:#b91c1c;color:#fff;font:800 12px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:4px 10px;border-top-right-radius:8px;letter-spacing:1px;pointer-events:none;opacity:.92;';
      (document.body || document.documentElement).appendChild(b);
    };
    if (document.body) _mkBadge(); else document.addEventListener('DOMContentLoaded', _mkBadge);
  }

  // ---- Service Worker 自動更新（更新後に一度だけ自動リロード）----
  // デプロイ後に古いキャッシュのまま動くのを防ぐ。初回制御取得では再読み込みしない。
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      var _hadController = !!navigator.serviceWorker.controller;
      var _reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (_reloading) return; _reloading = true;
        if (_hadController) { try { window.location.reload(); } catch (e) {} }
      });
    } catch (e) {}
  }

  // 入力欄でEnter→そのブロックの主ボタンを実行（フォーム未使用のため共通で補う）。
  // i18n.js を読まないページ（注文/KDS/テイクアウト等）でもここで有効化。二重バインドは防止。
  if (typeof window !== 'undefined' && !window.__izEnterBound) {
    window.__izEnterBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || e.defaultPrevented) return;
      var t = e.target;
      if (!t || t.tagName !== 'INPUT') return;
      var ty = (t.getAttribute('type') || 'text').toLowerCase();
      if (['checkbox','radio','file','button','submit','reset','range','color','date','datetime-local','month','week','time'].indexOf(ty) >= 0) return;
      if (t.hasAttribute('data-noenter')) return;
      var scope = (t.closest && t.closest('.card, .login, form, .sheet, .box, section')) || document.body;
      var btns = scope.querySelectorAll('button'), fb = null, i, b, cls;
      for (i = 0; i < btns.length; i++) {
        b = btns[i];
        if (b.hasAttribute('data-tlang') || b.disabled) continue;
        if (b.offsetParent === null && b.getClientRects().length === 0) continue;
        if (!fb) fb = b;
        cls = ' ' + b.className + ' ';
        if (cls.indexOf(' btn-sec ') < 0 && cls.indexOf(' sec ') < 0 && cls.indexOf(' act-back ') < 0 && cls.indexOf(' close ') < 0) { fb = b; break; }
      }
      if (fb) { e.preventDefault(); fb.click(); }
    }, false);
  }
})();
