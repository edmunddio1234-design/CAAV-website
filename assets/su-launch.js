/* Mobile CAVE launch pop-up and optional top banner. Include with:
   <script src="/assets/su-launch.js" data-tour="/book-a-tour" data-sponsor="/sponsor-interest" data-media="/media" defer></script>
   POP-UP: shows once a week per visitor, never on the three target pages, closes with Esc or the X, returns focus.
     The date is ONE optional setting: data-date="Weekday, Month D, YYYY · H:MM AM" (and data-end="YYYY-MM-DDT06:00:00Z"
     to stop showing after the event). Without it the pop-up says "Date to be announced".
   BANNER (optional): add data-banner="on" for a slim, dismissible strip at the top of the page (navy, gold text):
     "Mobile CAVE launch · Date to be announced" with "Book a tour" and "Become a sponsor" links.
     When data-date AND data-target="YYYY-MM-DDTHH:MM:SS-06:00" (ISO date-time) are both set, it shows the date and a
     live countdown ("N days") instead. Dismissing it is remembered per visitor. It shows on every page that includes
     it (including the target pages, where the link to the page you are on is left out), slides in smoothly
     instead of jumping the page, respects reduced motion and the phone safe area, and is hidden in print. */
(function () {
  var s = document.currentScript; if (!s) return;
  var L = { tour: s.dataset.tour, sponsor: s.dataset.sponsor, media: s.dataset.media, rsvp: s.dataset.rsvp || s.dataset.tour };
  var DATE = s.dataset.date || '';
  if (s.dataset.end && Date.now() > new Date(s.dataset.end).getTime()) return;
  var here = location.pathname.replace(/\/$/, '');
  function same(u) { return u && u.replace(/\/$/, '') === here; }

  /* ---------- banner (data-banner="on") ---------- */
  if (s.dataset.banner === 'on') banner();
  function banner() {
    var BKEY = 'su-launch-banner-hidden';
    try { if (localStorage.getItem(BKEY)) return; } catch (e) {}
    var TARGET = s.dataset.target ? new Date(s.dataset.target) : null;
    if (TARGET && isNaN(TARGET.getTime())) TARGET = null;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var bcss = '.su-b{position:relative;z-index:61;overflow:hidden;background:#00263A;color:#FFC72C;font-family:inherit;font-size:.8125rem;font-weight:500;line-height:1.35;border-bottom:2px solid #FFC72C}' +
      '.su-b__in{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 18px;min-height:44px;padding:6px 52px 6px 16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(52px,calc(env(safe-area-inset-right,0px) + 52px));padding-top:max(6px,env(safe-area-inset-top,0px));box-sizing:border-box;text-align:center}' +
      '.su-b__t{margin:0;letter-spacing:.04em}.su-b__t b{font-weight:600}' +
      '.su-b__c{display:inline-block;margin-left:8px;padding:2px 8px;border-radius:6px;background:#FFC72C;color:#00263A;font-variant-numeric:tabular-nums}' +
      '.su-b__l{display:flex;gap:4px 16px;flex-wrap:wrap;justify-content:center}' +
      '.su-b a{color:#FFC72C;text-decoration:underline;text-underline-offset:.2em;min-height:32px;display:inline-flex;align-items:center}.su-b a:hover{color:#FFD45C}' +
      '.su-b__x{position:absolute;top:50%;right:max(4px,env(safe-area-inset-right,0px));transform:translateY(-50%);width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:#FFC72C;font-size:22px;line-height:1;cursor:pointer}' +
      '.su-b__x:hover{background:rgba(255,199,44,.14)}' +
      '.su-b a:focus-visible,.su-b__x:focus-visible{outline:2px solid #FFC72C;outline-offset:2px;border-radius:4px}' +
      '@media print{.su-b{display:none!important}}';
    var st = document.createElement('style'); st.textContent = bcss; document.head.appendChild(st);
    var back = encodeURIComponent(location.pathname + location.search + location.hash);
    /* add ?from= (way back) only for links on this same site; a link to another site gets nothing, so it never 404s */
    function q(u) { var t; try { t = new URL(u, location.href); } catch (e) { return u; } if (t.origin !== location.origin) return u; return u + (u.indexOf('?') > -1 ? '&' : '?') + 'from=' + back; }
    var b = document.createElement('div'); b.className = 'su-b';
    b.setAttribute('role', 'region'); b.setAttribute('aria-label', 'Mobile CAVE launch announcement');
    var links = (L.tour && !same(L.tour) ? '<a href="' + q(L.tour) + '">Book a tour</a>' : '') +
                (L.sponsor && !same(L.sponsor) ? '<a href="' + q(L.sponsor) + '">Become a sponsor</a>' : '');
    b.innerHTML = '<div class="su-b__in"><p class="su-b__t"><b>Mobile CAVE launch</b> · <span data-su-b-when></span></p>' +
      (links ? '<span class="su-b__l">' + links + '</span>' : '') + '</div>' +
      '<button class="su-b__x" type="button" aria-label="Hide the launch announcement">&times;</button>';
    var when = b.querySelector('[data-su-b-when]');
    function paint() {
      if (DATE && TARGET) {
        var d = Math.ceil((TARGET.getTime() - Date.now()) / 864e5);
        when.textContent = DATE + ' ';
        if (d > 0) { var c = document.createElement('span'); c.className = 'su-b__c'; c.textContent = d + (d === 1 ? ' day' : ' days'); when.appendChild(c); }
        else if (d === 0) { var t = document.createElement('span'); t.className = 'su-b__c'; t.textContent = 'Today'; when.appendChild(t); }
      } else when.textContent = DATE || 'Date to be announced';
    }
    paint();
    var timer = DATE && TARGET ? setInterval(paint, 60000) : null;
    /* slide in: start at height 0 and grow to the strip's height, so the page moves down smoothly instead of jumping */
    if (!reduce) { b.style.height = '0px'; b.style.transition = 'height .35s ease'; }
    document.body.insertBefore(b, document.body.firstChild);
    if (!reduce) {
      var h = b.querySelector('.su-b__in').offsetHeight;
      requestAnimationFrame(function () { b.style.height = h + 'px'; });
      b.addEventListener('transitionend', function f() { b.style.height = ''; b.style.transition = ''; b.removeEventListener('transitionend', f); });
    }
    b.querySelector('.su-b__x').addEventListener('click', function () {
      try { localStorage.setItem(BKEY, String(Date.now())); } catch (e) {}
      if (timer) clearInterval(timer);
      if (reduce) { b.remove(); } else {
        b.style.height = b.offsetHeight + 'px'; b.style.transition = 'height .25s ease';
        requestAnimationFrame(function () { b.style.height = '0px'; });
        setTimeout(function () { b.remove(); }, 300);
      }
      var m = document.getElementById('main'); if (m) { if (!m.hasAttribute('tabindex')) m.setAttribute('tabindex', '-1'); m.focus({ preventScroll: true }); }
    });
  }

  /* ---------- pop-up (unchanged behavior) ---------- */
  if ([L.tour, L.sponsor, L.media].some(same)) return;
  var KEY = 'su-launch-seen';
  try { var t = +localStorage.getItem(KEY); if (t && Date.now() - t < 7 * 864e5) return; } catch (e) {}
  var css = '.su-l{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:max(16px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) max(16px,env(safe-area-inset-bottom,0px)) max(16px,env(safe-area-inset-left,0px));background:rgba(0,20,32,.72)}' +
    '.su-l__card{position:relative;max-width:520px;width:100%;background:#00263A;color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);font-family:inherit}' +
    '.su-l__band{height:8px;background:linear-gradient(90deg,#FFC72C 0 50%,#69B3E7 50% 100%)}' +
    '.su-l__body{padding:26px 26px 24px;display:grid;gap:14px}' +
    '.su-l__eye{font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;color:#FFC72C;margin:0}' +
    '.su-l__h{font-size:1.7rem;line-height:1.15;margin:0;font-weight:600}' +
    '.su-l__p{margin:0;color:rgba(255,255,255,.82);line-height:1.5}' +
    '.su-l__row{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}' +
    '.su-l__btn{display:block;text-align:center;padding:12px 14px;border-radius:10px;text-decoration:none;font-weight:600;min-height:44px;box-sizing:border-box}' +
    '.su-l__btn--gold{background:#FFC72C;color:#00263A}.su-l__btn--gold:hover{background:#FFD45C}' +
    '.su-l__btn--blue{background:transparent;color:#fff;border:1.5px solid #69B3E7}.su-l__btn--blue:hover{background:rgba(105,179,231,.15)}' +
    '.su-l__x{position:absolute;top:14px;right:12px;width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:#fff;font-size:24px;cursor:pointer}' +
    '.su-l__x:focus-visible,.su-l__btn:focus-visible{outline:3px solid #FFC72C;outline-offset:2px}' +
    '@media (prefers-reduced-motion:no-preference){.su-l__card{animation:suin .35s ease-out}@keyframes suin{from{transform:translateY(16px);opacity:.4}}}';
  function open() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var prev = document.activeElement, back = encodeURIComponent(location.pathname + location.search + location.hash);
    /* add ?from= (way back) only for links on this same site; a link to another site gets nothing, so it never 404s */
    function q(u) { var t; try { t = new URL(u, location.href); } catch (e) { return u; } if (t.origin !== location.origin) return u; return u + (u.indexOf('?') > -1 ? '&' : '?') + 'from=' + back; }
    var w = document.createElement('div'); w.className = 'su-l';
    w.innerHTML = '<div class="su-l__card" role="dialog" aria-modal="true" aria-labelledby="su-l-h">' +
      '<div class="su-l__band"></div><button class="su-l__x" type="button" aria-label="Close">&times;</button>' +
      '<div class="su-l__body"><p class="su-l__eye">' + (DATE ? DATE : 'Launch event · Date to be announced') + '</p>' +
      '<h2 class="su-l__h" id="su-l-h">The Southern University Mobile CAVE launches</h2>' +
      '<p class="su-l__p">Ribbon cutting and live 3D demos at the Leon Waters Museum on the Southern University campus.' + (DATE ? '' : ' Book a tour or sign up as a sponsor now and we will send you the date.') + '</p>' +
      '<div class="su-l__row">' +
      (L.tour ? '<a class="su-l__btn su-l__btn--gold" href="' + q(L.tour) + '">Book a school tour</a>' : '') +
      (L.sponsor ? '<a class="su-l__btn su-l__btn--blue" href="' + q(L.sponsor) + '">Become a sponsor</a>' : '') +
      (L.media ? '<a class="su-l__btn su-l__btn--blue" href="' + q(L.media) + '">Media and press</a>' : '') +
      '</div></div></div>';
    document.body.appendChild(w);
    function close() { w.remove(); document.removeEventListener('keydown', key); try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} if (prev && prev.focus) prev.focus(); }
    function key(e) {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { var f = w.querySelectorAll('a,button'), a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    }
    w.querySelector('.su-l__x').addEventListener('click', close);
    w.addEventListener('click', function (e) { if (e.target === w) close(); });
    [].forEach.call(w.querySelectorAll('a'), function (a) { a.addEventListener('click', function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} }); });
    document.addEventListener('keydown', key);
    w.querySelector('.su-l__btn, .su-l__x').focus();
  }
  if (document.readyState === 'complete') setTimeout(open, 1200); else window.addEventListener('load', function () { setTimeout(open, 1200); });
})();
