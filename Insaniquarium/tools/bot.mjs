// A reasonable player: feeds hungry fish, grabs coins, shoots aliens, buys sensibly.
// `node tools/bot.mjs` plays every Adventure level, the boss and the four Challenge tanks,
// and fails if any isn't cleared.
import { createTank } from '../js/tank.js';
import { LEVELS, FISH, ALIENS, BOSS, CHALLENGE, TANK } from '../js/data.js';

export function act(t, step, rand) {
  // Five clicks a second, ten while fighting.
  // Challenge is for experts: click faster there.
  if (step % (t.aliens.length || t.warning || t.def.challenge ? 6 : 12)) return;
  // Keep clear of a charged Amp unless that's the plan.
  const amp = t.pets.find((p) => p.kind === 'amp' && p.charged);
  const click0 = t.click;
  if (amp) t = { ...t, click: (x, y) => (Math.hypot(x - amp.x, y - amp.y) < 45 ? click0(x + (x < amp.x ? -50 : 50), y) : click0(x, y)) };
  const jitter = () => (rand() - 0.5) * 10;
  const m = t.missiles[0];
  if (m) return t.click(m.x + jitter() / 2, m.y + jitter() / 2);
  const bomb = t.coins.find((c) => c.type === 'bomb');
  if (bomb) return t.click(bomb.x, bomb.y);
  const niko = t.pets.find((p) => p.pearl);
  if (niko && step % 60 === 0) return t.click(niko.x, niko.y);
  const shootable = t.aliens.filter((a) => !ALIENS[a.kind].eatsFood && !a.shield).sort((a, b) => (ALIENS[a.kind].boss ? 1 : 0) - (ALIENS[b.kind].boss ? 1 : 0))[0];
  const gus = t.aliens.find((a) => ALIENS[a.kind].eatsFood);
  const catcher = t.fish.some((f) => f.kind === 'starcatcher' && !f.dead);
  const coin = t.coins.filter((c) => c.type !== 'bomb' && !(catcher && c.type === 'star') && !(c.type === 'beetle' && t.fish.some((f) => f.kind === 'beetlemuncher'))).sort((a, b) => b.y - a.y)[0];
  const hungry0 = t.fish.filter((f) => !f.dead && (f.kind === 'guppy' || f.kind === 'breeder') && t.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt)[0];
  if (t.def.boss && hungry0 && step % 36 === 0 && t.food.filter((p) => p.kind === 'food').length < t.maxFood()) {
    const far = t.aliens.every((a) => Math.hypot(a.x - hungry0.x, a.y - hungry0.y + 50) > ALIENS[a.kind].r + 20);
    if (far) return t.click(hungry0.x, Math.max(90, hungry0.y - 50));
  }
  if (shootable) return t.click(shootable.x + jitter(), shootable.y + jitter());
  if (t.def.challenge && !gus) {
    const done = challengeClicks(t, coin, jitter);
    if (done !== undefined) return done;
  }
  if (t.aliens.some((a) => a.shield) && !gus) { if (coin) t.click(coin.x, coin.y); return; }
  if (gus) return t.click(gus.x + jitter(), gus.y - 30);
  if (coin && (coin.y > TANK.floor - 60 || step % 24 === 0)) return t.click(coin.x + jitter() / 3, coin.y + jitter() / 3);
  const hungry = t.fish.filter((f) => !f.dead && (f.kind === 'guppy' || f.kind === 'breeder') && t.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt)[0];
  if (hungry && t.food.filter((p) => p.kind === 'food').length < t.maxFood()) return t.click(hungry.x + jitter(), Math.max(90, hungry.y - 50));
  if (coin) return t.click(coin.x, coin.y);
  // Shopping.
  const shop = t.shop();
  const get = (id) => shop.find((i) => i.id === id);
  const first = t.def.shop[0];
  const guppies = t.fish.filter((f) => f.kind === first && !f.dead).length;
  const order = [];
  // Keep enough to feed Gus to death when he may come.
  const gusLevel = t.def.aliens?.codes.some((c) => c === 4);
  const reserve = t.warning || t.aliens.length ? 1e9 : gusLevel ? 150 : 40;
  if (t.def.challenge) return challengeShop(t, get, first, guppies, reserve);
  if (guppies < 3) order.push(first);
  if (t.def.aliens && t.up.weapon < 2) order.push('weapon');
  order.push('quality');
  if (guppies < (t.def.challenge ? 16 : 7)) order.push(first);
  if (t.def.aliens && t.up.weapon < 2 + (t.def.tank ?? 2)) order.push('weapon');
  const count = (k) => t.fish.filter((f) => f.kind === k && !f.dead).length;
  const babies = t.fish.filter((f) => f.kind === 'guppy' && f.stage === 0 && !f.dead).length;
  const ready = {
    breeder: () => count('breeder') < (first === 'breeder' ? 6 : 2),
    carnivore: () => count('carnivore') < Math.max(1, Math.floor(count('breeder') / 2)) && (count('breeder') > 0 || t.pets.some((p) => p.kind === 'prego')),
    guppycruncher: () => count('guppycruncher') < 1 && (count('breeder') > 0 || babies > 1),
    beetlemuncher: () => count('beetlemuncher') < 1 && count('guppycruncher') > 0,
    potion: () => t.fish.some((f) => f.kind === 'guppy' && f.stage === 2) && t.fish.filter((f) => f.kind === 'guppy' && f.stage === 3).length < 3,
    starcatcher: () => count('starcatcher') < 1 && t.fish.some((f) => f.kind === 'guppy' && f.stage === 3),
    ultravore: () => count('ultravore') < 2 && count('carnivore') > 2,
  };
  for (const id of ['breeder', 'carnivore', 'guppycruncher', 'beetlemuncher', 'starcatcher', 'potion', 'ultravore']) if (get(id) && ready[id]()) order.push(id);
  order.push('count');
  order.push('egg');
  for (const id of order) {
    const it = get(id);
    if (!it || it.maxed) continue;
    if (it.affordable && t.money - it.cost >= reserve) return t.buy(id);
    if (id === 'egg' || id === first) return; // save up
  }
}

