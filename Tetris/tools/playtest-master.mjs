#!/usr/bin/env node
/**
 * Master playtest bot: measures how Master plays at 20G with human-like timing.
 *
 *   node Tetris/tools/playtest-master.mjs [--games 6] [--only walls|games] [--input keyboard,touch]
 *
 * Not a pass/fail check (that is verify-master.mjs); it prints numbers, so the gravity and
 * lock delay curve can be judged on measurements instead of on paper.
 *
 * Two players, both driving the game through its real input path:
 *   keyboard  key events from Playwright's keyboard (DAS 6 = 100 ms, ARR 0, also ARR 1)
 *   touch     an emulated phone (hasTouch, isMobile): touch events at the on-screen buttons,
 *             which repeat with the default DAS 10 and ARR 1
 * Each player has a timing profile in steps (1 step = 1/60 s): how long a tap is held, how
 * soon the same button can be tapped again, how long switching to another button takes, and
 * how long after a hard drop the first press for the next piece comes. Every gap gets a
 * little seeded jitter, as a person's would.
 *
 * Per piece, a planner tries every rotation followed by taps or a hold to a wall (with the mode's
 * gravity on the player's own clock, so it knows a 20G piece cannot climb), scores each end by
 * height, holes, bumpiness and lines, and the player then presses the buttons for the best
 * one on its own clock (open loop: a hold to the wall is held for a fixed time). The bot
 * notes where each piece really locked, and whether it locked before the hard drop.
 *
 * Measurements:
 *   walls  for every level's lock delay: each piece, each rotation, held to the left and the
 *          right wall from spawn on an empty board. Does it get there? Then the largest delay
 *          between the spawn and the first press (and between a rotation and the move) that
 *          still gets the vertical I piece to both walls.
 *   games  seeded Master games to the end: level reached, lines, and per level how many
 *          pieces locked early or somewhere else than planned.
 *
 * The game's clock is held and the bot advances it one logic step at a time, so every run
 * gives the same numbers on any machine.
 */
import { startCheck } from '../../tools/play/harness.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const GAMES = Number(opt('games', 6));
const ONLY = opt('only', '');
const INPUTS = opt('input', 'keyboard,keyboard-arr1,touch,touch-slow').split(',');
// What-if knobs, applied in the page before measuring: --no-reset (the lock timer never
// resets once a piece has landed), --floor N (Master's lowest lock delay, same slope).
const NO_RESET = args.includes('--no-reset');
const FLOOR = opt('floor', null);
// --ramp 0.0625,0.25,1: Master's gravity in G for levels 1, 2, 3...; later levels 20G.
const RAMP = opt('ramp', null);

// Timing profiles, in 60 Hz steps. `first`: hard drop to the first press for the next piece.
// `switch`: start of one press to the start of a press on another button. `repeat`: the same
// button again. `tap`: how long a tap is held. `jitter`: +- steps added to every gap.
export const PLAYERS = {
  keyboard: { input: 'keyboard', DAS: 6, ARR: 0, tap: 2, repeat: 5, switch: 4, first: 6, jitter: 1 },
  'keyboard-arr1': { input: 'keyboard', DAS: 6, ARR: 1, tap: 2, repeat: 5, switch: 4, first: 6, jitter: 1 },
  touch: { input: 'touch', DAS: 10, ARR: 1, tap: 4, repeat: 9, switch: 10, first: 12, jitter: 2 },
  'touch-slow': { input: 'touch', DAS: 10, ARR: 1, tap: 5, repeat: 12, switch: 14, first: 16, jitter: 2 },
};

// ---------------------------------------------------------------- in the page

