/**
 * Checks Reef Keeper's balance with the real game code.
 *
 *   node Reef_Keeper/tools/verify.mjs
 *
 * 1. A bot that plays like a reasonable person (tools/bot.mjs: five clicks a
 *    second, a little off target) clears every tank with every seed, within
 *    12 minutes.
 * 2. The tanks get longer in order: each one's median time is above the last.
 * 3. A slower player (half the clicks) still clears the first tank most times.
 * 4. Neglect: fish that are never fed starve, and once there are no fish and
 *    no money for a new one the tank is lost (the game ends, it doesn't hang).
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
  check(cleared.length === SEEDS.length && slowest <= 12, `${(level + 1 + '. ' + L.name).padEnd(15)} bot cleared ${cleared.length}/${SEEDS.length}, median ${median.toFixed(1)} min, slowest ${slowest.toFixed(1)} min`);
});

check(medians.every((m, i) => i === 0 || m > medians[i - 1]), `tanks take longer in order: ${medians.map((m) => m.toFixed(1)).join(' < ')} min`);

const slow = SEEDS.map((seed) => playLevel(0, seed, { clickEvery: 24 }));
const slowWins = slow.filter((r) => r.outcome === 'clear').length;
check(slowWins >= SEEDS.length / 2, `a slower player (2.5 clicks a second) clears tank 1 in ${slowWins}/${SEEDS.length}`);

{
  // Neglected fish starve; with no money left for a new one, the tank is lost.
  const w = createWorld({ level: 0, seed: 1 });
  w.buy('minnow');
  w.buy('minnow');
  while (!w.outcome && w.time < 3600 * 10) w.step();
  check(w.stats.starved === 4 && w.outcome === 'lost', `neglect: ${w.stats.starved}/4 fish starved, then the tank was ${w.outcome ?? 'still going'} after ${(w.time / 3600).toFixed(1)} min`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nEvery tank can be cleared, and they get harder in order.');
