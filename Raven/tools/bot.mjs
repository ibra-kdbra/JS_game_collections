// A Raven bot that plays through the real game logic (tools/sim.mjs).
//
// The bot walks a breadth-first path toward the next goal (terminals in a
// chosen order, then the exit), stepping aside when another move leaves fewer
// Raven able to reach it, and points its line of sight where the fewest Raven
// could attack it unseen. Both are scored with the game's own enemy code
// (Enemy._bestAttackAngle on a trial vision cone and attack grid).
//
// A search wraps the bot: the run is cut into half-second segments, each with
// a few random choices (how to move, how much to weigh danger against
// progress, aim jitter). When the player dies, or makes no progress for 8 s,
// the search rewinds a few segments and draws new choices; after enough
// deaths it starts over with another terminal order. The inputs of a
// successful attempt form a recorded run that replays deterministically.
import { createLevel, aimVector, fastAttackGrid, DT } from "./sim.mjs";

export const SEG = 30; // steps per decision segment (0.5 s)

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const angDiff = (a, b) => { let d = ((a - b) % 360 + 540) % 360 - 180; return d; };

export function makeBrain(lv) {
  const { game, ctx } = lv;
  const Util = ctx.__R.Util;
  const L = game.level;
  const W = L.width, H = L.height;
  const fieldCache = new Map();

  // tiles a statue stands on or next to (touching one kills, frozen or not)
  let nearEnemy = new Set();
  let avoidEnemies = true;
  const markEnemies = () => {
    nearEnemy = new Set();
    for (const e of game.enemies) {
      for (let v = Math.floor((e.y - 26) / 32); v <= Math.floor((e.y + 26) / 32); v++) {
        for (let u = Math.floor((e.x - 26) / 32); u <= Math.floor((e.x + 26) / 32); u++) {
          if (Math.hypot(u * 32 + 16 - e.x, v * 32 + 16 - e.y) < 15) nearEnemy.add(v * W + u);
        }
      }
    }
    return [...nearEnemy].sort((a, b) => a - b).join(".");
  };
  const blocked = (u, v) => {
    if (u < 0 || v < 0 || u >= W || v >= H) return true;
    if (Util.wallAtUV(u, v)) return true;
    if (avoidEnemies && nearEnemy.has(v * W + u) && !(u === Math.floor(game.player.x / 32) && v === Math.floor(game.player.y / 32))) return true;
    for (const d of game.doors) if (d.locked && d.v === v && (d.u === u || d.u + 1 === u)) return true;
    return false;
  };

  // distance (in tiles) to goal tile, by BFS over open tiles
  // (when statues close every way, the plain map is used instead)
  const field = (gu, gv) => {
    avoidEnemies = true;
    let dist = field1(gu, gv);
    const here = Math.floor(game.player.y / 32) * W + Math.floor(game.player.x / 32);
    if (!isFinite(dist[here])) { avoidEnemies = false; dist = field1(gu, gv); avoidEnemies = true; }
    return dist;
  };
  const field1 = (gu, gv) => {
    const key = gu + "," + gv + game.doors.map((d) => (d.locked ? 1 : 0)).join("") + "|" + (avoidEnemies ? markEnemies() : "-") + "|" + Math.floor(game.player.x / 32) + "," + Math.floor(game.player.y / 32);
    if (fieldCache.has(key)) return fieldCache.get(key);
    const dist = new Float64Array(W * H).fill(Infinity);
    const q = [[gu, gv]];
    dist[gv * W + gu] = 0;
    if (fieldCache.size > 500) fieldCache.clear();
    for (let i = 0; i < q.length; i++) {
      const [u, v] = q[i];
      for (const [du, dv, c] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]]) {
        const nu = u + du, nv = v + dv;
        if (blocked(nu, nv)) continue;
        if (du && dv && (blocked(u + du, v) || blocked(u, v + dv))) continue;
        const nd = dist[v * W + u] + c;
        if (nd < dist[nv * W + nu]) { dist[nv * W + nu] = nd; q.push([nu, nv]); }
      }
    }
    fieldCache.set(key, dist);
    return dist;
  };

  const los = (a, b) => {
    const n = Math.ceil(Util.distance(a, b) / 6);
    for (let i = 1; i < n; i++) {
      const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
      if (Util.wallAtXY(x, y) || Util.doorAtXY(x, y)) return false;
    }
    return true;
  };

  const coveredByOthers = (e) => {
    const polys = game.player.dead ? game.vision : (game.vision || []).slice(0, -1);
    const dx = e.width / 2, dy = e.height / 2;
    const pts = [[e.x, e.y], [e.x - dx, e.y - dy], [e.x + dx, e.y + dy], [e.x - dx, e.y + dy], [e.x + dx, e.y - dy]];
    return polys.some((poly) => pts.some(([x, y]) => Util.pointInPolygon({ x, y }, poly)));
  };

  // Raven that matter now: awake, or about to wake, and not held by a camera
  const relevant = () => game.enemies.filter((e) => {
    if (coveredByOthers(e)) return false;
    if (e.state !== "asleep") return true;
    if (e.wake === "los") return los(e, game.player);
    return Util.distance(e, game.player) < e.wakeRadius + 40;
  });

  // How exposed the player is when looking at `theta` degrees: every relevant
  // Raven not in sight that the real enemy code would find an attack angle
  // for, weighted by closeness; plus a small cost per sleeping Raven looked at
  // (a statue that has been seen wakes up once it is out of sight again).
  const exposure = (theta, rel) => {
    const saved = { facing: game.facing, vision: game.vision, attackGrid: game.attackGrid };
    const others = !game.vision ? [] : game.player.dead ? game.vision : game.vision.slice(0, -1);
    game.facing = theta;
    game.vision = others.concat(Util.getVisCone(game.player, theta, game.fov, 4, 0, 1));
    fastAttackGrid(game, Util);
    let score = 0;
    for (const e of rel) {
      if (Util.entitySpotted(e)) continue;
      if (e._bestAttackAngle() !== undefined) score += 1 / Math.max(20, Util.distance(e, game.player));
    }
    for (const e of game.enemies) {
      if (e.state === "asleep" && !rel.includes(e) && Util.entitySpotted(e)) score += 1e-4;
    }
    Object.assign(game, saved);
    return score;
  };

