/*
 * Ambient background — built for smart-TV class hardware:
 *  - internal render resolution is capped (default 1280×720, 960×540 reduced)
 *    and CSS-scaled up to the 4K panel
 *  - frame rate capped at 24fps (20fps reduced)
 *  - auto reduced-effects mode on TV browsers / low-memory devices
 *  - fully pauses when the tab is hidden or after 2 minutes idle
 */
(function () {
  'use strict';

  /* ---- device classing ---- */
  function detectTV() {
    var ua = navigator.userAgent || '';
    if (/smart-?tv|tizen|web0s|webos|netcast|viera|bravia|hbbtv|crkey|roku|aft[bkms]|silk|philipstv|vidaa|maple/i.test(ua)) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
    if ((navigator.hardwareConcurrency || 8) <= 2) return true;
    // 4K-ish viewport with dpr 1 is typical of a TV browser
    if (window.screen && screen.width >= 2560 && (window.devicePixelRatio || 1) <= 1.25) return true;
    return false;
  }

  var stored = null;
  try { stored = localStorage.getItem('reducedFx'); } catch (e) {}
  var reduced = stored === '1' ? true : stored === '0' ? false : detectTV();
  if (reduced) document.body.classList.add('reduced');

  window.PerfMode = {
    get reduced() { return reduced; },
    set: function (v) {
      reduced = !!v;
      try { localStorage.setItem('reducedFx', v ? '1' : '0'); } catch (e) {}
      document.body.classList.toggle('reduced', reduced);
      setup();
    },
  };

  /* ---- particle field ---- */
  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d', { alpha: false });
  var W = 0, H = 0, parts = [];
  var FPS, FRAME_MS, running = true, lastFrame = 0, lastActivity = Date.now();
  var IDLE_PAUSE_MS = 2 * 60 * 1000;

  function setup() {
    var capW = reduced ? 960 : 1280;
    var scale = Math.min(1, capW / Math.max(1, window.innerWidth));
    W = canvas.width = Math.round(window.innerWidth * scale);
    H = canvas.height = Math.round(window.innerHeight * scale);
    FPS = reduced ? 20 : 24;
    FRAME_MS = 1000 / FPS;
    var n = reduced ? 14 : 40;
    parts = [];
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * W, y: Math.random() * H,
        r: 1 + Math.random() * (reduced ? 2 : 3),
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.08 - Math.random() * 0.3,
        a: 0.15 + Math.random() * 0.4,
        gold: Math.random() < 0.6,
      });
    }
  }

  function draw(now) {
    requestAnimationFrame(draw);
    if (!running || document.hidden) return;
    if (now - lastFrame < FRAME_MS) return; // fps cap
    lastFrame = now;
    if (Date.now() - lastActivity > IDLE_PAUSE_MS) return; // idle pause

    ctx.fillStyle = '#0b0e16';
    ctx.fillRect(0, 0, W, H);
    // soft vignette glow (cheap: one radial per frame, skipped in reduced mode)
    if (!reduced) {
      var g = ctx.createRadialGradient(W / 2, H * 0.15, 0, W / 2, H * 0.15, H * 0.9);
      g.addColorStop(0, 'rgba(255,176,58,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.y < -5) { p.y = H + 5; p.x = Math.random() * W; }
      if (p.x < -5) p.x = W + 5; else if (p.x > W + 5) p.x = -5;
      ctx.globalAlpha = p.a;
      ctx.fillStyle = p.gold ? '#ffcf5c' : '#5c7cff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function poke() { lastActivity = Date.now(); }
  ['pointerdown', 'pointermove', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, poke, { passive: true });
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { poke(); lastFrame = 0; }
  });
  var resizeT;
  window.addEventListener('resize', function () {
    clearTimeout(resizeT); resizeT = setTimeout(setup, 200);
  });

  window.BgFx = { pause: function () { running = false; }, resume: function () { running = true; poke(); } };

  setup();
  requestAnimationFrame(draw);
})();
