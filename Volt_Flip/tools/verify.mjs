/**
 * Checks Volt Flip without a browser:
 *   node Volt_Flip/tools/verify.mjs [--seeds 12] [--metres 4000]
 *
 * 1. The same seed always builds the same course; different seeds differ.
 * 2. Physics: a flip crosses the corridor in FLIP_TIME, holes kill, taps buffer.
 * 3. Fairness: the look-ahead bot plays generated courses through the real
 *    simulation, with no shield, and must survive to the target distance on
 *    every seed. A forced change of side always leaves one flip plus the
 *    reaction margin of room (checked on the built patterns).
 * 4. The ramp: speed rises and the reaction margin shrinks band by band, and
 *    a casual bot (short look-ahead, late reactions) dies further out on
 *    average than a casual bot that only meets the first band. Prints a table.
 * 5. The campaign: every level builds, leaves fair room at every forced
 *    flip, and the look-ahead bot finishes it without a hit (the no-hit star);
 *    a shard-seeking version also takes the shard star in the same run. A
 *    casual bot plays each level with its shield, and its finish rate per
 *    level and chapter shows the ramp. Prints a table.
 * Exits non-zero on any failure.
 */
import { DT, FLIP_TIME, PLAYER, SPEED, UNITS_PER_METRE, WORLD, marginAt, speedAt } from '../js/config.js';
import { CEIL, FLOOR, buildLevel, courseSpeed, createCourse, extend, fingerprint, surfaceY } from '../js/course.js';
import { CHAPTERS, LEVELS, shardTarget } from '../js/levels.js';
import { canFlip, createPlayer, createWorld, metres, step, stepPlayer } from '../js/sim.js';
import { createRng } from '../js/rng.js';
import { botWantsFlip } from '../js/bot.js';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const SEEDS = arg('--seeds', 12);
const TARGET = arg('--metres', 4000);
const CASUAL_RUNS = arg('--casual', 48);
const ONLY = process.argv.includes('--campaign'); // skip the endless checks

/**
 * A casual player: looks 0.6 s ahead, notices every third step, and taps once,
 * 0.2 to 0.4 s after it decides to. Plays w until it ends or stop(w) is true.
 */
function playCasual(w, rng, stop = () => false) {
  let tapAt = -1;
  while (!w.over && !stop(w)) {
    if (tapAt < 0 && canFlip(w.p) && w.steps % 3 === 0 && botWantsFlip(w, { horizon: 0.6, eager: true })) {
      tapAt = w.steps + 12 + Math.floor(rng() * 13);
    }
    const tap = w.steps === tapAt;
    if (tap) tapAt = -1;
    step(w, tap);
  }
  return w;
}

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};
const ok = (msg) => console.log(`  ok ${msg}`);

