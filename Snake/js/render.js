/**
 * Canvas renderer. Crisp at any devicePixelRatio; the static board (lattice,
 * hatched walls, edges) is cached and only redrawn when the size or board changes.
 */
import { DIRS } from './game.js';

export const PALETTE = {
  ink: '#09090b',
  board: '#0d0d11',
  dot: '#2a2a31',
  major: '#3a3a42',
  wall: '#17171c',
  wallEdge: '#52525b',
  hatch: 'rgba(250, 204, 21, 0.13)',
  head: [250, 204, 21],
  tail: [161, 98, 7],
  deadHead: [161, 161, 170],
  deadTail: [63, 63, 70],
  food: '#fb7185',
  golden: '#fde047',
  fast: '#22d3ee',
  slow: '#a78bfa',
  danger: '#f43f5e',
};
export const PORTAL_COLORS = ['#22d3ee', '#f472b6', '#a3e635', '#fb923c'];

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => `rgb(${lerp(c1[0], c2[0], t) | 0}, ${lerp(c1[1], c2[1], t) | 0}, ${lerp(c1[2], c2[2], t) | 0})`;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const layer = document.createElement('canvas');
  const lctx = layer.getContext('2d');
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;
  let board = null;
  let cell = 1;

  function resize(w, h) {
    dpr = Math.min(2, window.devicePixelRatio || 1); // 2x looks the same on phones and paints far fewer pixels
    cssW = w;
    cssH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    buildStatic();
  }

  function setBoard(b) {
    if (b === board) return;
    board = b;
    buildStatic();
  }

  function buildStatic() {
    if (!board || !cssW) return;
    cell = cssW / board.w;
    layer.width = canvas.width;
    layer.height = canvas.height;
    const g = lctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = PALETTE.board;
    g.fillRect(0, 0, cssW, cssH);

    // Engineering-paper lattice: a dot at every crossing, a small cross every fifth.
    const { w, h, walls } = board;
    for (let y = 1; y < h; y++) {
      for (let x = 1; x < w; x++) {
        const major = x % 5 === 0 && y % 5 === 0;
        g.fillStyle = major ? PALETTE.major : PALETTE.dot;
        const px = x * cell;
        const py = y * cell;
        if (major) {
          g.fillRect(px - 3, py - 0.5, 6, 1);
          g.fillRect(px - 0.5, py - 3, 1, 6);
        } else g.fillRect(px - 0.75, py - 0.75, 1.5, 1.5);
      }
    }

    // Walls: one clipped region with continuous diagonal hatching, then a crisp outline.
    g.save();
    g.beginPath();
    for (let i = 0; i < w * h; i++) if (walls[i]) g.rect((i % w) * cell, Math.floor(i / w) * cell, cell, cell);
    g.fillStyle = PALETTE.wall;
    g.fill();
    g.clip();
    g.strokeStyle = PALETTE.hatch;
    g.lineWidth = Math.max(1, cell * 0.08);
    const step = Math.max(4, cell * 0.32);
    g.beginPath();
    for (let d = -cssH; d < cssW + cssH; d += step) {
      g.moveTo(d, 0);
      g.lineTo(d + cssH, cssH);
    }
    g.stroke();
    g.restore();

    g.strokeStyle = PALETTE.wallEdge;
    g.lineWidth = 1;
    g.beginPath();
    const isWall = (x, y) => x >= 0 && y >= 0 && x < w && y < h && walls[y * w + x];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!walls[y * w + x]) continue;
        const px = x * cell;
        const py = y * cell;
        if (!isWall(x, y - 1)) { g.moveTo(px, py + 0.5); g.lineTo(px + cell, py + 0.5); }
        if (!isWall(x, y + 1)) { g.moveTo(px, py + cell - 0.5); g.lineTo(px + cell, py + cell - 0.5); }
        if (!isWall(x - 1, y)) { g.moveTo(px + 0.5, py); g.lineTo(px + 0.5, py + cell); }
        if (!isWall(x + 1, y)) { g.moveTo(px + cell - 0.5, py); g.lineTo(px + cell - 0.5, py + cell); }
      }
    }
    g.stroke();

    // Edges: solid where they kill, dashed only where an open cell wraps across.
    g.lineWidth = 2;
    if (board.wrap) {
      g.strokeStyle = 'rgba(250, 204, 21, 0.4)';
      g.beginPath();
      const dash = (x0, y0, x1, y1) => {
        // Short centred dash per open edge cell.
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const hx = (x1 - x0) * 0.2;
        const hy = (y1 - y0) * 0.2;
        g.moveTo(mx - hx, my - hy);
        g.lineTo(mx + hx, my + hy);
      };
      for (let x = 0; x < w; x++) {
        if (!walls[x]) dash(x * cell, 1, (x + 1) * cell, 1);
        if (!walls[(h - 1) * w + x]) dash(x * cell, cssH - 1, (x + 1) * cell, cssH - 1);
      }
      for (let y = 0; y < h; y++) {
        if (!walls[y * w]) dash(1, y * cell, 1, (y + 1) * cell);
        if (!walls[y * w + w - 1]) dash(cssW - 1, y * cell, cssW - 1, (y + 1) * cell);
      }
      g.stroke();
    } else {
      g.strokeStyle = 'rgba(250, 204, 21, 0.55)';
      g.strokeRect(1, 1, cssW - 2, cssH - 2);
    }
    if (!board.wrap) {
      // Corner ticks give the hard edge a frame.
      g.strokeStyle = '#facc15';
      g.lineWidth = 3;
      const k = cell * 0.9;
      g.beginPath();
      for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [cssW, 0, -1, 1], [0, cssH, 1, -1], [cssW, cssH, -1, -1]]) {
        g.moveTo(cx + sx * 1.5, cy + sy * k);
        g.lineTo(cx + sx * 1.5, cy + sy * 1.5);
        g.lineTo(cx + sx * k, cy + sy * 1.5);
      }
      g.stroke();
    }
  }

  const cx = (i) => ((i % board.w) + 0.5) * cell;
  const cy = (i) => (Math.floor(i / board.w) + 0.5) * cell;

  /** Interpolated centre of each segment in pixels; `jump` marks a teleport mid-flight. */
  function segmentPoints(snake, prev, dirs, t) {
    const pts = new Array(snake.length);
    for (let i = 0; i < snake.length; i++) {
      const to = snake[i];
      const from = prev[i] ?? prev[prev.length - 1] ?? to;
      const tx = cx(to);
      const ty = cy(to);
      if (from === to) {
        pts[i] = { x: tx, y: ty };
        continue;
      }
      const fx = cx(from);
      const fy = cy(from);
      if (Math.abs(tx - fx) + Math.abs(ty - fy) < cell * 1.01) {
        pts[i] = { x: lerp(fx, tx, t), y: lerp(fy, ty, t) };
      } else {
        // Through a wrap edge or a portal: slide out of the old cell, then into the new one.
        const d = DIRS[dirs[i]] ?? [0, 0];
        pts[i] = t < 0.5 ? { x: fx + d[0] * cell * t, y: fy + d[1] * cell * t, jump: true } : { x: tx - d[0] * cell * (1 - t), y: ty - d[1] * cell * (1 - t), jump: true };
      }
    }
    return pts;
  }

  function drawFood(i, time, reduced) {
    const x = cx(i);
    const y = cy(i);
    const pulse = reduced ? 1 : 1 + Math.sin(time * 6) * 0.07;
    const r = cell * 0.24 * pulse;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = 'rgba(251, 113, 133, 0.55)';
    ctx.shadowBlur = cell * 0.4;
    ctx.fillStyle = PALETTE.food;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.25);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r * 1.25);
    ctx.lineTo(-r, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillRect(-r * 0.25, -r * 0.7, r * 0.3, r * 0.3);
    // Reticle brackets.
    const b = cell * 0.44;
    const k = cell * 0.14;
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.65)';
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.beginPath();
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.moveTo(sx * b, sy * (b - k));
      ctx.lineTo(sx * b, sy * b);
      ctx.lineTo(sx * (b - k), sy * b);
    }
    ctx.stroke();
    ctx.restore();
  }

  function lifeRing(x, y, frac, color, blink) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = blink ? 0.35 : 0.9;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.47, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawGolden(g, time, reduced) {
    const x = cx(g.cell);
    const y = cy(g.cell);
    const frac = g.life / g.maxLife;
    const blink = frac < 0.3 && !reduced && Math.floor(time * 8) % 2 === 0;
    ctx.save();
    ctx.translate(x, y);
    if (!reduced) ctx.rotate(time * 1.2);
    ctx.shadowColor = 'rgba(250, 204, 21, 0.8)';
    ctx.shadowBlur = cell * 0.6;
    ctx.fillStyle = PALETTE.golden;
    const R = cell * 0.36;
    const r = cell * 0.12;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const rad = k % 2 ? r : R;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    lifeRing(x, y, frac, '#facc15', blink);
  }

  function drawPower(p, time, reduced) {
    const x = cx(p.cell);
    const y = cy(p.cell);
    const color = p.kind === 'fast' ? PALETTE.fast : PALETTE.slow;
    const bob = reduced ? 0 : Math.sin(time * 4) * cell * 0.04;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = cell * 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = PALETTE.ink;
    ctx.fillStyle = PALETTE.ink;
    ctx.lineWidth = Math.max(1.5, cell * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const u = cell * 0.1;
    ctx.beginPath();
    if (p.kind === 'fast') {
      // Double chevron.
      ctx.moveTo(-u * 1.4, -u);
      ctx.lineTo(-u * 0.4, 0);
      ctx.lineTo(-u * 1.4, u);
      ctx.moveTo(u * 0.2, -u);
      ctx.lineTo(u * 1.2, 0);
      ctx.lineTo(u * 0.2, u);
      ctx.stroke();
    } else {
      // Hourglass.
      ctx.moveTo(-u, -u * 1.3);
      ctx.lineTo(u, -u * 1.3);
      ctx.lineTo(-u, u * 1.3);
      ctx.lineTo(u, u * 1.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    lifeRing(x, y, p.life / p.maxLife, color, p.life < 120 && !reduced && Math.floor(time * 8) % 2 === 0);
  }

  function drawPortals(time, reduced) {
    for (const pair of board.portalPairs) {
      const color = PORTAL_COLORS[(pair.id - 1) % PORTAL_COLORS.length];
      for (const c of [pair.a, pair.b]) {
        const x = cx(c);
        const y = cy(c);
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#050507';
        ctx.beginPath();
        ctx.arc(0, 0, cell * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1.5, cell * 0.08);
        ctx.setLineDash([cell * 0.22, cell * 0.12]);
        ctx.rotate(reduced ? 0 : time * 2);
        ctx.beginPath();
        ctx.arc(0, 0, cell * 0.38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.rotate(reduced ? 0 : -time * 3.4);
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = Math.max(1, cell * 0.05);
        ctx.beginPath();
        ctx.arc(0, 0, cell * 0.2, 0, Math.PI * 1.3);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  function drawSnake(scene) {
    const { snake, prev, dirs, t, dead, lookAt, time, reduced, bulges } = scene;
    const pts = segmentPoints(snake, prev, dirs, t);
    const n = pts.length;
    const headC = dead ? PALETTE.deadHead : PALETTE.head;
    const tailC = dead ? PALETTE.deadTail : PALETTE.tail;
    // Full width along the body, tapering over the last few segments into the tail.
    const taper = Math.min(5, n - 1);
    const width = (i) => cell * (i <= n - 1 - taper ? 0.7 : lerp(0.7, 0.4, (i - (n - 1 - taper)) / Math.max(1, taper)));
    const linked = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < cell * 1.2;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Shadow pass.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    for (let i = n - 1; i > 0; i--) {
      if (!linked(pts[i], pts[i - 1])) continue;
      ctx.lineWidth = width(i) + 2;
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y + cell * 0.1);
      ctx.lineTo(pts[i - 1].x, pts[i - 1].y + cell * 0.1);
      ctx.stroke();
    }
    // Body, tail to head, colour and width tapering.
    for (let i = n - 1; i > 0; i--) {
      const a = pts[i];
      const b = pts[i - 1];
      const k = n > 1 ? i / (n - 1) : 0;
      ctx.strokeStyle = mix(headC, tailC, k);
      ctx.lineWidth = width(i);
      ctx.beginPath();
      if (linked(a, b)) {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x + 0.01, a.y);
      }
      ctx.stroke();
    }
    // Swallowed food travelling down the body.
    for (const bulge of bulges) {
      const pos = bulge.seg + t;
      const i = Math.floor(pos);
      if (i >= n - 1) continue;
      const f = pos - i;
      const x = lerp(pts[i].x, pts[i + 1].x, f);
      const y = lerp(pts[i].y, pts[i + 1].y, f);
      ctx.fillStyle = mix(headC, tailC, i / Math.max(1, n - 1));
      ctx.beginPath();
      ctx.arc(x, y, width(i) * 0.66, 0, Math.PI * 2);
      ctx.fill();
    }
    // Scale marks: small obsidian chevrons along the spine.
    ctx.fillStyle = 'rgba(9, 9, 11, 0.42)';
    for (let i = 2; i < n; i += 2) {
      const a = pts[i];
      const b = pts[i - 1];
      if (!linked(a, b)) continue;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const s = width(i) * 0.22;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(s, 0);
      ctx.lineTo(-s * 0.6, -s);
      ctx.lineTo(-s * 0.1, 0);
      ctx.lineTo(-s * 0.6, s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Head.
    const h = pts[0];
    const d = DIRS[dirs[0]] ?? [1, 0];
    const ang = Math.atan2(d[1], d[0]);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    const scale = scene.chomp ? 1 + scene.chomp * 0.18 : 1;
    ctx.scale(scale, scale);
    const hr = cell * 0.42;
    ctx.fillStyle = mix(headC, headC, 0);
    if (!dead && !reduced) {
      ctx.shadowColor = 'rgba(250, 204, 21, 0.45)';
      ctx.shadowBlur = cell * 0.5;
    }
    ctx.beginPath();
    ctx.ellipse(hr * 0.12, 0, hr * 1.08, hr * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Tongue flick.
    if (!dead && !reduced && time % 2.6 < 0.16) {
      ctx.strokeStyle = PALETTE.danger;
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.beginPath();
      ctx.moveTo(hr * 1.05, 0);
      ctx.lineTo(hr * 1.6, 0);
      ctx.lineTo(hr * 1.85, -hr * 0.18);
      ctx.moveTo(hr * 1.6, 0);
      ctx.lineTo(hr * 1.85, hr * 0.18);
      ctx.stroke();
    }
    // Eyes look toward the food.
    let lx = 0;
    let ly = 0;
    if (lookAt !== undefined && lookAt >= 0) {
      const dx = cx(lookAt) - h.x;
      const dy = cy(lookAt) - h.y;
      const len = Math.hypot(dx, dy) || 1;
      // Into the head's rotated frame.
      lx = (dx * Math.cos(-ang) - dy * Math.sin(-ang)) / len;
      ly = (dx * Math.sin(-ang) + dy * Math.cos(-ang)) / len;
    }
    for (const side of [-1, 1]) {
      const ex = hr * 0.25;
      const ey = side * hr * 0.5;
      if (dead) {
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = Math.max(1.5, cell * 0.06);
        const k = cell * 0.08;
        ctx.beginPath();
        ctx.moveTo(ex - k, ey - k);
        ctx.lineTo(ex + k, ey + k);
        ctx.moveTo(ex + k, ey - k);
        ctx.lineTo(ex - k, ey + k);
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.ink;
        ctx.beginPath();
        ctx.arc(ex, ey, cell * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fefce8';
        ctx.beginPath();
        ctx.arc(ex + lx * cell * 0.04, ey + ly * cell * 0.04, cell * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return pts;
  }

  function drawDeath(death, time, reduced) {
    const { w, h } = board;
    const pulse = reduced ? 1 : 0.6 + 0.4 * Math.abs(Math.sin(time * 5));
    ctx.save();
    ctx.strokeStyle = PALETTE.danger;
    ctx.fillStyle = PALETTE.danger;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.shadowColor = PALETTE.danger;
    ctx.shadowBlur = cell * 0.6;
    const x = Math.min(w - 1, Math.max(0, death.x));
    const y = Math.min(h - 1, Math.max(0, death.y));
    if (death.cause === 'edge') {
      // Light up the stretch of edge that was hit.
      ctx.beginPath();
      if (death.x < 0) { ctx.moveTo(2, (y - 0.5) * cell); ctx.lineTo(2, (y + 1.5) * cell); }
      else if (death.x >= w) { ctx.moveTo(cssW - 2, (y - 0.5) * cell); ctx.lineTo(cssW - 2, (y + 1.5) * cell); }
      else if (death.y < 0) { ctx.moveTo((x - 0.5) * cell, 2); ctx.lineTo((x + 1.5) * cell, 2); }
      else { ctx.moveTo((x - 0.5) * cell, cssH - 2); ctx.lineTo((x + 1.5) * cell, cssH - 2); }
      ctx.stroke();
    } else if (death.cause === 'wall') {
      ctx.strokeRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      ctx.globalAlpha = pulse * 0.25;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    } else {
      ctx.beginPath();
      ctx.arc((x + 0.5) * cell, (y + 0.5) * cell, cell * 0.62, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEffects(fx) {
    for (const r of fx.rings) {
      const k = r.age / r.life;
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = Math.max(1, cell * 0.1 * (1 - k));
      ctx.beginPath();
      ctx.arc(r.x * cell, r.y * cell, cell * (0.3 + k * r.size), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const p of fx.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      const s = cell * p.size;
      ctx.fillRect(p.x * cell - s / 2, p.y * cell - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.font = `800 ${Math.max(11, cell * 0.5)}px "Martian Mono", ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of fx.popups) {
      const k = t.age / t.life;
      ctx.globalAlpha = 1 - k * k;
      ctx.fillStyle = PALETTE.ink;
      const y = (t.y - k * 0.9) * cell;
      ctx.fillText(t.text, t.x * cell + 1, y + 1.5);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x * cell, y);
    }
    ctx.globalAlpha = 1;
  }

  /** Draw one frame. `scene` carries the snake, items and effects to show. */
  function draw(scene) {
    if (!board) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    if (scene.shake) ctx.translate(scene.shake.x, scene.shake.y);
    ctx.drawImage(layer, 0, 0, cssW, cssH);
    drawPortals(scene.time, scene.reduced);
    if (scene.food >= 0) drawFood(scene.food, scene.time, scene.reduced);
    if (scene.golden) drawGolden(scene.golden, scene.time, scene.reduced);
    if (scene.power) drawPower(scene.power, scene.time, scene.reduced);
    drawSnake(scene);
    if (scene.effects) drawEffects(scene.effects);
    if (scene.death) drawDeath(scene.death, scene.time, scene.reduced);
    ctx.restore();
  }

  return {
    resize,
    setBoard,
    draw,
    get cell() {
      return cell;
    },
  };
}
