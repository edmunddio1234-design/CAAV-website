/* Family top menu: the same behaviour on all four sites (XR Jags, formerly the CAAV site; Immersion in Motion, AM Lab, Foundations).
   - A thin progress line runs along the top of the header; its filled part is the truck blue.
   - The menu titles are the contextual menu: the title for the section on screen (or the page you are on)
     turns bright with a small truck-blue dot; the others stay dim. Same rule as the 21tsi reference.
   Markup: put data-fnav on the element that holds the menu links. The header is the closest <header>,
   or the element with data-fnav-head. No JS: the menu works as plain links. */
(function () {
  "use strict";
  var nav = document.querySelector("[data-fnav]");
  if (!nav) return;
  var head = document.querySelector("[data-fnav-head]") || nav.closest("header") || nav.parentElement;
  document.documentElement.classList.add("fnav-on");
  if (getComputedStyle(head).position === "static") head.style.position = "relative";

  /* progress line (AM Lab already has one: reuse it) */
  var fill = head.querySelector(".prog i");
  if (!fill) {
    var line = document.createElement("div");
    line.className = "fn-prog"; line.setAttribute("aria-hidden", "true");
    line.innerHTML = "<i></i>";
    head.insertBefore(line, head.firstChild);
    fill = line.firstChild;
  }
  function prog() {
    var m = document.documentElement.scrollHeight - innerHeight;
    fill.style.transform = "scaleX(" + (m > 0 ? Math.min(1, Math.max(0, scrollY / m)) : 0) + ")";
  }

  /* contextual titles */
  var links = [].slice.call(nav.querySelectorAll("a"));
  var here = location.pathname.replace(/index\.html$/, "");
  var anchored = links.map(function (a) {
    var h = a.getAttribute("href") || "", id = h.charAt(0) === "#" ? h.slice(1) : null;
    return { a: a, el: id ? document.getElementById(id) : null };
  });
  function setOn(a) { links.forEach(function (l) { l.classList.toggle("fn-on", l === a); }); }
  function pageMatch() {
    var best = null;
    links.forEach(function (a) {
      if (a.getAttribute("aria-current")) best = a;
      else if (!best) {
        try { var u = new URL(a.href, location.href); if (u.origin === location.origin && u.pathname.replace(/index\.html$/, "") === here && !u.hash) best = a; } catch (e) {}
      }
    });
    return best;
  }
  var pageOn = pageMatch();
  function context() {
    var line = innerHeight * 0.4, pick = null;
    anchored.forEach(function (x) {
      if (!x.el) return;
      var r = x.el.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) pick = x.a;
    });
    setOn(pick || pageOn);
  }
  var ticking = false;
  function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(function () { ticking = false; prog(); context(); }); }
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  prog(); context();
})();
