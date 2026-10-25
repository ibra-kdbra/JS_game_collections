/**
 * A bot that plays Reef Keeper like a reasonable person: at most five clicks a
 * second, a little off target, collecting coins, feeding hungry fish, shooting
 * invaders and buying in a sensible order. Used by tools/verify.mjs to show
 * that every level can be cleared and how long it takes.
 *
 *   node Reef_Keeper/tools/bot.mjs [seeds]
 */
import { createWorld, mulberry32 } from '../src/sim.js';
import { FISH, TANK, LEVELS } from '../src/config.js';

const CLICK_EVERY = 12; // steps between clicks: 5 per second (by default)

export function playLevel(level, seed, { upgrades = null, maxMinutes = 20, clickEvery = CLICK_EVERY } = {}) {
  const w = createWorld({ level, seed, upgrades });
  const rand = mulberry32(seed * 977 + 13);
  const aim = () => (rand() - 0.5) * 10;
  let cooldown = 0;
  const limit = maxMinutes * 3600;
  while (!w.outcome && w.time < limit) {
    w.step();
    if (--cooldown > 0) continue;
    cooldown = clickEvery;
    if (act(w, aim)) continue;
    cooldown = 1; // nothing to do: look again next step
  }
  return { outcome: w.outcome ?? 'timeout', minutes: w.time / 3600, stats: w.stats, up: w.up, money: w.money };
}

export function act(w, aim) {
  const live = w.fish.filter((f) => !f.dead);
  const minnows = live.filter((f) => f.kind === 'minnow');
  const pike = live.filter((f) => f.kind === 'pike');
  // 1. Fight.
  if (w.invader) {
    w.click(w.invader.x + aim(), w.invader.y + aim());
    return true;
  }
  // 2. Coins about to fade on the sand, then any coin that has stopped or is low.
  const coins = [...w.coins].sort((a, b) => b.floorT - a.floorT || b.y - a.y);
  if (coins.length && (coins[0].floorT > 0 || coins[0].y > TANK.floor - 120 || coins.length > 3)) {
    const c = coins[0];
    w.click(c.x + aim() * 0.5, c.y + aim() * 0.5);
    return true;
  }
  // 3. Feed the hungriest minnow.
  const hungry = minnows.filter((f) => w.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt);
  if (hungry.length && w.pellets.length < Math.min(w.maxPellets(), hungry.length)) {
    const f = hungry[0];
    w.click(f.x + aim(), Math.max(TANK.surface + 10, f.y - 30));
    return true;
  }
  // 4. Shop.
  const shop = Object.fromEntries(w.shop().map((i) => [i.id, i]));
  const can = (id, reserve = 0) => shop[id] && shop[id].affordable && w.money - shop[id].cost >= reserve;
  const want = 6 + Math.min(w.level, 2);
  if (minnows.length < 2 && can('minnow')) return w.buy('minnow');
  if (w.warning > 0 && w.up.weapon === 0 && w.level > 0 && can('weapon')) return w.buy('weapon');
  if (minnows.length < want && can('minnow', 20)) return w.buy('minnow');
  if (w.up.quality < 1 && can('quality', 50)) return w.buy('quality');
  if (shop.crab && !w.crab && can('crab', 100)) return w.buy('crab');
  if (w.maxPellets() < 3 && can('count', 50)) return w.buy('count');
  if (w.up.quality < 2 && minnows.length >= want && can('quality', 100)) return w.buy('quality');
  if (shop.pike && pike.length < 2 && minnows.length >= want && can('pike', 200)) return w.buy('pike');
  // Pike need small minnows to eat.
  if (pike.some((p) => w.isHungry(p)) && !minnows.some((m) => m.stage === 0) && can('minnow', 100)) return w.buy('minnow');
  if (w.up.weapon < 2 && w.level >= 2 && can('weapon', 300)) return w.buy('weapon');
  if (can('shard', 150)) return w.buy('shard');
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
    const starved = (res.reduce((a, r) => a + r.stats.starved, 0) / seeds).toFixed(1);
    const eaten = (res.reduce((a, r) => a + r.stats.eaten, 0) / seeds).toFixed(1);
    console.log(`${LEVELS[level].name.padEnd(12)} cleared ${wins.length}/${seeds}  median ${med} min  starved ${starved}  eaten ${eaten}  outcomes ${[...new Set(res.map((r) => r.outcome))].join(',')}`);
  }
}
void FISH;
