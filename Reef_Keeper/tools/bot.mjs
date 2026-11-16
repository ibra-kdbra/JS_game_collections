/**
 * A bot that plays Reef Keeper like a reasonable person: a limited number of
 * clicks a second, a little off target, collecting coins, feeding fish,
 * fighting aliens (feeding gluttons, popping bombs, waiting out shields) and
 * buying in a sensible order. Used by tools/verify.mjs to show every level can
 * be cleared and to set each level's target times.
 *
 *   node Reef_Keeper/tools/bot.mjs [seeds] [normal|hard]
 */
import { createWorld, mulberry32 } from '../src/sim.js';
import { TANK, LEVELS, HARD_LEVELS, ALIENS, MAX_PETS } from '../src/config.js';

const PET_PRIORITY = ['clam', 'eel', 'snail', 'seahorse', 'octopus', 'angel', 'puffer', 'jelly', 'turtle', 'crab'];

/** The pets hatched before a normal level, best first, as many as can be taken. */
export function petsBefore(index) {
  const have = LEVELS.slice(0, index).map((L) => L.hatch).filter(Boolean);
  return PET_PRIORITY.filter((p) => have.includes(p)).slice(0, MAX_PETS);
}

export function playLevel(def, seed, { maxMinutes = 20, clickEvery = 12, pets } = {}) {
  if (typeof def === 'number') def = LEVELS[def];
  const w = createWorld({ def, seed, pets: pets ?? petsBefore(def.mode === 'hard' ? LEVELS.length : def.index) });
  const rand = mulberry32(seed * 977 + 13);
  const aim = () => (rand() - 0.5) * 12;
  let cooldown = 0;
  const limit = maxMinutes * 3600;
  while (!w.outcome && w.time < limit) {
    w.step();
    if (--cooldown > 0) continue;
    cooldown = act(w, aim) ? clickEvery : 1;
  }
  return { outcome: w.outcome ?? 'timeout', minutes: w.time / 3600, stats: w.stats, money: w.money, wave: w.wave };
}

export function act(w, aim) {
  const live = w.fish.filter((f) => !f.dead);
  const count = (kind) => live.filter((f) => f.kind === kind).length;
  const guppies = live.filter((f) => f.kind === 'guppy');
  // 1. Bombs about to hit something, then aliens.
  const bomb = w.bombs[0];
  if (bomb) {
    w.click(bomb.x + aim() * 0.3, bomb.y + aim() * 0.3);
    return true;
  }
  const zappable = w.aliens.filter((a) => a.kind !== 'glutton' && !a.shield);
  if (zappable.length) {
    const a = zappable[0];
    w.click(a.x + aim(), a.y + aim());
    return true;
  }
  const glutton = w.aliens.find((a) => a.kind === 'glutton');
  if (glutton && w.food.filter((p) => p.kind === 'food').length < w.maxFood()) {
    w.click(glutton.x + aim(), Math.max(TANK.surface + 8, glutton.y - ALIENS.glutton.r - 30));
    return true;
  }
  const shielded = w.aliens.some((a) => a.shield);
  // 2. Coins about to fade, then coins near the sand, then any when there are several.
  const coins = [...w.coins].sort((a, b) => b.floorT - a.floorT || b.y - a.y);
  if (coins.length && (coins[0].floorT > 200 || coins[0].y > TANK.floor - 80 || coins.length > 4 || (coins[0].type !== 'silver' && coins[0].type !== 'star'))) {
    const c = coins[0];
    w.click(c.x + aim() * 0.5, c.y + aim() * 0.5);
    return true;
  }
  if (shielded) return false;
  // 3. Feed the hungriest fish that eats food.
  const hungry = live.filter((f) => (f.kind === 'guppy' || f.kind === 'breeder' || f.kind === 'grubber') && w.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt);
  if (hungry.length && w.food.filter((p) => p.kind === 'food').length < Math.min(w.maxFood(), hungry.length)) {
    const f = hungry[0];
    w.click(f.x + aim(), Math.max(TANK.surface + 8, f.y - (f.kind === 'grubber' ? 120 : 40)));
    return true;
  }
  // 4. Shop.
  const shop = Object.fromEntries(w.shop().map((i) => [i.id, i]));
  const can = (id, reserve = 0) => shop[id] && shop[id].affordable && w.money - shop[id].cost >= reserve;
  const want = 6 + Math.min(w.world, 3);
  if (guppies.length < 2 && can('guppy')) return w.buy('guppy');
  if ((w.warning > 0 || w.aliens.length) && w.up.weapon === 0 && can('weapon')) return w.buy('weapon');
  if (guppies.length < want && can('guppy', 30)) return w.buy('guppy');
  if (w.up.quality < 1 && can('quality', 50)) return w.buy('quality');
  if (shop.breeder && count('breeder') < 1 && can('breeder', 100)) return w.buy('breeder');
  if (w.up.quality < 2 && guppies.length >= want - 2 && can('quality', 100)) return w.buy('quality');
  if (w.maxFood() < 5 && guppies.length >= want && can('count', 200)) return w.buy('count');
  if (shop.carnivore && count('carnivore') < 2 && guppies.length >= want && can('carnivore', 200)) return w.buy('carnivore');
  if (live.some((f) => f.kind === 'carnivore' && w.isHungry(f)) && !guppies.some((g) => g.stage === 0) && can('guppy', 100)) return w.buy('guppy');
  if (shop.grubber && count('grubber') < 1 && count('carnivore') >= 1 && can('grubber', 200)) return w.buy('grubber');
  if (shop.muncher && count('grubber') >= 1 && count('muncher') < 2 && can('muncher', 200)) return w.buy('muncher');
  if (shop.weapon && w.up.weapon < Math.min(4, 1 + w.world) && w.level >= 12 && can('weapon', 400)) return w.buy('weapon');
  if (shop.starcatcher && guppies.some((g) => g.stage === 3) && count('starcatcher') < 1 && can('starcatcher', 200)) return w.buy('starcatcher');
  if (shop.potion && guppies.filter((g) => g.stage === 3).length < 2 && guppies.some((g) => g.stage === 2) && can('potion', 300)) return w.buy('potion');
  if (shop.leviathan && count('leviathan') < 1 && count('carnivore') >= 2 && can('leviathan', 1500)) return w.buy('leviathan');
  if (can('egg', 150)) return w.buy('egg');
  return false;
}

if (typeof process !== 'undefined' && import.meta.url === `file://${process.argv[1]}`) {
  const seeds = +(process.argv[2] || 4);
  const list = process.argv[3] === 'hard' ? HARD_LEVELS : LEVELS;
  for (const def of list) {
    const res = [];
    for (let s = 1; s <= seeds; s++) res.push(playLevel(def, s));
    const wins = res.filter((r) => r.outcome === 'clear');
    const mins = wins.map((r) => r.minutes).sort((a, b) => a - b);
    const med = mins.length ? mins[Math.floor(mins.length / 2)].toFixed(1) : '-';
    const avg = (k) => (res.reduce((a, r) => a + r.stats[k], 0) / seeds).toFixed(1);
    console.log(`${def.name.padEnd(5)} cleared ${wins.length}/${seeds}  median ${med.padStart(4)} min  starved ${avg('starved')}  eaten ${avg('eaten')}  aliens ${avg('aliens')}  ${res.map((r) => r.outcome[0]).join('')}`);
  }
}