/** Installs the planner and step helpers in the page (window.__mt). */
export function install() {
  const snapshot = () => Object.assign({}, piece);
  const restore = (s) => Object.assign(piece, s);
  const fall = () => {
    piece.y = Math.floor(piece.y) + piece.getDrop(22);
  };
  const cellsOf = (t, ox, oy) => {
    const out = [];
    for (let x = 0; x < t.length; x++) for (let y = 0; y < t[x].length; y++) if (t[x][y]) out.push([ox + x, oy + y]);
    return out;
  };
  // Runs a list of ops on the piece step by step, on the player's own clock (the same
  // timing as schedule(), without the jitter) and with the mode's gravity after every
  // step, so the planner knows where a piece can get: at 20G it cannot climb the stack,
  // at low gravity it can pass over it while it is still high. Lock delay is left out:
  // whether the player is quick enough is what gets measured.
  const HAND = { cw: 0, ccw: 0, '180': 0, drop: 0, L: 1, R: 1, WL: 1, WR: 1 };
  const sim = (ops, q) => {
    const g = modeGravity();
    const gravity = () => {
      if (!piece.moveValid(0, 1, piece.tetro)) {
        piece.y = Math.floor(piece.y);
        return;
      }
      if (g > 1) piece.y += piece.getDrop(g);
      else piece.y += g;
    };
    const walls = [];
    let now = 0; // the steps run so far
    const until = (t) => {
      while (now < t - 1) {
        gravity();
        now++;
      }
    };
    let t = Math.max(1, q.first);
    let last = null;
    for (const op of ops) {
      if (last) {
        const button = (o) => (o === 'WL' ? 'L' : o === 'WR' ? 'R' : o);
        t = last.seen + (button(last.op) === button(op) ? q.repeat : q.switch);
        if (HAND[last.op] === HAND[op]) t = Math.max(t, last.up + 1);
      }
      until(t);
      // Step t: the press, then gravity.
      const press = { op, seen: t, up: t + q.tap };
      if (op === 'cw') piece.rotate(1);
      else if (op === 'ccw') piece.rotate(-1);
      else if (op === '180') {
        piece.rotate(1);
        piece.rotate(1);
      } else {
        const d = op === 'L' || op === 'WL' ? -1 : 1;
        let n = 0;
        if (piece.moveValid(d, 0, piece.tetro)) {
          piece.x += d;
          n++;
        }
        if (op === 'WL' || op === 'WR') {
          // Held: DAS, then a cell every ARR + 1 steps (all at once with ARR 0), until it stops.
          gravity();
          now = t;
          let at = t + q.DAS;
          for (;;) {
            until(at);
            let moved = false;
            if (q.ARR === 0) {
              while (piece.moveValid(d, 0, piece.tetro)) {
                piece.x += d;
                n++;
                moved = true;
              }
            } else if (piece.moveValid(d, 0, piece.tetro)) {
              piece.x += d;
              n++;
              moved = true;
            }
            gravity();
            now = at;
            if (!moved || q.ARR === 0) break;
            press.seen = at;
            at += q.ARR + 1;
          }
          if (q.ARR === 0 && n > 1) press.seen = t + q.DAS;
          press.up = press.seen + q.switch;
          walls.push(n);
          last = press;
          continue;
        }
      }
      gravity();
      now = t;
      last = press;
    }
    // The hard drop.
    piece.y = Math.floor(piece.y) + piece.getDrop(22);
    return { x: piece.x, y: Math.floor(piece.y), pos: piece.pos, walls, cells: cellsOf(piece.tetro, piece.x, Math.floor(piece.y)) };
  };
  const climbW = 0.5;
  const evaluate = (cells) => {
    const g = stack.grid.map((c) => Array.from({ length: 22 }, (_, y) => !!c[y]));
    for (const [x, y] of cells) if (y >= 0) g[x][y] = true;
    let cleared = 0;
    for (let y = 0; y < 22; y++) {
      if (g.every((c) => c[y])) {
        cleared++;
        for (const c of g) {
          c.splice(y, 1);
          c.unshift(false);
        }
      }
    }
    let agg = 0;
    let holes = 0;
    let bump = 0;
    let max = 0;
    let prev = -1;
    const hs = [];
    for (const c of g) {
      const top = c.indexOf(true);
      const h = top < 0 ? 0 : 22 - top;
      hs.push(h);
      agg += h;
      max = Math.max(max, h);
      if (top >= 0) for (let y = top; y < 22; y++) if (!c[y]) holes++;
      if (prev >= 0) bump += Math.abs(h - prev);
      prev = h;
    }
    // At high gravity a piece cannot climb: every step up on the way from the spawn columns
    // (3 to 6) out to a wall walls off the columns behind it.
    let climb = 0;
    for (let x = 2; x >= 0; x--) climb += Math.max(0, hs[x] - Math.max(...hs.slice(x + 1, 7)));
    for (let x = 7; x <= 9; x++) climb += Math.max(0, hs[x] - Math.max(...hs.slice(3, x)));
    const centre = Math.max(hs[3], hs[4], hs[5], hs[6]);
    return -0.51 * agg + 0.76 * cleared - 0.36 * holes - 0.18 * bump - climbW * climb - (max > 14 ? (max - 14) * 2 : 0) - (centre > 12 ? (centre - 12) * 3 : 0);
  };
  const ROTS = (touch) => [[], ['cw'], ['ccw'], touch ? ['cw', 'cw'] : ['180']];
  const MOVES = (() => {
    const list = [[]];
    for (let k = 1; k <= 4; k++) {
      list.push(Array(k).fill('L'));
      list.push(Array(k).fill('R'));
    }
    for (const w of ['WL', 'WR']) {
      const back = w === 'WL' ? 'R' : 'L';
      list.push([w], [w, back], [w, back, back]);
    }
    return list;
  })();
  const presses = (ops) => ops.length;

  window.__mt = {
    /** Best reachable end position for the active piece, and the ops to get there. */
    plan(q, compare = true) {
      const touch = q.input === 'touch';
      // The same choice with the piece floating at its spawn height (no gravity): when it
      // is better, gravity kept the planner from its favourite placement.
      let free = null;
      if (compare) {
        const g = window.modeGravity;
        window.modeGravity = () => 0;
        free = this.plan(q, false);
        window.modeGravity = g;
      }
      const start = snapshot();
      const audio = window.audioManager;
      window.audioManager = undefined;
      let best = null;
      const seen = new Set();
      for (const rot of ROTS(touch)) {
        for (const mv of MOVES) {
          restore(start);
          const ops = rot.concat(mv);
          const end = sim(ops, q);
          const key = end.x + ',' + end.y + ',' + end.pos;
          if (seen.has(key)) continue;
          seen.add(key);
          const value = evaluate(end.cells) - presses(ops) * 0.001;
          if (!best || value > best.value) best = { value, ops, walls: end.walls, x: end.x, y: end.y, pos: end.pos };
        }
      }
      restore(start);
      window.audioManager = audio;
      if (free) best.blocked = free.value > best.value + 0.01;
      return best;
    },
    /** The end position of fixed ops from the current piece (for the wall sweep). */
    simulate(ops, q) {
      const start = snapshot();
      const audio = window.audioManager;
      window.audioManager = undefined;
      const end = sim(ops, q);
      restore(start);
      window.audioManager = audio;
      return end;
    },
    locks: [],
    /** Steps the game n times, stopping early when a piece locks or the game ends. */
    run(n) {
      const before = piecesSet;
      let i = 0;
      for (; i < n && (gameState === 0 || gameState === 2); i++) {
        step();
        if (piecesSet !== before) {
          i++;
          break;
        }
      }
      return this.info(i);
    },
    info(ran) {
      return { ran, frame, gameState, level, lines, pieces: piecesSet, index: piece.index, limit: lockLimit(), gravity: modeGravity(), locks: this.locks.length };
    },
  };
  // Where every piece locked, and how far its lock delay had run, recorded at the lock.
  const add = stack.addPiece;
  // The peak leaves out the hard drop, which runs the timer out on purpose.
  let peak = 0;
  let dropped = false;
  const update = piece.update;
  piece.update = function () {
    if (!dropped && this.lockDelay > peak) peak = this.lockDelay;
    return update.apply(this, arguments);
  };
  const hardDrop = piece.hardDrop;
  piece.hardDrop = function () {
    dropped = true;
    return hardDrop.apply(this, arguments);
  };
  stack.addPiece = function (tetro) {
    window.__mt.locks.push({
      frame,
      level,
      x: piece.x,
      y: Math.floor(piece.y),
      pos: piece.pos,
      cells: cellsOf(tetro, piece.x, Math.floor(piece.y)),
      peak,
      limit: lockLimit(),
      resets: piece.resets || 0,
    });
    peak = 0;
    dropped = false;
    return add.apply(this, arguments);
  };
}

