/**
 * Crate Lab rules: parsing, moves, grouped undo, path finding and deadlock hints.
 * No DOM here, so the same code runs in the browser and in Node.
 */

export const DIRS = {
  up: { dx: 0, dy: -1, key: 'u' },
  down: { dx: 0, dy: 1, key: 'd' },
  left: { dx: -1, dy: 0, key: 'l' },
  right: { dx: 1, dy: 0, key: 'r' },
};
const DIR_BY_KEY = { u: 'up', d: 'down', l: 'left', r: 'right' };
const ORDER = ['up', 'down', 'left', 'right'];

/** Parse an XSB collection whose maps are followed by `Key: value` lines. */
export function parseCollection(text) {
  const levels = [];
  let rows = [];
  let meta = {};
  const flush = () => {
    if (rows.length) levels.push({ rows, ...normalizeMeta(meta) });
    rows = [];
    meta = {};
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() && /^[#@+$*.\-_ ]+$/.test(line) && line.includes('#')) {
      if (Object.keys(meta).length) flush();
      rows.push(line);
    } else if (/^[A-Za-z]+:/.test(line)) {
      const i = line.indexOf(':');
      meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    } else if (!line.trim() && Object.keys(meta).length) {
      flush();
    }
  }
  flush();
  return levels;
}

function normalizeMeta(meta) {
  return {
    title: meta.title ?? 'Untitled',
    world: Number(meta.world) || 1,
    par: Number(meta.par) || 0,
    idea: meta.idea ?? '',
  };
}