const CHALLENGE_PETS = ['clyde', 'stinky', 'zorf'];

/**
 * Challenge clicking: with a big tank there's more to do than clicks to do it,
 * so the egg comes first, then fish about to starve, then coins about to
 * vanish, then hungry fish, then the rest of the coins. Returns undefined to
 * fall through to shopping.
 */
function challengeClicks(t, coin, jitter) {
  const egg = t.shop().find((i) => i.id === 'egg');
  if (egg?.affordable && !t.warning && !t.aliens.length) return t.buy('egg');
  const room = t.food.filter((p) => p.kind === 'food' && !p.free).length < t.maxFood();
  const hungry = t.fish.filter((f) => !f.dead && !f.hidden && (f.kind === 'guppy' || f.kind === 'breeder') && t.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt);
  // Drop food just above a hungry fish, ahead of where it's going.
  const feed = (f) => t.click(f.x + f.vx * 20 + jitter() / 2, Math.max(90, f.y - 40));
  if (hungry[0] && room && hungry[0].starveAt - t.time < 150 && !t.aliens.some((a) => a.shield)) return feed(hungry[0]);
  const fading = t.coins.filter((c) => c.type !== 'bomb' && c.floorT > 220).sort((a, b) => b.floorT - a.floorT)[0];
  if (fading) return t.click(fading.x, fading.y);
  if (hungry[0] && room && !t.aliens.length) return feed(hungry[0]);
  if (coin) return t.click(coin.x + jitter() / 3, coin.y + jitter() / 3);
  if (t.aliens.length) return null;
  return undefined;
}

/**
 * Challenge shopping: prices keep rising, so egg pieces come first, and the
 * money goes into what pays straight back: lots of guppies (or breeders in
 * tank 4), food, and enough laser for the growing attacks. Fish that need a
 * steady supply of other fish to eat are left alone.
 */
const CHALLENGE_PLAN = {
  1: { fish: 24, laser: 4, count: 4 },
  2: { fish: 26, laser: 5, count: 4 },
  3: { fish: 30, laser: 6, count: 5 },
  4: { fish: 8, laser: 6, count: 5 },
};
function challengeShop(t, get, first, guppies, reserve) {
  const plan = CHALLENGE_PLAN[t.def.challenge];
  const egg = get('egg');
  if (egg?.affordable) return t.buy('egg');
  const count = (k) => t.fish.filter((f) => f.kind === k && !f.dead).length;
  const order = [];
  if (guppies < 4) order.push(first);
  order.push('quality');
  if (t.laser() < Math.min(plan.laser, 3)) order.push('weapon');
  if (guppies < plan.fish / 2) order.push(first);
  if (t.maxFood() < plan.count) order.push('count');
  if (t.laser() < plan.laser) order.push('weapon');
  if (guppies < plan.fish) order.push(first);
  if (plan.carnivores && count('carnivore') < plan.carnivores && count('guppy') > 6) order.push('carnivore');
  for (const id of order) {
    const it = get(id);
    if (!it || it.maxed) continue;
    if (it.affordable && t.money - it.cost >= reserve) return t.buy(id);
    return; // save up for it
  }
}

export function play(def, seed = 1, pets = []) {
  const t = createTank({ def, pets, seed });
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 60 * 60 * 30 && !t.outcome; i++) {
    act(t, i, rand);
    t.step();
  }
  return { outcome: t.outcome, min: (t.time / 3600).toFixed(1), lost: t.stats.lost, aliens: t.stats.aliens };
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('bot.mjs')) {
  const owned = [];
  let failed = 0;
  for (const def of [...LEVELS, BOSS, ...CHALLENGE]) {
    // Challenge gets pets picked for it: two coin collectors and a feeder.
    const pets = def.challenge ? CHALLENGE_PETS : owned.slice(-3);
    const r = play(def, 3, pets);
    console.log(def.id, r.outcome, `${r.min} min`, `lost ${r.lost}`, `aliens ${r.aliens}`, `pets ${pets.join(',')}`);
    if (r.outcome !== 'clear') failed++;
    if (def.pet) owned.push(def.pet);
  }
  if (failed) {
    console.error(`${failed} level(s) not cleared`);
    process.exitCode = 1;
  }
}
