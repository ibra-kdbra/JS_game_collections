/**
 * Checks Reef Keeper with the real game code, headless.
 *
 *   node Reef_Keeper/tools/verify.mjs
 *
 * 1. A bot that plays like a reasonable person (tools/bot.mjs: five clicks a
 *    second, a little off target, with the pets hatched so far) clears all 50
 *    campaign levels (two seeds each) and all 50 hard levels (one seed).
 * 2. The worlds get longer in order: each world's average time is above the last.
 * 3. A slower player (half the clicks) still clears the first level.
 * 4. Endless mode: the bot survives at least three waves.
 * 5. Neglect: fish that are never fed starve, and with no fish and no money
 *    for a new one the level is lost (the game ends, it doesn't hang).
 * 6. Clicks always do something: the first three drop food, the fourth reports
 *    the limit, and a click without money says so.
 * 7. Every level's shop fits the bar (eight buttons), and src/pars.js has a
 *    target time for every level.
 */
import { LEVELS, HARD_LEVELS, WORLDS, LEVELS_PER_WORLD, ENDLESS } from '../src/config.js';
import { PARS } from '../src/pars.js';
import { createWorld } from '../src/sim.js';
import { playLevel } from './bot.mjs';

let failures = 0;
const check = (ok, text) => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${text}`);
};

function sweep(list, seeds, limit) {
  const worldTimes = WORLDS.map(() => []);
  const failed = [];
  for (const def of list) {
    for (const seed of seeds) {
      const r = playLevel(def, seed, { maxMinutes: limit });
      if (r.outcome !== 'clear') failed.push(`${def.name} seed ${seed}: ${r.outcome}`);
      else worldTimes[def.world].push(r.minutes);
    }
  }
  return { failed, avg: worldTimes.map((t) => t.reduce((a, b) => a + b, 0) / Math.max(1, t.length)) };
}

const normal = sweep(LEVELS, [1, 2], 15);
check(!normal.failed.length, `campaign: the bot cleared all ${LEVELS.length} levels with two seeds${normal.failed.length ? ` (failed: ${normal.failed.join('; ')})` : ''}`);
check(normal.avg.every((m, i) => i === 0 || m > normal.avg[i - 1]), `campaign worlds take longer in order: ${normal.avg.map((m) => m.toFixed(1)).join(' < ')} min`);

const hard = sweep(HARD_LEVELS, [3], 20);
check(!hard.failed.length, `hard: the bot cleared all ${HARD_LEVELS.length} levels${hard.failed.length ? ` (failed: ${hard.failed.join('; ')})` : ''} · world averages ${hard.avg.map((m) => m.toFixed(1)).join(', ')} min`);

const slow = [1, 2, 3, 4].map((seed) => playLevel(LEVELS[0], seed, { clickEvery: 24 }));
const slowWins = slow.filter((r) => r.outcome === 'clear').length;
check(slowWins >= 3, `a slower player (2.5 clicks a second) clears level 1-1 in ${slowWins}/4`);

{
  const def = { mode: 'endless', endless: true, id: 'endless', index: 0, world: 4, name: 'Endless', start: ENDLESS.start, shop: ENDLESS.shop, aliens: null };
  const r = playLevel(def, 1, { maxMinutes: 15, pets: ['clam', 'eel', 'snail'] });
  check(r.wave >= 3, `endless: the bot survived ${r.wave} waves (${r.outcome}, ${r.minutes.toFixed(1)} min)`);
}

{
  const w = createWorld({ def: LEVELS[0], seed: 1 });
  w.buy('guppy');
  w.buy('guppy');
  while (!w.outcome && w.time < 3600 * 10) w.step();
  check(w.stats.starved === 4 && w.outcome === 'lost', `neglect: ${w.stats.starved}/4 fish starved, then the level was ${w.outcome ?? 'still going'} after ${(w.time / 3600).toFixed(1)} min`);
}

{
  const w = createWorld({ def: LEVELS[0], seed: 1 });
  const results = [1, 2, 3, 4].map((i) => w.click(100 + i * 100, 200));
  w.money = 0;
  w.food.length = 0;
  results.push(w.click(300, 200));
  const want = ['food', 'food', 'food', 'full', 'broke'];
  check(results.join() === want.join(), `clicks: ${results.join(', ')}`);
}

{
  const all = [...LEVELS, ...HARD_LEVELS];
  const wide = all.filter((L) => L.shop.length > 8).map((L) => L.id);
  const missing = all.filter((L) => !(L.id in PARS)).map((L) => L.id);
  check(!wide.length && !missing.length && all.length === 2 * WORLDS.length * LEVELS_PER_WORLD, `${all.length} levels: shops fit the bar${wide.length ? ` (too wide: ${wide.join(', ')})` : ''}, pars for all${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll 100 levels can be cleared, and the worlds get harder in order.');
