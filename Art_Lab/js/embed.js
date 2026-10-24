/**
 * Art Lab embed mode: lets a piece run as a quiet live preview inside a card.
 *
 * Load it first, as a classic script in the piece's <head>:
 *   <script src="../js/embed.js"></script>
 *
 * When the page URL has ?embed=1 it:
 * - adds the class `is-embed` to <html>, so the piece's CSS can hide its own
 *   panels, buttons and intro and pin its main canvas to the frame;
 * - mutes everything: media elements never play, Web Audio stays suspended,
 *   and alert() is a no-op;
 * - runs the piece at most at 30 frames a second, and pauses it while it is
 *   off screen or the tab is hidden: animation frames are held back (and CSS
 *   animations paused via `is-idle` on <html>) until it is visible again;
 * - exposes `window.ArtEmbed` for piece-specific savings:
 *     ArtEmbed.on            true in embed mode
 *     ArtEmbed.dpr(max=1.5)  device pixel ratio, capped in embed mode
 *     ArtEmbed.ready()       tell the Art Lab the first frame is drawn
 *                            (call it when `ArtEmbed.manualReady` is set)
 *
 * Without ?embed=1 nothing changes: ArtEmbed.on is false and dpr() is the
 * plain device pixel ratio.
 */
(function () {
  'use strict';

  var on = false;
  try {
    on = new URLSearchParams(location.search).get('embed') === '1';
  } catch (e) {
    on = false;
  }

  var api = {
    on: on,
    manualReady: false,
    dpr: function (max) {
      var d = window.devicePixelRatio || 1;
      return on ? Math.min(d, max || 1.5) : d;
    },
    ready: function () {},
  };
  window.ArtEmbed = api;
  if (!on) return;

  var root = document.documentElement;
  root.classList.add('is-embed');

  // Shared embed styles: no scrollbars, no selection, nothing to grab.
  var style = document.createElement('style');
  style.textContent =
    'html.is-embed,html.is-embed body{overflow:hidden!important;background:#000;' +
    '-webkit-user-select:none;user-select:none;cursor:default}' +
    'html.is-embed.is-idle *,html.is-embed.is-idle *::before,html.is-embed.is-idle *::after' +
    '{animation-play-state:paused!important}';
  (document.head || root).appendChild(style);

  // ---------- Silence ----------
  window.alert = function () {};
  var Media = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
  if (Media) {
    Media.play = function () {
      this.muted = true;
      return Promise.resolve();
    };
  }
  var NativeAudio = window.Audio;
  if (NativeAudio) {
    // Don't even download a soundtrack that will never play.
    window.Audio = function (src) {
      var a = new NativeAudio();
      a.preload = 'none';
      a.muted = true;
      if (src) a.src = src;
      return a;
    };
  }
  ['AudioContext', 'webkitAudioContext'].forEach(function (name) {
    var Native = window[name];
    if (!Native) return;
    var Silent = function (opts) {
      var ctx = new Native(opts);
      try {
        ctx.suspend();
      } catch (e) {}
      ctx.resume = function () {
        return Promise.resolve();
      };
      return ctx;
    };
    Silent.prototype = Native.prototype;
    window[name] = Silent;
  });

  // ---------- Pause when not seen ----------
  var nativeRAF = window.requestAnimationFrame.bind(window);
  var nativeCAF = window.cancelAnimationFrame.bind(window);
  // A preview runs at most at 30 frames a second (it shares the Art Lab's
  // thread), and not at all while it can't be seen: frame callbacks wait.
  var FRAME_MS = 1000 / 30;
  var visible = !document.hidden;
  var inView = true;
  var active = visible && inView;
  var pending = new Map(); // id -> { cb, raf }
  var nextId = 1;
  var lastFrame = -1e9;

  function schedule(id) {
    var e = pending.get(id);
    e.raf = nativeRAF(function (t) {
      e.raf = 0;
      if (!pending.has(id) || !active) return; // held until visible again
      // several loops may share a frame; otherwise skip frames to keep 30 fps
      if (t !== lastFrame && t - lastFrame < FRAME_MS - 2) return schedule(id);
      lastFrame = t;
      pending.delete(id);
      e.cb(t);
    });
  }

  window.requestAnimationFrame = function (cb) {
    var id = nextId++;
    pending.set(id, { cb: cb, raf: 0 });
    if (active) schedule(id);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    var e = pending.get(id);
    if (!e) return;
    if (e.raf) nativeCAF(e.raf);
    pending.delete(id);
  };

  function update() {
    var now = visible && inView;
    if (now === active) return;
    active = now;
    root.classList.toggle('is-idle', !active);
    if (active) {
      pending.forEach(function (e, id) {
        if (!e.raf) schedule(id);
      });
    }
  }

  document.addEventListener('visibilitychange', function () {
    visible = !document.hidden;
    update();
  });
  // Watch a fixed sentinel that always covers this frame's viewport: the
  // pieces' own <html>/<body> boxes are not reliable (some are zero-height).
  if ('IntersectionObserver' in window) {
    var watch = function () {
      var sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none';
      document.body.appendChild(sentinel);
      new IntersectionObserver(function (entries) {
        inView = entries[entries.length - 1].isIntersecting;
        update();
      }).observe(sentinel);
    };
    if (document.body) watch();
    else document.addEventListener('DOMContentLoaded', watch);
  }
  // The Art Lab can also pause and resume a preview directly.
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || !e.data || e.data.artlab === undefined) return;
    if (e.data.artlab === 'pause') inView = false;
    else if (e.data.artlab === 'resume') inView = true;
    update();
  });

  // ---------- Ready signal ----------
  var sent = false;
  api.ready = function () {
    if (sent) return;
    sent = true;
    try {
      if (window.parent !== window) window.parent.postMessage({ artlab: 'ready' }, location.origin);
    } catch (e) {}
  };
  window.addEventListener('load', function () {
    if (api.manualReady) return;
    nativeRAF(function () {
      nativeRAF(api.ready);
    });
  });
})();
