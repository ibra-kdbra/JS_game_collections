/**
 * Proves every Barrel Tower stage can be cleared with the real game code.
 *
 *   node Barrel_Tower/tools/verify.mjs
 *
 * 1. Each stage has a recorded input run in runs.json (the lifts have one per
 *    round, since they speed up). Replayed with hazards switched off, the run
 *    must clear the stage: the girders, ladders, gaps and lifts connect.
 * 2. Every stage is then played with hazards on, for each round and a few
 *    seeds, with random input, to check that nothing throws and that the
 *    hazards actually appear.
 *
 * 3. A simple bot (tools/bot.mjs) plays the ramps and the rivets with hazards
 *    on and must clear each of them at least once in 60 tries, in round 1 and
 *    round 5.
 *
 * Runs come from tools/route.mjs (ramps, rivets) and tools/explore.mjs (lifts).
 */
import { readFileSync } from 'node:fs';
import { createWorld } from '../src/sim.js';
import { parseRun, inputFor } from './run.mjs';
import { playBot } from './bot.mjs';

const runs = JSON.parse(readFileSync(new URL('./runs.json', import.meta.url), 'utf8'));
const ROUNDS = [1, 2, 3, 4, 5];
let failures = 0;

for (const stage of ['ramps', 'lifts', 'rivets']) {
  for (const round of ROUNDS) {
    const run = runs[`${stage}@${round}`] ?? runs[stage];
    const w = createWorld({ stage, round, hazards: false });
    const steps = parseRun(run);
    let t = 0;
    for (const s of steps) {
      w.step(inputFor(s));
      t++;
      if (w.hero.mode !== 'walk' && w.hero.mode !== 'climb' && w.hero.mode !== 'air') break;
    }
    const ok = w.hero.mode === 'won';
    if (!ok) failures++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${stage.padEnd(6)} round ${round}: ${ok ? `cleared in ${(t / 60).toFixed(1)} s` : `${w.hero.mode} at ${w.hero.x.toFixed(0)},${w.hero.y.toFixed(0)}`}`);
  }
}

// Hazards on: random play must not throw, and each stage's hazards must show up.
const expect = { ramps: ['throw', 'ignite'], lifts: ['spring'], rivets: ['vent'] };
for (const stage of Object.keys(expect)) {
  const seen = new Set();
  let error = null;
  for (const round of ROUNDS) {
    for (let seed = 1; seed <= 4; seed++) {
      let s = seed * 7919;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      const w = createWorld({ stage, round, seed, immortal: true });
      let input = {};
      try {
        for (let i = 0; i < 6000 && !w.outcome; i++) {
          if (i % 25 === 0) input = { left: rnd() < 0.35, right: rnd() < 0.35, up: rnd() < 0.3, down: rnd() < 0.2, jump: rnd() < 0.15 };
          w.step(input);
          for (const e of w.events) seen.add(e.type);
        }
      } catch (e) {
        error = `${stage} round ${round} seed ${seed}: ${e.stack}`;
      }
    }
  }
  const missing = expect[stage].filter((e) => !seen.has(e));
  const ok = !error && !missing.length;
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${stage.padEnd(6)} random play, rounds 1-5: ${error ?? (missing.length ? 'never saw ' + missing.join(', ') : 'no errors, hazards appear')}`);
}

// Survivable, not only connected: a simple bot that jumps what comes at it and
// waits at busy ladders must clear the ramps and the rivets now and then, even
// in round 5. (It clears round 1 about 40% of the time.)
for (const stage of ['ramps', 'rivets']) {
  const rates = [];
  let ok = true;
  for (const round of [1, 5]) {
    let wins = 0;
    for (let seed = 1; seed <= 60; seed++) if (playBot(stage, round, seed)) wins++;
    rates.push(`round ${round} ${wins}/60`);
    if (!wins) ok = false;
  }
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${stage.padEnd(6)} bot clears it with hazards on: ${rates.join(', ')}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nEvery stage can be cleared in every round.');
