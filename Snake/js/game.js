/**
 * Snake simulation. Pure and deterministic: no DOM, no Date, no Math.random,
 * so the browser, the replay and the Node verifier all run the same rules.
 *
 * Time is counted in fixed logic steps. `advance(state)` is called once per
 * step; the snake moves whenever enough steps have built up for its speed.
 */
import { CONFIG, MODES } from './config.js';
import { ARENAS, parseMap } from './arenas.js';
import { createRng, hashString } from './rng.js';

export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
export const DIR_NAMES = ['up', 'right', 'down', 'left'];

/* ---------------------------------------------------------------- boards */

function openBoard(wrap, cfg) {
  const { w, h } = cfg.board;
  return {
    w,
    h,
    wrap,
    walls: new Uint8Array(w * h),
    portals: new Int32Array(w * h).fill(-1),
    portalPairs: [],
    start: Math.floor(h / 2) * w + 4,
  };
}

/** Cells reachable from `from` without crossing walls, following wrap edges and portals. */
export function floodFill(board, from, blocked = null) {
  const seen = new Uint8Array(board.w * board.h);
  const stack = [from];
  seen[from] = 1;
  let count = 1;
  while (stack.length) {
    const cell = stack.pop();
    for (const dir of DIR_NAMES) {
      const next = stepCell(board, cell, dir);
      if (next.cause || seen[next.cell] || (blocked && blocked[next.cell])) continue;
      seen[next.cell] = 1;
      count++;
      stack.push(next.cell);
    }
  }
  return { seen, count };
}

const DAILY_SHAPES = [
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
];

/**
 * The daily board: obstacle pieces stamped with four-way mirror symmetry.
 * Everything comes from a seed made from the UTC date, so every player gets the same board.
 */
export function dailyBoard(day, cfg = CONFIG) {
  const rng = createRng(hashString(`snake-daily-layout-${day}`));
  for (let attempt = 0; attempt < 64; attempt++) {
    const board = openBoard(false, cfg);
    const { w, h, walls, start } = board;
    const sx = start % w;
    const sy = Math.floor(start / w);
    for (let p = 0; p < cfg.daily.pieces; p++) {
      const shape = DAILY_SHAPES[Math.floor(rng() * DAILY_SHAPES.length)];
      const ox = 1 + Math.floor(rng() * (w / 2 - 3));
      const oy = 1 + Math.floor(rng() * (h / 2 - 3));
      for (const [dx, dy] of shape) {
        const x = ox + dx;
        const y = oy + dy;
        for (const [mx, my] of [[x, y], [w - 1 - x, y], [x, h - 1 - y], [w - 1 - x, h - 1 - y]]) {
          walls[my * w + mx] = 1;
        }
      }
    }
    // Keep the start row and a ring round the start cell clear.
    let clear = true;
    for (let x = 0; x < w; x++) if (walls[sy * w + x] && Math.abs(x - sx) < 6) clear = false;
    for (let y = sy - 2; y <= sy + 2; y++) for (let x = sx - 2; x <= sx + 2; x++) if (walls[y * w + x]) clear = false;
    if (!clear) continue;
    const floor = walls.reduce((n, v) => n + (v ? 0 : 1), 0);
    if (floodFill(board, start).count !== floor) continue;
    return board;
  }
  return openBoard(false, cfg);
}

export function buildBoard({ mode, arenaIndex = 0, day = '2000-01-01' }, cfg = CONFIG) {
  if (mode === 'arena') {
    const arena = ARENAS[arenaIndex];
    return { ...parseMap(arena.map), wrap: true, arena, arenaIndex };
  }
  if (mode === 'daily') return dailyBoard(day, cfg);
  return openBoard(MODES[mode].wrap, cfg);
}

/** Where moving `dir` from `cell` lands: a cell (through wrap and portals) or a cause of death. */
export function stepCell(board, cell, dir) {
  const { w, h } = board;
  let x = (cell % w) + DIRS[dir][0];
  let y = Math.floor(cell / w) + DIRS[dir][1];
  if (x < 0 || y < 0 || x >= w || y >= h) {
    if (!board.wrap) return { cause: 'edge', x, y };
    x = (x + w) % w;
    y = (y + h) % h;
  }
  const i = y * w + x;
  if (board.walls[i]) return { cause: 'wall', cell: i, x, y };
  if (board.portals[i] >= 0) return { cell: board.portals[i], portal: i };
  return { cell: i };
}

