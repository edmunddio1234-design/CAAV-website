/* The CAAV main site: shared behavior. Plain JS, no build step.
   Content is visible without JS. Motion runs only when GSAP loads and the visitor has not asked for reduced motion. */
/* ===== SITE FAMILY: the one place to change the family links (header strip and footer strip on every page). =====
   Foundations is private, so it is not listed. When Immersion in Motion moves to its own address, change it here. */
var FAMILY = [
  { id: "caav",      name: "The CAAV",            url: "/" },
  { id: "immersion", name: "Immersion in Motion", url: "https://immersion-in-motion.vercel.app/" },
  { id: "amlab",     name: "AM Lab",              url: "https://am-lab-3d-printing.vercel.app" }
];

(function () {
  "use strict";
  var root = document.documentElement;

  // ---------- site family links: rewrite hrefs from FAMILY (the HTML holds the same values for no-JS visitors) ----------
  FAMILY.forEach(function (f) {
    document.querySelectorAll('a[data-family="' + f.id + '"]').forEach(function (a) {
      a.href = f.url; a.textContent = f.name;
      if (/^https?:/.test(f.url)) { a.target = "_blank"; a.rel = "noopener"; }
    });
  });

  // ---------- menu (tablet and phone) ----------
  var btn = document.querySelector(".menu-btn"), menu = document.getElementById("menu");
  function setMenu(open) {
    if (!btn || !menu) return;
    root.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.querySelector("span").textContent = open ? "Close" : "Menu";
    if (open) { var a = menu.querySelector("a"); if (a) a.focus(); }
  }
  if (btn && menu) {
    btn.addEventListener("click", function () { setMenu(!root.classList.contains("menu-open")); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("menu-open")) { setMenu(false); btn.focus(); } });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) setMenu(false); });
  }

  // ---------- image slots: show the photo only if the file exists, else keep the drawn art ----------
  document.querySelectorAll(".media[data-img]").forEach(function (fig) {
    var src = fig.getAttribute("data-img"), img = new Image();
    img.onload = function () {
      var p = fig.querySelector(".photo");
      if (!p) { p = document.createElement("div"); p.className = "photo"; p.setAttribute("role", "img"); p.setAttribute("aria-label", fig.getAttribute("data-alt") || ""); fig.appendChild(p); }
      p.style.backgroundImage = "url('" + src + "')";
      fig.classList.add("has-img");
    };
    img.src = src;
  });

  // ---------- motion (14islands.com style) ----------
  // Two-tone headlines rise line by line, media blocks get a living organic edge (clip-path blob driven by
  // looping noise, stronger on hover), images settle from 1.15 to 1 as they enter, work cards lift on hover.
  // Only transform / opacity / clip-path change; loops run only while their block is on screen.
  function revealAll() {
    document.querySelectorAll("[data-rise]").forEach(function (e) { e.style.opacity = 1; e.style.transform = "none"; });
  }
  if (!(window.gsap && window.ScrollTrigger && window.matchMedia)) { revealAll(); return; }
  gsap.registerPlugin(ScrollTrigger);
  var tweaking = /(^|\/)tweak\/?$|[?#&]tweak/.test(location.pathname + location.search + location.hash);
  var hoverDevice = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function esc(t) { return t.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  // Split a heading into masked visual lines. Words keep their tone (muted or ink, from <span class="on">).
  // Returns a function that puts the exact original markup back.
  function splitLines(el) {
    var original = el.innerHTML, words = [];
    (function walk(node, on) {
      node.childNodes.forEach(function (c) {
        if (c.nodeType === 3) c.textContent.split(/\s+/).forEach(function (w) { if (w) words.push({ w: w, on: on }); });
        else if (c.nodeType === 1) walk(c, on || c.classList.contains("on"));
      });
    })(el, false);
    var host = el.querySelector("a") || el; // footer .big wraps its text in a link
    host.innerHTML = words.map(function (o) { return '<span class="w' + (o.on ? " on" : "") + '">' + esc(o.w) + "</span>"; }).join(" ");
    var lines = [], top = null;
    host.querySelectorAll(".w").forEach(function (w) { if (w.offsetTop !== top) { top = w.offsetTop; lines.push([]); } lines[lines.length - 1].push(w.outerHTML); });
    host.innerHTML = lines.map(function (l) { return '<span class="ln"><span class="ln-in">' + l.join(" ") + "</span></span>"; }).join(" ");
    return function () { el.innerHTML = original; };
  }
  function fontsReady() {
    return new Promise(function (res) {
      var done = false, go = function () { if (!done) { done = true; res(); } };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
      setTimeout(go, 1200);
    });
  }
  function whileVisible(el, fn) {
    var on = false;
    function tick(t) { fn(t); }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && !on) { on = true; gsap.ticker.add(tick); }
        else if (!e.isIntersecting && on) { on = false; gsap.ticker.remove(tick); }
      });
    }, { rootMargin: "60px" });
    io.observe(el);
    return function () { io.disconnect(); gsap.ticker.remove(tick); };
  }

  // Organic edge: a rounded rectangle whose outline is pushed in and out by looping noise.
  function blob(m, k) {
    var W = 0, H = 0, R = 40, amp = 5, ampTo = 5, ph = Math.random() * 100;
    function measure() {
      W = m.offsetWidth; H = m.offsetHeight;
      R = Math.min(parseFloat(getComputedStyle(root).getPropertyValue("--blob")) || 40, W / 4, H / 4);
    }
    function rr(sx) { // point and outward normal at arc length sx along a rounded rect inset by `inset`
      var i = inset, w = W - 2 * i, h = H - 2 * i, r = Math.max(4, R - i * .5), a = w - 2 * r, b = h - 2 * r, q = Math.PI * r / 2;
      var segs = [a, q, b, q, a, q, b, q], s = sx, n = 0;
      while (n < 8 && s > segs[n]) { s -= segs[n]; n++; }
      n = n % 8;
      var cx, cy, ang;
      switch (n) {
        case 0: return [i + r + s, i, 0, -1];
        case 2: return [i + w, i + r + s, 1, 0];
        case 4: return [i + w - r - s, i + h, 0, 1];
        case 6: return [i, i + h - r - s, -1, 0];
        case 1: cx = i + w - r; cy = i + r; ang = -Math.PI / 2 + s / r; break;
        case 3: cx = i + w - r; cy = i + h - r; ang = s / r; break;
        case 5: cx = i + r; cy = i + h - r; ang = Math.PI / 2 + s / r; break;
        default: cx = i + r; cy = i + r; ang = Math.PI + s / r;
      }
      var c = Math.cos(ang), d = Math.sin(ang);
      return [cx + c * r, cy + d * r, c, d];
    }
    var inset = 14;
    function draw(t) {
      if (!W) return;
      var w = W - 2 * inset, h = H - 2 * inset, r = Math.max(4, R - inset * .5);
      var P = 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r, N = Math.max(48, Math.min(140, Math.round(P / 26))), out = [];
      var tt = t * .45 / k + ph;
      for (var j = 0; j < N; j++) {
        var s = j / N * P, p = rr(s), th = j / N * Math.PI * 2;
        var n = .5 * Math.sin(3 * th + tt * .9) + .3 * Math.sin(5 * th - tt * 1.2 + 1.3) + .2 * Math.sin(9 * th + tt * 1.7 + 2.1);
        var off = amp * n;
        out.push([p[0] + p[2] * off, p[1] + p[3] * off]);
      }
      var f = function (v) { return v.toFixed(1); }, mid = function (a, b) { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
      var m0 = mid(out[0], out[1]), d = "M" + f(m0[0]) + " " + f(m0[1]);
      for (j = 1; j <= N; j++) {
        var a = out[j % N], b = out[(j + 1) % N], mm2 = mid(a, b);
        d += "Q" + f(a[0]) + " " + f(a[1]) + " " + f(mm2[0]) + " " + f(mm2[1]);
      }
      m.style.clipPath = "path('" + d + "Z')";
    }
    measure();
    var ro = window.ResizeObserver ? new ResizeObserver(function () { measure(); draw(gsap.ticker.time); }) : null;
    if (ro) ro.observe(m);
    m.classList.add("blobby");
    draw(0);
    var last = 0;
    var stop = whileVisible(m, function (t) {
      // the outline is redrawn ~20 times a second at rest and ~30 on hover: the noise moves slowly,
      // so this reads as smooth while keeping repaint cost low (clip-path changes repaint the block)
      var hot = ampTo > 6 || Math.abs(ampTo - amp) > .2, step = hot ? 1 / 30 : 1 / 20;
      if (t - last < step) return;
      amp += (ampTo - amp) * (hot ? .22 : .15);
      last = t; draw(t);
    });
    function enter() { ampTo = 13; inset = 18; }
    function leave() { ampTo = 5; inset = 14; }
    if (hoverDevice) { m.addEventListener("pointerenter", enter); m.addEventListener("pointerleave", leave); }
    return function () {
      stop(); if (ro) ro.disconnect();
      m.removeEventListener("pointerenter", enter); m.removeEventListener("pointerleave", leave);
      m.style.clipPath = ""; m.classList.remove("blobby");
    };
  }

  var mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", function () {
    root.classList.add("motion");
    var k = parseFloat(getComputedStyle(root).getPropertyValue("--motion-scale")) || 1;
    var cleanups = [];

    // ---- two-tone headlines: gray line(s) first, then the black line(s), each rising out of a mask ----
    var heads = gsap.utils.toArray(".hero h1, .pagehead h1, h2.two, footer .big");
    if (!tweaking) {
      gsap.set(heads, { opacity: 0 });
      fontsReady().then(function () {
        heads.forEach(function (h) {
          var restore = splitLines(h), inner = h.querySelectorAll(".ln-in"), inFooter = !!h.closest("footer");
          gsap.set(h, { opacity: 1, y: 0 });
          var first = !!h.closest(".hero, .pagehead");
          var vars = { yPercent: 105, duration: 1.15 * k, ease: "power4.out", stagger: .12 * k, onComplete: restore };
          if (inFooter) {
            // footer line: tied to the scroll as the page bottom comes into view
            gsap.fromTo(inner, { yPercent: 105 }, { yPercent: 0, ease: "none", stagger: .15,
              scrollTrigger: { trigger: h, start: "top 98%", end: "bottom 80%", scrub: .6, onLeave: restore } });
          } else if (first) {
            gsap.from(inner, Object.assign(vars, { delay: .1 }));
          } else {
            gsap.from(inner, Object.assign(vars, { scrollTrigger: { trigger: h, start: "top 88%", once: true } }));
          }
          cleanups.push(restore);
        });
        ScrollTrigger.refresh();
      });
    }
    gsap.from(".hero .kicker, .hero .lede, .hero .actions, .pagehead .kicker, .pagehead .lede", { y: 20 * k, opacity: 0, duration: .9 * k, ease: "power3.out", stagger: .08, delay: .35 });

    gsap.utils.toArray("[data-rise]").forEach(function (el) {
      if (heads.indexOf(el) > -1 && !tweaking) return;
      gsap.to(el, { opacity: 1, y: 0, duration: .9 * k, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
    });

    // ---- media: organic living edge + image settles from 1.15 to 1 as it enters ----
    gsap.utils.toArray(".media").forEach(function (m) {
      if (window.CSS && CSS.supports && CSS.supports("clip-path", "path('M0 0L1 1Z')")) cleanups.push(blob(m, k));
      gsap.fromTo(m, { "--s": 1.15 }, { "--s": 1, ease: "none", scrollTrigger: { trigger: m, start: "top bottom", end: "center 55%", scrub: .6 } });
      if (hoverDevice) {
        var enter = function () { gsap.to(m, { "--h": 1.04, duration: 1.2, ease: "power3.out" }); };
        var leave = function () { gsap.to(m, { "--h": 1, duration: 1.2, ease: "power3.out" }); };
        m.addEventListener("pointerenter", enter); m.addEventListener("pointerleave", leave);
        cleanups.push(function () { m.removeEventListener("pointerenter", enter); m.removeEventListener("pointerleave", leave); });
      }
    });

    gsap.from(".stats div", { y: 24 * k, opacity: 0, duration: .8 * k, ease: "power3.out", stagger: .08,
      scrollTrigger: { trigger: ".stats", start: "top 92%", once: true } });

    return function () { cleanups.forEach(function (f) { try { f(); } catch (e) {} }); root.classList.remove("motion"); };
  });
  mm.add("(prefers-reduced-motion: reduce)", revealAll);
})();
