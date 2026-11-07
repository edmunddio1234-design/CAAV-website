/* Every video on the page plays by itself, muted and looping, as soon as it comes on screen.
   Videos that have player controls keep them, so the viewer can still turn the sound on.
   Reduced motion: videos stay on their first frame. */
(function(){
  var reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  function prep(v){if(v.__ap)return;v.__ap=1;
    if(!v.__userSound){v.muted=true;v.setAttribute("muted","")}
    v.loop=true;v.setAttribute("loop","");v.playsInline=true;v.setAttribute("playsinline","");
    if(v.preload==="none")v.preload="metadata";
    /* once someone turns the sound on with the controls, leave their choice alone */
    v.addEventListener("volumechange",function(){if(!v.muted)v.__userSound=1});
    if(io)io.observe(v)}
  function go(v){if(reduced||!v.paused||v.__userPaused)return;var p=v.play();if(p&&p.catch)p.catch(function(){})}
  var io="IntersectionObserver" in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)go(e.target)})},{threshold:.1}):null;
  function scan(){[].forEach.call(document.querySelectorAll("video"),function(v){prep(v);if(!io)go(v);else{var r=v.getBoundingClientRect();if(r.width&&r.bottom>0&&r.top<innerHeight)go(v)}})}
  /* someone who presses pause on a player keeps it paused */
  document.addEventListener("pause",function(e){var v=e.target;if(v.tagName==="VIDEO"&&v.controls&&!v.ended&&document.visibilityState==="visible")v.__userPaused=1},true);
  document.addEventListener("play",function(e){if(e.target.tagName==="VIDEO")e.target.__userPaused=0},true);
  scan();document.addEventListener("DOMContentLoaded",scan);addEventListener("load",scan);
  ["touchstart","pointerdown","keydown"].forEach(function(t){addEventListener(t,scan,{passive:true,once:true})});
  /* pick up videos added later (background films, sliders) */
  if("MutationObserver" in window)new MutationObserver(function(){scan()}).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){if(!document.hidden)scan()},3000);
})();

/* smooth jumps for in-page links, done in script: CSS smooth scrolling throws off the scroll scenes' measurements on reload */
(function(){if(window.__anchorSmooth)return;function __fixAnchor(t,pad){var done=false;function go(){if(done)return;done=true;var d=t.getBoundingClientRect().top-pad;if(Math.abs(d)>4)window.scrollTo({top:scrollY+d,behavior:"auto"})}if("onscrollend" in window)addEventListener("scrollend",go,{once:true});setTimeout(go,1400)};window.__anchorSmooth=1;document.addEventListener("click",function(ev){var a=ev.target.closest&&ev.target.closest('a[href^="#"]');if(!a||ev.defaultPrevented)return;var id=a.getAttribute("href").slice(1),t=id&&document.getElementById(id);if(!t)return;ev.preventDefault();var pad=parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)||0,reduce=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;window.scrollTo({top:t.getBoundingClientRect().top+scrollY-pad,behavior:reduce?"auto":"smooth"});__fixAnchor(t,pad);if(history.replaceState)history.replaceState(null,"","#"+id)})})();

/* 2026-11-07 (Sonny): the solid blue top sections are replaced by a moving background video on every page.
   Each top section (.hero, .pagehead) gets a muted, looping film behind it; the autoplay code above plays it.
   A light wash keeps the words readable while letting the film show. Reduced motion: the film stays on its first frame. */
