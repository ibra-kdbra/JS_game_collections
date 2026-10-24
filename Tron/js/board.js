export const EMPTY = 0;
export const WALL = 3;

// Cells per side and base speed (cells per second) for each arena size.
export const ARENAS = {
  small: { long: 60, short: 42, speed: 15 },
  medium: { long: 80, short: 56, speed: 18 },
  large: { long: 100, short: 70, speed: 22 },
};

// Obstacle layouts in arena-relative units: u runs along the line between the
// two start points, v across it. Every rect is [u0, v0, u1, v1] in 0..1.
// The start lane (v = 0.5) is kept clear near both start points.
export const LAYOUTS = {
  open: [],
  pillars: [
    [0.28, 0.2, 0.34, 0.3],
    [0.66, 0.2, 0.72, 0.3],
    [0.28, 0.7, 0.34, 0.8],
    [0.66, 0.7, 0.72, 0.8],
  ],
  gates: [
    [0.495, 0, 0.505, 0.36],
    [0.495, 0.64, 0.505, 1],
    [0.3, 0.42, 0.31, 0.58],
    [0.69, 0.42, 0.7, 0.58],
  ],
  bars: [
    [0.36, 0, 0.37, 0.3],
    [0.36, 0.7, 0.37, 1],
    [0.63, 0, 0.64, 0.3],
    [0.63, 0.7, 0.64, 1],
    [0.47, 0.38, 0.53, 0.62],
  ],
};

export const DIRS = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
export const TURNS = { N: ['W', 'E'], S: ['E', 'W'], E: ['N', 'S'], W: ['S', 'N'] };

export class Board {
  /**
   * @param {{ arena: keyof ARENAS, layout: keyof LAYOUTS, portrait: boolean }} options
   */
  constructor({ arena, layout, portrait }) {
    const size = ARENAS[arena];
    this.portrait = portrait;
    this.w = portrait ? size.short : size.long;
    this.h = portrait ? size.long : size.short;
    this.speed = size.speed;
    this.cells = new Uint8Array(this.w * this.h);
    this.visited = new Uint32Array(this.w * this.h);
    this.queue = new Int32Array(this.w * this.h);
    this.stamp = 0;
    for (const rect of LAYOUTS[layout]) this.fillRect(rect);
  }

  // Map arena-relative (u, v) to a cell, honouring orientation.
  toCell(u, v) {
    const along = this.portrait ? this.h : this.w;
    const across = this.portrait ? this.w : this.h;
    const a = Math.min(along - 1, Math.floor(u * along));
    const b = Math.min(across - 1, Math.floor(v * across));
    return this.portrait ? { x: b, y: a } : { x: a, y: b };
  }

  fillRect([u0, v0, u1, v1]) {
    const p = this.toCell(u0, v0);
    const q = this.toCell(u1, v1);
    for (let y = Math.min(p.y, q.y); y <= Math.max(p.y, q.y); y++) {
      for (let x = Math.min(p.x, q.x); x <= Math.max(p.x, q.x); x++) {
        this.cells[this.index(x, y)] = WALL;
      }
    }
  }

  // Start cell and heading for player 1 (blue) or player 2 (orange).
  start(player) {
    const u = player === 1 ? 7 / 8 : 1 / 8;
    const cell = this.toCell(u, 0.5);
    const dir = this.portrait ? (player === 1 ? 'N' : 'S') : player === 1 ? 'W' : 'E';
    return { ...cell, dir };
  }

  index(x, y) {
    return y * this.w + x;
  }

  isFree(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.cells[y * this.w + x] === EMPTY;
  }

  set(x, y, value) {
    this.cells[y * this.w + x] = value;
  }

  // Count reachable empty cells from (x, y), stopping at `cap`.
  // Uses a preallocated queue with a read pointer and a stamped visited map,
  // so each call is O(area) with no per-cell allocations.
  floodArea(x, y, cap = Infinity) {
    if (!this.isFree(x, y)) return 0;
    const { w, h, cells, visited, queue } = this;
    const stamp = ++this.stamp;
    let head = 0;
    let tail = 0;
    let count = 0;
    const push = (n) => {
      if (visited[n] === stamp || cells[n] !== EMPTY) return;
      visited[n] = stamp;
      queue[tail++] = n;
    };
    const start = y * w + x;
    push(start);
    while (head < tail && count < cap) {
      const cur = queue[head++];
      count++;
      const cx = cur % w;
      if (cx > 0) push(cur - 1);
      if (cx < w - 1) push(cur + 1);
      if (cur >= w) push(cur - w);
      if (cur < w * (h - 1)) push(cur + w);
    }
    return count;
  }

  // Free cells straight ahead of (x, y) in `dir`, up to `max`.
  runLength(x, y, dir, max = 64) {
    const d = DIRS[dir];
    let n = 0;
    while (n < max && this.isFree(x + d.x * (n + 1), y + d.y * (n + 1))) n++;
    return n;
  }
}
