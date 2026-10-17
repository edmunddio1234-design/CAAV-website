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