export class Puzzle {
  constructor(level) {
    this.level = level;
    const rows = level.rows;
    this.h = rows.length;
    this.w = Math.max(...rows.map((r) => r.length));
    const n = this.w * this.h;
    this.wall = new Uint8Array(n);
    this.goal = new Uint8Array(n);
    this.floor = new Uint8Array(n);
    const boxes = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = rows[y][x] ?? ' ';
        const i = y * this.w + x;
        if (c === '#') this.wall[i] = 1;
        if (c === '.' || c === '*' || c === '+') this.goal[i] = 1;
        if (c === '$' || c === '*') boxes.push(i);
        if (c === '@' || c === '+') this.start = i;
      }
    }
    // Playable floor is what the player can reach ignoring crates.
    const stack = [this.start];
    this.floor[this.start] = 1;
    while (stack.length) {
      const i = stack.pop();
      for (const d of ORDER) {
        const j = this.step(i, d);
        if (j >= 0 && !this.wall[j] && !this.floor[j]) {
          this.floor[j] = 1;
          stack.push(j);
        }
      }
    }
    this.startBoxes = boxes;
    this.live = this.computeLive();
    this.reset(true);
  }

  /** Neighbour index or -1 off the map. */
  step(i, dir) {
    const d = DIRS[dir];
    const x = (i % this.w) + d.dx;
    const y = Math.floor(i / this.w) + d.dy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  xy(i) {
    return { x: i % this.w, y: Math.floor(i / this.w) };
  }

  index(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
    return y * this.w + x;
  }

  reset(clearRestarts = false) {
    this.boxes = this.startBoxes.slice();
    this.player = this.start;
    this.facing = 'down';
    this.history = []; // groups of steps: [{ dir, box (index in boxes) | -1 }]
    this.moves = 0;
    this.pushes = 0;
    if (clearRestarts) this.restarts = [];
    this.rebuildOcc();
  }

  rebuildOcc() {
    this.occ = new Int16Array(this.w * this.h).fill(-1);
    this.boxes.forEach((b, k) => (this.occ[b] = k));
  }

  /** Restart, keeping the old attempt so Undo can bring it back. */
  restart() {
    if (!this.history.length) return false;
    this.restarts.push({ history: this.history, boxes: this.boxes, player: this.player, moves: this.moves, pushes: this.pushes, facing: this.facing });
    this.reset();
    return true;
  }

  isFree(i) {
    return i >= 0 && this.floor[i] && this.occ[i] < 0;
  }

  /** Try one step. Returns a step record or null when blocked. */
  tryStep(dir) {
    const to = this.step(this.player, dir);
    if (to < 0 || !this.floor[to]) return null;
    const box = this.occ[to];
    if (box >= 0) {
      const beyond = this.step(to, dir);
      if (!this.isFree(beyond)) return null;
      this.occ[to] = -1;
      this.occ[beyond] = box;
      this.boxes[box] = beyond;
      this.pushes++;
    }
    const rec = { dir, box, from: this.player, facing: this.facing };
    this.player = to;
    this.facing = dir;
    this.moves++;
    return rec;
  }

  /** Apply a list of directions as one undo group. Stops at the first blocked step. */
  applyGroup(dirs) {
    const group = [];
    for (const dir of dirs) {
      const rec = this.tryStep(dir);
      if (!rec) break;
      group.push(rec);
    }
    if (group.length) this.history.push(group);
    return group;
  }

  /** Begin a group that steps are appended to one at a time (for animated walks). */
  beginGroup() {
    this.history.push([]);
  }

  stepInGroup(dir) {
    const rec = this.tryStep(dir);
    if (!rec) return null;
    if (!this.history.length) this.history.push([]);
    this.history[this.history.length - 1].push(rec);
    return rec;
  }

  endGroup() {
    if (this.history.length && !this.history[this.history.length - 1].length) this.history.pop();
  }

  /** Undo the last group. Returns the undone steps (latest first), or 'restart' when a restart was undone. */
  undo() {
    while (this.history.length && !this.history[this.history.length - 1].length) this.history.pop();
    if (!this.history.length) {
      const prev = this.restarts.pop();
      if (!prev) return null;
      Object.assign(this, { history: prev.history, boxes: prev.boxes, player: prev.player, moves: prev.moves, pushes: prev.pushes, facing: prev.facing });
      this.rebuildOcc();
      return 'restart';
    }
    const group = this.history.pop();
    const undone = [];
    for (let k = group.length - 1; k >= 0; k--) {
      const rec = group[k];
      if (rec.box >= 0) {
        const at = this.boxes[rec.box];
        const back = this.player;
        this.occ[at] = -1;
        this.occ[back] = rec.box;
        this.boxes[rec.box] = back;
        this.pushes--;
      }
      undone.push({ ...rec, to: this.player });
      this.player = rec.from;
      this.facing = rec.facing;
      this.moves--;
    }
    return undone;
  }

  solved() {
    return this.boxes.every((b) => this.goal[b]);
  }

  boxesOnGoal() {
    return this.boxes.filter((b) => this.goal[b]).length;
  }

  /** Shortest walk (no pushes) from the player to `target`, as directions, or null. */
  walkPath(target, from = this.player) {
    if (target === from) return [];
    if (!this.isFree(target)) return null;
    const prev = new Map([[from, null]]);
    const queue = [from];
    for (let h = 0; h < queue.length; h++) {
      const c = queue[h];
      if (c === target) break;
      for (const d of ORDER) {
        const j = this.step(c, d);
        if (this.isFree(j) && !prev.has(j)) {
          prev.set(j, { c, d });
          queue.push(j);
        }
      }
    }
    if (!prev.has(target)) return null;
    const path = [];
    for (let c = target; prev.get(c); c = prev.get(c).c) path.unshift(prev.get(c).d);
    return path;
  }

  /**
   * Plan pushing box `k` straight along `dir` for up to `count` cells.
   * Returns { dirs, cells } with the walk to the pushing spot plus the pushes,
   * clipped to the cells that are actually clear; null if the box can't move that way at all.
   */
  planPush(k, dir, count) {
    const box = this.boxes[k];
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' }[dir];
    const behind = this.step(box, opposite);
    const walk = behind === this.player ? [] : this.walkPath(behind);
    if (!walk) return null;
    let n = 0;
    let c = box;
    while (n < count) {
      const next = this.step(c, dir);
      if (!this.isFree(next)) break;
      c = next;
      n++;
    }
    if (!n) return null;
    return { dirs: [...walk, ...Array(n).fill(dir)], pushes: n, end: c };
  }

  /** Cells from which a lone crate can still reach some goal. */
  computeLive() {
    const n = this.w * this.h;
    const live = new Uint8Array(n);
    const stack = [];
    for (let i = 0; i < n; i++) {
      if (this.goal[i]) {
        live[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length) {
      const c = stack.pop();
      for (const d of ORDER) {
        const from = this.step(c, d);
        const player = from >= 0 ? this.step(from, d) : -1;
        if (from >= 0 && player >= 0 && this.floor[from] && this.floor[player] && !live[from]) {
          live[from] = 1;
          stack.push(from);
        }
      }
    }
    return live;
  }

  /** Indices of crates that can never reach a goal: dead squares and frozen off-goal crates. */
  stuckBoxes() {
    const stuck = new Set();
    this.boxes.forEach((b, k) => {
      if (this.goal[b]) return;
      if (!this.live[b] || this.frozen(b, new Set())) stuck.add(k);
    });
    return stuck;
  }

  frozen(c, held) {
    held.add(c);
    const result = this.blocked(c, 'left', 'right', held) && this.blocked(c, 'up', 'down', held);
    held.delete(c);
    return result;
  }

  blocked(c, d1, d2, held) {
    const a = this.step(c, d1);
    const b = this.step(c, d2);
    const solid = (i) => i < 0 || !this.floor[i];
    if (solid(a) || solid(b)) return true;
    if (!this.live[a] && !this.live[b]) return true;
    if (held.has(a) || held.has(b)) return true;
    if (this.occ[a] >= 0 && this.frozen(a, held)) return true;
    if (this.occ[b] >= 0 && this.frozen(b, held)) return true;
    return false;
  }

  /** The full move list as a LURD string (uppercase = push). */
  lurd() {
    let s = '';
    for (const group of this.history) for (const rec of group) s += rec.box >= 0 ? DIRS[rec.dir].key.toUpperCase() : DIRS[rec.dir].key;
    return s;
  }
}

/** Directions from a LURD string. */
export function lurdToDirs(lurd) {
  return [...lurd].map((ch) => DIR_BY_KEY[ch.toLowerCase()]).filter(Boolean);
}