// ---------------------------------------------------------------- players

const KEYS = { cw: 'KeyX', ccw: 'KeyZ', '180': 'ShiftLeft', L: 'ArrowLeft', R: 'ArrowRight', WL: 'ArrowLeft', WR: 'ArrowRight', drop: 'Space' };
const PADS = { cw: 'rotRight', ccw: 'rotLeft', L: 'moveLeft', R: 'moveRight', WL: 'moveLeft', WR: 'moveRight', drop: 'hardDrop' };

/** A small seeded PRNG (mulberry32). */
export function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Presses as [{ button, down, up }] in steps from the moment the piece spawned (the step of
 * the hard drop that locked the last one). `walls[i]` is how many cells the i-th hold to a
 * wall travels: the player watches the piece and reacts when it gets there (a `switch` gap
 * later), so a hold lasts the trip plus that reaction. Presses with the other hand (thumb)
 * may overlap; on the same hand the next press waits for the release. `over` replaces
 * profile fields for this piece.
 */
const HANDS = {
  // Keyboard: right hand on the arrows, left hand on rotations and drop. Touch: the pad's
  // left group (moves) and right group (drop, rotations).
  KeyX: 0, KeyZ: 0, ShiftLeft: 0, Space: 0, ArrowLeft: 1, ArrowRight: 1,
  rotRight: 0, rotLeft: 0, hardDrop: 0, moveLeft: 1, moveRight: 1,
};
export function schedule(ops, p, rand, over = {}, walls = []) {
  const q = { ...p, ...over };
  const j = () => (q.jitter ? Math.round((rand() * 2 - 1) * q.jitter) : 0);
  // Steps from pressing a held arrow until the piece has moved n cells.
  const travel = (n) => (n <= 1 ? 0 : q.ARR === 0 ? q.DAS : q.DAS + (n - 2) * (q.ARR + 1));
  const out = [];
  let t = Math.max(1, q.first + j());
  let last = null;
  let w = 0;
  for (const op of [...ops, 'drop']) {
    const button = q.input === 'touch' ? PADS[op] : KEYS[op];
    if (last) {
      const gap = last.button === button ? q.repeat : q.switch;
      t = last.seen + Math.max(1, gap + j());
      if (HANDS[last.button] === HANDS[button]) t = Math.max(t, last.up + 1);
    }
    const press = { op, button, down: t };
    if (op === 'WL' || op === 'WR') {
      press.seen = t + travel(walls[w++] ?? 9);
      press.up = press.seen + Math.max(1, q.switch + j());
    } else {
      press.seen = t;
      press.up = t + Math.max(1, q.tap + (j() > 0 ? 1 : 0));
    }
    out.push(press);
    last = press;
  }
  return out;
}

