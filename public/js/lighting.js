/*
 * Lighting — talks straight from the browser to up to 4 WLED controllers
 * on the LAN via WLED's JSON state API (POST http://<ip>/json/state).
 *
 * Bodies are sent as plain text so the request is a CORS "simple request"
 * (no preflight); WLED replies with Access-Control-Allow-Origin: *.
 * Every call is fire-and-forget with a short timeout — a dead controller
 * must never block or slow down the UI.
 */
(function () {
  'use strict';

  var seq = 0; // stale-command guard: only the latest state may write

  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [255, 149, 0];
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function post(ip, payload) {
    if (!ip) return Promise.resolve(false);
    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 1800);
    return fetch('http://' + ip + '/json/state', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined,
    }).then(function (r) { return r.ok; })
      .catch(function () { return false; })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // Full strip in one solid color (segment 0 spans the whole strip).
  function fullColor(dev, hex) {
    return post(dev.ip, {
      on: true, bri: 255, transition: 4,
      seg: [{ id: 0, start: 0, stop: dev.ledCount || 300, grp: 1, spc: 0, fx: 0, sx: 128, col: [hexToRgb(hex), [0, 0, 0], [0, 0, 0]] }],
    });
  }

  function off(dev) {
    return post(dev.ip, { on: false, transition: 4 });
  }

  // Light only [start, stop) in `hex`, everything else on that strip black.
  // Uses WLED's per-range individual control: seg.i = [start,stop,color, ...]
  function rangeOnly(dev, start, stop, hex) {
    var count = dev.ledCount || 300;
    var s = Math.max(0, Math.min(start, count));
    var e = Math.max(s + 1, Math.min(stop, count));
    var rgb = hexToRgb(hex);
    var i = [];
    if (s > 0) i.push(0, s, [0, 0, 0]);
    i.push(s, e, rgb);
    if (e < count) i.push(e, count, [0, 0, 0]);
    return post(dev.ip, {
      on: true, bri: 255, transition: 2,
      seg: [{ id: 0, start: 0, stop: count, fx: 0, frz: false, i: i }],
    });
  }

  function devices(settings) {
    return (settings.devices || []).slice(0, 4);
  }

  var Lighting = {
    /* Gallery / idle: every strip fully on in the global idle color. */
    applyIdle: function (settings) {
      var my = ++seq;
      devices(settings).forEach(function (dev) {
        if (my !== seq) return;
        if (settings.masterOn) fullColor(dev, settings.idleColor); else off(dev);
      });
    },

    /* Trophy open: only its LED range lights up; all other LEDs everywhere off. */
    highlight: function (trophy, settings) {
      var my = ++seq;
      devices(settings).forEach(function (dev, idx) {
        if (my !== seq) return;
        if (!settings.masterOn) { off(dev); return; }
        if (idx === (trophy.device - 1)) rangeOnly(dev, trophy.ledStart, trophy.ledStop, trophy.color);
        else off(dev);
      });
    },

    /* Admin: test one range live (same visual as highlight). */
    testRange: function (deviceNo, start, stop, hex, settings) {
      var my = ++seq;
      devices(settings).forEach(function (dev, idx) {
        if (my !== seq) return;
        if (idx === (deviceNo - 1)) rangeOnly(dev, start, stop, hex);
        else off(dev);
      });
    },

    allOn: function (settings) {
      var my = ++seq;
      devices(settings).forEach(function (dev) { if (my === seq) fullColor(dev, settings.idleColor); });
    },

    allOff: function (settings) {
      var my = ++seq;
      devices(settings).forEach(function (dev) { if (my === seq) off(dev); });
    },
  };

  window.Lighting = Lighting;
})();