// Movement keys toward goal g ({x, y}); returns { keys, dir } (dir in degrees or undefined)
  function walk(g, mode) {
    const p = game.player;
    const gu = Math.floor(g.x / 32), gv = Math.floor(g.y / 32);
    const u = Math.floor(p.x / 32), v = Math.floor(p.y / 32);
    let target;
    if (u === gu && v === gv) target = g;
    else {
      const dist = field(gu, gv);
      let best = dist[v * W + u], bu = u, bv = v;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nu = u + du, nv = v + dv;
        if (nu < 0 || nv < 0 || nu >= W || nv >= H) continue;
        if (du && dv && (blocked(u + du, v) || blocked(u, v + dv))) continue;
        const d = dist[nv * W + nu];
        if (d < best) { best = d; bu = nu; bv = nv; }
      }
      target = { x: bu * 32 + 16, y: bv * 32 + 16 };
      if (bu === u && bv === v) target = g;
    }
    let dx = target.x - p.x, dy = target.y - p.y;
    if (mode === "back") { dx = -dx; dy = -dy; }
    const keys = {};
    if (mode !== "hold") {
      if (dx > 3) keys.right = true; else if (dx < -3) keys.left = true;
      if (dy > 3) keys.down = true; else if (dy < -3) keys.up = true;
    }
    return { keys, dir: Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) * 180 / Math.PI : undefined };
  }

  // Candidate aims: toward each Raven that matters and between pairs of them
  const aimCandidates = (rel, extra) => {
    const p = game.player;
    const angs = rel.map((e) => Math.atan2(e.y - p.y, e.x - p.x) * 180 / Math.PI);
    const cands = [...angs, ...extra];
    for (let i = 0; i < angs.length; i++) for (let j = i + 1; j < angs.length; j++) {
      const d = angDiff(angs[j], angs[i]);
      if (Math.abs(d) < 115) cands.push(angs[i] + d / 2);
    }
    return cands;
  };

  // Lowest exposure reachable by turning, with the player at (x, y)
  const bestExposureAt = (x, y, extra) => {
    const p = game.player;
    const ox = p.x, oy = p.y;
    p.x = x; p.y = y;
    try {
      const rel = relevant();
      if (!rel.length) return 0;
      let best = Infinity;
      for (const a of aimCandidates(rel, extra)) {
        best = Math.min(best, exposure(a, rel));
        if (best === 0) break;
      }
      return best;
    } finally { p.x = ox; p.y = oy; }
  };

  const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const keysFor = ([dx, dy]) => ({ right: dx > 0, left: dx < 0, down: dy > 0, up: dy < 0 });

  // Walk toward the goal unless a step elsewhere leaves fewer Raven able to
  // reach the player unseen: each of the nine moves is scored by the exposure
  // a quarter second ahead (with the best aim there) times `weight`, plus the
  // remaining path length in pixels.
  const smartMove = (g, weight, prevAim) => {
    const w = walk(g, "go");
    const p = game.player;
    if (!relevant().length) return { ...w, walk: true };
    const gu = Math.floor(g.x / 32), gv = Math.floor(g.y / 32);
    const dist = field(gu, gv);
    const wd = [w.keys.right ? 1 : w.keys.left ? -1 : 0, w.keys.down ? 1 : w.keys.up ? -1 : 0];
    let best = null, bestCost = Infinity;
    for (const d of [wd, ...DIRS]) {
      const x = p.x + d[0] * 26, y = p.y + d[1] * 26;
      if ((d[0] || d[1]) && (Util.wallAtXY(x, y) || Util.doorAtXY(x, y))) continue;
      if ((d[0] || d[1]) && game.enemies.some((e) => Math.hypot(e.x - x, e.y - y) < 20)) continue;
      const u = Math.floor(x / 32), v = Math.floor(y / 32);
      const gd = u === gu && v === gv ? 0 : dist[v * W + u];
      if (!isFinite(gd)) continue;
      const cost = bestExposureAt(x, y, prevAim !== undefined ? [prevAim] : []) * weight + gd * 32 + Math.hypot(x - g.x, y - g.y) * 0.01;
      if (cost < bestCost - 1e-9) { bestCost = cost; best = d; }
    }
    if (!best || (best[0] === wd[0] && best[1] === wd[1])) return { ...w, walk: true };
    return { keys: keysFor(best), dir: best[0] || best[1] ? Math.atan2(best[1], best[0]) * 180 / Math.PI : w.dir };
  };

  return {
    field, los, relevant, exposure, aimCandidates, smartMove,
    walk,
  };
}

