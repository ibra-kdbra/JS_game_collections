/**
 * Constraint solver for Minesweeper. Pure functions, no DOM: used by the board
 * generator (no-guess mode), the hint button and the node test.
 *
 * Rules, applied cheapest first:
 *  1. single  – a number whose remaining mines equal 0 or equal its unknown
 *               neighbours settles all of them.
 *  2. pair    – for two overlapping numbers A and B: if A.m - B.m equals the
 *               size of A\B, every cell of A\B is a mine and every cell of B\A
 *               is safe. Subset reasoning (A ⊆ B) is the special case A\B = ∅.
 *  3. global  – the mine counter: 0 left means every unknown cell is safe;
 *               as many left as unknown cells means all are mines.
 */

const nbCache = new Map();

/** Neighbour lists for every cell of a w x h board (cached). */
export function neighbours(w, h) {
  const key = `${w}x${h}`;
  let nb = nbCache.get(key);
  if (nb) return nb;
  nb = new Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const list = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) list.push(ny * w + nx);
        }
      }
      nb[y * w + x] = Int32Array.from(list);
    }
  }
  nbCache.set(key, nb);
  return nb;
}

/** Adjacent-mine counts for a mine layout. */
export function countMines(w, h, mines) {
  const nb = neighbours(w, h);
  const counts = new Int8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let c = 0;
    for (const j of nb[i]) c += mines[j];
    counts[i] = c;
  }
  return counts;
}

/**
 * Open a cell and, if it is a zero, everything connected to it.
 * Returns the list of newly opened cells in breadth-first order (for the cascade).
 */
export function floodOpen(w, h, counts, open, start, blocked) {
  const nb = neighbours(w, h);
  const out = [];
  if (open[start]) return out;
  open[start] = 1;
  out.push(start);
  for (let k = 0; k < out.length; k++) {
    const i = out[k];
    if (counts[i] !== 0) continue;
    for (const j of nb[i]) {
      if (open[j] || (blocked && blocked[j])) continue;
      open[j] = 1;
      out.push(j);
    }
  }
  return out;
}

/** Collect the frontier constraints: one per open number with unknown neighbours. */
function constraints(nb, counts, open, known, n) {
  const list = [];
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    if (!open[i] || counts[i] === 0) continue;
    const cells = [];
    let m = counts[i];
    for (const j of nb[i]) {
      if (open[j]) continue;
      if (known[j]) m--;
      else cells.push(j);
    }
    if (!cells.length) continue;
    const key = cells.join(',') + ':' + m;
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ cells, m, src: i });
  }
  return list;
}

/**
 * Find cells that logic alone proves safe or mined.
 *
 * @param {object} s
 * @param {number} s.w
 * @param {number} s.h
 * @param {Int8Array} s.counts
 * @param {Uint8Array} s.open    1 = revealed
 * @param {Uint8Array} s.known   1 = proven mine (never trust player flags here)
 * @param {number} s.total       mines on the board
 * @param {object} [opts]
 * @param {boolean} [opts.pair=true]
 * @param {boolean} [opts.global=true]
 * @returns {{ safe: number[], mines: number[], rule: 'single'|'pair'|'global'|null, reason?: object }}
 */
export function deduce(s, { pair = true, global = true } = {}) {
  const { w, h, counts, open, known, total } = s;
  const n = w * h;
  const nb = neighbours(w, h);
  const cons = constraints(nb, counts, open, known, n);
  const safe = new Set();
  const mines = new Set();
  let reason = null;

  for (const c of cons) {
    if (c.m === 0) {
      for (const j of c.cells) safe.add(j);
      reason ??= { src: [c.src] };
    } else if (c.m === c.cells.length) {
      for (const j of c.cells) mines.add(j);
      reason ??= { src: [c.src] };
    }
  }
  if (safe.size || mines.size) return { safe: [...safe], mines: [...mines], rule: 'single', reason };

  if (pair && cons.length > 1) {
    const byCell = new Map();
    cons.forEach((c, k) => {
      for (const j of c.cells) {
        let arr = byCell.get(j);
        if (!arr) byCell.set(j, (arr = []));
        arr.push(k);
      }
    });
    const tried = new Set();
    for (let a = 0; a < cons.length; a++) {
      const A = cons[a];
      for (const cell of A.cells) {
        for (const b of byCell.get(cell)) {
          if (b === a) continue;
          const key = a < b ? a * 100003 + b : b * 100003 + a;
          if (tried.has(key)) continue;
          tried.add(key);
          const B = cons[b];
          const aOnly = A.cells.filter((x) => !B.cells.includes(x));
          const bOnly = B.cells.filter((x) => !A.cells.includes(x));
          if (A.m - B.m === aOnly.length) {
            for (const x of aOnly) mines.add(x);
            for (const x of bOnly) safe.add(x);
          } else if (B.m - A.m === bOnly.length) {
            for (const x of bOnly) mines.add(x);
            for (const x of aOnly) safe.add(x);
          } else continue;
          reason ??= { src: [A.src, B.src] };
        }
      }
    }
    if (safe.size || mines.size) return { safe: [...safe], mines: [...mines], rule: 'pair', reason };
  }

  if (global) {
    let knownCount = 0;
    let unknown = 0;
    for (let i = 0; i < n; i++) {
      if (known[i]) knownCount++;
      else if (!open[i]) unknown++;
    }
    const left = total - knownCount;
    if (unknown > 0 && (left === 0 || left === unknown)) {
      for (let i = 0; i < n; i++) {
        if (open[i] || known[i]) continue;
        (left === 0 ? safe : mines).add(i);
      }
      return { safe: [...safe], mines: [...mines], rule: 'global', reason: { src: [] } };
    }
  }
  return { safe: [], mines: [], rule: null, reason: null };
}

/**
 * Play a board from `start` using logic only.
 * @returns {{ solved: boolean, open: Uint8Array, known: Uint8Array, steps: {single:number,pair:number,global:number} }}
 */
export function solve(w, h, mines, start, opts = {}) {
  const n = w * h;
  const counts = opts.counts ?? countMines(w, h, mines);
  const open = new Uint8Array(n);
  const known = new Uint8Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) total += mines[i];
  const steps = { single: 0, pair: 0, global: 0 };
  if (mines[start]) return { solved: false, open, known, steps };

  let opened = floodOpen(w, h, counts, open, start).length;
  const goal = n - total;
  const state = { w, h, counts, open, known, total };
  while (opened < goal) {
    const d = deduce(state, opts);
    if (!d.rule) break;
    steps[d.rule]++;
    for (const i of d.mines) {
      if (!mines[i]) throw new Error('solver contradiction: marked a safe cell as a mine');
      known[i] = 1;
    }
    for (const i of d.safe) {
      if (mines[i]) throw new Error('solver contradiction: marked a mine safe');
      if (!open[i]) opened += floodOpen(w, h, counts, open, i).length;
    }
  }
  return { solved: opened === goal, open, known, steps };
}
