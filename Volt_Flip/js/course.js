/**
 * The course: an endless corridor built from short hand-designed patterns.
 *
 * Every pattern is built from the current speed and reaction margin, so a
 * forced change of side always leaves at least one flip plus the margin of
 * room, however fast the run has become. Patterns start after a lead-in of
 * the same length, so the courier can be on either surface when one begins.
 * tools/verify.mjs plays generated courses with a bot to prove this holds.
 */
import { FLIP_TIME, PICKUPS, PLAYER, UNITS_PER_METRE, UNLOCK, WORLD, marginAt, speedAt } from './config.js';
import { createRng, hashString } from './rng.js';

const H = WORLD.height;
export const FLOOR = 1;
export const CEIL = -1;

/** Centre of the courier when it stands on a surface. */
export const surfaceY = (g) => (g === FLOOR ? H - PLAYER.size / 2 : PLAYER.size / 2);

/* -------------------------------------------------------------- moving parts */

/** Shutters: one half of the gate is lethal at a time, with a safe pause while the other half charges. */
export const SHUTTER_OFF = 0.28;

export function shutterPhase(o, t) {
  const cycle = 2 * (o.period + SHUTTER_OFF);
  let u = (t + o.phase) % cycle;
  if (u < 0) u += cycle;
  if (u < o.period) return { lethal: o.first, charging: 0, k: u / o.period };
  u -= o.period;
  if (u < SHUTTER_OFF) return { lethal: 0, charging: -o.first, k: u / SHUTTER_OFF };
  u -= SHUTTER_OFF;
  if (u < o.period) return { lethal: -o.first, charging: 0, k: u / o.period };
  u -= o.period;
  return { lethal: 0, charging: o.first, k: u / SHUTTER_OFF };
}

export const droneY = (o, t) => o.y0 + o.amp * Math.sin((t * 2 * Math.PI) / o.period + o.phase);

/* ---------------------------------------------------------------- generator */

const PATTERNS = [
  { key: 'spikes', unlock: UNLOCK.spikes, weight: (m) => (m < 600 ? 3 : 1.5) },
  { key: 'gap', unlock: UNLOCK.gaps, weight: (m) => (m < 600 ? 2.5 : 1.5) },
  { key: 'arc', unlock: 60, weight: () => 1.1 },
  { key: 'zigzag', unlock: UNLOCK.zigzag, weight: () => 2 },
  { key: 'pylons', unlock: UNLOCK.pylons, weight: () => 1.8 },
  { key: 'drones', unlock: UNLOCK.drones, weight: () => 1.6 },
  { key: 'shutter', unlock: UNLOCK.shutters, weight: () => 1.6 },
  { key: 'tunnel', unlock: UNLOCK.tunnels, weight: () => 1.4 },
  { key: 'combo', unlock: UNLOCK.combos, weight: (m) => Math.min(3, 1 + (m - UNLOCK.combos) / 600) },
  { key: 'sweeper', unlock: UNLOCK.sweepers, weight: () => 1.2 },
];

export function createCourse(seed, { pickups = true } = {}) {
  const rng = createRng(seed);
  const c = {
    seed,
    rng,
    hazards: [], // spikes, pylons, drones, shutters
    gaps: [], // holes in the floor or ceiling
    pickups: [], // shards, shield cells, magnets
    groups: new Map(), // shard group id -> { size, missed, taken }
    cursor: 640, // the first pattern starts after a short run-up
    nextId: 1,
    nextGroup: 1,
    last: '',
    patternLog: [],
    withPickups: pickups,
    nextShield: 380 + rng() * 200,
    nextMagnet: 240 + rng() * 200,
  };
  return c;
}

/** Speed, reaction margin and the minimum distance between two forced flips at x. */
export function context(x) {
  const m = x / UNITS_PER_METRE;
  const v = speedAt(m + 40); // a little ahead, since the pattern takes time to pass
  const margin = marginAt(m);
  return { m, v, margin, D: v * (FLIP_TIME + margin) + 34 };
}

const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const side = (rng) => (rng() < 0.5 ? FLOOR : CEIL);

function add(c, list, o) {
  o.id = c.nextId++;
  list.push(o);
  return o;
}

