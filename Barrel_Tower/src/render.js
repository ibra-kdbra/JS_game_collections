/**
 * Draws the world at its own 224 x 256 resolution into an offscreen canvas,
 * then scales that up to the screen with smoothing off, for crisp pixels.
 */
import { FIELD, segY } from './stages.js';
import { SPRITES, bake, DIGITS } from './sprites.js';

const C = {
  sky0: '#07080d',
  sky1: '#121625',
  girder: '#e2573f',
  girderHi: '#ff9068',
  girderLo: '#7d2619',
  ladder: '#53c7f0',
  ladderLo: '#25708f',
  lift: '#9aa3b5',
  cable: '#3b4256',
  rivet: '#facc15',
  rivetLo: '#9b7a08',
  wood: '#b8692e',
  woodLo: '#6d3a15',
  band: '#4b2a12',
  steel: '#8d96a8',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const buf = document.createElement('canvas');
  buf.width = FIELD.w;
  buf.height = FIELD.h;
  const g = buf.getContext('2d');

  const art = {};
  for (const [k, rows] of Object.entries(SPRITES)) {
    art[k] = bake(rows);
    art[k + 'L'] = bake(rows, true);
  }

  const backdrop = makeBackdrop();
  let staticLayer = null; // girders and ladders, redrawn only when they change
  let staticKey = '';
  let view = { x: 0, y: 0, scale: 1, dpr: 1, vw: 0, vh: 0 };

  function resize(v) {
    view = v;
    canvas.width = Math.round(v.vw * v.dpr);
    canvas.height = Math.round(v.vh * v.dpr);
    canvas.style.width = `${v.vw}px`;
    canvas.style.height = `${v.vh}px`;
  }

  /* ---------- Backdrop: night sky, distant cranes and towers ---------- */

  function makeBackdrop() {
    const c = document.createElement('canvas');
    c.width = FIELD.w;
    c.height = FIELD.h;
    const x = c.getContext('2d');
    const grad = x.createLinearGradient(0, 0, 0, FIELD.h);
    grad.addColorStop(0, C.sky0);
    grad.addColorStop(1, C.sky1);
    x.fillStyle = grad;
    x.fillRect(0, 0, FIELD.w, FIELD.h);
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      x.fillStyle = rnd() < 0.2 ? '#6b7899' : '#2c3347';
      x.fillRect((rnd() * FIELD.w) | 0, (rnd() * 150) | 0, 1, 1);
    }
    // City silhouette.
    x.fillStyle = '#0d101a';
    let px = 0;
    while (px < FIELD.w) {
      const w = 10 + ((rnd() * 18) | 0);
      const h = 20 + ((rnd() * 60) | 0);
      x.fillRect(px, FIELD.h - h, w, h);
      x.fillStyle = '#1a2032';
      for (let wy = FIELD.h - h + 4; wy < FIELD.h - 4; wy += 6) {
        for (let wx = px + 2; wx < px + w - 2; wx += 4) if (rnd() < 0.18) x.fillRect(wx, wy, 1, 2);
      }
      x.fillStyle = '#0d101a';
      px += w + 1;
    }
    // A crane on the right.
    x.fillStyle = '#151a29';
    x.fillRect(196, 70, 3, 186);
    x.fillRect(150, 70, 74, 3);
    for (let i = 150; i < 224; i += 6) x.fillRect(i, 67, 1, 3);
    x.fillRect(160, 73, 1, 40);
    return c;
  }

  /* ---------- Girders and ladders ---------- */

  function drawGirder(x, s) {
    const x0 = Math.ceil(Math.min(s.x1, s.x2));
    const x1 = Math.floor(Math.max(s.x1, s.x2));
    for (let cx = x0; cx < x1; cx += 4) {
      const w = Math.min(4, x1 - cx);
      const top = Math.round(segY(s, cx + w / 2));
      x.fillStyle = C.girderHi;
      x.fillRect(cx, top, w, 1);
      x.fillStyle = C.girder;
      x.fillRect(cx, top + 1, w, 6);
      x.fillStyle = C.girderLo;
      x.fillRect(cx, top + 7, w, 1);
      // Lattice: a zig-zag brace inside the beam.
      x.fillStyle = C.girderLo;
      const k = ((cx - x0) / 4) % 2;
      x.fillRect(cx + (k ? 3 : 0), top + 2, 1, 1);
      x.fillRect(cx + (k ? 2 : 1), top + 3, 1, 1);
      x.fillRect(cx + (k ? 1 : 2), top + 4, 1, 1);
      x.fillRect(cx + (k ? 0 : 3), top + 5, 1, 1);
    }
  }

  function drawLadder(x, l) {
    const top = l.top;
    const bottom = l.bottom + 1;
    x.fillStyle = C.ladderLo;
    x.fillRect(l.x - 5, top, 1, bottom - top);
    x.fillRect(l.x + 5, top, 1, bottom - top);
    x.fillStyle = C.ladder;
    x.fillRect(l.x - 4, top, 1, bottom - top);
    x.fillRect(l.x + 4, top, 1, bottom - top);
    const len = bottom - top;
    for (let y = top + 3; y < bottom - 1; y += 4) {
      // Broken ladders are missing their middle rungs and rails.
      if (l.broken && y > top + len * 0.3 && y < top + len * 0.7) continue;
      x.fillRect(l.x - 3, y, 7, 1);
    }
    if (l.broken) {
      x.clearRect(l.x - 5, Math.round(top + len * 0.36), 11, Math.round(len * 0.26));
    }
  }

  function buildStatic(world) {
    const c = staticLayer ?? document.createElement('canvas');
    c.width = FIELD.w;
    c.height = FIELD.h;
    const x = c.getContext('2d');
    x.clearRect(0, 0, FIELD.w, FIELD.h);
    for (const l of world.ladders) drawLadder(x, l);
    for (const s of world.girders) drawGirder(x, s);
    // Lift shafts: cables and pulleys.
    for (const sh of world.def.shafts ?? []) {
      x.fillStyle = C.cable;
      x.fillRect(sh.x - 9, sh.top - 14, 1, FIELD.h);
      x.fillRect(sh.x + 9, sh.top - 14, 1, FIELD.h);
      x.fillStyle = C.steel;
      x.fillRect(sh.x - 12, sh.top - 18, 25, 4);
      x.fillStyle = '#5a6275';
      x.fillRect(sh.x - 3, sh.top - 16, 7, 5);
    }
    // Rivets.
    for (const r of world.def.rivets ?? []) {
      if (r.popped) continue;
      x.fillStyle = C.rivetLo;
      x.fillRect(r.x - 4, r.y, 8, 8);
      x.fillStyle = C.rivet;
      x.fillRect(r.x - 3, r.y + 1, 6, 5);
      x.fillStyle = '#fff3b0';
      x.fillRect(r.x - 2, r.y + 1, 2, 1);
    }
    staticLayer = c;
  }

  /* ---------- Things ---------- */

  function drawSprite(name, x, y, flip = false) {
    const img = art[flip ? name + 'L' : name];
    g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height));
  }

  function drawBarrel(b, t) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    if (b.mode === 'ladder') {
      // Seen end-on while it drops down a ladder.
      g.fillStyle = C.woodLo;
      g.fillRect(x - 6, y - 9, 12, 9);
      g.fillStyle = C.wood;
      g.fillRect(x - 5, y - 8, 10, 7);
      g.fillStyle = C.band;
      g.fillRect(x - 6, y - 7, 12, 1);
      g.fillRect(x - 6, y - 3, 12, 1);
      return;
    }
    g.fillStyle = C.woodLo;
    g.fillRect(x - 5, y - 10, 10, 10);
    g.fillRect(x - 6, y - 9, 12, 8);
    g.fillStyle = C.wood;
    g.fillRect(x - 4, y - 9, 8, 8);
    g.fillRect(x - 5, y - 8, 10, 6);
    // Staves that turn as it rolls.
    const k = Math.floor(((b.rot % 4) + 4) % 4);
    g.fillStyle = C.band;
    g.fillRect(x - 4 + k * 2, y - 9, 1, 8);
    g.fillRect(x - 5, y - 6, 10, 1);
    g.fillStyle = '#e09b5d';
    g.fillRect(x - 3, y - 9, 2, 1);
    void t;
  }

  function drawSpark(s, t) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    const f = Math.floor((t + s.t) / 4) % 2;
    g.fillStyle = '#ff5a1f';
    g.fillRect(x - 4, y - 7, 8, 7);
    g.fillRect(x - 3, y - 9 - f, 6, 2);
    g.fillStyle = '#ffb02e';
    g.fillRect(x - 3, y - 6, 6, 5);
    g.fillRect(x - 1, y - 10 - f, 2, 2);
    g.fillStyle = '#fff1a8';
    g.fillRect(x - 2, y - 4, 4, 3);
    g.fillStyle = '#14161c';
    g.fillRect(x - 2, y - 5, 1, 2);
    g.fillRect(x + 1, y - 5, 1, 2);
  }

  function drawSpring(sp, t) {
    const x = Math.round(sp.x);
    const y = Math.round(sp.y);
    const squash = sp.mode === 'hop' && (sp.phase % 1 < 0.12 || sp.phase % 1 > 0.88) ? 2 : 0;
    g.fillStyle = '#cfd5e0';
    for (let i = 0; i < 4; i++) {
      const yy = y - 2 - i * (3 - squash / 2);
      g.fillRect(x - 5 + (i % 2), yy, 10, 1);
    }
    g.fillStyle = '#e5484d';
    g.fillRect(x - 6, y - 1, 12, 1);
    g.fillRect(x - 6, y - 13 + squash * 2, 12, 2);
    void t;
  }

  function drawHero(h, t) {
    if (h.mode === 'dead') {
      // Spin, then lie flat.
      const img = art.heroStand;
      g.save();
      g.translate(Math.round(h.x), Math.round(h.y) - 6);
      g.rotate(h.deadT < 60 ? (Math.floor(h.deadT / 6) * Math.PI) / 2 : Math.PI / 2);
      g.drawImage(img, -6, -8);
      g.restore();
      if (h.deadT > 60) {
        g.fillStyle = '#facc15';
        for (let i = 0; i < 3; i++) {
          const a = t / 10 + (i * Math.PI * 2) / 3;
          g.fillRect(Math.round(h.x + Math.cos(a) * 7), Math.round(h.y - 14 + Math.sin(a) * 2), 1, 1);
        }
      }
      return;
    }
    const flip = h.face < 0;
    let name = 'heroStand';
    if (h.mode === 'climb') name = 'heroClimb';
    else if (h.mode === 'air') name = 'heroJump';
    else if (h.mode === 'won') name = Math.floor(t / 10) % 2 ? 'heroJump' : 'heroStand';
    else if (h.moving) name = ['heroWalk1', 'heroStand', 'heroWalk2', 'heroStand'][Math.floor(h.walkT / 5) % 4];
    const climbFlip = h.mode === 'climb' ? Math.floor(h.climbT / 8) % 2 === 1 : flip;
    drawSprite(name, h.x, h.y, h.mode === 'climb' ? climbFlip : flip);
    if (h.hammer > 0) {
      const up = Math.floor(t / 8) % 2 === 0;
      const blink = h.hammer < 120 && Math.floor(t / 4) % 2 === 0;
      if (!blink) {
        if (up) {
          drawSprite('hammer', h.x + h.face * 3, h.y - 15);
        } else {
          g.save();
          g.translate(Math.round(h.x + h.face * 10), Math.round(h.y - 6));
          g.rotate(h.face * Math.PI / 2);
          g.drawImage(art.hammer, -4, -4);
          g.restore();
        }
      }
    }
  }

  function drawBoss(world, t) {
    const b = world.boss;
    const x = Math.round(b.x);
    const y = Math.round(b.y + b.fallY);
    const bob = b.anim === 'idle' ? Math.floor(t / 20) % 2 : 0;
    g.drawImage(art.boss, x - 14, y - 25 + bob);
    const arm = art.bossArm;
    if (b.anim === 'throw' && b.t < 26) {
      // Arms up, holding the next barrel or spring overhead.
      g.save();
      g.translate(x - 12, y - 24);
      g.scale(1, -1);
      g.drawImage(arm, -2, -2);
      g.restore();
      g.save();
      g.translate(x + 12, y - 24);
      g.scale(1, -1);
      g.drawImage(art.bossArmL, -3, -2);
      g.restore();
      if (b.t < 18) {
        if (world.def.id === 'ramps') drawBarrel({ x: x, y: y - 26, rot: 0, mode: 'roll' }, t);
        else drawSpring({ x: x, y: y - 26, mode: 'drop', phase: 0 }, t);
      }
    } else if (b.anim === 'rage' || b.anim === 'fall') {
      const f = Math.floor(t / 6) % 2;
      g.drawImage(arm, x - 15, y - 16 - f * 4);
      g.drawImage(art.bossArmL, x + 10, y - 16 - (1 - f) * 4);
    } else {
      g.drawImage(arm, x - 15, y - 15 + bob);
      g.drawImage(art.bossArmL, x + 10, y - 15 + bob);
    }
  }

  function drawDrum(d, lit, t) {
    const x = Math.round(d.x);
    const y = Math.round(d.y);
    g.fillStyle = '#1e3a8a';
    g.fillRect(x - 7, y - 15, 14, 15);
    g.fillStyle = '#2f5fd0';
    g.fillRect(x - 6, y - 14, 12, 13);
    g.fillStyle = '#facc15';
    for (let i = 0; i < 12; i += 4) g.fillRect(x - 6 + i, y - 9, 2, 3);
    g.fillStyle = '#14161c';
    g.fillRect(x - 6 + 2, y - 9, 2, 3);
    g.fillStyle = '#93b4ff';
    g.fillRect(x - 7, y - 15, 14, 1);
    g.fillRect(x - 7, y - 4, 14, 1);
    if (lit) {
      const f = Math.floor(t / 5) % 3;
      g.fillStyle = '#ff5a1f';
      g.fillRect(x - 6, y - 19 - f, 12, 4 + f);
      g.fillStyle = '#ffb02e';
      g.fillRect(x - 4, y - 21 + f, 3, 5);
      g.fillRect(x + 1, y - 22 + (2 - f), 3, 6);
      g.fillStyle = '#fff1a8';
      g.fillRect(x - 1, y - 18, 2, 3);
    }
  }

  function drawBeacon(b, t) {
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    g.fillStyle = '#8d96a8';
    g.fillRect(x, y - 22, 1, 22);
    const wave = Math.floor(t / 10) % 2;
    g.fillStyle = '#facc15';
    g.fillRect(x + 1, y - 22, 9, 3 + wave);
    g.fillRect(x + 1, y - 19 + wave, 6, 2);
    // A glowing light on top, pulsing.
    const on = Math.floor(t / 20) % 2;
    g.fillStyle = on ? '#fff1a8' : '#b98a0c';
    g.fillRect(x - 1, y - 25, 3, 3);
  }

  function drawLift(l) {
    const x = Math.round(l.x1);
    const y = Math.round(l.y);
    g.fillStyle = '#c9d0dd';
    g.fillRect(x, y, 25, 1);
    g.fillStyle = C.lift;
    g.fillRect(x, y + 1, 25, 3);
    g.fillStyle = '#4b5263';
    g.fillRect(x, y + 4, 25, 1);
    g.fillRect(x + 3, y + 1, 1, 3);
    g.fillRect(x + 21, y + 1, 1, 3);
  }

  function drawNumber(n, x, y, color) {
    const s = String(n);
    const w = s.length * 4 - 1;
    let px = Math.round(x - w / 2);
    g.fillStyle = color;
    for (const ch of s) {
      const d = DIGITS[ch];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (d[j][i] === '1') g.fillRect(px + i, Math.round(y) + j, 1, 1);
      px += 4;
    }
  }

  /* ---------- Frame ---------- */

  function draw(world, fx, t, shake = { x: 0, y: 0 }) {
    const key = world.stage + (world.def.rivets ? world.def.rivets.map((r) => (r.popped ? 1 : 0)).join('') : '');
    if (key !== staticKey) {
      buildStatic(world);
      staticKey = key;
    }
    g.drawImage(backdrop, 0, 0);
    g.save();
    g.translate(Math.round(shake.x), Math.round(shake.y));
    g.drawImage(staticLayer, 0, 0);
    for (const l of world.lifts) drawLift(l);
    if (world.def.drum) drawDrum(world.def.drum, world.sparks.length > 0 || fx.drumLit > 0, t);
    if (world.def.beacon) drawBeacon(world.def.beacon, t);
    for (const h of world.hammers) {
      if (h.taken) continue;
      g.drawImage(art.hammer, h.x - 4, h.y - 22 + (Math.floor(t / 30) % 2));
    }
    drawBoss(world, t);
    for (const s of world.sparks) drawSpark(s, t);
    for (const b of world.barrels) drawBarrel(b, t);
    for (const sp of world.springs) drawSpring(sp, t);
    drawHero(world.hero, t);
    for (const p of fx.particles) {
      g.fillStyle = p.color;
      g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    for (const p of fx.popups) drawNumber(p.points, p.x, p.y, p.life > 20 || Math.floor(p.life / 3) % 2 ? '#ffffff' : '#facc15');
    g.restore();

    // Scale up to the screen.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const d = view.dpr;
    ctx.drawImage(buf, Math.round(view.x * d), Math.round(view.y * d), Math.round(FIELD.w * view.scale * d), Math.round(FIELD.h * view.scale * d));
  }

  return { resize, draw };
}