/* ----------------------------------------------------------------- state */

export function createGame({ mode, arenaIndex = 0, day, seed = 1 }, cfg = CONFIG) {
  const board = buildBoard({ mode, arenaIndex, day }, cfg);
  const rngSeed = mode === 'daily' ? hashString(`snake-daily-food-${day}`) : seed >>> 0;
  const len = cfg.startLength;
  const s = {
    mode,
    rules: MODES[mode],
    cfg,
    board,
    day,
    arenaIndex,
    target: board.arena ? board.arena.target : 0,
    // Food uses its own stream so the daily food order never depends on bonus luck.
    foodRng: createRng(rngSeed),
    itemRng: createRng(rngSeed ^ 0x9e3779b9),
    snake: new Array(len).fill(board.start),
    prev: new Array(len).fill(board.start),
    dirs: new Array(len).fill('right'),
    occ: new Uint16Array(board.w * board.h),
    dir: null,
    queue: [],
    growth: 0,
    food: -1,
    golden: null,
    power: null,
    boost: null,
    eaten: 0,
    score: 0,
    moves: 0,
    time: 0,
    counter: 0,
    grace: 0,
    started: false,
    over: false,
    won: false,
    cause: null,
    causeX: 0,
    causeY: 0,
    maxLength: len,
    lastEvents: [],
  };
  s.occ[board.start] = len;
  s.food = pickCell(s, s.foodRng);
  return s;
}

function isFree(s, cell) {
  return (
    !s.board.walls[cell] &&
    s.board.portals[cell] < 0 &&
    s.occ[cell] === 0 &&
    cell !== s.food &&
    cell !== s.golden?.cell &&
    cell !== s.power?.cell
  );
}

/**
 * Pick a spawn cell: one random draw, then the next free cell in reading order.
 * One draw per spawn keeps the daily sequence identical for everyone.
 */
function pickCell(s, rng) {
  const n = s.board.w * s.board.h;
  const start = Math.floor(rng() * n);
  const ahead = s.dir ? stepCell(s.board, s.snake[0], s.dir).cell : -1;
  for (let k = 0; k < n; k++) {
    const cell = (start + k) % n;
    if (cell !== ahead && isFree(s, cell)) return cell;
  }
  for (let k = 0; k < n; k++) if (isFree(s, k)) return k;
  return -1;
}

export function baseSpeed(s) {
  if (s.board.arena) return s.board.arena.speed;
  const { start, min, rampEvery, rampBy } = s.cfg.speed;
  return Math.max(min, start - Math.floor(s.eaten / rampEvery) * rampBy);
}

/** Logic steps per grid move right now, including speed-up or slow-down. */
export function stepsPerMove(s) {
  let v = baseSpeed(s);
  if (s.boost?.kind === 'fast') v *= s.cfg.power.fastFactor;
  if (s.boost?.kind === 'slow') v *= s.cfg.power.slowFactor;
  return v;
}

/** How far the snake is between its previous and current cells, 0..1. */
export function moveProgress(s, alpha = 0) {
  if (!s.started || s.over || s.grace > 0) return 1;
  return Math.min(1, (s.counter + alpha) / stepsPerMove(s));
}

/**
 * Queue a turn. Ignores repeats, anything once the queue is full, and any turn
 * that would reverse into the neck, checked against the last queued direction.
 */
export function queueTurn(s, dir) {
  if (s.over || !DIRS[dir]) return false;
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (dir === last) return false;
  if (last && OPPOSITE[dir] === last) return false;
  if (s.queue.length >= s.cfg.turnQueue) return false;
  s.queue.push(dir);
  s.started = true;
  return true;
}

function die(s, cause, x, y, events) {
  s.over = true;
  s.cause = cause;
  s.causeX = x;
  s.causeY = y;
  events.push({ type: 'die', cause, x, y });
}

function spawnExtras(s, events) {
  const { golden, power } = s.cfg;
  // Both draws always happen, so the item stream stays in step for every player.
  const g = s.itemRng();
  const p = s.itemRng();
  const kind = s.itemRng() < power.fastShare ? 'fast' : 'slow';
  if (!s.golden && g < golden.chance) {
    const cell = pickCell(s, s.itemRng);
    if (cell >= 0) {
      s.golden = { cell, life: golden.life, maxLife: golden.life };
      events.push({ type: 'spawn', kind: 'golden', cell });
    }
  }
  if (!s.power && p < power.chance) {
    const cell = pickCell(s, s.itemRng);
    if (cell >= 0) {
      s.power = { cell, kind, life: power.life, maxLife: power.life };
      events.push({ type: 'spawn', kind, cell });
    }
  }
}