const spike = (c, x, w, surf) => add(c, c.hazards, { kind: 'spike', x, w, surf });
const pylon = (c, x, h, surf) => add(c, c.hazards, { kind: 'pylon', x, w: 22, h, surf });
const gap = (c, x, w, surf) => add(c, c.gaps, { kind: 'gap', x, w, surf });

function drone(c, x, { amp, period, y0 = H / 2, sweeper = false, phase }) {
  return add(c, c.hazards, {
    kind: 'drone',
    x,
    w: 0,
    y0,
    amp,
    period,
    phase: phase ?? c.rng() * Math.PI * 2,
    r: 15,
    sweeper,
  });
}

function shutter(c, x, period, { phase, first } = {}) {
  return add(c, c.hazards, {
    kind: 'shutter',
    x,
    w: 0,
    period,
    phase: phase ?? c.rng() * 2 * (period + SHUTTER_OFF),
    first: first ?? side(c.rng),
  });
}

/** A row of shards along a surface, from x0 to x1. */
function shardRow(c, x0, x1, surf) {
  if (!c.withPickups) return;
  const g = c.nextGroup++;
  let n = 0;
  for (let x = x0 + 13; x <= x1 - 8; x += 30) {
    add(c, c.pickups, { kind: 'shard', x, y: surfaceY(surf), group: g });
    n++;
  }
  if (n) c.groups.set(g, { size: n, missed: false, taken: 0 });
}

/** Shards along the path of a flip that starts at x0 from surface surf: take them all with one well-timed tap. */
function shardArc(c, x0, surf, v) {
  if (!c.withPickups) return;
  const g = c.nextGroup++;
  const n = 7;
  const d = H - PLAYER.size;
  for (let i = 0; i < n; i++) {
    const t = (FLIP_TIME * (i + 0.5)) / n;
    const travelled = PLAYER.kick * t + (PLAYER.gravity / 2) * t * t;
    const y = surf === FLOOR ? surfaceY(FLOOR) - Math.min(d, travelled) : surfaceY(CEIL) + Math.min(d, travelled);
    add(c, c.pickups, { kind: 'shard', x: x0 + v * t, y, group: g });
  }
  c.groups.set(g, { size: n, missed: false, taken: 0 });
}

