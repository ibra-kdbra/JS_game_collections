/**
 * Draws the tank. Everything is vector art made in code: the 800 x 480 tank
 * is scaled to the canvas, so it stays sharp at any size.
 */
import { TANK, COINS, INVADERS, FOOD } from './config.js';

const PALETTES = [
  { top: '#3fc1d9', bottom: '#0d5b8a', sand: '#e9d39a', sandDark: '#c9ad6a', rock: '#2f6f8f', plant: '#3fae6a', plant2: '#2a8a55', ray: 'rgba(255,255,255,0.10)' },
  { top: '#2fa89a', bottom: '#0c4a5c', sand: '#d8c690', sandDark: '#b39f62', rock: '#28585e', plant: '#4c9a3c', plant2: '#2f7531', ray: 'rgba(230,255,220,0.09)' },
  { top: '#36b3c4', bottom: '#14507a', sand: '#efcf9e', sandDark: '#cfa46c', rock: '#7a4d73', plant: '#f07a8a', plant2: '#e9a23b', ray: 'rgba(255,240,220,0.10)' },
  { top: '#1b4f7a', bottom: '#050f24', sand: '#7d7a8c', sandDark: '#55526a', rock: '#1f2a44', plant: '#3c6f8f', plant2: '#2b4a6a', ray: 'rgba(160,200,255,0.06)' },
];