/** Drives one page: keyboard through page.keyboard, touch through CDP touch events. */
export async function makeDriver(page, input) {
  let cdp = null;
  let rects = null;
  const active = new Map();
  if (input === 'touch') cdp = await page.context().newCDPSession(page);
  const points = () => [...active.values()].map((r) => ({ x: r.x, y: r.y, id: r.id }));
  async function down(button) {
    if (input === 'keyboard') return page.keyboard.down(button);
    if (!rects) {
      // The pad shows (and the board makes room for it) once a game is under way.
      await page.waitForFunction(() => document.documentElement.classList.contains("tt-playing"));
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      rects = await page.evaluate(() => {
        const out = {};
        let id = 1;
        for (const b of document.querySelectorAll('#pad button')) {
          const r = b.getBoundingClientRect();
          out[b.dataset.act] = { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, id: id++ };
        }
        return out;
      });
    }
    active.set(button, rects[button]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points() });
  }
  async function up(button) {
    if (input === 'keyboard') return page.keyboard.up(button);
    if (!active.has(button)) return;
    active.delete(button);
    // A touchEnd lifts every finger; lifting one of several is a touchMove without it.
    const rest = points();
    await cdp.send('Input.dispatchTouchEvent', rest.length ? { type: 'touchMove', touchPoints: rest } : { type: 'touchEnd', touchPoints: [] });
  }
  async function releaseAll() {
    if (input === 'keyboard') {
      for (const k of new Set(Object.values(KEYS))) await page.keyboard.up(k);
    } else {
      for (const b of [...active.keys()]) await up(b);
    }
  }
  return { down, up, releaseAll, rects: () => rects, held: () => [...active.keys()] };
}

