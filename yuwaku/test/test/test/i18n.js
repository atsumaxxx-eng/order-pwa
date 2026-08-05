// 共通 i18n 部品：全ページ共通のEN/JP切替。
// 使い方:
//   <script src="./i18n.js"></script> を読み込み、
//   ヘッダに <button data-tlang onclick="I18n.toggle()">EN</button> を置く。
//   翻訳したい要素に data-t="key"（テキスト）/ data-tph="key"（placeholder）を付ける。
//   I18n.init({ ja:{key:'日本語'}, en:{key:'English'} }, function(lang){ /* 動的部分を再描画 */ });
//   動的文字列は I18n.t('key') で取得。言語は localStorage.lang に保存（他ページと共通）。
(function () {
  var DICT = {}, cb = null;
  function lang() { try { return localStorage.getItem('lang') === 'en' ? 'en' : 'ja'; } catch (e) { return 'ja'; } }
  function apply() {
    var l = lang(), d = DICT[l] || {};
    document.querySelectorAll('[data-t]').forEach(function (el) { var k = el.getAttribute('data-t'); if (d[k] != null) el.textContent = d[k]; });
    document.querySelectorAll('[data-tph]').forEach(function (el) { var k = el.getAttribute('data-tph'); if (d[k] != null) el.setAttribute('placeholder', d[k]); });
    document.querySelectorAll('[data-tlang]').forEach(function (el) { el.textContent = (l === 'ja' ? 'EN' : '日本語'); });
    document.documentElement.lang = l;
    if (cb) try { cb(l); } catch (e) {}
  }
  window.I18n = {
    init: function (dict, onChange) { DICT = dict || {}; cb = onChange || null; apply(); },
    toggle: function () { try { localStorage.setItem('lang', lang() === 'ja' ? 'en' : 'ja'); } catch (e) {} apply(); },
    lang: lang,
    t: function (k) { var d = DICT[lang()] || {}; return d[k] != null ? d[k] : k; }
  };

  // 入力欄でEnter→そのブロックの主ボタンを実行（フォーム未使用のため共通で補う）。
  // api.js と i18n.js の両方に同じ処理を置くが、フラグで二重バインドを防止。
  bindEnter();
  function bindEnter() {
    if (typeof window === 'undefined' || window.__izEnterBound) return;
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
