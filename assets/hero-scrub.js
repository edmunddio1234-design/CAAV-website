/* CAAV top section: "Educating tomorrow's workforce" plays as a 3D scroll animation in the big image slot.
   The truck turns into a blueprint and comes apart as you scroll; the slot holds still (pinned) while it plays.
   100 frames (the film's first 8.3 seconds, before its title card). Reduced motion, no JS or no GSAP: the slot's photo shows. */
(function () {
  "use strict";
  var fig = document.querySelector("[data-scrub]");
  if (!fig || !window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);
  var N = 100, BASE = fig.getAttribute("data-scrub"), frames = new Array(N), cur = -1, want = 0;
  var cv = document.createElement("canvas"); cv.className = "scrub-cv"; cv.setAttribute("aria-hidden", "true");
  fig.appendChild(cv);
  new MutationObserver(function () { if (fig.lastElementChild !== cv) fig.appendChild(cv); }).observe(fig, { childList: true });
  var ctx = cv.getContext("2d");
  function src(i) { return BASE + String(i + 1).padStart(3, "0") + ".jpg"; }
  function ok(im) { return im && im.complete && im.naturalWidth; }
  function draw(i) {
    var im = frames[i];
    if (!ok(im)) { for (var k = 1; k < N; k++) { if (ok(frames[i - k])) { im = frames[i - k]; break; } if (ok(frames[i + k])) { im = frames[i + k]; break; } } }
    if (!ok(im) || (cur === i && im === frames[i])) return;
    var cw = cv.width, ch = cv.height, s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight), w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h); cur = im === frames[i] ? i : -1;
    fig.classList.add("scrub-ready");
  }
  function size() { var d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(fig.clientWidth * d); cv.height = Math.round(fig.clientHeight * d); cur = -1; draw(want); }
  var order = []; for (var st = 8; st >= 1; st = st >> 1) { for (var i = 0; i < N; i += st) if (order.indexOf(i) < 0) order.push(i); }
  order.forEach(function (i) { var im = new Image(); im.decoding = "async"; im.onload = function () { if (i === 0 || Math.abs(i - want) < 3) draw(want); }; im.src = src(i); frames[i] = im; });
  addEventListener("resize", size); size();
  ScrollTrigger.create({
    trigger: fig, start: "center 55%", end: "+=170%", pin: true, pinSpacing: true, anticipatePin: 1, refreshPriority: 1,
    onUpdate: function (s) { want = Math.min(N - 1, Math.round(s.progress * (N - 1))); draw(want); }
  });
  addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
