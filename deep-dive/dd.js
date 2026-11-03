/* Deep dive: table of contents scroll-spy, accordions, tabs, gentle GSAP reveals. */
(function () {
  "use strict";
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* accordions: one button per item, aria-expanded + hidden kept in step */
  [].forEach.call(document.querySelectorAll(".dd-acc-h"), function (btn) {
    btn.addEventListener("click", function () {
      var li = btn.closest(".dd-acc-i"), body = document.getElementById(btn.getAttribute("aria-controls"));
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      li.classList.toggle("on", open);
      if (body) {
        if (open) { body.hidden = false; if (window.gsap && !reduced) gsap.fromTo(body, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .35, ease: "power2.out" }); }
        else body.hidden = true;
      }
    });
  });

  /* tabs: arrow keys move between tabs */
  [].forEach.call(document.querySelectorAll(".dd-tabs"), function (list) {
    var tabs = [].slice.call(list.querySelectorAll(".dd-tab"));
    function pick(t, focus) {
      tabs.forEach(function (x) {
        var on = x === t, pane = document.getElementById(x.getAttribute("aria-controls"));
        x.setAttribute("aria-selected", on ? "true" : "false"); x.tabIndex = on ? 0 : -1;
        if (pane) pane.hidden = !on;
      });
      if (focus) t.focus();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { pick(t); });
      t.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") { ev.preventDefault(); pick(tabs[(i + (ev.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true); }
      });
    });
  });

  /* table of contents scroll-spy */
  var links = [].slice.call(document.querySelectorAll(".dd-toc a[href^='#']"));
  if (links.length && "IntersectionObserver" in window) {
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var current = null;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (en.isIntersecting) {
          if (current) current.classList.remove("on");
          current = map[en.target.id]; if (current) current.classList.add("on");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* reveals */
  function reveal() {
    if (!window.gsap || reduced) return;
    if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);
    [].forEach.call(document.querySelectorAll("[data-rev]"), function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9) { gsap.from(el, { opacity: 0, y: 24, duration: .9, ease: "power3.out" }); return; }
      if (window.ScrollTrigger) gsap.from(el, { opacity: 0, y: 28, duration: .9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });
  }
  if (document.readyState === "complete") reveal(); else addEventListener("load", reveal);
})();