/**
 * Plays presses for the active piece, from the step it spawned. Stops at the first lock
 * (planned after the drop, or early). Returns { early, lock }.
 */
export async function play(page, driver, presses) {
  const events = [];
  for (const p of presses) {
    events.push([p.down, 'down', p]);
    events.push([p.up, 'up', p]);
  }
  events.sort((a, b) => a[0] - b[0] || (a[1] === 'up' ? -1 : 1));
  const start = await page.evaluate(() => window.__mt.info(0));
  let t = 0;
  let dropped = false;
  let info = start;
  for (let i = 0; i < events.length; ) {
    const at = events[i][0];
    if (at > t) {
      info = await page.evaluate((n) => window.__mt.run(n), at - t);
      t += info.ran;
      if (info.pieces !== start.pieces || info.gameState !== 0) break;
      continue;
    }
    for (; i < events.length && events[i][0] === t; i++) {
      const [, kind, p] = events[i];
      if (kind === 'down') {
        await driver.down(p.button);
        if (p.op === 'drop') dropped = true;
      } else await driver.up(p.button);
    }
    // The step these presses belong to.
    info = await page.evaluate(() => window.__mt.run(1));
    t += 1;
    if (info.pieces !== start.pieces || info.gameState !== 0) break;
  }
  // Let the piece lock if it hasn't (the drop's step locks it).
  for (let k = 0; k < 120 && info.pieces === start.pieces && info.gameState === 0; k++) info = await page.evaluate(() => window.__mt.run(1));
  await driver.releaseAll();
  const lock = await page.evaluate((n) => window.__mt.locks[n] || null, start.locks);
  return { early: !dropped, lock, info, steps: t };
}

/** Starts a Master game with the clock held, through the countdown, seeded. */
export async function startMaster(page, p, seed) {
  await page.evaluate(
    ({ p, seed }) => {
      Object.assign(settings, { DAS: p.DAS, ARR: p.ARR, Gravity: 0, 'Soft Drop': 31, 'Lock Delay': 30 });
      let s = seed;
      const real = Math.random;
      Math.random = () => ((s = (s * 48271) % 2147483647) / 2147483647);
      init(8);
      Math.random = real;
      stepper.advance = () => 0;
      window.__mt.locks.length = 0;
      while (gameState === 2) step();
    },
    { p, seed },
  );
}

// ---------------------------------------------------------------- measurements