const BUILD = {
  spikes(c, x, ctx) {
    const teeth = randInt(c.rng, 1, Math.min(4, 2 + Math.floor(ctx.m / 400)));
    const w = 26 * teeth;
    const s = side(c.rng);
    spike(c, x, w, s);
    if (c.rng() < 0.7) shardRow(c, x - 10, x + w + 10, -s);
    return x + w;
  },
  gap(c, x, ctx) {
    const w = Math.round(Math.min(320, 110 + c.rng() * (70 + ctx.m / 20)));
    const s = side(c.rng);
    gap(c, x, w, s);
    shardRow(c, x, x + w, -s);
    return x + w;
  },
  arc(c, x, ctx) {
    shardArc(c, x, side(c.rng), ctx.v);
    return x + ctx.v * FLIP_TIME + 20;
  },
  zigzag(c, x, ctx) {
    const n = randInt(c.rng, 3, 3 + Math.min(2, Math.floor(ctx.m / 500)));
    let s = side(c.rng);
    for (let i = 0; i < n; i++) {
      const w = 26 * randInt(c.rng, 1, 2);
      spike(c, x, w, s);
      if (c.rng() < 0.6) shardRow(c, x - 6, x + w + 6, -s);
      x += w;
      if (i < n - 1) x += ctx.D;
      s = -s;
    }
    return x;
  },
  pylons(c, x, ctx) {
    const n = randInt(c.rng, 1, ctx.m > 600 ? 3 : 2);
    let s = side(c.rng);
    for (let i = 0; i < n; i++) {
      pylon(c, x, Math.round(100 + c.rng() * 62), s);
      x += 22;
      if (i < n - 1) x += ctx.D + 16;
      s = -s;
    }
    return x;
  },
  drones(c, x, ctx) {
    const n = randInt(c.rng, 1, ctx.m > 900 ? 3 : 2);
    const quick = Math.min(0.6, ctx.m / 4000);
    for (let i = 0; i < n; i++) {
      drone(c, x, { amp: 55 + c.rng() * 30, period: 2.2 - quick - c.rng() * 0.5 });
      if (i < n - 1) x += 150 + c.rng() * 90;
    }
    return x + 16;
  },
  shutter(c, x, ctx) {
    const n = ctx.m > 1100 && c.rng() < 0.5 ? 2 : 1;
    const period = Math.max(0.95, 1.6 - ctx.m / 5000 - c.rng() * 0.3);
    for (let i = 0; i < n; i++) {
      shutter(c, x, period);
      if (i < n - 1) x += ctx.D + 10;
    }
    return x + 6;
  },
  tunnel(c, x, ctx) {
    const n = randInt(c.rng, 2, 3);
    let s = side(c.rng);
    for (let i = 0; i < n; i++) {
      const w = Math.round(120 + c.rng() * 90);
      gap(c, x, w, s);
      shardRow(c, x, x + w, -s);
      x += w;
      if (i < n - 1) x += ctx.D;
      s = -s;
    }
    return x;
  },
  combo(c, x, ctx) {
    const kind = randInt(c.rng, 0, 2);
    if (kind === 0) {
      // Hole, then a shutter, then teeth: read all three before the first.
      const s = side(c.rng);
      const w = Math.round(120 + c.rng() * 60);
      gap(c, x, w, s);
      shardRow(c, x, x + w, -s);
      x += w + ctx.D;
      shutter(c, x, Math.max(0.95, 1.4 - ctx.m / 6000));
      x += ctx.D;
      const t = 26 * randInt(c.rng, 1, 3);
      spike(c, x, t, side(c.rng));
      return x + t;
    }
    if (kind === 1) {
      // Mixed ladder: teeth, pylons and holes on alternating sides.
      const n = randInt(c.rng, 4, 5);
      let s = side(c.rng);
      for (let i = 0; i < n; i++) {
        const k = randInt(c.rng, 0, 2);
        let w;
        if (k === 0) spike(c, x, (w = 26 * randInt(c.rng, 1, 2)), s);
        else if (k === 1) pylon(c, x, Math.round(100 + c.rng() * 60), s), (w = 22);
        else gap(c, x, (w = Math.round(110 + c.rng() * 60)), s), shardRow(c, x, x + w, -s);
        x += w;
        if (i < n - 1) x += ctx.D + (k === 1 ? 16 : 0);
        s = -s;
      }
      return x;
    }
    // A long strip of teeth with drones patrolling above it: flip early, then hold.
    const s = side(c.rng);
    const w = 26 * randInt(c.rng, 7, 10);
    spike(c, x, w, s);
    shardRow(c, x, x + w, -s);
    drone(c, x + w * 0.5, { amp: 60, period: 1.8 - c.rng() * 0.4 });
    return x + w;
  },
  sweeper(c, x, ctx) {
    drone(c, x, { amp: 120, period: 2.4 - Math.min(0.5, ctx.m / 6000) - c.rng() * 0.3, sweeper: true });
    return x + 16;
  },
};

function choosePattern(c, m) {
  const open = PATTERNS.filter((p) => m >= p.unlock && p.key !== c.last);
  const total = open.reduce((s, p) => s + p.weight(m), 0);
  let r = c.rng() * total;
  for (const p of open) {
    r -= p.weight(m);
    if (r <= 0) return p.key;
  }
  return open[open.length - 1].key;
}

/** Add one pattern and its lead-in to the course. */
function next(c) {
  const lead = context(c.cursor);
  // The lead-in: room to reach either surface, and a little extra breathing space early on.
  let x = c.cursor + lead.D + c.rng() * 90 * Math.exp(-lead.m / 900);
  if (c.withPickups) {
    const mid = c.cursor + (x - c.cursor) * 0.5;
    if (lead.m >= c.nextShield) {
      add(c, c.pickups, { kind: 'shield', x: mid, y: H / 2 });
      c.nextShield = lead.m + PICKUPS.shieldEvery[0] + c.rng() * (PICKUPS.shieldEvery[1] - PICKUPS.shieldEvery[0]);
    } else if (lead.m >= c.nextMagnet) {
      add(c, c.pickups, { kind: 'magnet', x: mid, y: H / 2 });
      c.nextMagnet = lead.m + PICKUPS.magnetEvery[0] + c.rng() * (PICKUPS.magnetEvery[1] - PICKUPS.magnetEvery[0]);
    }
  }
  const key = choosePattern(c, x / UNITS_PER_METRE);
  const ctx = context(x);
  const end = BUILD[key](c, x, ctx);
  c.patternLog.push({ key, x, end });
  if (c.patternLog.length > 400) c.patternLog.shift();
  c.last = key;
  c.cursor = end;
}

