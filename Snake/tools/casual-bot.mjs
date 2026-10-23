/**
 * A casual player for rating arena difficulty (not for proving clears; the
 * cautious bot in js/bot.js does that).
 *
 * It heads straight for the food along the shortest path, with no check that
 * it can still reach its tail afterwards, and when it has no path it takes a
 * random move that does not kill it at once. Like a person it does not turn
 * again within `reactMs` of its last turn unless it is about to crash, so
 * fast arenas with tight bends hurt it more than slow open ones.
 */
import { DIR_NAMES, OPPOSITE, advance, createGame, queueTurn, stepCell, stepsPerMove } from '../js/game.js';

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function firstStepToFood(s) {
  const { board } = s;
  const n = board.w * board.h;
  const blocked = new Uint8Array(n);
  for (let i = 0; i < s.snake.length - 1; i++) blocked[s.snake[i]] = 1;
  const head = s.snake[0];
  const first = new Array(n);
  const seen = new Uint8Array(n);
  seen[head] = 1;
  const queue = [head];
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q];
    for (const dir of DIR_NAMES) {
      if (q === 0 && s.dir && dir === OPPOSITE[s.dir]) continue;
      const next = stepCell(board, cell, dir);
      if (next.cause || seen[next.cell] || blocked[next.cell]) continue;
      seen[next.cell] = 1;
      first[next.cell] = q === 0 ? dir : first[cell];
      if (next.cell === s.food) return first[next.cell];
      queue.push(next.cell);
    }
  }
  return null;
}

function safe(s, dir) {
  const next = stepCell(s.board, s.snake[0], dir);
  if (next.cause) return false;
  for (let i = 0; i < s.snake.length - 1; i++) if (s.snake[i] === next.cell) return false;
  return true;
}

/** Play one arena; returns { won, length, seconds }. */
export function casualRun(arenaIndex, seed, { reactMs = 180, maxSteps = 60 * 600 } = {}) {
  const s = createGame({ mode: 'arena', arenaIndex, seed });
  const random = rng(seed * 7919 + arenaIndex);
  let lastTurn = -Infinity;
  let step = 0;
  const decide = () => {
    const ms = (step * 1000) / 60;
    const straight = s.dir;
    let want = firstStepToFood(s);
    if (!want || !safe(s, want)) {
      const options = DIR_NAMES.filter((d) => !(s.dir && d === OPPOSITE[s.dir]) && safe(s, d));
      want = straight && options.includes(straight) ? straight : options[Math.floor(random() * options.length)];
    }
    if (!want || want === straight) return;
    // Too soon after the last turn: keep going, unless straight on is a wall or the body.
    if (ms - lastTurn < reactMs && straight && safe(s, straight)) return;
    if (queueTurn(s, want)) lastTurn = ms;
  };
  decide();
  for (; step < maxSteps && !s.over; step++) {
    if (!s.queue.length && s.counter + 1 >= stepsPerMove(s)) decide();
    advance(s);
  }
  return { won: s.won, length: s.snake.length, seconds: step / 60 };
}