(function(){
  var MAP={"/": "https://immersion-in-motion.vercel.app/grand-opening-loop.mp4", "/cave": "https://immersion-in-motion.vercel.app/media/bgfilm/sp04-research-bg.mp4", "/team": "https://immersion-in-motion.vercel.app/media/bgfilm/sp07-ops-bg.mp4", "/about": "https://immersion-in-motion.vercel.app/media/bgfilm/sp01-education-bg.mp4", "/projects": "https://immersion-in-motion.vercel.app/media/bgfilm/sp05-mfg-bg.mp4", "/initiatives": "https://immersion-in-motion.vercel.app/media/bgfilm/sp01-education-bg.mp4", "/sectors/k12": "https://immersion-in-motion.vercel.app/media/bgfilm/sp01-education-bg.mp4", "/sectors/plants": "https://immersion-in-motion.vercel.app/media/bgfilm/wf-plant-bg.mp4", "/sectors/healthcare": "https://immersion-in-motion.vercel.app/media/bgfilm/sp03-health-bg.mp4", "/sectors/emergency": "https://immersion-in-motion.vercel.app/media/bgfilm/sp02-crisis-bg.mp4", "/sectors": "https://immersion-in-motion.vercel.app/media/bgfilm/wf-industry-bg.mp4", "/book-a-tour": "https://immersion-in-motion.vercel.app/media/bgfilm/sp07-ops-bg.mp4", "/sponsor-interest": "https://immersion-in-motion.vercel.app/media/bgfilm/workforce-of-tomorrow-bg.mp4", "/request-services": "https://am-lab-3d-printing.vercel.app/assets/media/print-film.mp4", "/media": "https://immersion-in-motion.vercel.app/media/bgfilm/grand-opening-bg.mp4", "/news": "https://immersion-in-motion.vercel.app/media/bgfilm/sp06-drone-bg.mp4", "/contact": "https://immersion-in-motion.vercel.app/media/bgfilm/sp07-ops-bg.mp4", "/deep-dive": "https://immersion-in-motion.vercel.app/media/bgfilm/sp04-research-bg.mp4", "*": "https://immersion-in-motion.vercel.app/grand-opening-loop.mp4"};
  function pick(){var p=location.pathname.replace(/\/index\.html$/,"/").replace(/\.html$/,"").replace(/\/+$/,"")||"/";
    var best="*";Object.keys(MAP).forEach(function(k){if(k!=="*"&&(p===k||(k!=="/"&&p.indexOf(k+"/")===0))&&(best==="*"||k.length>best.length))best=k});
    return MAP[best]}
  function add(){var src=pick();if(!src)return;
    [].forEach.call(document.querySelectorAll("section.hero,section.pagehead,div.hero#top"),function(sec){
      if(sec.querySelector(":scope > .hero-film"))return;
      var box=document.createElement("div");box.className="hero-film";box.setAttribute("aria-hidden","true");
      var v=document.createElement("video");v.muted=true;v.loop=true;v.playsInline=true;v.autoplay=true;v.preload="metadata";
      v.setAttribute("muted","");v.setAttribute("playsinline","");v.setAttribute("loop","");v.setAttribute("autoplay","");v.setAttribute("tabindex","-1");v.src=src;
      box.appendChild(v);sec.insertBefore(box,sec.firstChild);sec.classList.add("has-film")})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",add);else add();
})();

/* 2026-11-07 (Sonny): no dead white space. A full-page film runs behind every section and changes clip as each section
   scrolls into view, the way the IMPACT 3D Lab site works. The staff dashboard keeps its plain look. */
(function(){
  if(/^\/dashboard/.test(location.pathname)||window.__pageFilm)return;window.__pageFilm=1;
  var LIST=["https://immersion-in-motion.vercel.app/media/bgfilm/sp04-research-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/sp01-education-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/wf-industry-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/sp03-health-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/sp06-drone-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/sp05-mfg-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/wf-plant-bg.mp4", "https://immersion-in-motion.vercel.app/media/bgfilm/sp07-ops-bg.mp4"],reduced=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("film-page");
  function mk(){var v=document.createElement("video");v.muted=true;v.loop=true;v.playsInline=true;v.preload="metadata";
    v.setAttribute("muted","");v.setAttribute("loop","");v.setAttribute("playsinline","");v.setAttribute("tabindex","-1");return v}
  function start(){if(document.querySelector(".page-film"))return;
    var box=document.createElement("div");box.className="page-film";box.setAttribute("aria-hidden","true");
    var a=mk(),b=mk(),cur=a,idx=-1;a.className="on";box.appendChild(a);box.appendChild(b);document.body.insertBefore(box,document.body.firstChild);
    function show(i){i=i%LIST.length;if(i===idx)return;idx=i;var nxt=cur===a?b:a;nxt.src=LIST[i];
      var p=reduced?null:nxt.play();var swap=function(){nxt.classList.add("on");cur.classList.remove("on");var old=cur;cur=nxt;setTimeout(function(){if(old!==cur)old.pause()},900)};
      if(p&&p.then)p.then(swap).catch(swap);else nxt.addEventListener("loadeddata",swap,{once:true})}
    var secs=[].filter.call(document.querySelectorAll("main section, body > section"),function(s){return !s.classList.contains("hero")&&!s.classList.contains("pagehead")});
    show(0);
    if(!("IntersectionObserver" in window))return;
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting)show(secs.indexOf(e.target))})},{rootMargin:"-45% 0px -45% 0px"});
    secs.forEach(function(s){io.observe(s)})}
  if(document.body)start();else document.addEventListener("DOMContentLoaded",start);
})();

/* 2026-11-07 (Sonny): motion on the top films - slow camera drift, and the film slides as the page scrolls. */
(function(){
  if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  function go(){if(!window.gsap||!window.ScrollTrigger)return;try{gsap.registerPlugin(ScrollTrigger)}catch(e){}
    [].forEach.call(document.querySelectorAll(".hero-film video"),function(v){if(v.__mo)return;v.__mo=1;
      var sec=v.closest(".has-film");
      gsap.to(v,{yPercent:14,ease:"none",scrollTrigger:{trigger:sec,start:"top top",end:"bottom top",scrub:true}})})}
  if(document.readyState==="complete")setTimeout(go,50);else addEventListener("load",function(){setTimeout(go,50)});
})();
