/**
 * Reef Keeper game logic. Pure: no DOM, no timers, so the same code runs in the
 * browser and in the headless checks (tools/verify.mjs). Coordinates are frame
 * pixels (640 x 480); the tank is the part below the shop bar.
 *
 *   const world = createWorld({ def: LEVELS[0], seed: 1, pets: ['snail'] });
 *   world.click(x, y);     // collect a coin, zap an alien, pop a bomb, or drop food
 *   world.buy('guppy');    // see world.shop()
 *   world.step();          // 60 steps per second
 *   world.outcome          // null | 'clear' | 'lost'
 *
 * `def` is a level from config.js, or an endless / free tank definition.
 */
import { TANK, FISH, POTION, COINS, FOOD, WEAPON, ALIENS, LIMITS, ENDLESS, LEVELS } from './config.js';

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
export const TOP = TANK.surface + 18;
export const BOTTOM = TANK.floor - 22;
const SAND = TANK.floor - 12; // where bottom dwellers swim

export function createWorld({ def = LEVELS[0], seed = 1, pets = [] } = {}) {
  const rand = mulberry32(seed);
  const events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });
  let nextId = 1;
  const has = (pet) => pets.includes(pet);
  const hungerMult = (def.hunger ?? 1) * (has('jelly') ? 1.25 : 1);

  const world = {
    def,
    level: def.index ?? 0,
    world: def.world ?? 0,
    time: 0,
    money: def.start.money,
    eggs: 0,
    fish: [],
    food: [],
    coins: [],
    pets: [],
    aliens: [],
    bombs: [],
    warning: 0,
    wave: 0,
    nextAlien: def.aliens ? def.aliens.first : def.endless ? ENDLESS.first : Infinity,
    up: { quality: 0, count: 0, weapon: 0 },
    outcome: null,
    events,
    stats: { coins: 0, earned: 0, fed: 0, starved: 0, eaten: 0, aliens: 0, bought: 0, wasted: 0, revived: 0 },
    step,
    click,
    buy,
    shop,
    maxFood,
    isHungry: (f) => world.time >= f.fedUntil,
    sizeOf,
    // Kept for the renderer and tools: the first alien, if any.
    get alien() {
      return world.aliens[0] ?? null;
    },
  };

  /* ---------- Fish ---------- */

  function spawnFish(kind, x = 80 + rand() * (TANK.w - 160), y = TANK.surface + 6) {
    const spec = FISH[kind];
    const f = {
      id: nextId++,
      kind,
      x,
      y: spec.bottom ? TANK.surface + 6 : y,
      vx: (rand() - 0.5) * 0.5,
      vy: 1.2,
      face: rand() < 0.5 ? -1 : 1,
      turn: 1,
      stage: 0,
      growth: 0,
      fedUntil: world.time + spec.hungryAfter * hungerMult,
      starveAt: world.time + spec.starveAfter * hungerMult,
      coinT: 200 + Math.floor(rand() * 200),
      breedT: spec.breedEvery ?? 0,
      grubT: spec.grubEvery ?? 0,
      owed: 0, // coins earned by eating (starcatcher, muncher)
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

  for (let i = 0; i < def.start.guppies; i++) spawnFish('guppy', 160 + i * (320 / Math.max(1, def.start.guppies - 1)), TOP + 60);

  function sizeOf(f) {
    return f.kind === 'guppy' ? FISH.guppy.size[f.stage] : FISH[f.kind].size;
  }

  function feed(f, level = 0) {
    const spec = FISH[f.kind];
    const fl = FOOD.levels[level] ?? FOOD.levels[0];
    const fedMult = f.kind === 'guppy' || f.kind === 'breeder' || f.kind === 'grubber' ? fl.fed : 1;
    f.fedUntil = world.time + Math.round(spec.hungryAfter * fedMult * hungerMult);
    f.starveAt = f.fedUntil + Math.round((spec.starveAfter - spec.hungryAfter) * hungerMult);
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

  function removeFish(f, by) {
    world.fish = world.fish.filter((o) => o !== f);
    world.stats.eaten++;
    emit('gulp', { x: f.x, y: f.y, by });
  }

  /** What a hungry fish goes for; returns true while chasing. */
  function hunt(f, base) {
    const reach = sizeOf(f) * 0.6 + 8;
    const chase = (target, d, onCatch, k = 0.15, mult = 2) => {
      if (!target) return false;
      steer(f, target.x, FISH[f.kind].bottom ? SAND : target.y, base * mult, k);
      if (d < reach + (FISH[f.kind].bottom ? 14 : 0)) onCatch(target);
      return true;
    };
    const eatFood = (p) => {
      world.food = world.food.filter((o) => o !== p);
      feed(f, p.level);
    };
    switch (f.kind) {
      case 'guppy':
      case 'breeder': {
        const [p, d] = nearest(world.food, f, (o) => o.kind === 'food');
        return chase(p, d, eatFood);
      }
      case 'grubber': {
        const [p, d] = nearest(world.food, f, (o) => o.kind === 'food' && o.y > TANK.floor - 60);
        return chase(p, Math.abs(p?.x - f.x) + Math.max(0, SAND - p?.y - 30), eatFood, 0.12, 1.6);
      }
      case 'muncher': {
        const [g, d] = nearest(world.food, f, (o) => o.kind === 'grub');
        return chase(g, d, (gr) => {
          world.food = world.food.filter((o) => o !== gr);
          feed(f);
          f.owed++;
          f.coinT = 40;
        });
      }
      case 'starcatcher': {
        const [c, d] = nearest(world.coins, f, (o) => o.type === 'star' && o.y > TANK.floor - 90);
        return chase(c, Math.abs(c?.x - f.x) + Math.max(0, SAND - c?.y - 40), (star) => {
          world.coins = world.coins.filter((o) => o !== star);
          feed(f);
          f.owed++;
          f.coinT = 40;
        });
      }
      case 'carnivore': {
        const [prey, d] = nearest(world.fish, f, (o) => o.kind === 'guppy' && o.stage === 0 && !o.dead && o.bornT > 40);
        return chase(prey, d, (p) => {
          removeFish(p, 'carnivore');
          feed(f);
        }, 0.14, 1.9);
      }
      case 'leviathan': {
        const [prey, d] = nearest(world.fish, f, (o) => o.kind === 'carnivore' && !o.dead && o.bornT > 40);
        return chase(prey, d, (p) => {
          removeFish(p, 'leviathan');
          feed(f);
        }, 0.12, 1.8);
      }
    }
    return false;
  }

  function stepFish(f) {
    f.bornT++;
    if (f.eatT > 0) f.eatT--;
    f.turn += (f.face - f.turn) * 0.18;
    const spec = FISH[f.kind];
    if (f.dead) {
      f.deadT++;
      f.vx *= 0.9;
      f.y = Math.min(BOTTOM + 8, f.y + 0.45);
      return;
    }
    if (world.time >= f.starveAt) {
      f.dead = true;
      world.stats.starved++;
      emit('starve', { x: f.x, y: f.y });
      return;
    }
    if (f.bornT < 40) {
      f.y += f.vy;
      f.vy *= 0.94;
      if (spec.bottom) f.y = Math.min(SAND, f.y + 3);
      return;
    }
    const base = f.kind === 'guppy' ? spec.speed[f.stage] : spec.speed;
    let chasing = false;
    // Large guppies drink a star potion whether hungry or not.
    if (f.kind === 'guppy' && f.stage === 2) {
      const [pot, d] = nearest(world.food, f, (o) => o.kind === 'potion');
      if (pot) {
        chasing = true;
        steer(f, pot.x, pot.y, base * 2, 0.15);
        if (d < sizeOf(f) * 0.6 + 8) {
          world.food = world.food.filter((o) => o !== pot);
          f.stage = 3;
          f.coinT = 120;
          emit('star', { x: f.x, y: f.y });
        }
      }
    }
    if (!chasing && world.isHungry(f)) chasing = hunt(f, base);
    if (!chasing) {
      if (!f.goal || --f.goalT <= 0 || dist(f, f.goal) < 14) {
        f.goal = { x: 40 + rand() * (TANK.w - 80), y: spec.bottom ? SAND : TOP + rand() * (BOTTOM - TOP) };
        f.goalT = 150 + rand() * 260;
      }
      const pace = 0.35 + 0.65 * Math.sin((world.time + f.phase * 13) / 110) ** 2;
      steer(f, f.goal.x, f.goal.y, base * pace, 0.035);
    }
    f.x = clamp(f.x + f.vx, 24, TANK.w - 24);
    f.y = spec.bottom ? SAND : clamp(f.y + f.vy, TOP, BOTTOM);
    if (Math.abs(f.vx) > 0.2) f.face = f.vx > 0 ? 1 : -1;

    // Produce.
    if (f.kind === 'breeder') {
      if (!world.isHungry(f) && --f.breedT <= 0) {
        f.breedT = spec.breedEvery;
        if (world.fish.length < LIMITS.fish) {
          spawnFish('guppy', f.x, f.y).bornT = 40;
          emit('birth', { x: f.x, y: f.y });
        }
      }
    } else if (f.kind === 'grubber') {
      if (!world.isHungry(f) && --f.grubT <= 0) {
        f.grubT = spec.grubEvery;
        world.food.push({ id: nextId++, kind: 'grub', x: f.x, y: TANK.floor - 8, vy: -0.35, floorT: 0, level: 0 });
        emit('grub', { x: f.x, y: f.y });
      }
    } else if (f.kind === 'starcatcher' || f.kind === 'muncher') {
      if (f.owed > 0 && --f.coinT <= 0) {
        f.owed--;
        f.coinT = 40;
        dropCoin(spec.coin, f.x, f.y - 10);
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

  /* ---------- Coins and food ---------- */

  function dropCoin(type, x, y) {
    world.coins.push({ id: nextId++, x, y, type, vy: 0.2, floorT: 0, spin: rand() * 10 });
    emit('drop', { x, y, coin: type });
  }

  function maxFood() {
    return Math.min(FOOD.max, FOOD.start + world.up.count);
  }

  function addFood(x, y, extra = {}) {
    world.food.push({ id: nextId++, kind: 'food', x: clamp(x, 16, TANK.w - 16), y: clamp(y, TANK.surface + 4, BOTTOM), level: world.up.quality, floorT: 0, ...extra });
  }

  function stepFood() {
    for (const p of world.food) {
      if (p.kind === 'grub') {
        // Grubs wriggle up out of the sand, then sink back.
        p.vy = Math.min(0.5, p.vy + 0.002);
        p.y = Math.min(TANK.floor - 8, p.y + p.vy);
        p.x = clamp(p.x + Math.sin((world.time + p.id * 20) / 15) * 0.4, 16, TANK.w - 16);
        if (p.y >= TANK.floor - 8 && p.vy > 0) p.floorT++;
        continue;
      }
      if (p.y < TANK.floor - 6) p.y += p.kind === 'potion' ? 0.6 : FOOD.sink;
      else p.floorT++;
      // The crab brings food that reaches the sand back up.
      if (has('crab') && p.kind === 'food' && p.floorT > 20 && !p.recycled) {
        p.recycled = true;
        p.floorT = 0;
        p.y = TANK.surface + 6;
        emit('recycle', { x: p.x, y: TANK.floor - 6 });
      }
    }
    const before = world.food.length;
    world.food = world.food.filter((p) => p.floorT < (p.kind === 'food' ? 45 : p.kind === 'potion' ? 900 : 600));
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
        const fall = c.type === 'chest' ? 1.4 : c.type === 'star' ? 0.45 : COINS.sink;
        c.vy = Math.min(fall, c.vy + 0.03);
        c.y = Math.min(TANK.floor - r, c.y + c.vy);
        if (c.y >= TANK.floor - r) emit('land', { x: c.x, y: c.y, coin: c.type });
      } else c.floorT++;
    }
    const before = world.coins.length;
    world.coins = world.coins.filter((c) => c.type === 'chest' || c.floorT <= COINS.floorLife);
    if (world.coins.length < before) emit('fade');
  }

  /* ---------- Pets ---------- */

  pets.forEach((kind, i) => {
    const p = { kind, x: TANK.w * (0.25 + 0.25 * i), y: TANK.floor - 4, face: 1, t: 0, walking: false, timer: 0, tx: 0, ty: 0 };
    if (kind === 'clam') p.timer = 900;
    if (kind === 'puffer' || kind === 'seahorse' || kind === 'angel' || kind === 'jelly' || kind === 'octopus' || kind === 'eel') {
      p.y = TOP + 40 + i * 30;
      p.timer = 300;
    }
    if (kind === 'angel') p.timer = 600;
    world.pets.push(p);
  });

  function stepPets() {
    for (const p of world.pets) {
      p.t++;
      if (p.timer > 0) p.timer--;
      const drift = (sx, sy) => {
        p.tx = TANK.w / 2 + Math.sin(p.t / sx + p.x * 0.001) * (TANK.w / 2 - 70);
        p.ty = TOP + 50 + Math.sin(p.t / sy) * 50;
        p.x += (p.tx - p.x) * 0.02;
        p.y += (p.ty - p.y) * 0.02;
        p.face = p.tx >= p.x ? 1 : -1;
      };
      switch (p.kind) {
        case 'snail':
        case 'crab': {
          let best = null;
          if (p.kind === 'snail') for (const c of world.coins) if (c.y > TANK.floor - 70 && (!best || c.y > best.y)) best = c;
          if (best) {
            const dx = best.x - p.x;
            p.x += clamp(dx, -1.3, 1.3);
            p.face = dx >= 0 ? 1 : -1;
            p.walking = Math.abs(dx) > 1;
            if (Math.abs(dx) < 16 && best.y > TANK.floor - 40) collect(best, 'pet');
          } else {
            p.walking = p.kind === 'crab';
            if (p.kind === 'crab') {
              p.x += Math.sin(p.t / 120) * 0.8;
              p.face = Math.cos(p.t / 120) >= 0 ? 1 : -1;
            }
          }
          break;
        }
        case 'clam':
          if (p.timer === 0) {
            p.timer = 1800;
            dropCoin('pearl', p.x, TANK.floor - COINS.pearl.r);
            emit('pearl', { x: p.x, y: p.y });
          }
          p.open = p.timer < 90 || p.timer > 1740;
          break;
        case 'puffer':
          drift(300, 170);
          if (p.timer === 0) {
            p.timer = 900;
            const starving = world.fish.filter((f) => !f.dead && (f.kind === 'guppy' || f.kind === 'breeder') && world.isHungry(f)).sort((a, b) => a.starveAt - b.starveAt)[0];
            if (starving) {
              addFood(starving.x, Math.max(TANK.surface + 6, starving.y - 40), { free: true });
              emit('petFood', { x: p.x, y: p.y });
            }
          }
          break;
        case 'seahorse': {
          const target = p.grab && world.coins.includes(p.grab) ? p.grab : null;
          if (target) {
            const dx = target.x - p.x;
            const dy = target.y - p.y;
            const d = Math.hypot(dx, dy) || 1;
            p.x += (dx / d) * 3;
            p.y += (dy / d) * 3;
            p.face = dx >= 0 ? 1 : -1;
            if (d < 14) {
              collect(target, 'pet');
              p.grab = null;
            }
          } else {
            p.grab = null;
            drift(260, 140);
            if (p.timer === 0) {
              p.timer = 420;
              const [c] = nearest(world.coins, p, (o) => o.floorT === 0);
              p.grab = c;
            }
          }
          break;
        }
        case 'turtle':
          p.x += Math.sin(p.t / 200) * 0.5;
          p.face = Math.cos(p.t / 200) >= 0 ? 1 : -1;
          break;
        case 'octopus':
        case 'jelly':
          drift(p.kind === 'jelly' ? 400 : 330, 200);
          break;
        case 'eel':
          drift(220, 130);
          if (p.timer === 0) {
            p.timer = 120;
            const a = world.aliens.find((al) => al.kind !== 'glutton');
            if (a) {
              damage(a, 1, 'eel');
              emit('zap', { x: p.x, y: p.y, tx: a.x, ty: a.y });
            }
          }
          break;
        case 'angel':
          drift(280, 160);
          if (p.timer === 0) {
            const dead = world.fish.find((f) => f.dead);
            if (dead) {
              p.timer = 3600;
              dead.dead = false;
              dead.deadT = 0;
              dead.fedUntil = world.time + 300;
              dead.starveAt = world.time + FISH[dead.kind].starveAfter * hungerMult;
              world.stats.revived++;
              emit('revive', { x: dead.x, y: dead.y });
            } else p.timer = 30;
          }
          break;
      }
    }
  }

  /* ---------- Aliens ---------- */

  function alienPool() {
    if (def.endless) return ENDLESS.kinds(world.wave);
    return def.aliens.kinds;
  }

  function spawnAliens() {
    const groups = def.endless ? ENDLESS.count(world.wave) : 1;
    for (let g = 0; g < groups; g++) spawnGroup();
  }

  function spawnGroup() {
    const pool = alienPool();
    const kind = pool[Math.floor(rand() * pool.length)];
    const hpMult = (def.alienHp ?? 1) * (def.endless ? ENDLESS.hp(world.wave) : 1);
    const count = kind === 'twins' ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const spec = ALIENS[kind];
      const side = (i === 0 ? (rand() < 0.5 ? -1 : 1) : -world.aliens[world.aliens.length - 1].side);
      const hp = Math.round(spec.hp * hpMult);
      const a = {
        id: nextId++,
        kind,
        side,
        x: TANK.w / 2 + side * 170,
        y: kind === 'bomber' ? TANK.floor - 30 : TOP + 70 + ((i + world.aliens.length) % 4) * 60,
        hp,
        maxHp: hp,
        biteT: 90,
        face: -side,
        hitT: 0,
        t: 0,
        chomp: 0,
        stun: has('octopus') ? 240 : 0,
        bombT: spec.bombEvery ?? 0,
        shieldT: 0,
        shield: false,
      };
      if (has('octopus')) {
        a.hp = Math.round(a.hp * 0.8);
        emit('ink', { x: a.x, y: a.y });
      }
      world.aliens.push(a);
    }
    emit('alien', { kind });
  }

  function stepAliens() {
    if (!world.aliens.length) {
      if (world.warning > 0) {
        if (--world.warning === 0) spawnAliens();
      } else if (world.time >= world.nextAlien) {
        world.warning = ALIENS.warning;
        const every = def.endless ? ENDLESS.every(world.wave) : def.aliens.every;
        world.nextAlien = world.time + ALIENS.warning + every;
        emit('warning');
      }
    }
    const slow = has('turtle') ? 0.6 : 1;
    for (const a of world.aliens) {
      const spec = ALIENS[a.kind];
      a.t++;
      if (a.hitT > 0) a.hitT--;
      if (a.chomp > 0) a.chomp--;
      if (a.stun > 0) {
        a.stun--;
        continue;
      }
      if (spec.shield) {
        a.shieldT++;
        const [off, on] = spec.shield;
        const was = a.shield;
        a.shield = a.shieldT % (off + on) >= off;
        if (a.shield && !was) emit('shield', { x: a.x, y: a.y });
      }
      if (a.kind === 'bomber') {
        // Crawls along the sand under the fish and fires bombs at them.
        const [prey] = nearest(world.fish, a, (f) => !f.dead && !FISH[f.kind].bottom);
        const tx = prey ? prey.x : TANK.w / 2;
        a.x = clamp(a.x + clamp(tx - a.x, -spec.speed * slow, spec.speed * slow), 40, TANK.w - 40);
        a.face = tx >= a.x ? 1 : -1;
        if (--a.bombT <= 0 && prey) {
          a.bombT = spec.bombEvery;
          const dx = prey.x - a.x;
          const dy = prey.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          world.bombs.push({ id: nextId++, x: a.x, y: a.y - 30, vx: (dx / d) * 1.3, vy: (dy / d) * 1.3, t: 0 });
          a.chomp = 20;
          emit('fire', { x: a.x, y: a.y });
        }
        continue;
      }
      let tx;
      let ty;
      let prey = null;
      let d = Infinity;
      if (a.kind === 'glutton') {
        const [food, fd] = nearest(world.food, a, (o) => o.kind === 'food');
        if (food) {
          tx = food.x;
          ty = food.y;
          if (fd < spec.r * 0.8) {
            world.food = world.food.filter((o) => o !== food);
            a.chomp = 16;
            emit('gorge', { x: a.x, y: a.y });
            damage(a, 1, 'food');
            if (!world.aliens.includes(a)) continue;
          }
        }
      }
      if (tx === undefined) {
        [prey, d] = nearest(world.fish, a, (f) => !f.dead);
        tx = prey ? prey.x : TANK.w / 2 + Math.sin(a.t / 90) * 200;
        ty = prey ? prey.y : TOP + 100 + Math.cos(a.t / 70) * 60;
      }
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dd = Math.hypot(dx, dy) || 1;
      const speed = spec.speed * slow * (a.hitT > 0 ? 0.3 : 1);
      a.x = clamp(a.x + (dx / dd) * speed, 40, TANK.w - 40);
      a.y = clamp(a.y + (dy / dd) * speed, TOP + 10, BOTTOM - 10);
      if (Math.abs(dx) > 3) a.face = dx > 0 ? 1 : -1;
      if (a.biteT > 0) a.biteT--;
      if (!prey) [prey, d] = nearest(world.fish, a, (f) => !f.dead);
      if (prey && d < spec.r * 0.75 && a.biteT === 0 && spec.bite) {
        removeFish(prey, 'alien');
        a.biteT = spec.bite;
        a.chomp = 20;
      }
    }
    // Bombs: fly, hit fish, pop at the surface.
    for (const b of world.bombs) {
      b.t++;
      b.x += b.vx;
      b.y += b.vy;
      const [f, d] = nearest(world.fish, b, (o) => !o.dead);
      if (f && d < sizeOf(f) * 0.7 + 8) {
        b.dead = true;
        removeFish(f, 'bomb');
        emit('boom', { x: b.x, y: b.y });
      } else if (b.y < TANK.surface || b.t > 400 || b.x < 0 || b.x > TANK.w) b.dead = true;
    }
    world.bombs = world.bombs.filter((b) => !b.dead);
  }

  function damage(a, amount, by = 'click') {
    const spec = ALIENS[a.kind];
    if (a.shield && by === 'click') {
      a.hp = Math.min(a.maxHp, a.hp + amount);
      emit('heal', { x: a.x, y: a.y, amount });
      return;
    }
    a.hp -= amount;
    a.hitT = 10;
    if (a.hp <= 0) {
      world.aliens = world.aliens.filter((o) => o !== a);
      world.stats.aliens++;
      dropCoin('chest', a.x, a.kind === 'bomber' ? TANK.floor - 40 : a.y);
      emit('defeat', { x: a.x, y: a.y, kind: a.kind });
      if (!world.aliens.length) {
        world.bombs = [];
        if (def.endless) {
          world.wave++;
          emit('wave', { wave: world.wave });
        }
      }
    }
    void spec;
  }

  function shoot(x, y) {
    let target = null;
    let bd = Infinity;
    for (const a of world.aliens) {
      const d = Math.hypot(x - a.x, y - a.y);
      if (d < ALIENS[a.kind].r + 18 && d < bd) {
        bd = d;
        target = a;
      }
    }
    if (!target) return null;
    if (target.kind === 'glutton') {
      emit('bounce', { x, y });
      return 'bounce';
    }
    const dmg = WEAPON.damage[world.up.weapon];
    const shielded = target.shield;
    damage(target, dmg);
    if (!shielded) {
      const d = Math.hypot(target.x - x, target.y - y) || 1;
      if (target.kind !== 'bomber') {
        target.x = clamp(target.x + ((target.x - x) / d) * 10, 40, TANK.w - 40);
        target.y = clamp(target.y + ((target.y - y) / d) * 10, TOP + 10, BOTTOM - 10);
      }
      emit('hit', { x, y, damage: dmg });
    }
    return shielded ? 'healed' : 'hit';
  }

  /* ---------- Player ---------- */

  /**
   * A click or tap at frame coordinates. Returns what happened:
   * 'coin' | 'bomb' | 'hit' | 'healed' | 'bounce' | 'miss' | 'food' | 'full' | 'broke' | 'none'.
   */
  function click(x, y) {
    if (world.outcome || y < TANK.y) return 'none';
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
    const [bomb, bombD] = nearest(world.bombs, { x, y });
    if (bomb && bombD < 22) {
      world.bombs = world.bombs.filter((b) => b !== bomb);
      emit('pop', { x: bomb.x, y: bomb.y });
      return 'bomb';
    }
    // While a zappable alien is in the tank, clicks are shots. Only gluttons: feed them.
    const zappable = world.aliens.some((a) => a.kind !== 'glutton');
    if (world.aliens.length) {
      const shot = shoot(x, y);
      if (shot) return shot;
      if (zappable) {
        emit('miss', { x, y });
        return 'miss';
      }
    }
    if (world.food.filter((p) => p.kind === 'food' && !p.free).length >= maxFood()) {
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

  const liveCount = () => world.fish.filter((f) => !f.dead).length;

  function shop() {
    return def.shop.map((id) => {
      let cost = null;
      let level = null;
      if (FISH[id]) cost = FISH[id].cost;
      else if (id === 'potion') cost = world.food.some((p) => p.kind === 'potion') ? null : POTION.cost;
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
        cost = def.egg;
      }
      const full = FISH[id] && liveCount() >= LIMITS.fish;
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
    let fish = null;
    if (FISH[id]) fish = spawnFish(id);
    else if (id === 'potion') world.food.push({ id: nextId++, kind: 'potion', x: 120 + rand() * (TANK.w - 240), y: TANK.surface + 6, level: 0, floorT: 0 });
    else if (id === 'quality') world.up.quality++;
    else if (id === 'count') world.up.count++;
    else if (id === 'weapon') world.up.weapon++;
    else if (id === 'egg') {
      world.eggs++;
      if (world.eggs >= 3) {
        world.outcome = 'clear';
        emit('clear', { hatch: def.hatch });
      }
    }
    emit('buy', { id, x: fish?.x });
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
    if (def.aliens || def.endless) stepAliens();
    const alive = world.fish.some((f) => !f.dead);
    if (!alive && world.coins.length === 0 && world.money < FISH.guppy.cost) {
      world.outcome = 'lost';
      emit('lost');
    }
  }

  world.spawnFish = spawnFish; // for the free tank and tests
  return world;
}