async function wallSweep(page, name, p) {
  const driver = await makeDriver(page, p.input);
  const touch = p.input === 'touch';
  const rots = touch ? [[], ['cw'], ['ccw'], ['cw', 'cw']] : [[], ['cw'], ['ccw'], ['180']];
  const rand = prng(7);
  const rows = [];
  for (let lv = 1; lv <= 15; lv++) {
    let ok = 0;
    let total = 0;
    const fails = [];
    for (let index = 0; index < 7; index++) {
      for (const rot of rots) {
        for (const wall of ['WL', 'WR']) {
          await startMaster(page, p, 1000 + index);
          await page.evaluate(({ lv, index }) => {
            level = lv;
            piece.new(index);
          }, { lv, index });
          const ops = rot.concat([wall]);
          const want = await page.evaluate(({ ops, q }) => window.__mt.simulate(ops, q), { ops, q: p });
          const res = await play(page, driver, schedule(ops, p, rand, {}, want.walls));
          total++;
          const at = res.lock && res.lock.x === want.x && res.lock.pos === want.pos && !res.early;
          if (at) ok++;
          else fails.push(`${'IJLOSTZ'[index]}${rot.join('') || '0'}${wall}`);
        }
      }
    }
    const limit = await page.evaluate((lv) => {
      level = lv;
      return lockLimit();
    }, lv);
    // Timing budget: the vertical I piece to either wall, with later and later presses
    // (binary search; a later press never helps).
    const budget = {};
    const reaches = async (over) => {
      for (const wall of ['WL', 'WR']) {
        await startMaster(page, p, 99);
        await page.evaluate((lv) => {
          level = lv;
          piece.new(0);
        }, lv);
        const ops = ['cw', wall];
        const want = await page.evaluate(({ ops, q }) => window.__mt.simulate(ops, q), { ops, q: { ...p, ...over } });
        const res = await play(page, driver, schedule(ops, p, rand, { ...over, jitter: 0 }, want.walls));
        if (!(res.lock && res.lock.x === want.x && !res.early)) return false;
      }
      return true;
    };
    for (const field of ['first', 'switch']) {
      let lo = 0;
      let hi = 61;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (await reaches({ [field]: mid })) lo = mid;
        else hi = mid;
      }
      budget[field] = lo;
    }
    // Stalling: rotate back and forth on the floor, a press every limit - 1 steps, for up
    // to 20 seconds. How many presses until it locks anyway?
    await startMaster(page, p, 99);
    await page.evaluate((lv) => {
      level = lv;
      piece.new(6);
    }, lv);
    const every = Math.max(1, limit - 1);
    const stallOps = [];
    for (let k = 0; k < Math.floor(1200 / every); k++) stallOps.push(k % 2 ? 'ccw' : 'cw');
    const stallPresses = schedule(stallOps, p, rand, { first: 4, switch: every, repeat: every, jitter: 0 }).slice(0, -1);
    const stall = await play(page, driver, stallPresses);
    budget.stall = stall.lock && stall.steps <= stallPresses[stallPresses.length - 1].down ? stall.steps : null;
    rows.push({ level: lv, limit, ok, total, fails: fails.slice(0, 6), budget });
  }
  console.log(`\nWalls, ${name} (DAS ${p.DAS}, ARR ${p.ARR}; profile first ${p.first}, switch ${p.switch}, repeat ${p.repeat} steps):`);
  console.log('  level  lock  reached walls  max spawn->1st press  max rotate->move  stalling locks after  misses');
  for (const r of rows) {
    console.log(
      `  ${String(r.level).padStart(5)}  ${String(r.limit).padStart(4)}  ${`${r.ok}/${r.total}`.padStart(13)}  ${`${r.budget.first} (${Math.round((r.budget.first * 1000) / 60)} ms)`.padStart(20)}  ${`${r.budget.switch} (${Math.round((r.budget.switch * 1000) / 60)} ms)`.padStart(16)}  ${(r.budget.stall === null ? 'never (20 s)' : `${r.budget.stall} steps`).padStart(20)}  ${r.fails.join(' ')}`,
    );
  }
  return rows;
}

