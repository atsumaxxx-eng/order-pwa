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
      tblTitle:'Select your table', tblMsg:'Scan the QR at your table, or pick your table number.', tblGo:'Start',
      payTitle:'How would you like to pay?', payLater:'👤 Pay at counter', payCard:'💳 Card', payProcessing:'Preparing…', payScan:'Scan the QR to pay', payNotYet:'Payment not confirmed yet.', payNoKey:'Online payment is not set up.', paidTitle:'Paid & ordered', paidMsg:'Payment received. Your order was sent.', cancel:'Cancel',
      memberTitle:'Member (points)', memberSub:'Enter your phone to earn / use points.', check:'Check', usePoints:'Use points', points:'pts', discountLbl:'Points', earned:'pts earned' },
    ja: { order:'ご注文', total:'合計', all:'すべて', send:'注文する', empty:'商品を選んでください',
      confirm:'この内容で注文しますか？', okTitle:'注文を送信しました', okMsg:'ご注文を承りました。',
      queuedTitle:'保留しました（オフライン）', queuedMsg:'今は接続がありません。オンライン復帰時に自動送信します。',
      errTitle:'エラー', ok:'OK', table:'卓', noTable:'QRリンクに卓番号がありません。',
      offline:'オフライン — 復帰時に自動送信します', lang:'EN',
      svc:'サービス料', tax:'税',
      tblTitle:'テーブルを選択', tblMsg:'QRを読み取るか、テーブル番号を選んでください。', tblGo:'開始',
      payTitle:'お支払い方法', payLater:'👤 店員に支払う（後会計）', payCard:'💳 カード', payProcessing:'準備中…', payScan:'QRを読み取ってお支払い', payNotYet:'まだ支払いが確認できません。', payNoKey:'オンライン決済は未設定です。', paidTitle:'支払い完了・注文しました', paidMsg:'お支払いを受け付けました。注文を送信しました。', cancel:'キャンセル',
      memberTitle:'会員（ポイント）', memberSub:'電話番号を入力するとポイントが貯まる/使えます。', check:'確認', usePoints:'ポイントを使う', points:'pt', discountLbl:'ポイント割引', earned:'pt 獲得' }
  };

  var state = {
    lang: 'en', settings: {}, menu: [], cats: [], currentCat: 'all',
    cart: {}, table: '', paymongo: false, member: null, usePoints: false
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
    var base = sub + service + tax;
    var discount = 0, pointsUsed = 0;
    if (state.usePoints && state.member && state.member.points > 0) {
      var rv = Number(state.settings.loyaltyRedeemValue) || 1;
      discount = Math.min(state.member.points * rv, base);
      pointsUsed = Math.round(discount / rv);
    }
    return { sub: sub, service: service, tax: tax, discount: discount, pointsUsed: pointsUsed, total: base - discount };
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
    if (b.discount > 0) sub += (sub ? '　' : '') + '🎁 -' + money(b.discount);
    $('totalSub').textContent = sub;
    $('sendBtn').disabled = b.sub <= 0;
  }

  // ---- 送信 ----
  var pendingOrder = null, payCheckoutId = null, payPoll = null;

  function send() {
    var x = t();
    if (!state.table) { showErr(x.noTable); return; }
    var items = [];
    Object.keys(state.cart).forEach(function (n) { if (state.cart[n] > 0) items.push({ name: n, count: state.cart[n] }); });
    if (!items.length) { showErr(x.empty); return; }
    var b = breakdown();
    var order = { tableNumber: state.table, items: items, totalPrice: b.total, phone: (state.member ? state.member.phone : ''), pointsUsed: (state.usePoints ? b.pointsUsed : 0) };
    if (state.paymongo) { pendingOrder = order; openPayChoice(); }        // セルフ決済あり→会計方法を選択
    else { if (!confirm(x.confirm)) return; doSubmit(order, false); }     // 後会計のみ
  }

  function doSubmit(order, paid) {
    if (!order) return;
    var x = t();
    order.paid = !!paid;
    var btn = $('sendBtn'); btn.disabled = true;
    API.submitOrder(order).then(function (result) {
      var earnedTxt = '';
      if (order.phone) {
        var rate = Number(state.settings.loyaltyEarnRate) || 20;
        var earned = Math.floor((Number(order.totalPrice) || 0) / rate);
        if (state.member) state.member.points = Math.max(0, state.member.points - (order.pointsUsed || 0) + earned);
        state.usePoints = false;
        if (earned > 0) earnedTxt = '　🎁+' + earned + x.points;
      }
      state.cart = {}; renderMenu(); updateTotal();
      var title = result === 'queued' ? x.queuedTitle : (paid ? x.paidTitle : x.okTitle);
      var msg   = (result === 'queued' ? x.queuedMsg   : (paid ? x.paidMsg   : x.okMsg)) + earnedTxt;
      showOk(title, msg, result === 'queued' ? '📥' : (paid ? '💳' : '✅'));
      refreshPending();
    }).catch(function (err) { showErr(String(err && err.message || err)); })
      .then(function () { btn.disabled = false; });
  }

  // ---- セルフ決済（PayMongo） ----
  function openPayChoice() {
    var x = t();
    $('pcTitle').textContent = x.payTitle;
    $('pcSub').textContent = money(breakdown().total);
    $('pcLater').textContent = x.payLater;
    $('pcCard').textContent = x.payCard;
    $('pcCancel').textContent = x.cancel;
    $('payChoice').classList.add('show');
  }
  function closePayChoice() { $('payChoice').classList.remove('show'); }
  function closePayModal() { stopPoll(); $('payModal').classList.remove('show'); }
  function stopPoll() { if (payPoll) { clearInterval(payPoll); payPoll = null; } }

  function startPay(method) {
    closePayChoice();
    var x = t();
    if (!pendingOrder) return;
    var amt = pendingOrder.totalPrice;
    $('pmTitle').textContent = x.payProcessing;
    $('pmAmount').textContent = money(amt);
    $('pmStatus').textContent = '';
    $('pmQr').style.display = 'none';
    $('payModal').classList.add('show');
    API.post('createCheckout', { amount: amt, desc: 'Table ' + pendingOrder.tableNumber, method: method }).then(function (r) {
      var d = r.data || {};
      if (d.error) { closePayModal(); showErr(d.error === 'no_api_key' ? x.payNoKey : d.error); return; }
      payCheckoutId = d.checkoutId;
      $('pmQr').src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(d.checkoutUrl);
      $('pmQr').style.display = 'block';
      $('pmOpen').href = d.checkoutUrl;
      $('pmTitle').textContent = x.payScan;
      startPoll();
    }).catch(function (e) { closePayModal(); showErr(String(e.message || e)); });
  }
  function startPoll() { stopPoll(); payPoll = setInterval(checkPay, 5000); }
  function checkPay() {
    if (!payCheckoutId) return;
    var x = t();
    API.post('checkoutStatus', { checkoutId: payCheckoutId }).then(function (r) {
      var d = r.data || {};
      if (d.paymentStatus === 'paid') { stopPoll(); closePayModal(); var o = pendingOrder; pendingOrder = null; payCheckoutId = null; doSubmit(o, true); }
      else { $('pmStatus').textContent = x.payNotYet; $('pmStatus').style.color = '#b45309'; }
    }).catch(function () {});
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

  // ---- 会員（ロイヤリティ） ----
  function openMember() {
    var x = t();
    $('memTitle').textContent = x.memberTitle;
    $('memSub').textContent = x.memberSub;
    $('memLookup').textContent = x.check;
    $('memUseLabel').textContent = x.usePoints;
    $('memClose').textContent = (state.lang === 'ja' ? '閉じる' : 'Close');
    if (state.member) { $('memPhone').value = state.member.phone; showMemberInfo(); } else { $('memInfo').style.display = 'none'; }
    $('memberModal').classList.add('show');
  }
  function showMemberInfo() {
    if (!state.member) { $('memInfo').style.display = 'none'; return; }
    var x = t();
    $('memName').textContent = state.member.name || '';
    $('memPoints').textContent = state.member.points + ' ' + x.points;
    $('memUse').checked = !!state.usePoints;
    $('memInfo').style.display = 'block';
  }
  function lookupMember() {
    var phone = $('memPhone').value.trim();
    if (!phone) return;
    $('memLookup').disabled = true;
    API.post('loyaltyLookup', { phone: phone }).then(function (r) {
      var m = r.data;
      state.member = m || { phone: phone.replace(/[^0-9]/g, ''), name: '', points: 0, visits: 0 };
      showMemberInfo();
    }).catch(function () {}).then(function () { $('memLookup').disabled = false; });
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
    $('pcLater').addEventListener('click', function () { closePayChoice(); var o = pendingOrder; pendingOrder = null; doSubmit(o, false); });
    $('pcGcash').addEventListener('click', function () { startPay('gcash'); });
    $('pcCard').addEventListener('click', function () { startPay('card'); });
    $('pcCancel').addEventListener('click', function () { closePayChoice(); pendingOrder = null; });
    $('pmCheck').addEventListener('click', checkPay);
    $('pmCancel').addEventListener('click', function () { closePayModal(); pendingOrder = null; payCheckoutId = null; });
    $('memberBtn').addEventListener('click', openMember);
    $('memLookup').addEventListener('click', lookupMember);
    $('memUse').addEventListener('change', function () { state.usePoints = this.checked; updateTotal(); });
    $('memClose').addEventListener('click', function () { $('memberModal').classList.remove('show'); });

    window.addEventListener('online', function () { document.body.classList.remove('offline'); API.flush().then(refreshPending); });
    window.addEventListener('offline', function () { document.body.classList.add('offline'); });
    if (!navigator.onLine) document.body.classList.add('offline');

    API.post('bootstrap', {}).then(function (r) {
      state.settings = r.settings || {};
      state.menu = (r.menu || []);
      state.paymongo = !!r.paymongo;
      if (state.settings.loyaltyEnabled === 'on' || state.settings.loyaltyEnabled === true || state.settings.loyaltyEnabled === 'true') $('memberBtn').style.display = '';
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