// Pick an aim angle: the candidate directions (toward each Raven that
// matters, between pairs of them, along the walk, the last aim) are scored by
// brain.exposure and the least exposed wins; `choice` breaks ties.
export function chooseAim(brain, game, moveDir, prevAim, choice) {
  const rel = brain.relevant();
  const base = moveDir !== undefined ? moveDir : prevAim !== undefined ? prevAim : 0;
  const cands = brain.aimCandidates(rel, [0, 30, -30, 60, -60, 90, -90].map((o) => base + o));
  if (prevAim !== undefined) cands.push(prevAim);
  let best, bestScore = Infinity;
  for (const a of cands) {
    let s = brain.exposure(a, rel);
    const tie = choice === "move" ? Math.abs(angDiff(a, base)) : prevAim !== undefined ? Math.abs(angDiff(a, prevAim)) : 0;
    s += tie * 1e-7;
    if (s < bestScore) { bestScore = s; best = a; }
  }
  return Math.round(best);
}

// Goals for an order of terminals: each terminal, then the exit.
export function goalsFor(game, order) {
  const exit = game.level.exit;
  return [...order.map((i) => ({ x: game.terminals[i].x, y: game.terminals[i].y, terminal: i })),
    { x: (exit.p1.x + exit.p2.x) / 2, y: (exit.p1.y + exit.p2.y) / 2 }];
}

const permutations = (n) => {
  if (n === 0) return [[]];
  const out = [];
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
};