function move(s, events) {
  if (s.queue.length) s.dir = s.queue.shift();
  if (!s.dir) return;
  const dir = s.dir;
  const head = s.snake[0];
  const res = stepCell(s.board, head, dir);
  if (res.cause) {
    if (res.cause === 'edge') die(s, 'edge', res.x, res.y, events);
    else die(s, 'wall', res.cell % s.board.w, Math.floor(res.cell / s.board.w), events);
    return;
  }
  const cell = res.cell;
  const growing = s.growth > 0;
  const tail = s.snake[s.snake.length - 1];
  if (!growing) s.occ[tail]--;
  const bite = s.occ[cell] > 0;
  if (bite && !s.rules.zen) {
    if (!growing) s.occ[tail]++;
    die(s, 'self', cell % s.board.w, Math.floor(cell / s.board.w), events);
    return;
  }

  s.prev = s.snake.slice();
  s.snake.unshift(cell);
  s.dirs.unshift(dir);
  s.occ[cell]++;
  if (growing) s.growth--;
  else {
    s.snake.pop();
    s.dirs.pop();
  }
  s.moves++;
  if (res.portal !== undefined) events.push({ type: 'portal', from: res.portal, to: cell });

  if (bite) {
    // Zen: the bite cuts the snake at the bitten segment.
    let j = s.snake.indexOf(cell, 1);
    j = Math.max(j, s.cfg.zen.minLength);
    const removed = s.snake.splice(j);
    s.dirs.splice(j);
    for (const c of removed) s.occ[c]--;
    s.growth = 0;
    events.push({ type: 'chop', cells: removed, at: cell });
  }

  if (cell === s.food) {
    const mult = s.boost?.kind === 'fast' ? s.cfg.power.fastScoreMultiplier : 1;
    s.score += s.cfg.food.score * mult;
    s.growth += s.cfg.food.grow;
    s.eaten++;
    events.push({ type: 'eat', kind: 'food', cell, points: s.cfg.food.score * mult });
    s.food = pickCell(s, s.foodRng);
    spawnExtras(s, events);
    if (s.food < 0 && !s.rules.zen) {
      s.over = true;
      s.won = true;
      events.push({ type: 'win', perfect: true });
      return;
    }
  } else if (s.golden && cell === s.golden.cell) {
    s.score += s.cfg.golden.score;
    s.growth += s.cfg.golden.grow;
    s.golden = null;
    events.push({ type: 'eat', kind: 'golden', cell, points: s.cfg.golden.score });
  } else if (s.power && cell === s.power.cell) {
    s.score += s.cfg.power.score;
    s.boost = { kind: s.power.kind, left: s.cfg.power.duration, max: s.cfg.power.duration };
    events.push({ type: 'eat', kind: s.power.kind, cell, points: s.cfg.power.score });
    s.power = null;
  }

  s.maxLength = Math.max(s.maxLength, s.snake.length);
  if (s.target && s.snake.length >= s.target) {
    s.over = true;
    s.won = true;
    events.push({ type: 'win' });
  }
}

/** Advance one fixed logic step. Returns the events that happened. */
export function advance(s) {
  const events = [];
  if (s.over || !s.started) return events;
  if (s.grace > 0) {
    s.grace--;
    return events;
  }
  s.time++;
  if (s.golden && --s.golden.life <= 0) {
    events.push({ type: 'expire', kind: 'golden', cell: s.golden.cell });
    s.golden = null;
  }
  if (s.power && --s.power.life <= 0) {
    events.push({ type: 'expire', kind: s.power.kind, cell: s.power.cell });
    s.power = null;
  }
  if (s.boost && --s.boost.left <= 0) {
    events.push({ type: 'boostEnd', kind: s.boost.kind });
    s.boost = null;
  }
  s.counter++;
  const spm = stepsPerMove(s);
  if (s.counter >= spm) {
    s.counter = Math.min(s.counter - spm, spm - 1);
    move(s, events);
  }
  return events;
}

/** A compact fingerprint of the state, used to prove runs are deterministic. */
export function fingerprint(s) {
  return [s.snake.join(','), s.food, s.golden?.cell ?? -1, s.power?.cell ?? -1, s.score, s.moves, s.over, s.cause].join('|');
}
