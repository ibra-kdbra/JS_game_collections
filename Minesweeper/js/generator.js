/**
 * Board generation. The first click is always safe and always opens an area:
 * the 3x3 around it is kept free of mines whenever the board has room.
 *
 * No-guess mode places mines, plays the board with the solver, and when the
 * solver stalls it moves one mine from the stalled frontier into the unseen
 * interior and tries again ("repair"). If repairs run out, it rerolls.
 */

import { GEN } from './config.js';
import { countMines, neighbours, solve } from './solver.js';

/** Cells that must stay clear for a given first click. */
export function safeZone(w, h, mines, start) {
  const zone = new Set([start]);
  if (w * h - mines >= 9) for (const j of neighbours(w, h)[start]) zone.add(j);
  return zone;
}

function place(w, h, count, zone, rng) {
  const n = w * h;
  const pool = [];
  for (let i = 0; i < n; i++) if (!zone.has(i)) pool.push(i);
  const mines = new Uint8Array(n);
  for (let k = 0; k < count; k++) {
    const r = k + Math.floor(rng() * (pool.length - k));
    [pool[k], pool[r]] = [pool[r], pool[k]];
    mines[pool[k]] = 1;
  }
  return mines;
}

/** Move one mine that blocks the solver to a cell the solver has not reached. */
function repair(w, h, mines, result, zone, rng) {
  const n = w * h;
  const nb = neighbours(w, h);
  const { open, known } = result;
  const frontier = [];
  const interior = [];
  for (let i = 0; i < n; i++) {
    if (open[i] || known[i]) continue;
    let touches = false;
    for (const j of nb[i]) if (open[j]) { touches = true; break; }
    if (touches) { if (mines[i]) frontier.push(i); }
    else if (!mines[i] && !zone.has(i)) interior.push(i);
  }
  if (!frontier.length || !interior.length) return false;
  const from = frontier[Math.floor(rng() * frontier.length)];
  const to = interior[Math.floor(rng() * interior.length)];
  mines[from] = 0;
  mines[to] = 1;
  return true;
}

/**
 * @param {object} o
 * @param {number} o.w
 * @param {number} o.h
 * @param {number} o.mines
 * @param {number} o.start         index of the first click
 * @param {() => number} o.rng
 * @param {boolean} [o.noGuess=true]
 * @param {number} [o.minPair=0]   require at least this many pair deductions (puzzle mode)
 * @param {number} [o.timeBudget]
 * @returns {{ mines: Uint8Array, counts: Int8Array, noGuess: boolean, attempts: number, ms: number, steps?: object }}
 */
export function generate({ w, h, mines: count, start, rng, noGuess = true, minPair = 0, timeBudget = GEN.timeBudget }) {
  const t0 = now();
  const zone = safeZone(w, h, count, start);
  let attempts = 0;
  let best = null;
  while (true) {
    attempts++;
    const mines = place(w, h, count, zone, rng);
    if (!noGuess) {
      return { mines, counts: countMines(w, h, mines), noGuess: false, attempts, ms: now() - t0 };
    }
    for (let r = 0; r <= GEN.repairs; r++) {
      const counts = countMines(w, h, mines);
      const res = solve(w, h, mines, start, { counts });
      if (res.solved) {
        if (res.steps.pair >= minPair) {
          return { mines, counts, noGuess: true, attempts, ms: now() - t0, steps: res.steps };
        }
        best ??= { mines: mines.slice(), counts, steps: res.steps };
        break;
      }
      if (!repair(w, h, mines, res, zone, rng)) break;
    }
    if (attempts >= GEN.maxAttempts || now() - t0 > timeBudget) {
      // A solvable board that missed the puzzle target still beats a guess.
      if (best) return { ...best, noGuess: true, attempts, ms: now() - t0, relaxed: true };
      const fallback = place(w, h, count, zone, rng);
      return { mines: fallback, counts: countMines(w, h, fallback), noGuess: false, attempts, ms: now() - t0, failed: true };
    }
  }
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
