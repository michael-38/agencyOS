// DOM probe executed inside Firecrawl's browser via the executeJavascript action.
// Must be a single expression (an IIFE) that returns a JSON string. Wrapped in try/catch so a
// failure never breaks the scrape. __PROBE_VERSION__ is replaced at load time.
(() => {
  try {
    var vw = window.innerWidth, vh = window.innerHeight, dpr = window.devicePixelRatio || 1;
    // Firecrawl captures full-page shots in a very tall viewport, so the fold is the configured height, not innerHeight.
    var fold = __FOLD_HEIGHT__;
    var sy = window.scrollY || 0;
    var top = function (el) { var r = el.getBoundingClientRect(); return Math.round(r.top + sy); };
    var visible = function (el) {
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
    };
    var text = function (el) { return (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120); };
    var inHeader = function (el) { return !!el.closest('header, [role="banner"]'); };
    var all = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

    var telLinks = all('a[href^="tel:"]').filter(visible).map(function (a) {
      return { href: a.getAttribute('href'), text: text(a), top: top(a), inHeader: inHeader(a) };
    });
    var ctas = all('a, button, input[type="submit"], [role="button"]').filter(visible).map(function (el) {
      return { tag: el.tagName.toLowerCase(), text: text(el) || (el.value || ''), href: el.getAttribute('href') || null, top: top(el) };
    }).filter(function (c) { return c.text; }).slice(0, 200);
    var forms = all('form').map(function (f) {
      var fields = f.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select');
      var isSearch = (f.getAttribute('role') || '').toLowerCase() === 'search' || !!f.querySelector('input[type=search]');
      return { action: f.getAttribute('action'), fieldCount: fields.length, hasSubmit: !!f.querySelector('button, input[type=submit]'), top: top(f), isSearch: isSearch };
    });
    var imagesAboveFold = all('img, [style*="background-image"]').filter(visible).map(function (el) {
      var r = el.getBoundingClientRect();
      var src = el.currentSrc || el.getAttribute('src') || (getComputedStyle(el).backgroundImage || '');
      return { src: String(src).slice(0, 200), alt: el.getAttribute('alt'), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + sy) };
    }).filter(function (i) { return i.top < fold; }).slice(0, 50);
    var fixedBottomBars = all('body *').slice(0, 4000).filter(function (el) {
      var cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
      var r = el.getBoundingClientRect();
      return r.height > 30 && r.width > vw * 0.5 && r.bottom >= vh - 4 && r.top > vh * 0.5;
    }).slice(0, 5).map(function (el) {
      return { text: text(el), hasTel: !!el.querySelector('a[href^="tel:"]'), hasCta: !!el.querySelector('a, button') };
    });
    var heads = function (sel) { return all(sel).map(text).filter(Boolean).slice(0, 40); };
    var navText = all('nav a, header a, [role="navigation"] a').map(text).filter(Boolean).slice(0, 60);

    return JSON.stringify({
      probe_version: __PROBE_VERSION__,
      viewport: { width: vw, height: vh },
      fold: fold,
      dpr: dpr,
      scrollHeight: document.documentElement.scrollHeight,
      telLinks: telLinks,
      ctas: ctas,
      forms: forms,
      imagesAboveFold: imagesAboveFold,
      fixedBottomBars: fixedBottomBars,
      h1: heads('h1'),
      h2: heads('h2'),
      navText: navText,
    });
  } catch (e) {
    return JSON.stringify({ probe_version: __PROBE_VERSION__, error: String((e && e.message) || e) });
  }
})()
