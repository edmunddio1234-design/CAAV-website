/* CAAV hero: the Mobile CAVE truck bursts into shards to show the CAVE inside, holds, then reassembles as you scroll past.
   Uses truck-burst.js. No JS or GSAP: the photo of the CAVE inside shows on its own. */
(function () {
  "use strict";
  var fig = document.querySelector("[data-truck]");
  if (!fig || !window.TruckBurst || !window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);
  var b = TruckBurst(fig, { src: "/assets/img/truck-ext.jpg", style: "shards", z: 5 });
  /* the CAVE photo is added to the slot after it loads; keep the truck on top of it */
  new MutationObserver(function () { if (fig.lastElementChild !== b.el) fig.appendChild(b.el); }).observe(fig, { childList: true });
  /* 0 -> 0.4 burst open, 0.4 -> 0.6 hold, 0.6 -> 1 back together */
  function shape(p) { if (p < 0.4) return p / 0.4; if (p < 0.6) return 1; return 1 - (p - 0.6) / 0.4; }
  ScrollTrigger.create({ trigger: fig, start: "top 80%", end: "bottom 10%", scrub: true,
    onUpdate: function (self) { b.set(shape(self.progress)); } });
  b.set(0);
})();
