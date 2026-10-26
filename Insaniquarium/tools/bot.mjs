// A reasonable player: feeds hungry fish, grabs coins, shoots aliens, buys sensibly.
// `node tools/bot.mjs` plays every Adventure level, the boss and the four Challenge tanks.
// It fails unless it clears all of Adventure, the boss and Challenge tanks 1-2. Tanks 3-4
// are only reported: like the original's, they're for experts, and this bot isn't one.
import { createTank } from '../js/tank.js';
import { LEVELS, FISH, ALIENS, BOSS, CHALLENGE, TANK } from '../js/data.js';

export function act(t, step, rand) {
  // Five clicks a second, ten while fighting.
  // Challenge is for experts: click faster there.
  if (step % (t.aliens.length || t.warning ? 6 : t.def.challenge ? 8 : 12)) return;
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
  // In Challenge prices keep rising, so egg pieces come first and the tank fills up with guppies.
  if (t.def.challenge && get('egg')?.affordable) return t.buy('egg');
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
    const r = play(def, 3, owned.slice(-3));
    console.log(def.id, r.outcome, `${r.min} min`, `lost ${r.lost}`, `aliens ${r.aliens}`, `pets ${owned.slice(-3).join(',')}`);
    if (r.outcome !== 'clear' && !(def.challenge > 2)) failed++;
    if (def.pet) owned.push(def.pet);
  }
  if (failed) {
    console.error(`${failed} level(s) not cleared`);
    process.exitCode = 1;
  }
}
