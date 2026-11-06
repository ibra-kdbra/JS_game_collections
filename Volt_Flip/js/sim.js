/**
 * The deterministic simulation: no DOM, no clock, no randomness beyond the
 * course seed. One call to step() advances the run by exactly DT seconds,
 * so a run plays the same on a 60 Hz phone and a 144 Hz monitor, and the
 * verifier can replay it in Node.
 */
import { DT, PICKUPS, PLAYER, SCORE, UNITS_PER_METRE, WORLD, speedAt } from './config.js';
import { CEIL, FLOOR, createCourse, droneY, extend, prune, shutterPhase, solidAt, surfaceY } from './course.js';

const H = WORLD.height;
const AHEAD = 1900; // course is always built this far past the courier

export function createPlayer() {
  return { y: surfaceY(FLOOR), vy: 0, g: FLOOR, grounded: true, coyote: 0, buffer: 0 };
}

export function createWorld({ seed = 1, pickups = true } = {}) {
  const course = createCourse(seed, { pickups });
  extend(course, AHEAD);
  return {
    seed,
    course,
    t: 0,
    steps: 0,
    dist: 0,
    speed: speedAt(0),
    p: createPlayer(),
    score: 0,
    metre: 0,
    mult: 1,
    chain: 0,
    bestMult: 1,
    shards: 0,
    grazes: 0,
    flips: 0,
    shield: false,
    invuln: 0,
    magnet: 0,
    over: false,
    cause: '',
    events: [],
  };
}

/* ---------------------------------------------------------------- player */

export const canFlip = (p) => p.grounded || p.coyote > 0;

/**
 * Advance the courier one step at course position x. Mutates p and returns
 * what happened: '' | 'flip' | 'land' | 'void' (fell out of the corridor) |
 * 'edge' (fell into a hole and hit its far side).
 */
export function stepPlayer(p, course, x, dt, wantFlip) {
  let ev = '';
  if (wantFlip) p.buffer = PLAYER.buffer;
  if (p.grounded && !solidAt(course, x, p.g)) {
    p.grounded = false;
    p.coyote = PLAYER.coyote;
  }
  if (p.buffer > 0 && canFlip(p)) {
    p.g = -p.g;
    p.vy = p.g * PLAYER.kick;
    p.grounded = false;
    p.coyote = 0;
    p.buffer = 0;
    ev = 'flip';
  }
  if (!p.grounded) {
    const rest = surfaceY(p.g);
    const before = p.g === FLOOR ? p.y - rest : rest - p.y; // > 0 once level with or past the surface
    p.vy += p.g * PLAYER.gravity * dt;
    if (Math.abs(p.vy) > PLAYER.maxFall) p.vy = Math.sign(p.vy) * PLAYER.maxFall;
    p.y += p.vy * dt;
    const past = p.g === FLOOR ? p.y - rest : rest - p.y;
    if (past >= 0) {
      const solid = solidAt(course, x, p.g);
      if (solid && before < 4) {
        // Touchdown. A tap buffered just before it fires on the next step.
        p.y = rest;
        p.vy = 0;
        p.grounded = true;
        if (!ev) ev = 'land';
      } else if (solid) {
        ev = 'edge'; // sank into a hole and met its far wall
      } else if (past > PLAYER.size * 1.4) {
        ev = 'void';
      }
    }
  }
  if (p.coyote > 0) p.coyote -= dt;
  if (p.buffer > 0) p.buffer -= dt;
  return ev;
}

/* ------------------------------------------------------------- collisions */

function boxHitsRect(px, py, h, x0, y0, x1, y1) {
  return px + h > x0 && px - h < x1 && py + h > y0 && py - h < y1;
}

function boxHitsCircle(px, py, h, cx, cy, r) {
  const dx = Math.max(Math.abs(cx - px) - h, 0);
  const dy = Math.max(Math.abs(cy - py) - h, 0);
  return dx * dx + dy * dy < r * r;
}

/** Does hazard o touch a courier box of half-size h centred at (px, py) at time t? */
export function touches(o, px, py, t, h) {
  switch (o.kind) {
    case 'spike':
      return o.surf === FLOOR
        ? boxHitsRect(px, py, h, o.x + 5, H - 16, o.x + o.w - 5, H + 40)
        : boxHitsRect(px, py, h, o.x + 5, -40, o.x + o.w - 5, 16);
    case 'pylon':
      return o.surf === FLOOR
        ? boxHitsRect(px, py, h, o.x + 3, H - o.h, o.x + o.w - 3, H + 40)
        : boxHitsRect(px, py, h, o.x + 3, -40, o.x + o.w - 3, o.h);
    case 'drone':
      return boxHitsCircle(px, py, h, o.x, droneY(o, t), o.r - 2);
    case 'shutter': {
      const { lethal } = shutterPhase(o, t);
      if (!lethal) return false;
      return lethal === CEIL ? boxHitsRect(px, py, h, o.x - 4, -40, o.x + 4, H / 2) : boxHitsRect(px, py, h, o.x - 4, H / 2, o.x + 4, H + 40);
    }
    default:
      return false;
  }
}

const near = (o, x) => o.x - 40 < x && o.x + (o.w || 0) + 40 > x;

/** The first hazard the courier at (x, y) touches at time t, ignoring broken ones. */
export function hazardAt(course, x, y, t, h = PLAYER.hit) {
  for (const o of course.hazards) {
    if (o.broken || !near(o, x)) continue;
    if (touches(o, x, y, t, h)) return o;
  }
  return null;
}