// One step of the bot with segment choices `c`; returns the input it used.
function botStep(lv, brain, st, c) {
  const game = lv.game;
  const goal = st.goals[st.gi];
  if (c.mode === "smart") {
    if (st.t % 8 === 0 || !st.move) st.move = brain.smartMove(goal, c.weight, st.aim);
  } else st.move = brain.walk(goal, c.mode);
  const { keys, dir } = st.move.walk ? brain.walk(goal, "go") : st.move;
  let aim = st.aim;
  if (st.t++ % 4 === 0 || aim === undefined) {
    aim = chooseAim(brain, game, dir, st.aim, c.watch);
    aim = Math.round(aim + c.jitter);
  }
  st.aim = aim;
  let use = false;
  if (goal.terminal !== undefined) {
    const t = game.terminals[goal.terminal];
    if (!t.enabled && Math.hypot(t.x - game.player.x, t.y - game.player.y) <= t.toggleRadius - 2 && game._activeTerminal === t) use = true;
  }
  const input = { keys, aim: aim === undefined ? undefined : aimVector(aim), use };
  lv.step(input);
  if (goal.terminal !== undefined && game.terminals[goal.terminal].enabled) st.gi++;
  return input;
}

const MODES = ["smart", "smart", "smart", "smart", "go", "hold", "back"];
const WATCH = ["steady", "steady", "move"];

function drawChoice(r, noise) {
  return {
    mode: MODES[Math.floor(r() * MODES.length)],
    weight: 2000 * Math.pow(10, r()),
    watch: WATCH[Math.floor(r() * WATCH.length)],
    jitter: (r() - 0.5) * 2 * noise,
  };
}

// Search for a clearing run. Returns { run, steps, deaths } or null.
export function search(index, { seed = 1, maxSteps = 60 * 240, maxDeaths = 400, perAttempt = 80, noise = 6, view, sim = { fast: true } } = {}) {
  const lv0 = createLevel(index, { view, ...sim });
  const nT = lv0.game.terminals.length;
  const orders = permutations(nT);
  let deaths = 0;
  // Attempts restart from the beginning with the next terminal order once
  // `perAttempt` deaths have gone by without a clear.
  for (let attempt = 0; deaths < maxDeaths && attempt < 40; attempt++) {
    const oi = attempt % orders.length;
    const r = rng(seed * 7919 + attempt);
    const lv = createLevel(index, { view, ...sim });
    const brain = makeBrain(lv);
    const st = { goals: goalsFor(lv.game, orders[oi]), gi: 0, aim: undefined, t: 0 };
    const checkpoints = []; // { snap, st, inputsLen }
    const inputs = [];
    const fails = [];
    let choice = { mode: "smart", weight: 6000, watch: "steady", jitter: 0 };
    let budget = Math.min(perAttempt, maxDeaths - deaths);
    while (inputs.length < maxSteps) {
      if (inputs.length % SEG === 0) {
        const k = inputs.length / SEG;
        checkpoints[k] = { snap: lv.snapshot(), st: { ...st }, len: inputs.length };
        checkpoints.length = k + 1;
        fails[k] = fails[k] || 0;
        choice = fails[k] === 0 && k % 2 === 0 ? { mode: "smart", weight: 6000, watch: "steady", jitter: 0 } : drawChoice(r, noise);
      }
      inputs.push(botStep(lv, brain, st, choice));
      if (lv.cleared) return { run: inputs, steps: inputs.length, deaths, order: orders[oi] };
      // no progress toward the goal for 8 s counts as a failure too
      const g = st.goals[st.gi];
      const pu = Math.floor(lv.game.player.x / 32), pv = Math.floor(lv.game.player.y / 32);
      const gd = brain.field(Math.floor(g.x / 32), Math.floor(g.y / 32))[pv * lv.game.level.width + pu];
      if (!st.prog || st.gi > st.prog.gi || gd < st.prog.d - 0.5) st.prog = { gi: st.gi, d: gd, at: inputs.length };
      if (lv.dead || inputs.length - st.prog.at > 480) {
        deaths++;
        if (--budget <= 0) break;
        // rewind further back the more often this stretch has failed
        const k0 = Math.floor((inputs.length - 1) / SEG);
        fails[k0] = (fails[k0] || 0) + 1;
        fails.length = k0 + 1;
        const k = Math.max(0, k0 - 1 - Math.floor(fails[k0] / 4));
        for (let j = k; j < k0; j++) fails[j] = Math.max(1, fails[j] || 0);
        const cp = checkpoints[k];
        lv.restore(cp.snap);
        Object.assign(st, cp.st);
        inputs.length = cp.len;
        checkpoints.length = k + 1;
      }
    }
  }
  return null;
}