/** Build the course out to x. */
export function extend(c, x) {
  while (c.cursor < x) next(c);
}

const endOf = (o) => o.x + (o.w || 0) + (o.r || 0) + 20;

/** Forget everything that is well behind x. */
export function prune(c, x) {
  const keep = (o) => endOf(o) >= x;
  if (c.hazards.length && !keep(c.hazards[0])) c.hazards = c.hazards.filter(keep);
  if (c.gaps.length && !keep(c.gaps[0])) c.gaps = c.gaps.filter(keep);
  if (c.pickups.length && c.pickups.some((o) => !keep(o) && o.done)) c.pickups = c.pickups.filter((o) => keep(o) || !o.done);
}

/** True if the surface on side g is solid under x. */
export function solidAt(c, x, g) {
  for (const o of c.gaps) {
    if (o.surf === g && x > o.x && x < o.x + o.w) return false;
  }
  return true;
}

/** A short hash of the course layout up to x, to check that a seed always builds the same run. */
export function fingerprint(c, x) {
  const parts = [];
  for (const o of [...c.hazards, ...c.gaps, ...c.pickups]) {
    if (o.x < x) parts.push(`${o.kind}:${Math.round(o.x)}:${o.surf ?? ''}:${Math.round(o.w ?? 0)}`);
  }
  parts.sort();
  return hashString(parts.join('|')).toString(16);
}

/* ------------------------------------------------------------ campaign levels */

/**
 * Campaign levels are data (js/levels.js): a fixed list of one-line segments
 * read in order along the corridor. Each obstacle segment is followed by one
 * flip plus the level's margin of room, so a forced change of side is always
 * fair; the verifier proves every level with the look-ahead bot.
 *
 *   spike F|C [teeth=1]      teeth 26 units wide on the floor or ceiling
 *   pylon F|C [height=130]   a tall spike
 *   hole  F|C [width=140]    a hole in that rail
 *   drone [amp=60] [period=2] [phase=0] [offset=0]
 *   sweep [period=2.2] [phase=0]          a drone whose track reaches the rails
 *   shutter [period=1.4] [F|C first=F] [phase=0]
 *   arc F|C                  shards along the path of a flip from that rail
 *   row F|C [width=200]      shards along a rail (no room added after)
 *   run <seconds>            empty corridor
 *   shield | magnet          a pickup in the middle of the corridor
 *
 * Flags: `*` puts a row of shards on the safe rail beside a spike, pylon or
 * hole, `>` adds no room after the segment (for things on the same rail),
 * `+0.3` adds that many seconds of extra room, and `@120` lays the segment
 * that many units ahead without moving on (a drone over a strip of teeth).
 * Drone and shutter phases are fractions of their cycle at the moment the
 * courier reaches them, so a level keeps its timing if its speed is retuned.
 */
const SIDES = { F: FLOOR, C: CEIL };
export const LEVEL_START = 140; // units of corridor before the run-up
export const LEVEL_RUNUP = 1.5; // seconds before the first segment
export const LEVEL_RUNOUT = 0.5; // seconds from the last room to the finish line

const levelSpeeds = (level) => (Array.isArray(level.speed) ? level.speed : [level.speed, level.speed]);

/** Seconds after the start at which the courier reaches x, on a course whose speed ramps linearly to its finish. */
export function arrivalTime(c, x) {
  if (!c.finish || c.v1 === c.v0) return x / c.v0;
  const k = (c.v1 - c.v0) / c.finish;
  if (x >= c.finish) return Math.log(c.v1 / c.v0) / k + (x - c.finish) / c.v1;
  return Math.log((c.v0 + k * x) / c.v0) / k;
}

