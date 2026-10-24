/* Mobile CAVE launch pop-up. The date is ONE optional setting: add data-date="Weekday, Month D, YYYY · H:MM AM"
   (and data-end="YYYY-MM-DDT06:00:00Z" to stop showing after the event) to the script tag. Without it the pop-up says
   "Date to be announced". Include with:
   <script src="/assets/su-launch.js" data-tour="/book-a-tour" data-sponsor="/sponsor-interest" data-media="/media" defer></script>
   Shows once a week per visitor, never on the three target pages, closes with Esc or the X, returns focus. */
(function () {
  var s = document.currentScript; if (!s) return;
  var L = { tour: s.dataset.tour, sponsor: s.dataset.sponsor, media: s.dataset.media, rsvp: s.dataset.rsvp || s.dataset.tour };
  var DATE = s.dataset.date || '';
  if (s.dataset.end && Date.now() > new Date(s.dataset.end).getTime()) return;
  var here = location.pathname.replace(/\/$/, '');
  if ([L.tour, L.sponsor, L.media].some(function (u) { return u && u.replace(/\/$/, '') === here; })) return;
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
    function q(u) { return u + (u.indexOf('?') > -1 ? '&' : '?') + 'from=' + back; }
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
