/**
 * A look-ahead autopilot. It plays the title-screen demo, and the verifier
 * uses it to prove that generated courses can be survived.
 *
 * The courier's forward motion never depends on input, so the bot knows
 * exactly where it will be at every future step. It searches every flip
 * timing over the horizon (a grounded courier is fully described by the step
 * and its side, which keeps the search small) and flips only when flipping
 * now survives longer than waiting.
 */
import { DT, UNITS_PER_METRE, speedAt } from './config.js';
import { canFlip, hazardAt, stepPlayer } from './sim.js';

const clone = (p) => ({ y: p.y, vy: p.vy, g: p.g, grounded: p.grounded, coyote: p.coyote, buffer: p.buffer });

/**
 * @param {object} w      the world (read only)
 * @param {object} [o]
 * @param {number} [o.horizon=1.25]  seconds to look ahead
 * @param {boolean} [o.eager=false]  flip as soon as running on would crash within
 *   the horizon (like a person), instead of at the last safe moment
 * @returns {boolean} whether to flip on this step
 */
export function botWantsFlip(w, { horizon = 1.25, eager = false } = {}) {
  if (w.over || !canFlip(w.p)) return false;
  const n = Math.round(horizon / DT);
  const xs = new Float64Array(n + 1);
  const ts = new Float64Array(n + 1);
  let x = w.dist;
  for (let k = 1; k <= n; k++) {
    x += speedAt(x / UNITS_PER_METRE) * DT;
    xs[k] = x;
    ts[k] = w.t + k * DT;
  }
  const course = w.course;
  const memo = new Map();

  // Steps survived from step k (state p already at step k), up to n.
  function survive(k, p) {
    if (k >= n) return n;
    const key = p.grounded && p.coyote <= 0 && p.buffer <= 0 ? k * 2 + (p.g > 0 ? 1 : 0) : -1;
    if (key >= 0 && memo.has(key)) return memo.get(key);
    let best = k;
    const options = canFlip(p) ? [false, true] : [false];
    for (const flip of options) {
      const r = advance(k, p, flip);
      if (r > best) best = r;
      if (best >= n) break;
    }
    if (key >= 0) memo.set(key, best);
    return best;
  }

  function advance(k, p, flip) {
    const q = clone(p);
    const ev = stepPlayer(q, course, xs[k + 1], DT, flip);
    if (ev === 'void' || ev === 'edge') return k;
    if (hazardAt(course, xs[k + 1], q.y, ts[k + 1])) return k;
    return survive(k + 1, q);
  }

  if (eager) {
    // Run on without flipping: if that is safe for the whole horizon, wait.
    const p = clone(w.p);
    let k = 0;
    for (; k < n; k++) {
      const ev = stepPlayer(p, course, xs[k + 1], DT, false);
      if (ev === 'void' || ev === 'edge' || hazardAt(course, xs[k + 1], p.y, ts[k + 1])) break;
    }
    if (k >= n) return false;
    return advance(0, w.p, true) >= advance(0, w.p, false);
  }
  const stay = advance(0, w.p, false);
  if (stay >= n) return false;
  return advance(0, w.p, true) > stay;
}