function layLevel(level, finish) {
  const c = createCourse(hashString(level.id));
  const [v0, v1] = levelSpeeds(level);
  Object.assign(c, { level, v0, v1, finish });
  // Room is sized from the level's top speed, so a speed ramp only ever adds room.
  const D = v1 * (FLIP_TIME + level.margin) + 34;
  const sec = (s) => v1 * s;
  const at = (x) => arrivalTime(c, x);
  let x = LEVEL_START + sec(LEVEL_RUNUP);
  for (const line of level.course) {
    const [op, ...rest] = line.trim().split(/\s+/);
    const args = [];
    let shards = false;
    let tight = false;
    let extra = 0;
    let over = null;
    for (const t of rest) {
      if (t === '*') shards = true;
      else if (/^@-?\d+$/.test(t)) over = Number(t.slice(1));
      else if (t === '>') tight = true;
      else if (/^\+\d*\.?\d+$/.test(t)) extra += Number(t);
      else args.push(t);
    }
    const bad = (why) => new Error(`level ${level.id}, "${line}": ${why}`);
    const surf = (i, fallback) => {
      const g = SIDES[args[i] ?? fallback];
      if (!g) throw bad('expected F or C');
      return g;
    };
    const num = (i, fallback) => {
      if (args[i] === undefined) return fallback;
      const n = Number(args[i]);
      if (!Number.isFinite(n)) throw bad(`"${args[i]}" is not a number`);
      return n;
    };
    const resume = x;
    if (over !== null) x += over;
    const start = x;
    let obstacle = true;
    switch (op) {
      case 'spike': {
        const g = surf(0);
        const w = 26 * num(1, 1);
        spike(c, x, w, g);
        if (shards) shardRow(c, x - 10, x + w + 10, -g);
        x += w;
        break;
      }
      case 'pylon': {
        const g = surf(0);
        pylon(c, x, num(1, 130), g);
        if (shards) shardRow(c, x - 24, x + 46, -g);
        x += 22 + (tight ? 0 : 16);
        break;
      }
      case 'hole': {
        const g = surf(0);
        const w = num(1, 140);
        gap(c, x, w, g);
        if (shards) shardRow(c, x, x + w, -g);
        x += w;
        break;
      }
      case 'drone':
      case 'sweep': {
        const sweeper = op === 'sweep';
        const amp = sweeper ? 120 : num(0, 60);
        const period = sweeper ? num(0, 2.2) : num(1, 2);
        const p = sweeper ? num(1, 0) : num(2, 0);
        const phase = 2 * Math.PI * (p - at(x) / period);
        drone(c, x, { amp, period, phase, sweeper, y0: H / 2 + (sweeper ? 0 : num(3, 0)) });
        x += 16;
        break;
      }
      case 'shutter': {
        const period = num(0, 1.4);
        const cycle = 2 * (period + SHUTTER_OFF);
        shutter(c, x, period, { first: surf(1, 'F'), phase: num(2, 0) * cycle - at(x) });
        x += 6;
        break;
      }
      case 'arc': {
        shardArc(c, x, surf(0), courseSpeed(c, x));
        x += sec(FLIP_TIME) + 20; // from the top speed, so the layout never depends on the ramp
        break;
      }
      case 'row': {
        const w = num(1, 200);
        shardRow(c, x, x + w, surf(0));
        x += w;
        obstacle = false;
        break;
      }
      case 'run':
        x += sec(num(0, 1));
        obstacle = false;
        break;
      case 'shield':
      case 'magnet':
        add(c, c.pickups, { kind: op, x, y: H / 2 });
        obstacle = false;
        break;
      default:
        throw bad(`unknown segment "${op}"`);
    }
    if (obstacle && !tight) x += D;
    x += sec(extra);
    c.patternLog.push({ key: line, x: start, end: x });
    if (over !== null) x = resume;
  }
  c.finishAt = x + sec(LEVEL_RUNOUT);
  c.cursor = Infinity; // nothing more is generated
  c.totalShards = c.pickups.filter((o) => o.kind === 'shard').length;
  return c;
}

/**
 * Build a campaign level's fixed course; the finish line is at course.finish.
 * The first pass finds the length, the second times drones, shutters and
 * shard arcs against the real speed ramp.
 */
export function buildLevel(level) {
  const draft = layLevel(level, 0);
  const c = layLevel(level, draft.finishAt);
  c.finish = draft.finishAt;
  return c;
}

/** Courier speed at x: the endless ramp, or a level's own speed ramping to its finish. */
export function courseSpeed(c, x) {
  if (!c.level) return speedAt(x / UNITS_PER_METRE);
  if (!c.finish) return c.v0;
  const k = Math.min(1, Math.max(0, x / c.finish));
  return c.v0 + (c.v1 - c.v0) * k;
}
