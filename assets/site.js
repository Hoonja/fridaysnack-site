// FridaySnack — tiny shared site script. Loaded in <head> (not deferred) so
// the language is set before first paint. Without JS, pages show both
// languages. Page toys live in deferred scripts: /assets/home.js (home) and
// /mocoder/demo.js (Mocoder page).

// ---- App Store links -------------------------------------------------------
// Put the real App Store URL here once the app is live. While a value is '',
// the page keeps its "Coming soon to the App Store" state.
// Every element with data-appstore="<app id>" is upgraded to a real link.
var APP_STORE_URLS = {
  mocoder: '', // e.g. 'https://apps.apple.com/app/id0000000000'
};

(function () {
  var KEY = 'fs-lang';
  var root = document.documentElement;
  root.classList.add('js'); // lets CSS show JS-only bits (bite counter, timer)

  function readSaved() {
    try { return window.localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(lang) {
    try { window.localStorage.setItem(KEY, lang); } catch (e) { /* ignore */ }
  }
  function detect() {
    var saved = readSaved();
    if (saved === 'ko' || saved === 'en') return saved;
    var langs = navigator.languages || [navigator.language || 'en'];
    return String(langs[0] || 'en').toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
  }

  var enTitle = document.title;

  function apply(lang) {
    root.setAttribute('data-lang', lang);
    root.lang = lang;
    var koTitle = root.getAttribute('data-title-ko');
    document.title = lang === 'ko' && koTitle ? koTitle : enTitle;
    var btn = document.querySelector('.lang-toggle');
    if (btn) {
      // The button names the language you switch TO.
      btn.textContent = lang === 'ko' ? 'English' : '한국어';
      btn.setAttribute('lang', lang === 'ko' ? 'en' : 'ko');
      btn.setAttribute('aria-label', lang === 'ko' ? 'Switch to English' : '한국어로 보기');
    }
  }

  apply(detect());

  function upgradeStoreLinks() {
    var els = document.querySelectorAll('[data-appstore]');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var url = APP_STORE_URLS[el.getAttribute('data-appstore')];
      if (!url) continue;
      var a = document.createElement('a');
      a.className = el.className.replace('store-btn--soon', '').trim();
      a.href = url;
      a.innerHTML =
        '<span class="l-en" lang="en">Download on the App Store</span>' +
        '<span class="l-ko" lang="ko">App Store에서 받기</span>';
      el.parentNode.replaceChild(a, el);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    enTitle = enTitle || document.title;
    var btn = document.querySelector('.lang-toggle');
    if (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-lang') === 'ko' ? 'en' : 'ko';
        save(next);
        apply(next);
      });
    }
    apply(root.getAttribute('data-lang') || 'en');
    upgradeStoreLinks();
  });
})();
