/**
 * Live backgrounds and the themes they belong to.
 *
 * A theme sets two things at once: the animated scene behind the game (drawn on
 * one full-screen canvas) and the colours of everything in front of it (panels,
 * board, accent, buttons), given to the CSS as custom properties. The scenes react
 * to play: clearing lines lights them up, a Tetris most of all.
 *
 * Themes: Rain (rain on a night window over the city), Obsidian (the Game Lab's
 * yellow on black), Aurora (northern lights over a starry sky), Synthwave (a
 * sunset over a moving neon grid) and Code Rain (falling green glyphs).
 *
 * The scene runs at most 60 frames a second, draws at a capped pixel density,
 * stops while the tab is hidden and keeps still when the player prefers reduced
 * motion.
 */

'use strict';

const LiveBackground = (() => {
  const TAU = Math.PI * 2;
  let canvas = null;
  let ctx = null;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let themeName = 'rain';
  let scene = null;
  let last = 0;
  let time = 0;
  let pulse = 0; // 0..1, decays: a line clear just happened
  let raf = 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ------------------------------------------------------------- themes */

  const THEMES = {
    rain: {
      title: 'Rain',
      ui: {
        accent: '#8fd3ff', accent2: '#c9b6ff', text: '#eef4fa', muted: '#9fb2c4',
        panel: 'rgba(12, 17, 24, 0.62)', edge: 'rgba(170, 205, 235, 0.18)',
        board: 'rgba(5, 9, 14, 0.74)', grid: 'rgba(160, 195, 225, 0.07)',
        glow: 'rgba(143, 211, 255, 0.28)', image: 'url("./imgs/waterdrop.jpg")', base: '#0b1016',
      },
      make: rainScene,
    },
    obsidian: {
      title: 'Obsidian',
      ui: {
        accent: '#facc15', accent2: '#fde68a', text: '#fafafa', muted: '#a1a1aa',
        panel: 'rgba(18, 18, 22, 0.78)', edge: 'rgba(250, 204, 21, 0.2)',
        board: 'rgba(9, 9, 11, 0.86)', grid: 'rgba(250, 204, 21, 0.05)',
        glow: 'rgba(250, 204, 21, 0.22)', image: 'none', base: '#09090b',
      },
      make: obsidianScene,
    },
    aurora: {
      title: 'Aurora',
      ui: {
        accent: '#5eead4', accent2: '#a78bfa', text: '#ecfeff', muted: '#94b8c4',
        panel: 'rgba(6, 16, 28, 0.6)', edge: 'rgba(94, 234, 212, 0.2)',
        board: 'rgba(3, 9, 18, 0.72)', grid: 'rgba(94, 234, 212, 0.06)',
        glow: 'rgba(94, 234, 212, 0.25)', image: 'none', base: '#030a16',
      },
      make: auroraScene,
    },
    synthwave: {
      title: 'Synthwave',
      ui: {
        accent: '#ff5fd2', accent2: '#5ee7ff', text: '#fff1fb', muted: '#cba6c6',
        panel: 'rgba(24, 6, 38, 0.62)', edge: 'rgba(255, 95, 210, 0.24)',
        board: 'rgba(12, 3, 22, 0.76)', grid: 'rgba(255, 95, 210, 0.07)',
        glow: 'rgba(255, 95, 210, 0.3)', image: 'none', base: '#12031f',
      },
      make: synthScene,
    },
    'code rain': {
      title: 'Code Rain',
      ui: {
        accent: '#4ade80', accent2: '#bbf7d0', text: '#ecfdf5', muted: '#86a596',
        panel: 'rgba(2, 10, 5, 0.72)', edge: 'rgba(74, 222, 128, 0.2)',
        board: 'rgba(1, 6, 3, 0.82)', grid: 'rgba(74, 222, 128, 0.06)',
        glow: 'rgba(74, 222, 128, 0.25)', image: 'none', base: '#010603',
      },
      make: codeScene,
    },
  };
  // Older saved settings used other names; map them to the nearest new theme
  const ALIASES = { 'water drop': 'rain', cyberpunk: 'synthwave', neon: 'synthwave', matrix: 'code rain', retro: 'obsidian' };
  const ORDER = Object.keys(THEMES);

  /* ------------------------------------------------------------- scenes */

  // Rain on a window at night: the city photo behind, two depths of falling
  // rain, drops running down the glass, and lightning now and then (and on a Tetris).
  function rainScene() {
    const streaks = [];
    const drops = [];
    let flash = 0;
    let nextBolt = rand(9, 20);
    const fill = () => {
      streaks.length = 0;
      const n = Math.round((w * h) / 9000);
      for (let i = 0; i < n; i++) streaks.push(newStreak(true));
      drops.length = 0;
      const m = Math.round((w * h) / 60000) + 6;
      for (let i = 0; i < m; i++) drops.push(newDrop(true));
    };
    function newStreak(anywhere) {
      const near = Math.random() < 0.3;
      return {
        x: rand(-0.1 * w, 1.1 * w), y: anywhere ? rand(-h, h) : rand(-h * 0.3, -10),
        len: near ? rand(26, 42) : rand(10, 22), v: near ? rand(1300, 1700) : rand(700, 1000),
        a: near ? rand(0.18, 0.3) : rand(0.08, 0.16), wdt: near ? 1.4 : 0.9,
      };
    }
    function newDrop(anywhere) {
      return {
        x: rand(0, w), y: anywhere ? rand(0, h) : rand(-40, 0), r: rand(2.2, 5.5),
        v: 0, hold: rand(0.5, 4), path: [],
      };
    }
    return {
      resize: fill,
      bolt() {
        flash = 1;
      },
      draw(dt) {
        // Darken the photo towards the edges so the board stands out
        const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.75);
        g.addColorStop(0, 'rgba(6, 10, 16, 0.25)');
        g.addColorStop(1, 'rgba(4, 7, 12, 0.72)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // Falling rain, a little wind from the left
        const wind = 0.16;
        ctx.lineCap = 'round';
        for (const s of streaks) {
          s.y += s.v * dt;
          s.x += s.v * wind * dt;
          if (s.y - s.len > h || s.x > w * 1.1) Object.assign(s, newStreak(false));
          ctx.strokeStyle = `rgba(200, 225, 245, ${s.a})`;
          ctx.lineWidth = s.wdt;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - s.len * wind, s.y - s.len);
          ctx.stroke();
        }
        // Drops on the glass: they cling, then run down and leave a wet trail
        for (const d of drops) {
          if (d.hold > 0) d.hold -= dt;
          else {
            d.v = Math.min(220, d.v + 160 * dt);
            d.y += d.v * dt;
            d.x += Math.sin(d.y * 0.05) * 0.15;
            d.path.push(d.x, d.y);
            if (d.path.length > 40) d.path.splice(0, 2);
            if (Math.random() < dt * 0.8) {
              d.v = 0;
              d.hold = rand(0.2, 1.2);
            }
          }
          if (d.y - 60 > h) Object.assign(d, newDrop(false));
          if (d.path.length > 4) {
            ctx.strokeStyle = 'rgba(190, 215, 235, 0.07)';
            ctx.lineWidth = d.r * 0.9;
            ctx.beginPath();
            ctx.moveTo(d.path[0], d.path[1]);
            for (let i = 2; i < d.path.length; i += 2) ctx.lineTo(d.path[i], d.path[i + 1]);
            ctx.stroke();
          }
          const rg = ctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.4, 0, d.x, d.y, d.r);
          rg.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
          rg.addColorStop(0.5, 'rgba(180, 210, 235, 0.16)');
          rg.addColorStop(1, 'rgba(20, 30, 40, 0.35)');
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y, d.r * 0.85, d.r, 0, 0, TAU);
          ctx.fill();
        }
        // Lightning: a double flicker of light over the whole scene
        nextBolt -= dt;
        if (nextBolt <= 0 && !reduced) {
          flash = 1;
          nextBolt = rand(14, 30);
        }
        if (flash > 0) {
          const f = flash > 0.6 ? flash : flash * (0.5 + 0.5 * Math.sin(flash * 40));
          ctx.fillStyle = `rgba(210, 225, 255, ${0.28 * Math.max(0, f)})`;
          ctx.fillRect(0, 0, w, h);
          flash = Math.max(0, flash - dt * 1.8);
        }
      },
    };
  }

  const SHAPES = [
    [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]],
  ];

  // Obsidian: the Game Lab look. Tetromino outlines drift down through the dark
  // in yellow; a line clear sends a ring out from the middle.
  function obsidianScene() {
    const blocks = [];
    const rings = [];
    const fill = () => {
      blocks.length = 0;
      const n = Math.round((w * h) / 70000) + 8;
      for (let i = 0; i < n; i++) blocks.push(newBlock(true));
    };
    function newBlock(anywhere) {
      const s = rand(14, 34);
      return {
        shape: SHAPES[Math.floor(Math.random() * 7)], s, x: rand(0, w), y: anywhere ? rand(-h * 0.2, h) : -s * 4,
        v: rand(8, 26) * (s / 24), rot: rand(0, TAU), vr: rand(-0.15, 0.15), a: rand(0.05, 0.14),
      };
    }
    return {
      resize: fill,
      ring(n) {
        rings.push({ r: 0, a: 0.25 + n * 0.08 });
      },
      draw(dt) {
        const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.7);
        g.addColorStop(0, '#16161a');
        g.addColorStop(1, '#070708');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = 1.5;
        for (const b of blocks) {
          b.y += b.v * dt * (1 + pulse * 2);
          b.rot += b.vr * dt;
          if (b.y > h + b.s * 4) Object.assign(b, newBlock(false));
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.rot);
          ctx.strokeStyle = `rgba(250, 204, 21, ${b.a + pulse * 0.15})`;
          for (const [cx, cy] of b.shape) ctx.strokeRect((cx - 1.5) * b.s, (cy - 1) * b.s, b.s - 3, b.s - 3);
          ctx.restore();
        }
        for (let i = rings.length - 1; i >= 0; i--) {
          const r = rings[i];
          r.r += dt * Math.max(w, h) * 0.6;
          r.a -= dt * 0.35;
          if (r.a <= 0) {
            rings.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(250, 204, 21, ${r.a})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, r.r, 0, TAU);
          ctx.stroke();
        }
      },
    };
  }

  // Aurora: stars over a dark sky and three slow curtains of light
  function auroraScene() {
    const stars = [];
    const fill = () => {
      stars.length = 0;
      const n = Math.round((w * h) / 2600);
      for (let i = 0; i < n; i++) stars.push({ x: rand(0, w), y: rand(0, h * 0.9), r: rand(0.4, 1.4), p: rand(0, TAU), s: rand(0.6, 2) });
    };
    const bands = [
      { y: 0.3, amp: 0.08, k: 1.6, sp: 0.07, c1: [94, 234, 212], c2: [34, 197, 94], hgt: 0.32 },
      { y: 0.42, amp: 0.06, k: 2.3, sp: -0.05, c1: [167, 139, 250], c2: [94, 234, 212], hgt: 0.26 },
      { y: 0.24, amp: 0.05, k: 3.1, sp: 0.04, c1: [56, 189, 248], c2: [167, 139, 250], hgt: 0.2 },
    ];
    return {
      resize: fill,
      draw() {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#020510');
        sky.addColorStop(0.6, '#06142a');
        sky.addColorStop(1, '#0b2236');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);
        for (const s of stars) {
          const a = 0.35 + 0.35 * Math.sin(time * s.s + s.p);
          ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
          ctx.fillRect(s.x, s.y, s.r, s.r);
        }
        ctx.globalCompositeOperation = 'lighter';
        const step = Math.max(3, Math.round(w / 320));
        for (const b of bands) {
          const boost = 1 + pulse * 1.5;
          for (let x = -step; x < w + step; x += step) {
            const u = x / w;
            const yy = h * (b.y + b.amp * Math.sin(u * TAU * b.k * 0.5 + time * b.sp * 6) + 0.03 * Math.sin(u * 23 + time * 0.8));
            const hh = h * b.hgt * (0.7 + 0.3 * Math.sin(u * 9 + time * 0.5));
            const a = (0.06 + 0.05 * Math.sin(u * 7 - time * 0.9)) * boost;
            const gr = ctx.createLinearGradient(0, yy - hh, 0, yy);
            gr.addColorStop(0, `rgba(${b.c2[0]}, ${b.c2[1]}, ${b.c2[2]}, 0)`);
            gr.addColorStop(0.7, `rgba(${b.c1[0]}, ${b.c1[1]}, ${b.c1[2]}, ${a})`);
            gr.addColorStop(1, `rgba(${b.c1[0]}, ${b.c1[1]}, ${b.c1[2]}, 0)`);
            ctx.fillStyle = gr;
            ctx.fillRect(x, yy - hh, step + 1, hh);
          }
        }
        ctx.globalCompositeOperation = 'source-over';
        // a low dark ridge along the bottom
        ctx.fillStyle = '#020611';
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.9 - 30 * Math.abs(Math.sin(x * 0.004)) - 18 * Math.sin(x * 0.013));
        ctx.lineTo(w, h);
        ctx.fill();
      },
    };
  }

  // Synthwave: a striped sun over a neon grid rolling towards you
  function synthScene() {
    return {
      resize() {},
      draw() {
        const hz = h * 0.6;
        const sky = ctx.createLinearGradient(0, 0, 0, hz);
        sky.addColorStop(0, '#0d0221');
        sky.addColorStop(0.6, '#3a0a5a');
        sky.addColorStop(1, '#a3176e');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, hz);
        // sun
        const r = Math.min(w, h) * 0.2 * (1 + pulse * 0.08);
        const cx = w / 2;
        const cy = hz - r * 0.35;
        const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
        sun.addColorStop(0, '#ffe66d');
        sun.addColorStop(0.55, '#ff7a59');
        sun.addColorStop(1, '#ff2f92');
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.clip();
        ctx.fillStyle = sun;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
        ctx.fillStyle = '#3a0a5a';
        for (let i = 0; i < 7; i++) {
          const yy = cy + r * (0.1 + i * 0.13) - ((time * 6) % (r * 0.13));
          ctx.fillRect(cx - r, yy, r * 2, 2 + i * 1.1);
        }
        ctx.restore();
        // ground and grid
        const ground = ctx.createLinearGradient(0, hz, 0, h);
        ground.addColorStop(0, '#1b0530');
        ground.addColorStop(1, '#07010d');
        ctx.fillStyle = ground;
        ctx.fillRect(0, hz, w, h - hz);
        ctx.strokeStyle = `rgba(255, 79, 216, ${0.55 + pulse * 0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = -16; i <= 16; i++) {
          ctx.moveTo(cx + i * w * 0.012, hz);
          ctx.lineTo(cx + i * w * 0.16, h);
        }
        const off = (time * 0.35) % 1;
        for (let i = 0; i < 14; i++) {
          const z = (i + off) / 14;
          const yy = hz + (h - hz) * z * z;
          ctx.moveTo(0, yy);
          ctx.lineTo(w, yy);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 79, 216, 0.25)';
        ctx.fillRect(0, hz - 1, w, 2);
      },
    };
  }

  // Code rain: columns of falling glyphs, brighter heads, a burst on a line clear
  function codeScene() {
    const cols = [];
    const size = 16;
    const glyphs = '0123456789ABCDEFアイウエオカキクケコサシスセソタチツテトナニヌネノ';
    const fill = () => {
      cols.length = 0;
      const n = Math.ceil(w / size);
      for (let i = 0; i < n; i++) cols.push({ y: rand(-h, h), v: rand(60, 160), len: Math.floor(rand(8, 26)) });
    };
    return {
      resize: fill,
      draw(dt) {
        ctx.fillStyle = '#010603';
        ctx.fillRect(0, 0, w, h);
        ctx.font = `${size - 2}px monospace`;
        ctx.textBaseline = 'top';
        for (let i = 0; i < cols.length; i++) {
          const c = cols[i];
          c.y += c.v * dt * (1 + pulse * 3);
          if (c.y - c.len * size > h) {
            c.y = rand(-200, 0);
            c.v = rand(60, 160);
          }
          for (let k = 0; k < c.len; k++) {
            const yy = Math.floor(c.y / size) * size - k * size;
            if (yy < -size || yy > h) continue;
            const a = k === 0 ? 0.9 : (1 - k / c.len) * 0.35;
            ctx.fillStyle = k === 0 ? `rgba(200, 255, 220, ${a})` : `rgba(74, 222, 128, ${a})`;
            const gi = (i * 7 + Math.floor(yy / size) * 13 + Math.floor(time * 3 + i)) % glyphs.length;
            ctx.fillText(glyphs[(gi + glyphs.length) % glyphs.length], i * size, yy);
          }
        }
      },
    };
  }

  /* ------------------------------------------------------------- engine */

  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // The canvas fills the screen through CSS; draw at whatever size that is
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (scene) scene.resize();
  }

  function applyUi(ui) {
    const root = document.documentElement.style;
    root.setProperty('--tt-accent', ui.accent);
    root.setProperty('--tt-accent-2', ui.accent2);
    root.setProperty('--tt-text', ui.text);
    root.setProperty('--tt-muted', ui.muted);
    root.setProperty('--tt-panel', ui.panel);
    root.setProperty('--tt-edge', ui.edge);
    root.setProperty('--tt-board', ui.board);
    root.setProperty('--tt-glow', ui.glow);
    document.body.style.backgroundColor = ui.base;
    document.body.style.backgroundImage = ui.image;
    window.TT_GRID = ui.grid;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ui.base);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    if (dt < 1 / 64) return; // at most about 60 frames a second
    if (canvas.clientWidth !== w || canvas.clientHeight !== h) size();
    last = now;
    time += dt;
    pulse = Math.max(0, pulse - dt * 1.2);
    ctx.clearRect(0, 0, w, h);
    scene.draw(reduced ? 0 : dt);
  }

  function setTheme(name) {
    name = String(name || '').toLowerCase();
    name = ALIASES[name] || name;
    if (!THEMES[name]) name = 'rain';
    themeName = name;
    applyUi(THEMES[name].ui);
    scene = THEMES[name].make();
    if (canvas) {
      size();
      ctx.clearRect(0, 0, w, h);
      scene.draw(0);
    }
    if (typeof bg === 'function' && typeof settings !== 'undefined' && settings.Grid === 1 && typeof bgStackCtx !== 'undefined' && typeof cellSize !== 'undefined') bg(bgStackCtx);
  }

  function init() {
    canvas = document.createElement('canvas');
    canvas.id = 'liveBackground';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d');
    let start = 'rain';
    if (typeof settings !== 'undefined' && typeof setting !== 'undefined' && setting.Theme[settings.Theme]) start = setting.Theme[settings.Theme];
    setTheme(start);
    addEventListener('resize', size);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  return {
    init,
    setTheme,
    nextTheme() {
      const i = (ORDER.indexOf(themeName) + 1) % ORDER.length;
      setTheme(ORDER[i]);
      // Keep the Settings menu and the saved settings in step
      if (typeof settings !== 'undefined' && typeof saveSetting === 'function') {
        settings.Theme = i;
        try {
          saveSetting('Theme');
        } catch (e) { /* settings menu not built yet */ }
      }
    },
    getTheme: () => THEMES[themeName].title,
    get names() {
      return ORDER.map(n => THEMES[n].title);
    },
    // Called by the game: n lines cleared at once
    onLinesCleared(n) {
      pulse = Math.min(1, 0.35 + n * 0.18);
      if (!scene) return;
      if (n >= 4 && scene.bolt) scene.bolt();
      if (scene.ring) scene.ring(n);
    },
  };
})();

// Start once the page and the saved settings are in
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(LiveBackground.init, 0));
else setTimeout(LiveBackground.init, 0);
