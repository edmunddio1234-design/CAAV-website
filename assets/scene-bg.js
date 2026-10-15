/* Scene backgrounds: sections that have no picture of their own get a see-through, truck-blue tinted
   background that MOVES: a muted film loop, a blow-out frame sequence playing slowly, or stills that
   slowly pan, zoom and cross-fade. They also drift with the scroll. Same on all four family sites.
   Script-tag settings:
     data-images="a.jpg,b.jpg,..."        stills (pan + zoom + cross-fade)
     data-videos="a.mp4,b.mp4,..."        optional muted film loops (only play while on screen)
     data-seq="/path/f|start|end|step"    optional frame sequence, e.g. "/media/explode/f|5|95|3"
     data-select / data-skip / data-tone  which blocks, which to leave alone, "dark" or "light"
   Films, canvases and photos already in a section are never covered (those sections are skipped).
   No JS: nothing is added. Reduced motion: one still image, no movement. */
(function () {
  "use strict";
  var me = document.currentScript; if (!me) return;
  function list(a) { return (me.getAttribute(a) || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean); }
  var imgs = list("data-images"), vids = list("data-videos"), seq = [];
  var sq = (me.getAttribute("data-seq") || "").split("|");
  if (sq.length === 4) { for (var n = +sq[1]; n <= +sq[2]; n += +sq[3]) seq.push(sq[0] + String(n).padStart(3, "0") + ".jpg"); }
  if (!imgs.length) return;
  var sel = me.getAttribute("data-select") || "main section";
  var skip = me.getAttribute("data-skip") || "";
  var tone = me.getAttribute("data-tone") || "dark";
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function hasOwnMedia(el) {
    var own = [].filter.call(el.querySelectorAll("video,canvas,.media,.slot,.wf-stage,.arch,.blowout,.hero-film,iframe"), function (x) { return !x.closest(".sbg"); });
    if (own.length) return true;
    var big = false;
    [].forEach.call(el.querySelectorAll("img"), function (im) { if (!im.closest(".sbg") && ((im.getAttribute("width") | 0) > 300 || im.offsetWidth > 300)) big = true; });
    return big;
  }
  function layer(src) { var i = document.createElement("i"); i.style.backgroundImage = "url('" + src + "')"; return i; }

  /* each moving background gets start/stop so it only runs while on screen */
  function stills(inner, i) {
    var pick = [imgs[i % imgs.length], imgs[(i + 1) % imgs.length], imgs[(i + 2) % imgs.length]];
    var L = pick.map(function (s, k) { var l = layer(s); l.className = "kb kb" + ((i + k) % 3); inner.appendChild(l); return l; });
    var k = 0, t = null; L[0].classList.add("on");
    return { start: function () { if (t || reduced) return; t = setInterval(function () { L[k].classList.remove("on"); k = (k + 1) % L.length; L[k].classList.add("on"); }, 6500); },
             stop: function () { clearInterval(t); t = null; } };
  }
  function sequence(inner) {
    var a = layer(seq[0]), b = layer(seq[0]); a.className = "kb kb1 on"; b.className = "kb kb1"; inner.appendChild(a); inner.appendChild(b);
    var k = 0, dir = 1, t = null, front = a, back = b, warmed = false;
    function warm() { if (warmed) return; warmed = true; seq.forEach(function (s) { var im = new Image(); im.src = s; }); }
    return { start: function () { warm(); if (t || reduced) return; t = setInterval(function () {
               k += dir; if (k >= seq.length - 1 || k <= 0) dir = -dir;                 /* blow out, then collapse back, on a loop */
               back.style.backgroundImage = "url('" + seq[k] + "')"; back.classList.add("on"); front.classList.remove("on");
               var x = front; front = back; back = x; }, 420); },
             stop: function () { clearInterval(t); t = null; } };
  }
  function film(inner, src, poster) {
    var v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.preload = "none"; if (poster) v.poster = poster; v.src = src; v.className = "kb kb2 on"; v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
    inner.appendChild(v);
    return { start: function () { if (reduced) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); }, stop: function () { v.pause(); } };
  }

  function run() {
    var blocks = [].slice.call(document.querySelectorAll(sel)).filter(function (el) {
      if (skip && el.matches(skip)) return false;
      if (el.closest("[data-no-scene]") || el.hasAttribute("data-no-scene")) return false;
      if (el.offsetHeight < 240) return false;
      return !hasOwnMedia(el);
    });
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { var c = e.target.__sbg; if (!c) return; if (e.isIntersecting) c.start(); else c.stop(); });
    }, { rootMargin: "10% 0px" }) : null;
    blocks.forEach(function (el, i) {
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.isolation = "isolate";
      var bg = document.createElement("div"); bg.className = "sbg sbg-" + tone; bg.setAttribute("aria-hidden", "true");
      var inner = document.createElement("div"); inner.className = "sbg-in"; bg.appendChild(inner);
      el.insertBefore(bg, el.firstChild);
      var kind = reduced ? "still" : (vids.length && i % 3 === 0) ? "film" : (seq.length && i % 3 === 1) ? "seq" : "still";
      var ctl = kind === "film" ? film(inner, vids[Math.floor(i / 3) % vids.length], imgs[i % imgs.length])
              : kind === "seq" ? sequence(inner) : stills(inner, i);
      el.__sbg = ctl;
      if (io) io.observe(el); else ctl.start();
      if (!reduced && window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.fromTo(inner, { yPercent: -8 }, { yPercent: 8, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power2.out", scrollTrigger: { trigger: el, start: "top 85%" } });
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();

  /* keep every scroll animation in step: when the page height changes after load (late images, fonts,
     menus), re-measure the scroll triggers so pinned scenes start and end where they should */
  if (window.ResizeObserver && window.ScrollTrigger) {
    var lastH = 0, rt = null;
    new ResizeObserver(function () {
      var h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastH) < 40) return; lastH = h;
      clearTimeout(rt); rt = setTimeout(function () { try { ScrollTrigger.refresh(); } catch (e) {} }, 250);
    }).observe(document.body);
  }
})();