async function games(page, name, p) {
  const driver = await makeDriver(page, p.input);
  const touch = p.input === 'touch';
  const results = [];
  const perLevel = {};
  for (let g = 0; g < GAMES; g++) {
    const seed = 500 + g * 7919;
    const rand = prng(seed);
    await startMaster(page, p, seed);
    let info = await page.evaluate(() => window.__mt.info(0));
    let early = 0;
    let wrong = 0;
    while (info.gameState === 0 && info.pieces < 1600) {
      const plan = await page.evaluate((q) => window.__mt.plan(q), p);
      const lv = info.level;
      const res = await play(page, driver, schedule(plan.ops, p, rand, {}, plan.walls));
      const L = (perLevel[lv] ||= { pieces: 0, early: 0, wrong: 0, blocked: 0, resets: 0, limit: info.limit, gravity: info.gravity, slackMin: Infinity });
      L.pieces++;
      if (plan.blocked) L.blocked++;
      if (res.lock && res.lock.resets > L.resets) L.resets = res.lock.resets;
      if (res.lock) {
        const slack = res.lock.limit - res.lock.peak;
        if (!res.early && slack < L.slackMin) L.slackMin = slack;
      }
      if (res.early) {
        early++;
        L.early++;
      } else if (!res.lock || res.lock.x !== plan.x || res.lock.y !== plan.y || res.lock.pos !== plan.pos) {
        wrong++;
        L.wrong++;
      }
      info = res.info;
    }
    results.push({ seed, level: info.level, lines: info.lines, pieces: info.pieces, won: info.gameState === 1, early, wrong });
  }
  console.log(`\nGames, ${name} (${GAMES} seeded Master games):`);
  for (const r of results) {
    console.log(`  seed ${String(r.seed).padStart(5)}: ${r.won ? 'cleared 150 lines' : 'topped out'} at level ${r.level}, ${r.lines} lines, ${r.pieces} pieces; ${r.early} locked before the drop, ${r.wrong} elsewhere`);
  }
  const lv = results.map((r) => r.level).sort((a, b) => a - b);
  console.log(`  median level ${lv[Math.floor(lv.length / 2)]}, mean lines ${(results.reduce((a, r) => a + r.lines, 0) / results.length).toFixed(1)}, wins ${results.filter((r) => r.won).length}/${results.length}`);
  console.log('  level  gravity  lock  pieces  early  elsewhere  gravity-blocked  most resets  tightest slack (steps left on the lock timer)');
  for (const [k, L] of Object.entries(perLevel)) {
    const blocked = `${L.blocked} (${Math.round((100 * L.blocked) / L.pieces)}%)`;
    console.log(`  ${k.padStart(5)}  ${(L.gravity >= 1 ? `${L.gravity}G` : `1/${Math.round(1 / L.gravity)}G`).padStart(7)}  ${String(L.limit).padStart(4)}  ${String(L.pieces).padStart(6)}  ${String(L.early).padStart(5)}  ${String(L.wrong).padStart(9)}  ${blocked.padStart(15)}  ${String(L.resets).padStart(11)}  ${L.slackMin === Infinity ? '-' : L.slackMin}`);
  }
  return { results, perLevel };
}

// ---------------------------------------------------------------- main

if (import.meta.url === `file://${process.argv[1]}`) {
  const check = await startCheck('Tetris Master playtest (measurements, not a pass/fail check)');
  await check.run(async () => {
    for (const name of INPUTS) {
      const p = PLAYERS[name];
      const touch = p.input === 'touch';
      const page = await check.open('Tetris/index.html', touch ? { viewport: { width: 390, height: 844 }, touch: true } : {});
      await page.waitForFunction(() => typeof init === 'function' && typeof Touch !== 'undefined');
      await page.evaluate(() => localStorage.clear());
      await page.evaluate(install);
      if (NO_RESET) {
        await page.evaluate(() => {
          const valid = Piece.prototype.moveValid;
          Piece.prototype.moveValid = function () {
            const keep = this.lockDelay;
            const ok = valid.apply(this, arguments);
            if (landed) this.lockDelay = keep;
            return ok;
          };
        });
      }
      if (RAMP !== null) {
        await page.evaluate((ramp) => {
          const base = modeGravity;
          window.modeGravity = () => (gametype === 8 ? (ramp[level - 1] ?? 20) : base());
        }, RAMP.split(',').map(Number));
      }
      if (FLOOR !== null) {
        await page.evaluate((floor) => {
          const base = lockLimit;
          window.lockLimit = () => (gametype === 8 ? Math.max(floor, base()) : base());
        }, Number(FLOOR));
      }
      if (touch) {
        const on = await page.evaluate(() => Touch.enabled);
        check.ok(on, 'the phone page uses touch controls');
      }
      if (ONLY !== 'games') await wallSweep(page, name, p);
      if (ONLY !== 'walls') await games(page, name, p);
      check.noErrors(page);
    }
  });
}