/* ------------------------------------------------------------------- step */

function die(w, cause) {
  w.over = true;
  w.cause = cause;
  w.events.push({ type: 'die', cause });
}

function gainChain(w) {
  w.chain++;
  if (w.chain >= SCORE.chainPerLevel) {
    if (w.mult < SCORE.maxMultiplier) {
      w.mult++;
      w.bestMult = Math.max(w.bestMult, w.mult);
      w.events.push({ type: 'mult', mult: w.mult });
    }
    w.chain = w.mult >= SCORE.maxMultiplier ? SCORE.chainPerLevel : 0;
  }
}

/** Save the courier with the shield: turn gravity round and throw it back to the far surface. */
function rescue(w) {
  w.shield = false;
  w.invuln = PICKUPS.invulnerable;
  w.mult = 1;
  w.chain = 0;
  const p = w.p;
  p.g = -p.g;
  p.vy = p.g * 900;
  p.grounded = false;
  p.coyote = 0;
  w.events.push({ type: 'shieldBreak', x: w.dist, y: p.y });
}

export function step(w, wantFlip = false) {
  w.events.length = 0;
  if (w.over) return w;
  const c = w.course;
  w.speed = speedAt(w.dist / UNITS_PER_METRE);
  w.dist += w.speed * DT;
  w.t += DT;
  w.steps++;
  extend(c, w.dist + AHEAD);
  if (w.steps % 30 === 0) prune(c, w.dist - 200);

  const p = w.p;
  const ev = stepPlayer(p, c, w.dist, DT, wantFlip);
  if (ev === 'flip') {
    w.flips++;
    w.events.push({ type: 'flip', g: p.g });
  } else if (ev === 'land') {
    w.events.push({ type: 'land', g: p.g });
  } else if (ev === 'void' || ev === 'edge') {
    if (w.shield) rescue(w);
    else return die(w, ev), w;
  }

  // Hazards and near misses.
  if (w.invuln > 0) w.invuln -= DT;
  for (const o of c.hazards) {
    if (o.broken || !near(o, w.dist)) continue;
    if (w.invuln <= 0 && touches(o, w.dist, p.y, w.t, PLAYER.hit)) {
      if (w.shield) {
        o.broken = true;
        w.shield = false;
        w.invuln = PICKUPS.invulnerable;
        w.mult = 1;
        w.chain = 0;
        w.events.push({ type: 'shieldBreak', x: w.dist, y: p.y, kind: o.kind });
        continue;
      }
      return die(w, o.kind), w;
    }
    if (!o.grazed && w.invuln <= 0 && touches(o, w.dist, p.y, w.t, PLAYER.hit + 12)) {
      o.grazed = true;
      w.grazes++;
      w.score += SCORE.graze * w.mult;
      gainChain(w);
      w.events.push({ type: 'graze', x: w.dist, y: p.y, points: SCORE.graze * w.mult });
    }
  }

  // Pickups.
  if (w.magnet > 0) w.magnet -= DT;
  const reach = PICKUPS.shardRadius;
  for (const o of c.pickups) {
    if (o.done) continue;
    if (o.x > w.dist + 400) continue;
    if (w.magnet > 0 && o.kind === 'shard') {
      const dx = w.dist - o.x;
      const dy = p.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < PICKUPS.magnetRadius && d > 1) {
        const pull = Math.min(d, (520 + w.speed) * DT);
        o.x += (dx / d) * pull;
        o.y += (dy / d) * pull;
      }
    }
    const r = o.kind === 'shard' ? reach : 24;
    if (Math.abs(o.x - w.dist) < r + PLAYER.hit && Math.abs(o.y - p.y) < r + PLAYER.hit) {
      o.done = true;
      if (o.kind === 'shard') {
        w.shards++;
        const pts = SCORE.shard * w.mult;
        w.score += pts;
        const grp = c.groups.get(o.group);
        if (grp) grp.taken++;
        gainChain(w);
        w.events.push({ type: 'shard', x: o.x, y: o.y, points: pts, chain: w.chain, mult: w.mult, full: grp && grp.taken === grp.size });
      } else if (o.kind === 'shield') {
        w.shield = true;
        w.events.push({ type: 'shield', x: o.x, y: o.y });
      } else if (o.kind === 'magnet') {
        w.magnet = PICKUPS.magnetTime;
        w.events.push({ type: 'magnet', x: o.x, y: o.y });
      }
    } else if (o.x < w.dist - 36) {
      o.done = true;
      if (o.kind !== 'shard') continue;
      const grp = c.groups.get(o.group);
      if (grp && !grp.missed) {
        grp.missed = true;
        if (w.mult > 1) w.events.push({ type: 'miss', mult: w.mult - 1 });
        w.mult = Math.max(1, w.mult - 1);
        w.chain = 0;
      }
    }
  }

  // Distance score.
  const m = Math.floor(w.dist / UNITS_PER_METRE);
  while (w.metre < m) {
    w.metre++;
    w.score += SCORE.perMetre * w.mult;
    if (w.metre % 250 === 0) w.events.push({ type: 'milestone', metre: w.metre });
  }
  return w;
}

export const metres = (w) => Math.floor(w.dist / UNITS_PER_METRE);
