/* AutoDrive: a blow-out plays on its own, on a loop, while it is on screen and nobody is scrolling.
   The moment the wheel, touch, keys or scrollbar move, the scroll takes over and the picture follows it exactly;
   when the scroll stops for a moment, the loop carries on from where the scroll left it. */
window.AutoDrive=window.AutoDrive||function(el,render,opts){
  opts=opts||{};var CYCLE=opts.cycle||9000,REST=opts.rest||1400,IDLE=1600;
  if(!window.__adUser){window.__adUser={t:-1e9};["wheel","touchstart","touchmove","keydown","pointerdown"].forEach(function(ev){addEventListener(ev,function(){window.__adUser.t=performance.now()},{passive:true})})}
  var scrollP=0,p=0,seen=false,prev=0,rest=0,reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  if("IntersectionObserver" in window)new IntersectionObserver(function(es){seen=es[0].isIntersecting&&es[0].intersectionRatio>=.35},{threshold:[0,.35,.6]}).observe(el);
  function user(){return performance.now()-window.__adUser.t<IDLE}
  function tick(now){requestAnimationFrame(tick);var dt=prev?Math.min(100,now-prev):0;prev=now;
    if(reduced||user()||!seen||document.hidden)return;
    if(rest>0){rest-=dt;return}
    p+=dt/CYCLE;if(p>=1){p=0;rest=REST}render(p)}
  requestAnimationFrame(tick);
  return {scroll:function(v){scrollP=v;p=v;render(v)}, get:function(){return p}};
};

/* CAAV top section: "Educating tomorrow's workforce" plays as a 3D scroll animation in the big image slot.
   The Mobile CAVE truck opens up to show the 3D room inside as you scroll; the slot holds still (pinned) while it plays.
   100 frames from /assets/media/cave/ (AI-generated concept film, same frames as the Immersion in Motion site). Reduced motion, no JS or no GSAP: the slot's photo shows. */
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
  /* plays on its own while on screen; the scroll takes over the moment it moves */
  var drive = AutoDrive(fig, function (p) { var i = Math.min(N - 1, Math.round(p * (N - 1))); if (i !== want) { want = i; draw(want); } }, { cycle: 9000, rest: 1500 });
  ScrollTrigger.create({
    trigger: fig, start: "center 55%", end: "+=280%", pin: true, pinSpacing: true, anticipatePin: 1, refreshPriority: 1,
    onUpdate: function (s) { drive.scroll(s.progress); }
  });
  /* precise: the frame follows the scroll position exactly */
  addEventListener("load", function () { ScrollTrigger.refresh(); });
})();
