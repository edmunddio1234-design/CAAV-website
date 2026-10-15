/* Truck burst: the Mobile CAVE truck photo comes apart in pieces and goes back together, driven by scroll.
   Shared by the family sites; each site picks its own style so the effect is mixed up:
     "tiles"  - a grid of squares flies out in 3D (Immersion)
     "strips" - vertical slices fan up and down (AM Lab)
     "shards" - wedges burst out from the centre (CAAV)
   Usage: var b = TruckBurst(hostElement, { src: "/path/truck.jpg", style: "tiles" }); b.set(p);  // p: 0 whole, 1 fully apart
   The host must be position:relative with a size. No JS: nothing is added and the page shows what is underneath. */
(function () {
  "use strict";
  function rnd(seed) { var x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
  window.TruckBurst = function (host, opts) {
    opts = opts || {};
    var style = opts.style || "tiles", src = opts.src;
    var layer = document.createElement("div");
    layer.className = "tb-layer tb-" + style;
    layer.setAttribute("aria-hidden", "true");
    layer.style.cssText = "position:absolute;inset:0;z-index:" + (opts.z || 3) + ";pointer-events:none;perspective:900px;overflow:visible";
    host.appendChild(layer);
    var pieces = [], W = 0, H = 0, iw = 1280, ih = 720;

    function build() {
      layer.innerHTML = ""; pieces = [];
      W = host.clientWidth; H = host.clientHeight; if (!W || !H) return;
      var s = Math.max(W / iw, H / ih), bw = iw * s, bh = ih * s, ox = (W - bw) / 2, oy = (H - bh) / 2;
      function piece(x, y, w, h, i, clip) {
        var d = document.createElement("div");
        d.style.cssText = "position:absolute;left:" + x + "px;top:" + y + "px;width:" + w + "px;height:" + h + "px;" +
          "background:url(" + src + ") no-repeat;background-size:" + bw + "px " + bh + "px;background-position:" + (ox - x) + "px " + (oy - y) + "px;" +
          "will-change:transform,opacity;backface-visibility:hidden" + (clip ? ";clip-path:" + clip : "");
        layer.appendChild(d);
        var cx = x + w / 2 - W / 2, cy = y + h / 2 - H / 2, len = Math.max(1, Math.hypot(cx, cy));
        pieces.push({ el: d, i: i, dx: cx / len, dy: cy / len, dist: len, r1: rnd(i + 1), r2: rnd(i + 7), r3: rnd(i + 13) });
      }
      var i = 0;
      if (style === "strips") {
        var n = 12, sw = W / n;
        for (var k = 0; k < n; k++) piece(k * sw, 0, sw + 1, H, i++);
      } else if (style === "shards") {
        var m = 14;
        for (var j = 0; j < m; j++) {
          var a0 = (j / m) * Math.PI * 2, a1 = ((j + 1) / m) * Math.PI * 2, R = Math.hypot(W, H);
          var p0 = (50 + Math.cos(a0) * R / W * 100) + "% " + (50 + Math.sin(a0) * R / H * 100) + "%";
          var p1 = (50 + Math.cos(a1) * R / W * 100) + "% " + (50 + Math.sin(a1) * R / H * 100) + "%";
          piece(0, 0, W, H, i++, "polygon(50% 50%," + p0 + "," + p1 + ")");
          var mid = (a0 + a1) / 2, pc = pieces[pieces.length - 1]; pc.dx = Math.cos(mid); pc.dy = Math.sin(mid); pc.dist = Math.min(W, H) / 2;
        }
      } else {
        var cols = W > 600 ? 7 : 5, rows = Math.max(3, Math.round(cols * H / W)), tw = W / cols, th = H / rows;
        for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) piece(c * tw, r * th, tw + 1, th + 1, i++);
      }
      set(last);
    }

    var last = 0;
    function set(p) {
      last = p = Math.min(1, Math.max(0, p));
      var e = p * p * (3 - 2 * p); /* smoothstep */
      pieces.forEach(function (pc) {
        var t, o = 1 - Math.min(1, Math.max(0, (e - 0.25) / 0.6));
        if (style === "strips") {
          var dir = pc.i % 2 ? 1 : -1, spread = (pc.i - 5.5) / 6;
          t = "translate3d(" + (spread * W * 0.35 * e) + "px," + (dir * H * (0.6 + pc.r1 * 0.5) * e) + "px,0) rotate(" + (dir * 8 * pc.r2 * e) + "deg)";
        } else if (style === "shards") {
          var go = (pc.dist + Math.max(W, H) * 0.5) * e * (0.8 + pc.r1 * 0.5);
          t = "translate3d(" + (pc.dx * go) + "px," + (pc.dy * go) + "px," + (e * 140 * pc.r2) + "px) rotate(" + ((pc.r3 - 0.5) * 70 * e) + "deg)";
        } else {
          var gt = (pc.dist * 1.4 + 280) * e * (0.7 + pc.r1 * 0.6);
          t = "translate3d(" + (pc.dx * gt) + "px," + (pc.dy * gt) + "px," + (e * (260 * pc.r2 - 60)) + "px) rotateX(" + ((pc.r3 - 0.5) * 140 * e) + "deg) rotateY(" + ((pc.r1 - 0.5) * 140 * e) + "deg)";
        }
        pc.el.style.transform = t;
        pc.el.style.opacity = String(o);
      });
      layer.style.visibility = p >= 0.999 ? "hidden" : "visible";
    }
    var im = new Image();
    im.onload = function () { iw = im.naturalWidth; ih = im.naturalHeight; build(); };
    im.src = src;
    var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    build();
    return { set: set, rebuild: build, el: layer };
  };
})();
