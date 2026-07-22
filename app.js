// 注文アプリ本体（PWA・オフライン耐性つき）
(function () {
  'use strict';

  var i18n = {
    en: { order:'Order', total:'Total', all:'All', send:'Order', empty:'Please select items',
      confirm:'Send this order?', okTitle:'Order sent', okMsg:'Your order was received.',
      queuedTitle:'Saved (offline)', queuedMsg:'No connection now. It will be sent automatically when back online.',
      errTitle:'Error', ok:'OK', table:'Table', noTable:'No table number in the QR link.',
      offline:'Offline — orders will be sent automatically when back online', lang:'JP',
      svc:'Service', tax:'Tax',
      tblTitle:'Select your table', tblMsg:'Scan the QR at your table, or pick your table number.', tblGo:'Start' },
    ja: { order:'ご注文', total:'合計', all:'すべて', send:'注文する', empty:'商品を選んでください',
      confirm:'この内容で注文しますか？', okTitle:'注文を送信しました', okMsg:'ご注文を承りました。',
      queuedTitle:'保留しました（オフライン）', queuedMsg:'今は接続がありません。オンライン復帰時に自動送信します。',
      errTitle:'エラー', ok:'OK', table:'卓', noTable:'QRリンクに卓番号がありません。',
      offline:'オフライン — 復帰時に自動送信します', lang:'EN',
      svc:'サービス料', tax:'税',
      tblTitle:'テーブルを選択', tblMsg:'QRを読み取るか、テーブル番号を選んでください。', tblGo:'開始' }
  };

  var state = {
    lang: 'en', settings: {}, menu: [], cats: [], currentCat: 'all',
    cart: {}, table: ''
  };

  function $(id) { return document.getElementById(id); }
  function t() { return i18n[state.lang]; }

  function qs(name) {
    var m = new RegExp('[?&]' + name + '=([^&]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : '';
  }

  function money(v) {
    var sym = state.settings.currencySymbol || '₱';
    return sym + (Number(v) || 0).toLocaleString();
  }

  function breakdown() {
    var sub = 0;
    state.menu.forEach(function (it) {
      var q = state.cart[it['商品名']] || 0;
      if (q > 0) sub += (Number(it['価格']) || 0) * q;
    });
    var svcRate = Number(state.settings.serviceRate) || 0;
    var taxRate = Number(state.settings.taxRate) || 0;
    var service = Math.round(sub * (svcRate / 100));
    var tax = Math.round((sub + service) * (taxRate / 100));
    return { sub: sub, service: service, tax: tax, total: sub + service + tax };
  }

  // ---- 描画 ----
  function applyAccent() {
    var hex = state.settings.accentColor || '';
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      document.documentElement.style.setProperty('--accent', hex);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', hex);
    }
  }

  function renderTexts() {
    var x = t();
    $('shopName').textContent = state.settings.shopName || x.order;
    $('tableChip').textContent = x.table + ' ' + (state.table || '—');
    $('langBtn').textContent = x.lang;
    $('totalLbl').textContent = x.total;
    $('sendLbl').textContent = x.send;
    $('offlineText').textContent = x.offline;
  }

  function renderCats() {
    var x = t();
    var html = '<div class="cat' + (state.currentCat === 'all' ? ' active' : '') + '" data-cat="all">' + x.all + '</div>';
    state.cats.forEach(function (c) {
      html += '<div class="cat' + (state.currentCat === c ? ' active' : '') + '" data-cat="' + escAttr(c) + '">' + escHtml(c) + '</div>';
    });
    $('cats').innerHTML = html;
    Array.prototype.forEach.call($('cats').querySelectorAll('.cat'), function (el) {
      el.addEventListener('click', function () { state.currentCat = el.getAttribute('data-cat'); renderCats(); renderMenu(); });
    });
  }

  function renderMenu() {
    var items = state.currentCat === 'all'
      ? state.menu
      : state.menu.filter(function (it) { return it['カテゴリ'] === state.currentCat; });
    if (!items.length) { $('menuArea').innerHTML = '<div class="loading">—</div>'; return; }
    var html = '<div class="grid">';
    items.forEach(function (it) {
      var name = it['商品名'];
      var q = state.cart[name] || 0;
      var thumb = it.displayUrl
        ? '<img class="thumb" src="' + escAttr(it.displayUrl) + '" loading="lazy" alt="">'
        : '<div class="no-thumb"></div>';
      html += '<div class="card">' + thumb +
        '<div class="body">' +
          '<div class="name">' + escHtml(name) + '</div>' +
          '<div class="price">' + money(it['価格']) + '</div>' +
          '<div class="qty">' +
            '<button class="minus" data-n="' + escAttr(name) + '" data-d="-1">−</button>' +
            '<span class="n' + (q > 0 ? ' has' : '') + '" id="n-' + cssId(name) + '">' + q + '</span>' +
            '<button class="plus" data-n="' + escAttr(name) + '" data-d="1">＋</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    $('menuArea').innerHTML = html;
    Array.prototype.forEach.call($('menuArea').querySelectorAll('button[data-n]'), function (btn) {
      btn.addEventListener('click', function () {
        changeQty(btn.getAttribute('data-n'), Number(btn.getAttribute('data-d')));
      });
    });
  }

  function changeQty(name, delta) {
    state.cart[name] = Math.max(0, (state.cart[name] || 0) + delta);
    var el = $('n-' + cssId(name));
    if (el) { el.textContent = state.cart[name]; el.className = 'n' + (state.cart[name] > 0 ? ' has' : ''); }
    updateTotal();
  }

  function updateTotal() {
    var b = breakdown();
    $('totalVal').textContent = money(b.total);
    var x = t();
    var sub = '';
    if (b.service > 0) sub += x.svc + ' ' + money(b.service) + '　';
    if (b.tax > 0) sub += x.tax + ' ' + money(b.tax);
    $('totalSub').textContent = sub;
    $('sendBtn').disabled = b.total <= 0;
  }

  // ---- 送信 ----
  function send() {
    var x = t();
    if (!state.table) { showErr(x.noTable); return; }
    var items = [];
    Object.keys(state.cart).forEach(function (n) { if (state.cart[n] > 0) items.push({ name: n, count: state.cart[n] }); });
    if (!items.length) { showErr(x.empty); return; }
    if (!confirm(x.confirm)) return;
    var b = breakdown();
    var btn = $('sendBtn'); btn.disabled = true;
    var order = { tableNumber: state.table, items: items, totalPrice: b.total };
    API.submitOrder(order).then(function (result) {
      state.cart = {}; renderMenu(); updateTotal();
      showOk(result === 'queued' ? x.queuedTitle : x.okTitle, result === 'queued' ? x.queuedMsg : x.okMsg, result === 'queued' ? '📥' : '✅');
      refreshPending();
    }).catch(function (err) {
      showErr(String(err && err.message || err));
    }).then(function () { btn.disabled = false; });
  }

  function showOk(title, msg, emoji) { $('okEmoji').textContent = emoji || '✅'; $('okTitle').textContent = title; $('okMsg').textContent = msg; $('okOverlay').classList.add('show'); }
  function showErr(msg) { $('errTitle').textContent = t().errTitle; $('errMsg').textContent = msg; $('errOverlay').classList.add('show'); }

  function refreshPending() {
    API.pendingCount().then(function (n) {
      var pill = $('pendingPill');
      if (n > 0) { pill.textContent = n; pill.classList.add('show'); } else { pill.classList.remove('show'); }
    }).catch(function () {});
  }

  // テーブル未指定（QR無しアクセス）時に手動選択を促す
  function showTablePicker(tables) {
    var sel = $('tableSelect');
    sel.innerHTML = '';
    (tables || []).forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = 'Table ' + n; sel.appendChild(o); });
    var x = t();
    $('tblTitle').textContent = x.tblTitle;
    $('tblMsg').textContent = x.tblMsg;
    $('tblGo').textContent = x.tblGo;
    $('tableOverlay').classList.add('show');
    $('tblGo').onclick = function () {
      var v = sel.value; if (!v) return;
      state.table = String(v);
      $('tableOverlay').classList.remove('show');
      renderTexts();
    };
  }

  // ---- utils ----
  function escHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function escAttr(s) { return escHtml(s); }
  function cssId(s) { return String(s).replace(/[^a-zA-Z0-9]/g, function (c) { return '_' + c.charCodeAt(0); }); }

  function setLang(lang) {
    state.lang = lang;
    try { localStorage.setItem('lang', lang); } catch (e) {}
    renderTexts(); renderCats(); renderMenu(); updateTotal();
  }

  // ---- 起動 ----
  function boot() {
    state.table = qs('table');
    state.lang = (localStorage.getItem('lang') || '').match(/^(ja|en)$/) ? localStorage.getItem('lang') : '';

    $('langBtn').addEventListener('click', function () { setLang(state.lang === 'ja' ? 'en' : 'ja'); });
    $('sendBtn').addEventListener('click', send);
    $('okBtn').addEventListener('click', function () { $('okOverlay').classList.remove('show'); });
    $('errBtn').addEventListener('click', function () { $('errOverlay').classList.remove('show'); });

    window.addEventListener('online', function () { document.body.classList.remove('offline'); API.flush().then(refreshPending); });
    window.addEventListener('offline', function () { document.body.classList.add('offline'); });
    if (!navigator.onLine) document.body.classList.add('offline');

    API.post('bootstrap', {}).then(function (r) {
      state.settings = r.settings || {};
      state.menu = (r.menu || []);
      if (!state.lang) state.lang = state.settings.defaultLang || 'en';
      var cats = [];
      state.menu.forEach(function (it) { var c = it['カテゴリ']; if (c && cats.indexOf(c) === -1) cats.push(c); });
      state.cats = cats;
      applyAccent();
      var _bid = state.settings.menuTopImageId;
      if (_bid) { var _b = $('shopBanner'); _b.src = 'https://lh3.googleusercontent.com/d/' + _bid; _b.style.display = 'block'; }
      renderTexts(); renderCats(); renderMenu(); updateTotal();
      if (!state.table) showTablePicker(r.tables || []); // QR無しアクセス時はテーブル選択を促す
      // オンライン起動時に保留分を流す
      API.flush().then(refreshPending);
    }).catch(function (err) {
      if (!state.lang) state.lang = 'en';
      renderTexts();
      $('menuArea').innerHTML = '<div class="loading" style="color:var(--red)">' + escHtml(t().errTitle + ': ' + (err && err.message || err)) + '</div>';
      refreshPending();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
