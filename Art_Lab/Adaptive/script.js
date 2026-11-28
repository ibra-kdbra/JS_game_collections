/**
 * Adaptive Fields
 *
 * Thousands of particles ride a slowly changing gradient-noise field. Each
 * frame a particle samples the field at its position, turns the sample into a
 * heading and moves one short step, leaving a line segment behind. A
 * translucent wash of the ground colour fades older segments into trails.
 * Dragging on the canvas stirs the particles near the pointer.
 *
 * Plain Canvas 2D, no libraries. The noise is a seeded 3D gradient noise
 * (x, y and time), written for this page. Particle state lives in typed
 * arrays and every colour group is drawn as one path, so ten thousand
 * particles stay smooth on a laptop.
 *
 * Works with the Art Lab's embed mode (../js/embed.js): inside a card the
 * panel is hidden and the pixel ratio comes from ArtEmbed.dpr().
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var embed = window.ArtEmbed || { on: false, dpr: function () { return window.devicePixelRatio || 1; } };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------- settings

  var DEFAULTS = {
    count: 4500,
    speed: 1.4,
    size: 1,
    opacity: 0.22,
    scale: 300,
    curl: 1.6,
    drift: 0.2,
    fade: 0.03,
    edge: 'wrap',
    colorA: '#facc15',
    colorB: '#00f0ff',
    bg: '#09090b',
    twoTone: false,
  };

  var PRESETS = {
    Ember: { count: 4000, speed: 1.2, size: 1, opacity: 0.16, scale: 260, curl: 1.5, drift: 0.15, fade: 0, edge: 'respawn', colorA: '#ff9900', colorB: '#facc15', bg: '#09090b', twoTone: true },
    Silk: { count: 2500, speed: 2.4, size: 0.8, opacity: 0.14, scale: 720, curl: 1, drift: 0.1, fade: 0.012, edge: 'wrap', colorA: '#fef08a', colorB: '#ffffff', bg: '#0b0b10', twoTone: false },
    Static: { count: 9000, speed: 3.6, size: 1.2, opacity: 0.55, scale: 70, curl: 6, drift: 0.6, fade: 0.22, edge: 'respawn', colorA: '#ffffff', colorB: '#facc15', bg: '#09090b', twoTone: true },
    Tide: { count: 5000, speed: 1.8, size: 1.5, opacity: 0.22, scale: 460, curl: 3, drift: 0.4, fade: 0.06, edge: 'wrap', colorA: '#00f0ff', colorB: '#facc15', bg: '#07090d', twoTone: true },
  };

  var s = Object.assign({}, DEFAULTS);

  // ---------------------------------------------------------------- noise

  // Small, fast seeded PRNG (32-bit state).
  function prng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x9e3779b9) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var perm = new Uint8Array(512);
  var gradX = new Float32Array(256);
  var gradY = new Float32Array(256);
  var gradZ = new Float32Array(256);

  // Fill the lattice: a shuffled index table and one random unit vector per slot.
  function seedNoise(seed) {
    var rnd = prng(seed);
    var order = new Uint8Array(256);
    var i;
    for (i = 0; i < 256; i++) order[i] = i;
    for (i = 255; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var tmp = order[i];
      order[i] = order[j];
      order[j] = tmp;
    }
    for (i = 0; i < 512; i++) perm[i] = order[i & 255];
    for (i = 0; i < 256; i++) {
      var z = rnd() * 2 - 1;
      var r = Math.sqrt(1 - z * z);
      var phi = rnd() * TAU;
      gradX[i] = r * Math.cos(phi);
      gradY[i] = r * Math.sin(phi);
      gradZ[i] = z;
    }
  }

  function corner(h, dx, dy, dz) {
    return gradX[h] * dx + gradY[h] * dy + gradZ[h] * dz;
  }

  // Gradient noise in 3D, roughly in [-1, 1]: dot products with the eight
  // surrounding lattice gradients, blended with a quintic ease.
  function noise3(x, y, z) {
    var xf = Math.floor(x);
    var yf = Math.floor(y);
    var zf = Math.floor(z);
    var X = xf & 255;
    var Y = yf & 255;
    var Z = zf & 255;
    x -= xf;
    y -= yf;
    z -= zf;
    var u = x * x * x * (x * (x * 6 - 15) + 10);
    var v = y * y * y * (y * (y * 6 - 15) + 10);
    var w = z * z * z * (z * (z * 6 - 15) + 10);

    var a = perm[X] + Y;
    var b = perm[X + 1] + Y;
    var aa = perm[a] + Z;
    var ab = perm[a + 1] + Z;
    var ba = perm[b] + Z;
    var bb = perm[b + 1] + Z;

    var x1 = corner(perm[aa], x, y, z);
    var x2 = corner(perm[ba], x - 1, y, z);
    var y1 = x1 + u * (x2 - x1);
    x1 = corner(perm[ab], x, y - 1, z);
    x2 = corner(perm[bb], x - 1, y - 1, z);
    var y2 = x1 + u * (x2 - x1);
    var z1 = y1 + v * (y2 - y1);

    x1 = corner(perm[aa + 1], x, y, z - 1);
    x2 = corner(perm[ba + 1], x - 1, y, z - 1);
    y1 = x1 + u * (x2 - x1);
    x1 = corner(perm[ab + 1], x, y - 1, z - 1);
    x2 = corner(perm[bb + 1], x - 1, y - 1, z - 1);
    y2 = x1 + u * (x2 - x1);
    var z2 = y1 + v * (y2 - y1);

    return (z1 + w * (z2 - z1)) * 1.6;
  }

  // ---------------------------------------------------------------- canvas

  var canvas = document.getElementById('field');
  var ctx = canvas.getContext('2d', { alpha: false });
  var W = 0;
  var H = 0;
  var dpr = 1;

  function paintGround() {
    ctx.globalAlpha = 1;
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, W, H);
  }

  // Size the backing store to the screen's pixels; keep what was painted.
  function fitCanvas() {
    var w = Math.max(1, window.innerWidth);
    var h = Math.max(1, window.innerHeight);
    var d = Math.min(embed.dpr(2), 2);
    if (w === W && h === H && d === dpr && canvas.width) return;

    var old = null;
    if (canvas.width && W) {
      old = document.createElement('canvas');
      old.width = canvas.width;
      old.height = canvas.height;
      old.getContext('2d').drawImage(canvas, 0, 0);
    }
    var oldW = W;
    var oldH = H;
    W = w;
    H = h;
    dpr = d;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintGround();
    if (old) ctx.drawImage(old, 0, 0, oldW, oldH);
    // particles that are now off the canvas start again inside it
    for (var i = 0; i < n; i++) {
      if (px[i] > W || py[i] > H) spawn(i);
    }
  }

  // ---------------------------------------------------------------- particles

  var MAX = 12000;
  var px = new Float32Array(MAX);
  var py = new Float32Array(MAX);
  var life = new Float32Array(MAX);
  var n = 0;

  function spawn(i) {
    px[i] = Math.random() * W;
    py[i] = Math.random() * H;
    life[i] = 160 + Math.random() * 520;
  }

  function setCount(c) {
    c = Math.max(1, Math.min(MAX, Math.round(c)));
    for (var i = n; i < c; i++) spawn(i);
    n = c;
  }

  // Field state
  var seed = (Math.random() * 1e9) >>> 0;
  var t = Math.random() * 100;

  // Pointer stirring
  var pointer = { on: false, x: 0, y: 0, vx: 0, vy: 0 };
  var STIR_R = 110;

  // Move particles [from, to) one step and add their segments to the current path.
  function stepRange(from, to, k) {
    var inv = 1 / s.scale;
    var turn = s.curl * Math.PI;
    var step = s.speed * k;
    var wrap = s.edge === 'wrap';
    var stir = pointer.on;
    var r2 = STIR_R * STIR_R;
    var mx = pointer.x;
    var my = pointer.y;
    var pvx = pointer.vx;
    var pvy = pointer.vy;
    var ageStep = k;

    for (var i = from; i < to; i++) {
      var x = px[i];
      var y = py[i];
      var a = noise3(x * inv, y * inv, t) * turn;
      var vx = Math.cos(a) * step;
      var vy = Math.sin(a) * step;

      if (stir) {
        var dx = x - mx;
        var dy = y - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          var d = Math.sqrt(d2) + 0.001;
          var f = 1 - d2 / r2;
          // swirl around the pointer and get carried along with its motion
          vx += (-dy / d) * f * 3 * k + pvx * f * 0.6;
          vy += (dx / d) * f * 3 * k + pvy * f * 0.6;
        }
      }

      var nx = x + vx;
      var ny = y + vy;
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);

      life[i] -= ageStep;
      if (life[i] <= 0) {
        spawn(i);
        continue;
      }
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) {
        if (wrap) {
          nx = ((nx % W) + W) % W;
          ny = ((ny % H) + H) % H;
        } else {
          spawn(i);
          continue;
        }
      }
      px[i] = nx;
      py[i] = ny;
    }
  }

  // One simulation and drawing step; k is the elapsed time in 60 Hz frames.
  function frame(k) {
    if (s.fade > 0) {
      ctx.globalAlpha = s.fade * Math.min(k, 3);
      ctx.fillStyle = s.bg;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = s.opacity;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'square';

    var split = s.twoTone ? Math.floor(n / 2) : n;
    ctx.strokeStyle = s.colorA;
    ctx.beginPath();
    stepRange(0, split, k);
    ctx.stroke();
    if (split < n) {
      ctx.strokeStyle = s.colorB;
      ctx.beginPath();
      stepRange(split, n, k);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    t += s.drift * 0.004 * k;
    pointer.vx *= 0.85;
    pointer.vy *= 0.85;
  }

  // ---------------------------------------------------------------- loop

  var playing = !reduceMotion;
  var raf = 0;
  var last = 0;
  var fpsFrames = 0;
  var fpsSince = 0;
  var fpsEl = document.getElementById('fps');

  function tick(now) {
    raf = 0;
    if (!playing || document.hidden) return;
    var k = last ? (now - last) / (1000 / 60) : 1;
    last = now;
    if (k > 4) k = 1; // back from a stall: don't jump
    frame(k);

    fpsFrames++;
    if (now - fpsSince > 500) {
      if (fpsSince && fpsEl) fpsEl.textContent = Math.round((fpsFrames * 1000) / (now - fpsSince)) + ' fps · ' + n + ' particles';
      fpsSince = now;
      fpsFrames = 0;
    }
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf || !playing || document.hidden) return;
    last = 0;
    fpsSince = 0;
    raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  // Paint a finished-looking still without animating (reduced motion, paused edits).
  function still(steps) {
    for (var i = 0; i < steps; i++) frame(1);
  }

  var playBtn = document.getElementById('btn-play');
  function setPlaying(p) {
    playing = p;
    if (playBtn) {
      playBtn.textContent = p ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', String(!p));
    }
    if (p) start();
    else stop();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else start();
  });

  // ---------------------------------------------------------------- controls

  var SLIDERS = {
    count: function (v) { return String(v); },
    speed: function (v) { return v.toFixed(1); },
    size: function (v) { return v.toFixed(1); },
    opacity: function (v) { return Math.round(v * 100) + '%'; },
    scale: function (v) { return String(v); },
    curl: function (v) { return v.toFixed(2); },
    drift: function (v) { return v.toFixed(2); },
    fade: function (v) { return v === 0 ? 'off' : v.toFixed(3); },
  };
  var COLOURS = { 'color-a': 'colorA', 'color-b': 'colorB', 'color-bg': 'bg' };

  function $(id) {
    return document.getElementById(id);
  }

  // Push the settings into the form.
  function syncForm() {
    Object.keys(SLIDERS).forEach(function (key) {
      var el = $(key);
      if (!el) return;
      el.value = s[key];
      $(key + '-out').textContent = SLIDERS[key](s[key]);
    });
    Object.keys(COLOURS).forEach(function (id) {
      if ($(id)) $(id).value = s[COLOURS[id]];
    });
    document.querySelectorAll('input[name="edge"]').forEach(function (r) {
      r.checked = r.value === s.edge;
    });
    if ($('two-tone')) $('two-tone').checked = s.twoTone;
    if ($('color-b')) $('color-b').disabled = !s.twoTone;
  }

  // Apply a whole new set of settings and start from a clean canvas.
  function apply(next) {
    Object.assign(s, next);
    setCount(s.count);
    for (var i = 0; i < n; i++) spawn(i);
    paintGround();
    syncForm();
    markPreset();
    if (!playing) still(reduceMotion ? 220 : 1);
  }

  function markPreset() {
    document.querySelectorAll('#presets button').forEach(function (b) {
      var p = PRESETS[b.textContent];
      var same = Object.keys(p).every(function (key) { return p[key] === s[key]; });
      b.classList.toggle('is-on', same);
      b.setAttribute('aria-pressed', String(same));
    });
  }

  function hsl(h, sat, l) {
    // HSL (degrees, 0-1, 0-1) to #rrggbb
    var a = sat * Math.min(l, 1 - l);
    function f(k) {
      var c = (k + h / 30) % 12;
      var v = l - a * Math.max(-1, Math.min(c - 3, 9 - c, 1));
      return ('0' + Math.round(v * 255).toString(16)).slice(-2);
    }
    return '#' + f(0) + f(8) + f(4);
  }

  function rand(lo, hi, stepSize) {
    var v = lo + Math.random() * (hi - lo);
    return stepSize ? Math.round(v / stepSize) * stepSize : v;
  }

  function randomise() {
    var hue = Math.random() * 360;
    var fade = Math.random() < 0.2 ? 0 : rand(0.005, 0.12, 0.005);
    apply({
      count: rand(1000, 7000, 100),
      speed: +rand(0.6, 4, 0.1).toFixed(1),
      size: +rand(0.6, 2.2, 0.1).toFixed(1),
      opacity: +rand(fade === 0 ? 0.06 : 0.15, fade === 0 ? 0.25 : 0.7, 0.01).toFixed(2),
      scale: rand(80, 900, 10),
      curl: +rand(0.5, 5, 0.05).toFixed(2),
      drift: +rand(0, 0.7, 0.01).toFixed(2),
      fade: +fade.toFixed(3),
      edge: Math.random() < 0.5 ? 'wrap' : 'respawn',
      colorA: hsl(hue, 0.9, 0.6),
      colorB: hsl((hue + rand(40, 180)) % 360, 0.85, 0.6),
      bg: hsl((hue + 180) % 360, 0.25, 0.04),
      twoTone: Math.random() < 0.6,
    });
  }

  function newSeed() {
    seed = (Math.random() * 1e9) >>> 0;
    seedNoise(seed);
    if (!playing) {
      paintGround();
      still(reduceMotion ? 220 : 1);
    }
  }

  function clearCanvas() {
    paintGround();
    if (!playing) still(1);
  }

  function savePng() {
    canvas.toBlob(function (blob) {
      if (!blob) return;
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'adaptive-fields-' + seed + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }, 'image/png');
  }

  // Panel open/closed
  var panelBtn = $('btn-panel');
  function setPanel(open) {
    document.body.classList.toggle('panel-closed', !open);
    if (panelBtn) panelBtn.setAttribute('aria-expanded', String(open));
  }

  function bindControls() {
    var presetBox = $('presets');
    Object.keys(PRESETS).forEach(function (name) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = name;
      b.addEventListener('click', function () { apply(Object.assign({}, PRESETS[name])); });
      presetBox.appendChild(b);
    });

    Object.keys(SLIDERS).forEach(function (key) {
      var el = $(key);
      el.addEventListener('input', function () {
        var v = parseFloat(el.value);
        s[key] = v;
        $(key + '-out').textContent = SLIDERS[key](v);
        if (key === 'count') setCount(v);
        markPreset();
      });
    });

    Object.keys(COLOURS).forEach(function (id) {
      $(id).addEventListener('input', function (e) {
        var key = COLOURS[id];
        s[key] = e.target.value;
        if (key === 'bg') paintGround();
        markPreset();
      });
    });

    document.querySelectorAll('input[name="edge"]').forEach(function (r) {
      r.addEventListener('change', function () {
        if (r.checked) s.edge = r.value;
        markPreset();
      });
    });

    $('two-tone').addEventListener('change', function (e) {
      s.twoTone = e.target.checked;
      $('color-b').disabled = !s.twoTone;
      markPreset();
    });

    $('btn-random').addEventListener('click', randomise);
    $('btn-seed').addEventListener('click', newSeed);
    $('btn-clear').addEventListener('click', clearCanvas);
    $('btn-reset').addEventListener('click', function () { apply(Object.assign({}, DEFAULTS)); });
    $('btn-save').addEventListener('click', savePng);
    playBtn.addEventListener('click', function () { setPlaying(!playing); });
    panelBtn.addEventListener('click', function () {
      setPanel(document.body.classList.contains('panel-closed'));
    });

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = e.target && e.target.tagName;
      // Space belongs to a focused control (it presses buttons and ticks boxes)
      if (e.key === ' ' && (tag === 'INPUT' || tag === 'BUTTON' || tag === 'LABEL')) return;
      switch (e.key) {
        case ' ': setPlaying(!playing); break;
        case 'h': case 'H': setPanel(document.body.classList.contains('panel-closed')); break;
        case 'Escape': setPanel(false); break;
        case 'r': case 'R': randomise(); break;
        case 'n': case 'N': newSeed(); break;
        case 'c': case 'C': clearCanvas(); break;
        default: return;
      }
      e.preventDefault();
    });
  }

  // Pointer: drag on the canvas to stir
  function bindPointer() {
    function at(e) {
      var nx = e.clientX;
      var ny = e.clientY;
      if (pointer.on) {
        pointer.vx = pointer.vx * 0.5 + (nx - pointer.x) * 0.5;
        pointer.vy = pointer.vy * 0.5 + (ny - pointer.y) * 0.5;
      }
      pointer.x = nx;
      pointer.y = ny;
    }
    canvas.addEventListener('pointerdown', function (e) {
      pointer.on = false;
      at(e);
      pointer.on = true;
      pointer.vx = pointer.vy = 0;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
      // on a phone, tapping the art tucks the panel away
      if (window.innerWidth <= 720) setPanel(false);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (pointer.on) at(e);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (type) {
      canvas.addEventListener(type, function () { pointer.on = false; });
    });
  }

  // ---------------------------------------------------------------- start

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitCanvas, 120);
  });

  seedNoise(seed);
  fitCanvas();
  setCount(s.count);
  paintGround();

  if (!embed.on) {
    bindControls();
    bindPointer();
    syncForm();
    markPreset();
    setPanel(window.innerWidth > 720);
  }

  if (reduceMotion) {
    // A still picture; Play animates it on request.
    still(220);
    setPlaying(false);
  } else {
    setPlaying(true);
  }
})();
