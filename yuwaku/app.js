// 注文アプリ本体（PWA・オフライン耐性つき）
(function () {
  'use strict';

  var i18n = {
    en: { order:'Order', total:'Total', all:'All', send:'Order', empty:'Please select items',
      confirm:'Send this order?', okTitle:'Order sent', okMsg:'Your order was received.',
      queuedTitle:'Saved (offline)', queuedMsg:'No connection now. It will be sent automatically when back online.',
      errTitle:'Error', ok:'OK', table:'Table', counter:'Counter', noTable:'No table number in the QR link.',
      offline:'Offline — orders will be sent automatically when back online', lang:'JP',
      svc:'Service', tax:'Tax',
      tblTitle:'Select your table', tblMsg:'Scan the QR at your table, or pick your table number.', tblGo:'Start',
      payTitle:'How would you like to pay?', payLater:'👤 Pay at counter', payCard:'💳 Card', payProcessing:'Preparing…', payScan:'Scan the QR to pay', payNotYet:'Payment not confirmed yet.', payNoKey:'Online payment is not set up.', paidTitle:'Paid & ordered', paidMsg:'Payment received. Your order was sent.', cancel:'Cancel',
      memberTitle:'Member (points)', memberSub:'Enter your phone to earn / use points.', check:'Check', usePoints:'Use points', points:'pts', discountLbl:'Points', earned:'pts earned',
      couponTitle:'Coupon / Voucher', couponSub:'Enter a code to get a discount.', apply:'Apply', remove:'Remove coupon', close:'Close', couponLbl:'Coupon',
      cpApplied:'Applied', cpEmpty:'Enter a code', cpNotfound:'Code not found', cpInactive:'Not available', cpExpired:'Expired', cpLimit:'Usage limit reached', cpMin:'Minimum order not met', cpInvalid:'Invalid code',
      optChoose:'Choose options', optAdd:'Add to order', optQty:'Qty', optRequired:'required', optPick:'Please choose the required options.', optInCart:'In your order', optClose:'Close',
      soldOut:'Sold out', notNow:'Not available now', allergen:'Allergens',
      callTitle:'Staff called', callMsg:'A staff member will be with you shortly.', billTitle:'Bill requested', billMsg:'A staff member will bring your bill shortly.',
      fbTitle:'How was it?', fbSub:'Your rating helps us improve.', fbComment:'Comment (optional)', fbSend:'Send', fbPick:'Please tap the stars to rate.', fbThanks:'Thank you!', fbThanksMsg:'Thanks for your feedback.' },
    ja: { order:'ご注文', total:'合計', all:'すべて', send:'注文する', empty:'商品を選んでください',
      confirm:'この内容で注文しますか？', okTitle:'注文を送信しました', okMsg:'ご注文を承りました。',
      queuedTitle:'保留しました（オフライン）', queuedMsg:'今は接続がありません。オンライン復帰時に自動送信します。',
      errTitle:'エラー', ok:'OK', table:'卓', counter:'カウンター', noTable:'QRリンクに卓番号がありません。',
      offline:'オフライン — 復帰時に自動送信します', lang:'EN',
      svc:'サービス料', tax:'税',
      tblTitle:'テーブルを選択', tblMsg:'QRを読み取るか、テーブル番号を選んでください。', tblGo:'開始',
      payTitle:'お支払い方法', payLater:'👤 店員に支払う（後会計）', payCard:'💳 カード', payProcessing:'準備中…', payScan:'QRを読み取ってお支払い', payNotYet:'まだ支払いが確認できません。', payNoKey:'オンライン決済は未設定です。', paidTitle:'支払い完了・注文しました', paidMsg:'お支払いを受け付けました。注文を送信しました。', cancel:'キャンセル',
      memberTitle:'会員（ポイント）', memberSub:'電話番号を入力するとポイントが貯まる/使えます。', check:'確認', usePoints:'ポイントを使う', points:'pt', discountLbl:'ポイント割引', earned:'pt 獲得',
      couponTitle:'クーポン／バウチャー', couponSub:'コードを入力すると割引されます。', apply:'適用', remove:'クーポンを外す', close:'閉じる', couponLbl:'クーポン',
      cpApplied:'適用しました', cpEmpty:'コードを入力してください', cpNotfound:'コードが見つかりません', cpInactive:'利用できません', cpExpired:'期限切れ', cpLimit:'利用上限に達しています', cpMin:'最低注文額に達していません', cpInvalid:'無効なコード',
      optChoose:'オプションを選ぶ', optAdd:'注文に追加', optQty:'数量', optRequired:'必須', optPick:'必須オプションを選択してください。', optInCart:'注文内', optClose:'閉じる',
      soldOut:'本日売切', notNow:'提供時間外', allergen:'アレルゲン',
      callTitle:'スタッフを呼びました', callMsg:'まもなくスタッフが伺います。', billTitle:'お会計を依頼しました', billMsg:'まもなくスタッフがお会計に伺います。',
      fbTitle:'ご感想は？', fbSub:'評価は今後の改善に役立ちます。', fbComment:'コメント（任意）', fbSend:'送信', fbPick:'星をタップして評価してください。', fbThanks:'ありがとうございます！', fbThanksMsg:'ご意見ありがとうございました。' }
  };

  var state = {
    lang: 'en', settings: {}, menu: [], cats: [], currentCat: 'all',
    cart: {}, optLines: [], table: '', paymongo: false, member: null, usePoints: false, coupon: null
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

  // ---- オプション ----
  // メニュー行の「オプション」JSONを配列で返す（[{name,type,required,choices:[{label,price}]}]）
  function itemOpts(it) {
    try { var a = JSON.parse(it['オプション'] || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function menuItem(name) {
    for (var i = 0; i < state.menu.length; i++) { if (state.menu[i]['商品名'] === name) return state.menu[i]; }
    return null;
  }
  // ある基本商品のオプション明細合計数量（カード上のバッジ用）
  function optQty(base) {
    var n = 0; state.optLines.forEach(function (l) { if (l.base === base) n += l.qty; }); return n;
  }

  function breakdown() {
    var sub = 0;
    state.menu.forEach(function (it) {
      var q = state.cart[it['商品名']] || 0;
      if (q > 0) sub += (Number(it['価格']) || 0) * q;
    });
    state.optLines.forEach(function (l) { sub += (Number(l.unit) || 0) * (Number(l.qty) || 0); });
    var svcRate = Number(state.settings.serviceRate) || 0;
    var taxRate = Number(state.settings.taxRate) || 0;
    var service = Math.round(sub * (svcRate / 100));
    var tax = Math.round((sub + service) * (taxRate / 100));
    var base = sub + service + tax;
    // クーポン割引（先に適用）
    var couponDiscount = 0;
    if (state.coupon && state.coupon.discount > 0) {
      couponDiscount = state.coupon.type === 'percent'
        ? Math.round(base * (Number(state.coupon.value) || 0) / 100)  // 率は現在の会計額で再計算
        : Math.min(Number(state.coupon.value) || 0, base);
      couponDiscount = Math.max(0, Math.min(couponDiscount, base));
    }
    var afterCoupon = base - couponDiscount;
    // ポイント割引（クーポン後の残額に対して）
    var discount = 0, pointsUsed = 0;
    if (state.usePoints && state.member && state.member.points > 0) {
      var rv = Number(state.settings.loyaltyRedeemValue) || 1;
      discount = Math.min(state.member.points * rv, afterCoupon);
      pointsUsed = Math.round(discount / rv);
    }
    return { sub: sub, service: service, tax: tax, couponDiscount: couponDiscount, discount: discount, pointsUsed: pointsUsed, total: afterCoupon - discount };
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
    $('tableChip').textContent = state.table ? seatLabel(state.table) : (x.table + ' —');
    $('langBtn').textContent = x.lang;
    $('totalLbl').textContent = x.total;
    $('sendLbl').textContent = x.send;
    $('offlineText').textContent = x.offline;
  }

  function renderCats() {
    var x = t();
    var lab = function (c) { return (state.lang === 'en' && state.catLabels && state.catLabels[c]) ? state.catLabels[c] : c; };
    var html = '<div class="cat' + (state.currentCat === 'all' ? ' active' : '') + '" data-cat="all">' + x.all + '</div>';
    state.cats.forEach(function (c) {
      html += '<div class="cat' + (state.currentCat === c ? ' active' : '') + '" data-cat="' + escAttr(c) + '">' + escHtml(lab(c)) + '</div>';
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
      var key = it['商品名'];
      var name = (state.lang === 'en' && it['商品名_EN']) ? it['商品名_EN'] : key;
      var thumb = it.displayUrl
        ? '<img class="thumb" src="' + escAttr(it.displayUrl) + '" loading="lazy" alt="">'
        : '<div class="no-thumb"></div>';
      // タグ（辛さ・アレルゲン）
      var tags = '';
      var sp = Number(it['辛さ']) || 0;
      if (sp > 0) { var pep = ''; for (var s = 0; s < sp; s++) pep += '🌶'; tags += '<span class="tag-spicy">' + pep + '</span>'; }
      if (it['アレルゲン']) tags += '<span class="tag-allg">⚠ ' + escHtml(String(it['アレルゲン'])) + '</span>';
      var tagsHtml = tags ? '<div class="tags">' + tags + '</div>' : '';
      // 可用性（本日売切／提供時間外）
      var unavail = it.soldOut === true || it.available === false;
      var ctrl;
      if (unavail) {
        var badge = it.soldOut ? t().soldOut : t().notNow;
        ctrl = '<div class="qty"><span class="unavail-tag">' + escHtml(badge) + '</span></div>';
      } else if (itemOpts(it).length) {
        // オプション付き：選択ボタン＋合計数量バッジ
        var oq = optQty(key);
        ctrl = '<div class="qty">' +
            '<button class="opt-btn" data-opt="' + escAttr(key) + '">' + escHtml(t().optChoose) +
              (oq > 0 ? ' <span class="opt-badge">' + oq + '</span>' : '') + '</button>' +
          '</div>';
      } else {
        var q = state.cart[key] || 0;
        ctrl = '<div class="qty">' +
            '<button class="minus" data-n="' + escAttr(key) + '" data-d="-1">−</button>' +
            '<span class="n' + (q > 0 ? ' has' : '') + '" id="n-' + cssId(key) + '">' + q + '</span>' +
            '<button class="plus" data-n="' + escAttr(key) + '" data-d="1">＋</button>' +
          '</div>';
      }
      html += '<div class="card' + (unavail ? ' unavail' : '') + '">' + thumb +
        '<div class="body">' +
          '<div class="name">' + escHtml(name) + '</div>' +
          tagsHtml +
          '<div class="price">' + money(it['価格']) + '</div>' +
          ctrl +
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
    Array.prototype.forEach.call($('menuArea').querySelectorAll('button[data-opt]'), function (btn) {
      btn.addEventListener('click', function () { openOpt(btn.getAttribute('data-opt')); });
    });
  }

  // ---- オプション選択モーダル ----
  var optCtx = null; // { base }
  function openOpt(base) {
    var it = menuItem(base); if (!it) return;
    optCtx = { base: base };
    var x = t();
    var en = state.lang === 'en';
    var dispName = (en && it['商品名_EN']) ? it['商品名_EN'] : base;
    $('optName').textContent = dispName;
    var groups = itemOpts(it);
    var html = '';
    // 既にカートに入っている当商品の明細（削除可）
    var lines = state.optLines.filter(function (l) { return l.base === base; });
    if (lines.length) {
      html += '<div class="opt-incart"><div class="opt-incart-h">' + escHtml(x.optInCart) + '</div>';
      state.optLines.forEach(function (l, idx) {
        if (l.base !== base) return;
        html += '<div class="opt-line"><span>' + escHtml(l.label || '—') + ' × ' + l.qty + '　' + money(l.unit) + '</span>' +
          '<button class="opt-rm" data-rm="' + idx + '">×</button></div>';
      });
      html += '</div>';
    }
    // グループ
    groups.forEach(function (g, gi) {
      var multi = g.type === 'multi';
      var req = g.required ? ' <span class="opt-req">(' + escHtml(x.optRequired) + ')</span>' : '';
      html += '<div class="opt-group" data-gi="' + gi + '" data-type="' + (multi ? 'multi' : 'single') + '" data-req="' + (g.required ? 1 : 0) + '">' +
        '<div class="opt-gname">' + escHtml(g.name || '') + req + '</div>';
      (g.choices || []).forEach(function (c, ci) {
        var add = (Number(c.price) || 0);
        var addTxt = add ? '　+' + money(add) : '';
        html += '<label class="opt-choice">' +
          '<input type="' + (multi ? 'checkbox' : 'radio') + '" name="og' + gi + '" value="' + ci + '" data-price="' + add + '">' +
          '<span>' + escHtml(c.label || '') + addTxt + '</span></label>';
      });
      html += '</div>';
    });
    // 数量
    html += '<div class="opt-qtybar"><span>' + escHtml(x.optQty) + '</span>' +
      '<button id="optMinus">−</button><span id="optQtyN">1</span><button id="optPlus">＋</button></div>';
    $('optBody').innerHTML = html;
    $('optAdd').textContent = x.optAdd;
    $('optClose').textContent = x.optClose;
    optCtx.qty = 1;
    // イベント
    Array.prototype.forEach.call($('optBody').querySelectorAll('button[data-rm]'), function (b) {
      b.addEventListener('click', function () {
        var i = Number(b.getAttribute('data-rm')); state.optLines.splice(i, 1);
        renderMenu(); updateTotal(); openOpt(base); // 再描画
      });
    });
    $('optMinus').addEventListener('click', function () { optCtx.qty = Math.max(1, optCtx.qty - 1); $('optQtyN').textContent = optCtx.qty; });
    $('optPlus').addEventListener('click', function () { optCtx.qty = Math.min(99, optCtx.qty + 1); $('optQtyN').textContent = optCtx.qty; });
    $('optModal').classList.add('show');
  }
  function closeOpt() { $('optModal').classList.remove('show'); optCtx = null; }

  function addOptLine() {
    if (!optCtx) return;
    var it = menuItem(optCtx.base); if (!it) return;
    var x = t();
    var groups = itemOpts(it);
    var chosen = [], extra = 0, ok = true;
    Array.prototype.forEach.call($('optBody').querySelectorAll('.opt-group'), function (gd) {
      var req = gd.getAttribute('data-req') === '1';
      var sels = gd.querySelectorAll('input:checked');
      if (req && !sels.length) ok = false;
      Array.prototype.forEach.call(sels, function (inp) {
        var gi = Number(gd.getAttribute('data-gi')), ci = Number(inp.value);
        var c = (groups[gi].choices || [])[ci] || {};
        chosen.push(c.label || '');
        extra += Number(inp.getAttribute('data-price')) || 0;
      });
    });
    if (!ok) { alert(x.optPick); return; }
    var label = chosen.filter(function (s) { return s; }).join(', ');
    var basePrice = Number(it['価格']) || 0;
    var unit = basePrice + extra;
    var sig = optCtx.base + '||' + label;
    var qty = optCtx.qty || 1;
    // 同一構成があれば数量加算
    var merged = false;
    state.optLines.forEach(function (l) { if (l.sig === sig) { l.qty += qty; merged = true; } });
    if (!merged) state.optLines.push({ base: optCtx.base, sig: sig, label: label, unit: unit, qty: qty });
    closeOpt(); renderMenu(); updateTotal();
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
    if (b.couponDiscount > 0) sub += (sub ? '　' : '') + '🎟️ -' + money(b.couponDiscount);
    if (b.discount > 0) sub += (sub ? '　' : '') + '🎁 -' + money(b.discount);
    $('totalSub').textContent = sub;
    $('sendBtn').disabled = b.sub <= 0;
  }

  // ---- 接客（スタッフ呼び出し / お会計） ----
  function requestStaff(type) {
    var x = t();
    if (!state.table) { showErr(x.noTable); return; }
    API.post('callStaff', { table: state.table, type: type }).then(function () {
      showOk(type === 'bill' ? x.billTitle : x.callTitle, type === 'bill' ? x.billMsg : x.callMsg, type === 'bill' ? '🧾' : '🔔');
    }).catch(function (e) { showErr(String(e && e.message || e)); });
  }

  // ---- フィードバック（評価） ----
  var fbRating = 0;
  function openFeedback() {
    var x = t();
    fbRating = 0;
    $('fbTitle').textContent = x.fbTitle;
    $('fbSub').textContent = x.fbSub;
    $('fbComment').value = '';
    $('fbComment').placeholder = x.fbComment;
    $('fbSend').textContent = x.fbSend;
    $('fbClose').textContent = x.close;
    paintStars(0);
    $('fbModal').classList.add('show');
  }
  function paintStars(n) {
    Array.prototype.forEach.call($('fbStars').querySelectorAll('span'), function (s) {
      s.textContent = (Number(s.getAttribute('data-v')) <= n) ? '★' : '☆';
      s.style.color = (Number(s.getAttribute('data-v')) <= n) ? '#f59e0b' : '#cbd5e1';
    });
  }
  function sendFeedback() {
    var x = t();
    if (fbRating < 1) { showErr(x.fbPick); return; }
    var btn = $('fbSend'); btn.disabled = true;
    API.post('submitFeedback', { table: state.table, rating: fbRating, comment: $('fbComment').value }).then(function () {
      $('fbModal').classList.remove('show');
      showOk(x.fbThanks, x.fbThanksMsg, '⭐');
    }).catch(function (e) { showErr(String(e && e.message || e)); })
      .then(function () { btn.disabled = false; });
  }

  // ---- 送信 ----
  var pendingOrder = null, payCheckoutId = null, payPoll = null;

  function send() {
    var x = t();
    if (!state.table) { showErr(x.noTable); return; }
    var items = [];
    Object.keys(state.cart).forEach(function (n) { if (state.cart[n] > 0) items.push({ name: n, count: state.cart[n] }); });
    state.optLines.forEach(function (l) {
      if (l.qty > 0) items.push({ name: l.base + (l.label ? ' (' + l.label + ')' : ''), count: l.qty });
    });
    if (!items.length) { showErr(x.empty); return; }
    var b = breakdown();
    var order = { tableNumber: state.table, items: items, totalPrice: b.total, phone: (state.member ? state.member.phone : ''), pointsUsed: (state.usePoints ? b.pointsUsed : 0),
      coupon: (state.coupon ? state.coupon.code : ''), couponDiscount: (b.couponDiscount || 0) };
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
      state.cart = {}; state.optLines = []; state.coupon = null; updateCouponBtn(); renderMenu(); updateTotal();
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
  // 席ラベルを言語に合わせて表示（値自体は「テーブルN/カウンターM」のまま保存）
  function seatLabel(v) {
    var x = t(), s = String(v);
    var m = s.match(/^テーブル(\d+)$/); if (m) return x.table + ' ' + m[1];
    var c = s.match(/^カウンター(\d+)$/); if (c) return (x.counter || 'Counter') + ' ' + c[1];
    return s;
  }
  function showTablePicker(tables) {
    var sel = $('tableSelect');
    sel.innerHTML = '';
    (tables || []).forEach(function (n) { var o = document.createElement('option'); o.value = n; o.textContent = seatLabel(n); sel.appendChild(o); });
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

  // ---- クーポン / バウチャー ----
  function updateCouponBtn() {
    var el = $('couponBtn');
    if (!el) return;
    if (state.coupon) { el.textContent = '🎟️' + state.coupon.code; el.classList.add('active'); }
    else { el.textContent = '🎟️'; el.classList.remove('active'); }
  }
  function openCoupon() {
    var x = t();
    $('cpTitle').textContent = x.couponTitle;
    $('cpSub').textContent = x.couponSub;
    $('cpApply').textContent = x.apply;
    $('cpRemove').textContent = x.remove;
    $('cpClose').textContent = x.close;
    var msg = $('cpMsg'); msg.textContent = '';
    if (state.coupon) {
      $('cpCode').value = state.coupon.code;
      $('cpRemove').style.display = 'block';
      msg.style.color = 'var(--green)';
      msg.textContent = '✅ ' + x.cpApplied + '（-' + money(breakdown().couponDiscount) + '）';
    } else {
      $('cpRemove').style.display = 'none';
    }
    $('couponModal').classList.add('show');
  }
  function applyCoupon() {
    var x = t();
    var code = ($('cpCode').value || '').trim().toUpperCase();
    var msg = $('cpMsg');
    if (!code) { msg.style.color = 'var(--red)'; msg.textContent = x.cpEmpty; return; }
    var b = breakdown();
    var amount = b.sub + b.service + b.tax; // クーポン適用前の会計額
    $('cpApply').disabled = true;
    API.post('validateCoupon', { code: code, amount: amount }).then(function (r) {
      var d = r.data || {};
      if (!d.ok) {
        state.coupon = null; updateCouponBtn(); updateTotal();
        $('cpRemove').style.display = 'none';
        msg.style.color = 'var(--red)';
        msg.textContent = '⚠️ ' + (x['cp' + (d.reason ? d.reason.charAt(0).toUpperCase() + d.reason.slice(1) : 'Invalid')] || x.cpInvalid) + (d.reason === 'min' && d.min ? '（' + money(d.min) + '）' : '');
        return;
      }
      state.coupon = { code: d.code, type: d.type, value: d.value, discount: d.discount };
      updateCouponBtn(); updateTotal();
      $('cpRemove').style.display = 'block';
      msg.style.color = 'var(--green)';
      msg.textContent = '✅ ' + x.cpApplied + '（-' + money(breakdown().couponDiscount) + '）';
    }).catch(function () {
      msg.style.color = 'var(--red)'; msg.textContent = x.cpInvalid;
    }).then(function () { $('cpApply').disabled = false; });
  }
  function removeCoupon() {
    state.coupon = null; updateCouponBtn(); updateTotal();
    $('cpRemove').style.display = 'none';
    $('cpCode').value = '';
    $('cpMsg').textContent = '';
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

  // ブートストラップ結果（サーバ or キャッシュ）を画面に反映
  function applyBootstrap(r, fromCache) {
    state.settings = r.settings || {};
    state.menu = (r.menu || []);
    state.paymongo = !!r.paymongo;
    if (state.settings.loyaltyEnabled === 'on' || state.settings.loyaltyEnabled === true || state.settings.loyaltyEnabled === 'true') $('memberBtn').style.display = '';
    if (!state.lang) state.lang = state.settings.defaultLang || 'en';
    var cats = [], catLabels = {};
    state.menu.forEach(function (it) { var c = it['カテゴリ']; if (c && cats.indexOf(c) === -1) cats.push(c); if (c && it['カテゴリ_EN'] && !catLabels[c]) catLabels[c] = it['カテゴリ_EN']; });
    state.cats = cats; state.catLabels = catLabels;
    applyAccent();
    var _bid = state.settings.menuTopImageId;
    if (_bid) { var _b = $('shopBanner'); _b.src = 'https://lh3.googleusercontent.com/d/' + _bid; _b.style.display = 'block'; }
    renderTexts(); renderCats(); renderMenu(); updateTotal();
    if (!state.table) showTablePicker(r.tables || []); // QR無しアクセス時はテーブル選択を促す
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
    $('couponBtn').addEventListener('click', openCoupon);
    $('cpApply').addEventListener('click', applyCoupon);
    $('cpRemove').addEventListener('click', removeCoupon);
    $('cpClose').addEventListener('click', function () { $('couponModal').classList.remove('show'); });
    $('memUse').addEventListener('change', function () { state.usePoints = this.checked; updateTotal(); });
    $('memClose').addEventListener('click', function () { $('memberModal').classList.remove('show'); });
    $('optAdd').addEventListener('click', addOptLine);
    $('optClose').addEventListener('click', closeOpt);
    $('callBtn').addEventListener('click', function () { requestStaff('call'); });
    $('billBtn').addEventListener('click', function () { requestStaff('bill'); });
    $('fbBtn').addEventListener('click', openFeedback);
    $('fbSend').addEventListener('click', sendFeedback);
    $('fbClose').addEventListener('click', function () { $('fbModal').classList.remove('show'); });
    Array.prototype.forEach.call($('fbStars').querySelectorAll('span'), function (s) {
      s.addEventListener('click', function () { fbRating = Number(s.getAttribute('data-v')); paintStars(fbRating); });
    });

    window.addEventListener('online', function () { document.body.classList.remove('offline'); API.flush().then(refreshPending); });
    window.addEventListener('offline', function () { document.body.classList.add('offline'); });
    if (!navigator.onLine) document.body.classList.add('offline');
    // 定期再送＋タブ復帰時の再送（online イベントが発火しない環境の保険）
    setInterval(function () { if (navigator.onLine) API.flush().then(refreshPending); }, 20000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && navigator.onLine) API.flush().then(refreshPending); });

    API.post('bootstrap', {}).then(function (r) {
      try { localStorage.setItem('bootCache', JSON.stringify({ settings: r.settings, menu: r.menu, paymongo: r.paymongo, tables: r.tables })); } catch (e) {}
      applyBootstrap(r, false);
      API.flush().then(refreshPending); // オンライン起動時に保留分を流す
    }).catch(function (err) {
      var cached = null;
      try { cached = JSON.parse(localStorage.getItem('bootCache') || 'null'); } catch (e) {}
      if (cached && cached.menu) {
        document.body.classList.add('offline'); // キャッシュ表示中＝実質オフライン
        applyBootstrap(cached, true);            // 保存済みメニューで注文可能（送信はキューへ）
      } else {
        if (!state.lang) state.lang = 'en';
        renderTexts();
        $('menuArea').innerHTML = '<div class="loading" style="color:var(--red)">' + escHtml(t().errTitle + ': ' + (err && err.message || err)) + '</div>';
      }
      refreshPending();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(function () {});
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
