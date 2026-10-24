/*!
 * Mission Metrics Design OS — /tweak  (v1)
 *
 * Drop into any Mission Metrics site:
 *   <script src="/tweak.js" data-site="Client Site Name"
 *           data-bake-url="https://<library>/api/bake" defer></script>
 * or set window.MMTweakConfig = { site, bakeUrl } before it runs.
 *
 * It does nothing unless the address asks for it:
 *   /tweak, /<page>/tweak, ?tweak, ?tweak=1, #tweak   (or window.MMTweak.open())
 *
 * The owner adjusts the live page (brand settings, words, section order, motion),
 * then presses Bake: the exact changes go to the Design Studio as JSON so a
 * developer can bake them into the code. Nothing is sent until Send is pressed.
 *
 * Plain ES2018, no dependencies, no build step. Every entry point is wrapped so
 * the host page can never break because of this file.
 */
(function () {
  'use strict';
  if (window.MMTweak && window.MMTweak.__loaded) return;

  var SCRIPT = document.currentScript || document.querySelector('script[src*="tweak.js"]');
  var DEFAULT_BAKE = 'https://mission-metrics-design-library.vercel.app/api/bake';
  var HOST_ID = 'mm-tweak-host';
  var KEY_STORE = 'mmtweak:bake-key';
  var TAB_STORE = 'mmtweak:tab';

  // ---------------------------------------------------------------- small helpers
  function safe(fn) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) { try { console.warn('[tweak]', e); } catch (_) {} }
    };
  }
  function store(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem(k);
      if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v);
    } catch (e) { /* private mode / blocked storage: tweak still works, it just won't remember */ }
    return null;
  }
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), safe(v));
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  var clip = function (s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  var round = function (n) { return +(+n).toFixed(3); };
  var slugify = function (s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); };
  // "--color-primary" -> "Color primary"
  function pretty(name) {
    var s = name.replace(/^--/, '').replace(/[-_]+/g, ' ').trim();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function htmlToText(html) { var t = document.createElement('template'); t.innerHTML = html; return t.content.textContent; }

  // ---------------------------------------------------------------- address / config
  function wantsTweak() {
    try {
      if (/\/tweak\/?$/.test(location.pathname)) return true;
      if (new URLSearchParams(location.search).has('tweak')) return true;
      if (location.hash === '#tweak') return true;
    } catch (e) {}
    return false;
  }
  function pagePath() { return location.pathname.replace(/\/tweak\/?$/, '') || '/'; }
  function cleanUrl() {
    try {
      var u = new URL(location.href);
      u.pathname = pagePath();
      u.searchParams.delete('tweak');
      if (u.hash === '#tweak') u.hash = '';
      return u.toString();
    } catch (e) { return location.href; }
  }
  function readConfig() {
    var g = window.MMTweakConfig || {};
    var site = g.site || (SCRIPT && SCRIPT.getAttribute('data-site')) || document.title || location.host;
    var bakeUrl = DEFAULT_BAKE;
    if (Object.prototype.hasOwnProperty.call(g, 'bakeUrl')) bakeUrl = g.bakeUrl;
    else if (SCRIPT && SCRIPT.hasAttribute('data-bake-url')) bakeUrl = SCRIPT.getAttribute('data-bake-url');
    return { site: String(site), bakeUrl: String(bakeUrl || '').trim() };
  }

  // ---------------------------------------------------------------- value kinds
  var LEN_RE = /^(-?\d*\.?\d+)(px|rem|em|%|vw|vh|vmin|vmax|ch|ex|svh|dvh|lvh)?$/i;
  var DUR_RE = /^(-?\d*\.?\d+)(ms|s)$/i;
  var EASE_WORDS = ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end'];
  var NOT_COLORS = ['inherit', 'initial', 'unset', 'revert', 'currentcolor', 'none', 'auto'];
  var FONTSHARE = [
    ['Satoshi'], ['General Sans'], ['Cabinet Grotesk'], ['Clash Display'], ['Switzer'], ['Supreme'],
    ['Erode', 'serif'], ['Sentient', 'serif'], ['Gambetta', 'serif'], ['Zodiak', 'serif'], ['Boska', 'serif'],
    ['Chillax'], ['Ranade'], ['Plus Jakarta Sans'], ['Outfit'], ['Manrope'], ['Archivo'], ['Epilogue'],
    ['Synonym'], ['Author'], ['Telma', 'cursive'], ['Pally'], ['Bespoke Serif', 'serif'], ['Tanker'], ['Panchang']
  ];
  var COMMON_FONTS = ['Inter, system-ui, sans-serif', 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    'Georgia, "Times New Roman", serif', 'ui-monospace, SFMono-Regular, Menlo, monospace'];
  var EASE_PRESETS = [
    ['ease', 'Ease'], ['ease-in', 'Ease in'], ['ease-out', 'Ease out'], ['ease-in-out', 'Ease in and out'],
    ['linear', 'Linear'], ['cubic-bezier(.22,1,.36,1)', 'Smooth out'], ['cubic-bezier(.2,.8,.2,1)', 'Snappy'],
    ['cubic-bezier(.4,0,.2,1)', 'Gentle']
  ];

  function isColor(v) {
    if (!v || /var\(|calc\(|,.*\)\s*,/.test(v)) return false;
    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return true;
    if (/^(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i.test(v)) return validColor(v);
    if (/^[a-z]+$/i.test(v) && NOT_COLORS.indexOf(v.toLowerCase()) < 0) return validColor(v);
    return false;
  }
  function validColor(v) { try { return CSS.supports('color', v); } catch (e) { return false; } }
  function kindOf(name, v) {
    if (DUR_RE.test(v)) return 'duration';
    if (/^(cubic-bezier|steps|linear)\(/i.test(v) || EASE_WORDS.indexOf(v) >= 0) return 'easing';
    if (isColor(v)) return 'color';
    if (LEN_RE.test(v)) return 'length';
    if (/font|family|typeface/i.test(name) && !/^\d/.test(v)) return 'font';
    if (/,/.test(v) && /["']|\b(serif|sans-serif|monospace|system-ui|cursive)\b/.test(v) && !/\d(px|rem)/.test(v)) return 'font';
    return 'other';
  }
  function groupOf(t) {
    if (t.kind === 'color') return 'Colors';
    if (t.kind === 'font') return 'Type';
    if (t.kind === 'length') {
      if (/radius|round|corner/i.test(t.name)) return 'Corners';
      if (/font|text|leading|line|tracking|letter|weight|type/i.test(t.name)) return 'Type';
      return 'Sizes & spacing';
    }
    return 'Shadows & other';
  }
  var _ctx;
  function colorParts(v) {
    try {
      _ctx = _ctx || document.createElement('canvas').getContext('2d');
      _ctx.fillStyle = '#000000'; _ctx.fillStyle = v;
      var s = String(_ctx.fillStyle);
      if (s[0] === '#') return { hex: s.slice(0, 7), a: 1 };
      var m = s.match(/rgba?\(([^)]+)\)/);
      if (m) {
        var p = m[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat);
        return { hex: '#' + p.slice(0, 3).map(function (n) { return Math.round(n).toString(16).padStart(2, '0'); }).join(''), a: p[3] == null ? 1 : p[3] };
      }
    } catch (e) {}
    return { hex: '#000000', a: 1 };
  }
  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ', ' + (n >> 8 & 255) + ', ' + (n & 255) + ', ' + round(a) + ')';
  }
  function firstFamily(v) { return String(v || '').split(',')[0].trim().replace(/^['"]|['"]$/g, ''); }
  function fontshareFor(v) {
    var f = firstFamily(v).toLowerCase();
    for (var i = 0; i < FONTSHARE.length; i++) if (FONTSHARE[i][0].toLowerCase() === f) return FONTSHARE[i];
    return null;
  }
  function loadFontshare(v) {
    var fs = fontshareFor(v);
    if (!fs) return;
    var slug = slugify(fs[0]), id = 'mm-tweak-font-' + slug;
    if (document.getElementById(id)) return;
    document.head.appendChild(h('link', { id: id, rel: 'stylesheet', href: 'https://api.fontshare.com/v2/css?f[]=' + slug + '@400,500,600,700&display=swap' }));
  }

  // ---------------------------------------------------------------- runtime state
  var inited = false, cfg, page, saveKey;
  var host, root, ui = {};
  var tokens = [];               // [{name, from, kind, group}] in page order
  var tokInfo = new Map();       // name -> token
  var inlineOrig = {};           // original inline values on <html style>
  var sections = [];             // [{el, selector, label, mark, origDisplay, parent}]
  var secBySel = new Map(), secByEl = new Map(), origOrder = [];
  var textOrig = new Map();      // selector -> {html, text, hadKids}
  var elCache = new Map();       // selector -> element (stable within a session even after moves)
  var S = emptyState();
  var undoStack = [], lastKey = null, lastAt = 0;
  var activeTab = 'design', collapsed = false, textMode = false, designFilter = '';
  var editingEl = null, editSel = null, editStart = '', editPrevCE = null;
  var touchedAnims = new WeakSet(), rateTimer = null;

  function emptyState() { return { tokens: {}, text: {}, layout: null, motion: { scale: 1, off: false } }; }

  // ---------------------------------------------------------------- discovery
  function collectRootVars(rules, out) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      try {
        if (r.selectorText) {
          var sels = r.selectorText.split(',').map(function (s) { return s.trim(); });
          if (sels.some(function (s) { return s === ':root' || s === 'html'; })) {
            for (var j = 0; j < r.style.length; j++) {
              var p = r.style[j];
              if (p.indexOf('--') === 0) out.set(p, r.style.getPropertyValue(p).trim());
            }
          }
        } else if (r.cssRules) collectRootVars(r.cssRules, out); // @media, @supports, @layer ...
      } catch (e) {}
    }
  }
  function discoverTokens() {
    var found = new Map(), de = document.documentElement;
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      var rules = null;
      try { rules = sheet.cssRules; } catch (e) { return; } // cross-origin sheet: skip quietly
      if (rules) collectRootVars(rules, found);
    });
    for (var i = 0; i < de.style.length; i++) {
      var p = de.style[i];
      if (p.indexOf('--') === 0) { inlineOrig[p] = de.style.getPropertyValue(p).trim(); found.set(p, inlineOrig[p]); }
    }
    var cs = getComputedStyle(de);
    found.forEach(function (declared, name) {
      if (name === '--motion-scale') return;
      var from = (cs.getPropertyValue(name) || '').trim() || declared;
      var t = { name: name, from: from, kind: kindOf(name, from) };
      t.group = groupOf(t);
      tokens.push(t); tokInfo.set(name, t);
    });
    if (de.style.getPropertyValue('--motion-scale')) inlineOrig['--motion-scale'] = de.style.getPropertyValue('--motion-scale').trim();
  }

  var SKIP_TAGS = /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE|META|MM-TWEAK)$/;
  function tagNth(el) {
    var tag = el.tagName.toLowerCase(), n = 1, s = el;
    while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) n++;
    return tag + ':nth-of-type(' + n + ')';
  }
  function attrSel(name, v) { return '[' + name + '="' + String(v).replace(/["\\]/g, '\\$&') + '"]'; }
  // Stable CSS path: data-tweak-id / #id / a known section, else tag:nth-of-type from body.
  function cssPath(el) {
    var parts = [], node = el;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      var tid = node.getAttribute('data-tweak-id');
      if (tid) { parts.unshift(attrSel('data-tweak-id', tid)); return parts.join(' > '); }
      if (node.id) { parts.unshift('#' + CSS.escape(node.id)); return parts.join(' > '); }
      var sec = secByEl.get(node);
      if (sec) { parts.unshift(sec.selector); return parts.join(' > '); }
      parts.unshift(tagNth(node));
      node = node.parentElement;
    }
    parts.unshift('body');
    return parts.join(' > ');
  }
  function sectionLabel(el) {
    var v = el.getAttribute('data-section') || el.getAttribute('aria-label');
    if (!v) { var hd = el.querySelector('h1,h2,h3,h4,h5,h6'); v = hd && hd.textContent; }
    v = clip(v || el.tagName.toLowerCase(), 40);
    return v.charAt(0).toUpperCase() + v.slice(1);
  }
  function discoverSections() {
    var els = Array.prototype.filter.call(document.querySelectorAll('[data-section]'), function (e) { return !e.closest('mm-tweak'); });
    if (!els.length) {
      var par = document.querySelector('main') || document.body;
      els = Array.prototype.filter.call(par.children, function (e) { return !SKIP_TAGS.test(e.tagName) && e.id !== HOST_ID; });
    }
    var used = {};
    els.forEach(function (el) {
      var ds = el.getAttribute('data-section'), sel;
      if (ds && document.querySelectorAll(attrSel('data-section', ds)).length === 1) sel = attrSel('data-section', ds);
      else if (el.id) sel = '#' + CSS.escape(el.id);
      else sel = cssPath(el);
      if (used[sel]) return;
      used[sel] = 1;
      var tag = el.tagName.toLowerCase();
      var s = { el: el, selector: sel, label: sectionLabel(el), mark: (tag === 'header' || tag === 'footer' || tag === 'nav') ? tag : '',
        origDisplay: el.style.display, parent: el.parentElement, hiddenByUs: false };
      sections.push(s); secBySel.set(sel, s); secByEl.set(el, s);
    });
    origOrder = sections.map(function (s) { return s.selector; });
  }
  function resolve(sel) {
    var el = elCache.get(sel);
    if (el && el.isConnected) return el;
    var s = secBySel.get(sel);
    if (s) return s.el;
    try { el = document.querySelector(sel); } catch (e) { el = null; }
    if (el) elCache.set(sel, el);
    return el;
  }
  function captureText(sel, el) {
    if (!textOrig.has(sel)) textOrig.set(sel, { html: el.innerHTML, text: el.textContent, hadKids: el.children.length > 0 });
  }

  // ---------------------------------------------------------------- apply state to the page
  function currentOrder() { return (S.layout && S.layout.order) || origOrder; }
  function normalize() {
    Object.keys(S.tokens).forEach(function (n) {
      var t = tokInfo.get(n);
      if (t && String(S.tokens[n]).trim() === t.from) delete S.tokens[n];
    });
    Object.keys(S.text).forEach(function (sel) {
      var o = textOrig.get(sel);
      if (o && S.text[sel] === o.html) delete S.text[sel];
    });
    if (S.layout) {
      var known = S.layout.order.filter(function (x) { return secBySel.has(x); });
      origOrder.forEach(function (x) { if (known.indexOf(x) < 0) known.push(x); });
      S.layout.order = known;
      S.layout.hidden = (S.layout.hidden || []).filter(function (x) { return secBySel.has(x); });
      if (known.join('|') === origOrder.join('|') && !S.layout.hidden.length) S.layout = null;
    }
    S.motion.scale = Math.min(3, Math.max(0.25, +S.motion.scale || 1));
    S.motion.off = !!S.motion.off;
  }
  function applyState() {
    applyText();      // text first: on a fresh load the original order is still in place
    applyTokens();
    applyLayout();
    applyMotion();
  }
  function setRootVar(name, want) {
    var st = document.documentElement.style;
    if (want != null) { if (st.getPropertyValue(name).trim() !== want) st.setProperty(name, want); }
    else if (inlineOrig[name] != null) { if (st.getPropertyValue(name).trim() !== inlineOrig[name]) st.setProperty(name, inlineOrig[name]); }
    else if (st.getPropertyValue(name) !== '') st.removeProperty(name);
  }
  function applyTokens() {
    var names = new Set(tokens.map(function (t) { return t.name; }).concat(Object.keys(S.tokens)));
    names.forEach(function (n) {
      var want = Object.prototype.hasOwnProperty.call(S.tokens, n) ? S.tokens[n] : null;
      if (want != null && (/font|family/i.test(n) || (tokInfo.get(n) || {}).kind === 'font')) loadFontshare(want);
      setRootVar(n, want);
    });
  }
  function applyText() {
    var sels = new Set(Object.keys(S.text).concat(Array.from(textOrig.keys())));
    sels.forEach(function (sel) {
      var el = resolve(sel);
      if (!el || el === editingEl) return;
      captureText(sel, el);
      var want = Object.prototype.hasOwnProperty.call(S.text, sel) ? S.text[sel] : textOrig.get(sel).html;
      if (el.innerHTML !== want) el.innerHTML = want;
    });
  }
  function applyLayout() {
    if (!sections.length) return;
    var order = currentOrder().map(function (x) { return secBySel.get(x); }).filter(Boolean);
    var parents = [];
    order.forEach(function (s) { if (parents.indexOf(s.parent) < 0) parents.push(s.parent); });
    parents.forEach(function (p) {
      var want = order.filter(function (s) { return s.parent === p; }).map(function (s) { return s.el; });
      var now = Array.prototype.filter.call(p.children, function (c) { return secByEl.has(c) && secByEl.get(c).parent === p; });
      if (want.length !== now.length || want.every(function (e, i) { return e === now[i]; })) return;
      // Re-slot: mark each current spot, then drop the sections into the spots in the new order.
      var marks = now.map(function (e) { var m = document.createComment('mm-tweak'); e.before(m); return m; });
      want.forEach(function (e, i) { marks[i].replaceWith(e); });
    });
    var hidden = (S.layout && S.layout.hidden) || [];
    sections.forEach(function (s) {
      var hide = hidden.indexOf(s.selector) >= 0;
      if (hide && !s.hiddenByUs) { s.el.style.display = 'none'; s.hiddenByUs = true; }
      else if (!hide && s.hiddenByUs) {
        if (s.origDisplay) s.el.style.display = s.origDisplay; else s.el.style.removeProperty('display');
        s.hiddenByUs = false;
      }
    });
  }
  function applyMotion() {
    var m = S.motion;
    setRootVar('--motion-scale', m.scale !== 1 ? String(m.scale) : null);
    syncRates();
    var st = document.getElementById('mm-tweak-motion-off');
    if (m.off && !st) {
      document.head.appendChild(h('style', { id: 'mm-tweak-motion-off',
        text: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;scroll-behavior:auto!important}' }));
    } else if (!m.off && st) st.remove();
  }
  // Speed: playbackRate on every running animation; re-checked once a second for new ones.
  function syncRates() {
    try {
      if (typeof document.getAnimations !== 'function') return;
      var r = S.motion.scale;
      document.getAnimations().forEach(function (a) {
        if (r !== 1) { if (a.playbackRate !== r) { a.playbackRate = r; touchedAnims.add(a); } }
        else if (touchedAnims.has(a)) { a.playbackRate = 1; touchedAnims.delete(a); }
      });
    } catch (e) {}
  }

  // ---------------------------------------------------------------- changes, undo, save
  function change(key, mutate, opts) {
    var now = Date.now();
    if (!(key && key === lastKey && now - lastAt < 1200)) {
      undoStack.push(JSON.stringify(S));
      if (undoStack.length > 300) undoStack.shift();
    }
    lastKey = key; lastAt = now;
    mutate(S);
    normalize(); applyState(); save(); refreshChrome();
    if (opts && opts.rerender) renderTab();
  }
  function undo() {
    if (!undoStack.length) return say('Nothing to undo.');
    S = JSON.parse(undoStack.pop()); lastKey = null;
    normalize(); applyState(); save(); refreshChrome(); renderTab();
    say('Undid the last change.');
  }
  function resetAll() {
    if (!countChanges()) return say('There are no changes to reset.');
    change(null, function (s) { var e = emptyState(); s.tokens = e.tokens; s.text = e.text; s.layout = null; s.motion = e.motion; }, { rerender: true });
    say('The page is back to how it started. Press Undo to bring your changes back.');
  }
  function save() {
    if (countChanges()) store(saveKey, JSON.stringify({ v: 1, at: new Date().toISOString(), state: S }));
    else store(saveKey, null);
  }
  function restore() {
    var raw = store(saveKey);
    if (!raw) return 0;
    try {
      var d = JSON.parse(raw), st = d && d.state;
      if (!st) return 0;
      var e = emptyState();
      S = { tokens: st.tokens || e.tokens, text: st.text || e.text, layout: st.layout || null, motion: Object.assign(e.motion, st.motion || {}) };
      if (S.layout && !Array.isArray(S.layout.order)) S.layout = null;
      applyText(); // captures text originals before the comparison in normalize()
      normalize(); applyState();
      return countChanges();
    } catch (err) { S = emptyState(); return 0; }
  }

  // ---------------------------------------------------------------- bake payload
  function bakePayload(note) {
    if (!inited) return null;
    var designTokens = [], motionTokens = [];
    Object.keys(S.tokens).forEach(function (name) {
      var t = tokInfo.get(name);
      var rec = { name: name, from: t ? t.from : (inlineOrig[name] || ''), to: S.tokens[name] };
      if (rec.from === rec.to) return;
      (t && (t.kind === 'duration' || t.kind === 'easing') ? motionTokens : designTokens).push(rec);
    });
    var text = Object.keys(S.text).map(function (sel) {
      var o = textOrig.get(sel) || { html: '', text: '' };
      var r = { selector: sel, from: o.text, to: htmlToText(S.text[sel]) };
      if (o.hadKids) { r.fromHtml = o.html; r.toHtml = S.text[sel]; }
      return r;
    });
    var order = currentOrder(), hidden = (S.layout && S.layout.hidden) || [];
    var moved = order.join('|') !== origOrder.join('|');
    var layout = {
      sections: order.map(function (sel) { var s = secBySel.get(sel); return { label: s ? s.label : sel, selector: sel, hidden: hidden.indexOf(sel) >= 0 }; }),
      moved: moved, hidden: hidden.slice()
    };
    var motion = { scale: S.motion.scale, off: S.motion.off, tokens: motionTokens };
    var counts = { tokens: designTokens.length, text: text.length, layout: (moved ? 1 : 0) + hidden.length,
      motion: (S.motion.scale !== 1 ? 1 : 0) + (S.motion.off ? 1 : 0) + motionTokens.length };
    counts.total = counts.tokens + counts.text + counts.layout + counts.motion;
    return { v: 1, site: cfg.site, host: location.host, page: page, url: cleanUrl(), at: new Date().toISOString(),
      viewport: { w: window.innerWidth, h: window.innerHeight }, note: String(note || ''),
      tokens: designTokens, text: text, layout: layout, motion: motion, counts: counts };
  }
  function countChanges() {
    var n = Object.keys(S.tokens).length + Object.keys(S.text).length;
    if (S.layout) n += (S.layout.order.join('|') !== origOrder.join('|') ? 1 : 0) + S.layout.hidden.length;
    return n + (S.motion.scale !== 1 ? 1 : 0) + (S.motion.off ? 1 : 0);
  }
  function fileName() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return 'bake-' + (slugify(cfg.site) || 'site') + '-' + (slugify(page) || 'home') + '-' +
      d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + '.json';
  }
  function downloadJson(obj) {
    var name = fileName();
    var url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }));
    var a = h('a', { href: url, download: name });
    root.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return name;
  }
  function copyText(s) {
    function fallback() {
      var ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = s;
      root.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove(); return ok;
    }
    try {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(s).then(function () { return true; }, fallback);
    } catch (e) {}
    return Promise.resolve(fallback());
  }

  // ---------------------------------------------------------------- styles (inside the shadow root)
  var CSS_TEXT = [
    ':host{all:initial;--f:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}',
    '*{box-sizing:border-box}',
    '[hidden]{display:none!important}',
    '.panel{position:fixed;top:12px;right:12px;bottom:12px;width:360px;max-width:calc(100vw - 24px);background:#fff;color:#00263A;border:1px solid #D5DDE6;border-radius:14px;box-shadow:0 18px 48px rgba(0,38,58,.18),0 2px 6px rgba(0,38,58,.08);display:flex;flex-direction:column;overflow:hidden;font:14px/1.45 var(--f);z-index:3;-webkit-font-smoothing:antialiased}',
    '@media (max-width:420px){.panel{top:8px;right:8px;bottom:8px;max-width:calc(100vw - 16px)}}',
    '.hd{padding:14px 14px 0;border-bottom:1px solid #D5DDE6}',
    '.hd-top{display:flex;align-items:center;gap:10px}',
    '.title{font-weight:700;font-size:16px;letter-spacing:-.01em}',
    '.path{flex:1;min-width:0;font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#5A6B82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.icon{width:30px;height:30px;display:grid;place-items:center;border:1px solid transparent;border-radius:8px;background:none;color:#00263A;cursor:pointer;padding:0}',
    '.icon:hover{background:#F4F7FA;border-color:#D5DDE6}',
    '.actions{display:flex;gap:8px;margin:12px 0}',
    '.btn{height:34px;padding:0 12px;border-radius:8px;border:1px solid #D5DDE6;background:#fff;color:#00263A;font:600 13px/1 var(--f);cursor:pointer;white-space:nowrap}',
    '.btn:hover{background:#F4F7FA}',
    '.btn[disabled]{opacity:.45;cursor:default;background:#fff}',
    '.btn-sm{height:28px;padding:0 9px;font-size:12px;border-radius:7px}',
    '.btn-go{background:#FFC72C;border-color:#E0A91F;color:#00263A;margin-left:auto;padding:0 18px}',
    '.btn-go:hover{background:#FFD45C;border-color:#E0A91F}',
    '.btn-go[disabled]{background:#FFC72C}',
    'button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,[tabindex]:focus-visible{outline:2px solid #00263A;outline-offset:2px}',
    '.tabs{display:flex;margin:0 -4px}',
    '.tab{flex:1;background:none;border:0;border-bottom:2px solid transparent;padding:8px 2px 10px;font:600 12.5px/1 var(--f);color:#5A6B82;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}',
    '.tab:hover{color:#00263A}',
    '.tab[aria-selected="true"]{color:#00263A;border-bottom-color:#00263A}',
    '.badge{min-width:18px;height:18px;padding:0 5px;border-radius:5px;background:#00263A;color:#fff;font-size:11px;line-height:18px;text-align:center}',
    '.badge.zero{background:#E3E9F0;color:#5A6B82}',
    '.bd{flex:1;overflow:auto;padding:14px;scrollbar-width:thin}',
    '.hint{margin:0 0 12px;color:#4A5B72;font-size:13px}',
    '.group{background:#F4F7FA;border-radius:10px;padding:10px 12px;margin-bottom:12px}',
    '.group h3{margin:0 0 4px;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:#5A6B82;font-weight:700}',
    '.row{padding:9px 0;border-top:1px solid #E3E9F0}',
    '.group h3+.row,.group .row:first-of-type{border-top:0}',
    '.row-hd{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}',
    '.row-hd label,.row-hd .lbl{font-weight:600;font-size:13px}',
    '.tok{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#5A6B82;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.link{background:none;border:0;padding:0;color:#8A6A00;font:600 12px var(--f);cursor:pointer;text-decoration:underline;text-underline-offset:2px}',
    '.ctrl{display:flex;gap:8px;align-items:center}',
    '.in{height:32px;border:1px solid #D5DDE6;border-radius:8px;padding:0 8px;font:13px var(--f);color:#00263A;background:#fff;min-width:0}',
    '.in:focus{border-color:#E0A91F;outline:none;box-shadow:0 0 0 3px rgba(255,199,44,.35)}',
    '.grow{flex:1}',
    '.num{width:64px}',
    '.unit{width:62px;padding:0 4px}',
    'input[type=range]{flex:1;min-width:0;height:22px;margin:0;background:none;-webkit-appearance:none;appearance:none;cursor:pointer}',
    'input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:#D5DDE6}',
    'input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:#D5DDE6}',
    'input[type=range]::-moz-range-progress{height:4px;border-radius:2px;background:#FFC72C}',
    'input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6px;border-radius:50%;background:#FFC72C;border:2px solid #fff;box-shadow:0 0 0 1px #B8860B,0 1px 3px rgba(0,38,58,.25)}',
    'input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#FFC72C;border:2px solid #fff;box-shadow:0 0 0 1px #B8860B}',
    '.ease-sel{flex:0 0 132px}',
    '.swatch{width:36px;height:32px;padding:2px;border:1px solid #D5DDE6;border-radius:8px;background:#fff;cursor:pointer}',
    '.fprev{margin-top:6px;font-size:15px;color:#00263A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.filter{width:100%;margin-bottom:12px}',
    '.empty{color:#5A6B82;font-size:13px;padding:6px 0}',
    '.sw{display:flex;align-items:center;gap:10px;width:100%;background:none;border:0;padding:0;color:#00263A;font:600 13px var(--f);cursor:pointer;text-align:left}',
    '.track{flex:0 0 auto;width:38px;height:22px;border-radius:11px;background:#C9D3DE;position:relative;transition:background .15s}',
    '.track::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,38,58,.3);transition:left .15s}',
    '.sw[aria-checked="true"] .track{background:#FFC72C}',
    '.sw[aria-checked="true"] .track::after{left:19px}',
    '.sub{font-weight:400;color:#4A5B72;font-size:12.5px;margin-top:6px}',
    '.sec{display:flex;align-items:center;gap:6px;padding:8px 0;border-top:1px solid #E3E9F0}',
    '.sec:first-of-type{border-top:0}',
    '.sec-name{flex:1;min-width:0;background:none;border:0;padding:4px 0;text-align:left;font:600 13px var(--f);color:#00263A;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sec-name:hover{text-decoration:underline}',
    '.sec.off .sec-name{color:#8A98AB;text-decoration:line-through}',
    '.mark{font:600 10.5px/1 var(--f);text-transform:uppercase;letter-spacing:.05em;color:#5A6B82;border:1px solid #D5DDE6;border-radius:5px;padding:3px 5px;background:#fff}',
    '.sq{width:28px;height:28px;display:grid;place-items:center;border:1px solid #D5DDE6;border-radius:7px;background:#fff;color:#00263A;cursor:pointer;padding:0}',
    '.sq:hover{background:#EAF0F5}',
    '.sq[disabled]{opacity:.35;cursor:default;background:#fff}',
    '.chg{padding:8px 0;border-top:1px solid #E3E9F0;display:flex;gap:8px;align-items:flex-start}',
    '.group h3+.chg{border-top:0}',
    '.chg-main{flex:1;min-width:0}',
    '.chg-what{font-weight:600;font-size:13px}',
    '.chg-ft{font-size:12px;color:#4A5B72;word-break:break-word;margin-top:2px}',
    '.chg-ft b{color:#00263A;font-weight:600}',
    '.dot{display:inline-block;width:10px;height:10px;border-radius:3px;border:1px solid rgba(0,38,58,.2);vertical-align:-1px;margin-right:4px}',
    '.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}',
    '.status{padding:10px 14px;border-top:1px solid #D5DDE6;font-size:12.5px;background:#F4F7FA;color:#00263A}',
    '.status.err{background:#FDF0F0;color:#8A1C1C}',
    '.status.ok{background:#E8F7F0;color:#0B5C3E}',
    '.sheet{position:absolute;inset:0;background:#fff;display:flex;flex-direction:column;z-index:5}',
    '.sheet-bd{flex:1;overflow:auto;padding:16px 14px}',
    '.sheet h2{margin:0 0 6px;font-size:17px}',
    '.sheet p{margin:0 0 12px;color:#4A5B72;font-size:13px}',
    '.field{display:block;margin-bottom:14px}',
    '.field span{display:block;font-weight:600;font-size:13px;margin-bottom:6px}',
    'textarea.in{width:100%;height:96px;padding:8px;resize:vertical;line-height:1.4}',
    '.pw{position:relative}',
    '.pw .in{width:100%;padding-right:70px}',
    '.pw .reveal{position:absolute;right:4px;top:4px;height:24px;padding:0 9px;border:1px solid #D5DDE6;border-radius:6px;background:#F4F7FA;color:#00263A;font:600 12px var(--f);cursor:pointer}',
    '.msg{border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px}',
    '.msg.err{background:#FDF0F0;color:#8A1C1C}',
    '.msg.ok{background:#E8F7F0;color:#0B5C3E}',
    '.msg.info{background:#F4F7FA;color:#00263A}',
    '.sheet-ft{display:flex;gap:8px;padding:12px 14px;border-top:1px solid #D5DDE6}',
    '.opener{position:fixed;right:0;top:50%;transform:translateY(-50%);writing-mode:vertical-rl;padding:14px 8px;border:0;border-radius:8px 0 0 8px;background:#00263A;color:#fff;font:700 13px/1 var(--f);letter-spacing:.06em;cursor:pointer;box-shadow:0 6px 20px rgba(0,38,58,.25);z-index:3}',
    '.opener:hover{background:#0A3A55}',
    '.hl{position:fixed;pointer-events:none;border:2px solid #E0A91F;border-radius:4px;background:rgba(255,199,44,.10);z-index:1;display:none}',
    '.hl.edit{border-color:#00263A;border-style:dashed;background:none}',
    '.hl.flash{border-width:3px}'
  ].join('\n');

  var ICON_COLLAPSE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_UP = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 7.5L6 4l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_DOWN = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------------------------------------------------------------- panel shell
  var TABS = [['design', 'Design'], ['text', 'Text'], ['layout', 'Layout'], ['motion', 'Motion'], ['changes', 'Changes']];
  var HINTS = {
    design: 'Change the brand settings. The page updates as you drag.',
    text: 'Change the words on the page. Turn on editing, then click any text.',
    layout: 'Move or hide the page sections. Click a name to find it on the page.',
    motion: 'Change how fast things move, or turn motion off.',
    changes: 'Everything you changed. Put any one back, or save the list.'
  };
  function buildUI() {
    host = document.createElement('mm-tweak');
    host.id = HOST_ID;
    host.setAttribute('style', 'all:initial;position:fixed;top:0;left:0;width:0;height:0;z-index:2147483000;');
    root = host.attachShadow({ mode: 'open' });
    root.appendChild(h('style', { text: CSS_TEXT }));
    ui.hl = h('div', { class: 'hl', 'aria-hidden': 'true' });
    ui.opener = h('button', { class: 'opener', type: 'button', 'aria-label': 'Open the Tweak panel', hidden: true, onclick: expand }, 'Tweak');
    ui.undo = h('button', { class: 'btn', type: 'button', 'data-k': 'undo', onclick: undo, 'aria-label': 'Undo the last change' }, 'Undo');
    ui.reset = h('button', { class: 'btn', type: 'button', 'data-k': 'reset', onclick: resetAll, 'aria-label': 'Reset the page to how it started' }, 'Reset');
    ui.bake = h('button', { class: 'btn btn-go', type: 'button', 'data-k': 'bake', onclick: openBake, 'aria-label': 'Bake: send these changes to the developer' }, 'Bake');
    ui.tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Tweak sections' });
    TABS.forEach(function (t) {
      var b = h('button', { class: 'tab', type: 'button', role: 'tab', id: 'tab-' + t[0], 'data-tab': t[0], 'aria-controls': 'tweak-body',
        onclick: function () { showTab(t[0]); }, onkeydown: tabKeys }, t[1]);
      if (t[0] === 'changes') { ui.badge = h('span', { class: 'badge zero', 'aria-label': '0 changes' }, '0'); b.append(ui.badge); }
      ui.tabs.append(b);
    });
    ui.body = h('div', { class: 'bd', id: 'tweak-body', role: 'tabpanel' });
    ui.status = h('div', { class: 'status', role: 'status', 'aria-live': 'polite', hidden: true });
    ui.panel = h('section', { class: 'panel', role: 'dialog', 'aria-label': 'Tweak this page' },
      h('div', { class: 'hd' },
        h('div', { class: 'hd-top' },
          h('div', { class: 'title' }, 'Tweak'),
          h('div', { class: 'path', title: page }, page),
          h('button', { class: 'icon', type: 'button', 'aria-label': 'Collapse the panel (Esc)', title: 'Collapse (Esc)', html: ICON_COLLAPSE, onclick: collapse })),
        h('div', { class: 'actions' }, ui.undo, ui.reset, ui.bake),
        ui.tabs),
      ui.body, ui.status);
    root.append(ui.hl, ui.panel, ui.opener);
    (document.body || document.documentElement).appendChild(host);
  }
  function tabKeys(e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var i = TABS.findIndex(function (t) { return t[0] === activeTab; });
    i = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    showTab(TABS[i][0]);
    root.getElementById('tab-' + TABS[i][0]).focus();
  }
  function showTab(name) {
    activeTab = name; store(TAB_STORE, name);
    if (!editingEl) say('');
    renderTab();
  }
  function refreshChrome() {
    var n = countChanges();
    ui.badge.textContent = String(n);
    ui.badge.className = 'badge' + (n ? '' : ' zero');
    ui.badge.setAttribute('aria-label', n + (n === 1 ? ' change' : ' changes'));
    ui.undo.disabled = !undoStack.length;
    ui.reset.disabled = !n;
  }
  function say(msg, kind) {
    ui.status.textContent = msg || '';
    ui.status.className = 'status' + (kind ? ' ' + kind : '');
    ui.status.hidden = !msg;
  }
  function collapse() { collapsed = true; stopEditing(true); ui.panel.hidden = true; ui.opener.hidden = false; hideHl(); }
  function expand(focus) { collapsed = false; ui.panel.hidden = false; ui.opener.hidden = true; if (focus !== false) { var b = root.getElementById('tab-' + activeTab); if (b) b.focus(); } }

  function renderTab() {
    var focusKey = root.activeElement && root.activeElement.getAttribute && root.activeElement.getAttribute('data-k');
    var scroll = ui.body.scrollTop;
    Array.prototype.forEach.call(ui.tabs.children, function (b) {
      var on = b.getAttribute('data-tab') === activeTab;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    });
    ui.body.setAttribute('aria-labelledby', 'tab-' + activeTab);
    ui.body.textContent = '';
    ui.body.append(h('p', { class: 'hint' }, HINTS[activeTab]));
    ({ design: renderDesign, text: renderText, layout: renderLayout, motion: renderMotion, changes: renderChanges })[activeTab]();
    ui.body.scrollTop = scroll;
    if (focusKey) {
      var f = Array.prototype.find.call(root.querySelectorAll('[data-k]'), function (x) { return x.getAttribute('data-k') === focusKey; });
      if (f && !f.disabled) f.focus();
    }
    refreshChrome();
  }

  // ---------------------------------------------------------------- token controls (Design + Motion)
  function curTok(name) { return Object.prototype.hasOwnProperty.call(S.tokens, name) ? S.tokens[name] : tokInfo.get(name).from; }
  function tokenRow(t) {
    var id = 'tk-' + slugify(t.name);
    var revert = h('button', { class: 'link', type: 'button', 'data-k': 'rv' + t.name, 'aria-label': 'Put ' + pretty(t.name) + ' back to how it was',
      hidden: !(t.name in S.tokens), onclick: function () { change(null, function (s) { delete s.tokens[t.name]; }, { rerender: true }); } }, 'Revert');
    var row = h('div', { class: 'row', 'data-filter': (t.name + ' ' + pretty(t.name) + ' ' + t.from).toLowerCase() },
      h('div', { class: 'row-hd' }, h('label', { for: id }, pretty(t.name)), h('code', { class: 'tok', title: t.name }, t.name), revert));
    function set(v) {
      v = String(v).trim();
      change('tok:' + t.name, function (s) { s.tokens[t.name] = v; });
      revert.hidden = !(t.name in S.tokens);
    }
    row.append(control(t, id, set));
    return row;
  }
  function control(t, id, set) {
    var cur = curTok(t.name), label = pretty(t.name);
    if (t.kind === 'color') {
      var pick = h('input', { type: 'color', class: 'swatch', value: colorParts(cur).hex, 'aria-label': label + ': pick a color', 'data-k': 'cp' + t.name });
      var txt = h('input', { type: 'text', class: 'in grow', id: id, value: cur, spellcheck: 'false', autocomplete: 'off', 'data-k': 'ct' + t.name });
      pick.addEventListener('input', safe(function () {
        var a = colorParts(txt.value).a; // keep any see-through amount the text box already had
        var v = a < 1 ? hexToRgba(pick.value, a) : pick.value;
        txt.value = v; set(v);
      }));
      txt.addEventListener('input', safe(function () {
        var v = txt.value.trim();
        if (validColor(v)) { pick.value = colorParts(v).hex; set(v); }
      }));
      return h('div', { class: 'ctrl' }, pick, txt);
    }
    if (t.kind === 'length' && LEN_RE.test(cur)) {
      var m = cur.match(LEN_RE), n = parseFloat(m[1]), u = (m[2] || '').toLowerCase();
      var o = t.from.match(LEN_RE), on = o ? Math.abs(parseFloat(o[1])) : Math.abs(n);
      var max = u === 'px' ? Math.max(100, Math.ceil(on * 3)) : (u === 'rem' || u === 'em') ? Math.max(4, round(on * 3)) :
        (u === '%' || /^v|vh$/.test(u)) ? Math.max(100, Math.ceil(on * 3)) : u === '' ? Math.max(on <= 1 ? 3 : 10, round(on * 3)) : Math.max(10, round(on * 3));
      var step = u === 'px' || u === '%' || /vh$|^v/.test(u) ? 1 : (u === '' && on >= 10) ? 1 : u === '' ? 0.01 : 0.05;
      var min = n < 0 ? -max : 0;
      var range = h('input', { type: 'range', min: min, max: max, step: step, value: n, 'aria-label': label + ' slider', 'data-k': 'lr' + t.name });
      var num = h('input', { type: 'number', class: 'in num', id: id, step: step, value: n, 'data-k': 'ln' + t.name, 'aria-label': label + ' number' });
      var units = [u].concat(['px', 'rem', 'em', '%', 'vw', 'vh']).filter(function (x, i, a) { return a.indexOf(x) === i; });
      var unit = h('select', { class: 'in unit', 'aria-label': label + ' unit', 'data-k': 'lu' + t.name },
        units.map(function (x) { return h('option', { value: x }, x || '(none)'); }));
      unit.value = u;
      var out = function () { set(round(num.value || 0) + unit.value); };
      range.addEventListener('input', safe(function () { num.value = range.value; out(); }));
      num.addEventListener('input', safe(function () { if (num.value !== '') { range.value = num.value; out(); } }));
      unit.addEventListener('change', safe(out));
      return h('div', { class: 'ctrl' }, range, num, unit);
    }
    if (t.kind === 'duration' && DUR_RE.test(cur)) {
      var d = cur.match(DUR_RE), du = d[2].toLowerCase(), ms = du === 's' ? parseFloat(d[1]) * 1000 : parseFloat(d[1]);
      var fromMs = (function () { var f = t.from.match(DUR_RE); return f ? (f[2].toLowerCase() === 's' ? parseFloat(f[1]) * 1000 : parseFloat(f[1])) : ms; })();
      var dmax = Math.max(1000, Math.ceil(fromMs * 3 / 50) * 50);
      var dr = h('input', { type: 'range', min: 0, max: dmax, step: 10, value: ms, 'aria-label': label + ' slider (milliseconds)', 'data-k': 'dr' + t.name });
      var dn = h('input', { type: 'number', class: 'in num', id: id, min: 0, step: 10, value: Math.round(ms), 'data-k': 'dn' + t.name, 'aria-label': label + ' in milliseconds' });
      var dout = function (v) { v = Math.max(0, +v || 0); set(du === 's' ? round(v / 1000) + 's' : Math.round(v) + 'ms'); };
      dr.addEventListener('input', safe(function () { dn.value = dr.value; dout(dr.value); }));
      dn.addEventListener('input', safe(function () { if (dn.value !== '') { dr.value = dn.value; dout(dn.value); } }));
      return h('div', { class: 'ctrl' }, dr, dn, h('span', { class: 'tok', style: 'flex:0 0 auto' }, 'ms'));
    }
    if (t.kind === 'easing') {
      var norm = function (v) { return String(v).replace(/\s+/g, '').replace(/0\./g, '.'); };
      var match = function (v) { var p = EASE_PRESETS.find(function (x) { return norm(x[0]) === norm(v); }); return p ? p[0] : 'custom'; };
      var sel = h('select', { class: 'in ease-sel', id: id, 'data-k': 'es' + t.name },
        EASE_PRESETS.map(function (p) { return h('option', { value: p[0] }, p[1]); }), h('option', { value: 'custom' }, 'Custom'));
      var et = h('input', { type: 'text', class: 'in grow', value: cur, spellcheck: 'false', 'aria-label': label + ' custom curve', 'data-k': 'et' + t.name });
      sel.value = match(cur);
      sel.addEventListener('change', safe(function () { if (sel.value !== 'custom') { et.value = sel.value; set(sel.value); } else et.focus(); }));
      et.addEventListener('input', safe(function () { sel.value = match(et.value); if (et.value.trim()) set(et.value); }));
      return h('div', { class: 'ctrl' }, sel, et);
    }
    if (t.kind === 'font') {
      var fi = h('input', { type: 'text', class: 'in grow', id: id, value: cur, list: 'mm-tweak-fonts', spellcheck: 'false', autocomplete: 'off', 'data-k': 'ft' + t.name });
      var prev = h('div', { class: 'fprev', style: 'font-family:' + cur.replace(/[;{}]/g, '') }, 'The quick brown fox jumps');
      fi.addEventListener('input', safe(function () {
        var v = fi.value.trim();
        if (!v) return;
        var fs = fontshareFor(v);
        if (fs && v.indexOf(',') < 0) v = '"' + fs[0] + '", ' + (fs[1] || 'sans-serif'); // bare Fontshare name -> full stack
        loadFontshare(v); prev.style.fontFamily = v; set(v);
      }));
      fi.addEventListener('change', safe(function () { fi.value = curTok(t.name); }));
      return h('div', null, h('div', { class: 'ctrl' }, fi), prev);
    }
    var ot = h('input', { type: 'text', class: 'in grow', id: id, value: cur, spellcheck: 'false', autocomplete: 'off', 'data-k': 'ot' + t.name });
    ot.addEventListener('input', safe(function () { if (ot.value.trim()) set(ot.value); }));
    return h('div', { class: 'ctrl' }, ot);
  }
  function fontList() {
    var seen = [], addF = function (v) { v = String(v || '').trim(); if (v && seen.indexOf(v) < 0) seen.push(v); };
    tokens.forEach(function (t) { if (t.kind === 'font') { addF(t.from); addF(curTok(t.name)); } });
    try { addF(getComputedStyle(document.body).fontFamily); var h1 = document.querySelector('h1'); if (h1) addF(getComputedStyle(h1).fontFamily); } catch (e) {}
    COMMON_FONTS.forEach(addF);
    FONTSHARE.forEach(function (f) { addF('"' + f[0] + '", ' + (f[1] || 'sans-serif')); });
    return h('datalist', { id: 'mm-tweak-fonts' }, seen.map(function (v) { return h('option', { value: v }, firstFamily(v)); }));
  }
  function renderDesign() {
    var list = tokens.filter(function (t) { return t.kind !== 'duration' && t.kind !== 'easing'; });
    if (!list.length) return ui.body.append(h('div', { class: 'empty' }, 'This page has no brand settings (CSS variables on :root) to change.'));
    var groupsWrap = h('div');
    var filter = h('input', { type: 'search', class: 'in filter', placeholder: 'Find a setting (for example: primary, radius)', 'aria-label': 'Find a setting', value: designFilter, 'data-k': 'filter' });
    var apply = function () {
      designFilter = filter.value;
      var q = designFilter.trim().toLowerCase();
      Array.prototype.forEach.call(groupsWrap.children, function (g) {
        var any = false;
        Array.prototype.forEach.call(g.querySelectorAll('.row'), function (r) { var on = !q || r.getAttribute('data-filter').indexOf(q) >= 0; r.hidden = !on; any = any || on; });
        g.hidden = !any;
      });
    };
    filter.addEventListener('input', safe(apply));
    ['Colors', 'Type', 'Sizes & spacing', 'Corners', 'Shadows & other'].forEach(function (g) {
      var rows = list.filter(function (t) { return t.group === g; });
      if (rows.length) groupsWrap.append(h('div', { class: 'group' }, h('h3', null, g), rows.map(tokenRow)));
    });
    ui.body.append(filter, fontList(), groupsWrap);
    apply();
  }

  // ---------------------------------------------------------------- Text tab: edit words in place
  var TEXT_TAGS = 'h1,h2,h3,h4,h5,h6,p,li,a,button,span,label,figcaption,blockquote,td,th,small,strong,em,dt,dd';
  var BLOCK_TAGS = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,td,th,dt,dd,figcaption,label';
  function inPanel(t) { return t === host || (t && t.closest && t.closest('mm-tweak')); }
  function pickText(t) {
    if (!t || t.nodeType !== 1 || inPanel(t) || !document.body.contains(t)) return null;
    var el = t.closest('a,button') || t.closest(BLOCK_TAGS) || t.closest(TEXT_TAGS);
    if (!el || el === document.body || !el.textContent.trim()) return null;
    return el;
  }
  function placeHl(el, cls) {
    if (!el) return hideHl();
    var r = el.getBoundingClientRect();
    if (!r.width && !r.height) return hideHl();
    var s = ui.hl.style;
    s.display = 'block'; s.left = (r.left - 3) + 'px'; s.top = (r.top - 3) + 'px'; s.width = (r.width + 6) + 'px'; s.height = (r.height + 6) + 'px';
    ui.hl.className = 'hl' + (cls ? ' ' + cls : '');
  }
  function hideHl() { if (ui.hl) ui.hl.style.display = 'none'; }
  var onOver = safe(function (e) { if (!editingEl) placeHl(pickText(e.target)); });
  var onScroll = safe(function () { if (editingEl) placeHl(editingEl, 'edit'); else hideHl(); });
  var onClick = safe(function (e) {
    var t = e.target;
    if (inPanel(t)) return;
    if (editingEl && editingEl.contains(t)) { if (t.closest && t.closest('a,button')) e.preventDefault(); return; }
    var el = pickText(t);
    if (el || (t.closest && t.closest('a,button,[role=button]'))) { e.preventDefault(); e.stopPropagation(); }
    if (el) startEdit(el);
  });
  var onSubmit = safe(function (e) { if (!inPanel(e.target)) e.preventDefault(); });
  function setTextMode(on) {
    textMode = !!on;
    var opts = true;
    if (textMode) {
      document.addEventListener('mouseover', onOver, opts);
      document.addEventListener('click', onClick, opts);
      document.addEventListener('submit', onSubmit, opts);
      window.addEventListener('scroll', onScroll, true);
    } else {
      stopEditing(false);
      document.removeEventListener('mouseover', onOver, opts);
      document.removeEventListener('click', onClick, opts);
      document.removeEventListener('submit', onSubmit, opts);
      window.removeEventListener('scroll', onScroll, true);
      hideHl();
    }
  }
  function startEdit(el) {
    if (editingEl === el) return;
    stopEditing(false);
    var sel = cssPath(el);
    elCache.set(sel, el);
    captureText(sel, el);
    editingEl = el; editSel = sel; editStart = el.innerHTML;
    editPrevCE = el.getAttribute('contenteditable');
    el.setAttribute('contenteditable', 'true');
    el.addEventListener('blur', onEditBlur);
    el.addEventListener('keydown', onEditKey);
    el.addEventListener('paste', onEditPaste);
    el.focus();
    try { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    placeHl(el, 'edit');
    say('Editing. Type your new words, then press Enter to finish or Esc to cancel.');
  }
  var onEditBlur = safe(function () { stopEditing(false); });
  var onEditKey = safe(function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stopEditing(false); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); stopEditing(true); }
  });
  var onEditPaste = safe(function (e) {
    e.preventDefault();
    var t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  function stopEditing(cancel) {
    var el = editingEl;
    if (!el) return;
    editingEl = null;
    el.removeEventListener('blur', onEditBlur);
    el.removeEventListener('keydown', onEditKey);
    el.removeEventListener('paste', onEditPaste);
    if (editPrevCE == null) el.removeAttribute('contenteditable'); else el.setAttribute('contenteditable', editPrevCE);
    if (cancel) el.innerHTML = editStart;
    if (document.activeElement === el) el.blur();
    hideHl();
    var html = el.innerHTML, sel = editSel;
    if (!cancel && html !== editStart) {
      change(null, function (s) { s.text[sel] = html; }, { rerender: activeTab === 'text' || activeTab === 'changes' });
      say('Text changed. Click more text, or press Undo to take it back.');
    } else say(cancel ? 'Edit cancelled.' : '');
  }
  function renderText() {
    var sw = h('button', { class: 'sw', type: 'button', role: 'switch', 'aria-checked': textMode ? 'true' : 'false', 'data-k': 'textmode',
      onclick: function () { setTextMode(!textMode); renderTab(); say(textMode ? 'Text editing is on. Click any text on the page.' : 'Text editing is off.'); } },
      h('span', { class: 'track', 'aria-hidden': 'true' }), 'Edit text on the page');
    ui.body.append(h('div', { class: 'group' }, sw,
      h('div', { class: 'sub' }, 'Click a heading, paragraph, link or button, then type. Press Enter to finish, Esc to cancel. Links do not open while this is on.')));
    var sels = Object.keys(S.text);
    var g = h('div', { class: 'group' }, h('h3', null, 'Edited text (' + sels.length + ')'));
    if (!sels.length) g.append(h('div', { class: 'empty' }, 'Nothing edited yet.'));
    sels.forEach(function (sel, i) {
      var o = textOrig.get(sel) || { text: '' };
      g.append(h('div', { class: 'chg' },
        h('div', { class: 'chg-main' },
          h('button', { class: 'sec-name', type: 'button', style: 'padding:0', 'aria-label': 'Show this text on the page', onclick: function () { flash(resolve(sel)); } }, clip(htmlToText(S.text[sel]), 60) || '(empty)'),
          h('div', { class: 'chg-ft' }, 'Was: ', h('b', null, clip(o.text, 80)))),
        h('button', { class: 'btn btn-sm', type: 'button', 'data-k': 'trv' + i, 'aria-label': 'Put this text back',
          onclick: function () { change(null, function (s) { delete s.text[sel]; }, { rerender: true }); } }, 'Revert')));
    });
    ui.body.append(g);
  }

  // ---------------------------------------------------------------- Layout tab
  function flash(el) {
    if (!el) return;
    if (getComputedStyle(el).display === 'none') return say('That section is hidden. Press Show to bring it back.');
    try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { el.scrollIntoView(); }
    var until = Date.now() + 1400;
    (function tick() {
      if (Date.now() > until) return hideHl();
      placeHl(el, 'flash');
      requestAnimationFrame(tick);
    })();
  }
  function moveSection(sel, dir) {
    change(null, function (s) {
      var order = currentOrder().slice(), sec = secBySel.get(sel), i = order.indexOf(sel), j = i;
      do { j += dir; } while (j >= 0 && j < order.length && secBySel.get(order[j]).parent !== sec.parent);
      if (j < 0 || j >= order.length) return;
      order[i] = order[j]; order[j] = sel;
      s.layout = { order: order, hidden: (s.layout && s.layout.hidden) || [] };
    }, { rerender: true });
  }
  function toggleHidden(sel) {
    change(null, function (s) {
      var hid = ((s.layout && s.layout.hidden) || []).slice(), i = hid.indexOf(sel);
      if (i >= 0) hid.splice(i, 1); else hid.push(sel);
      s.layout = { order: currentOrder().slice(), hidden: hid };
    }, { rerender: true });
  }
  function renderLayout() {
    if (!sections.length) return ui.body.append(h('div', { class: 'empty' }, 'No sections found on this page.'));
    var order = currentOrder(), hidden = (S.layout && S.layout.hidden) || [];
    var g = h('div', { class: 'group' }, h('h3', null, 'Sections, top to bottom'));
    order.forEach(function (sel, i) {
      var s = secBySel.get(sel);
      if (!s) return;
      var same = order.filter(function (x) { return secBySel.get(x).parent === s.parent; }), k = same.indexOf(sel);
      var off = hidden.indexOf(sel) >= 0;
      g.append(h('div', { class: 'sec' + (off ? ' off' : '') },
        h('button', { class: 'sec-name', type: 'button', title: sel, 'aria-label': 'Find ' + s.label + ' on the page', onclick: function () { flash(s.el); } }, s.label),
        s.mark ? h('span', { class: 'mark' }, s.mark) : null,
        h('button', { class: 'sq', type: 'button', 'data-k': 'up' + sel, 'aria-label': 'Move ' + s.label + ' up', title: 'Move up', disabled: k === 0, html: ICON_UP, onclick: function () { moveSection(sel, -1); } }),
        h('button', { class: 'sq', type: 'button', 'data-k': 'dn' + sel, 'aria-label': 'Move ' + s.label + ' down', title: 'Move down', disabled: k === same.length - 1, html: ICON_DOWN, onclick: function () { moveSection(sel, 1); } }),
        h('button', { class: 'btn btn-sm', type: 'button', 'data-k': 'hd' + sel, style: 'width:56px', 'aria-label': (off ? 'Show ' : 'Hide ') + s.label, onclick: function () { toggleHidden(sel); } }, off ? 'Show' : 'Hide')));
    });
    ui.body.append(g);
  }

  // ---------------------------------------------------------------- Motion tab
  function renderMotion() {
    var sp = h('input', { type: 'range', min: 0.25, max: 3, step: 0.05, value: S.motion.scale, id: 'mm-speed', 'aria-label': 'Animation speed', 'data-k': 'speed' });
    var out = h('span', { class: 'tok', style: 'flex:0 0 46px;text-align:right;font-size:13px;color:#00263A' }, S.motion.scale.toFixed(2) + 'x');
    sp.addEventListener('input', safe(function () {
      var v = round(sp.value); out.textContent = v.toFixed(2) + 'x';
      change('speed', function (s) { s.motion.scale = v; });
    }));
    var off = h('button', { class: 'sw', type: 'button', role: 'switch', 'aria-checked': S.motion.off ? 'true' : 'false', 'data-k': 'motionoff',
      onclick: function () { change(null, function (s) { s.motion.off = !s.motion.off; }, { rerender: true }); } },
      h('span', { class: 'track', 'aria-hidden': 'true' }), 'Turn motion off');
    ui.body.append(h('div', { class: 'group' },
      h('div', { class: 'row' }, h('div', { class: 'row-hd' }, h('label', { for: 'mm-speed' }, 'Animation speed')),
        h('div', { class: 'ctrl' }, sp, out), h('div', { class: 'sub' }, '1x is normal. Higher is faster, lower is slower.')),
      h('div', { class: 'row' }, off, h('div', { class: 'sub' }, 'Stops every animation and transition, the way people who get motion sick see it.'))));
    var durs = tokens.filter(function (t) { return t.kind === 'duration'; });
    var eases = tokens.filter(function (t) { return t.kind === 'easing'; });
    if (durs.length) ui.body.append(h('div', { class: 'group' }, h('h3', null, 'Timing'), durs.map(tokenRow)));
    if (eases.length) ui.body.append(h('div', { class: 'group' }, h('h3', null, 'Movement curves'), eases.map(tokenRow)));
    if (!durs.length && !eases.length) ui.body.append(h('div', { class: 'empty' }, 'This page has no timing settings to edit.'));
  }

  // ---------------------------------------------------------------- Changes tab
  function fromTo(a, b, isColor) {
    var sw = function (c) { return isColor ? h('span', { class: 'dot', style: 'background:' + String(c).replace(/[;{}]/g, '') }) : null; };
    return h('div', { class: 'chg-ft' }, sw(a), h('b', null, clip(a, 70)), ' → ', sw(b), h('b', null, clip(b, 70)));
  }
  function chgItem(what, detail, onRevert, k) {
    return h('div', { class: 'chg' }, h('div', { class: 'chg-main' }, h('div', { class: 'chg-what' }, what), detail),
      h('button', { class: 'btn btn-sm', type: 'button', 'data-k': k, 'aria-label': 'Put back: ' + what, onclick: onRevert }, 'Revert'));
  }
  function renderChanges() {
    var p = bakePayload('');
    var revert = function (fn) { return function () { change(null, fn, { rerender: true }); }; };
    var groups = [];
    if (p.tokens.length) groups.push(['Design', p.tokens.map(function (t) {
      return chgItem(pretty(t.name), fromTo(t.from, t.to, (tokInfo.get(t.name) || {}).kind === 'color'), revert(function (s) { delete s.tokens[t.name]; }), 'cr' + t.name);
    })]);
    if (p.text.length) groups.push(['Text', p.text.map(function (t) {
      return chgItem('Text: ' + clip(t.to, 40), fromTo(t.from, t.to), revert(function (s) { delete s.text[t.selector]; }), 'cx' + t.selector);
    })]);
    var lay = [];
    if (p.layout.moved) lay.push(chgItem('Section order', fromTo(origOrder.map(function (x) { return secBySel.get(x).label; }).join(', '), p.layout.sections.map(function (x) { return x.label; }).join(', ')),
      revert(function (s) { if (s.layout) s.layout.order = origOrder.slice(); }), 'clo'));
    p.layout.hidden.forEach(function (sel) {
      lay.push(chgItem('Hidden: ' + (secBySel.get(sel) || {}).label, h('div', { class: 'chg-ft' }, 'This section is hidden on the page.'),
        revert(function (s) { if (s.layout) s.layout.hidden = s.layout.hidden.filter(function (x) { return x !== sel; }); }), 'clh' + sel));
    });
    if (lay.length) groups.push(['Layout', lay]);
    var mo = [];
    if (p.motion.scale !== 1) mo.push(chgItem('Animation speed', fromTo('1x', p.motion.scale + 'x'), revert(function (s) { s.motion.scale = 1; }), 'cms'));
    if (p.motion.off) mo.push(chgItem('Motion turned off', h('div', { class: 'chg-ft' }, 'Animations and transitions are stopped.'), revert(function (s) { s.motion.off = false; }), 'cmo'));
    p.motion.tokens.forEach(function (t) { mo.push(chgItem(pretty(t.name), fromTo(t.from, t.to), revert(function (s) { delete s.tokens[t.name]; }), 'cr' + t.name)); });
    if (mo.length) groups.push(['Motion', mo]);
    if (!groups.length) ui.body.append(h('div', { class: 'group' }, h('div', { class: 'empty' }, 'No changes yet. Use the other tabs to change the page.')));
    groups.forEach(function (g) { ui.body.append(h('div', { class: 'group' }, h('h3', null, g[0] + ' (' + g[1].length + ')'), g[1])); });
    ui.body.append(h('div', { class: 'btns' },
      h('button', { class: 'btn', type: 'button', 'data-k': 'copy', onclick: function () {
        copyText(JSON.stringify(bakePayload(''), null, 2)).then(function (ok) { say(ok ? 'Copied the change list.' : 'Could not copy. Use Download file instead.', ok ? 'ok' : 'err'); });
      } }, 'Copy'),
      h('button', { class: 'btn', type: 'button', 'data-k': 'dl', onclick: function () { say('Saved ' + downloadJson(bakePayload('')) + ' to your Downloads.', 'ok'); } }, 'Download file'),
      h('button', { class: 'btn', type: 'button', 'data-k': 'resetall', disabled: !groups.length, onclick: resetAll }, 'Reset all')));
  }

  // ---------------------------------------------------------------- Bake
  function openBake() {
    stopEditing(false);
    if (ui.sheet) ui.sheet.remove();
    var n = countChanges();
    var key = store(KEY_STORE);
    var note = h('textarea', { class: 'in', id: 'mm-note', placeholder: 'For example: use this green on every page.' });
    var pwWrap = h('label', { class: 'field', hidden: !!key });
    var pw = h('input', { class: 'in', type: 'password', id: 'mm-pw', autocomplete: 'current-password', spellcheck: 'false' });
    var reveal = h('button', { class: 'reveal', type: 'button', 'aria-label': 'Show password', 'aria-controls': 'mm-pw',
      onclick: function () { var show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; reveal.textContent = show ? 'Hide' : 'Show'; reveal.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); } }, 'Show');
    pwWrap.append(h('span', null, 'Design Studio password'), h('div', { class: 'pw' }, pw, reveal));
    var msg = h('div', { class: 'msg info', role: 'status', 'aria-live': 'polite' },
      n ? n + (n === 1 ? ' change' : ' changes') + ' will be sent for ' + page + '.' : 'There are no changes to bake yet.');
    var send = h('button', { class: 'btn btn-go', type: 'button', disabled: !n, style: 'margin-left:auto' }, 'Send');
    var cancel = h('button', { class: 'btn', type: 'button', onclick: closeBake }, 'Cancel');
    var setMsg = function (kind, content) { msg.className = 'msg ' + kind; msg.textContent = ''; add(msg, content); };
    send.addEventListener('click', safe(function () {
      var k = key || pw.value.trim();
      if (cfg.bakeUrl && !k) { pwWrap.hidden = false; setMsg('err', 'Type the Design Studio password first.'); pw.focus(); return; }
      var payload = bakePayload(note.value);
      send.disabled = true; send.textContent = 'Sending…';
      var fallback = function (why) {
        var f = downloadJson(payload);
        setMsg('err', why + ' So the changes were saved as a file on this computer instead: ' + f + '. Send that file to Claude.');
        send.disabled = false; send.textContent = 'Send';
      };
      if (!cfg.bakeUrl) return fallback('This site has no Design Studio address set.');
      fetch(cfg.bakeUrl, { method: 'POST', headers: { 'content-type': 'application/json', 'x-bake-key': k }, body: JSON.stringify(payload) })
        .then(function (res) {
          if (res.status === 401) {
            store(KEY_STORE, null); key = null; pw.value = ''; pwWrap.hidden = false;
            setMsg('err', 'That password did not work. Type the Design Studio password again, then press Send.');
            send.disabled = false; send.textContent = 'Send'; pw.focus();
            return;
          }
          return res.json().catch(function () { return {}; }).then(function (j) {
            if (!res.ok || !j || !j.ok) return fallback('The Design Studio did not accept the changes (status ' + res.status + ').');
            store(KEY_STORE, k); key = k;
            var file = String(j.file || 'bakes/(file)');
            var line = 'apply bake ' + file;
            var copy = h('button', { class: 'btn btn-sm', type: 'button', style: 'margin-top:8px', onclick: function () {
              copyText(line).then(function (ok) { copy.textContent = ok ? 'Copied' : 'Copy failed'; });
            } }, 'Copy');
            setMsg('ok', [h('div', null, 'Baked. Sent to the Design Studio as ' + file + '. Tell Claude: ' + line + '.'), copy]);
            pwWrap.hidden = true; send.hidden = true; cancel.textContent = 'Done';
            say('Baked. Tell Claude: ' + line, 'ok');
          });
        })
        .catch(safe(function () { fallback('Could not reach the Design Studio.'); }));
    }));
    ui.sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Bake these changes' },
      h('div', { class: 'sheet-bd' },
        h('h2', null, 'Bake these changes'),
        h('p', null, 'This sends the exact changes to the Design Studio so a developer can put them into the site for good. Nothing is sent until you press Send.'),
        msg,
        h('label', { class: 'field' }, h('span', null, 'Note for the developer (optional)'), note),
        pwWrap),
      h('div', { class: 'sheet-ft' }, cancel, send));
    ui.panel.append(ui.sheet);
    (key ? note : pw).focus();
  }
  function closeBake() { if (ui.sheet) { ui.sheet.remove(); ui.sheet = null; ui.bake.focus(); } }

  // ---------------------------------------------------------------- keyboard
  var onKey = safe(function (e) {
    if (e.key !== 'Escape' || editingEl) return;
    if (ui.sheet) { closeBake(); return; }
    if (!collapsed) collapse();
  });

  // ---------------------------------------------------------------- open / close
  function init() {
    cfg = readConfig();
    page = pagePath();
    saveKey = 'mmtweak:' + location.host + page;
    discoverTokens();
    discoverSections();
    buildUI();
    inited = true;
    var saved = store(TAB_STORE);
    if (saved && TABS.some(function (t) { return t[0] === saved; })) activeTab = saved;
    var n = restore();
    renderTab();
    if (n) say('Restored ' + n + (n === 1 ? ' change' : ' changes') + ' from last time.', 'ok');
    document.addEventListener('keydown', onKey);
    rateTimer = setInterval(syncRates, 1000);
  }
  var open = safe(function () {
    if (!document.body) { document.addEventListener('DOMContentLoaded', open); return; }
    var first = !inited;
    if (!inited) init();
    host.style.display = '';
    expand(!first);
  });
  var close = safe(function () {
    if (!inited) return;
    setTextMode(false); closeBake();
    host.style.display = 'none';
  });

  window.MMTweak = {
    __loaded: true,
    open: open,
    close: close,
    get state() { return JSON.parse(JSON.stringify(S)); },
    bakePayload: function (note) { try { return bakePayload(note); } catch (e) { return null; } }
  };

  // Inactive pages: only this one check, plus a hashchange listener so #tweak can open it later.
  safe(function () {
    var boot = function () { if (wantsTweak()) open(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
    window.addEventListener('hashchange', function () { if (location.hash === '#tweak') open(); });
  })();
})();