if (!ONLY) {
/* ------------------------------------------------------------ 1. seeds */
console.log('1. Deterministic courses');
{
  const a = createCourse(7);
  const b = createCourse(7);
  const c = createCourse(8);
  extend(a, 60000);
  extend(b, 60000);
  extend(c, 60000);
  const fa = fingerprint(a, 60000);
  if (fa !== fingerprint(b, 60000)) fail('seed 7 built two different courses');
  else ok(`seed 7 builds the same 6 km course twice (${fa})`);
  if (fa === fingerprint(c, 60000)) fail('seeds 7 and 8 built the same course');
  else ok('seeds 7 and 8 differ');
}

/* ---------------------------------------------------------- 2. physics */
console.log('2. Physics');
{
  const course = createCourse(1);
  course.gaps.length = 0;
  const p = createPlayer();
  let steps = 0;
  stepPlayer(p, course, 0, DT, true);
  while (!p.grounded && steps < 200) {
    stepPlayer(p, course, 0, DT, false);
    steps++;
  }
  const t = (steps + 1) * DT;
  if (p.g !== CEIL || p.y !== surfaceY(CEIL)) fail('a flip from the floor did not land on the ceiling');
  else if (Math.abs(t - FLIP_TIME) > 2 * DT) fail(`flip took ${t.toFixed(3)} s, expected ${FLIP_TIME.toFixed(3)} s`);
  else ok(`a flip lands on the far surface in ${t.toFixed(3)} s (FLIP_TIME ${FLIP_TIME.toFixed(3)} s)`);

  // A tap shortly before touchdown is kept and fires on landing.
  const q = createPlayer();
  stepPlayer(q, course, 0, DT, true);
  let flipped = false;
  for (let i = 0; i < 60; i++) {
    const tapNow = i === steps - 4;
    const ev = stepPlayer(q, course, 0, DT, tapNow);
    if (ev === 'flip') flipped = true;
  }
  if (!flipped || q.g !== FLOOR) fail('a tap just before landing was lost');
  else ok('a tap up to PLAYER.buffer before landing flips on touchdown');

  // A hole under the courier is fatal unless it flips.
  const hole = createCourse(1);
  hole.gaps.length = 0;
  hole.gaps.push({ kind: 'gap', x: 50, w: 110, surf: FLOOR });
  const r = createPlayer();
  let x = 0;
  let end = '';
  for (let i = 0; i < 120 && !end; i++) {
    x += SPEED.top * DT;
    const ev = stepPlayer(r, hole, x, DT, false);
    if (ev === 'void' || ev === 'edge') end = ev;
  }
  if (!end) fail('running over the narrowest hole at top speed did not kill');
  else ok(`running into the narrowest hole at top speed ends the run (${end})`);
}

/* ------------------------------------------------- 3. pattern spacing */
console.log('3. Fairness');
{
  // Any two forced sides (spikes, pylons, holes) that differ need a flip between them.
  let worst = Infinity;
  let worstAt = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const c = createCourse(s * 7919);
    extend(c, TARGET * UNITS_PER_METRE);
    const forced = [
      ...c.hazards.filter((o) => o.kind === 'spike' || o.kind === 'pylon').map((o) => ({ x0: o.x, x1: o.x + o.w, need: -o.surf })),
      ...c.gaps.map((o) => ({ x0: o.x, x1: o.x + o.w, need: -o.surf })),
    ].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < forced.length; i++) {
      const a = forced[i - 1];
      const b = forced[i];
      if (a.need === b.need) continue;
      const room = (b.x0 - a.x1) / speedAt(b.x0 / UNITS_PER_METRE);
      const spare = room - FLIP_TIME;
      if (spare < worst) {
        worst = spare;
        worstAt = b.x0;
      }
    }
  }
  const need = marginAt(TARGET) * 0.95;
  if (worst < need) fail(`a forced flip leaves only ${worst.toFixed(3)} s beyond the flip itself, at ${Math.round(worstAt / 10)} m`);
  else ok(`every forced change of side leaves at least ${worst.toFixed(3)} s beyond the flip (margin at ${TARGET} m: ${marginAt(TARGET).toFixed(3)} s)`);

  // The bot plays the real game.
  const fatal = new Map();
  let total = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const w = createWorld({ seed: s * 7919, pickups: false });
    while (!w.over && metres(w) < TARGET) step(w, botWantsFlip(w));
    total += metres(w);
    if (w.over) {
      const pat = w.course.patternLog.findLast((p) => p.x <= w.dist + 30);
      fail(`bot died on seed ${s * 7919} at ${metres(w)} m (${w.cause}, pattern ${pat?.key})`);
      fatal.set(pat?.key, (fatal.get(pat?.key) || 0) + 1);
    }
  }
  if (!fatal.size) ok(`the bot survives ${TARGET} m on all ${SEEDS} seeds, with no shield`);
}

/* ---------------------------------------------------------- 4. ramp */
console.log('4. Difficulty ramp');
{
  function casual(seed) {
    const w = createWorld({ seed, pickups: false });
    playCasual(w, createRng(seed ^ 0x5bd1e995), (w) => metres(w) >= TARGET);
    return metres(w);
  }
  const bands = [0, 500, 1000, 1500, 2000, 3000, 4000];
  const casualRuns = [];
  for (let s = 1; s <= 24; s++) casualRuns.push(casual(s * 104729));
  casualRuns.sort((a, b) => a - b);
  const median = casualRuns[casualRuns.length >> 1];

  console.log('  band (m)    speed  margin  obstacles/s  holes/s  casual deaths');
  let lastDensity = 0;
  let lastSpeed = 0;
  const c = createCourse(99991, { pickups: false });
  extend(c, TARGET * UNITS_PER_METRE + 2000);
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i];
    const b = bands[i + 1];
    const inBand = (o) => o.x >= a * 10 && o.x < b * 10;
    const hz = c.hazards.filter(inBand).length / ((b - a) / 100);
    const holes = c.gaps.filter(inBand).length / ((b - a) / 100);
    const deaths = casualRuns.filter((m) => m >= a && m < b).length;
    const v = speedAt((a + b) / 2);
    const perSecond = (n) => (n / 100) * (v / UNITS_PER_METRE);
    const rate = perSecond(hz + holes);
    console.log(
      `  ${String(a).padStart(4)}-${String(b).padEnd(5)}  ${v.toFixed(0).padStart(5)}  ${marginAt((a + b) / 2).toFixed(2).padStart(6)}  ${rate.toFixed(2).padStart(11)}  ${perSecond(holes).toFixed(2).padStart(7)}  ${String(deaths).padStart(13)}`,
    );
    if (v <= lastSpeed) fail(`speed does not rise in band ${a}-${b} m`);
    if (rate < lastDensity * 0.85) fail(`obstacles per second drop in band ${a}-${b} m`);
    lastSpeed = v;
    lastDensity = rate;
  }
  console.log(`  casual bot median: ${median} m (24 runs)`);
  if (median < 250) fail(`the casual bot's median run is only ${median} m; the opening is too hard`);
  if (median >= TARGET) fail('the casual bot never dies; the ramp is too gentle');
}

}

