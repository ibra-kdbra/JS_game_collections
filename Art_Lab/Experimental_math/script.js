/**
 * Experimental Math
 *
 * Particles follow a mathematical vector field and leave fading trails. The
 * page cycles through five fields, each a small formula in x, y and time t:
 *
 *   Interference   two families of sine and cosine waves crossing
 *   Rose           headings that turn k times faster than the polar angle
 *   Vortex dance   five point vortices orbiting the centre (Biot-Savart)
 *   Curl waves     the curl of a wave-shaped stream function (no divergence)
 *   Clifford flow  the displacement of a Clifford attractor map, swirled
 *
 * The field's unit square is fitted to the shorter side of the window, so an
 * upright phone sees the whole pattern and wide screens see it extend
 * sideways. The canvas is drawn at the device pixel ratio (ArtEmbed.dpr(),
 * capped inside an Art Lab card) and is rebuilt on resize.
 *
 * Tap, click, Space or the arrow keys change the field; otherwise it moves
 * on by itself every 24 seconds. With reduced motion a still is drawn and
 * the field only changes on request.
 *
 * Helpers: microcan (canvas) and vec-la (vectors) by Francis Stokes, MIT.
 */
(function () {
  'use strict';

  var embed = window.ArtEmbed || { on: false, dpr: function () { return window.devicePixelRatio || 1; } };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mc = window.microcan;
  var V = window.vec;

  var canvas = document.getElementById('main');
  var ctx = canvas.getContext('2d', { alpha: false });
  var label = document.getElementById('field-name');

  var W = 0;
  var H = 0;
  var dpr = 1;
  var cx = 0;
  var cy = 0;
  var unit = 1; // pixels per field unit

  var BG = [9, 9, 11];
  // slow, middle and fast particles
  var INK = ['#b45309', '#facc15', '#7df9ff'];

  var FIELD_SECONDS = 24;

  // ---------------------------------------------------------------- fields
  // Each field writes the velocity at (x, y) into out[0], out[1]. An optional
  // `gain` lifts a field with small speeds into the same colour range.

  var vortices = [];

  var fields = [
    {
      name: 'Interference',
      formula: 'v = ( sin 3y + cos(2.3 r − t),  cos 3x − sin(2.3 r + t) )',
      fn: function (x, y, t, out) {
        var r = Math.sqrt(x * x + y * y);
        out[0] = Math.sin(3 * y + t * 0.3) + Math.cos(2.3 * r - t * 0.7);
        out[1] = Math.cos(3 * x - t * 0.3) - Math.sin(2.3 * r + t * 0.5);
      },
    },
    {
      name: 'Rose',
      formula: 'heading = 3·θ + sin(4r − t)',
      fn: function (x, y, t, out) {
        var r = Math.sqrt(x * x + y * y);
        var th = Math.atan2(y, x);
        var a = 3 * th + Math.sin(4 * r - t * 0.6) * 1.4;
        var m = 0.4 + Math.abs(Math.sin(2.5 * r - t * 0.25));
        out[0] = Math.cos(a) * m;
        out[1] = Math.sin(a) * m;
      },
    },
    {
      name: 'Vortex dance',
      gain: 2.6,
      formula: 'v = Σ κᵢ (−dy, dx) / (|d|² + ε)',
      before: function (t) {
        // five vortices on a turning pentagon, alternating spin
        vortices.length = 0;
        for (var i = 0; i < 5; i++) {
          var p = V.rotate((i / 5) * Math.PI * 2 + t * 0.12 * (i % 2 ? 1 : -1), [0.55 + 0.15 * Math.sin(t * 0.2 + i), 0]);
          vortices.push([p[0], p[1], i % 2 ? 0.16 : -0.16]);
        }
      },
      fn: function (x, y, t, out) {
        var vx = -y * 0.15;
        var vy = x * 0.15;
        for (var i = 0; i < vortices.length; i++) {
          var dx = x - vortices[i][0];
          var dy = y - vortices[i][1];
          var k = vortices[i][2] / (dx * dx + dy * dy + 0.02);
          vx -= dy * k;
          vy += dx * k;
        }
        out[0] = vx;
        out[1] = vy;
      },
    },
    {
      name: 'Curl waves',
      formula: 'ψ = sin(2x + t) cos 2y + ½ sin(3r − t),  v = (∂ψ/∂y, −∂ψ/∂x)',
      fn: function (x, y, t, out) {
        // analytic partial derivatives of the stream function
        var r = Math.sqrt(x * x + y * y) + 1e-6;
        var a = 2 * x + t * 0.4;
        var w = 1.5 * Math.cos(3 * r - t * 0.5) / r;
        var dpdx = 2 * Math.cos(a) * Math.cos(2 * y) + w * x;
        var dpdy = -2 * Math.sin(a) * Math.sin(2 * y) + w * y;
        out[0] = dpdy;
        out[1] = -dpdx;
      },
    },
    {
      name: 'Clifford flow',
      formula: 'f(p) = ( sin ay + c cos ax,  sin bx + d cos by ),  v = R·(f(p)/2 − p)',
      before: function (t) {
        this.a = -1.7 + 0.25 * Math.sin(t * 0.05);
        this.b = 1.8 + 0.2 * Math.cos(t * 0.04);
        this.c = -1.9;
        this.d = -0.4 + 0.3 * Math.sin(t * 0.03);
      },
      fn: function (x, y, t, out) {
        var X = x * 1.6;
        var Y = y * 1.6;
        var fx = (Math.sin(this.a * Y) + this.c * Math.cos(this.a * X)) * 0.5 - X;
        var fy = (Math.sin(this.b * X) + this.d * Math.cos(this.b * Y)) * 0.5 - Y;
        // turn the pull by 60 degrees so particles orbit instead of settling
        out[0] = fx * 0.5 - fy * 0.866;
        out[1] = fx * 0.866 + fy * 0.5;
      },
    },
  ];

  // ---------------------------------------------------------------- particles

  var MAX = 4500;
  var px = new Float32Array(MAX);
  var py = new Float32Array(MAX);
  var life = new Float32Array(MAX);
  var n = 0;

  function spawn(i) {
    px[i] = Math.random() * W;
    py[i] = Math.random() * H;
    life[i] = 90 + Math.random() * 300;
  }

  // ---------------------------------------------------------------- canvas

  function clear() {
    ctx.globalAlpha = 1;
    mc.background(ctx, BG[0], BG[1], BG[2], 1, W, H);
  }

  function fit() {
    W = Math.max(1, window.innerWidth);
    H = Math.max(1, window.innerHeight);
    dpr = embed.dpr();
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2;
    cy = H / 2;
    unit = (Math.min(W, H) / 2) * 0.92;
    var want = Math.round((W * H) / (embed.on ? 520 : 380));
    n = Math.max(600, Math.min(MAX, want));
    for (var i = 0; i < n; i++) spawn(i);
    clear();
  }

  // ---------------------------------------------------------------- simulation

  var current = 0;
  var t = 0;
  var fieldTime = 0;
  var fadeBoost = 0;
  var out = [0, 0];

  function step(k) {
    var f = fields[current];
    if (f.before) f.before.call(f, t);

    ctx.globalAlpha = Math.min(1, (0.07 + fadeBoost) * k);
    ctx.fillStyle = 'rgb(' + BG.join(',') + ')';
    ctx.fillRect(0, 0, W, H);
    if (fadeBoost > 0) fadeBoost = Math.max(0, fadeBoost - 0.01 * k);

    var inv = 1 / unit;
    var gain = f.gain || 1;
    var base = unit * 0.0065 * k; // pixels per frame at unit speed
    var paths = [new Path2D(), new Path2D(), new Path2D()];

    for (var i = 0; i < n; i++) {
      var x = px[i];
      var y = py[i];
      f.fn.call(f, (x - cx) * inv, (cy - y) * inv, t, out);
      var vx = out[0];
      var vy = -out[1];
      var m = Math.sqrt(vx * vx + vy * vy) * gain;
      if (m < 1e-6) {
        spawn(i);
        continue;
      }
      // direction from the field, length squashed so fast spots don't streak
      var len = (base * (0.35 + Math.tanh(m)) * gain) / m;
      var nx = x + vx * len;
      var ny = y + vy * len;
      var b = m < 0.6 ? 0 : m < 1.8 ? 1 : 2;
      paths[b].moveTo(x, y);
      paths[b].lineTo(nx, ny);

      life[i] -= k;
      if (life[i] <= 0 || nx < -2 || ny < -2 || nx > W + 2 || ny > H + 2) spawn(i);
      else {
        px[i] = nx;
        py[i] = ny;
      }
    }

    ctx.lineWidth = Math.max(0.8, Math.min(W, H) / 700);
    ctx.lineCap = 'round';
    var alpha = [0.5, 0.65, 0.8];
    for (var j = 0; j < 3; j++) {
      ctx.globalAlpha = alpha[j];
      ctx.strokeStyle = INK[j];
      ctx.stroke(paths[j]);
    }
    ctx.globalAlpha = 1;
    t += 0.016 * k;
  }

  function showLabel() {
    if (!label) return;
    var f = fields[current];
    label.querySelector('.name').textContent = f.name;
    label.querySelector('.formula').textContent = f.formula;
  }

  function setField(i) {
    current = (i + fields.length) % fields.length;
    fieldTime = 0;
    fadeBoost = 0.25;
    for (var p = 0; p < n; p++) spawn(p);
    showLabel();
    if (!playing) still();
  }

  // A finished-looking frame without animation.
  function still() {
    clear();
    fadeBoost = 0;
    for (var s = 0; s < 260; s++) step(1);
  }

  // ---------------------------------------------------------------- loop

  var playing = !reduceMotion;
  var raf = 0;
  var last = 0;

  function tick(now) {
    raf = 0;
    if (document.hidden) return;
    var k = last ? (now - last) / (1000 / 60) : 1;
    last = now;
    if (k > 4) k = 1;
    step(k);
    fieldTime += k / 60;
    if (fieldTime > FIELD_SECONDS) setField(current + 1);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf || !playing || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else start();
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      fit();
      if (!playing) still();
    }, 120);
  });

  if (!embed.on) {
    canvas.addEventListener('click', function () { setField(current + 1); });
    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') setField(current + 1);
      else if (e.key === 'ArrowLeft') setField(current - 1);
      else return;
      e.preventDefault();
    });
  }

  fit();
  current = Math.floor(Math.random() * fields.length);
  showLabel();
  if (playing) start();
  else still();
})();
