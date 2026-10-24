/**
 * Canvas renderer. The field is drawn in world units (480 x 640) with a
 * transform that maps it onto the screen rectangle chosen by layout().
 */
import { CONFIG } from './config.js';

export const NORMAL_COLORS = ['#facc15', '#f59e0b', '#f97316', '#ef4444', '#e7e5e4', '#2dd4bf', '#38bdf8'];
const KIND_COLORS = { tough2: '#8a817c', tough3: '#4b5b70', steel: '#3f3f46', bomb: '#1c1917' };

export const POWERUP_STYLE = {
  wide: { color: '#38bdf8', label: 'Wide', name: 'Wide paddle' },
  multi: { color: '#f97316', label: 'Multi', name: 'Multi-ball' },
  slow: { color: '#2dd4bf', label: 'Slow', name: 'Slow ball' },
  laser: { color: '#ef4444', label: 'Laser', name: 'Laser' },
  catch: { color: '#a3e635', label: 'Catch', name: 'Catch' },
  life: { color: '#fafafa', label: 'Life', name: 'Extra life' },
};

export function brickColor(b) {
  if (b.kind === 'normal') return NORMAL_COLORS[b.color % NORMAL_COLORS.length];
  if (b.kind === 'bomb') return '#facc15';
  return KIND_COLORS[b.kind];
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt > 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const shadeCache = new Map();
function tones(hex) {
  let t = shadeCache.get(hex);
  if (!t) {
    t = { hi: shade(hex, 0.4), lo: shade(hex, -0.38), edge: shade(hex, -0.6) };
    shadeCache.set(hex, t);
  }
  return t;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
}

/** Draws one brick at (x, y, w, h). `b` needs kind, color, hp, maxHp, flash. */
export function drawBrick(ctx, b, x, y, w, h, time = 0) {
  const base = b.kind === 'bomb' ? '#1c1917' : brickColor(b);
  const t = tones(base);
  // Enamel tile: dark lip, face, top highlight.
  roundRect(ctx, x, y, w, h, 2);
  ctx.fillStyle = t.edge;
  ctx.fill();
  roundRect(ctx, x, y, w, h - 2, 2);
  ctx.fillStyle = base;
  ctx.fill();
  ctx.fillStyle = t.hi;
  ctx.fillRect(x + 2, y + 1, w - 4, 2);

  if (b.kind === 'steel') {
    ctx.save();
    roundRect(ctx, x, y, w, h - 2, 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = -h; i < w; i += 7) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.restore();
    for (const rx of [x + 5, x + w - 5]) {
      ctx.fillStyle = '#18181b';
      ctx.beginPath();
      ctx.arc(rx, y + h / 2 - 1, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(rx - 1, y + h / 2 - 3, 1.2, 1.2);
    }
  } else if (b.kind === 'bomb') {
    ctx.save();
    roundRect(ctx, x, y, w, h - 2, 2);
    ctx.clip();
    ctx.fillStyle = '#facc15';
    for (let i = -h; i < w + h; i += 8) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + 4, y + h);
      ctx.lineTo(x + i + 4 + h, y);
      ctx.lineTo(x + i + h, y);
      ctx.fill();
    }
    ctx.restore();
    const pulse = 0.6 + 0.4 * Math.sin(time * 6 + x * 0.1);
    ctx.fillStyle = '#09090b';
    roundRect(ctx, x + w / 2 - 8, y + 3, 16, h - 8, 3);
    ctx.fill();
    ctx.fillStyle = `rgba(239,68,68,${0.55 + 0.45 * pulse})`;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2 - 1, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (b.kind === 'tough2' || b.kind === 'tough3') {
    // Pips: filled for hits left, hollow for hits taken.
    const n = b.maxHp;
    const gap = 8;
    const sx = x + w / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const on = i < b.hp;
      ctx.beginPath();
      ctx.arc(sx + i * gap, y + h / 2 - 1, 2.6, 0, Math.PI * 2);
      if (on) {
        ctx.fillStyle = b.kind === 'tough3' ? '#facc15' : '#fafafa';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    if (b.hp < b.maxHp) {
      // Cracks grow with damage.
      ctx.strokeStyle = 'rgba(9,9,11,0.7)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y + 3);
      ctx.lineTo(x + 9, y + 8);
      ctx.lineTo(x + 7, y + h - 4);
      if (b.maxHp - b.hp > 1) {
        ctx.moveTo(x + w - 4, y + h - 4);
        ctx.lineTo(x + w - 10, y + 7);
        ctx.lineTo(x + w - 6, y + 3);
      }
      ctx.stroke();
    }
  }
  if (b.drop) {
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2 - 4, y + h / 2 - 1);
    ctx.lineTo(x + w / 2 + 4, y + h / 2 - 1);
    ctx.moveTo(x + w / 2, y + h / 2 - 5);
    ctx.lineTo(x + w / 2, y + h / 2 + 3);
    ctx.stroke();
  }
  if (b.flash > 0) {
    roundRect(ctx, x, y, w, h, 2);
    ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.75})`;
    ctx.fill();
  }
}

/** Power-up icon in dark ink, centred on (cx, cy), about 12px tall. */
export function drawPowerupIcon(ctx, type, cx, cy, ink = '#09090b') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  switch (type) {
    case 'wide': // double arrow
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.moveTo(-5, -4);
      ctx.lineTo(-9, 0);
      ctx.lineTo(-5, 4);
      ctx.moveTo(5, -4);
      ctx.lineTo(9, 0);
      ctx.lineTo(5, 4);
      ctx.stroke();
      break;
    case 'multi': // three balls
      for (const [x, y] of [[-6, 2], [0, -3], [6, 2]]) {
        ctx.moveTo(x + 2.6, y);
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      }
      ctx.fill();
      break;
    case 'slow': // hourglass
      ctx.moveTo(-5, -5);
      ctx.lineTo(5, -5);
      ctx.lineTo(-5, 5);
      ctx.lineTo(5, 5);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'laser': // twin bolts
      ctx.moveTo(-4, 5);
      ctx.lineTo(-4, -5);
      ctx.moveTo(4, 5);
      ctx.lineTo(4, -5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6.5, -2);
      ctx.lineTo(-4, -6);
      ctx.lineTo(-1.5, -2);
      ctx.moveTo(1.5, -2);
      ctx.lineTo(4, -6);
      ctx.lineTo(6.5, -2);
      ctx.stroke();
      break;
    case 'catch': // magnet
      ctx.moveTo(-5, -5);
      ctx.lineTo(-5, 1);
      ctx.arc(0, 1, 5, Math.PI, 0, true);
      ctx.lineTo(5, -5);
      ctx.stroke();
      break;
    case 'life': // heart
      ctx.fillStyle = '#dc2626';
      ctx.moveTo(0, 5);
      ctx.bezierCurveTo(-8, -1, -5, -7, 0, -3);
      ctx.bezierCurveTo(5, -7, 8, -1, 0, 5);
      ctx.fill();
      break;
  }
  ctx.restore();
}

export function drawCapsule(ctx, type, x, y, w, h, time = 0) {
  const style = POWERUP_STYLE[type];
  const t = tones(style.color);
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = t.edge;
  ctx.fill();
  roundRect(ctx, x - w / 2, y - h / 2, w, h - 2, h / 2);
  ctx.fillStyle = style.color;
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillRect(x - w / 2 + 6, y - h / 2 + 2, w - 12, 2);
  // A slow shimmer so capsules read as pick-ups, not bricks.
  const sx = x - w / 2 + ((time * 40) % (w + 20)) - 10;
  ctx.save();
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(sx, y - h / 2, 4, h);
  ctx.restore();
  drawPowerupIcon(ctx, type, x, y - 1);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const G = CONFIG.grid;
  const F = CONFIG.field;
  let L = { x: 0, y: 0, scale: 1, vw: 1, vh: 1, dpr: 1 };

  function resize(layout) {
    L = layout;
    canvas.width = Math.round(L.vw * L.dpr);
    canvas.height = Math.round(L.vh * L.dpr);
  }

  function drawBackdrop() {
    ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, L.vw, L.vh);
  }

  function drawField(time) {
    // Field floor: near-black with a faint workshop dot grid.
    ctx.fillStyle = '#0e0e11';
    ctx.fillRect(0, 0, F.w, F.h);
    ctx.fillStyle = 'rgba(250, 250, 250, 0.07)';
    for (let y = G.top - G.cellH; y < F.h; y += G.cellH) {
      for (let x = G.cellW; x < F.w; x += G.cellW) ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
    // Rails with ruler ticks: the Game Lab yellow, used sparingly.
    ctx.fillStyle = '#27272a';
    ctx.fillRect(-6, -6, 6, F.h + 6);
    ctx.fillRect(F.w, -6, 6, F.h + 6);
    ctx.fillRect(-6, -6, F.w + 12, 6);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.55)';
    for (let x = 0; x <= F.w; x += G.cellW) ctx.fillRect(x - 0.5, -6, 1, x % (G.cellW * 3) === 0 ? 6 : 3);
    for (let y = G.cellH; y < F.h; y += G.cellH) {
      const long = (y / G.cellH) % 5 === 0 ? 6 : 3;
      ctx.fillRect(-long, y - 0.5, long, 1);
      ctx.fillRect(F.w, y - 0.5, long, 1);
    }
    // The pit: a dashed red line below the paddle.
    ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
    for (let x = 0; x < F.w; x += 16) ctx.fillRect(x + 2, F.h - 2, 8, 2);
    void time;
  }

  function drawPaddle(world, time) {
    const p = world.paddle;
    const x = p.x - p.w / 2;
    const y = p.y;
    const E = world.effects;
    if (E.laser > 0) {
      for (const gx of [x + 2, x + p.w - 10]) {
        ctx.fillStyle = '#3f3f46';
        ctx.fillRect(gx, y - 6, 8, 8);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(gx + 2, y - 9, 4, 4);
      }
    }
    roundRect(ctx, x, y, p.w, p.h, 5);
    ctx.fillStyle = '#a16207';
    ctx.fill();
    roundRect(ctx, x, y, p.w, p.h - 3, 5);
    ctx.fillStyle = '#facc15';
    ctx.fill();
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x + 5, y + 1.5, p.w - 10, 2);
    // Ruler notches: centre and quarter marks show where the angle changes.
    ctx.fillStyle = '#09090b';
    ctx.fillRect(p.x - 1, y + 3, 2, 6);
    ctx.fillRect(p.x - p.w / 4 - 0.5, y + 4, 1, 4);
    ctx.fillRect(p.x + p.w / 4 - 0.5, y + 4, 1, 4);
    if (E.catch > 0) {
      const a = 0.5 + 0.3 * Math.sin(time * 8);
      ctx.fillStyle = `rgba(163, 230, 53, ${a})`;
      ctx.fillRect(x + 4, y - 3, p.w - 8, 2);
    }
  }

  function drawBalls(world, alpha) {
    const slow = world.effects.slow > 0;
    for (const b of world.balls) {
      const tr = b.trail;
      const n = tr.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const k = (i + 1) / n;
        ctx.fillStyle = slow ? `rgba(45, 212, 191, ${k * 0.35})` : `rgba(250, 204, 21, ${k * 0.35})`;
        ctx.beginPath();
        ctx.arc(tr[i * 2], tr[i * 2 + 1], CONFIG.ball.r * (0.35 + 0.6 * k), 0, Math.PI * 2);
        ctx.fill();
      }
      const x = b.stuck ? b.x : b.px + (b.x - b.px) * alpha;
      const y = b.stuck ? b.y : b.py + (b.y - b.py) * alpha;
      ctx.fillStyle = slow ? 'rgba(45, 212, 191, 0.25)' : 'rgba(250, 204, 21, 0.22)';
      ctx.beginPath();
      ctx.arc(x, y, CONFIG.ball.r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fafafa';
      ctx.beginPath();
      ctx.arc(x, y, CONFIG.ball.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAimGuide(world) {
    const ball = world.balls.find((b) => b.stuck);
    if (!ball) return;
    const p = world.paddle;
    const t = Math.max(-1, Math.min(1, ball.stuckOffset / (p.w / 2)));
    const a = (t * CONFIG.paddle.maxBounceDeg * Math.PI) / 180;
    ctx.strokeStyle = 'rgba(250, 250, 250, 0.35)';
    ctx.setLineDash([3, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ball.x, ball.y);
    ctx.lineTo(ball.x + Math.sin(a) * 70, ball.y - Math.cos(a) * 70);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function draw(world, fx, alpha, time, { aim = true } = {}) {
    drawBackdrop();
    if (!world) return;
    const [sx, sy] = fx.offset();
    const s = L.scale * L.dpr;
    ctx.setTransform(s, 0, 0, s, (L.x + sx) * L.dpr, (L.y + sy) * L.dpr);
    drawField(time);

    for (const b of world.bricks) if (b.alive) drawBrick(ctx, b, b.x, b.y, b.w, b.h, time);

    const P = CONFIG.powerups;
    for (const c of world.capsules) drawCapsule(ctx, c.type, c.x, c.y, P.w, P.h, time + c.x);

    ctx.fillStyle = '#fca5a5';
    for (const bolt of world.bolts) ctx.fillRect(bolt.x - CONFIG.laser.w / 2, bolt.y - CONFIG.laser.h, CONFIG.laser.w, CONFIG.laser.h);

    if (aim) drawAimGuide(world);
    drawPaddle(world, time);
    drawBalls(world, alpha);

    for (const r of fx.rings) {
      ctx.strokeStyle = r.color ? `rgba(250,250,250,${r.life * 1.6})` : `rgba(250, 204, 21, ${r.life * 2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.min(1, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.font = '800 13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const t of fx.texts) {
      ctx.globalAlpha = Math.min(1, t.life / 0.3);
      ctx.fillStyle = '#09090b';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.hot ? '#facc15' : '#fafafa';
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(250, 250, 250, ${fx.flash * 0.35})`;
      ctx.fillRect(-10, -10, F.w + 20, F.h + 20);
    }
  }

  return { resize, draw, ctx };
}