/* ---------------------------------------------------------- 5. campaign */
console.log('5. Campaign');
{
  const ids = new Set();
  const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);
  console.log('  level  name                speed    margin  length  shards  bot  casual  no-hit');
  const chapterRates = [];
  for (const ch of CHAPTERS) {
    const rates = [];
    for (const lv of ch.levels) {
      if (ids.has(lv.id)) fail(`level id ${lv.id} is used twice`);
      ids.add(lv.id);
      let c;
      try {
        c = buildLevel(lv);
      } catch (e) {
        fail(e.message);
        continue;
      }
      // Fair room at every forced change of side.
      const forced = [
        ...c.hazards.filter((o) => o.kind === 'spike' || o.kind === 'pylon').map((o) => ({ x0: o.x, x1: o.x + o.w, need: -o.surf })),
        ...c.gaps.map((o) => ({ x0: o.x, x1: o.x + o.w, need: -o.surf })),
      ].sort((a, b) => a.x0 - b.x0);
      for (let i = 1; i < forced.length; i++) {
        const a = forced[i - 1];
        const b = forced[i];
        if (a.need === b.need) continue;
        const spare = (b.x0 - a.x1) / courseSpeed(c, b.x0) - FLIP_TIME;
        if (spare < lv.margin * 0.95) fail(`${lv.id}: a forced flip at ${Math.round(b.x0)} leaves ${spare.toFixed(3)} s (margin ${lv.margin})`);
      }
      if (c.finish < 1500) fail(`${lv.id} is too short`);
      const where = (w) => w.course.patternLog.findLast((p) => p.x <= w.dist + 30)?.key;

      // The look-ahead bot: finishes with no hit.
      const perfect = createWorld({ level: lv });
      while (!perfect.over) step(perfect, botWantsFlip(perfect));
      if (!perfect.won) fail(`${lv.id}: the look-ahead bot died (${perfect.cause}) at "${where(perfect)}"`);
      else if (perfect.hits) fail(`${lv.id}: the look-ahead bot broke its shield`);

      // The shard-seeking bot: all three stars in one run.
      const greedy = createWorld({ level: lv });
      while (!greedy.over) step(greedy, botWantsFlip(greedy, { shards: true }));
      const target = shardTarget(lv, c.totalShards);
      if (!greedy.won || greedy.hits) fail(`${lv.id}: the shard bot did not finish cleanly (${greedy.cause}) at "${where(greedy)}"`);
      else if (greedy.shards < target) fail(`${lv.id}: the shard bot took ${greedy.shards} of ${c.totalShards} shards, the star needs ${target}`);
      if (target < 1) fail(`${lv.id} has no shard star to earn`);

      // The casual bot, with its shield, many times.
      let won = 0;
      let clean = 0;
      for (let r = 1; r <= CASUAL_RUNS; r++) {
        const w = playCasual(createWorld({ level: lv }), createRng(r * 2654435761 + lv.index));
        if (w.won) won++;
        if (w.won && !w.hits) clean++;
      }
      const rate = won / CASUAL_RUNS;
      rates.push(rate);
      const v = Array.isArray(lv.speed) ? `${lv.speed[0]}-${lv.speed[1]}` : String(lv.speed);
      const secs = (c.finish / ((c.v0 + c.v1) / 2)).toFixed(0);
      console.log(
        `  ${lv.id.padEnd(5)}  ${lv.name.padEnd(18)}  ${v.padStart(7)}  ${lv.margin.toFixed(2).padStart(6)}  ${`${secs} s`.padStart(6)}  ${`${target}/${c.totalShards}`.padStart(6)}  ${String(greedy.shards).padStart(3)}  ${pct(rate).padStart(6)}  ${pct(clean / CASUAL_RUNS).padStart(6)}`,
      );
    }
    const finale = ch.levels.findIndex((lv) => lv.finale);
    if (finale !== ch.levels.length - 1) fail(`chapter ${ch.id} should end with its finale`);
    else if (rates[finale] > Math.min(...rates) + 1e-9) fail(`the finale of chapter ${ch.id} is not its hardest level for the casual bot`);
    const avg = rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length);
    chapterRates.push(avg);
    console.log(`         chapter ${ch.id} ${ch.name}: casual bot finishes ${pct(avg).trim()} of tries`);
  }
  if (ids.size !== LEVELS.length) fail('LEVELS does not list every chapter level');
  if (chapterRates[0] < 0.85) fail(`chapter 1 should be easy: the casual bot finishes only ${Math.round(chapterRates[0] * 100)}%`);
  for (let i = 1; i < chapterRates.length; i++) {
    if (chapterRates[i] > chapterRates[i - 1] + 0.05) fail(`chapter ${i + 1} is easier for the casual bot than chapter ${i}`);
  }
  if (!failures) ok(`all ${LEVELS.length} levels are finished by the look-ahead bot with no hit, and every shard star is taken`);
}
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
