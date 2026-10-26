/**
 * The tank simulation. No drawing, no timers: call step() 60 times a second.
 *
 *   const tank = createTank({ def, pets: ['stinky'], seed });
 *   tank.click(x, y);   // shoot, collect, or drop food
 *   tank.buy('guppy');  // see tank.shop()
 *   tank.step();
 *   tank.events         // what happened this step (for sound and effects)
 *   tank.outcome        // null | 'clear' | 'lost' | 'time'
 */
import { TANK, FISH, POTION, COINS, COIN, FOOD, WEAPON, ALIENS, ALIEN_CODES, COIN_EVERY, LIMITS, CHALLENGE, STEP, BONUS, t } from './data.js';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const { top: TOP, bottom: BOTTOM, floor: FLOOR, sand: SAND, left: LEFT, right: RIGHT } = TANK;

export function createTank({ def, pets = [], seed = 1, saved = null }) {
  const rand = rng(seed);
  const events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });
  let nextId = 1;
  const has = (p) => tank.pets.some((q) => q.kind === p || q.as === p);
  const challenge = def.id === 'challenge';

  const tank = {
    def,
    time: 0,
    money: def.start.money,
    // Shells picked up in this tank (from Brinkley's treasure), paid out at the end.
    shells: 0,
    eggs: 0,
    fish: [],
    food: [],
    coins: [],
    pets: [],
    aliens: [],
    missiles: [],
    balls: [],
    warning: 0,
    incoming: null,
    wave: 0,
    // When the next warning sounds. The attack comes `ALIENS.warning` later.
    nextAlien: (challenge ? CHALLENGE.first : def.aliens ? def.aliens.first : Infinity) - ALIENS.warning,
    up: { quality: 0, count: 0, weapon: 0 },
    outcome: null,
    events,
    stats: { earned: 0, coins: 0, aliens: 0, lost: 0 },
    timeLeft: def.seconds ? def.seconds * STEP : null,
    singing: 0,
    step,
    click,
    buy,
    shop,
    maxFood,
    isHungry: (f) => !def.immortal && tank.time >= f.fedUntil,
    sizeOf,
    spawnFish,
  };

  /* ---------- Fish ---------- */

  function spawnFish(kind, x = 90 + rand() * (RIGHT - LEFT - 140), y = TANK.surface + 4, stage = 0) {
    const spec = FISH[kind];
    const f = {
      id: nextId++,
      kind,
      x,
      y,
      vx: (rand() - 0.5) * 0.6,
      vy: 1.6,
      face: rand() < 0.5 ? -1 : 1,
      turn: 0,
      stage,
      growth: 0,
      fedUntil: 0,
      starveAt: 0,
      need: 0,
      coinT: coinDelay(),
      breedT: spec.breedEvery ?? 0,
      owed: 0,
      goal: null,
      goalT: 0,
      eatT: 0,
      dead: false,
      deadT: 0,
      bornT: 0,
      hidden: false,
      phase: rand() * 100,
    };
    f.turn = f.face;
    setFull(f, t(spec.full.start[0] + rand() * (spec.full.start[1] - spec.full.start[0])));
    growthNeed(f);
    tank.fish.push(f);
    return f;
  }

  if (saved) {
    // A Virtual Tank comes back as it was left.
    for (const f of saved.fish) spawnFish(f.kind, f.x, f.y, f.stage).bornT = 99;
    Object.assign(tank.up, saved.up ?? {});
  } else for (let i = 0; i < def.start.guppies; i++) spawnFish(def.start.fish ?? 'guppy', 200 + i * (240 / Math.max(1, def.start.guppies - 1)), TOP + 60);

  function sizeOf(f) {
    return f.kind === 'guppy' ? FISH.guppy.size[f.stage] : FISH[f.kind].size;
  }

  /** Coin-dropping fish drop one every 200-450 of the original's ticks. */
  function coinDelay() {
    return t(COIN_EVERY[0] + rand() * (COIN_EVERY[1] - COIN_EVERY[0]));
  }

  /** Sets how full a fish is, in steps until it starves. */
  function setFull(f, steps) {
    f.starveAt = tank.time + steps;
    f.fedUntil = f.starveAt - t(FISH[f.kind].full.hungryAt);
  }

  /** How many growth points a guppy needs for its next size. */
  function growthNeed(f) {
    const range = FISH.guppy.grow[f.stage];
    f.need = f.kind === 'guppy' && range ? range[0] + Math.floor(rand() * (range[1] - range[0] + 1)) : 0;
  }

  function feed(f, quality = 0) {
    const full = FISH[f.kind].full;
    const q = clamp(quality, 0, FOOD.quality.length - 1);
    setFull(f, Math.min(f.starveAt - tank.time + t(full.add[q]), t(full.cap[q])));
    f.eatT = 20;
    if (f.kind === 'guppy' && f.stage < 2) {
      f.growth += FOOD.quality[q].growth;
      if (f.growth >= f.need) {
        f.growth = 0;
        f.stage++;
        growthNeed(f);
        f.coinT = coinDelay();
        emit('grow', { x: f.x, y: f.y, stage: f.stage });
      }
    }
    emit('eat', { x: f.x, y: f.y, kind: f.kind });
  }

  function steer(o, tx, ty, speed, k) {
    const dx = tx - o.x;
    const dy = ty - o.y;
    const d = Math.hypot(dx, dy) || 1;
    o.vx += ((dx / d) * speed - o.vx) * k;
    o.vy += ((dy / d) * speed - o.vy) * k;
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

  function kill(f, by) {
    tank.fish = tank.fish.filter((o) => o !== f);
    tank.stats.lost++;
    emit('gulp', { x: f.x, y: f.y, by });
  }

  const isBaby = (o) => o.kind === 'guppy' && o.stage === 0 && !o.dead && !o.hidden && o.bornT > 40;

  /** A hungry fish goes after its food; true while chasing. */
  function hunt(f, base) {
    const spec = FISH[f.kind];
    const reach = sizeOf(f) * 0.6 + 8;
    const chase = (target, d, onCatch, mult = 2, k = 0.15) => {
      if (!target) return false;
      steer(f, target.x, spec.bottom ? SAND : target.y, base * mult, k);
      if (d < reach + (spec.bottom ? 16 : 0)) onCatch(target);
      return true;
    };
    const eatFood = (p) => {
      tank.food = tank.food.filter((o) => o !== p);
      feed(f, p.quality);
    };
    switch (f.kind) {
      case 'guppy':
      case 'breeder': {
        const [p, d] = nearest(tank.food, f, (o) => o.kind === 'food');
        return chase(p, d, eatFood);
      }
      case 'carnivore':
      case 'guppycruncher': {
        const ok = f.kind === 'guppycruncher' ? (o) => isBaby(o) && o.y > FLOOR - 90 : isBaby;
        const [prey, d] = nearest(tank.fish, f, ok);
        return chase(
          prey,
          f.kind === 'guppycruncher' && prey ? Math.abs(prey.x - f.x) + Math.max(0, SAND - prey.y - 40) : d,
          (p) => {
            kill(p, f.kind);
            feed(f);
            if (f.kind === 'guppycruncher') dropCoin('beetle', f.x, f.y - 10);
          },
          1.9,
        );
      }
      case 'ultravore': {
        const [prey, d] = nearest(tank.fish, f, (o) => o.kind === 'carnivore' && !o.dead && o.bornT > 40);
        return chase(prey, d, (p) => {
          kill(p, 'ultravore');
          feed(f);
        }, 1.8, 0.12);
      }
      case 'beetlemuncher': {
        const [b, d] = nearest(tank.coins, f, (o) => o.type === 'beetle');
        return chase(b, d, (beetle) => {
          tank.coins = tank.coins.filter((o) => o !== beetle);
          feed(f);
          f.owed++;
          f.coinT = 40;
        });
      }
      case 'starcatcher': {
        const [c, d] = nearest(tank.coins, f, (o) => o.type === 'star' && o.y > FLOOR - 100);
        return chase(c, c ? Math.abs(c.x - f.x) + Math.max(0, SAND - c.y - 40) : d, (star) => {
          tank.coins = tank.coins.filter((o) => o !== star);
          feed(f);
          f.owed++;
          f.coinT = 40;
        });
      }
    }
    return false;
  }

  function stepFish(f) {
    f.bornT++;
    if (f.eatT > 0) f.eatT--;
    f.turn += (f.face - f.turn) * 0.16;
    const spec = FISH[f.kind];
    if (f.dead) {
      f.deadT++;
      f.vx *= 0.9;
      f.y = Math.min(FLOOR - 10, f.y + 0.5);
      return;
    }
    // As in the original, hunger stands still while aliens (other than Minisylvesters) are in the tank.
    if (tank.aliens.some((a) => a.kind !== 'minisylvester')) {
      f.starveAt++;
      f.fedUntil++;
    }
    if (!def.immortal && tank.time >= f.starveAt) {
      f.dead = true;
      tank.stats.lost++;
      emit('starve', { x: f.x, y: f.y, kind: f.kind });
      return;
    }
    if (f.bornT < 40) {
      f.y += f.vy;
      f.vy *= 0.94;
      if (spec.bottom) f.y = Math.min(SAND, f.y + 3);
      return;
    }
    // Wadsworth keeps baby and medium guppies in his mouth while aliens are about.
    f.hidden = has('wadsworth') && tank.aliens.length > 0 && f.kind === 'guppy' && f.stage <= 1;
    const base = f.kind === 'guppy' ? spec.speed[f.stage] : spec.speed;
    let busy = false;
    if (f.kind === 'guppy' && f.stage === 2) {
      const [pot, d] = nearest(tank.food, f, (o) => o.kind === 'potion');
      if (pot) {
        busy = true;
        steer(f, pot.x, pot.y, base * 2, 0.15);
        if (d < sizeOf(f) * 0.6 + 8) {
          tank.food = tank.food.filter((o) => o !== pot);
          f.stage = 3;
          f.coinT = coinDelay();
          emit('star', { x: f.x, y: f.y });
        }
      }
    }
    // Gumbo's lantern: guppies follow him while aliens are in the tank.
    const gumbo = tank.aliens.length && tank.pets.find((p) => p.kind === 'gumbo' || p.as === 'gumbo');
    if (!busy && gumbo && f.kind === 'guppy') {
      steer(f, gumbo.x + Math.sin(f.phase) * 30, gumbo.y + Math.cos(f.phase) * 20, base * 1.8, 0.1);
      busy = true;
    }
    if (!busy && tank.isHungry(f)) busy = hunt(f, base);
    if (!busy) {
      if (!f.goal || --f.goalT <= 0 || dist(f, f.goal) < 14) {
        const low = has('rhubarb') && !spec.bottom ? BOTTOM - 70 : BOTTOM;
        f.goal = { x: LEFT + 20 + rand() * (RIGHT - LEFT - 40), y: spec.bottom ? SAND : TOP + rand() * (low - TOP) };
        f.goalT = 150 + rand() * 260;
      }
      const pace = 0.35 + 0.65 * Math.sin((tank.time + f.phase * 13) / 110) ** 2;
      steer(f, f.goal.x, f.goal.y, base * pace, 0.035);
    }
    f.x = clamp(f.x + f.vx, LEFT, RIGHT);
    f.y = spec.bottom ? SAND : clamp(f.y + f.vy, TOP, BOTTOM);
    if (Math.abs(f.vx) > 0.25) f.face = f.vx > 0 ? 1 : -1;

    // What it gives.
    if (def.immortal && tank.isHungry(f)) return;
    if (f.kind === 'breeder') {
      if (!tank.isHungry(f) && --f.breedT <= 0) {
        f.breedT = spec.breedEvery;
        if (tank.fish.length < LIMITS.fish) {
          spawnFish('guppy', f.x, f.y).bornT = 40;
          emit('birth', { x: f.x, y: f.y });
        }
      }
    } else if (f.kind === 'starcatcher' || f.kind === 'beetlemuncher') {
      if (f.owed > 0 && --f.coinT <= 0) {
        f.owed--;
        f.coinT = 40;
        dropCoin(spec.coin, f.x, f.y - 10);
      }
    } else if (f.kind !== 'guppycruncher') {
      const type = f.kind === 'guppy' ? spec.coin[f.stage] : spec.coin;
      const cheer = tank.singing > 0 && f.kind === 'guppy' ? 3 : 1;
      if (type && (f.coinT -= cheer) <= 0) {
        f.coinT = coinDelay();
        dropCoin(type, f.x, f.y + 8);
      }
    }
  }

  /* ---------- Coins and food ---------- */

  function dropCoin(type, x, y, extra = {}) {
    tank.coins.push({ id: nextId++, x, y, type, vy: type === 'beetle' ? 0.4 : 0.2, floorT: 0, spin: rand() * 10, bounce: 0, ...extra });
    emit('drop', { x, y, coin: type });
  }

  function maxFood() {
    return Math.min(FOOD.max, FOOD.start + tank.up.count);
  }

  function addFood(x, y, extra = {}) {
    tank.food.push({ id: nextId++, kind: 'food', x: clamp(x, LEFT, RIGHT), y: clamp(y, TANK.surface + 4, BOTTOM), quality: tank.up.quality, floorT: 0, ...extra });
  }

  function stepFood() {
    for (const p of tank.food) {
      if (p.y < FLOOR - 8) p.y += p.kind === 'potion' ? 0.6 : FOOD.sink;
      else p.floorT++;
      if (has('nimbus') && p.kind === 'food' && p.floorT > 15 && !p.tossed) {
        p.tossed = true;
        p.floorT = 0;
        p.y = TOP;
        emit('toss', { x: p.x, y: FLOOR - 10 });
      }
    }
    tank.food = tank.food.filter((p) => p.floorT < (p.kind === 'food' ? 50 : 900));
  }

  function collect(c, by = 'click') {
    tank.coins = tank.coins.filter((k) => k !== c);
    const v = COINS[c.type].value;
    tank.stats.coins++;
    if (c.shell) {
      // A shell coin is worth its value in Shells instead of money.
      tank.shells += v;
      emit('coin', { x: c.x, y: c.y, value: v, coin: c.type, by, shell: true });
      return;
    }
    tank.money += v;
    tank.stats.earned += v;
    emit('coin', { x: c.x, y: c.y, value: v, coin: c.type, by });
  }

  function stepCoins() {
    const slow = has('seymour') ? 0.5 : 1;
    for (const c of tank.coins) {
      if (c.type === 'bomb') {
        // Shrapnel's bombs sink and blow up any fish they touch.
        c.y = Math.min(FLOOR - 10, c.y + 0.7);
        const [f, d] = nearest(tank.fish, c, (o) => !o.dead && !o.hidden);
        if (f && d < sizeOf(f) * 0.6 + 8) {
          c.dead = true;
          kill(f, 'bomb');
          emit('boom', { x: c.x, y: c.y });
        } else if (c.y >= FLOOR - 10 && ++c.floorT > COIN.floorLife) c.dead = true;
        continue;
      }
      if (c.type === 'beetle') {
        // Beetles scuttle along the sand.
        if (c.y < FLOOR - 8) c.y += 1.2;
        else {
          c.x = clamp(c.x + Math.sin((tank.time + c.id * 30) / 40) * 0.6, LEFT, RIGHT);
          c.floorT++;
        }
        continue;
      }
      if (c.y < FLOOR - 10) {
        const fall = (c.type === 'chest' ? 1.4 : c.type === 'star' ? 0.5 : COIN.sink) * slow;
        c.vy = Math.min(fall, c.vy + 0.03);
        c.y = Math.min(FLOOR - 10, c.y + c.vy);
        if (c.y >= FLOOR - 10) emit('land', { x: c.x, y: c.y, coin: c.type });
      } else {
        c.floorT++;
        if (has('nimbus') && c.type !== 'chest' && !c.tossed && c.floorT > 20) {
          c.tossed = true;
          c.floorT = 0;
          c.vy = -6;
          c.y = FLOOR - 12;
          emit('toss', { x: c.x, y: FLOOR - 10 });
        }
      }
      if (c.vy < 0) {
        c.y += c.vy;
        c.vy += 0.15;
      }
    }
    tank.coins = tank.coins.filter((c) => !c.dead && (c.type === 'chest' || c.floorT <= (c.type === 'beetle' ? COIN.floorLife * 2 : COIN.floorLife)));
  }

  /* ---------- Pets ---------- */

  pets.forEach((kind, i) => {
    const p = { kind, as: null, x: 120 + i * 180, y: FLOOR - 6, face: 1, t: 0, timer: 0, state: 0, vx: 0, vy: 0, target: null };
    if (['itchy', 'prego', 'zorf', 'clyde', 'vert', 'meryl', 'wadsworth', 'shrapnel', 'gumbo', 'blip', 'nimbus', 'amp', 'gash', 'angie', 'presto', 'brinkley', 'nostradamus', 'stanley', 'walter'].includes(kind)) p.y = TOP + 40 + i * 50;
    p.timer = { niko: 1800, prego: 1500, zorf: 600, vert: 540, meryl: 1800, shrapnel: 900, amp: 3600, angie: 600, presto: 1200, nostradamus: BONUS.nostradamus.every[0], stanley: BONUS.stanley.every }[kind] ?? 0;
    p.rest = 0;
    p.eaten = 0;
    p.punch = 0;
    tank.pets.push(p);
  });

  function drift(p, sx, sy, speed = 0.02) {
    const tx = 320 + Math.sin(p.t / sx + p.x * 0.001) * 250;
    const ty = TOP + 60 + Math.sin(p.t / sy) * 70;
    p.x += (tx - p.x) * speed;
    p.y += (ty - p.y) * speed;
    if (Math.abs(tx - p.x) > 2) p.face = tx >= p.x ? 1 : -1;
  }

  function hurt(a, amount, by) {
    damage(a, amount, by);
  }

  /** Stanley throws a ball at an alien or an alien's missile. */
  function throwBall(p, target) {
    tank.balls.push({ id: nextId++, x: p.x, y: p.y - 10, vx: p.face * 2, vy: -2, t: 0, kind: Math.floor(rand() * 4), ...target });
    emit('throw', { x: p.x, y: p.y });
  }

  function stepBalls() {
    const S = BONUS.stanley;
    for (const b of tank.balls) {
      b.t++;
      const target = b.alien ? tank.aliens.find((a) => a.id === b.alien) : tank.missiles.find((m) => m.id === b.missile && !m.dead);
      if (!target) {
        b.vy += 0.15;
        b.dead = b.t > 120;
      } else {
        const aim = b.alien ? weakSpot(target, b) : target;
        steer(b, aim.x, aim.y, S.ballSpeed, 0.2);
        if (Math.hypot(aim.x - b.x, aim.y - b.y) < (b.alien ? 30 : 16)) {
          b.dead = true;
          if (b.alien) damage(target, S.ballDamage, 'pet', aim.head);
          else {
            target.dead = true;
            emit('pop', { x: target.x, y: target.y });
          }
          emit('bonk', { x: b.x, y: b.y });
        }
      }
      b.x += b.vx;
      b.y += b.vy;
      if (b.t > 400 || b.y > FLOOR) b.dead = true;
    }
    tank.balls = tank.balls.filter((b) => !b.dead);
    tank.missiles = tank.missiles.filter((m) => !m.dead);
  }

  function stepPet(p) {
    p.t++;
    if (p.timer > 0) p.timer--;
    const kind = p.as ?? p.kind;
    switch (kind) {
      case 'stinky':
      case 'rufus':
      case 'rhubarb': {
        // Crawl along the sand; Stinky goes for coins, the crabs go for aliens near the bottom.
        let tx = null;
        if (kind === 'stinky') {
          const [c] = nearest(tank.coins, p, (o) => o.y > FLOOR - 70 && o.type !== 'bomb');
          if (c) tx = c.x;
          if (c && Math.abs(c.x - p.x) < 16 && c.y > FLOOR - 40) collect(c, 'pet');
        } else {
          const [a] = nearest(tank.aliens, p);
          if (a) {
            tx = a.x;
            if (Math.abs(a.x - p.x) < 50 && a.y > FLOOR - 160 && p.timer === 0) {
              p.timer = 30;
              p.state = 15;
              hurt(a, kind === 'rufus' ? 4 : 1.5, 'pet');
              emit('pinch', { x: p.x, y: p.y - 20 });
            }
          }
          if (kind === 'rhubarb' && !a) {
            for (const f of tank.fish) if (!f.dead && !FISH[f.kind].bottom && f.y > BOTTOM - 40 && Math.abs(f.x - p.x) < 40) f.vy -= 0.4;
          }
        }
        if (p.state > 0) p.state--;
        if (tx === null) tx = 320 + Math.sin(p.t / 300) * 260;
        const dx = tx - p.x;
        p.walking = Math.abs(dx) > 2;
        p.x = clamp(p.x + clamp(dx, -1.2, 1.2), LEFT, RIGHT);
        if (Math.abs(dx) > 2) p.face = dx > 0 ? 1 : -1;
        p.y = FLOOR - 6;
        break;
      }
      case 'niko':
        // Opens now and then with a pearl inside; click him to take it.
        if (p.timer === 0 && !p.pearl) {
          p.pearl = true;
          emit('nikoOpen', { x: p.x, y: p.y });
        }
        p.y = FLOOR - 6;
        break;
      case 'itchy':
      case 'gash': {
        const [a] = nearest(tank.aliens, p, (o) => !ALIENS[o.kind].boss || true);
        if (a) {
          steer(p, a.x, a.y, kind === 'gash' ? 3.2 : 3.6, 0.1);
          p.x += p.vx;
          p.y += p.vy;
          p.face = p.vx >= 0 ? 1 : -1;
          p.state = 1;
          if (dist(p, a) < ALIENS[a.kind].r && p.timer === 0) {
            p.timer = 25;
            hurt(a, kind === 'gash' ? 2.5 : 1.5, 'pet');
            emit('stab', { x: (p.x + a.x) / 2, y: (p.y + a.y) / 2 });
          }
        } else {
          p.state = 0;
          drift(p, 240, 140);
          if (kind === 'gash' && p.timer === 0) {
            p.timer = 3600;
            const [g] = nearest(tank.fish, p, (o) => o.kind === 'guppy' && !o.dead && !o.hidden);
            if (g && rand() < 0.5) kill(g, 'gash');
          }
        }
        break;
      }
      case 'prego':
        drift(p, 320, 180);
        if (p.timer === 0) {
          p.timer = 1500;
          if (tank.fish.length < LIMITS.fish) {
            spawnFish('guppy', p.x, p.y).bornT = 40;
            emit('birth', { x: p.x, y: p.y });
          }
        }
        break;
      case 'zorf':
        drift(p, 280, 160);
        if (p.timer === 0) {
          p.timer = 480;
          const hungry = tank.fish.filter((f) => !f.dead && (f.kind === 'guppy' || f.kind === 'breeder') && tank.isHungry(f));
          if (hungry.length) {
            addFood(p.x, p.y, { free: true, quality: Math.min(1, tank.up.quality) });
            p.state = 20;
            emit('spit', { x: p.x, y: p.y });
          }
        }
        if (p.state > 0) p.state--;
        break;
      case 'clyde':
        drift(p, 500, 260, 0.008);
        for (const c of tank.coins) if (c.type !== 'bomb' && dist(c, p) < 34) collect(c, 'pet');
        break;
      case 'vert':
        drift(p, 300, 170);
        if (p.timer === 0) {
          p.timer = 540;
          dropCoin('gold', p.x, p.y + 10);
        }
        break;
      case 'meryl':
        drift(p, 340, 190);
        if (tank.singing > 0) tank.singing--;
        if (p.timer === 0) {
          p.timer = 1800;
          tank.singing = 600;
          emit('sing', { x: p.x, y: p.y });
        }
        break;
      case 'wadsworth':
        drift(p, 400, 220, 0.012);
        p.state = tank.aliens.length ? 1 : 0;
        break;
      case 'seymour':
        p.x = clamp(p.x + Math.sin(p.t / 400) * 0.35, LEFT, RIGHT);
        p.y = TOP + 160 + Math.sin(p.t / 250) * 60;
        p.face = Math.cos(p.t / 400) >= 0 ? 1 : -1;
        break;
      case 'shrapnel':
        drift(p, 260, 150);
        if (p.timer === 0) {
          p.timer = 900;
          dropCoin('bomb', p.x, p.y + 10);
        }
        break;
      case 'gumbo': {
        const [a] = nearest(tank.aliens, p);
        if (a) {
          // Swim away from the alien, lantern lit.
          const tx = a.x < 320 ? RIGHT - 60 : LEFT + 60;
          steer(p, tx, a.y < 250 ? BOTTOM - 40 : TOP + 40, 1.6, 0.05);
          p.x += p.vx;
          p.y += p.vy;
          p.face = p.vx >= 0 ? 1 : -1;
        } else drift(p, 300, 170);
        break;
      }
      case 'blip':
        drift(p, 260, 140);
        break;
      case 'nimbus':
        drift(p, 260, 120);
        p.y = Math.max(p.y, BOTTOM - 40);
        break;
      case 'amp':
        drift(p, 260, 150);
        p.charged = p.timer === 0;
        break;
      case 'angie':
        drift(p, 280, 160);
        if (p.timer === 0) {
          const dead = tank.fish.find((f) => f.dead);
          if (dead) {
            p.timer = 3600;
            dead.dead = false;
            dead.deadT = 0;
            setFull(dead, t(FISH[dead.kind].full.start[1]));
            emit('revive', { x: dead.x, y: dead.y });
          } else p.timer = 30;
        }
        break;
      case 'brinkley': {
        // Swims after food (while no aliens are about) and eats it; some of it comes back as treasure.
        const B = BONUS.brinkley;
        if (p.rest > 0) p.rest--;
        const [pellet, d] = tank.aliens.length ? [null, Infinity] : nearest(tank.food, p, (o) => o.kind === 'food');
        if (pellet && p.rest === 0) {
          steer(p, pellet.x, pellet.y - 10, 2.2, 0.08);
          p.x += p.vx;
          p.y += p.vy;
          if (Math.abs(p.vx) > 0.2) p.face = p.vx > 0 ? 1 : -1;
          if (d < 26) {
            tank.food = tank.food.filter((o) => o !== pellet);
            p.rest = B.rest;
            p.eaten++;
            p.state = 20;
            emit('slurp', { x: p.x, y: p.y });
            if (p.eaten % B.every === 0) dropCoin(B.prizes.find(([n]) => p.eaten % n === 0)[1], p.x + 5, p.y - 10, { shell: true });
          }
        } else drift(p, 300, 170);
        if (p.state > 0) p.state--;
        break;
      }
      case 'nostradamus':
        drift(p, 280, 150);
        if (p.timer === 0) {
          const [lo, hi] = BONUS.nostradamus.every;
          p.timer = Math.round(lo + rand() * (hi - lo));
          addFood(p.x + 15, p.y + 10, { free: true, quality: 0 });
          emit('sneeze', { x: p.x, y: p.y });
        }
        break;
      case 'stanley': {
        // Turns fierce while aliens are about: knocks their missiles out of the water and pelts them with balls.
        const S = BONUS.stanley;
        drift(p, 260, 150);
        p.state = clamp(p.state + (tank.aliens.length ? 1 : -1), 0, 10);
        if (p.rest > 0) p.rest--;
        const taken = new Set(tank.balls.map((b) => b.missile));
        const [m] = nearest(tank.missiles, p, (o) => !o.deflected && !taken.has(o.id));
        if (m && p.rest === 0) {
          throwBall(p, { missile: m.id });
          p.rest = S.rest[Math.floor(rand() * S.rest.length)];
        }
        if (p.timer === 0) {
          p.timer = S.every;
          const [a] = nearest(tank.aliens, p);
          if (a) throwBall(p, { alien: a.id });
        }
        break;
      }
      case 'walter':
        drift(p, 300, 160);
        if (p.rest > 0) p.rest--;
        if (p.punch > 0) {
          p.punch--;
          // The glove is out from about a third of the way through the punch.
          const out = BONUS.walter.punch - p.punch;
          if (out > BONUS.walter.punch / 3 && !p.landed) {
            const gx = p.x + p.face * 70;
            const hit = (o) => Math.hypot(o.x - gx, o.y - p.y) < BONUS.walter.reach;
            for (const f of tank.fish) {
              if (f.dead || f.hidden || !hit(f)) continue;
              f.vx += p.face * 4;
              f.coinT = Math.min(f.coinT, t(5));
              if (f.kind === 'breeder') f.breedT = 1;
              p.landed = true;
            }
            for (const q of tank.pets) {
              if (q === p || (q.as ?? q.kind) === 'prego' || !hit(q)) continue;
              q.x += p.face * 20;
              if (q.timer > 0) q.timer = Math.min(q.timer, t(5));
              p.landed = true;
            }
            if (p.landed) emit('punch', { x: gx, y: p.y });
          }
          if (p.punch === 0) p.rest = BONUS.walter.rest;
        }
        break;
      case 'presto':
        drift(p, 260, 150);
        if (p.timer === 0) {
          // Turns into one of the other pets for a while.
          p.timer = 1800;
          const others = tank.pets.filter((q) => q !== p).map((q) => q.kind);
          const pool = others.length ? others : ['stinky', 'zorf', 'itchy'];
          p.as = p.as ? null : pool[Math.floor(rand() * pool.length)];
          emit('morph', { x: p.x, y: p.y });
        }
        break;
    }
    p.x = clamp(p.x, LEFT, RIGHT);
    p.y = clamp(p.y, TOP - 10, FLOOR);
  }

  /* ---------- Aliens ---------- */

  const pick = (list) => list[Math.floor(rand() * list.length)];

  function spawnAliens() {
    for (const kind of tank.incoming) spawnAlien(kind);
    emit('alien', { kind: tank.aliens[0]?.kind });
  }

  function spawnAlien(kind, at = null) {
    const spec = ALIENS[kind];
    const hp = Math.round(spec.hp * (challenge ? CHALLENGE.hp(tank.wave) : 1));
    const side = rand() < 0.5 ? -1 : 1;
    const a = {
      id: nextId++,
      kind,
      x: at?.x ?? 320 + side * 150,
      y: at?.y ?? (spec.floor ? FLOOR - 40 : TOP + 80 + rand() * 120),
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      face: -side,
      biteT: 60,
      hitT: 0,
      chomp: 0,
      t: 0,
      fireT: spec.missileEvery ?? 0,
      shield: false,
      spawnT: 0,
    };
    if (spec.heads) {
      // Bilaterus: a head at each end of a chain of bones.
      a.heads = [{ hp }, { hp }];
      a.hp = a.maxHp = hp * 2;
      a.lead = 0;
      a.flipT = 0;
      a.body = Array.from({ length: spec.bones + 2 }, (_, i) => ({ x: a.x - a.face * i * SEGMENT, y: a.y }));
    }
    tank.aliens.push(a);
    emit('portal', { x: a.x, y: a.y });
    return a;
  }

  const SEGMENT = 22;

  /** Where an alien can be hit: its live heads for Bilaterus, its middle for the rest. */
  function hitSpots(a) {
    const r = ALIENS[a.kind].r;
    if (!a.heads) return [{ x: a.x, y: a.y, r }];
    const ends = [a.body[0], a.body[a.body.length - 1]];
    return ends.map((e, head) => ({ x: e.x, y: e.y, r, head })).filter((h) => a.heads[h.head].hp > 0);
  }

  /** The nearest place on an alien to aim at. */
  function weakSpot(a, from) {
    return hitSpots(a).sort((p, q) => Math.hypot(p.x - from.x, p.y - from.y) - Math.hypot(q.x - from.x, q.y - from.y))[0] ?? { x: a.x, y: a.y };
  }

  function stepBilaterus(a, spec) {
    const order = a.lead === 0 ? a.body : a.body.slice().reverse();
    const head = order[0];
    const [prey, d] = nearest(tank.fish, head, (f) => !f.dead && !f.hidden);
    const tx = prey ? prey.x : 320 + Math.sin(a.t / 90) * 220;
    const ty = prey ? prey.y : TOP + 120 + Math.cos(a.t / 70) * 80;
    const dx = tx - head.x;
    const dy = ty - head.y;
    const dd = Math.hypot(dx, dy) || 1;
    const speed = spec.speed * (a.hitT > 0 ? 0.35 : 1);
    head.x = clamp(head.x + (dx / dd) * speed, LEFT + 20, RIGHT - 20);
    head.y = clamp(head.y + (dy / dd) * speed, TOP, BOTTOM);
    if (Math.abs(dx) > 3) a.face = dx > 0 ? 1 : -1;
    // The rest of the body follows the leading head.
    for (let i = 1; i < order.length; i++) {
      const o = order[i];
      const p = order[i - 1];
      const l = Math.hypot(o.x - p.x, o.y - p.y);
      if (l > SEGMENT) {
        o.x = p.x + ((o.x - p.x) / l) * SEGMENT;
        o.y = p.y + ((o.y - p.y) / l) * SEGMENT;
      }
    }
    a.x = head.x;
    a.y = head.y;
    // Now and then (or when cornered) the other head takes over and he swims the other way.
    const other = a.heads[1 - a.lead].hp > 0;
    if (other && ++a.flipT > 120 && (head.x < LEFT + 40 || head.x > RIGHT - 40 || a.flipT > 600)) {
      a.lead = 1 - a.lead;
      a.flipT = 0;
    }
    if (prey && d < spec.r && a.biteT === 0) {
      kill(prey, 'alien');
      a.biteT = spec.bite;
      a.chomp = 20;
    }
  }

  function stepAliens() {
    if (!tank.aliens.length && (def.aliens || challenge)) {
      if (tank.warning > 0) {
        if (--tank.warning === 0) spawnAliens();
      } else if (tank.time >= tank.nextAlien) {
        // The clock for the next attack only runs once these are all beaten.
        tank.warning = ALIENS.warning;
        tank.nextAlien = Infinity;
        // Like the original, each attack is one of the level's alien codes, at random.
        tank.incoming = challenge ? Array.from({ length: CHALLENGE.count(tank.wave) }, () => pick(CHALLENGE.kinds(tank.wave))) : ALIEN_CODES[pick(def.aliens.codes)];
        emit('warning');
      }
    }
    for (const a of tank.aliens) {
      const spec = ALIENS[a.kind];
      a.t++;
      if (a.hitT > 0) a.hitT--;
      if (a.chomp > 0) a.chomp--;
      if (a.biteT > 0) a.biteT--;
      if (spec.shield) {
        const [off, on] = spec.shield;
        const was = a.shield;
        a.shield = a.t % (off + on) >= off;
        if (a.shield && !was) emit('shield', { x: a.x, y: a.y });
      }
      // Knock-back from shots.
      a.x += a.vx;
      a.y += a.vy;
      a.vx *= 0.88;
      a.vy *= 0.88;
      if (spec.heads) {
        stepBilaterus(a, spec);
        continue;
      }
      if (spec.boss) {
        // Cyrax floats about and calls in Minisylvesters.
        a.x = 320 + Math.sin(a.t / 180) * 200;
        a.y = TOP + 70 + Math.sin(a.t / 110) * 40;
        a.face = Math.cos(a.t / 180) >= 0 ? 1 : -1;
        if (++a.spawnT > 600 && tank.aliens.length < 4) {
          a.spawnT = 0;
          spawnAlien('minisylvester', { x: a.x, y: a.y + 40 });
          emit('laugh', { x: a.x, y: a.y });
        }
        continue;
      }
      if (spec.missileEvery) {
        // Destructor rolls along the bottom; Ulysses floats. Both fire missiles at fish.
        const [prey] = nearest(tank.fish, a, (f) => !f.dead && !f.hidden);
        const tx = prey ? prey.x : 320;
        if (spec.floor) {
          a.x = clamp(a.x + clamp(tx - a.x, -spec.speed, spec.speed), LEFT + 30, RIGHT - 30);
          a.y = FLOOR - 40;
        } else {
          a.x = clamp(a.x + clamp(tx - a.x, -spec.speed, spec.speed), LEFT + 30, RIGHT - 30);
          a.y = clamp(a.y + Math.sin(a.t / 60) * 0.5, TOP + 20, BOTTOM - 40);
        }
        if (Math.abs(tx - a.x) > 3) a.face = tx > a.x ? 1 : -1;
        if (--a.fireT <= 0 && prey) {
          a.fireT = spec.missileEvery;
          tank.missiles.push({ id: nextId++, x: a.x, y: a.y - (spec.floor ? 40 : 0), vx: 0, vy: -1.5, target: prey.id, owner: a.id, t: 0, deflected: false });
          a.chomp = 20;
          emit('missile', { x: a.x, y: a.y });
        }
        continue;
      }
      let tx;
      let ty;
      if (spec.eatsFood) {
        const [food, fd] = nearest(tank.food, a, (o) => o.kind === 'food');
        if (food) {
          tx = food.x;
          ty = food.y;
          if (fd < spec.r * 0.7) {
            tank.food = tank.food.filter((o) => o !== food);
            a.chomp = 16;
            emit('gorge', { x: a.x, y: a.y });
            damage(a, spec.foodDamage[food.quality] ?? spec.foodDamage[0], 'food');
            if (!tank.aliens.includes(a)) continue;
          }
        }
      }
      let prey = null;
      let d = Infinity;
      if (tx === undefined) {
        [prey, d] = nearest(tank.fish, a, (f) => !f.dead && !f.hidden);
        tx = prey ? prey.x : 320 + Math.sin(a.t / 90) * 200;
        ty = prey ? prey.y : TOP + 100 + Math.cos(a.t / 70) * 60;
      }
      const dx = tx - a.x;
      const dy = ty - a.y;
      const dd = Math.hypot(dx, dy) || 1;
      const speed = spec.speed * (a.hitT > 0 ? 0.35 : 1);
      a.x = clamp(a.x + (dx / dd) * speed, LEFT + 20, RIGHT - 20);
      a.y = clamp(a.y + (dy / dd) * speed, TOP, BOTTOM);
      if (Math.abs(dx) > 3) a.face = dx > 0 ? 1 : -1;
      if (!prey) [prey, d] = nearest(tank.fish, a, (f) => !f.dead && !f.hidden);
      if (prey && d < spec.r * 0.7 && a.biteT === 0 && spec.bite) {
        kill(prey, 'alien');
        a.biteT = spec.bite;
        a.chomp = 20;
      }
    }
    // Missiles home in on their fish; deflected ones fly back at their alien.
    for (const m of tank.missiles) {
      m.t++;
      const target = m.deflected ? tank.aliens.find((a) => a.id === m.owner) : tank.fish.find((f) => f.id === m.target && !f.dead && !f.hidden);
      if (target) steer(m, target.x, target.y, m.deflected ? 5 : 2.2, m.deflected ? 0.2 : 0.06);
      m.x += m.vx;
      m.y += m.vy;
      if (target && dist(m, target) < (m.deflected ? 40 : sizeOf(target) * 0.6 + 8)) {
        m.dead = true;
        emit('boom', { x: m.x, y: m.y });
        if (m.deflected) damage(target, 8, 'missile');
        else kill(target, 'missile');
      } else if (m.t > 600 || m.y < TANK.surface || m.x < 0 || m.x > 640) m.dead = true;
    }
    tank.missiles = tank.missiles.filter((m) => !m.dead);
  }

  function damage(a, amount, by = 'click', head = null) {
    const spec = ALIENS[a.kind];
    if (a.shield && by === 'click') {
      a.hp = Math.min(a.maxHp, a.hp + amount);
      emit('heal', { x: a.x, y: a.y });
      return;
    }
    if (a.heads) {
      // Only a head can be hurt: the one hit, or else the leading one.
      const i = head ?? (a.heads[a.lead].hp > 0 ? a.lead : 1 - a.lead);
      const h = a.heads[i];
      if (h.hp <= 0) return;
      h.hp = Math.max(0, h.hp - amount);
      if (h.hp === 0) {
        const end = i === 0 ? a.body[0] : a.body[a.body.length - 1];
        emit('boom', { x: end.x, y: end.y });
        if (i === a.lead) a.lead = 1 - i;
      }
      a.hp = a.heads[0].hp + a.heads[1].hp;
    } else a.hp -= amount;
    a.hitT = 8;
    if (a.hp <= 0) {
      tank.aliens = tank.aliens.filter((o) => o !== a);
      tank.stats.aliens++;
      if (!spec.boss) dropCoin(a.kind === 'minisylvester' ? 'diamond' : 'chest', a.x, Math.min(a.y, FLOOR - 30));
      emit('defeat', { x: a.x, y: a.y, kind: a.kind });
      if (spec.boss) {
        tank.outcome = 'clear';
        emit('clear', { boss: true });
      }
      if (!tank.aliens.length) {
        tank.missiles = [];
        tank.balls = [];
        tank.nextAlien = tank.time + (challenge ? CHALLENGE.every(tank.wave + 1) : def.aliens ? def.aliens.every : Infinity) - ALIENS.warning;
        if (challenge) {
          tank.wave++;
          emit('wave', { wave: tank.wave });
        }
      }
    }
  }

  /* ---------- The player ---------- */

  /**
   * A click in the tank. Returns 'coin' | 'pearl' | 'punch' | 'missile' | 'hit' | 'heal'
   * | 'amp' | 'feed' | 'full' | 'broke' | 'miss' | 'none'.
   */
  function click(x, y) {
    if (tank.outcome || y < TANK.surface - 10) return 'none';
    // Coins first.
    const [c, cd] = nearest(tank.coins, { x, y });
    if (c && cd < COIN.grab + (c.type === 'chest' ? 10 : 0)) {
      collect(c);
      return 'coin';
    }
    // Pets you can click.
    for (const p of tank.pets) {
      if (dist(p, { x, y }) > 34) continue;
      if ((p.as ?? p.kind) === 'niko' && p.pearl) {
        p.pearl = false;
        p.timer = 1800;
        tank.money += COINS.nikoPearl.value;
        tank.stats.earned += COINS.nikoPearl.value;
        emit('coin', { x: p.x, y: p.y - 20, value: COINS.nikoPearl.value, coin: 'pearl', by: 'click' });
        return 'pearl';
      }
      if ((p.as ?? p.kind) === 'walter' && !p.punch && !p.rest) {
        p.punch = BONUS.walter.punch;
        p.landed = false;
        emit('swing', { x: p.x, y: p.y });
        return 'punch';
      }
      if ((p.as ?? p.kind) === 'amp' && p.charged) {
        // Every fish in the tank becomes a diamond.
        p.timer = 3600;
        p.charged = false;
        for (const f of tank.fish.slice()) {
          if (f.dead) continue;
          kill(f, 'amp');
          dropCoin('diamond', f.x, f.y);
        }
        emit('amp', { x: p.x, y: p.y });
        return 'amp';
      }
    }
    // Missiles: Ulysses' are deflected back at him, Destructor's are destroyed.
    const [m, md] = nearest(tank.missiles, { x, y }, (o) => !o.deflected);
    if (m && md < 26) {
      const owner = tank.aliens.find((a) => a.id === m.owner);
      if (owner && ALIENS[owner.kind].deflect) {
        m.deflected = true;
        emit('deflect', { x: m.x, y: m.y });
      } else {
        m.dead = true;
        tank.missiles = tank.missiles.filter((o) => o !== m);
        emit('pop', { x: m.x, y: m.y });
      }
      return 'missile';
    }
    // Aliens: each shot hurts and knocks the alien away from the click.
    if (tank.aliens.length) {
      let target = null;
      let part = null;
      let bd = Infinity;
      for (const a of tank.aliens) {
        for (const h of hitSpots(a)) {
          const d = Math.hypot(h.x - x, h.y - y);
          if (d < h.r + 14 && d < bd) {
            bd = d;
            target = a;
            part = h.head ?? null;
          }
        }
      }
      if (target && ALIENS[target.kind].eatsFood) target = null; // Gus only takes food
      if (target) {
        const shield = target.shield;
        damage(target, WEAPON.damage(tank.up.weapon + 1), 'click', part);
        if (!shield && !ALIENS[target.kind].floor && !ALIENS[target.kind].boss && !target.heads) {
          const d = bd || 1;
          target.vx += ((target.x - x) / d) * 2.2;
          target.vy += ((target.y - y) / d) * 2.2;
        }
        emit(shield ? 'healshot' : 'shot', { x, y, level: tank.up.weapon });
        return shield ? 'heal' : 'hit';
      }
      // (In the final battle, a click that misses still feeds your fish.)
      if (!def.boss && tank.aliens.some((a) => !ALIENS[a.kind].eatsFood)) {
        emit('shot', { x, y, level: tank.up.weapon, miss: true });
        return 'miss';
      }
    }
    // Otherwise: food.
    if (tank.food.filter((p) => p.kind === 'food' && !p.free).length >= maxFood()) {
      emit('full', { x, y });
      return 'full';
    }
    if (tank.money < FOOD.cost) {
      emit('broke', { x, y });
      return 'broke';
    }
    tank.money -= FOOD.cost;
    addFood(x, Math.max(y, TANK.surface + 4));
    emit('food', { x, y });
    return 'feed';
  }

  const live = () => tank.fish.filter((f) => !f.dead).length;
  const inflation = () => (challenge ? CHALLENGE.inflation(tank.wave) : 1);
  const price = (v) => Math.round((v * inflation()) / 5) * 5;

  function shop() {
    return def.shop.map((id) => {
      let cost = null;
      let level = null;
      if (FISH[id]) cost = price(FISH[id].cost);
      else if (id === 'potion') cost = tank.food.some((p) => p.kind === 'potion') ? null : price(POTION.cost);
      else if (id === 'quality') {
        level = tank.up.quality;
        cost = level + 1 < FOOD.quality.length ? price(FOOD.qualityCost[level + 1]) : null;
      } else if (id === 'count') {
        level = maxFood();
        cost = level < FOOD.max ? price(FOOD.countCost) : null;
      } else if (id === 'weapon') {
        level = tank.up.weapon;
        cost = level + 1 < WEAPON.max ? price(def.weaponCost) : null;
      } else if (id === 'egg') {
        level = tank.eggs;
        cost = def.egg;
      }
      const full = FISH[id] && live() >= LIMITS.fish;
      return { id, cost, level, maxed: cost === null, affordable: cost !== null && !full && tank.money >= cost };
    });
  }

  function buy(id) {
    if (tank.outcome) return false;
    const item = shop().find((i) => i.id === id);
    if (!item || !item.affordable) {
      emit('cantBuy', { id });
      return false;
    }
    tank.money -= item.cost;
    let fish = null;
    if (FISH[id]) fish = spawnFish(id);
    else if (id === 'potion') tank.food.push({ id: nextId++, kind: 'potion', x: 120 + rand() * 400, y: TANK.surface + 6, quality: 0, floorT: 0 });
    else if (id === 'quality') tank.up.quality++;
    else if (id === 'count') tank.up.count++;
    else if (id === 'weapon') tank.up.weapon++;
    else if (id === 'egg') {
      tank.eggs++;
      if (tank.eggs >= 3) {
        tank.outcome = 'clear';
        emit('clear', {});
      }
    }
    emit('buy', { id, x: fish?.x });
    return true;
  }

  /* ---------- Step ---------- */

  function step() {
    events.length = 0;
    if (tank.outcome) return;
    tank.time++;
    for (const f of tank.fish) stepFish(f);
    tank.fish = tank.fish.filter((f) => !f.dead || f.deadT < 240);
    stepFood();
    stepCoins();
    for (const p of tank.pets) stepPet(p);
    stepBalls();
    stepAliens();
    if (tank.timeLeft !== null && --tank.timeLeft <= 0) {
      tank.outcome = 'time';
      emit('timeUp');
      return;
    }
    if (!def.immortal && !tank.fish.some((f) => !f.dead) && !tank.coins.some((c) => c.type !== 'bomb') && tank.money < FISH.guppy.cost) {
      tank.outcome = 'lost';
      emit('lost');
    }
  }

  return tank;
}
