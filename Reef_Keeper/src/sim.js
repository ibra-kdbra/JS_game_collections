/**
 * Reef Keeper game logic. Pure: no DOM, no timers, so the same code runs in the
 * browser and in the headless checks (tools/verify.mjs).
 *
 *   const world = createWorld({ level: 0, seed: 1 });
 *   world.click(x, y);       // collect a coin, shoot an invader, or drop food
 *   world.buy('minnow');     // see world.shop()
 *   world.step();            // 60 steps per second
 *   world.outcome            // null | 'clear' | 'lost'
 */
import { TANK, FISH, COINS, FOOD, WEAPON, INVADERS, CRAB, LEVELS, LIMITS } from './config.js';

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

export function createWorld({ level = 0, seed = 1, upgrades = null } = {}) {
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
    shards: 0,
    fish: [],
    pellets: [],
    coins: [],
    crab: null,
    invader: null,
    warning: 0, // steps until the next invader arrives, while the warning shows
    nextInvader: L.invaders.first,
    // Upgrades carry over between levels within a game.
    up: upgrades ? { ...upgrades } : { quality: 0, count: 0, weapon: 0 },
    outcome: null,
    events,
    stats: { coins: 0, earned: 0, fed: 0, starved: 0, eaten: 0, invaders: 0, bought: 0 },
    step,
    click,
    buy,
    shop,
    maxPellets,
  };

  /* ---------- Fish ---------- */

  function spawnFish(kind, x = 120 + rand() * (TANK.w - 240), y = TANK.surface + 30) {
    const f = {
      id: nextId++,
      kind,
      x,
      y,
      vx: 0,
      vy: 1,
      face: rand() < 0.5 ? -1 : 1,
      stage: 0,
      growth: 0,
      fedUntil: world.time + FISH[kind].hungryAfter,
      starveAt: world.time + FISH[kind].starveAfter,
      coinT: Math.floor(rand() * 300),
      goal: null,
      goalT: 0,
      dead: false,
      deadT: 0,
      wiggle: rand() * 100,
      spawnT: 0,
    };
    world.fish.push(f);
    return f;
  }

  for (let i = 0; i < L.start.minnows; i++) spawnFish('minnow');

  const sizeOf = (f) => (f.kind === 'pike' ? FISH.pike.size : FISH.minnow.size[f.stage]);
  const speedOf = (f) => (f.kind === 'pike' ? FISH.pike.speed : FISH.minnow.speed[f.stage]);
  const hungry = (f) => world.time >= f.fedUntil;
  world.isHungry = hungry;
  world.sizeOf = sizeOf;

  function feed(f, foodLevel) {
    const spec = FISH[f.kind];
    const fl = FOOD.levels[foodLevel];
    const fed = Math.round(spec.hungryAfter * (f.kind === 'pike' ? 1 : fl.fed));
    f.fedUntil = world.time + fed;
    f.starveAt = f.fedUntil + (spec.starveAfter - spec.hungryAfter);
    world.stats.fed++;
    if (f.kind === 'minnow' && f.stage < 2) {
      f.growth += fl.growth;
      const need = FISH.minnow.grow[f.stage];
      if (f.growth >= need) {
        f.growth = 0;
        f.stage++;
        f.coinT = 120;
        emit('grow', { x: f.x, y: f.y, stage: f.stage });
      }
    }
    emit('eat', { x: f.x, y: f.y });
  }

  function steer(f, tx, ty, speed, k = 0.08) {
    const dx = tx - f.x;
    const dy = ty - f.y;
    const d = Math.hypot(dx, dy) || 1;
    f.vx += ((dx / d) * speed - f.vx) * k;
    f.vy += ((dy / d) * speed - f.vy) * k;
  }

  function stepFish(f) {
    if (f.dead) {
      f.deadT++;
      f.vx *= 0.95;
      f.y = Math.min(TANK.floor - 6, f.y + 0.5);
      return;
    }
    const spec = FISH[f.kind];
    if (world.time >= f.starveAt) {
      f.dead = true;
      world.stats.starved++;
      emit('starve', { x: f.x, y: f.y });
      return;
    }
    const speed = speedOf(f);
    let chasing = false;
    if (hungry(f)) {
      if (f.kind === 'minnow') {
        let best = null;
        let bd = Infinity;
        for (const p of world.pellets) {
          const d = dist(f, p);
          if (d < bd) {
            bd = d;
            best = p;
          }
        }
        if (best) {
          chasing = true;
          steer(f, best.x, best.y, speed * 1.7, 0.12);
          if (bd < sizeOf(f) * 0.6 + 6) {
            best.eaten = true;
            world.pellets = world.pellets.filter((p) => p !== best);
            feed(f, best.level);
          }
        }
      } else {
        // Pike hunt the smallest minnows.
        let best = null;
        let bd = Infinity;
        for (const m of world.fish) {
          if (m.kind !== 'minnow' || m.stage !== 0 || m.dead) continue;
          const d = dist(f, m);
          if (d < bd) {
            bd = d;
            best = m;
          }
        }
        if (best) {
          chasing = true;
          steer(f, best.x, best.y, speed * 1.6, 0.12);
          if (bd < sizeOf(f) * 0.6 + 8) {
            world.fish = world.fish.filter((m) => m !== best);
            world.stats.eaten++;
            emit('gulp', { x: best.x, y: best.y });
            feed(f, 0);
          }
        }
      }
    }
    if (!chasing) {
      if (!f.goal || --f.goalT <= 0 || dist(f, f.goal) < 12) {
        f.goal = { x: 40 + rand() * (TANK.w - 80), y: TANK.surface + 30 + rand() * (TANK.floor - TANK.surface - 80) };
        f.goalT = 180 + rand() * 300;
      }
      steer(f, f.goal.x, f.goal.y, speed * (0.5 + 0.5 * Math.sin((world.time + f.wiggle * 9) / 90) ** 2), 0.04);
    }
    f.x = clamp(f.x + f.vx, 20, TANK.w - 20);
    f.y = clamp(f.y + f.vy, TANK.surface + 14, TANK.floor - 18);
    if (Math.abs(f.vx) > 0.15) f.face = f.vx > 0 ? 1 : -1;

    // Coins.
    const every = f.kind === 'pike' ? spec.coinEvery : spec.coinEvery[f.stage];
    const type = f.kind === 'pike' ? spec.coin : spec.coin[f.stage];
    if (type && --f.coinT <= 0) {
      f.coinT = every * (0.85 + rand() * 0.3);
      world.coins.push({ id: nextId++, x: f.x, y: f.y + 6, type, floorT: 0, vx: (rand() - 0.5) * 0.3 });
      emit('drop', { x: f.x, y: f.y, coin: type });
    }
  }

  /* ---------- Food and coins ---------- */

  function maxPellets() {
    return FOOD.maxCount[0] + world.up.count;
  }

  function dropFood(x, y) {
    if (world.pellets.length >= maxPellets() || world.money < FOOD.cost) return false;
    world.money -= FOOD.cost;
    world.pellets.push({ x: clamp(x, 20, TANK.w - 20), y: clamp(y, TANK.surface, TANK.floor - 10), level: world.up.quality, floorT: 0 });
    emit('food', { x, y });
    return true;
  }

  function stepPellets() {
    for (const p of world.pellets) {
      if (p.y < TANK.floor - 6) p.y += FOOD.sink;
      else p.floorT++;
    }
    world.pellets = world.pellets.filter((p) => p.floorT < 40);
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
      if (c.y < TANK.floor - COINS[c.type].r) {
        c.y += c.type === 'chest' ? COINS.sink * 1.4 : COINS.sink;
        c.x = clamp(c.x + c.vx, 16, TANK.w - 16);
      } else {
        c.floorT++;
      }
    }
    const gone = world.coins.filter((c) => c.floorT > COINS.floorLife && c.type !== 'chest');
    if (gone.length) world.coins = world.coins.filter((c) => !gone.includes(c));
  }

  function stepCrab() {
    const crab = world.crab;
    if (!crab) return;
    // Head for the lowest coin; pick it up once it is near the sand.
    let best = null;
    for (const c of world.coins) if (!best || c.y > best.y) best = c;
    if (best) {
      const dx = best.x - crab.x;
      crab.x += clamp(dx, -CRAB.speed, CRAB.speed);
      crab.face = dx >= 0 ? 1 : -1;
      crab.walking = Math.abs(dx) > 1;
      if (Math.abs(dx) < 18 && best.y > TANK.floor - 34) collect(best, 'crab');
    } else crab.walking = false;
  }

  /* ---------- Invaders ---------- */

  function stepInvaders() {
    const inv = world.invader;
    if (!inv) {
      if (world.warning > 0) {
        if (--world.warning === 0) {
          const spec = INVADERS[L.invaders.kind];
          const side = rand() < 0.5 ? -1 : 1;
          world.invader = { kind: L.invaders.kind, x: side < 0 ? -40 : TANK.w + 40, y: 140 + rand() * 160, hp: spec.hp, maxHp: spec.hp, biteT: 60, face: -side, hitT: 0, t: 0 };
          emit('invader', { kind: L.invaders.kind });
        }
      } else if (world.time >= world.nextInvader) {
        world.warning = INVADERS.warning;
        world.nextInvader = world.time + L.invaders.every;
        emit('warning');
      }
      return;
    }
    const spec = INVADERS[inv.kind];
    inv.t++;
    if (inv.hitT > 0) inv.hitT--;
    let best = null;
    let bd = Infinity;
    for (const f of world.fish) {
      if (f.dead) continue;
      const d = dist(inv, f);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    const tx = best ? best.x : TANK.w / 2 + Math.sin(inv.t / 80) * 200;
    const ty = best ? best.y : 200 + Math.cos(inv.t / 60) * 80;
    const dx = tx - inv.x;
    const dy = ty - inv.y;
    const d = Math.hypot(dx, dy) || 1;
    const slow = inv.hitT > 0 ? 0.35 : 1; // knocked back a little by each hit
    inv.x += (dx / d) * spec.speed * slow;
    inv.y += (dy / d) * spec.speed * slow;
    inv.y = clamp(inv.y, TANK.surface + 30, TANK.floor - 40);
    if (Math.abs(dx) > 2) inv.face = dx > 0 ? 1 : -1;
    if (inv.biteT > 0) inv.biteT--;
    if (best && bd < spec.size * 0.7 && inv.biteT === 0) {
      world.fish = world.fish.filter((f) => f !== best);
      world.stats.eaten++;
      inv.biteT = spec.bite;
      emit('gulp', { x: best.x, y: best.y, by: 'invader' });
    }
  }

  function shoot(x, y) {
    const inv = world.invader;
    if (!inv) return false;
    const spec = INVADERS[inv.kind];
    if (Math.hypot(x - inv.x, y - inv.y) > spec.size + 10) return false;
    inv.hp -= WEAPON.damage[world.up.weapon];
    inv.hitT = 8;
    // Each hit nudges it away from the click.
    const d = Math.hypot(inv.x - x, inv.y - y) || 1;
    inv.x += ((inv.x - x) / d) * 6;
    inv.y += ((inv.y - y) / d) * 6;
    emit('hit', { x, y });
    if (inv.hp <= 0) {
      world.invader = null;
      world.stats.invaders++;
      world.coins.push({ id: nextId++, x: inv.x, y: inv.y, type: spec.reward, floorT: 0, vx: 0 });
      emit('defeat', { x: inv.x, y: inv.y });
    }
    return true;
  }

  /* ---------- Player actions ---------- */

  /** A click or tap at tank coordinates. Returns what it did. */
  function click(x, y) {
    if (world.outcome) return null;
    // Coins first: the nearest one under the pointer.
    let best = null;
    let bd = Infinity;
    for (const c of world.coins) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < COINS[c.type].r + 14 && d < bd) {
        bd = d;
        best = c;
      }
    }
    if (best) {
      collect(best);
      return 'coin';
    }
    // While an invader is in the tank, clicks are shots: no feeding.
    if (world.invader) return shoot(x, y) ? 'hit' : 'miss';
    return dropFood(x, y) ? 'food' : 'none';
  }

  function shop() {
    const items = [];
    for (const id of L.shop) {
      let cost = null;
      let label = '';
      let level = null;
      if (id === 'minnow') {
        cost = FISH.minnow.cost;
        label = 'Minnow';
      } else if (id === 'pike') {
        cost = FISH.pike.cost;
        label = 'Pike';
      } else if (id === 'quality') {
        const next = world.up.quality + 1;
        cost = next < FOOD.levels.length ? FOOD.qualityCost[next] : null;
        label = next < FOOD.levels.length ? FOOD.levels[next].name : FOOD.levels[world.up.quality].name;
        level = world.up.quality;
      } else if (id === 'count') {
        cost = maxPellets() < FOOD.maxCount[1] ? FOOD.countCost : null;
        label = `Food ×${maxPellets()}`;
        level = maxPellets();
      } else if (id === 'weapon') {
        const next = world.up.weapon + 1;
        cost = next < WEAPON.cost.length ? WEAPON.cost[next] : null;
        label = 'Zapper';
        level = world.up.weapon;
      } else if (id === 'crab') {
        cost = world.crab ? null : CRAB.cost;
        label = 'Crab';
      } else if (id === 'shard') {
        cost = L.shard;
        label = 'Pearl';
        level = world.shards;
      }
      const full = (id === 'minnow' || id === 'pike') && world.fish.length >= LIMITS.fish;
      items.push({ id, label, cost, level, maxed: cost === null, affordable: cost !== null && !full && world.money >= cost });
    }
    return items;
  }

  function buy(id) {
    if (world.outcome) return false;
    const item = shop().find((i) => i.id === id);
    if (!item || !item.affordable) return false;
    world.money -= item.cost;
    world.stats.bought++;
    if (id === 'minnow') spawnFish('minnow');
    else if (id === 'pike') spawnFish('pike');
    else if (id === 'quality') world.up.quality++;
    else if (id === 'count') world.up.count++;
    else if (id === 'weapon') world.up.weapon++;
    else if (id === 'crab') world.crab = { x: TANK.w / 2, face: 1, walking: false };
    else if (id === 'shard') {
      world.shards++;
      if (world.shards >= 3) {
        world.outcome = 'clear';
        emit('clear');
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
    world.fish = world.fish.filter((f) => !f.dead || f.deadT < 150);
    stepPellets();
    stepCoins();
    stepCrab();
    stepInvaders();
    // Lost: no live fish, nothing left to collect, and not enough money for a minnow.
    const alive = world.fish.some((f) => !f.dead);
    if (!alive && world.coins.length === 0 && world.money < FISH.minnow.cost) {
      world.outcome = 'lost';
      emit('lost');
    }
  }

  return world;
}
