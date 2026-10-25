/**
 * Checks Reef Keeper's balance with the real game code.
 *
 *   node Reef_Keeper/tools/verify.mjs
 *
 * 1. A bot that plays like a reasonable person (tools/bot.mjs: five clicks a
 *    second, a little off target), with the pets earned in the levels before,
 *    clears every level with every seed within 12 minutes.
 * 2. Levels take longer in order: each median time is above the last.
 * 3. A slower player (half the clicks) still clears the first level.
 * 4. Neglect: fish that are never fed starve, and with no fish and no money
 *    for a new one the level is lost (the game ends, it doesn't hang).
 * 5. Clicks always do something: food drops at once with three pieces allowed
 *    at the start, and a click over the limit or without money says why.
 */
import { LEVELS } from '../src/config.js';
import { createWorld } from '../src/sim.js';
import { playLevel } from './bot.mjs';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
let failures = 0;
const check = (ok, text) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

const medians = [];
LEVELS.forEach((L, level) => {
  const runs = SEEDS.map((seed) => playLevel(level, seed));
  const cleared = runs.filter((r) => r.outcome === 'clear');
  const times = cleared.map((r) => r.minutes).sort((a, b) => a - b);
  const median = times.length ? times[Math.floor(times.length / 2)] : Infinity;
  medians.push(median);
  const slowest = times.length ? times[times.length - 1] : Infinity;
  check(cleared.length === SEEDS.length && slowest <= 12, `${`${L.name} ${L.title}`.padEnd(22)} bot cleared ${cleared.length}/${SEEDS.length}, median ${median.toFixed(1)} min, slowest ${slowest.toFixed(1)} min`);
});

check(medians.every((m, i) => i === 0 || m > medians[i - 1]), `levels take longer in order: ${medians.map((m) => m.toFixed(1)).join(' < ')} min`);

const slow = SEEDS.map((seed) => playLevel(0, seed, { clickEvery: 24 }));
const slowWins = slow.filter((r) => r.outcome === 'clear').length;
check(slowWins >= SEEDS.length / 2, `a slower player (2.5 clicks a second) clears level 1 in ${slowWins}/${SEEDS.length}`);

{
  const w = createWorld({ level: 0, seed: 1 });
  w.buy('guppy');
  w.buy('guppy');
  while (!w.outcome && w.time < 3600 * 10) w.step();
  check(w.stats.starved === 4 && w.outcome === 'lost', `neglect: ${w.stats.starved}/4 fish starved, then the level was ${w.outcome ?? 'still going'} after ${(w.time / 3600).toFixed(1)} min`);
}

{
  const w = createWorld({ level: 0, seed: 1 });
  const results = [1, 2, 3, 4].map((i) => w.click(100 + i * 100, 200));
  w.money = 0;
  w.food.length = 0;
  results.push(w.click(300, 200));
  const want = ['food', 'food', 'food', 'full', 'broke'];
  check(results.join() === want.join(), `clicks: ${results.join(', ')} (expected ${want.join(', ')})`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nEvery level can be cleared, and they get harder in order.');
