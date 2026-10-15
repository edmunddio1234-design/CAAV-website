/* Scene backgrounds: sections that have no picture of their own get a see-through image behind the text
   (blow-out film frames and stills from the films), tinted truck blue, drifting slightly as you scroll.
   Same on all four family sites. Configure with data attributes on the script tag:
     data-images="a.jpg,b.jpg,..."   images to cycle through, in order
     data-select="main > section"    which blocks are candidates (default: main's sections)
     data-skip=".hero,#breakdown"    blocks to leave alone (films, canvases and photos are skipped anyway)
     data-tone="dark" | "light"      dark pages: screen-style glow; light pages: soft multiply
   No JS: nothing is added. Reduced motion: images show, no drift. */
(function () {
  "use strict";
  var me = document.currentScript; if (!me) return;
  var imgs = (me.getAttribute("data-images") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  if (!imgs.length) return;
  var sel = me.getAttribute("data-select") || "main section";
  var skip = me.getAttribute("data-skip") || "";
  var tone = me.getAttribute("data-tone") || "dark";
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function hasOwnMedia(el) {
    if (el.querySelector("video,canvas,.media,.slot,.wf-stage,.arch,.blowout,.hero-film,iframe")) return true;
    var big = false;
    [].forEach.call(el.querySelectorAll("img"), function (im) { if ((im.getAttribute("width") | 0) > 300 || im.offsetWidth > 300) big = true; });
    return big;
  }
  function run() {
    var blocks = [].slice.call(document.querySelectorAll(sel)).filter(function (el) {
      if (skip && el.matches(skip)) return false;
      if (el.closest("[data-no-scene]") || el.hasAttribute("data-no-scene")) return false;
      if (el.offsetHeight < 240) return false;
      return !hasOwnMedia(el);
    });
    blocks.forEach(function (el, i) {
      var src = el.getAttribute("data-scene") || imgs[i % imgs.length];
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.style.isolation = "isolate";
      var bg = document.createElement("div");
      bg.className = "sbg sbg-" + tone; bg.setAttribute("aria-hidden", "true");
      bg.innerHTML = '<i style="background-image:url(\'' + src + '\')"></i>';
      el.insertBefore(bg, el.firstChild);
      if (!reduced && window.gsap && window.ScrollTrigger) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.fromTo(bg.firstChild, { yPercent: -6, scale: 1.08 }, { yPercent: 6, scale: 1.02, ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        gsap.fromTo(bg, { opacity: 0 }, { opacity: 1, duration: 1.2, ease: "power2.out",
          scrollTrigger: { trigger: el, start: "top 85%" } });
      }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
