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
 * - pauses the piece while it is off screen or the tab is hidden: animation
 *   frames are held back (and CSS animations paused via `is-idle` on <html>)
 *   until it is visible again;
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
  var visible = !document.hidden;
  var inView = true;
  var active = visible && inView;
  var held = new Map(); // fake id -> callback, while paused
  var moved = new Map(); // fake id -> real id, once resumed
  var nextId = -1;

  window.requestAnimationFrame = function (cb) {
    if (active) return nativeRAF(cb);
    var id = nextId--;
    held.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = function (id) {
    if (id < 0) {
      held.delete(id);
      if (moved.has(id)) nativeCAF(moved.get(id));
      moved.delete(id);
    } else nativeCAF(id);
  };

  function update() {
    var now = visible && inView;
    if (now === active) return;
    active = now;
    root.classList.toggle('is-idle', !active);
    if (active) {
      moved.clear();
      held.forEach(function (cb, id) {
        moved.set(id, nativeRAF(cb));
      });
      held.clear();
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
