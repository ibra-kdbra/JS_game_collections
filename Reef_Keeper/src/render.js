/**
 * Draws the whole game frame (640 x 480): the shop bar, the tank and
 * everything in it. All art is drawn in code in a cartoon style: dark
 * outlines, shaded bodies, big eyes. The frame keeps its 4:3 shape and is
 * scaled to fit the canvas.
 */
import { FRAME, BAR, TANK, FISH, COINS, ALIENS, FOOD, PETS } from './config.js';
import { loadSprites, sprite, STRIPS } from './sprites.js';
import { original } from './original.js';
import { createOriginalArt, artSlotRect, ART_MENU, ART_MONEY } from './render-original.js';

const INK = '#1a2433';
const FONT = '"Luckiest Guy", "Chakra Petch", system-ui, sans-serif';

const TANKS = [
  { top: '#59c9e8', mid: '#2a93c6', bottom: '#165a8e', rock: '#3a6f8a', rock2: '#55879f', sand: '#ecd49b', sand2: '#c9a865', plant: '#4cbc63', plant2: '#2f9a4f', deco: 'castle' },
  { top: '#4fc6b8', mid: '#23948e', bottom: '#0f5a66', rock: '#356b63', rock2: '#4d8a7f', sand: '#e2cf96', sand2: '#bba15e', plant: '#58b447', plant2: '#3a8f31', deco: 'chest' },
  { top: '#6ad0e0', mid: '#2f9bc0', bottom: '#1a5f8c', rock: '#6d5a87', rock2: '#8b76a6', sand: '#f2d4a2', sand2: '#d3a76a', plant: '#ff7f94', plant2: '#ffb347', deco: 'arch' },
  { top: '#5bbfd6', mid: '#2a7fb0', bottom: '#173f78', rock: '#4a5f86', rock2: '#62799e', sand: '#e8d0a0', sand2: '#c3a166', plant: '#ff8fb1', plant2: '#7ed6a6', deco: 'ship' },
  { top: '#3a6f9e', mid: '#1d4475', bottom: '#0a1a3d', rock: '#2a3350', rock2: '#3b4668', sand: '#8e86a3', sand2: '#625b7a', plant: '#5fe0c8', plant2: '#a07cf0', deco: 'vents' },
];

// Guppies are green with yellow fins, darker as they grow; star guppies are gold.
const GUPPY = [
  { body: '#7ed957', light: '#c9f59e', belly: '#f2ffd9', fin: '#ffd23f' },
  { body: '#4fbf4a', light: '#a8ec8a', belly: '#e8fbd0', fin: '#ffb627' },
  { body: '#2f9e44', light: '#86d96f', belly: '#dcf5c4', fin: '#ff9f1c' },
  { body: '#ffc93c', light: '#fff1a6', belly: '#fffbe0', fin: '#ff7b2e' },
];
// Hungry fish fade to a sickly olive.
const HUNGRY = { body: '#b5a46a', light: '#ddd2a0', belly: '#f1ead0', fin: '#9c8a55' };