const lerp = (a, b, t) => a + (b - a) * t;
function mix(c1, c2, t) {
  const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const a = p(c1);
  const b = p(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

const MINNOW_COLORS = [
  { body: '#ffc93c', belly: '#fff2b8', fin: '#ff9f1c' },
  { body: '#ff9f43', belly: '#ffe0b8', fin: '#ff6b3d' },
  { body: '#ff6b5b', belly: '#ffd2c4', fin: '#e84a5f' },
];
const HUNGRY = '#9fbf86';

export function createRenderer(canvas) {
  const mainCtx = canvas.getContext('2d');
  let ctx = mainCtx; // icons borrow the drawing routines on another canvas
  let view = { scale: 1, dpr: 1, w: TANK.w, h: TANK.h };
  let bgKey = '';
  let bg = null;
  let decor = null;

  /**
   * The tank keeps its shape, scaled to fit. On tall screens the canvas is a
   * little taller than the tank and the extra room below is a deeper sand bed.
   */
  function resize(cssW, cssH, dpr) {
    const scale = Math.min(cssW / TANK.w, cssH / TANK.h);
    view = { scale, dpr, w: cssW, h: cssH, ox: (cssW - TANK.w * scale) / 2, oy: 0 };
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    bgKey = '';
  }

  /* ---------- Background (cached per level and size) ---------- */

  function buildBackground(level) {
    const pal = PALETTES[level % PALETTES.length];
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    const s = view.scale * view.dpr;
    // A deeper sand bed below the tank, for tall screens.
    const bed = g.createLinearGradient(0, 0, 0, c.height);
    bed.addColorStop(0, pal.sand);
    bed.addColorStop(1, mix(pal.sandDark, '#000000', 0.25));
    g.fillStyle = bed;
    g.fillRect(0, 0, c.width, c.height);
    g.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    const grad = g.createLinearGradient(0, 0, 0, TANK.h);
    grad.addColorStop(0, pal.top);
    grad.addColorStop(1, pal.bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, TANK.w, TANK.h);
    // Distant rocks.
    let seed = level * 97 + 5;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    g.fillStyle = pal.rock;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.moveTo(0, TANK.floor);
    for (let x = 0; x <= TANK.w; x += 40) g.lineTo(x, TANK.floor - 40 - rnd() * 70 - (x % 280 < 80 ? 50 : 0));
    g.lineTo(TANK.w, TANK.floor);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    // Sand.
    const sand = g.createLinearGradient(0, TANK.floor - 10, 0, TANK.h);
    sand.addColorStop(0, pal.sand);
    sand.addColorStop(1, pal.sandDark);
    g.fillStyle = sand;
    g.beginPath();
    g.moveTo(0, TANK.floor);
    for (let x = 0; x <= TANK.w; x += 20) g.lineTo(x, TANK.floor - 4 + Math.sin(x / 47) * 4);
    g.lineTo(TANK.w, TANK.h);
    g.lineTo(0, TANK.h);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 70; i++) g.fillRect(rnd() * TANK.w, TANK.floor + 4 + rnd() * 28, 3, 1.5);
    // Pebbles and a few shells.
    for (let i = 0; i < 18; i++) {
      g.fillStyle = mix(pal.sandDark, '#444444', 0.3 + rnd() * 0.3);
      g.beginPath();
      g.ellipse(rnd() * TANK.w, TANK.floor + 6 + rnd() * 20, 4 + rnd() * 6, 2.5 + rnd() * 3, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Pebbles further down the bed (only seen on tall screens).
    const below = (c.height / s - TANK.h);
    for (let i = 0; i < below / 3; i++) {
      g.fillStyle = mix(pal.sandDark, '#3a3a3a', 0.2 + rnd() * 0.4);
      g.beginPath();
      g.ellipse(rnd() * TANK.w, TANK.h + rnd() * below, 3 + rnd() * 7, 2 + rnd() * 4, 0, 0, Math.PI * 2);
      g.fill();
    }
    // Plant positions for the animated layer.
    decor = [];
    for (let i = 0; i < 9; i++) {
      decor.push({ x: 30 + rnd() * (TANK.w - 60), h: 60 + rnd() * 110, w: 7 + rnd() * 6, color: rnd() < 0.5 ? pal.plant : pal.plant2, phase: rnd() * 6, coral: level === 2 && rnd() < 0.6 });
    }
    decor.sort((a, b) => a.h - b.h);
    bg = c;
    bgKey = `${level}:${canvas.width}x${canvas.height}`;
  }

  function drawPlants(t) {
    for (const p of decor) {
      ctx.fillStyle = p.color;
      if (p.coral) {
        // Branching coral.
        ctx.strokeStyle = p.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = p.w;
        const branch = (x, y, len, ang, depth) => {
          const x2 = x + Math.cos(ang) * len;
          const y2 = y + Math.sin(ang) * len;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          if (depth > 0) {
            ctx.lineWidth *= 0.75;
            branch(x2, y2, len * 0.7, ang - 0.5, depth - 1);
            branch(x2, y2, len * 0.7, ang + 0.45, depth - 1);
            ctx.lineWidth /= 0.75;
          }
        };
        branch(p.x, TANK.floor + 2, p.h * 0.35, -Math.PI / 2 + Math.sin(p.phase) * 0.2, 2);
        continue;
      }
      // Kelp: a ribbon that sways.
      ctx.beginPath();
      const segs = 8;
      const pts = [];
      for (let i = 0; i <= segs; i++) {
        const k = i / segs;
        const sway = Math.sin(t / 50 + p.phase + k * 2.2) * 10 * k;
        pts.push([p.x + sway, TANK.floor + 4 - p.h * k]);
      }
      ctx.moveTo(pts[0][0] - p.w / 2, pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x - (p.w / 2) * (1 - 0.6 * ((TANK.floor - y) / p.h)), y);
      for (let i = pts.length - 1; i >= 0; i--) {
        const [x, y] = pts[i];
        ctx.lineTo(x + (p.w / 2) * (1 - 0.6 * ((TANK.floor - y) / p.h)), y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRays(t, pal) {
    ctx.fillStyle = pal.ray;
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 170 + Math.sin(t / 240 + i) * 30;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 50, 0);
      ctx.lineTo(x + 140, TANK.floor);
      ctx.lineTo(x + 40, TANK.floor);
      ctx.closePath();
      ctx.fill();
    }
  }

  /* ---------- Creatures ---------- */

  function fishBody(len, height, body, belly, fin, wag, eyeX) {
    // Tail.
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.moveTo(-len * 0.75, 0);
    ctx.lineTo(-len * 1.25, -height * 0.75 + wag);
    ctx.quadraticCurveTo(-len * 1.08, wag * 0.5, -len * 1.25, height * 0.75 + wag);
    ctx.closePath();
    ctx.fill();
    // Dorsal fin.
    ctx.beginPath();
    ctx.moveTo(-len * 0.3, -height * 0.8);
    ctx.quadraticCurveTo(0, -height * 1.45, len * 0.25, -height * 0.85);
    ctx.closePath();
    ctx.fill();
    // Body.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.bezierCurveTo(len * 0.8, -height * 1.15, -len * 0.6, -height * 1.1, -len * 0.85, 0);
    ctx.bezierCurveTo(-len * 0.6, height * 1.1, len * 0.8, height * 1.1, len, 0);
    ctx.fill();
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.moveTo(len * 0.85, height * 0.2);
    ctx.bezierCurveTo(len * 0.5, height * 0.95, -len * 0.5, height * 0.9, -len * 0.7, height * 0.25);
    ctx.bezierCurveTo(-len * 0.2, height * 0.45, len * 0.4, height * 0.45, len * 0.85, height * 0.2);
    ctx.fill();
    // Side fin.
    ctx.fillStyle = fin;
    ctx.beginPath();
    ctx.ellipse(len * 0.05, height * 0.25, len * 0.22, height * 0.22, 0.6 + wag * 0.03, 0, Math.PI * 2);
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX, -height * 0.25, height * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMinnow(f, t, world) {
    const len = world.sizeOf(f);
    const h = len * 0.55;
    const c = MINNOW_COLORS[f.stage];
    let hungerT = 0;
    if (!f.dead && world.isHungry(f)) hungerT = Math.min(1, (world.time - f.fedUntil) / 300);
    const body = f.dead ? '#a3a3a3' : mix(c.body, HUNGRY, hungerT * 0.85);
    const belly = f.dead ? '#d4d4d4' : mix(c.belly, '#d9e8c8', hungerT * 0.7);
    const fin = f.dead ? '#8a8a8a' : mix(c.fin, '#7f9e6a', hungerT * 0.85);
    const wag = f.dead ? 0 : Math.sin(t / (f.kind === 'pike' ? 7 : 5) + f.wiggle) * h * 0.35;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.face, f.dead ? -1 : 1);
    ctx.rotate(Math.max(-0.35, Math.min(0.35, f.vy * 0.25)) * (f.dead ? 0 : 1));
    fishBody(len, h, body, belly, fin, wag, len * 0.55);
    // Pupil, or a cross when dead.
    if (f.dead) {
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.6;
      const e = len * 0.55;
      const r = h * 0.18;
      ctx.beginPath();
      ctx.moveTo(e - r, -h * 0.25 - r);
      ctx.lineTo(e + r, -h * 0.25 + r);
      ctx.moveTo(e + r, -h * 0.25 - r);
      ctx.lineTo(e - r, -h * 0.25 + r);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#1b1b2a';
      ctx.beginPath();
      ctx.arc(len * 0.6, -h * 0.25, h * 0.17, 0, Math.PI * 2);
      ctx.fill();
      // A hungry fish opens its mouth.
      if (hungerT > 0) {
        ctx.fillStyle = '#5a2b2b';
        ctx.beginPath();
        ctx.ellipse(len * 0.93, h * 0.1, h * 0.12, h * 0.18 * (0.6 + 0.4 * Math.sin(t / 6)), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPike(f, t, world) {
    const len = world.sizeOf(f);
    const h = len * 0.32;
    const hungry = world.isHungry(f);
    const wag = f.dead ? 0 : Math.sin(t / 6 + f.wiggle) * h * 0.4;
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.face, f.dead ? -1 : 1);
    fishBody(len, h, f.dead ? '#9a9a9a' : hungry ? '#7d9a8a' : '#5f9e8f', '#dfeee6', f.dead ? '#7a7a7a' : '#3f7d6f', wag, len * 0.62);
    // Stripes and a toothy jaw.
    ctx.strokeStyle = 'rgba(20,60,50,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const x = -len * 0.4 + i * len * 0.24;
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.85);
      ctx.lineTo(x - 4, h * 0.2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(len * 0.72 + i * 6, h * 0.25);
      ctx.lineTo(len * 0.75 + i * 6, h * 0.55);
      ctx.lineTo(len * 0.78 + i * 6, h * 0.25);
      ctx.fill();
    }
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(len * 0.66, -h * 0.25, h * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPellet(p) {
    const colors = ['#9a6b3c', '#5f9e3c', '#e0574f'];
    ctx.fillStyle = colors[p.level];
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.level === 2 ? 6 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.arc(p.x - 1.6, p.y - 1.6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCoin(c, t) {
    const r = COINS[c.type].r;
    const fade = c.floorT > COINS.floorLife - 60 && c.type !== 'chest' ? (Math.floor(t / 5) % 2 ? 0.35 : 1) : 1;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(c.x, c.y);
    if (c.type === 'gem') {
      ctx.fillStyle = '#4fd8ff';
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.85, -r * 0.2);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.85, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#c9f5ff';
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.4, -r * 0.2);
      ctx.lineTo(-r * 0.4, -r * 0.2);
      ctx.closePath();
      ctx.fill();
    } else if (c.type === 'chest') {
      ctx.fillStyle = '#8a4f22';
      ctx.fillRect(-r, -r * 0.5, r * 2, r * 1.2);
      ctx.fillStyle = '#b56a2e';
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.5, r, r * 0.55, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.fillRect(-r, -r * 0.15, r * 2, 3);
      ctx.fillRect(-3, -r * 0.35, 6, 8);
    } else {
      const gold = c.type === 'gold';
      ctx.fillStyle = gold ? '#e8a90c' : '#a7b0bd';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = gold ? '#ffd84d' : '#dfe5ec';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fill();
      // A turning glint.
      const g = Math.sin(t / 12 + c.id) * 0.5 + 0.5;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.25, r * 0.18 + g * 2, r * 0.12, -0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCrab(crab, t) {
    const x = crab.x;
    const y = TANK.floor + 6;
    const step = crab.walking ? Math.sin(t / 3) : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = '#b33a2b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(side * 8, -6 + i * 3);
        ctx.lineTo(side * (17 + i * 2), -2 + i * 3 + (i % 2 ? step : -step) * 2);
        ctx.lineTo(side * (20 + i * 2), 4 + i);
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#e2533f';
    ctx.beginPath();
    ctx.ellipse(0, -8, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Claws.
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 18, -18 + (side > 0 ? step : -step), 6, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-5, -18, 3.5, 0, Math.PI * 2);
    ctx.arc(5, -18, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(-5 + crab.face, -18, 1.8, 0, Math.PI * 2);
    ctx.arc(5 + crab.face, -18, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawInvader(inv, t) {
    const spec = INVADERS[inv.kind];
    const flash = inv.hitT > 0 && inv.hitT % 4 < 2;
    ctx.save();
    ctx.translate(inv.x, inv.y);
    if (inv.kind === 'squid') {
      const s = spec.size;
      // Tentacles.
      ctx.strokeStyle = flash ? '#ffffff' : '#8e44ad';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const bx = -s * 0.45 + i * s * 0.18;
        ctx.beginPath();
        ctx.moveTo(bx, s * 0.25);
        for (let k = 1; k <= 4; k++) ctx.lineTo(bx + Math.sin(t / 8 + i + k) * 6, s * 0.25 + k * s * 0.16);
        ctx.stroke();
      }
      ctx.fillStyle = flash ? '#ffffff' : '#a55bd1';
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.9);
      ctx.bezierCurveTo(s * 0.75, -s * 0.6, s * 0.7, s * 0.35, 0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.7, s * 0.35, -s * 0.75, -s * 0.6, 0, -s * 0.9);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.2, -s * 0.45, s * 0.12, s * 0.25, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Angry eyes.
      for (const side of [-1, 1]) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(side * s * 0.22, -s * 0.05, s * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#c0392b';
        ctx.beginPath();
        ctx.arc(side * s * 0.22 + inv.face * 2, -s * 0.03, s * 0.07, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#4a1d63';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(side * s * 0.38, -s * 0.24);
        ctx.lineTo(side * s * 0.08, -s * 0.14);
        ctx.stroke();
      }
    } else {
      // Eel: a segmented body that undulates behind its head.
      const s = spec.size;
      ctx.scale(inv.face, 1);
      ctx.fillStyle = flash ? '#ffffff' : '#2e7d4f';
      for (let i = 9; i >= 0; i--) {
        const x = -i * s * 0.16;
        const y = Math.sin(t / 7 - i * 0.7) * 8 * (i / 9);
        ctx.beginPath();
        ctx.arc(x, y, s * 0.24 * (1 - i * 0.06), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = flash ? '#ffffff' : '#3d9a63';
      ctx.beginPath();
      ctx.ellipse(s * 0.12, 0, s * 0.36, s * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(s * 0.25, -s * 0.08, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.fillRect(s * 0.24, -s * 0.12, 2, s * 0.08);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(s * 0.18 + i * 6, s * 0.1);
        ctx.lineTo(s * 0.21 + i * 6, s * 0.2);
        ctx.lineTo(s * 0.24 + i * 6, s * 0.1);
        ctx.fill();
      }
    }
    ctx.restore();
    // Health bar.
    const w = 70;
    const frac = Math.max(0, inv.hp / inv.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(inv.x - w / 2, inv.y - spec.size - 14, w, 6);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#ef4444';
    ctx.fillRect(inv.x - w / 2 + 1, inv.y - spec.size - 13, (w - 2) * frac, 4);
  }

  /* ---------- Frame ---------- */

  function draw(world, fx, t) {
    if (bgKey !== `${world.level}:${canvas.width}x${canvas.height}`) buildBackground(world.level);
    const pal = PALETTES[world.level % PALETTES.length];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    const s = view.scale * view.dpr;
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    drawRays(t, pal);
    drawPlants(t);
    // Bubbles from the bubbler in the corner, plus effect bubbles.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 12; i++) {
      const k = ((t * 0.9 + i * 47) % 420) / 420;
      const x = 742 + Math.sin(t / 20 + i) * 6;
      const y = TANK.floor - 10 - k * (TANK.floor - TANK.surface);
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5b6474';
    ctx.fillRect(732, TANK.floor - 8, 20, 12);
    for (const p of world.pellets) drawPellet(p);
    if (world.crab) drawCrab(world.crab, t);
    for (const f of world.fish) (f.kind === 'pike' ? drawPike : drawMinnow)(f, t, world);
    for (const c of world.coins) drawCoin(c, t);
    if (world.invader) drawInvader(world.invader, t);
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = '700 18px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const p of fx.popups) {
      ctx.globalAlpha = Math.min(1, p.life / 20);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(p.text, p.x + 1.5, p.y + 1.5);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
    // Surface shimmer.
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, TANK.w, 3);
    for (let x = 0; x < TANK.w; x += 40) {
      ctx.fillRect(x + ((t / 3) % 40), 6 + Math.sin((x + t) / 30) * 2, 18, 2);
    }
    // Invader warning: a red pulse around the edges.
    if (world.warning > 0 || world.invader) {
      const a = world.warning > 0 ? 0.25 + 0.2 * Math.sin(t / 6) : 0.12;
      const grad = ctx.createRadialGradient(TANK.w / 2, TANK.h / 2, TANK.h * 0.45, TANK.w / 2, TANK.h / 2, TANK.w * 0.62);
      grad.addColorStop(0, 'rgba(239,68,68,0)');
      grad.addColorStop(1, `rgba(239,68,68,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, TANK.w, TANK.h);
    }
  }

  /** Small icon canvases for the shop buttons, drawn with the same art. */
  function icon(id, size = 44) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    const g = c.getContext('2d');
    // Draw with the shared routines by swapping the context.
    const restore = swap(g);
    g.scale((size * 2) / 64, (size * 2) / 64);
    g.translate(32, 34);
    const fake = { sizeOf: () => (id === 'pike' ? 22 : 17), isHungry: () => false, time: 0 };
    if (id === 'minnow') drawMinnow({ x: 2, y: 0, face: 1, stage: 1, vy: 0, wiggle: 0, kind: 'minnow' }, 0, fake);
    else if (id === 'pike') drawPike({ x: 2, y: 0, face: 1, vy: 0, wiggle: 0, kind: 'pike' }, 0, fake);
    else if (id === 'quality') [[-8, -4, 0], [6, -8, 1], [0, 8, 2]].forEach(([x, y, level]) => drawPellet({ x, y, level }));
    else if (id === 'count') for (let i = 0; i < 5; i++) drawPellet({ x: -14 + i * 7, y: Math.sin(i) * 8, level: 1 });
    else if (id === 'crab') {
      g.translate(0, -TANK.floor + 2);
      drawCrab({ x: 0, face: 1, walking: false }, 0);
    } else if (id === 'weapon') {
      g.strokeStyle = '#facc15';
      g.lineWidth = 4;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(4, -22);
      g.lineTo(-8, 2);
      g.lineTo(4, 2);
      g.lineTo(-6, 22);
      g.stroke();
    } else if (id === 'shard') {
      const grad = g.createRadialGradient(-5, -6, 2, 0, 0, 18);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#e9d5ff');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, 16, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(120,90,160,0.5)';
      g.lineWidth = 1.5;
      g.stroke();
    }
    restore();
    return c;
  }

  function swap(g) {
    ctx = g;
    return () => {
      ctx = mainCtx;
    };
  }

  /** Canvas pixel (CSS) to tank coordinates. */
  function toTank(px, py) {
    return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
  }

  return { resize, draw, icon, toTank, palette: (level) => PALETTES[level % PALETTES.length] };
}

void FOOD;
