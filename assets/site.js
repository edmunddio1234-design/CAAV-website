/* Immersion in Motion campaign: shared behavior. Plain JS, no build step. */
(function () {
  "use strict";
  var MAIL = "edmund@missionmetrics.solutions";

  function revealAll() {
    document.querySelectorAll("[data-rise]").forEach(function (e) { e.style.opacity = 1; e.style.transform = "none"; });
  }

  // Live countdowns. The numbers already in the HTML stay if this fails.
  function daysTo(iso) {
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d = new Date(iso + "T00:00:00");
    return Math.max(0, Math.round((d - t) / 86400000));
  }
  document.querySelectorAll("[data-days]").forEach(function (el) {
    try { el.textContent = daysTo(el.getAttribute("data-days")); } catch (e) {}
  });

  // Motion: GSAP inside matchMedia so "reduce motion" is respected (Apple HIG).
  if (window.gsap && window.ScrollTrigger && window.matchMedia) {
    gsap.registerPlugin(ScrollTrigger);
    var mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", function () {
      var k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--motion-scale")) || 1;
      gsap.utils.toArray("[data-rise]").forEach(function (el) {
        gsap.to(el, { opacity: 1, y: 0, duration: .7 * k, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
      gsap.from(".hero h1,.hero .lede,.hero .btn", { y: 26 * k, opacity: 0, duration: .8 * k, ease: "power3.out", stagger: .12 });
      gsap.from(".stats div,.door", { y: 20 * k, opacity: 0, duration: .7 * k, ease: "power3.out", stagger: .08, delay: .3 });
    });
    mm.add("(prefers-reduced-motion: reduce)", revealAll);
  } else {
    revealAll();
  }

  // Photo and video spots: show a labeled frame until the real file is added.
  document.querySelectorAll(".slot").forEach(function (fig) {
    var media = fig.querySelector("img,video");
    if (!media) return;
    function miss() { fig.classList.add("missing"); }
    if (media.tagName === "IMG") {
      media.addEventListener("error", miss);
      if (media.complete && media.naturalWidth === 0) miss();
    } else {
      // preload="none" never fetches the file, so no error fires. Ask the server whether it exists.
      var src = (media.querySelector("source") || media).getAttribute("src");
      media.addEventListener("error", miss, true);
      if (window.fetch && src) {
        fetch(src, { method: "HEAD" }).then(function (r) { if (!r.ok) miss(); }).catch(miss);
      }
    }
  });

  // Mobile tab bar: mark the section in view.
  var tabs = document.querySelectorAll(".tabbar a");
  if (tabs.length && "IntersectionObserver" in window) {
    var map = {};
    tabs.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && map[e.target.id]) {
          tabs.forEach(function (a) { a.removeAttribute("aria-current"); });
          map[e.target.id].setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  // Booking and sponsor form: opens the visitor's own email app with the request filled in.
  var form = document.getElementById("request-form");
  if (form) {
    var status = form.querySelector(".status");
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var f = new FormData(form), g = function (k) { return String(f.get(k) || "").trim(); };
      var subject = "Immersion in Motion: " + g("want") + " (" + g("org") + ")";
      var body = [
        "Name: " + g("name"),
        "Organization: " + g("org"),
        "Email: " + g("email"),
        "Phone: " + (g("phone") || "not given"),
        "We are a: " + g("kind"),
        "We would like to: " + g("want"),
        "",
        "What stops us from training more people:",
        g("barrier") || "not given",
        "",
        "I agree to be contacted about this request."
      ].join("\n");
      status.className = "status ok";
      status.textContent = "Your email app should open with this request filled in. Press send there. If nothing opens, email " + MAIL + ".";
      window.location.href = "mailto:" + MAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    });
  }
})();