const lerp = (a, b, t) => a + (b - a) * t;
function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}
function mix(c1, c2, t) {
  const a = hex(c1);
  const b = hex(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}

/** Shop bar layout, in frame pixels. */
export const SLOT = { x: 7, y: 7, w: 62, h: 60, gap: 5 }; // eight fit before the money box
const OWN_MONEY = { x: 546, y: 7, w: 86, h: 36 };
const OWN_MENU = { x: 546, y: 47, w: 86, h: 21 };
/** Slot `i` of a bar holding `n` buttons (the original art's bar has its own slots). */
export const slotRect = (i, n = 8) => (original.ready ? artSlotRect(i, n) : { x: SLOT.x + i * (SLOT.w + SLOT.gap), y: SLOT.y, w: SLOT.w, h: SLOT.h });
// The money box and menu button move to match the original bar when it's loaded.
export const MONEY = { ...OWN_MONEY };
export const MENU = { ...OWN_MENU };
original.onChange((on) => {
  Object.assign(MONEY, on ? ART_MONEY : OWN_MONEY);
  Object.assign(MENU, on ? ART_MENU : OWN_MENU);
});

export function createRenderer(canvas) {
  const main = canvas.getContext('2d');
  let spritesReady = false;
  loadSprites(() => {
    spritesReady = true;
    bgKey = ''; // rebuild the tank with its painted background
  });
  let ctx = main;
  const orig = createOriginalArt(() => ctx);
  original.onChange(() => {
    bgKey = '';
  });
  let view = { scale: 1, dpr: 1, ox: 0, oy: 0, cssW: FRAME.w, cssH: FRAME.h };
  let bgKey = '';
  let bg = null;
  let plants = [];

  function resize(cssW, cssH, dpr) {
    const scale = Math.min(cssW / FRAME.w, cssH / FRAME.h);
    view = { scale, dpr, ox: (cssW - FRAME.w * scale) / 2, oy: (cssH - FRAME.h * scale) / 2, cssW, cssH };
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    bgKey = '';
  }

  const toFrame = (px, py) => ({ x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale });

  /* ---------- Drawing helpers ---------- */

  function ink(fill, lw = 2.5) {
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = INK;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function text(str, x, y, size, fill, { align = 'center', stroke = INK, lw = 4, font = FONT } = {}) {
    ctx.font = `${size}px ${font}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    if (stroke) {
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
  }

  /* ---------- Sprites ---------- */

  /** Draw an image (or one frame of a strip) centred at (x, y), `w` wide. */
  function drawSprite(name, x, y, w, frame = 0) {
    const img = sprite(name);
    if (!img) return false;
    const frames = STRIPS[name.replace(/-(hungry|dead|flash|teal)$/, '')] ?? 1;
    const fw = (img.naturalWidth || img.width) / frames;
    const fh = img.naturalHeight || img.height;
    const h = (w * fh) / fw;
    ctx.drawImage(img, (frame % frames) * fw, 0, fw, fh, x - w / 2, y - h / 2, w, h);
    return true;
  }

  /** Swap in a crossfade: `a` at full strength, `b` on top at `k`. */
  function blend(a, b, k, x, y, w, frame) {
    drawSprite(a, x, y, w, frame);
    if (k > 0.02 && sprite(b)) {
      ctx.globalAlpha *= k;
      drawSprite(b, x, y, w, frame);
      ctx.globalAlpha /= k;
    }
  }

  const hungerOf = (f, world) => (!f.dead && world.isHungry(f) ? Math.min(1, (world.time - f.fedUntil) / 240) : 0);
  const eatPulse = (f) => (f.eatT > 0 ? 1 + 0.14 * Math.sin((f.eatT / 16) * Math.PI) : 1);

  /** Andrew Tidey's fish (they face right). Dead fish use their own upright art. */
  function tideyFish(base, f, t, world, width) {
    if (f.dead) {
      ctx.scale(1, -1); // drawFish turned the fish belly up; this art is drawn that way already
      drawSprite(`${base}-dead`, 0, 0, width);
      return;
    }
    const wob = Math.sin(t / 7 + f.phase) * 0.05;
    const k = eatPulse(f);
    ctx.rotate(wob);
    ctx.scale(k, k * (1 + Math.sin(t / 5 + f.phase) * 0.025));
    blend(base, `${base}-sick`, hungerOf(f, world), 0, 0, width);
  }

  /** Game Developer Studio's swimming fish (they face left, 12 frames). */
  function cartoonFish(name, f, t, world, width) {
    const frame = Math.floor(t * 0.35 + f.phase * 7);
    ctx.scale(-1, 1);
    if (f.dead) {
      drawSprite(`${name}-dead`, 0, 0, width, 0);
      return;
    }
    const k = eatPulse(f);
    ctx.scale(k, k);
    blend(name, `${name}-hungry`, hungerOf(f, world), 0, 0, width, frame);
  }

  /* ---------- Tank background (cached per level and size) ---------- */

  function rock(g, x, y, w, h, fill, shade) {
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.bezierCurveTo(x - w / 2, y - h * 0.8, x - w * 0.25, y - h, x, y - h);
    g.bezierCurveTo(x + w * 0.3, y - h, x + w / 2, y - h * 0.7, x + w / 2, y);
    g.closePath();
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = INK;
    g.stroke();
    g.fillStyle = shade;
    g.beginPath();
    g.ellipse(x - w * 0.15, y - h * 0.62, w * 0.16, h * 0.14, -0.4, 0, Math.PI * 2);
    g.fill();
  }

  function buildBackground(level) {
    const P = TANKS[level % TANKS.length];
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    g.fillStyle = '#05121d';
    g.fillRect(0, 0, c.width, c.height);
    const s = view.scale * view.dpr;
    g.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    g.save();
    g.beginPath();
    g.rect(0, TANK.y, TANK.w, TANK.h);
    g.clip();
    const water = g.createLinearGradient(0, TANK.y, 0, FRAME.h);
    water.addColorStop(0, P.top);
    water.addColorStop(0.45, P.mid);
    water.addColorStop(1, P.bottom);
    g.fillStyle = water;
    g.fillRect(0, TANK.y, TANK.w, TANK.h);
    let seed = level * 131 + 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    if (orig.ready() && orig.background(g, level)) {
      g.restore();
      plants = [];
      bg = c;
      bgKey = `${level}:${canvas.width}x${canvas.height}:${spritesReady}:${original.ready}`;
      return;
    }
    // The first tank uses Andrew Tidey's painted background.
    if (level === 0 && sprite('tank-shallows')) {
      const img = sprite('tank-shallows');
      const h = (TANK.w * img.naturalHeight) / img.naturalWidth;
      g.drawImage(img, 0, FRAME.h - h, TANK.w, h);
      g.restore();
      plants = [];
      bg = c;
      bgKey = `${level}:${canvas.width}x${canvas.height}:${spritesReady}:${original.ready}`;
      return;
    }
    // Far rocks, hazy.
    g.globalAlpha = 0.35;
    g.fillStyle = P.rock;
    g.beginPath();
    g.moveTo(0, TANK.floor);
    for (let x = 0; x <= TANK.w + 40; x += 40) g.lineTo(x, TANK.floor - 50 - rnd() * 70 - (Math.sin(x / 90) + 1) * 30);
    g.lineTo(TANK.w, TANK.floor);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    // Decoration.
    const D = P.deco;
    if (D === 'castle') {
      const x = 470;
      const y = TANK.floor + 4;
      g.fillStyle = '#c9b7a0';
      g.strokeStyle = INK;
      g.lineWidth = 2.5;
      g.beginPath();
      g.rect(x, y - 110, 70, 110);
      g.fill();
      g.stroke();
      g.beginPath();
      g.rect(x - 26, y - 70, 30, 70);
      g.fill();
      g.stroke();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.rect(x + i * 18 - 2, y - 122, 14, 14);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#2b2440';
      g.beginPath();
      g.moveTo(x + 22, y);
      g.lineTo(x + 22, y - 32);
      g.arc(x + 35, y - 32, 13, Math.PI, 0);
      g.lineTo(x + 48, y);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#2b2440';
      g.fillRect(x + 28, y - 85, 14, 18);
      g.strokeRect(x + 28, y - 85, 14, 18);
    } else if (D === 'chest') {
      const x = 120;
      const y = TANK.floor + 2;
      g.fillStyle = '#8a5a2b';
      g.strokeStyle = INK;
      g.lineWidth = 2.5;
      g.beginPath();
      g.rect(x - 40, y - 34, 80, 34);
      g.fill();
      g.stroke();
      g.save();
      g.translate(x - 40, y - 34);
      g.rotate(-0.5);
      g.beginPath();
      g.rect(0, -26, 80, 26);
      g.fillStyle = '#a06a35';
      g.fill();
      g.stroke();
      g.restore();
      g.fillStyle = '#f4c542';
      g.beginPath();
      g.arc(x - 6, y - 38, 7, 0, Math.PI * 2);
      g.arc(x + 8, y - 36, 6, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e0b030';
      g.fillRect(x - 40, y - 20, 80, 5);
      // Anchor.
      g.strokeStyle = '#4d5866';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(520, TANK.floor - 100);
      g.lineTo(520, TANK.floor - 10);
      g.moveTo(490, TANK.floor - 30);
      g.quadraticCurveTo(520, TANK.floor, 550, TANK.floor - 30);
      g.moveTo(500, TANK.floor - 85);
      g.lineTo(540, TANK.floor - 85);
      g.stroke();
      g.lineCap = 'butt';
    } else if (D === 'arch') {
      g.fillStyle = P.rock2;
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(330, TANK.floor + 4);
      g.bezierCurveTo(320, TANK.floor - 170, 520, TANK.floor - 180, 520, TANK.floor + 4);
      g.lineTo(480, TANK.floor + 4);
      g.bezierCurveTo(480, TANK.floor - 110, 370, TANK.floor - 110, 370, TANK.floor + 4);
      g.closePath();
      g.fill();
      g.stroke();
    } else if (D === 'ship') {
      g.save();
      g.translate(150, TANK.floor + 6);
      g.rotate(-0.12);
      g.fillStyle = '#6b4a2f';
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-90, 0);
      g.lineTo(-70, -60);
      g.lineTo(80, -60);
      g.lineTo(100, -20);
      g.lineTo(90, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#4e3520';
      for (let i = 0; i < 4; i++) g.fillRect(-60 + i * 35, -45, 18, 14);
      g.fillStyle = '#7a5636';
      g.fillRect(-6, -150, 10, 92);
      g.strokeRect(-6, -150, 10, 92);
      g.restore();
    } else if (D === 'vents') {
      for (const x of [120, 480]) {
        rock(g, x, TANK.floor + 6, 70, 46, '#3b3550', '#55507a');
        g.fillStyle = '#ff7a3d';
        g.beginPath();
        g.ellipse(x, TANK.floor - 38, 9, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // Mid rocks.
    rock(g, 40, TANK.floor + 6, 110, 70, P.rock2, 'rgba(255,255,255,0.18)');
    rock(g, 610, TANK.floor + 6, 90, 56, P.rock2, 'rgba(255,255,255,0.18)');
    if (D !== 'castle') rock(g, 300, TANK.floor + 6, 60, 30, P.rock, 'rgba(255,255,255,0.15)');
    // Sand.
    const sand = g.createLinearGradient(0, TANK.floor - 8, 0, FRAME.h);
    sand.addColorStop(0, P.sand);
    sand.addColorStop(1, P.sand2);
    g.fillStyle = sand;
    g.beginPath();
    g.moveTo(-5, TANK.floor + 2);
    for (let x = 0; x <= TANK.w + 20; x += 16) g.lineTo(x, TANK.floor - 2 + Math.sin(x / 41) * 3 + Math.sin(x / 13) * 1.2);
    g.lineTo(TANK.w + 5, FRAME.h + 5);
    g.lineTo(-5, FRAME.h + 5);
    g.closePath();
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = INK;
    g.stroke();
    for (let i = 0; i < 90; i++) {
      const x = rnd() * TANK.w;
      const y = TANK.floor + 6 + rnd() * 20;
      g.fillStyle = ['#d98f6a', '#8fb7d9', '#e8e2c8', '#a8a090', '#f0b85a'][i % 5];
      g.beginPath();
      g.ellipse(x, y, 2 + rnd() * 2.5, 1.5 + rnd() * 1.5, rnd(), 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    // Plants for the animated layer.
    plants = [];
    const n = level === 4 ? 6 : 8;
    for (let i = 0; i < n; i++) {
      plants.push({ x: 20 + rnd() * (TANK.w - 40), h: 50 + rnd() * 90, w: 9 + rnd() * 6, color: rnd() < 0.5 ? P.plant : P.plant2, phase: rnd() * 6, glow: level === 4 });
    }
    bg = c;
    bgKey = `${level}:${canvas.width}x${canvas.height}:${spritesReady}:${original.ready}`; // level here is the world index
  }

  function drawPlants(t) {
    for (const p of plants) {
      const pts = [];
      const segs = 7;
      for (let i = 0; i <= segs; i++) {
        const k = i / segs;
        pts.push([p.x + Math.sin(t / 55 + p.phase + k * 2.4) * 9 * k, TANK.floor + 6 - p.h * k]);
      }
      ctx.beginPath();
      ctx.moveTo(pts[0][0] - p.w / 2, pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x - (p.w / 2) * (1 - 0.7 * ((TANK.floor + 6 - y) / p.h)), y);
      for (let i = pts.length - 1; i >= 0; i--) {
        const [x, y] = pts[i];
        ctx.lineTo(x + (p.w / 2) * (1 - 0.7 * ((TANK.floor + 6 - y) / p.h)), y);
      }
      ctx.closePath();
      if (p.glow) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
      }
      ink(p.color, 2);
      ctx.shadowBlur = 0;
    }
  }

  function drawLight(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 4; i++) {
      const x = 60 + i * 160 + Math.sin(t / 260 + i * 1.7) * 30;
      ctx.beginPath();
      ctx.moveTo(x, TANK.y);
      ctx.lineTo(x + 55, TANK.y);
      ctx.lineTo(x + 150, TANK.floor);
      ctx.lineTo(x + 45, TANK.floor);
      ctx.closePath();
      ctx.fill();
    }
    // Caustics dancing on the sand.
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      const y0 = TANK.floor + 6 + (i % 3) * 7;
      for (let x = 0; x <= TANK.w; x += 12) {
        const y = y0 + Math.sin(x / 23 + t / 30 + i) * 2.5;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Fish ---------- */

  function eye(x, y, r, look = 0, { closed = false, dead = false, angry = false, lashes = false } = {}) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ink('#ffffff', 2);
    if (dead) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.5);
      ctx.lineTo(x + r * 0.5, y + r * 0.5);
      ctx.moveTo(x + r * 0.5, y - r * 0.5);
      ctx.lineTo(x - r * 0.5, y + r * 0.5);
      ctx.stroke();
      return;
    }
    if (closed) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y + r * 0.1, r * 0.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + r * 0.32 + look, y, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + r * 0.45 + look, y - r * 0.22, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    if (angry) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.9, y - r * 1.2);
      ctx.lineTo(x + r * 0.9, y - r * 0.55);
      ctx.stroke();
    }
    if (lashes) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 - 0.5 + i * 0.5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        ctx.lineTo(x + Math.cos(a) * r * 1.45, y + Math.sin(a) * r * 1.45);
        ctx.stroke();
      }
    }
  }

  function guppy(f, t, world) {
    const L = world.sizeOf(f);
    const art = `guppy-${['small', 'medium', 'large', 'large'][f.stage]}`;
    if (sprite(art)) {
      if (f.stage === 3 && !f.dead) {
        ctx.shadowColor = '#ffe14d';
        ctx.shadowBlur = 14;
      }
      tideyFish(art, f, t, world, L * 2.5);
      ctx.shadowBlur = 0;
      if (f.stage === 3 && !f.dead) for (let i = 0; i < 3; i++) starShape(-L * 0.35 + i * L * 0.35, -L * 1.05 - (i === 1 ? 5 : 0), 5 + (i === 1 ? 2 : 0), '#fff36b', Math.sin(t / 10 + i));
      return;
    }
    const H = L * 0.62;
    const hungry = !f.dead && world.isHungry(f);
    const hungerT = hungry ? Math.min(1, (world.time - f.fedUntil) / 240) : 0;
    const starving = hungry && f.starveAt - world.time < 600;
    const base = GUPPY[f.stage];
    const col = (k) => (f.dead ? mix(base[k], '#9aa0a8', 0.75) : mix(base[k], HUNGRY[k], hungerT));
    const wag = f.dead ? 0 : Math.sin(t / 5 + f.phase) * H * 0.3;
    // Tail.
    ctx.beginPath();
    ctx.moveTo(-L * 0.72, 0);
    ctx.quadraticCurveTo(-L * 1.05, -H * 0.2 + wag * 0.5, -L * 1.38, -H * 0.85 + wag);
    ctx.quadraticCurveTo(-L * 1.18, wag * 0.4, -L * 1.38, H * 0.85 + wag);
    ctx.quadraticCurveTo(-L * 1.05, H * 0.2 + wag * 0.5, -L * 0.72, 0);
    ink(col('fin'));
    // Dorsal fin.
    ctx.beginPath();
    ctx.moveTo(-L * 0.4, -H * 0.78);
    ctx.quadraticCurveTo(-L * 0.05, -H * (f.stage === 2 ? 1.75 : 1.45), L * 0.32, -H * 0.86);
    ink(col('fin'));
    // Body.
    const grad = ctx.createLinearGradient(0, -H, 0, H);
    grad.addColorStop(0, col('light'));
    grad.addColorStop(0.45, col('body'));
    grad.addColorStop(1, col('body'));
    ctx.beginPath();
    ctx.moveTo(L, H * 0.05);
    ctx.bezierCurveTo(L * 0.95, -H * 1.15, -L * 0.55, -H * 1.12, -L * 0.82, 0);
    ctx.bezierCurveTo(-L * 0.55, H * 1.12, L * 0.95, H * 1.15, L, H * 0.05);
    ink(grad);
    // Belly.
    ctx.fillStyle = col('belly');
    ctx.beginPath();
    ctx.moveTo(L * 0.8, H * 0.35);
    ctx.bezierCurveTo(L * 0.4, H * 0.95, -L * 0.45, H * 0.85, -L * 0.62, H * 0.35);
    ctx.bezierCurveTo(-L * 0.1, H * 0.55, L * 0.4, H * 0.55, L * 0.8, H * 0.35);
    ctx.fill();
    if (f.stage > 0 && !f.dead) {
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = L * 0.12;
      for (const sx of f.stage === 2 ? [-0.35, -0.05] : [-0.25]) {
        ctx.beginPath();
        ctx.moveTo(L * sx, -H * 0.8);
        ctx.quadraticCurveTo(L * (sx - 0.08), 0, L * sx, H * 0.75);
        ctx.stroke();
      }
    }
    // Side fin.
    const flap = f.dead ? 0 : Math.sin(t / 7 + f.phase) * 0.35;
    ctx.save();
    ctx.translate(L * 0.02, H * 0.3);
    ctx.rotate(0.5 + flap);
    ctx.beginPath();
    ctx.ellipse(-L * 0.12, 0, L * 0.22, H * 0.2, 0, 0, Math.PI * 2);
    ink(col('fin'), 2);
    ctx.restore();
    // Face.
    const r = H * (f.stage === 0 ? 0.48 : 0.42);
    eye(L * 0.42, -H * 0.2, r, 0, { dead: f.dead, closed: f.eatT > 8 });
    mouth(L * 0.9, H * 0.28, H, f, hungry);
    if (f.stage === 3 && !f.dead) {
      // A crown of stars for star guppies.
      for (let i = 0; i < 3; i++) starShape(-L * 0.25 + i * L * 0.25, -H * 1.25 - (i === 1 ? 5 : 0), 5 + (i === 1 ? 2 : 0), '#fff36b', Math.sin(t / 10 + i));
    }
  }

  function starShape(x, y, r, fill, rot = 0, lw = 1.6) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot * 0.3);
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const rr = k % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ink(fill, lw);
    ctx.restore();
  }

  function mouth(x, y, H, f, hungry) {
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#7a2230';
    ctx.lineWidth = 2;
    if (f.dead) {
      ctx.beginPath();
      ctx.moveTo(x - H * 0.25, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (f.eatT > 0) {
      const o = Math.sin((f.eatT / 16) * Math.PI) * H * 0.35;
      ctx.beginPath();
      ctx.ellipse(x - H * 0.1, y, H * 0.2, o + 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (hungry) {
      ctx.beginPath();
      ctx.ellipse(x - H * 0.1, y, H * 0.13, H * 0.17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x - H * 0.22, y - H * 0.12, H * 0.2, Math.PI * 0.15, Math.PI * 0.75);
      ctx.stroke();
    }
  }

  function carnivore(f, t, world) {
    const L = FISH.carnivore.size;
    if (sprite('predator')) return tideyFish('predator', f, t, world, L * 2.4);
    const H = L * 0.5;
    const hungry = !f.dead && world.isHungry(f);
    const body = f.dead ? '#9aa0a8' : hungry ? '#7fb39c' : '#3fa58c';
    const fin = f.dead ? '#7a8088' : '#2b7a68';
    const wag = f.dead ? 0 : Math.sin(t / 6 + f.phase) * H * 0.35;
    ctx.beginPath();
    ctx.moveTo(-L * 0.75, 0);
    ctx.lineTo(-L * 1.3, -H * 0.95 + wag);
    ctx.lineTo(-L * 1.12, wag * 0.3);
    ctx.lineTo(-L * 1.3, H * 0.95 + wag);
    ctx.closePath();
    ink(fin);
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, -H * 0.8);
    ctx.lineTo(-L * 0.2, -H * 1.6);
    ctx.lineTo(L * 0.05, -H * 0.9);
    ctx.lineTo(L * 0.2, -H * 1.35);
    ctx.lineTo(L * 0.35, -H * 0.85);
    ink(fin);
    const grad = ctx.createLinearGradient(0, -H, 0, H);
    grad.addColorStop(0, mix(body, '#ffffff', 0.35));
    grad.addColorStop(0.5, body);
    grad.addColorStop(1, mix(body, '#000000', 0.15));
    ctx.beginPath();
    ctx.moveTo(L, -H * 0.1);
    ctx.bezierCurveTo(L * 0.8, -H * 1.2, -L * 0.6, -H * 1.1, -L * 0.85, 0);
    ctx.bezierCurveTo(-L * 0.6, H * 1.1, L * 0.7, H * 1.15, L * 1.05, H * 0.25);
    ctx.closePath();
    ink(grad);
    // Jaw and teeth.
    const open = f.eatT > 0 ? Math.sin((f.eatT / 16) * Math.PI) * H * 0.5 : hungry ? H * 0.18 : H * 0.06;
    ctx.fillStyle = '#5a1d2a';
    ctx.beginPath();
    ctx.moveTo(L * 1.02, H * 0.1);
    ctx.lineTo(L * 0.45, H * 0.25);
    ctx.lineTo(L * 1.0, H * 0.25 + open);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const x = L * (0.55 + i * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, H * 0.2);
      ctx.lineTo(x + L * 0.05, H * 0.36);
      ctx.lineTo(x + L * 0.1, H * 0.2);
      ctx.fill();
    }
    eye(L * 0.5, -H * 0.3, H * 0.3, 0, { dead: f.dead, angry: true });
  }

  function breeder(f, t, world) {
    const L = FISH.breeder.size;
    if (sprite('fish-purple')) {
      cartoonFish('fish-purple', f, t, world, L * 2.5);
      if (!f.dead) {
        // Her bow, so she reads as the breeder.
        ctx.beginPath();
        ctx.moveTo(L * 0.1, -L * 0.62);
        ctx.lineTo(-L * 0.2, -L * 0.85);
        ctx.lineTo(-L * 0.2, -L * 0.42);
        ctx.closePath();
        ctx.moveTo(L * 0.1, -L * 0.62);
        ctx.lineTo(L * 0.4, -L * 0.85);
        ctx.lineTo(L * 0.4, -L * 0.42);
        ctx.closePath();
        ink('#ffd84d', 2);
      }
      return;
    }
    const H = L * 0.85;
    const hungry = !f.dead && world.isHungry(f);
    const body = f.dead ? '#a8a0a8' : hungry ? '#c9c79a' : '#ff8fc7';
    const wag = f.dead ? 0 : Math.sin(t / 7 + f.phase) * H * 0.2;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.quadraticCurveTo(-L * 1.3, -H * 0.9 + wag, -L * 1.25, wag * 0.3);
    ctx.quadraticCurveTo(-L * 1.3, H * 0.9 + wag, -L * 0.7, 0);
    ink(f.dead ? '#888' : '#ff5fa8');
    const grad = ctx.createRadialGradient(-L * 0.2, -H * 0.4, 2, 0, 0, L * 1.1);
    grad.addColorStop(0, mix(body, '#ffffff', 0.5));
    grad.addColorStop(1, body);
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.95, H * 0.75, 0, 0, Math.PI * 2);
    ink(grad);
    // A bow on top.
    if (!f.dead) {
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.72);
      ctx.lineTo(-L * 0.3, -H * 0.95);
      ctx.lineTo(-L * 0.3, -H * 0.5);
      ctx.closePath();
      ctx.moveTo(0, -H * 0.72);
      ctx.lineTo(L * 0.3, -H * 0.95);
      ctx.lineTo(L * 0.3, -H * 0.5);
      ctx.closePath();
      ink('#ffd84d', 2);
    }
    eye(L * 0.42, -H * 0.12, H * 0.27, 0, { dead: f.dead, lashes: true, closed: f.eatT > 8 });
    mouth(L * 0.88, H * 0.25, H * 0.7, f, hungry);
  }

  function leviathan(f, t, world) {
    const L = FISH.leviathan.size;
    if (sprite('fish-black')) return cartoonFish('fish-black', f, t, world, L * 2.6);
    const H = L * 0.55;
    const hungry = !f.dead && world.isHungry(f);
    const body = f.dead ? '#9aa0a8' : hungry ? '#8a8fb0' : '#4a5bb8';
    const wag = f.dead ? 0 : Math.sin(t / 8 + f.phase) * H * 0.3;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.quadraticCurveTo(-L * 1.1, -H * 0.3, -L * 1.35, -H * 1.0 + wag);
    ctx.lineTo(-L * 1.15, wag * 0.3);
    ctx.lineTo(-L * 1.35, H * 1.0 + wag);
    ctx.quadraticCurveTo(-L * 1.1, H * 0.3, -L * 0.7, 0);
    ink('#2e3a8a');
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.55 + i * L * 0.28, -H * 0.85);
      ctx.lineTo(-L * 0.42 + i * L * 0.28, -H * 1.35);
      ctx.lineTo(-L * 0.3 + i * L * 0.28, -H * 0.85);
      ink('#2e3a8a', 2);
    }
    const grad = ctx.createLinearGradient(0, -H, 0, H);
    grad.addColorStop(0, mix(body, '#ffffff', 0.3));
    grad.addColorStop(0.55, body);
    grad.addColorStop(1, mix(body, '#000000', 0.2));
    ctx.beginPath();
    ctx.moveTo(L * 1.05, -H * 0.05);
    ctx.bezierCurveTo(L * 0.8, -H * 1.2, -L * 0.6, -H * 1.1, -L * 0.85, 0);
    ctx.bezierCurveTo(-L * 0.6, H * 1.15, L * 0.75, H * 1.2, L * 1.05, H * 0.35);
    ctx.closePath();
    ink(grad, 3);
    // Huge jaw.
    const open = f.eatT > 0 ? Math.sin((f.eatT / 16) * Math.PI) * H * 0.6 : H * 0.12;
    ctx.beginPath();
    ctx.moveTo(L * 1.05, H * 0.0);
    ctx.lineTo(L * 0.3, H * 0.25);
    ctx.lineTo(L * 1.0, H * 0.3 + open);
    ctx.closePath();
    ink('#3a0f2a', 2);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const x = L * (0.42 + i * 0.12);
      ctx.beginPath();
      ctx.moveTo(x, H * 0.12);
      ctx.lineTo(x + L * 0.05, H * 0.32);
      ctx.lineTo(x + L * 0.1, H * 0.14);
      ctx.fill();
    }
    eye(L * 0.55, -H * 0.38, H * 0.24, 0, { dead: f.dead, angry: true });
  }

  function starcatcher(f, t, world) {
    // A round, flat-bottomed sand dweller with a wide mouth turned up for stars.
    const L = FISH.starcatcher.size;
    const hungry = !f.dead && world.isHungry(f);
    const body = f.dead ? '#a0a0a0' : hungry ? '#c9b98a' : '#ff9f6b';
    const bob = f.dead ? 0 : Math.abs(Math.sin(t / 10 + f.phase)) * 2;
    ctx.translate(0, -bob);
    ctx.beginPath();
    ctx.moveTo(-L, 4);
    ctx.bezierCurveTo(-L, -L * 1.1, L, -L * 1.1, L, 4);
    ctx.closePath();
    ink(body);
    ctx.fillStyle = mix(body, '#ffffff', 0.4);
    ctx.beginPath();
    ctx.ellipse(-L * 0.3, -L * 0.5, L * 0.25, L * 0.15, -0.4, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * L * 0.95, 0, L * 0.3, L * 0.14, s * 0.4, 0, Math.PI * 2);
      ink(mix(body, '#000000', 0.15), 2);
    }
    eye(-L * 0.3, -L * 0.45, L * 0.2, 1, { dead: f.dead });
    eye(L * 0.3, -L * 0.45, L * 0.2, 1, { dead: f.dead });
    const open = f.eatT > 0 ? 6 : hungry ? 4 : 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.1, L * 0.35, open, 0, 0, Math.PI * 2);
    ink('#7a2230', 2);
  }

  function grubber(f, t, world) {
    // A segmented sand worm.
    const L = FISH.grubber.size;
    const hungry = !f.dead && world.isHungry(f);
    const body = f.dead ? '#a0a0a0' : hungry ? '#c4b98a' : '#e98ad9';
    for (let i = 4; i >= 0; i--) {
      const x = -i * L * 0.35;
      const y = Math.sin(t / 8 - i * 0.9 + f.phase) * 3 * (f.dead ? 0 : 1);
      ctx.beginPath();
      ctx.ellipse(x, y, L * (0.42 - i * 0.03), L * (0.36 - i * 0.03), 0, 0, Math.PI * 2);
      ink(i % 2 ? mix(body, '#000000', 0.12) : body, 2);
    }
    eye(L * 0.12, -L * 0.15, L * 0.16, 1, { dead: f.dead });
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(L * 0.1 + s * 5, -L * 0.3);
      ctx.lineTo(L * 0.2 + s * 9, -L * 0.62);
      ctx.stroke();
    }
  }

  function muncher(f, t, world) {
    const L = FISH.muncher.size;
    if (sprite('fish-blue')) return cartoonFish('fish-blue', f, t, world, L * 2.4);
    const H = L * 0.7;
    const hungry = !f.dead && world.isHungry(f);
    const body = f.dead ? '#a0a0a0' : hungry ? '#b5a46a' : '#56c2e6';
    const wag = f.dead ? 0 : Math.sin(t / 5 + f.phase) * H * 0.3;
    ctx.beginPath();
    ctx.moveTo(-L * 0.7, 0);
    ctx.lineTo(-L * 1.2, -H * 0.7 + wag);
    ctx.lineTo(-L * 1.2, H * 0.7 + wag);
    ctx.closePath();
    ink('#2f8fb8');
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.9, H * 0.8, 0, 0, Math.PI * 2);
    ink(body);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(L * 0.1, H * 0.35, L * 0.5, H * 0.3, 0, 0, Math.PI);
    ctx.fill();
    // Buck teeth for grubs.
    const open = f.eatT > 0 ? 6 : 2;
    ctx.beginPath();
    ctx.ellipse(L * 0.75, H * 0.2, L * 0.18, open, 0, 0, Math.PI * 2);
    ink('#5a1d2a', 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(L * 0.68, H * 0.2 - open, 5, 6);
    ctx.fillRect(L * 0.76, H * 0.2 - open, 5, 6);
    eye(L * 0.35, -H * 0.3, H * 0.32, 0, { dead: f.dead, closed: f.eatT > 8 });
  }

  function drawFish(f, t, world) {
    if (orig.ready()) {
      ctx.save();
      if (f.dead) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.deadT - 150) / 90);
      const drawn = orig.fish(f, t, world);
      ctx.restore();
      if (drawn) {
        if (!f.dead && world.isHungry(f) && f.starveAt - world.time < 600 && Math.floor(t / 15) % 2) text('!', f.x, f.y - world.sizeOf(f) - 14, 18, '#ff5b5b', { lw: 4 });
        return;
      }
    }
    ctx.save();
    let x = f.x;
    if (!f.dead && world.isHungry(f) && f.starveAt - world.time < 600) x += Math.sin(t * 1.3) * 1.2; // starving: trembles
    ctx.translate(x, f.y);
    const turn = Math.abs(f.turn) < 0.12 ? 0.12 * Math.sign(f.turn || 1) : f.turn;
    ctx.scale(turn, f.dead ? -1 : 1);
    if (!f.dead) ctx.rotate(Math.max(-0.3, Math.min(0.3, f.vy * 0.22)));
    if (f.bornT < 40) {
      const k = f.bornT / 40;
      ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    }
    if (f.dead) ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.deadT - 150) / 90);
    ({ guppy, carnivore, breeder, leviathan, starcatcher, grubber, muncher })[f.kind](f, t, world);
    ctx.restore();
    // A hunger bubble over fish about to starve.
    if (!f.dead && world.isHungry(f) && f.starveAt - world.time < 600 && Math.floor(t / 15) % 2) {
      text('!', f.x, f.y - world.sizeOf(f) - 10, 18, '#ff5b5b', { lw: 4 });
    }
  }

  /* ---------- Coins, food, pets ---------- */

  function coin(type, x, y, spin = 0, scale = 1) {
    if (orig.ready() && orig.coin(type, x, y, spin, scale)) return;
    const r = COINS[type].r * scale;
    const art = { silver: 'coin-silver', gold: 'coin-gold', diamond: 'diamond' }[type];
    if (art && sprite(art)) {
      ctx.save();
      ctx.translate(x, y);
      if (type !== 'diamond') ctx.scale(0.35 + 0.65 * Math.abs(Math.cos(spin)), 1);
      drawSprite(art, 0, 0, r * 2.3);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    if (type === 'silver' || type === 'gold') {
      const sx = 0.35 + 0.65 * Math.abs(Math.cos(spin));
      ctx.scale(sx, 1);
      const gold = type === 'gold';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ink(gold ? '#f0a818' : '#a9b3c2', 2.5);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = gold ? '#ffd84a' : '#e3e9f0';
      ctx.fill();
      ctx.fillStyle = gold ? '#e89a10' : '#97a3b4';
      ctx.font = `${r * 1.1}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(gold ? '★' : '$', 0, r * 0.08);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.12, -0.7, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'star') {
      ctx.restore();
      starShape(x, y, r * 1.1, '#ffe14d', spin, 2.5);
      ctx.save();
      ctx.translate(x, y);
    } else if (type === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.35);
      ctx.lineTo(-r * 0.5, -r);
      ctx.lineTo(r * 0.5, -r);
      ctx.lineTo(r, -r * 0.35);
      ctx.lineTo(0, r);
      ctx.closePath();
      ink('#52d8ff', 2.5);
      ctx.fillStyle = '#c7f4ff';
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r);
      ctx.lineTo(r * 0.5, -r);
      ctx.lineTo(r * 0.2, -r * 0.35);
      ctx.lineTo(-r * 0.2, -r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(26,36,51,0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.35);
      ctx.lineTo(r, -r * 0.35);
      ctx.moveTo(-r * 0.2, -r * 0.35);
      ctx.lineTo(0, r);
      ctx.lineTo(r * 0.2, -r * 0.35);
      ctx.stroke();
    } else if (type === 'pearl') {
      const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, 1, 0, 0, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#e6d5f2');
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ink(g, 2.5);
    } else if (type === 'chest') {
      ctx.beginPath();
      ctx.rect(-r, -r * 0.3, r * 2, r * 1.1);
      ink('#9a6230', 2.5);
      ctx.beginPath();
      ctx.moveTo(-r, -r * 0.3);
      ctx.quadraticCurveTo(0, -r * 1.3, r, -r * 0.3);
      ctx.closePath();
      ink('#b97a3d', 2.5);
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(-r, r * 0.15, r * 2, r * 0.2);
      ctx.beginPath();
      ctx.rect(-r * 0.18, -r * 0.45, r * 0.36, r * 0.55);
      ink('#ffd84a', 1.5);
    }
    ctx.restore();
  }

  function foodPiece(p, t) {
    if (orig.ready() && orig.food(p, t)) return;
    ctx.save();
    ctx.translate(p.x + Math.sin(t / 9 + p.id) * 1.5, p.y);
    if (p.kind === 'grub') {
      ctx.rotate(Math.sin(t / 6 + p.id) * 0.4);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
      ink('#ffb3c7', 1.6);
      ctx.strokeStyle = 'rgba(26,36,51,0.5)';
      ctx.lineWidth = 1;
      for (const dx of [-3, 0, 3]) {
        ctx.beginPath();
        ctx.moveTo(dx, -4);
        ctx.lineTo(dx, 4);
        ctx.stroke();
      }
    } else if (p.kind === 'potion') {
      ctx.rotate(Math.sin(t / 12) * 0.2);
      ctx.beginPath();
      ctx.moveTo(-3, -12);
      ctx.lineTo(3, -12);
      ctx.lineTo(3, -6);
      ctx.quadraticCurveTo(10, -2, 9, 5);
      ctx.quadraticCurveTo(8, 11, 0, 11);
      ctx.quadraticCurveTo(-8, 11, -9, 5);
      ctx.quadraticCurveTo(-10, -2, -3, -6);
      ctx.closePath();
      ink('#e7f6ff', 2);
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath();
      ctx.ellipse(0, 5, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      starShape(p.x, p.y + 4, 4, '#fff7a8', t / 10, 1);
      ctx.save();
    } else if (p.level === 0) {
      ctx.rotate(p.id);
      ctx.beginPath();
      ctx.moveTo(-5, -2);
      ctx.lineTo(1, -5);
      ctx.lineTo(6, 0);
      ctx.lineTo(2, 4);
      ctx.lineTo(-4, 3);
      ctx.closePath();
      ink('#b9783a', 1.6);
    } else if (p.level === 1) {
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ink('#6cc04a', 1.6);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(-1.6, -1.8, 1.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(0.6 + Math.sin(t / 20 + p.id) * 0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 4.5, 0, 0, Math.PI * 2);
      ink('#ffffff', 1.6);
      ctx.beginPath();
      ctx.ellipse(-3, 0, 4.8, 4.2, 0, Math.PI / 2, Math.PI * 1.5);
      ctx.closePath();
      ctx.fillStyle = '#ff4f5e';
      ctx.fill();
    }
    ctx.restore();
  }

  function pet(p, t) {
    if (orig.ready() && orig.pet(p, t)) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.kind === 'snail') {
      ctx.scale(p.face, 1);
      const stretch = p.walking ? Math.sin(t / 6) * 2 : 0;
      ctx.beginPath();
      ctx.moveTo(-22, 0);
      ctx.quadraticCurveTo(-20, -10, 0, -8);
      ctx.lineTo(18 + stretch, -10);
      ctx.quadraticCurveTo(26 + stretch, -10, 24 + stretch, 0);
      ctx.closePath();
      ink('#c9e06a');
      for (const dx of [14, 20]) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(dx + stretch, -9);
        ctx.lineTo(dx + 2 + stretch, -22);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dx + 2 + stretch, -23, 3.5, 0, Math.PI * 2);
        ink('#ffffff', 1.5);
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.arc(dx + 3 + stretch, -23, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(-6, -18, 15, 0, Math.PI * 2);
      ink('#e0884a');
      ctx.strokeStyle = '#9a4f22';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.2) {
        const r = 12 - a * 0.9;
        const x = -6 + Math.cos(a) * r;
        const y = -18 + Math.sin(a) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (p.kind === 'clam') {
      const open = p.open ? 0.55 : 0.08;
      ctx.beginPath();
      ctx.ellipse(0, -4, 24, 10, 0, 0, Math.PI);
      ink('#8a7ad0');
      if (p.open) {
        ctx.beginPath();
        ctx.arc(0, -8, 7, 0, Math.PI * 2);
        ink('#ffffff', 1.5);
      }
      ctx.save();
      ctx.translate(-22, -4);
      ctx.rotate(-open);
      ctx.beginPath();
      ctx.ellipse(22, 0, 24, 12, 0, Math.PI, Math.PI * 2);
      ink('#a597e6');
      ctx.strokeStyle = 'rgba(26,36,51,0.35)';
      ctx.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(22 + i * 9, -11);
        ctx.stroke();
      }
      ctx.restore();
    } else if (p.kind === 'puffer') {
      ctx.scale(p.face, 1);
      const puff = 1 + Math.sin(t / 25) * 0.05;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 16 * puff, Math.sin(a) * 15 * puff);
        ctx.lineTo(Math.cos(a) * 22 * puff, Math.sin(a) * 20 * puff);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * puff, 16 * puff, 0, 0, Math.PI * 2);
      ink('#ffd76a');
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.ellipse(2, 6, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      eye(7, -4, 5.5);
      ctx.beginPath();
      ctx.arc(16, 4, 3, 0, Math.PI * 2);
      ink('#e86a6a', 1.5);
    } else if (p.kind === 'seahorse') {
      ctx.scale(p.face, 1);
      const bob = Math.sin(t / 12) * 2;
      ctx.translate(0, bob);
      ctx.beginPath();
      ctx.moveTo(4, -22);
      ctx.quadraticCurveTo(16, -18, 12, -8);
      ctx.quadraticCurveTo(10, 4, 4, 10);
      ctx.quadraticCurveTo(-2, 18, 6, 22);
      ctx.quadraticCurveTo(-8, 24, -6, 12);
      ctx.quadraticCurveTo(-8, 0, -4, -10);
      ctx.quadraticCurveTo(-4, -20, 4, -22);
      ink('#ff9f43');
      ctx.beginPath();
      ctx.moveTo(10, -18);
      ctx.lineTo(22, -16);
      ctx.lineTo(20, -12);
      ctx.lineTo(10, -13);
      ink('#ff9f43', 2);
      ctx.beginPath();
      ctx.ellipse(-7, -2, 4, 8, 0.3, 0, Math.PI * 2);
      ink('#ffd23f', 1.5);
      eye(6, -16, 4, 0);
    } else if (p.kind === 'turtle') {
      ctx.scale(p.face, 1);
      const step = Math.sin(t / 10) * 2;
      for (const [x, d] of [[-14, step], [12, -step]]) {
        ctx.beginPath();
        ctx.ellipse(x, -2 + d * 0.3, 6, 4, 0, 0, Math.PI * 2);
        ink('#8fd18a', 2);
      }
      ctx.beginPath();
      ctx.ellipse(26, -10, 8, 7, 0, 0, Math.PI * 2);
      ink('#8fd18a', 2);
      eye(28, -12, 3.5, 1);
      ctx.beginPath();
      ctx.ellipse(0, -10, 24, 15, 0, Math.PI, 0);
      ctx.closePath();
      ink('#3f8f5a');
      ctx.strokeStyle = 'rgba(26,36,51,0.45)';
      ctx.lineWidth = 1.5;
      for (const x of [-10, 0, 10]) {
        ctx.beginPath();
        ctx.moveTo(x - 5, -18);
        ctx.lineTo(x + 5, -18);
        ctx.lineTo(x + 7, -11);
        ctx.lineTo(x - 7, -11);
        ctx.closePath();
        ctx.stroke();
      }
    } else if (p.kind === 'octopus') {
      ctx.strokeStyle = INK;
      for (let i = 0; i < 6; i++) {
        const x = -12 + i * 5;
        ctx.beginPath();
        ctx.moveTo(x, 4);
        ctx.quadraticCurveTo(x + Math.sin(t / 8 + i) * 8, 16, x + Math.sin(t / 8 + i + 1) * 6, 26);
        ctx.lineWidth = 6;
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ff6fa8';
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.ellipse(0, -6, 17, 16, 0, 0, Math.PI * 2);
      ink('#ff6fa8');
      eye(-6, -6, 5);
      eye(6, -6, 5);
    } else if (p.kind === 'angel') {
      ctx.scale(p.face, 1);
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(-6, -28);
      ctx.lineTo(8, -6);
      ctx.closePath();
      ink('#cfe8ff', 2);
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(-6, 28);
      ctx.lineTo(8, 6);
      ctx.closePath();
      ink('#cfe8ff', 2);
      ctx.beginPath();
      ctx.ellipse(2, 0, 16, 12, 0, 0, Math.PI * 2);
      ink('#ffffff');
      ctx.strokeStyle = '#7aa7ff';
      ctx.lineWidth = 2.5;
      for (const x of [-4, 4]) {
        ctx.beginPath();
        ctx.moveTo(x, -11);
        ctx.lineTo(x, 11);
        ctx.stroke();
      }
      eye(10, -3, 4);
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(2, -20, 9, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === 'eel') {
      ctx.scale(p.face, 1);
      for (let i = 6; i >= 0; i--) {
        ctx.beginPath();
        ctx.arc(-i * 6, Math.sin(t / 6 - i * 0.8) * 4, 8 - i * 0.6, 0, Math.PI * 2);
        ink(i % 2 ? '#3fb6c9' : '#5fd3e0', 1.8);
      }
      eye(3, -3, 3.5);
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 2;
      if (Math.floor(t / 6) % 3 === 0) {
        ctx.beginPath();
        ctx.moveTo(-10, -12);
        ctx.lineTo(-6, -18);
        ctx.lineTo(-2, -12);
        ctx.lineTo(2, -18);
        ctx.stroke();
      }
    } else if (p.kind === 'jelly') {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = 'rgba(214,170,255,0.9)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-10 + i * 5, 2);
        ctx.quadraticCurveTo(-10 + i * 5 + Math.sin(t / 10 + i) * 5, 14, -10 + i * 5, 26);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(-17, 2);
      ctx.bezierCurveTo(-17, -22, 17, -22, 17, 2);
      ctx.quadraticCurveTo(0, 6, -17, 2);
      ink('rgba(222,190,255,0.92)', 2);
      ctx.globalAlpha = 1;
      eye(-5, -7, 3.5);
      eye(5, -7, 3.5);
    } else if (p.kind === 'crab') {
      ctx.scale(p.face, 1);
      const step = p.walking ? Math.sin(t / 3) * 2 : 0;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      for (const sd of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(sd * 8, -4 + i * 3);
          ctx.lineTo(sd * (18 + i * 2), -2 + i * 3 + (i % 2 ? step : -step));
          ctx.lineTo(sd * (21 + i * 2), 3 + i);
          ctx.stroke();
        }
      }
      ctx.beginPath();
      ctx.ellipse(0, -8, 15, 10, 0, 0, Math.PI * 2);
      ink('#ff6a4a');
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sd * 19, -18, 6, 5, sd * 0.4, 0, Math.PI * 2);
        ink('#ff6a4a', 2);
      }
      eye(-5, -18, 3.5);
      eye(5, -18, 3.5);
    }
    ctx.restore();
  }

  /* ---------- Aliens ---------- */

  function alien(a, t, iconOnly = false) {
    const spec = ALIENS[a.kind];
    const flash = a.hitT > 0 && a.hitT % 4 < 2;
    if (!iconOnly && orig.ready() && orig.alien(a, t)) return alienBar(a, t, spec.r);
    ctx.save();
    ctx.translate(a.x, a.y);
    const r = spec.r;
    if ((a.kind === 'gobbler' || a.kind === 'twins') && sprite('jelly')) {
      // Andrew Tidey's jellyfish, pulsing through its six frames.
      const name = flash ? 'jelly-flash' : a.kind === 'twins' ? 'jelly-teal' : 'jelly';
      const k = a.chomp > 0 ? 1 + 0.15 * Math.sin((a.chomp / 20) * Math.PI) : 1;
      ctx.scale(k, k);
      drawSprite(name, 0, 0, r * 1.5, Math.floor(t / 7));
    } else if (a.kind === 'gobbler' || a.kind === 'twins') {
      // A wobbly blob, mostly mouth. Twins are smaller and teal.
      const twin = a.kind === 'twins';
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const ang = (i / 24) * Math.PI * 2;
        const rr = r * (1 + Math.sin(ang * 3 + t / 6) * 0.06 + Math.sin(ang * 5 - t / 9) * 0.04);
        const x = Math.cos(ang) * rr;
        const y = Math.sin(ang) * rr * 0.92;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 4, 0, 0, r * 1.1);
      g.addColorStop(0, flash ? '#ffffff' : twin ? '#8ef0d8' : '#c78cf0');
      g.addColorStop(1, flash ? '#ffd0d0' : twin ? '#1f9c86' : '#7a3fb0');
      ink(g, 3);
      // Mouth.
      const open = 0.25 + (a.chomp > 0 ? Math.sin((a.chomp / 20) * Math.PI) * 0.35 : 0.08 * Math.sin(t / 10));
      ctx.beginPath();
      ctx.ellipse(a.face * r * 0.15, r * 0.3, r * 0.6, r * open, 0, 0, Math.PI * 2);
      ink('#3a0f2a', 2.5);
      ctx.fillStyle = '#ffffff';
      for (let i = -2; i <= 2; i++) {
        const x = a.face * r * 0.15 + i * r * 0.2;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.07, r * 0.3 - r * open + 2);
        ctx.lineTo(x, r * 0.3 - r * open + r * 0.17);
        ctx.lineTo(x + r * 0.07, r * 0.3 - r * open + 2);
        ctx.fill();
      }
      // One big eye.
      eye(a.face * r * 0.1, -r * 0.42, r * 0.3, a.face * 2, { angry: true });
      // Horns.
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.45, -r * 0.75);
        ctx.quadraticCurveTo(s * r * 0.7, -r * 1.25, s * r * 0.9, -r * 1.05);
        ctx.quadraticCurveTo(s * r * 0.7, -r * 0.9, s * r * 0.65, -r * 0.65);
        ink('#ffd84a', 2);
      }
    } else if (a.kind === 'glutton') {
      // A big round belly that wants food, not zaps.
      const full = 1 - a.hp / a.maxHp;
      const R = r * (0.9 + full * 0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, R, R * 0.95, 0, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, 4, 0, 0, R * 1.1);
      g.addColorStop(0, flash ? '#ffffff' : '#b8f08a');
      g.addColorStop(1, flash ? '#ffd0d0' : '#4f9e2f');
      ink(g, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, R * 0.25, R * 0.55, R * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      eye(-R * 0.3, -R * 0.35, R * 0.2, a.face * 2);
      eye(R * 0.3, -R * 0.35, R * 0.2, a.face * 2);
      const open = 0.18 + (a.chomp > 0 ? Math.sin((a.chomp / 16) * Math.PI) * 0.25 : 0.05 * Math.sin(t / 8));
      ctx.beginPath();
      ctx.ellipse(0, R * 0.1, R * 0.35, R * open, 0, 0, Math.PI * 2);
      ink('#3a0f2a', 2.5);
      // A bib.
      ctx.beginPath();
      ctx.moveTo(-R * 0.35, R * 0.5);
      ctx.quadraticCurveTo(0, R * 0.95, R * 0.35, R * 0.5);
      ctx.closePath();
      ink('#ffffff', 2);
    } else if (a.kind === 'bomber') {
      // A crab-like cannon on the sand.
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.6, 0, Math.PI, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, -r * 0.6, 0, 0);
      g.addColorStop(0, flash ? '#ffffff' : '#9aa6b8');
      g.addColorStop(1, flash ? '#ffd0d0' : '#55607a');
      ink(g, 3);
      ctx.save();
      ctx.translate(0, -r * 0.5);
      ctx.rotate(a.face * 0.35);
      ctx.beginPath();
      ctx.rect(-8, -26 - (a.chomp > 0 ? 4 : 0), 16, 28);
      ink('#3b4458', 2.5);
      ctx.restore();
      eye(-r * 0.35, -r * 0.25, r * 0.16, a.face * 2, { angry: true });
      eye(r * 0.35, -r * 0.25, r * 0.16, a.face * 2, { angry: true });
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sd * r * 1.05, -r * 0.1, r * 0.25, r * 0.18, 0, 0, Math.PI * 2);
        ink('#7a869c', 2);
      }
    } else if (a.kind === 'mirror') {
      // A silver diamond creature; its shield glows when zaps would heal it.
      ctx.save();
      ctx.rotate(Math.sin(t / 30) * 0.15);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.85, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.85, 0);
      ctx.closePath();
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, flash ? '#ffffff' : '#f2f6ff');
      g.addColorStop(0.5, flash ? '#ffd0d0' : '#a9b6d6');
      g.addColorStop(1, flash ? '#ffffff' : '#6c7aa3');
      ink(g, 3);
      ctx.restore();
      eye(0, -r * 0.15, r * 0.28, a.face * 2, { angry: true });
      const open = a.chomp > 0 ? Math.sin((a.chomp / 20) * Math.PI) * r * 0.2 : r * 0.04;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.35, r * 0.25, open + 2, 0, 0, Math.PI * 2);
      ink('#3a0f2a', 2);
      if (a.shield) {
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.15 + Math.sin(t / 4) * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(120,220,255,0.25)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(120,220,255,0.95)';
        ctx.stroke();
      }
    } else {
      // Grinder: a red, spiky, spinning beast.
      ctx.save();
      ctx.rotate(t / 25);
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? r * 0.8 : r * 1.12;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath();
      ink(flash ? '#ffffff' : '#c0392b', 3);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 3, 0, 0, r * 0.8);
      g.addColorStop(0, flash ? '#ffffff' : '#ff8a6b');
      g.addColorStop(1, flash ? '#ffd0d0' : '#d9442f');
      ink(g, 3);
      eye(-r * 0.25, -r * 0.2, r * 0.18, a.face * 2, { angry: true });
      eye(r * 0.25, -r * 0.2, r * 0.18, a.face * 2, { angry: true });
      const open = a.chomp > 0 ? Math.sin((a.chomp / 20) * Math.PI) * r * 0.25 : r * 0.06;
      ctx.beginPath();
      ctx.rect(-r * 0.35, r * 0.15, r * 0.7, r * 0.12 + open);
      ink('#3a0f0f', 2);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 5; i++) ctx.fillRect(-r * 0.33 + i * r * 0.14, r * 0.15, r * 0.08, r * 0.08);
    }
    ctx.restore();
    if (iconOnly) return;
    alienBar(a, t, r);
  }

  /** Health bar (for a glutton: how full it is), and ink clouds. */
  function alienBar(a, t, r) {
    const w = 74;
    const frac = Math.max(0, a.hp / a.maxHp);
    const artTop = orig.ready() ? orig.alienTop(a) : null;
    const top = artTop ?? (a.kind === 'bomber' ? a.y - r - 34 : a.y - r - 22);
    if (artTop !== null && a.kind !== 'glutton' && orig.healthBar(a.x, top, frac, a.shield ? '#78dcff' : null)) return stunClouds(a, t, r);
    roundRect(a.x - w / 2, top, w, 9, 4);
    ink('#2a1a1a', 2);
    if (a.kind === 'glutton') {
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(a.x - w / 2 + 2, top + 2, (w - 4) * (1 - frac), 5);
      text('FEED ME!', a.x, top - 12, 14, '#ffe14d', { lw: 3.5 });
    } else {
      ctx.fillStyle = a.shield ? '#78dcff' : frac > 0.5 ? '#5ee06b' : frac > 0.25 ? '#ffd84a' : '#ff5b5b';
      ctx.fillRect(a.x - w / 2 + 2, top + 2, (w - 4) * frac, 5);
    }
    stunClouds(a, t, r);
  }

  function stunClouds(a, t, r) {
    if (a.stun > 0) {
      ctx.fillStyle = 'rgba(30,20,50,0.55)';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(a.x + Math.cos(i * 1.3 + t / 20) * r * 0.6, a.y + Math.sin(i * 1.7) * r * 0.5, 10 + (i % 3) * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function bomb(b, t) {
    if (orig.ready() && orig.bomb(b)) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ink('#2b2f3a', 2);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(-3, -3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = Math.floor(t / 4) % 2 ? '#ff5b5b' : '#ffe14d';
    ctx.beginPath();
    ctx.arc(0, -11, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- Shop bar ---------- */

  function icon(id, cx, cy, s = 1, level = 0) {
    if (orig.ready() && orig.icon(id, cx, cy, s, level)) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    const fake = { sizeOf: (f) => (f.kind === 'guppy' ? FISH.guppy.size[f.stage] : FISH[f.kind].size), isHungry: () => false, time: 0 };
    const fish = (kind, stage = 1, scale = 1) => {
      ctx.save();
      ctx.scale(scale, scale);
      const f = { kind, stage, x: 0, y: 0, face: 1, turn: 1, vy: 0, eatT: 0, phase: 1, dead: false, bornT: 99, fedUntil: 1, starveAt: 1e9 };
      ({ guppy, carnivore, breeder, leviathan, starcatcher, grubber, muncher })[kind](f, 0, fake);
      ctx.restore();
    };
    if (id === 'guppy') fish('guppy', 0, 1.1);
    else if (id === 'carnivore') fish('carnivore', 0, 0.62);
    else if (id === 'breeder') fish('breeder', 0, 0.65);
    else if (id === 'leviathan') fish('leviathan', 0, 0.42);
    else if (id === 'starcatcher') {
      ctx.translate(0, 8);
      fish('starcatcher', 0, 0.85);
    } else if (id === 'grubber') fish('grubber', 0, 0.8);
    else if (id === 'muncher') fish('muncher', 0, 0.8);
    else if (id === 'more') {
      text('MORE', 0, -2, 16, '#ffe14d', { lw: 3.5 });
      text('▸', 0, 14, 18, '#ffffff', { lw: 3 });
    } else if (id === 'potion') {
      ctx.scale(1.4, 1.4);
      foodPiece({ x: 0, y: 0, kind: 'potion', id: 0 }, 0);
    } else if (ALIENS[id]) {
      ctx.scale(0.55, 0.55);
      alien({ kind: id, x: 0, y: 0, hp: 1, maxHp: 1, face: 1, hitT: 0, chomp: 0, stun: 0, shield: false }, 0, true);
    }
    else if (id === 'quality') {
      ctx.scale(2, 2);
      foodPiece({ x: 0, y: 0, level: Math.min(level + 1, FOOD.levels.length - 1), id: 1 }, 0);
    } else if (id === 'count') {
      ctx.scale(1.6, 1.6);
      for (let i = 0; i < 3; i++) foodPiece({ x: -9 + i * 9, y: (i % 2) * 6 - 3, level: 0, id: i + 2 }, 0);
    } else if (id === 'weapon') {
      ctx.beginPath();
      ctx.moveTo(4, -16);
      ctx.lineTo(-8, 2);
      ctx.lineTo(1, 2);
      ctx.lineTo(-5, 17);
      ctx.lineTo(10, -3);
      ctx.lineTo(1, -3);
      ctx.lineTo(8, -16);
      ctx.closePath();
      ink('#ffe14d', 2);
    } else if (id === 'egg') {
      egg(0, 0, 15, level);
    } else if (id in PETS) {
      const ground = id === 'snail' || id === 'clam' || id === 'turtle' || id === 'crab';
      pet({ kind: id, x: 0, y: ground ? 14 : 0, face: 1, open: true, walking: false }, 0);
    }
    ctx.restore();
  }

  function egg(x, y, r, pieces) {
    // An egg drawn in three pieces; missing ones are dashed outlines.
    ctx.save();
    ctx.translate(x, y);
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.25);
      ctx.bezierCurveTo(r * 0.95, -r * 1.2, r, r * 0.9, 0, r);
      ctx.bezierCurveTo(-r, r * 0.9, -r * 0.95, -r * 1.2, 0, -r * 1.25);
    };
    shape();
    ctx.fillStyle = 'rgba(255,240,200,0.18)';
    ctx.fill();
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    shape();
    ctx.clip();
    const bands = [[-r * 1.3, -r * 0.35], [-r * 0.35, r * 0.35], [r * 0.35, r * 1.1]];
    for (let i = 0; i < pieces && i < 3; i++) {
      const [y0, y1] = bands[i];
      ctx.fillStyle = ['#ffe8a8', '#ffd36a', '#ffbf3d'][i];
      ctx.fillRect(-r * 1.2, y0, r * 2.4, y1 - y0);
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.arc(-r * 0.3 + i * r * 0.3, (y0 + y1) / 2, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (pieces > 0) {
      shape();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBar(world, ui, t) {
    if (orig.ready() && orig.bar(ui, t, text)) return;
    // Panel.
    const g = ctx.createLinearGradient(0, 0, 0, BAR.h);
    g.addColorStop(0, '#5e8a9c');
    g.addColorStop(0.5, '#3d6475');
    g.addColorStop(1, '#2a4655');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FRAME.w, BAR.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(0, 0, FRAME.w, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(0, BAR.h - 3, FRAME.w, 3);
    // Rivets.
    ctx.fillStyle = '#86aebd';
    for (const x of [4, 540, 636]) {
      ctx.beginPath();
      ctx.arc(x, 6, 1.8, 0, Math.PI * 2);
      ctx.arc(x, BAR.h - 9, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    const items = ui.shop;
    items.forEach((item, i) => {
      const r = slotRect(i);
      const hover = ui.hover === i && !item.maxed;
      const pressed = ui.pressed === i;
      const dy = pressed ? 2 : 0;
      roundRect(r.x, r.y + dy, r.w, r.h, 9);
      const sg = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      sg.addColorStop(0, hover ? '#2f6f86' : '#24566a');
      sg.addColorStop(1, hover ? '#1c4a5c' : '#163c4c');
      ink(sg, 2.5);
      if (item.affordable) {
        ctx.strokeStyle = hover ? '#ffe14d' : 'rgba(255,225,77,0.65)';
        ctx.lineWidth = 2;
        roundRect(r.x + 3, r.y + 3 + dy, r.w - 6, r.h - 6, 7);
        ctx.stroke();
      }
      ctx.globalAlpha = item.maxed ? 0.45 : item.affordable ? 1 : 0.7;
      const bob = hover ? Math.sin(t / 8) * 1.5 : 0;
      icon(item.id, r.x + r.w / 2, r.y + 23 + dy + bob, 1, item.level ?? 0);
      ctx.globalAlpha = 1;
      if (item.id === 'more') return;
      const price = item.maxed ? 'MAX' : `$${item.cost.toLocaleString('en-US')}`;
      text(price, r.x + r.w / 2, r.y + r.h - 10 + dy, item.cost >= 1000 ? 13 : 15, item.maxed ? '#9fb3bd' : item.affordable ? '#ffe14d' : '#ff8a7a', { lw: 3.5 });
      // Level pips for upgrades.
      if (item.id === 'quality' || item.id === 'weapon') {
        const n = item.id === 'quality' ? FOOD.levels.length : 4;
        for (let k = 0; k < n; k++) {
          ctx.fillStyle = k <= item.level ? '#ffe14d' : 'rgba(255,255,255,0.25)';
          ctx.fillRect(r.x + 6 + k * 6, r.y + 6 + dy, 4, 4);
        }
      }
      if (item.id === 'count') text(`${item.level}`, r.x + r.w - 10, r.y + 11 + dy, 13, '#ffffff', { lw: 3 });
      if (item.id === 'egg') text(`${item.level}/3`, r.x + r.w - 14, r.y + 11 + dy, 12, '#ffffff', { lw: 3 });
      if (ui.flashSlot === i) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        roundRect(r.x, r.y + dy, r.w, r.h, 9);
        ctx.fill();
      }
    });
    // Money box.
    roundRect(MONEY.x, MONEY.y, MONEY.w, MONEY.h, 8);
    ink(ui.moneyFlash > 0 && Math.floor(ui.moneyFlash / 4) % 2 ? '#5a1414' : '#0d2230', 2.5);
    text(`$${Math.round(ui.money).toLocaleString('en-US')}`, MONEY.x + MONEY.w - 8, MONEY.y + MONEY.h / 2 + 1, Math.round(ui.money) >= 10000 ? 17 : 21, '#7dff6a', { align: 'right', lw: 4 });
    // Menu button.
    roundRect(MENU.x, MENU.y, MENU.w, MENU.h, 7);
    ink(ui.hover === 'menu' ? '#3d7f97' : '#24566a', 2);
    text('MENU', MENU.x + MENU.w / 2, MENU.y + MENU.h / 2 + 1, 13, '#ffffff', { lw: 3 });
  }

  /* ---------- Frame ---------- */

  function draw(world, ui, fx, t) {
    if (bgKey !== `${world.world}:${canvas.width}x${canvas.height}:${spritesReady}:${original.ready}`) buildBackground(world.world);
    ctx = main;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(bg, 0, 0);
    const s = view.scale * view.dpr;
    const shake = fx.shakeOffset();
    ctx.setTransform(s, 0, 0, s, (view.ox + shake.x * view.scale) * view.dpr, (view.oy + shake.y * view.scale) * view.dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, TANK.y, TANK.w, TANK.h);
    ctx.clip();
    const own = !orig.ready();
    if (own) drawLight(t);
    if (own) drawPlants(t);
    // Bubbles rising from the bubbler.
    for (let i = 0; i < (own ? 14 : 0); i++) {
      const k = ((t * 0.8 + i * 61) % 470) / 470;
      const x = 590 + Math.sin(t / 18 + i) * 6 + (i % 3) * 4;
      const y = TANK.floor - 6 - k * (TANK.floor - TANK.surface);
      ctx.beginPath();
      ctx.arc(x, y, 2.2 + (i % 3), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    const swims = (p) => !['snail', 'clam', 'turtle', 'crab'].includes(p.kind);
    for (const p of world.pets) if (!swims(p)) pet(p, t);
    for (const p of world.food) foodPiece(p, t);
    for (const f of world.fish) drawFish(f, t, world);
    for (const p of world.pets) if (swims(p)) pet(p, t);
    for (const c of world.coins) {
      const fading = c.type !== 'chest' && c.floorT > COINS.floorLife - 90 && Math.floor(t / 5) % 2;
      ctx.globalAlpha = fading ? 0.35 : 1;
      coin(c.type, c.x, c.y, c.floorT > 0 ? 0 : t / 8 + c.spin);
      ctx.globalAlpha = 1;
    }
    for (const a of world.aliens) alien(a, t);
    for (const b of world.bombs) bomb(b, t);
    // Effects.
    for (const r of fx.rings) {
      ctx.globalAlpha = r.life / r.max;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.r, r.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.min(1, p.life / 15);
      if (p.bubble) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.star) {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life / 6);
        ctx.beginPath();
        for (let k = 0; k < 8; k++) {
          const rr = k % 2 ? p.r * 0.4 : p.r;
          ctx.lineTo(Math.cos((k / 8) * Math.PI * 2) * rr, Math.sin((k / 8) * Math.PI * 2) * rr);
        }
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const p of fx.popups) {
      const k = 1 + Math.max(0, (p.life - 40) / 10) * 0.4;
      ctx.globalAlpha = Math.min(1, p.life / 15);
      text(p.text, p.x, p.y, p.size * k, p.color, { lw: 4 });
    }
    ctx.globalAlpha = 1;
    // Warning: flashing banner and red edges.
    if (world.warning > 0 || world.alien) {
      const a = world.warning > 0 ? 0.3 + 0.25 * Math.sin(t / 5) : 0.14;
      const grad = ctx.createRadialGradient(TANK.w / 2, TANK.y + TANK.h / 2, TANK.h * 0.4, TANK.w / 2, TANK.y + TANK.h / 2, TANK.w * 0.62);
      grad.addColorStop(0, 'rgba(255,60,60,0)');
      grad.addColorStop(1, `rgba(255,60,60,${a})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, TANK.y, TANK.w, TANK.h);
    }
    if (world.warning > 0 && Math.floor(t / 12) % 2) {
      text('WARNING!', TANK.w / 2, TANK.y + 120, 46, '#ff5b5b', { lw: 6 });
      text('ALIEN APPROACHING', TANK.w / 2, TANK.y + 160, 22, '#ffffff', { lw: 5 });
    }
    if (ui.tip) {
      const { x, y, title, body } = ui.tip;
      ctx.font = `13px "Balsamiq Sans", system-ui, sans-serif`;
      const w = Math.max(ctx.measureText(body).width, 90) + 22;
      const bx = Math.max(6, Math.min(FRAME.w - w - 6, x - w / 2));
      roundRect(bx, y, w, 46, 8);
      ink('rgba(255,252,235,0.97)', 2);
      text(title, bx + 11, y + 14, 15, '#1a2433', { align: 'left', stroke: null });
      text(body, bx + 11, y + 32, 13, '#40506a', { align: 'left', stroke: null, font: '"Balsamiq Sans", system-ui, sans-serif' });
    }
    ctx.restore();
    // Coins flying to the money box.
    for (const c of fx.flying) {
      const k = c.t / c.dur;
      const e = k * k * (3 - 2 * k);
      const x = lerp(c.x, MONEY.x + MONEY.w / 2, e);
      const y = lerp(c.y, MONEY.y + MONEY.h / 2, e) - Math.sin(k * Math.PI) * 40;
      coin(c.type, x, y, c.t / 3, 1 - 0.4 * k);
    }
    drawBar(world, ui, t);
    if (ui.hint) drawHint(ui.hint, t);
    // Frame edge.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, FRAME.w, FRAME.h);
  }

  /** Tutorial bubble: wrapped text in a box, with a bouncing arrow at the target. */
  function drawHint(h, t) {
    ctx.font = '15px "Balsamiq Sans", system-ui, sans-serif';
    const words = h.text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > 300 && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    lines.push(line);
    const bw = 330;
    const bh = 22 + lines.length * 20 + (h.tap ? 20 : 0);
    const bx = Math.max(8, Math.min(FRAME.w - bw - 8, (h.boxX ?? FRAME.w / 2) - bw / 2));
    const by = h.boxY ?? 250;
    if (h.x !== undefined) {
      // Arrow from the box towards the target.
      const bounce = Math.sin(t / 6) * 5;
      const ax = h.x;
      const ay = h.y + (h.y < by ? 30 : -30) + (h.y < by ? bounce : -bounce);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(h.y < by ? Math.PI : 0);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-12, -16);
      ctx.lineTo(-5, -16);
      ctx.lineTo(-5, -34);
      ctx.lineTo(5, -34);
      ctx.lineTo(5, -16);
      ctx.lineTo(12, -16);
      ctx.closePath();
      ink('#ffe14d', 2.5);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(h.x, h.y, 22 + Math.sin(t / 5) * 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,225,77,0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    roundRect(bx, by, bw, bh, 12);
    ink('rgba(255,252,235,0.97)', 2.5);
    lines.forEach((l, i) => text(l, bx + 15, by + 20 + i * 20, 15, '#1a2433', { align: 'left', stroke: null, font: '"Balsamiq Sans", system-ui, sans-serif' }));
    if (h.tap) text(Math.floor(t / 30) % 2 ? 'Tap to continue' : 'Tap to continue ›', bx + bw - 15, by + bh - 14, 13, '#2f6f86', { align: 'right', stroke: null });
  }

  /** Draw an icon onto another canvas (for the DOM screens). */
  function iconCanvas(id, size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size * 2;
    ctx = c.getContext('2d');
    ctx.scale((size * 2) / 64, (size * 2) / 64);
    icon(id, 32, 34, 1.4);
    ctx = main;
    return c;
  }

  return { resize, draw, toFrame, iconCanvas };
}
