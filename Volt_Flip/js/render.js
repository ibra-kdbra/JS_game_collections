/**
 * Canvas renderer. The backing store follows devicePixelRatio (up to 3), and
 * everything is drawn as vector shapes in world units, so the picture stays
 * sharp at any size. Effects (sparks, trail, popups, shake) live here and run
 * on real frame time; they never touch the simulation.
 */
import { PISTON, PLAYER, SECTORS, SECTOR_LENGTH, UNITS_PER_METRE, WORLD } from './config.js';
import { CEIL, FLOOR, droneY, pistonHeight, pistonRaise, shutterPhase, surfaceY } from './course.js';

const H = WORLD.height;

export const PALETTE = {
  ink: '#09090b',
  corridor: '#0c0c0f',
  railBody: '#16161a',
  railStripe: '#1d1d22',
  tick: '#3f3f46',
  accent: '#facc15',
  accentSoft: 'rgba(250, 204, 21, 0.14)',
  danger: '#fb7185',
  dangerDeep: '#3b0d18',
  shield: '#22d3ee',
  magnet: '#a78bfa',
  text: '#fafafa',
};

function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function glowSprite(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, color);
  grd.addColorStop(0.35, color.replace(/[\d.]+\)$/, '0.35)'));
  grd.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  };
  const glow = {
    accent: glowSprite('rgba(250, 204, 21, 0.9)'),
    danger: glowSprite('rgba(251, 113, 133, 0.9)'),
    shield: glowSprite('rgba(34, 211, 238, 0.9)'),
    magnet: glowSprite('rgba(167, 139, 250, 0.9)'),
  };

  let cssW = 1;
  let cssH = 1;
  let dpr = 1;
  let scale = 1; // CSS px per world unit
  let top = 0; // CSS px of the ceiling surface
  let reduced = false;

  const fx = {
    particles: [],
    popups: [],
    trail: [],
    flash: 0,
    flashColor: '255, 255, 255',
    shake: 0,
    squash: 0,
    time: 0,
    banner: null, // { title, sub, life }
    tint: [...SECTORS[0].tint], // the city's colour, eased towards the current sector's
  };

  /** The sector a run is in: by distance in endless, by chapter in the campaign. */
  function sectorOf(world, dist) {
    if (world.level) return SECTORS[(world.level.chapter.id - 1) % SECTORS.length];
    return SECTORS[Math.floor(dist / UNITS_PER_METRE / SECTOR_LENGTH) % SECTORS.length];
  }
  const rgba = (c, a) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

  function resize(w, h, view) {
    cssW = w;
    cssH = h;
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const bw = Math.round(w * dpr);
    const bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = view.scale;
    top = view.top;
  }

  /* -------------------------------------------------------------- effects */

  function burst(x, y, n, colors, speed = 260, size = 4) {
    const count = reduced ? Math.ceil(n / 3) : n;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0,
        max: 0.35 + Math.random() * 0.45,
        color: colors[i % colors.length],
        size: size * (0.5 + Math.random()),
      });
    }
    if (fx.particles.length > 260) fx.particles.splice(0, fx.particles.length - 260);
  }

  function popup(world, text, y, color = PALETTE.accent) {
    fx.popups.push({ x: WORLD.playerX + 18, y, text, color, life: 0 });
    if (fx.popups.length > 8) fx.popups.shift();
  }

  /** Turn simulation events into effects. */
  function onEvent(e, world) {
    switch (e.type) {
      case 'flip':
        burst(world.dist - 6, world.p.y - e.g * 10, 6, [PALETTE.accent], 120, 2.5);
        break;
      case 'land':
        fx.squash = 1;
        burst(world.dist, surfaceY(e.g) + e.g * 12, 5, [PALETTE.accent, '#fde68a'], 90, 2);
        break;
      case 'shard': {
        burst(e.x, e.y, 7, [PALETTE.accent, '#fff7cc'], 150, 2.5);
        // Shards in quick succession add up in one popup instead of stacking.
        const last = fx.popups[fx.popups.length - 1];
        if (last && last.sum && last.life < 0.35) {
          last.sum += e.points;
          last.text = `+${last.sum}`;
          last.life = 0;
          last.y = e.y;
        } else {
          popup(world, `+${e.points}`, e.y);
          fx.popups[fx.popups.length - 1].sum = e.points;
        }
        break;
      }
      case 'graze':
        popup(world, `CLOSE +${e.points}`, e.y + (e.y > H / 2 ? -26 : 26), '#fde68a');
        break;
      case 'mult':
        popup(world, `×${e.mult}`, H / 2, PALETTE.accent);
        fx.flash = 0.12;
        fx.flashColor = '250, 204, 21';
        break;
      case 'miss':
        popup(world, `×${e.mult}`, H / 2, PALETTE.danger);
        break;
      case 'shield':
        burst(e.x, e.y, 14, [PALETTE.shield, '#cffafe'], 200, 3);
        popup(world, 'SHIELD', e.y - 24, PALETTE.shield);
        break;
      case 'magnet':
        burst(e.x, e.y, 14, [PALETTE.magnet, '#ede9fe'], 200, 3);
        popup(world, 'MAGNET', e.y - 24, PALETTE.magnet);
        break;
      case 'shieldBreak':
        burst(e.x, e.y, 24, [PALETTE.shield, '#ffffff', PALETTE.danger], 320, 3.5);
        fx.flash = 0.25;
        fx.flashColor = '34, 211, 238';
        if (!reduced) fx.shake = 6;
        break;
      case 'milestone':
        if (e.metre % SECTOR_LENGTH === 0) {
          const n = e.metre / SECTOR_LENGTH;
          const sec = SECTORS[n % SECTORS.length];
          fx.banner = { title: sec.name.toUpperCase(), sub: `SECTOR ${n + 1} · ${e.metre.toLocaleString('en-US')} M`, life: 0, color: sec.tint };
        } else popup(world, `${e.metre} m`, H / 2 - 40, PALETTE.text);
        break;
      case 'finish':
        burst(world.dist, world.p.y, 40, [PALETTE.accent, '#fff7cc', '#ffffff'], 380, 4);
        popup(world, 'UPLINK', H / 2 - 40, PALETTE.accent);
        fx.flash = 0.3;
        fx.flashColor = '250, 204, 21';
        break;
      case 'die':
        burst(world.dist, world.p.y, 46, [PALETTE.accent, PALETTE.danger, '#ffffff'], 420, 4.5);
        fx.flash = 0.4;
        fx.flashColor = '251, 113, 133';
        if (!reduced) fx.shake = 12;
        break;
    }
  }

  function updateFx(dt) {
    fx.time += dt;
    for (const p of fx.particles) {
      p.life += dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    fx.particles = fx.particles.filter((p) => p.life < p.max);
    for (const p of fx.popups) p.life += dt;
    fx.popups = fx.popups.filter((p) => p.life < 0.9);
    if (fx.banner) {
      fx.banner.life += dt;
      if (fx.banner.life > 2.4) fx.banner = null;
    }
    fx.flash = Math.max(0, fx.flash - dt);
    fx.shake = Math.max(0, fx.shake - dt * 40);
    fx.squash = Math.max(0, fx.squash - dt * 7);
  }

  function reset() {
    fx.particles.length = 0;
    fx.popups.length = 0;
    fx.trail.length = 0;
    fx.flash = 0;
    fx.shake = 0;
    fx.banner = null;
    tintSnap = true;
  }
  let tintSnap = true;

  /* ------------------------------------------------------------- drawing */

  function drawGlow(sprite, x, y, r, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /**
   * The city outside the corridor, above the ceiling and below the floor:
   * a glow on the horizon, three layers of towers scrolling at different
   * speeds, lit windows and blinking beacons, all in the sector's colour.
   */
  function drawBackdrop(camX, viewW, yTop, yBottom) {
    const tint = fx.tint;
    // Horizon glow, strongest right against the rails.
    for (const [from, to] of [[-24, yTop], [H + 24, yBottom]]) {
      if ((to - from) * (from < 0 ? -1 : 1) <= 0) continue;
      const g = ctx.createLinearGradient(0, from, 0, to);
      g.addColorStop(0, rgba(tint, 0.1));
      g.addColorStop(0.5, rgba(tint, 0.025));
      g.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, Math.min(from, to), viewW, Math.abs(to - from));
    }
    const layers = [
      { f: 0.08, w: 64, color: '#0c0c10', lit: 0.05, seed: 5, rise: 70, beacon: true },
      { f: 0.18, w: 46, color: '#0f0f13', lit: 0.08, seed: 11, rise: 40 },
      { f: 0.42, w: 34, color: '#131317', lit: 0.13, seed: 37, rise: 40 },
    ];
    for (const L of layers) {
      const off = camX * L.f;
      const first = Math.floor(off / L.w) - 1;
      const last = Math.ceil((off + viewW) / L.w) + 1;
      for (let i = first; i <= last; i++) {
        const x = i * L.w - off;
        const r = hash(i * 31 + L.seed);
        const below = H + 26 + (1 - r) * L.rise;
        const above = -26 - hash(i * 17 + L.seed) * L.rise;
        ctx.fillStyle = L.color;
        ctx.fillRect(x + 2, below, L.w - 4, yBottom - below);
        ctx.fillRect(x + 2, yTop, L.w - 4, above - yTop);
        // Lit windows, a few of them flickering.
        for (let k = 0; k < 4; k++) {
          const h1 = hash(i * 7 + k * 101 + L.seed);
          if (h1 < 0.5) continue;
          const flick = !reduced && h1 > 0.93 ? 0.5 + 0.5 * Math.sin(fx.time * 3 + i) : 1;
          ctx.fillStyle = rgba(tint, L.lit * flick);
          ctx.fillRect(x + 6 + (k % 2) * 12, below + 10 + k * 14, 5, 3);
          ctx.fillRect(x + 6 + ((k + 1) % 2) * 12, above - 14 - k * 14, 5, 3);
        }
        // Beacons on the tallest far towers.
        if (L.beacon && r < 0.25) {
          const on = reduced || (fx.time * 0.8 + r * 7) % 1 < 0.5;
          if (on) {
            drawGlow(glow.danger, x + L.w / 2, below - 4, 10, 0.5);
            drawGlow(glow.danger, x + L.w / 2, above + 4, 10, 0.5);
          }
        }
      }
    }
  }

  function drawCorridor(camX, viewW, speed) {
    ctx.fillStyle = PALETTE.corridor;
    ctx.fillRect(0, 0, viewW, H);
    // Grid that moves at the courier's pace, so speed is felt.
    ctx.fillStyle = rgba(fx.tint.map((v) => 200 + v * 0.2), 0.03);
    const step = 60;
    for (let x = -(camX % step); x < viewW; x += step) ctx.fillRect(x, 0, 1, H);
    // The polarity line down the middle.
    ctx.fillStyle = 'rgba(250, 204, 21, 0.07)';
    const dash = 26;
    for (let x = -((camX * 1.0) % (dash * 2)); x < viewW; x += dash * 2) ctx.fillRect(x, H / 2 - 0.75, dash, 1.5);
    // Speed streaks.
    if (!reduced) {
      const k = Math.min(1, Math.max(0, (speed - 300) / 180));
      if (k > 0) {
        ctx.fillStyle = rgba(fx.tint, 0.06 * k);
        for (let i = 0; i < 6; i++) {
          const y = 30 + hash(i + 3) * (H - 60);
          const len = 60 + hash(i + 9) * 120;
          const x = viewW - (((camX * 1.6 + hash(i) * 2000) % (viewW + len * 2)) - len);
          ctx.fillRect(x, y, len, 1);
        }
      }
    }
  }

  /** Solid stretches of one surface across the view, cut by its holes. */
  function solidRuns(gaps, g, x0, x1) {
    const holes = gaps.filter((o) => o.surf === g && o.x + o.w > x0 && o.x < x1).sort((a, b) => a.x - b.x);
    const runs = [];
    let x = x0;
    for (const o of holes) {
      if (o.x > x) runs.push([x, o.x]);
      x = Math.max(x, o.x + o.w);
    }
    if (x < x1) runs.push([x, x1]);
    return { runs, holes };
  }

  function drawRails(world, camX, viewW) {
    const x0 = camX - 20;
    const x1 = camX + viewW + 20;
    for (const g of [FLOOR, CEIL]) {
      const { runs, holes } = solidRuns(world.course.gaps, g, x0, x1);
      const y = g === FLOOR ? H : -18; // body top
      for (const [a, b] of runs) {
        const sx = a - camX;
        const w = b - a;
        ctx.fillStyle = PALETTE.railBody;
        ctx.fillRect(sx, y, w, 18);
        // Hazard stripes inside the rail body.
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, y + 4, w, 11);
        ctx.clip();
        ctx.fillStyle = PALETTE.railStripe;
        const first = Math.floor(a / 22) * 22;
        for (let s = first; s < b + 22; s += 22) {
          const px = s - camX;
          ctx.beginPath();
          ctx.moveTo(px, y + 15);
          ctx.lineTo(px + 10, y + 4);
          ctx.lineTo(px + 18, y + 4);
          ctx.lineTo(px + 8, y + 15);
          ctx.fill();
        }
        ctx.restore();
        // The bright edge the courier runs on.
        ctx.fillStyle = PALETTE.accent;
        ctx.fillRect(sx, g === FLOOR ? H : -3, w, 3);
        // Ticks.
        ctx.fillStyle = PALETTE.tick;
        const t0 = Math.ceil(a / 40) * 40;
        for (let t = t0; t < b; t += 40) ctx.fillRect(t - camX, g === FLOOR ? H + 5 : -9, 2, 4);
      }
      // Holes: red caps on both ends and chevrons pointing into the void.
      for (const o of holes) {
        const a = o.x - camX;
        const b = o.x + o.w - camX;
        drawGlow(glow.danger, a, g === FLOOR ? H : 0, 16, 0.45);
        drawGlow(glow.danger, b, g === FLOOR ? H : 0, 16, 0.45);
        ctx.fillStyle = PALETTE.danger;
        ctx.fillRect(a - 3, g === FLOOR ? H - 2 : -16, 3, 18);
        ctx.fillRect(b, g === FLOOR ? H - 2 : -16, 3, 18);
        ctx.strokeStyle = 'rgba(251, 113, 133, 0.28)';
        ctx.lineWidth = 2;
        const pulse = (fx.time * 1.6) % 1;
        for (let row = 0; row < 3; row++) {
          const d = 8 + ((row + pulse) % 3) * 12;
          const yy = g === FLOOR ? H + d : -d;
          ctx.globalAlpha = 1 - ((row + pulse) % 3) / 3;
          ctx.beginPath();
          for (let cx = a + 12; cx < b - 10; cx += 24) {
            ctx.moveTo(cx - 6, yy - g * 4);
            ctx.lineTo(cx, yy + g * 2);
            ctx.lineTo(cx + 6, yy - g * 4);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawSpike(o, camX) {
    const base = o.surf === FLOOR ? H : 0;
    const tip = o.surf === FLOOR ? H - 22 : 22;
    const sx = o.x - camX;
    drawGlow(glow.danger, sx + o.w / 2, (base + tip) / 2, Math.max(24, o.w * 0.7), 0.22);
    const teeth = Math.max(1, Math.round(o.w / 26));
    const tw = o.w / teeth;
    ctx.fillStyle = PALETTE.danger;
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const x = sx + i * tw;
      ctx.moveTo(x + 1, base);
      ctx.lineTo(x + tw / 2, tip);
      ctx.lineTo(x + tw - 1, base);
    }
    ctx.fill();
    // Lit faces.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const x = sx + i * tw;
      ctx.moveTo(x + tw / 2, tip);
      ctx.lineTo(x + tw / 2 + 3, base);
      ctx.lineTo(x + tw - 1, base);
    }
    ctx.fill();
  }

  function drawPylon(o, camX) {
    const sx = o.x - camX;
    const y0 = o.surf === FLOOR ? H - o.h : 0;
    const tipY = o.surf === FLOOR ? H - o.h : o.h;
    ctx.fillStyle = PALETTE.dangerDeep;
    ctx.fillRect(sx, y0, o.w, o.h);
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, y0 + 1, o.w - 2, o.h - 2);
    // Chevrons inside.
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.35)';
    ctx.beginPath();
    for (let k = 14; k < o.h - 8; k += 16) {
      const yy = o.surf === FLOOR ? H - k : k;
      ctx.moveTo(sx + 5, yy + o.surf * 4);
      ctx.lineTo(sx + o.w / 2, yy);
      ctx.lineTo(sx + o.w - 5, yy + o.surf * 4);
    }
    ctx.stroke();
    const pulse = 0.55 + 0.45 * Math.sin(fx.time * 8 + o.id);
    drawGlow(glow.danger, sx + o.w / 2, tipY, 26, 0.35 + 0.25 * pulse);
    ctx.fillStyle = '#ffe4e6';
    ctx.fillRect(sx - 2, tipY - 2, o.w + 4, 4);
  }

  /** Teeth on a rail that rise, hold and sink; a lit slot shows where they come up. */
  function drawPiston(o, camX, t) {
    const sx = o.x - camX;
    const fl = o.surf === FLOOR;
    const base = fl ? H : 0;
    const up = pistonHeight(o, t);
    const k = pistonRaise(o, t);
    // The slot in the rail, warming up just before the teeth rise.
    let u = ((t + o.phase) % o.period) / o.period;
    if (u < 0) u += 1;
    const warn = u > 0.8 ? (u - 0.8) / 0.2 : 0;
    ctx.fillStyle = '#27272a';
    ctx.fillRect(sx, fl ? H - 3 : 0, o.w, 3);
    ctx.fillStyle = `rgba(251, 113, 133, ${0.25 + 0.75 * Math.max(warn, k)})`;
    ctx.fillRect(sx + 2, fl ? H - 2 : 0, o.w - 4, 2);
    if (warn > 0 && !reduced) drawGlow(glow.danger, sx + o.w / 2, base, o.w * 0.6, 0.35 * warn);
    if (up < 1) return;
    const lethal = up >= PISTON.lethal;
    drawGlow(glow.danger, sx + o.w / 2, base - (fl ? up / 2 : -up / 2), Math.max(24, o.w * 0.7), lethal ? 0.3 : 0.12);
    const teeth = Math.max(1, Math.round(o.w / 26));
    const tw = o.w / teeth;
    const tip = fl ? H - up : up;
    // Shaft, then teeth on top.
    const shaft = Math.max(0, up - 14);
    ctx.fillStyle = PALETTE.dangerDeep;
    ctx.fillRect(sx + 3, fl ? H - shaft : 0, o.w - 6, shaft);
    ctx.fillStyle = lethal ? PALETTE.danger : 'rgba(251, 113, 133, 0.55)';
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const x = sx + i * tw;
      const foot = fl ? tip + 14 : tip - 14;
      ctx.moveTo(x + 1, foot);
      ctx.lineTo(x + tw / 2, tip);
      ctx.lineTo(x + tw - 1, foot);
    }
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const x = sx + i * tw;
      const foot = fl ? tip + 14 : tip - 14;
      ctx.moveTo(x + tw / 2, tip);
      ctx.lineTo(x + tw / 2 + 3, foot);
      ctx.lineTo(x + tw - 1, foot);
    }
    ctx.fill();
  }

  function drawDrone(o, camX, t) {
    const sx = o.x - camX;
    const y = droneY(o, t);
    // Its track, so its reach is readable before it arrives.
    ctx.strokeStyle = o.sweeper ? 'rgba(251, 113, 133, 0.28)' : 'rgba(251, 113, 133, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(sx, o.y0 - o.amp - o.r);
    ctx.lineTo(sx, o.y0 + o.amp + o.r);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(251, 113, 133, 0.5)';
    ctx.fillRect(sx - 6, o.y0 - o.amp - o.r - 1, 12, 2);
    ctx.fillRect(sx - 6, o.y0 + o.amp + o.r - 1, 12, 2);

    drawGlow(glow.danger, sx, y, o.r * 2.4, 0.4);
    // Rotor arms.
    const spin = fx.time * 9 + o.id;
    ctx.strokeStyle = PALETTE.danger;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3;
      ctx.moveTo(sx + Math.cos(a) * (o.r - 1), y + Math.sin(a) * (o.r - 1));
      ctx.lineTo(sx + Math.cos(a) * (o.r + 5), y + Math.sin(a) * (o.r + 5));
    }
    ctx.stroke();
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(sx, y, o.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (o.sweeper) {
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx, y, o.r - 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.danger;
    ctx.beginPath();
    ctx.arc(sx - 2, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx - 4, y - 1, 2, 2);
  }

  function drawShutter(o, camX, t) {
    const sx = o.x - camX;
    const st = shutterPhase(o, t);
    // Emitters at both ends.
    ctx.fillStyle = '#27272a';
    ctx.fillRect(sx - 7, 0, 14, 10);
    ctx.fillRect(sx - 7, H - 10, 14, 10);
    ctx.fillStyle = PALETTE.danger;
    ctx.fillRect(sx - 7, 9, 14, 2);
    ctx.fillRect(sx - 7, H - 11, 14, 2);
    // Middle node.
    ctx.fillStyle = '#27272a';
    ctx.fillRect(sx - 5, H / 2 - 3, 10, 6);
    const half = (side, fn) => {
      const a = side === CEIL ? 10 : H / 2 + 3;
      const b = side === CEIL ? H / 2 - 3 : H - 10;
      fn(a, b);
    };
    // Faint guide on both halves.
    ctx.fillStyle = 'rgba(251, 113, 133, 0.12)';
    ctx.fillRect(sx - 0.75, 10, 1.5, H - 20);
    if (st.lethal) {
      const flicker = st.k > 0.82 && !reduced ? (Math.floor(fx.time * 30) % 2 ? 0.55 : 1) : 1;
      half(st.lethal, (a, b) => {
        drawGlow(glow.danger, sx, (a + b) / 2, (b - a) * 0.6, 0.35 * flicker);
        ctx.fillStyle = `rgba(251, 113, 133, ${0.35 * flicker})`;
        ctx.fillRect(sx - 6, a, 12, b - a);
        ctx.fillStyle = `rgba(255, 228, 230, ${flicker})`;
        const jitter = reduced ? 0 : Math.sin(fx.time * 60) * 0.6;
        ctx.fillRect(sx - 2 + jitter, a, 4, b - a);
      });
    }
    if (st.charging) {
      half(st.charging, (a, b) => {
        ctx.strokeStyle = `rgba(251, 113, 133, ${0.3 + 0.6 * st.k})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -fx.time * 40;
        ctx.beginPath();
        ctx.moveTo(sx, a);
        ctx.lineTo(sx, b);
        ctx.stroke();
        ctx.setLineDash([]);
      });
    }
  }

  function drawShard(o, camX) {
    const sx = o.x - camX;
    const bob = Math.sin(fx.time * 5 + o.x * 0.05) * 1.5;
    drawGlow(glow.accent, sx, o.y + bob, 16, 0.4);
    ctx.fillStyle = PALETTE.accent;
    ctx.beginPath();
    ctx.moveTo(sx, o.y + bob - 8);
    ctx.lineTo(sx + 5.5, o.y + bob);
    ctx.lineTo(sx, o.y + bob + 8);
    ctx.lineTo(sx - 5.5, o.y + bob);
    ctx.fill();
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath();
    ctx.moveTo(sx, o.y + bob - 4);
    ctx.lineTo(sx + 2.2, o.y + bob);
    ctx.lineTo(sx, o.y + bob + 4);
    ctx.lineTo(sx - 2.2, o.y + bob);
    ctx.fill();
  }

  function hexPath(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  function drawShieldPickup(o, camX) {
    const sx = o.x - camX;
    const bob = Math.sin(fx.time * 3) * 3;
    drawGlow(glow.shield, sx, o.y + bob, 34, 0.45);
    hexPath(sx, o.y + bob, 14);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.fill();
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.shield;
    ctx.beginPath();
    ctx.moveTo(sx, o.y + bob - 7);
    ctx.lineTo(sx + 6, o.y + bob - 4);
    ctx.lineTo(sx + 5, o.y + bob + 2);
    ctx.lineTo(sx, o.y + bob + 7);
    ctx.lineTo(sx - 5, o.y + bob + 2);
    ctx.lineTo(sx - 6, o.y + bob - 4);
    ctx.closePath();
    ctx.fill();
  }

  function drawMagnetPickup(o, camX) {
    const sx = o.x - camX;
    const y = o.y + Math.sin(fx.time * 3 + 1) * 3;
    drawGlow(glow.magnet, sx, y, 34, 0.45);
    ctx.strokeStyle = PALETTE.magnet;
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(sx, y - 1, 8, Math.PI, 0, true);
    ctx.lineTo(sx + 8, y - 9);
    ctx.moveTo(sx - 8, y - 1);
    ctx.lineTo(sx - 8, y - 9);
    ctx.stroke();
    ctx.fillStyle = '#ede9fe';
    ctx.fillRect(sx - 10.5, y - 13, 5, 4);
    ctx.fillRect(sx + 5.5, y - 13, 5, 4);
  }

  /** A campaign level's finish line: a lit gate across the corridor, chequered like a flag. */
  function drawFinish(x, camX, viewW) {
    const sx = x - camX;
    if (sx < -40 || sx > viewW + 40) return;
    const pulse = reduced ? 0.7 : 0.6 + 0.4 * Math.sin(fx.time * 5);
    drawGlow(glow.accent, sx, H / 2, 90, 0.18 + 0.12 * pulse);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.07)';
    ctx.fillRect(sx, 0, 160, H);
    const cell = 10;
    for (let row = 0; row < H / cell; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillStyle = (row + col) % 2 ? 'rgba(250, 204, 21, 0.85)' : 'rgba(9, 9, 11, 0.9)';
        ctx.fillRect(sx - cell + col * cell, row * cell, cell, cell);
      }
    }
    ctx.fillStyle = PALETTE.accent;
    ctx.fillRect(sx - cell - 2, 0, 2, H);
    ctx.fillRect(sx + cell, 0, 2, H);
    // Beacons on both rails.
    for (const yy of [-6, H + 6]) {
      ctx.fillStyle = '#fffbe6';
      ctx.fillRect(sx - 6, yy - 3, 12, 6);
      drawGlow(glow.accent, sx, yy, 22, 0.5 * pulse + 0.2);
    }
  }

  /** Your furthest run so far, as a dashed gate across the corridor. */
  function drawBest(x, camX, viewW) {
    const sx = x - camX;
    if (sx < -60 || sx > viewW + 60) return;
    ctx.strokeStyle = 'rgba(250, 250, 250, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(250, 250, 250, 0.7)';
    ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('BEST', sx + 6, 8);
    ctx.textBaseline = 'middle';
  }

  function drawPlayer(world, y, alive) {
    const p = world.p;
    const x = WORLD.playerX;
    const s = PLAYER.size;
    const ceilY = surfaceY(CEIL);
    const floorY = surfaceY(FLOOR);
    const k = Math.min(1, Math.max(0, (y - ceilY) / (floorY - ceilY)));
    const angle = Math.PI * (1 - k);

    // Trail: one smooth ribbon through the recent path, thin and faint at the tail,
    // as wide as the body at the head. Drawn as a single filled shape, so it has
    // no seams or steps whatever the frame rate.
    const pts = fx.trail;
    if (pts.length > 1) {
      const n = pts.length;
      const left = [];
      const right = [];
      for (let i = 0; i < n; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(n - 1, i + 1)];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const w = (s * 0.42) * Math.pow(i / (n - 1), 0.8);
        left.push(pts[i].x - dy * w, pts[i].y + dx * w);
        right.push(pts[i].x + dy * w, pts[i].y - dx * w);
      }
      const grd = ctx.createLinearGradient(pts[0].x, 0, pts[n - 1].x, 0);
      grd.addColorStop(0, 'rgba(250, 204, 21, 0)');
      grd.addColorStop(1, 'rgba(250, 204, 21, 0.34)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(left[0], left[1]);
      for (let i = 2; i < left.length; i += 2) ctx.lineTo(left[i], left[i + 1]);
      for (let i = right.length - 2; i >= 0; i -= 2) ctx.lineTo(right[i], right[i + 1]);
      ctx.closePath();
      ctx.fill();
    }
    if (!alive) return;

    if (world.invuln > 0 && Math.floor(fx.time * 20) % 2) ctx.globalAlpha = 0.45;
    drawGlow(glow.accent, x, y, 36, 0.45);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const sq = p.grounded ? fx.squash : 0;
    ctx.scale(1 + 0.22 * sq, 1 - 0.22 * sq);
    // Body.
    ctx.fillStyle = PALETTE.accent;
    roundRect(-s / 2, -s / 2, s, s, 5);
    ctx.fill();
    // Feet strip on the side that touches the rail.
    ctx.fillStyle = '#a16207';
    ctx.fillRect(-s / 2 + 3, s / 2 - 4, s - 6, 2);
    // Volt mark.
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.moveTo(-5, -1);
    ctx.lineTo(-1, -1);
    ctx.lineTo(-3, 3);
    ctx.lineTo(1, 3);
    ctx.lineTo(-5, 9);
    ctx.lineTo(-3.5, 4.5);
    ctx.lineTo(-7, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // The visor always faces forward, on the side away from the rail.
    if (k > 0.04 && k < 0.96) ctx.globalAlpha *= 0.9;
    const vy = y - 7 + (1 - k) * 8;
    ctx.fillStyle = PALETTE.ink;
    roundRect(x + 2, vy, 9, 6, 2);
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 8, vy + 1, 2, 2);
    ctx.globalAlpha = 1;

    if (world.shield) {
      const r = 21 + Math.sin(fx.time * 6) * 1.2;
      drawGlow(glow.shield, x, y, 40, 0.3);
      hexPath(x, y, r);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (world.magnet > 0) {
      const fade = Math.min(1, world.magnet / 1.2);
      ctx.strokeStyle = `rgba(167, 139, 250, ${0.5 * fade})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 7]);
      ctx.lineDashOffset = fx.time * 30;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /**
   * Draw one frame.
   * @param {object} world
   * @param {number} dist   interpolated distance
   * @param {number} y      interpolated courier height
   * @param {number} dt     real seconds since the last frame (effects only)
   */
  function draw(world, dist, y, dt, { dim = 0, best = 0 } = {}) {
    updateFx(dt);
    const target = sectorOf(world, dist).tint;
    const ease = tintSnap ? 1 : Math.min(1, dt * 1.5);
    tintSnap = false;
    for (let i = 0; i < 3; i++) fx.tint[i] += (target[i] - fx.tint[i]) * ease;
    const camX = dist - WORLD.playerX;
    const viewW = cssW / scale;
    const yTop = -top / scale;
    const yBottom = (cssH - top) / scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let sx = 0;
    let sy = 0;
    if (fx.shake > 0) {
      sx = (Math.random() - 0.5) * fx.shake;
      sy = (Math.random() - 0.5) * fx.shake;
    }
    const k = dpr * scale;
    ctx.setTransform(k, 0, 0, k, Math.round(sx * k), Math.round(top * dpr + sy * k));

    drawBackdrop(camX, viewW, yTop, yBottom);
    drawCorridor(camX, viewW, world.speed);
    drawRails(world, camX, viewW);
    if (world.course.finish) drawFinish(world.course.finish, camX, viewW);
    if (best > 0) drawBest(best * UNITS_PER_METRE, camX, viewW);

    const left = camX - 60;
    const right = camX + viewW + 60;
    const t = world.t;
    for (const o of world.course.hazards) {
      if (o.x + (o.w || 0) < left || o.x > right) continue;
      if (o.broken) ctx.globalAlpha = 0.18;
      if (o.kind === 'spike') drawSpike(o, camX);
      else if (o.kind === 'pylon') drawPylon(o, camX);
      else if (o.kind === 'drone') drawDrone(o, camX, t);
      else if (o.kind === 'shutter') drawShutter(o, camX, t);
      else if (o.kind === 'piston') drawPiston(o, camX, t);
      ctx.globalAlpha = 1;
    }
    for (const o of world.course.pickups) {
      if (o.done || o.x < left || o.x > right) continue;
      if (o.kind === 'shard') drawShard(o, camX);
      else if (o.kind === 'shield') drawShieldPickup(o, camX);
      else drawMagnetPickup(o, camX);
    }

    // Trail samples, in view space.
    const alive = !world.over || world.won;
    // The trail keeps the last 0.14 s of the path (less with reduced motion),
    // ageing points by real time so it looks the same at 30, 60 or 144 Hz.
    const trailLife = reduced ? 0.06 : 0.14;
    for (const tr of fx.trail) {
      tr.x -= world.speed * dt;
      tr.age += dt;
    }
    while (fx.trail.length && fx.trail[0].age > trailLife) fx.trail.shift();
    if (!world.over) {
      const last = fx.trail[fx.trail.length - 1];
      if (dt > 0 || !last) fx.trail.push({ x: WORLD.playerX, y, age: 0 });
      else last.y = y;
      if (fx.trail.length > 48) fx.trail.shift();
    } else if (fx.trail.length) fx.trail.shift();
    drawPlayer(world, y, alive);

    // Sparks (world space).
    for (const p of fx.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Score popups (view space), rising.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '700 15px "Chakra Petch", system-ui, sans-serif';
    for (const p of fx.popups) {
      const a = 1 - p.life / 0.9;
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - p.life * 40);
    }
    ctx.globalAlpha = 1;

    // Sector banner, mid-corridor: slides in, holds, fades.
    if (fx.banner) {
      const b = fx.banner;
      const a = Math.min(1, b.life / 0.25, (2.4 - b.life) / 0.5);
      const slide = reduced ? 0 : (1 - Math.min(1, b.life / 0.3)) * 24;
      const cx = viewW / 2 + slide;
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(b.color, 0.9);
      ctx.font = '700 12px "Chakra Petch", system-ui, sans-serif';
      ctx.fillText(b.sub, cx, H / 2 - 30);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '700 30px "Chakra Petch", system-ui, sans-serif';
      ctx.fillText(b.title, cx, H / 2);
      ctx.fillStyle = rgba(b.color, 0.8);
      ctx.fillRect(cx - 40, H / 2 + 22, 80, 2);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(${fx.flashColor}, ${Math.min(0.35, fx.flash)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (dim > 0) {
      ctx.fillStyle = `rgba(9, 9, 11, ${dim})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  return {
    resize,
    draw,
    onEvent,
    reset,
    setReduced(v) {
      reduced = v;
    },
  };
}
