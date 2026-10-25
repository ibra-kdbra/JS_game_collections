/**
 * A bot that plays Reef Keeper like a reasonable person: a limited number of
 * clicks a second, a little off target, collecting coins, feeding hungry
 * fish, shooting aliens and buying in a sensible order. Used by
 * tools/verify.mjs to show every level can be cleared and how long it takes.
 *
 *   node Reef_Keeper/tools/bot.mjs [seeds]
 */
import { createWorld, mulberry32 } from '../src/sim.js';
import { TANK, LEVELS } from '../src/config.js';

/** The pets a player has when starting a level, having cleared the ones before. */
export const petsBefore = (level) => LEVELS.slice(0, level).map((L) => L.hatch).filter(Boolean);

export function playLevel(level, seed, { maxMinutes = 20, clickEvery = 12, pets = petsBefore(level) } = {}) {
  const w = createWorld({ level, seed, pets });
  const rand = mulberry32(seed * 977 + 13);
  const aim = () => (rand() - 0.5) * 12;
  let cooldown = 0;
  const limit = maxMinutes * 3600;
  while (!w.outcome && w.time < limit) {
    w.step();
    if (--cooldown > 0) continue;
    cooldown = act(w, aim) ? clickEvery : 1;
  }
  return { outcome: w.outcome ?? 'timeout', minutes: w.time / 3600, stats: w.stats, money: w.money };
}

export function act(w, aim) {
  const live = w.fish.filter((f) => !f.dead);
  const guppies = live.filter((f) => f.kind === 'guppy');
  const count = (kind) => live.filter((f) => f.kind === kind).length;
  // 1. Fight.
  if (w.alien) {
    w.click(w.alien.x + aim(), w.alien.y + aim());
    return true;
  }
  // 2. Coins about to fade, then coins near the sand, then any when there are several.
  const coins = [...w.coins].sort((a, b) => b.floorT - a.floorT || b.y - a.y);
  if (coins.length && (coins[0].floorT > 200 || coins[0].y > TANK.floor - 80 || coins.length > 4 || coins[0].type !== 'silver')) {
    const c = coins[0];
    w.click(c.x + aim() * 0.5, c.y + aim() * 0.5);
    return true;
  }
  // 3. Feed the hungriest fish.
  const hungry = live.filter((f) => f.kind !== 'carnivore' && w.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt);
  if (hungry.length && w.food.length < Math.min(w.maxFood(), hungry.length)) {
    const f = hungry[0];
    w.click(f.x + aim(), Math.max(TANK.surface + 8, f.y - 40));
    return true;
  }
  // 4. Shop.
  const shop = Object.fromEntries(w.shop().map((i) => [i.id, i]));
  const can = (id, reserve = 0) => shop[id] && shop[id].affordable && w.money - shop[id].cost >= reserve;
  const want = 6 + Math.min(w.level, 3);
  if (guppies.length < 2 && can('guppy')) return w.buy('guppy');
  if (w.warning > 0 && w.up.weapon === 0 && can('weapon')) return w.buy('weapon');
  if (guppies.length < want && can('guppy', 30)) return w.buy('guppy');
  if (w.up.quality < 1 && can('quality', 50)) return w.buy('quality');
  if (shop.breeder && count('breeder') < 1 && can('breeder', 100)) return w.buy('breeder');
  if (w.up.quality < 2 && guppies.length >= want - 2 && can('quality', 100)) return w.buy('quality');
  if (shop.carnivore && count('carnivore') < 2 && guppies.length >= want && can('carnivore', 200)) return w.buy('carnivore');
  // Carnivores eat small guppies.
  if (live.some((f) => f.kind === 'carnivore' && w.isHungry(f)) && !guppies.some((g) => g.stage === 0) && can('guppy', 100)) return w.buy('guppy');
  if (w.up.weapon < 2 && w.level >= 3 && can('weapon', 300)) return w.buy('weapon');
  if (can('egg', 150)) return w.buy('egg');
  return false;
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const seeds = +(process.argv[2] || 10);
  for (let level = 0; level < LEVELS.length; level++) {
    const res = [];
    for (let s = 1; s <= seeds; s++) res.push(playLevel(level, s));
    const wins = res.filter((r) => r.outcome === 'clear');
    const mins = wins.map((r) => r.minutes).sort((a, b) => a - b);
    const med = mins.length ? mins[Math.floor(mins.length / 2)].toFixed(1) : '-';
    const avg = (k) => (res.reduce((a, r) => a + r.stats[k], 0) / seeds).toFixed(1);
    console.log(`${LEVELS[level].name} ${LEVELS[level].title.padEnd(12)} cleared ${wins.length}/${seeds}  median ${med} min  starved ${avg('starved')}  eaten ${avg('eaten')}  wasted food ${avg('wasted')}`);
  }
}
