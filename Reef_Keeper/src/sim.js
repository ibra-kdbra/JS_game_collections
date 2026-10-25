/**
 * Reef Keeper game logic. Pure: no DOM, no timers, so the same code runs in the
 * browser and in the headless checks (tools/verify.mjs). Coordinates are frame
 * pixels (640 x 480); the tank is the part below the shop bar.
 *
 *   const world = createWorld({ level: 0, seed: 1, pets: ['snail'] });
 *   world.click(x, y);     // collect a coin, shoot an alien, or drop food
 *   world.buy('guppy');    // see world.shop()
 *   world.step();          // 60 steps per second
 *   world.outcome          // null | 'clear' | 'lost'
 */
import { TANK, FISH, COINS, FOOD, WEAPON, ALIENS, LEVELS, LIMITS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const TOP = TANK.surface + 18;
const BOTTOM = TANK.floor - 22;

export function createWorld({ level = 0, seed = 1, pets = [] } = {}) {
  const L = LEVELS[level];
  const rand = mulberry32(seed);
  const events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });
  let nextId = 1;

  const world = {
    level,
    def: L,
    time: 0,
    money: L.start.money,
    eggs: 0,
    fish: [],
    food: [],
    coins: [],
    pets: [],
    alien: null,
    warning: 0,
    nextAlien: L.aliens ? L.aliens.first : Infinity,
    up: { quality: 0, count: 0, weapon: 0 },
    outcome: null,
    events,
    stats: { coins: 0, earned: 0, fed: 0, starved: 0, eaten: 0, aliens: 0, bought: 0, wasted: 0 },
    step,
    click,
    buy,
    shop,
    maxFood,
    isHungry: (f) => world.time >= f.fedUntil,
    sizeOf,
  };

  /* ---------- Fish ---------- */

  function spawnFish(kind, x = 80 + rand() * (TANK.w - 160), y = TANK.surface + 6) {
    const spec = FISH[kind];
    const f = {
      id: nextId++,
      kind,
      x,
      y,
      vx: (rand() - 0.5) * 0.5,
      vy: 1.2, // drops in from the surface
      face: rand() < 0.5 ? -1 : 1,
      turn: 1, // -1..1, eases towards face: the sprite flips through its width
      stage: 0,
      growth: 0,
      fedUntil: world.time + spec.hungryAfter,
      starveAt: world.time + spec.starveAfter,
      coinT: 200 + Math.floor(rand() * 200),
      breedT: spec.breedEvery ?? 0,
      goal: null,
      goalT: 0,
      eatT: 0,
      dead: false,
      deadT: 0,
      bornT: 0,
      phase: rand() * 100,
    };
    f.turn = f.face;
    world.fish.push(f);
    return f;
  }

  for (let i = 0; i < L.start.guppies; i++) spawnFish('guppy', 160 + i * 220, TOP + 60);

  function sizeOf(f) {
    return f.kind === 'guppy' ? FISH.guppy.size[f.stage] : FISH[f.kind].size;
  }

  function feed(f, foodLevel) {
    const spec = FISH[f.kind];
    const fl = FOOD.levels[foodLevel] ?? FOOD.levels[0];
    const fed = Math.round(spec.hungryAfter * (f.kind === 'carnivore' ? 1 : fl.fed));
    f.fedUntil = world.time + fed;
    f.starveAt = f.fedUntil + (spec.starveAfter - spec.hungryAfter);
    f.eatT = 16;
    world.stats.fed++;
    if (f.kind === 'guppy' && f.stage < 2) {
      f.growth += fl.growth;
      if (f.growth >= FISH.guppy.grow[f.stage]) {
        f.growth = 0;
        f.stage++;
        f.coinT = 90;
        emit('grow', { x: f.x, y: f.y, stage: f.stage });
      }
    }
    emit('eat', { x: f.x, y: f.y, kind: f.kind });
  }

  function steer(f, tx, ty, speed, k) {
    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    f.vx += ((dx / d) * speed - f.vx) * k;
    f.vy += ((dy / d) * speed - f.vy) * k;
  }

  function nearest(list, from, ok = () => true) {
    let best = null;
    let bd = Infinity;
    for (const o of list) {
      if (!ok(o)) continue;
      const d = dist(o, from);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return [best, bd];
  }

  function stepFish(f) {
    f.bornT++;
    if (f.eatT > 0) f.eatT--;
    f.turn += (f.face - f.turn) * 0.18;
    if (f.dead) {
      f.deadT++;
      f.vx *= 0.9;
      f.y = Math.min(BOTTOM + 8, f.y + 0.45);
      return;
    }
    const spec = FISH[f.kind];
    if (world.time >= f.starveAt) {
      f.dead = true;
      world.stats.starved++;
      emit('starve', { x: f.x, y: f.y });
      return;
    }
    // Falling in from the surface after being bought.
    if (f.bornT < 40) {
      f.y += f.vy;
      f.vy *= 0.94;
      return;
    }
    const base = f.kind === 'guppy' ? spec.speed[f.stage] : spec.speed;
    let chasing = false;
    if (world.isHungry(f)) {
      if (f.kind === 'carnivore') {
        const [prey, d] = nearest(world.fish, f, (o) => o.kind === 'guppy' && o.stage === 0 && !o.dead && o.bornT > 40);
        if (prey) {
          chasing = true;
          steer(f, prey.x, prey.y, base * 1.9, 0.14);
          if (d < sizeOf(f) * 0.7 + 6) {
            world.fish = world.fish.filter((o) => o !== prey);
            world.stats.eaten++;
            emit('gulp', { x: prey.x, y: prey.y, by: 'carnivore' });
            feed(f, 0);
          }
        }
      } else {
        const [p, d] = nearest(world.food, f);
        if (p) {
          chasing = true;
          steer(f, p.x, p.y, base * 2.0, 0.15);
          if (d < sizeOf(f) * 0.6 + 8) {
            world.food = world.food.filter((o) => o !== p);
            feed(f, p.level);
          }
        }
      }
    }
    if (!chasing) {
      if (!f.goal || --f.goalT <= 0 || dist(f, f.goal) < 14) {
        f.goal = { x: 40 + rand() * (TANK.w - 80), y: TOP + rand() * (BOTTOM - TOP) };
        f.goalT = 150 + rand() * 260;
      }
      // Cruise, with the odd lazy pause.
      const pace = 0.35 + 0.65 * Math.sin((world.time + f.phase * 13) / 110) ** 2;
      steer(f, f.goal.x, f.goal.y, base * pace, 0.035);
    }
    f.x = clamp(f.x + f.vx, 24, TANK.w - 24);
    f.y = clamp(f.y + f.vy, TOP, BOTTOM);
    if (Math.abs(f.vx) > 0.2) f.face = f.vx > 0 ? 1 : -1;

    // Coins and babies.
    if (f.kind === 'breeder') {
      if (!world.isHungry(f) && --f.breedT <= 0) {
        f.breedT = spec.breedEvery;
        if (world.fish.length < LIMITS.fish) {
          spawnFish('guppy', f.x, f.y).bornT = 40;
          emit('birth', { x: f.x, y: f.y });
        }
      }
    } else {
      const type = f.kind === 'guppy' ? spec.coin[f.stage] : spec.coin;
      const every = f.kind === 'guppy' ? spec.coinEvery[f.stage] : spec.coinEvery;
      if (type && --f.coinT <= 0) {
        f.coinT = every * (0.85 + rand() * 0.3);
        dropCoin(type, f.x, f.y + 8);
      }
    }
  }

  /* ---------- Coins, food, pets ---------- */

  function dropCoin(type, x, y) {
    world.coins.push({ id: nextId++, x, y, type, vy: 0.2, floorT: 0, spin: rand() * 10 });
    emit('drop', { x, y, coin: type });
  }

  function maxFood() {
    return Math.min(FOOD.max, FOOD.start + world.up.count);
  }

  function addFood(x, y, free = false) {
    world.food.push({ id: nextId++, x: clamp(x, 16, TANK.w - 16), y: clamp(y, TANK.surface + 4, BOTTOM), level: world.up.quality, floorT: 0, free });
  }

  function stepFood() {
    for (const p of world.food) {
      if (p.y < TANK.floor - 6) p.y += FOOD.sink;
      else p.floorT++;
    }
    const before = world.food.length;
    world.food = world.food.filter((p) => p.floorT < 45);
    world.stats.wasted += before - world.food.length;
  }

  function collect(c, by = 'click') {
    world.coins = world.coins.filter((k) => k !== c);
    const v = COINS[c.type].value;
    world.money += v;
    world.stats.coins++;
    world.stats.earned += v;
    emit('coin', { x: c.x, y: c.y, value: v, coin: c.type, by });
  }

  function stepCoins() {
    for (const c of world.coins) {
      const r = COINS[c.type].r;
      if (c.y < TANK.floor - r) {
        c.vy = Math.min(c.type === 'chest' ? 1.4 : COINS.sink, c.vy + 0.03);
        c.y = Math.min(TANK.floor - r, c.y + c.vy);
        if (c.y >= TANK.floor - r) emit('land', { x: c.x, y: c.y, coin: c.type });
      } else c.floorT++;
    }
    const before = world.coins.length;
    world.coins = world.coins.filter((c) => c.type === 'chest' || c.floorT <= COINS.floorLife);
    if (world.coins.length < before) emit('fade');
  }

  for (const kind of pets) {
    const p = { kind, x: TANK.w * (0.25 + 0.25 * world.pets.length), y: TANK.floor - 4, face: 1, t: 0, walking: false, timer: 0 };
    if (kind === 'clam') p.timer = 900;
    if (kind === 'puffer') {
      p.y = TOP + 40;
      p.timer = 600;
    }
    world.pets.push(p);
  }

  function stepPets() {
    for (const p of world.pets) {
      p.t++;
      if (p.kind === 'snail') {
        // Crawls to the coin closest to the sand and picks it up there.
        let best = null;
        for (const c of world.coins) if (c.y > TANK.floor - 70 && (!best || c.y > best.y)) best = c;
        if (best) {
          const dx = best.x - p.x;
          p.x += clamp(dx, -1.3, 1.3);
          p.face = dx >= 0 ? 1 : -1;
          p.walking = Math.abs(dx) > 1;
          if (Math.abs(dx) < 16 && best.y > TANK.floor - 40) collect(best, 'pet');
        } else p.walking = false;
      } else if (p.kind === 'clam') {
        if (--p.timer <= 0) {
          p.timer = 1800;
          dropCoin('pearl', p.x, TANK.floor - COINS.pearl.r);
          emit('pearl', { x: p.x, y: p.y });
        }
        p.open = p.timer < 90 || p.timer > 1740;
      } else if (p.kind === 'puffer') {
        // Drifts about and feeds the fish nearest to starving.
        p.x = TANK.w / 2 + Math.sin(p.t / 300) * (TANK.w / 2 - 70);
        p.y = TOP + 30 + Math.sin(p.t / 170) * 30;
        p.face = Math.cos(p.t / 300) >= 0 ? 1 : -1;
        if (--p.timer <= 0) {
          p.timer = 900;
          const starving = world.fish.filter((f) => !f.dead && f.kind !== 'carnivore' && world.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt)[0];
          if (starving) {
            addFood(starving.x, Math.max(TANK.surface + 6, starving.y - 40), true);
            emit('petFood', { x: p.x, y: p.y });
          }
        }
      }
    }
  }

  /* ---------- Aliens ---------- */

  function stepAlien() {
    const a = world.alien;
    if (!a) {
      if (world.warning > 0) {
        if (--world.warning === 0) {
          const spec = ALIENS[L.aliens.kind];
          const side = rand() < 0.5 ? -1 : 1;
          world.alien = { kind: L.aliens.kind, x: TANK.w / 2 + side * 150, y: TOP + 70, hp: spec.hp, maxHp: spec.hp, biteT: 90, face: -side, hitT: 0, t: 0, chomp: 0 };
          emit('alien', { kind: L.aliens.kind });
        }
      } else if (world.time >= world.nextAlien) {
        world.warning = ALIENS.warning;
        world.nextAlien = world.time + ALIENS.warning + L.aliens.every;
        emit('warning');
      }
      return;
    }
    const spec = ALIENS[a.kind];
    a.t++;
    if (a.hitT > 0) a.hitT--;
    if (a.chomp > 0) a.chomp--;
    const [prey, d] = nearest(world.fish, a, (f) => !f.dead);
    const tx = prey ? prey.x : TANK.w / 2 + Math.sin(a.t / 90) * 200;
    const ty = prey ? prey.y : TOP + 100 + Math.cos(a.t / 70) * 60;
    const dx = tx - a.x;
    const dy = ty - a.y;
    const dd = Math.hypot(dx, dy) || 1;
    const speed = spec.speed * (a.hitT > 0 ? 0.3 : 1);
    a.x = clamp(a.x + (dx / dd) * speed, 40, TANK.w - 40);
    a.y = clamp(a.y + (dy / dd) * speed, TOP + 10, BOTTOM - 10);
    if (Math.abs(dx) > 3) a.face = dx > 0 ? 1 : -1;
    if (a.biteT > 0) a.biteT--;
    if (prey && d < spec.r * 0.75 && a.biteT === 0) {
      world.fish = world.fish.filter((f) => f !== prey);
      world.stats.eaten++;
      a.biteT = spec.bite;
      a.chomp = 20;
      emit('gulp', { x: prey.x, y: prey.y, by: 'alien' });
    }
  }

  function shoot(x, y) {
    const a = world.alien;
    const spec = ALIENS[a.kind];
    if (Math.hypot(x - a.x, y - a.y) > spec.r + 18) return false;
    a.hp -= WEAPON.damage[world.up.weapon];
    a.hitT = 10;
    const d = Math.hypot(a.x - x, a.y - y) || 1;
    a.x = clamp(a.x + ((a.x - x) / d) * 10, 40, TANK.w - 40);
    a.y = clamp(a.y + ((a.y - y) / d) * 10, TOP + 10, BOTTOM - 10);
    emit('hit', { x, y, damage: WEAPON.damage[world.up.weapon] });
    if (a.hp <= 0) {
      world.alien = null;
      world.stats.aliens++;
      dropCoin(spec.reward, a.x, a.y);
      emit('defeat', { x: a.x, y: a.y, kind: a.kind });
    }
    return true;
  }

  /* ---------- Player ---------- */

  /**
   * A click or tap at frame coordinates. Returns what happened:
   * 'coin' | 'hit' | 'miss' | 'food' | 'full' (food limit) | 'broke' | 'none'.
   */
  function click(x, y) {
    if (world.outcome) return 'none';
    if (y < TANK.y) return 'none';
    let best = null;
    let bd = Infinity;
    for (const c of world.coins) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < COINS[c.type].r + COINS.grab && d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best) {
      collect(best);
      return 'coin';
    }
    if (world.alien) {
      if (shoot(x, y)) return 'hit';
      emit('miss', { x, y });
      return 'miss';
    }
    if (world.food.filter((p) => !p.free).length >= maxFood()) {
      emit('full', { x, y });
      return 'full';
    }
    if (world.money < FOOD.cost) {
      emit('broke', { x, y });
      return 'broke';
    }
    world.money -= FOOD.cost;
    addFood(x, Math.max(y, TANK.surface + 4));
    emit('food', { x, y });
    return 'food';
  }

  const fishCount = () => world.fish.filter((f) => !f.dead).length;

  function shop() {
    return L.shop.map((id) => {
      let cost = null;
      let level = null;
      if (id === 'guppy' || id === 'carnivore' || id === 'breeder') cost = FISH[id].cost;
      else if (id === 'quality') {
        level = world.up.quality;
        cost = level + 1 < FOOD.levels.length ? FOOD.qualityCost[level + 1] : null;
      } else if (id === 'count') {
        level = maxFood();
        cost = level < FOOD.max ? FOOD.countCost : null;
      } else if (id === 'weapon') {
        level = world.up.weapon;
        cost = level + 1 < WEAPON.cost.length ? WEAPON.cost[level + 1] : null;
      } else if (id === 'egg') {
        level = world.eggs;
        cost = L.egg;
      }
      const full = FISH[id] && fishCount() >= LIMITS.fish;
      return { id, cost, level, maxed: cost === null, affordable: cost !== null && !full && world.money >= cost };
    });
  }

  function buy(id) {
    if (world.outcome) return false;
    const item = shop().find((i) => i.id === id);
    if (!item || !item.affordable) {
      emit('cantBuy', { id });
      return false;
    }
    world.money -= item.cost;
    world.stats.bought++;
    if (FISH[id]) spawnFish(id);
    else if (id === 'quality') world.up.quality++;
    else if (id === 'count') world.up.count++;
    else if (id === 'weapon') world.up.weapon++;
    else if (id === 'egg') {
      world.eggs++;
      if (world.eggs >= 3) {
        world.outcome = 'clear';
        emit('clear', { hatch: L.hatch });
      }
    }
    emit('buy', { id });
    return true;
  }

  /* ---------- Step ---------- */

  function step() {
    events.length = 0;
    if (world.outcome) return;
    world.time++;
    for (const f of world.fish) stepFish(f);
    world.fish = world.fish.filter((f) => !f.dead || f.deadT < 240);
    stepFood();
    stepCoins();
    stepPets();
    if (L.aliens) stepAlien();
    const alive = world.fish.some((f) => !f.dead);
    if (!alive && world.coins.length === 0 && world.money < FISH.guppy.cost) {
      world.outcome = 'lost';
      emit('lost');
    }
  }

  return world;
}
