/* XR Jags image morphs (21tsi style): as a picture scrolls through the screen it blurs, then a thin line sweeps
   across from the right and the second picture takes over, sharp. The clear picture is fully in place by the time
   the picture reaches the middle of the screen and stays clear as you keep scrolling. Scroll back and it reverses.
   Markup: data-morph="/path/second.jpg" on an image slot that also has data-img. Needs GSAP ScrollTrigger.
   No JS, no GSAP or reduced motion: the first picture shows as a normal photo. */
(function () {
  "use strict";
  if (!window.gsap || !window.ScrollTrigger) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  gsap.registerPlugin(ScrollTrigger);
  document.querySelectorAll(".media[data-morph]").forEach(function (fig) {
    var a = fig.getAttribute("data-img"), b = fig.getAttribute("data-morph");
    var wrap = document.createElement("div");
    wrap.className = "mo-wrap"; wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = '<div class="mo-a"></div><div class="mo-b"></div><i class="mo-line"></i>';
    var A = wrap.children[0], B = wrap.children[1], L = wrap.children[2];
    A.style.backgroundImage = "url('" + a + "')"; B.style.backgroundImage = "url('" + b + "')";
    fig.appendChild(wrap);
    /* keep the morph above the photo the slot loader adds later */
    new MutationObserver(function () { if (fig.lastElementChild !== wrap) fig.appendChild(wrap); }).observe(fig, { childList: true });
    function set(p) {
      var blur = Math.min(1, Math.max(0, (p - 0.05) / 0.3)) * 14;             /* 0.05-0.35: first picture blurs */
      var x = 100 - Math.min(1, Math.max(0, (p - 0.2) / 0.7)) * 100;          /* 0.20-0.90: line sweeps right to left */
      A.style.filter = "blur(" + blur.toFixed(1) + "px)";
      B.style.clipPath = "inset(0 0 0 " + x.toFixed(2) + "%)";
      L.style.left = x.toFixed(2) + "%";
      L.style.opacity = x > 0.5 && x < 99.5 ? "1" : "0";
    }
    set(0);
    ScrollTrigger.create({ trigger: fig, start: "top 90%", end: "center 45%", scrub: true, onUpdate: function (s) { set(s.progress); } });
  });
})();
