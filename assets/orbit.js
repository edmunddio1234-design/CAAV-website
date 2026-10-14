/* Orbit — 21tsi-style circles ported from AM Lab (assets/stage.js, "orbit" section).
   Up to three thin circles with "+" ticks sliding on the rim and numbers tangent to the rim that re-roll per section.
   Each top-level block of <main> gets a mode in a varied cycle (first block = big). Blocks with forms or dense
   tables get "none" so text stays readable. Circles drift and breathe with scroll, split mid-section and merge at the edges.
   Needs GSAP 3.12.5 + ScrollTrigger. No JS or no GSAP: nothing. Reduced motion: one static faint circle.
   A block can override its mode with data-orbit="big|one|small|left|right|two|three|none". */
(function(){"use strict";
if(window.__orbit)return;window.__orbit=1;
var reduced=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
if(!(window.gsap&&window.ScrollTrigger))return;
var main=document.querySelector("main");if(!main)return;
gsap.registerPlugin(ScrollTrigger);

/* ---------- inject the svg ---------- */
var NS="http://www.w3.org/2000/svg";
var svg=document.createElementNS(NS,"svg");
svg.setAttribute("class","orbit");svg.setAttribute("viewBox","-600 -400 1200 800");
svg.setAttribute("preserveAspectRatio","xMidYMid meet");svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
for(var i=0;i<3;i++){
  var g=document.createElementNS(NS,"g");g.setAttribute("class","oc");g.setAttribute("data-i",String(i));
  var ci=document.createElementNS(NS,"circle");ci.setAttribute("r","300");g.appendChild(ci);
  var tg=document.createElementNS(NS,"g");tg.setAttribute("class","ticks");g.appendChild(tg);
  var ng=document.createElementNS(NS,"g");ng.setAttribute("class","nums");g.appendChild(ng);
  svg.appendChild(g);
}
document.body.insertBefore(svg,document.body.firstChild);

var circles=[].slice.call(svg.querySelectorAll(".oc")).map(function(g,i){
  var ticks=[],nums=[],tg=g.querySelector(".ticks"),ng=g.querySelector(".nums");
  for(var k=0;k<3;k++){var p=document.createElementNS(NS,"path");p.setAttribute("d","M-7 0H7M0 -7V7");tg.appendChild(p);ticks.push({el:p,a:Math.random()*360,v:(Math.random()*.06+.02)*(Math.random()<.5?-1:1)})}
  for(var n=0;n<2;n++){var t=document.createElementNS(NS,"text");t.setAttribute("text-anchor","middle");ng.appendChild(t);nums.push({el:t,val:0,shown:0})}
  return {g:g,c:g.querySelector("circle"),ticks:ticks,nums:nums,x:0,y:10,r:300,o:0,split:0,spin:i*120,dir:i%2?-1:1,ph:i*2.1};
});

/* ---------- reduced motion: one static faint circle ---------- */
if(reduced){
  svg.classList.add("still");
  var c0=circles[0];
  c0.g.style.opacity="1";c0.g.setAttribute("transform","translate(80 30)");c0.c.setAttribute("r","264");
  c0.ticks.forEach(function(tk){var a=tk.a*Math.PI/180;tk.el.setAttribute("transform","translate("+(Math.cos(a)*264).toFixed(1)+" "+(Math.sin(a)*264).toFixed(1)+") rotate(45)")});
  circles.slice(1).forEach(function(c){c.g.style.opacity="0"});
  /* blocks marked data-orbit="none" (e.g. the video carousel) hide the static circle while in view */
  var off=[].slice.call(document.querySelectorAll('[data-orbit="none"]'));
  if(off.length&&"IntersectionObserver" in window){var vis=new Set();
    var io=new IntersectionObserver(function(es){es.forEach(function(e){e.isIntersecting?vis.add(e.target):vis.delete(e.target)});svg.style.opacity=vis.size?"0":""},{rootMargin:"-30% 0px -30% 0px"});
    off.forEach(function(el){io.observe(el)});}
  return;
}

var LAYOUT={
  one:[{x:0,y:10,r:300,o:1},{x:0,y:10,r:300,o:0},{x:0,y:10,r:300,o:0}],
  big:[{x:80,y:30,r:390,o:1},{x:80,y:30,r:390,o:0},{x:80,y:30,r:390,o:0}],
  small:[{x:330,y:-60,r:160,o:1},{x:330,y:-60,r:160,o:0},{x:330,y:-60,r:160,o:0}],
  left:[{x:-330,y:40,r:240,o:1},{x:-330,y:40,r:240,o:0},{x:-330,y:40,r:240,o:0}],
  two:[{x:-190,y:10,r:330,o:1,split:1},{x:190,y:10,r:330,o:1,split:1},{x:0,y:10,r:330,o:0}],
  three:[{x:-280,y:20,r:260,o:1,split:1},{x:0,y:20,r:260,o:1,split:1},{x:280,y:20,r:260,o:1,split:1}],
  right:[{x:300,y:-120,r:270,o:1},{x:300,y:170,r:290,o:1},{x:300,y:20,r:280,o:0}],
  none:[{x:0,y:10,r:300,o:0},{x:0,y:10,r:300,o:0},{x:0,y:10,r:300,o:0}]
};
var CYCLE=["one","none","small","two","none","left","none","right"];
var SCALE=.8; /* circles ~20% smaller than the 21tsi originals */

/* ---------- pick the blocks: main's children, or the sections inside a content wrapper ---------- */
function kids(el){return [].slice.call(el.children).filter(function(k){return !/^(SCRIPT|STYLE|TEMPLATE|NOSCRIPT)$/.test(k.tagName)})}
var blocks=[];
kids(main).forEach(function(el){
  var inner=kids(el);
  if(el.tagName!=="SECTION"&&inner.filter(function(k){return k.tagName==="SECTION"}).length>=2)blocks=blocks.concat(inner);
  else blocks.push(el);
});
blocks=blocks.filter(function(el){return el.offsetHeight>=80});
if(!blocks.length){svg.remove();return}

/* dense content (forms, big tables, plan boards, long lists) gets no circles */
var DENSE="#board-sec,#budget,#list,#book,.cal-layout,.trees";
function rows(el){var n=0;[].forEach.call(el.querySelectorAll("table"),function(t){n=Math.max(n,t.rows.length)});return n}
function isDense(el){
  if(el.matches(DENSE)||el.querySelector(DENSE))return true;
  if(el.querySelector("form,textarea,select"))return true;
  return rows(el)>=9;
}
var ci2=0,prev=null;
var modes=blocks.map(function(el,i){
  var m=el.getAttribute("data-orbit");
  if(!m||!LAYOUT[m]){
    if(i===0)m="big";
    else if(isDense(el))m="none";
    else{m=CYCLE[ci2%CYCLE.length];ci2++;if(m==="none"&&prev==="none"){m=CYCLE[ci2%CYCLE.length];ci2++}}
  }
  prev=m;
  /* lighter tables: keep circles but at half strength */
  return {m:m,dim:(m!=="none"&&el.querySelector("table"))?.5:1};
});

/* ---------- motion ---------- */
function reroll(){circles.forEach(function(c){c.nums.forEach(function(n){var to=Math.floor(120+Math.random()*2800);var o={v:n.shown};gsap.to(o,{v:to,duration:1.1,ease:"power2.out",onUpdate:function(){n.shown=Math.round(o.v);n.el.textContent=String(n.shown)}})})})}
var cur=null;
function orbitTo(md){var key=md.m+"|"+md.dim;if(key===cur)return;cur=key;var L=LAYOUT[md.m]||LAYOUT.one;
  circles.forEach(function(c,i){var t=L[i];gsap.to(c,{x:t.x,y:t.y,r:t.r,o:t.o*md.dim,split:t.split||0,duration:1.4,ease:"power3.inOut",overwrite:true})});
  if(md.m!=="none")reroll();
}
var scrollSpin=0;
addEventListener("scroll",function(){scrollSpin=scrollY*.012},{passive:true});
var run=!document.hidden,secP=.5;
document.addEventListener("visibilitychange",function(){run=!document.hidden});
gsap.ticker.add(function(){
  if(!run)return;var r60=gsap.ticker.deltaRatio(60);
  var t=scrollY,sp=Math.sin(secP*Math.PI); /* 0 at block edges, 1 mid-block: circles merge at the edges and split in the middle */
  circles.forEach(function(c){
    c.spin+=.025*c.dir*r60;
    c.g.style.opacity=c.o.toFixed(3);
    if(c.o<.01)return;
    var mx=c.x*(c.split?(.25+.75*sp):1)+Math.sin(t/900+c.ph)*45,
        my=c.y+Math.cos(t/1100+c.ph)*45,
        mr=Math.max(40,c.r*SCALE*(1+.14*Math.sin(t/700+c.ph*1.7)));
    c.g.setAttribute("transform","translate("+mx.toFixed(1)+" "+my.toFixed(1)+")");
    c.c.setAttribute("r",mr.toFixed(1));
    c.ticks.forEach(function(tk){tk.a+=tk.v*r60;var a=(tk.a+c.spin+scrollSpin*c.dir)*Math.PI/180;
      tk.el.setAttribute("transform","translate("+(Math.cos(a)*mr).toFixed(1)+" "+(Math.sin(a)*mr).toFixed(1)+") rotate(45)")});
    c.nums.forEach(function(n,k){var deg=c.ticks[k].a+c.spin+scrollSpin*c.dir-9,a=deg*Math.PI/180,rr=mr+30;
      n.el.setAttribute("transform","translate("+(Math.cos(a)*rr).toFixed(1)+" "+(Math.sin(a)*rr).toFixed(1)+") rotate("+(deg+90).toFixed(1)+")")});
  });
});
gsap.from(svg,{opacity:0,duration:1.6,ease:"power2.out",delay:.3});

/* ---------- per-block switching ---------- */
blocks.forEach(function(el,i){
  ScrollTrigger.create({trigger:el,start:"top 55%",end:"bottom 55%",
    onUpdate:function(self){if(self.isActive)secP=self.progress},
    onToggle:function(self){if(self.isActive)orbitTo(modes[i])}});
});
orbitTo(modes[0]);
addEventListener("load",function(){ScrollTrigger.refresh()});
})();