// The plain bot, no rewinding. `noise` adds a random aim error (degrees,
// redrawn every 0.2 s) and `delay` makes it react late (steps), a rough
// stand-in for a human. Returns { cleared, steps, dead }.
export function playOnce(index, { order, noise = 0, delay = 0, seed = 1, maxSteps = 60 * 240, view, sim = { fast: true } } = {}) {
  const lv = createLevel(index, { view, ...sim });
  const brain = makeBrain(lv);
  const r = rng(seed);
  const game = lv.game;
  const st = { goals: goalsFor(game, order || [...Array(game.terminals.length).keys()]), gi: 0, aim: undefined, t: 0 };
  const history = [];
  let jitter = 0;
  for (let i = 0; i < maxSteps; i++) {
    if (i % 12 === 0) jitter = (r() - 0.5) * 2 * noise;
    const goal = st.goals[st.gi];
    if (i % 8 === 0 || !st.move) st.move = brain.smartMove(goal, 6000, st.aim);
    const { keys, dir } = st.move.walk ? brain.walk(goal, "go") : st.move;
    if (i % 4 === 0 || st.aim === undefined) st.aim = chooseAim(brain, game, dir, st.aim, "steady");
    history.push(st.aim);
    const late = history[Math.max(0, history.length - 1 - delay)];
    let use = false;
    if (goal.terminal !== undefined) {
      const t = game.terminals[goal.terminal];
      if (!t.enabled && game._activeTerminal === t && Math.hypot(t.x - game.player.x, t.y - game.player.y) <= t.toggleRadius - 2) use = true;
    }
    lv.step({ keys, aim: aimVector(Math.round(late + jitter)), use });
    if (goal.terminal !== undefined && game.terminals[goal.terminal].enabled) st.gi++;
    if (lv.cleared) return { cleared: true, steps: i + 1 };
    if (lv.dead) return { cleared: false, dead: true, steps: i + 1 };
  }
  return { cleared: false, steps: maxSteps };
}

// Replay a recorded run from a fresh level. Returns the step it cleared on, or -1.
export function replay(index, run, { view, sim = {} } = {}) {
  const lv = createLevel(index, { view, ...sim });
  for (let i = 0; i < run.length; i++) {
    lv.step(run[i]);
    if (lv.dead) return -1;
    if (lv.cleared) return i + 1;
  }
  return -1;
}

// Runs are stored as text: one token per stretch of identical steps,
// "<keys>:<dx>,<dy>x<steps>" with keys from U D L R (none: "-") and E for
// pressing the terminal key on that step; the aim is the crosshair offset.
export function encodeRun(run) {
  const tok = (s) => {
    const k = (s.keys.up ? "U" : "") + (s.keys.down ? "D" : "") + (s.keys.left ? "L" : "") + (s.keys.right ? "R" : "") + (s.use ? "E" : "");
    return (k || "-") + (s.aim ? ":" + s.aim[0] + "," + s.aim[1] : "");
  };
  const out = [];
  for (const s of run) {
    const t = tok(s);
    if (out.length && out[out.length - 1][0] === t) out[out.length - 1][1]++;
    else out.push([t, 1]);
  }
  return out.map(([t, n]) => t + "x" + n).join(" ");
}

export function decodeRun(text) {
  const run = [];
  for (const tok of text.trim().split(/\s+/)) {
    const m = /^([-UDLRE]+)(?::(-?\d+),(-?\d+))?x(\d+)$/.exec(tok);
    if (!m) throw new Error("bad run token " + tok);
    const keys = { up: m[1].includes("U"), down: m[1].includes("D"), left: m[1].includes("L"), right: m[1].includes("R") };
    const aim = m[2] !== undefined ? [+m[2], +m[3]] : undefined;
    for (let i = 0; i < +m[4]; i++) run.push({ keys, aim, use: m[1].includes("E") });
  }
  return run;
}

export { DT };
