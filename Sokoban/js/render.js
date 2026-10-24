/**
 * Canvas renderer. Three passes per frame:
 *   1. floor layer (cached): tiles and goal pads
 *   2. dynamic: shadows, crates, the bot, effects
 *   3. wall layer (cached): walls are drawn last and lean toward the viewer,
 *      so their lifted tops overlap whatever stands in the row above.
 */

const C = {
  floor: '#141418',
  floorLine: '#0b0b0d',
  floorMark: '#26262f',
  wallTop: '#24242c',
  wallHatch: 'rgba(255,255,255,0.025)',
  wallEdge: '#3d3d49',
  wallFront: '#111115',
  wallFrontLine: '#1b1b21',
  accent: '#facc15',
  crateA: '#c07a33',
  crateB: '#8f5523',
  crateEdge: '#5c3413',
  brace: '#6a3b15',
  cap: '#e9dcc3',
  goalA: '#fde047',
  goalB: '#d9a406',
  ink: '#09090b',
  bot: '#ececf0',
  botShade: '#a1a1aa',
  danger: 'rgba(248,113,113,0.55)',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const floorLayer = document.createElement('canvas');
  const wallLayer = document.createElement('canvas');
  let puzzle = null;
  let tile = 32;
  let lift = 6;
  let ox = 0;
  let oy = 0;
  let dpr = 1;
  let cssW = 0;
  let cssH = 0;

  function setPuzzle(p) {
    puzzle = p;
    layout();
  }

  function resize(w, h) {
    cssW = Math.max(1, Math.floor(w));
    cssH = Math.max(1, Math.floor(h));
    dpr = Math.min(window.devicePixelRatio || 1, 2); // 2x looks the same on phones and paints far fewer pixels
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    layout();
  }

  function layout() {
    if (!puzzle || !cssW) return;
    const liftRatio = 0.12; // small enough that pads and crates under a wall stay readable
    tile = Math.floor(Math.min(cssW / puzzle.w, cssH / (puzzle.h + liftRatio), 72));
    tile = Math.max(tile, 8);
    lift = Math.round(tile * liftRatio);
    ox = Math.round((cssW - tile * puzzle.w) / 2);
    oy = Math.round((cssH - tile * puzzle.h + lift) / 2);
    buildLayers();
  }

  function buildLayers() {
    for (const layer of [floorLayer, wallLayer]) {
      layer.width = canvas.width;
      layer.height = canvas.height;
    }
    const f = floorLayer.getContext('2d');
    f.setTransform(dpr, 0, 0, dpr, 0, 0);
    f.clearRect(0, 0, cssW, cssH);
    const w = wallLayer.getContext('2d');
    w.setTransform(dpr, 0, 0, dpr, 0, 0);
    w.clearRect(0, 0, cssW, cssH);
    const { w: cols, h: rows } = puzzle;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (puzzle.floor[i]) drawFloor(f, x, y, i);
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        if (puzzle.wall[i] && touchesFloor(x, y)) drawWall(w, x, y);
      }
    }
  }

  // Walls within two cells of the floor are drawn, so notches in the outline stay filled.
  function touchesFloor(x, y) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const j = puzzle.index(x + dx, y + dy);
        if (j >= 0 && puzzle.floor[j]) return true;
      }
    }
    return false;
  }

  function isWall(x, y) {
    const j = puzzle.index(x, y);
    return j >= 0 && puzzle.wall[j] && touchesFloor(x, y);
  }

  function drawFloor(g, x, y, i) {
    const px = ox + x * tile;
    const py = oy + y * tile;
    g.fillStyle = C.floorLine;
    g.fillRect(px, py, tile, tile);
    g.fillStyle = C.floor;
    g.fillRect(px + 1, py + 1, tile - 2, tile - 2);
    // Survey ticks in the corners: a quiet lab-floor texture.
    g.strokeStyle = C.floorMark;
    g.lineWidth = 1;
    const m = Math.max(2, tile * 0.1);
    g.beginPath();
    g.moveTo(px + 2, py + 2 + m);
    g.lineTo(px + 2, py + 2);
    g.lineTo(px + 2 + m, py + 2);
    g.stroke();
    if (puzzle.goal[i]) drawPad(g, px, py);
  }

  function drawPad(g, px, py) {
    const inset = tile * 0.16;
    const s = tile - inset * 2;
    g.fillStyle = 'rgba(250,204,21,0.07)';
    g.fillRect(px + inset, py + inset, s, s);
    g.strokeStyle = C.accent;
    g.lineWidth = Math.max(1.5, tile * 0.055);
    g.lineCap = 'square';
    const b = s * 0.28;
    const corners = [
      [px + inset, py + inset, 1, 1],
      [px + tile - inset, py + inset, -1, 1],
      [px + inset, py + tile - inset, 1, -1],
      [px + tile - inset, py + tile - inset, -1, -1],
    ];
    g.beginPath();
    for (const [cx, cy, sx, sy] of corners) {
      g.moveTo(cx, cy + b * sy);
      g.lineTo(cx, cy);
      g.lineTo(cx + b * sx, cy);
    }
    g.stroke();
    // Centre diamond.
    const cx = px + tile / 2;
    const cy = py + tile / 2;
    const d = tile * 0.09;
    g.fillStyle = 'rgba(250,204,21,0.55)';
    g.beginPath();
    g.moveTo(cx, cy - d);
    g.lineTo(cx + d, cy);
    g.lineTo(cx, cy + d);
    g.lineTo(cx - d, cy);
    g.closePath();
    g.fill();
  }

  function drawWall(g, x, y) {
    const px = ox + x * tile;
    const py = oy + y * tile;
    const below = isWall(x, y + 1);
    const top = py - lift;
    // Top face covers the cell shifted up by `lift`; front face shows where the cell below is open.
    g.fillStyle = C.wallTop;
    g.fillRect(px, top, tile, tile);
    // Diagonal hatch, clipped to the top face.
    g.save();
    g.beginPath();
    g.rect(px, top, tile, tile);
    g.clip();
    g.strokeStyle = C.wallHatch;
    g.lineWidth = Math.max(1, tile * 0.05);
    for (let k = -tile; k < tile * 2; k += tile * 0.25) {
      g.beginPath();
      g.moveTo(px + k, top);
      g.lineTo(px + k - tile, top + tile);
      g.stroke();
    }
    g.restore();
    // Edges where the wall meets open space.
    g.fillStyle = C.wallEdge;
    const e = Math.max(1, Math.round(tile * 0.05));
    if (!isWall(x, y - 1)) g.fillRect(px, top, tile, e);
    if (!isWall(x - 1, y)) g.fillRect(px, top, e, tile);
    if (!isWall(x + 1, y)) g.fillRect(px + tile - e, top, e, tile);
    if (!below) {
      g.fillStyle = C.wallFront;
      g.fillRect(px, top + tile, tile, lift);
      g.fillStyle = C.wallFrontLine;
      g.fillRect(px, top + tile, tile, Math.max(1, lift * 0.18));
      // Hazard trim along the foot of walls that face the floor (not the void outside).
      const j = puzzle.index(x, y + 1);
      if (j < 0 || !puzzle.floor[j]) return;
      const stripeH = Math.max(2, Math.round(lift * 0.5));
      const sy = top + tile + lift - stripeH;
      g.save();
      g.beginPath();
      g.rect(px, sy, tile, stripeH);
      g.clip();
      g.fillStyle = 'rgba(250,204,21,0.5)';
      g.fillRect(px, sy, tile, stripeH);
      g.fillStyle = C.wallFront;
      const sw = Math.max(3, tile / 6);
      for (let k = -sw * 2; k < tile + sw * 2; k += sw * 2) {
        g.beginPath();
        g.moveTo(px + k, sy + stripeH);
        g.lineTo(px + k + sw, sy + stripeH);
        g.lineTo(px + k + sw * 2, sy);
        g.lineTo(px + k + sw, sy);
        g.closePath();
        g.fill();
      }
      g.restore();
    }
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function drawCrate(g, fx, fy, { onGoal, stuck, pulse = 0, glow = 0 }) {
    const inset = tile * 0.09;
    const s = tile - inset * 2;
    const grow = 1 + pulse * 0.08;
    const cx = ox + (fx + 0.5) * tile;
    const cy = oy + (fy + 0.5) * tile;
    g.save();
    g.translate(cx, cy);
    g.scale(grow, grow);
    const x = -s / 2;
    const y = -s / 2;
    const r = tile * 0.1;
    // Shadow.
    g.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(g, x + tile * 0.04, y + tile * 0.07, s, s, r);
    g.fill();
    if (onGoal && glow > 0) {
      g.shadowColor = 'rgba(250,204,21,0.75)';
      g.shadowBlur = tile * 0.35 * glow;
    }
    const grad = g.createLinearGradient(0, y, 0, y + s);
    grad.addColorStop(0, onGoal ? C.goalA : C.crateA);
    grad.addColorStop(1, onGoal ? C.goalB : C.crateB);
    g.fillStyle = grad;
    roundRect(g, x, y, s, s, r);
    g.fill();
    g.shadowBlur = 0;
    g.lineWidth = Math.max(1, tile * 0.04);
    g.strokeStyle = onGoal ? '#7a5a00' : C.crateEdge;
    g.stroke();
    // Inner frame.
    const f = s * 0.14;
    g.strokeStyle = onGoal ? 'rgba(9,9,11,0.35)' : 'rgba(60,30,8,0.55)';
    g.lineWidth = Math.max(1, tile * 0.035);
    g.strokeRect(x + f, y + f, s - f * 2, s - f * 2);
    if (onGoal) {
      // A stamped check mark: crates at home read by shape, not only by colour.
      g.strokeStyle = C.ink;
      g.lineWidth = Math.max(2, tile * 0.1);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(x + s * 0.28, y + s * 0.53);
      g.lineTo(x + s * 0.44, y + s * 0.68);
      g.lineTo(x + s * 0.73, y + s * 0.34);
      g.stroke();
    } else {
      // Cross brace and planks.
      g.strokeStyle = C.brace;
      g.lineWidth = Math.max(1.5, tile * 0.07);
      g.lineCap = 'butt';
      g.beginPath();
      g.moveTo(x + f, y + f);
      g.lineTo(x + s - f, y + s - f);
      g.moveTo(x + s - f, y + f);
      g.lineTo(x + f, y + s - f);
      g.stroke();
    }
    // Corner caps.
    g.fillStyle = onGoal ? C.ink : C.cap;
    const cap = Math.max(2, s * 0.13);
    for (const [ax, ay] of [[x, y], [x + s - cap, y], [x, y + s - cap], [x + s - cap, y + s - cap]]) {
      g.fillRect(ax + 1, ay + 1, cap - 1, cap - 1);
    }
    if (stuck) {
      // Warning hatch: red stripes over the crate (pattern, not just a tint).
      g.save();
      roundRect(g, x, y, s, s, r);
      g.clip();
      g.strokeStyle = C.danger;
      g.lineWidth = Math.max(2, tile * 0.08);
      for (let k = -s; k < s * 2; k += tile * 0.24) {
        g.beginPath();
        g.moveTo(x + k, y);
        g.lineTo(x + k - s, y + s);
        g.stroke();
      }
      g.restore();
      g.strokeStyle = 'rgba(248,113,113,0.9)';
      g.lineWidth = Math.max(1.5, tile * 0.05);
      roundRect(g, x, y, s, s, r);
      g.stroke();
    }
    g.restore();
  }

  const FACE = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

  function drawBot(g, fx, fy, facing, squash = 0, blink = false) {
    const cx = ox + (fx + 0.5) * tile;
    const cy = oy + (fy + 0.5) * tile;
    const [dx, dy] = FACE[facing] ?? FACE.down;
    const r = tile * 0.33;
    g.save();
    g.translate(cx, cy);
    // Shadow.
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.ellipse(tile * 0.03, tile * 0.08, r * 1.02, r * 0.9, 0, 0, Math.PI * 2);
    g.fill();
    // Squash along the facing axis while pushing.
    const sx = 1 - squash * 0.12 * Math.abs(dx) + squash * 0.06 * Math.abs(dy);
    const sy = 1 - squash * 0.12 * Math.abs(dy) + squash * 0.06 * Math.abs(dx);
    g.scale(sx, sy);
    // Treads on the sides perpendicular to facing.
    g.fillStyle = '#3f3f46';
    const tw = r * 0.42;
    const tl = r * 1.4;
    if (dx) {
      g.fillRect(-tl / 2, -r - tw * 0.35, tl, tw);
      g.fillRect(-tl / 2, r - tw * 0.65, tl, tw);
    } else {
      g.fillRect(-r - tw * 0.35, -tl / 2, tw, tl);
      g.fillRect(r - tw * 0.65, -tl / 2, tw, tl);
    }
    const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, C.botShade);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fill();
    g.lineWidth = Math.max(1, tile * 0.035);
    g.strokeStyle = '#52525b';
    g.stroke();
    // Visor towards the facing direction.
    g.fillStyle = C.ink;
    g.beginPath();
    const ang = Math.atan2(dy, dx);
    g.arc(0, 0, r * 0.72, ang - 0.95, ang + 0.95);
    g.arc(0, 0, r * 0.18, ang + 0.95, ang - 0.95, true);
    g.closePath();
    g.fill();
    // Eye.
    g.fillStyle = C.accent;
    g.shadowColor = 'rgba(250,204,21,0.8)';
    g.shadowBlur = tile * 0.15;
    const ex = dx * r * 0.45;
    const ey = dy * r * 0.45;
    if (blink) g.fillRect(ex - r * 0.16, ey - r * 0.03, r * 0.32, r * 0.06);
    else {
      g.beginPath();
      g.arc(ex, ey, r * 0.15, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function drawPathDots(g, cells, color = 'rgba(250,204,21,0.55)') {
    g.fillStyle = color;
    for (const [x, y] of cells) {
      g.beginPath();
      g.arc(ox + (x + 0.5) * tile, oy + (y + 0.5) * tile, Math.max(1.5, tile * 0.06), 0, Math.PI * 2);
      g.fill();
    }
  }

  function drawTarget(g, x, y, color) {
    const px = ox + x * tile;
    const py = oy + y * tile;
    g.strokeStyle = color;
    g.lineWidth = Math.max(1.5, tile * 0.05);
    g.setLineDash([tile * 0.12, tile * 0.08]);
    g.strokeRect(px + tile * 0.12, py + tile * 0.12, tile * 0.76, tile * 0.76);
    g.setLineDash([]);
  }

  function drawArrow(g, from, to, color) {
    const ax = ox + (from[0] + 0.5) * tile;
    const ay = oy + (from[1] + 0.5) * tile;
    const bx = ox + (to[0] + 0.5) * tile;
    const by = oy + (to[1] + 0.5) * tile;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = Math.max(2, tile * 0.08);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
    const ang = Math.atan2(by - ay, bx - ax);
    const h = tile * 0.24;
    g.beginPath();
    g.moveTo(bx + Math.cos(ang) * h * 0.6, by + Math.sin(ang) * h * 0.6);
    g.lineTo(bx + Math.cos(ang + 2.4) * h, by + Math.sin(ang + 2.4) * h);
    g.lineTo(bx + Math.cos(ang - 2.4) * h, by + Math.sin(ang - 2.4) * h);
    g.closePath();
    g.fill();
  }

  /**
   * @param {object} v  view model from main.js
   */
  function draw(v) {
    if (!puzzle) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(floorLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (v.hoverPath) drawPathDots(ctx, v.hoverPath);
    if (v.drag) {
      const col = v.drag.ok ? 'rgba(250,204,21,0.9)' : 'rgba(248,113,113,0.9)';
      if (v.drag.walk) drawPathDots(ctx, v.drag.walk, 'rgba(250,204,21,0.35)');
      drawArrow(ctx, v.drag.from, v.drag.to, col);
      drawTarget(ctx, v.drag.to[0], v.drag.to[1], col);
    }
    for (const r of v.rings) {
      const t = r.t;
      ctx.strokeStyle = `rgba(250,204,21,${(1 - t) * 0.9})`;
      ctx.lineWidth = Math.max(1.5, tile * 0.06 * (1 - t));
      const sz = tile * (0.7 + t * 0.9);
      ctx.strokeRect(ox + (r.x + 0.5) * tile - sz / 2, oy + (r.y + 0.5) * tile - sz / 2, sz, sz);
    }

    // Crates and bot, back to front.
    const items = v.boxes.map((b) => ({ y: b.y, draw: () => drawCrate(ctx, b.x, b.y, b) }));
    items.push({ y: v.player.y + 0.01, draw: () => drawBot(ctx, v.player.x, v.player.y, v.player.facing, v.player.squash, v.player.blink) });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(wallLayer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (v.sweep != null) {
      // Level-complete light sweep across the board.
      const bw = tile * puzzle.w;
      const bh = tile * puzzle.h;
      const x = ox - bw * 0.4 + v.sweep * bw * 1.8;
      const grad = ctx.createLinearGradient(x - tile * 2, 0, x + tile * 2, 0);
      grad.addColorStop(0, 'rgba(250,204,21,0)');
      grad.addColorStop(0.5, 'rgba(250,204,21,0.16)');
      grad.addColorStop(1, 'rgba(250,204,21,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(ox, oy - lift, bw, bh + lift);
    }
  }

  /** Board cell under a client point, or null. */
  function cellAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - ox) / tile);
    const y = Math.floor((clientY - rect.top - oy) / tile);
    if (!puzzle || x < 0 || y < 0 || x >= puzzle.w || y >= puzzle.h) return null;
    return { x, y };
  }

  return {
    setPuzzle,
    resize,
    draw,
    cellAt,
    get tile() {
      return tile;
    },
  };
}
