/**
 * Barrel Tower game logic. Pure: no DOM, no timers, so it runs the same in the
 * browser and in the headless checks (tools/verify.mjs).
 *
 *   const world = createWorld({ stage: 'ramps', round: 1, seed: 7 });
 *   world.step({ left, right, up, down, jump });   // 60 steps per second
 *   world.outcome  // null | 'clear' | 'dead'
 *
 * Positions are feet: (x, y) is the bottom centre of the hero, a barrel or a spark.
 */
import { STAGES, FIELD, segY, difficulty } from './stages.js';

export const PHYS = {
  walk: 0.9,
  climb: 0.7,
  jumpVy: -2.05,
  gravity: 0.115,
  maxFall: 3.6,
  safeFall: 22, // a drop deeper than this, from where the jump or fall began, is fatal
  hammerSteps: 600,
  bonusTick: 120, // the bonus drops by 100 this often
};

export const SCORE = { jump: 100, smash: 300, smashSpark: 500, rivet: 100, hammer: 0 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const within = (x, s, pad = 0) => x >= Math.min(s.x1, s.x2) - pad && x <= Math.max(s.x1, s.x2) + pad;

/**
 * @param {object} options
 * @param {boolean} [options.hazards=true]  false: no barrels, sparks or springs (for route checks)
 * @param {boolean} [options.immortal=false]  hazards never kill the hero (for random-play checks)
 */
export function createWorld({ stage = 'ramps', round = 1, seed = 1, hazards = true, immortal = false } = {}) {
  const def = STAGES[stage]();
  const diff = difficulty(round);
  const rand = mulberry32(seed);
  const events = [];
  const emit = (type, data = {}) => events.push({ type, ...data });

  /* ---------- Surfaces ---------- */

  // Static girders. On the rivet stage they are rebuilt whenever a rivet pops.
  let girders = def.girders ? def.girders.map((g, i) => ({ ...g, id: i })) : [];
  function rebuildFloors() {
    girders = [];
    def.floors.forEach((f, i) => {
      const cuts = def.rivets.filter((r) => r.floor === i && r.popped).map((r) => r.x).sort((a, b) => a - b);
      let x = f.x1;
      for (const c of cuts) {
        girders.push({ x1: x, y1: f.y1, x2: c - 4, y2: f.y1, id: girders.length, floor: i });
        x = c + 4;
      }
      girders.push({ x1: x, y1: f.y1, x2: f.x2, y2: f.y1, id: girders.length, floor: i });
    });
  }
  if (def.floors) rebuildFloors();

  // Lift platforms: { shaft, y, x1, x2, dy, lift: true }.
  const lifts = [];
  for (const sh of def.shafts ?? []) {
    let n = 0;
    for (let y = sh.top; y <= sh.bottom; y += sh.gap, n++) lifts.push({ shaft: sh, x1: sh.x - 12, x2: sh.x + 12, y, dy: 0, lift: true });
    sh.cycle = n * sh.gap; // a platform leaving one end comes back at the other
  }
  const liftSurface = (l) => ({ x1: l.x1, x2: l.x2, y1: l.y, y2: l.y, ref: l });

  function surfaces() {
    const out = girders;
    if (!lifts.length) return out;
    return out.concat(lifts.map(liftSurface));
  }

  /** The surface under (x, y) within `tol` px, preferring the closest. */
  function groundAt(x, y, tol = 3) {
    let best = null;
    let bestD = tol + 1e-6;
    for (const s of surfaces()) {
      if (!within(x, s)) continue;
      const d = Math.abs(segY(s, x) - y);
      if (d <= bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  /** First surface crossed when moving from y0 down to y1 at x. */
  function landing(x, y0, y1) {
    let best = null;
    let bestY = Infinity;
    for (const s of surfaces()) {
      if (!within(x, s)) continue;
      const sy = segY(s, x);
      if (sy >= y0 - 0.5 && sy <= y1 + 0.5 && sy < bestY) {
        best = s;
        bestY = sy;
      }
    }
    return best;
  }

  const ladders = def.ladders;
  const ladderAt = (x, y, end, tol = 4) =>
    ladders.find((l) => !l.broken && Math.abs(l.x - x) <= tol && Math.abs(l[end] - y) <= 3);

  /* ---------- Hero ---------- */

  const startSeg = girders[def.start.seg];
  const hero = {
    x: def.start.x,
    y: segY(startSeg, def.start.x),
    vx: 0,
    vy: 0,
    face: 1,
    mode: 'walk', // walk | climb | air | dead | won
    ground: startSeg,
    ladder: null,
    airFrom: 0,
    jumping: false,
    hammer: 0,
    walkT: 0,
    climbT: 0,
    deadT: 0,
    jumped: new Set(),
  };

  /* ---------- World state ---------- */

  const world = {
    stage,
    round,
    def,
    diff,
    hero,
    barrels: [],
    sparks: [],
    springs: [],
    hammers: (def.hammers ?? []).map((h) => ({ ...h, taken: false })),
    lifts,
    get girders() {
      return girders;
    },
    ladders,
    boss: { x: def.boss.x, y: def.boss.y, anim: 'idle', t: 0, fallY: 0 },
    bonus: diff.bonus,
    score: 0,
    time: 0,
    outcome: null,
    endT: 0,
    events,
    hazards,
    step,
  };

  let throwIn = hazards ? 90 : Infinity;
  let springIn = hazards ? 60 : Infinity;
  let ventIn = 240;

  /* ---------- Hero movement ---------- */

  function die(cause) {
    if (hero.mode === 'dead' || hero.mode === 'won') return;
    if (immortal && cause !== 'fall') return;
    hero.mode = 'dead';
    hero.deadT = 0;
    hero.hammer = 0;
    emit('die', { cause });
  }

  function win() {
    if (hero.mode === 'dead' || hero.mode === 'won') return;
    hero.mode = 'won';
    world.boss.anim = def.floors ? 'fall' : 'rage';
    emit('clear', { bonus: world.bonus });
  }

  function startAir(vx, vy, jumping) {
    hero.mode = 'air';
    hero.vx = vx;
    hero.vy = vy;
    hero.airFrom = hero.y;
    hero.jumping = jumping;
    hero.ground = null;
    hero.jumped.clear();
  }

  function stepHero(input, jumpPressed) {
    hero.moving = false;
    if (hero.mode === 'dead') {
      hero.deadT++;
      if (hero.deadT > 110) world.outcome = 'dead';
      return;
    }
    if (hero.mode === 'won') {
      hero.deadT++;
      if (hero.deadT > 100) world.outcome = 'clear';
      return;
    }
    if (hero.hammer > 0 && --hero.hammer === 0) emit('hammerEnd');

    if (hero.mode === 'walk') {
      // Ride a lift.
      if (hero.ground?.ref) {
        const l = hero.ground.ref;
        if (!lifts.includes(l) || l.gone) {
          startAir(0, 0, false);
          return;
        }
        hero.y = l.y;
        hero.ground = liftSurface(l);
      }
      if (jumpPressed) {
        const dir = input.left ? -1 : input.right ? 1 : 0;
        if (dir) hero.face = dir;
        startAir(dir * PHYS.walk, PHYS.jumpVy, true);
        emit('jump');
        return;
      }
      if (!hero.hammer && input.up) {
        const l = ladderAt(hero.x, hero.y, 'bottom');
        if (l) {
          hero.mode = 'climb';
          hero.ladder = l;
          hero.x = l.x;
          hero.ground = null;
          return;
        }
      }
      if (!hero.hammer && input.down) {
        const l = ladderAt(hero.x, hero.y, 'top');
        if (l) {
          hero.mode = 'climb';
          hero.ladder = l;
          hero.x = l.x;
          hero.ground = null;
          return;
        }
      }
      const dir = input.left && !input.right ? -1 : input.right && !input.left ? 1 : 0;
      if (dir) {
        hero.face = dir;
        hero.moving = true;
        const nx = Math.max(4, Math.min(FIELD.w - 4, hero.x + dir * PHYS.walk));
        const g = groundAt(nx, hero.y, 3);
        hero.x = nx;
        hero.walkT++;
        if (g) {
          hero.y = segY(g, nx);
          hero.ground = g;
        } else {
          startAir(dir * 0.5, 0, false);
        }
      } else if (!groundAt(hero.x, hero.y, 3)) {
        startAir(0, 0, false); // the floor went (a rivet popped)
      }
      return;
    }

    if (hero.mode === 'climb') {
      const l = hero.ladder;
      if (input.up && !input.down) {
        hero.y -= PHYS.climb;
        hero.climbT++;
        if (hero.y <= l.top) {
          hero.y = l.top;
          hero.mode = 'walk';
          hero.ground = groundAt(hero.x, hero.y, 3);
          hero.ladder = null;
          if (!hero.ground) startAir(0, 0, false);
        }
      } else if (input.down && !input.up) {
        hero.y += PHYS.climb;
        hero.climbT++;
        if (hero.y >= l.bottom) {
          hero.y = l.bottom;
          hero.mode = 'walk';
          hero.ground = groundAt(hero.x, hero.y, 3);
          hero.ladder = null;
          if (!hero.ground) startAir(0, 0, false);
        }
      }
      return;
    }

    // In the air: no steering, like the arcade original.
    hero.vy = Math.min(PHYS.maxFall, hero.vy + PHYS.gravity);
    let nx = hero.x + hero.vx;
    if (nx < 4 || nx > FIELD.w - 4) {
      hero.vx = -hero.vx * 0.5;
      nx = Math.max(4, Math.min(FIELD.w - 4, nx));
    }
    const ny = hero.y + hero.vy;
    if (hero.vy >= 0) {
      const s = landing(nx, hero.y, ny);
      if (s) {
        hero.x = nx;
        hero.y = segY(s, nx);
        if (hero.y - hero.airFrom > PHYS.safeFall) {
          die('fall');
          return;
        }
        hero.mode = 'walk';
        hero.ground = s;
        hero.vx = 0;
        hero.vy = 0;
        emit('land');
        return;
      }
    }
    hero.x = nx;
    hero.y = ny;
    if (hero.y > FIELD.h + 24) die('fall');
  }

  /* ---------- Hazards ---------- */

  function downhill(s) {
    return s.y2 > s.y1 ? 1 : s.y2 < s.y1 ? -1 : 1;
  }

  function spawnBarrel() {
    const s = girders[5];
    world.barrels.push({ x: world.boss.x + 14, y: segY(s, world.boss.x + 14), seg: s, dir: 1, mode: 'roll', vy: 0, ladder: null, rot: 0, id: world.time });
    world.boss.anim = 'throw';
    world.boss.t = 0;
    emit('throw');
  }

  function stepBarrel(b) {
    const v = diff.barrelSpeed;
    if (b.mode === 'roll') {
      const nx = b.x + b.dir * v;
      // Take a ladder down now and then; more often when the hero is below.
      for (const l of ladders) {
        if ((b.x - l.x) * (nx - l.x) > 0 || b.x === l.x) continue;
        if (Math.abs(l.top - b.y) > 4) continue;
        let p = diff.ladderChance;
        if (hero.y > b.y + 8 && Math.abs(hero.x - l.x) < 48) p += 0.25;
        if (rand() < p) {
          b.mode = 'ladder';
          b.ladder = l;
          b.x = l.x;
          return;
        }
      }
      b.x = nx;
      b.rot += b.dir * v * 0.35;
      if (!within(nx, b.seg)) {
        b.mode = 'fall';
        b.vy = 0.4;
        b.fallFrom = b.y;
      } else {
        b.y = segY(b.seg, nx);
      }
    } else if (b.mode === 'ladder') {
      b.y += v * 1.1;
      if (b.y >= b.ladder.bottom) {
        b.y = b.ladder.bottom;
        const s = groundAt(b.x, b.y, 3);
        if (!s) return (b.dead = true);
        b.seg = s;
        b.dir = downhill(s);
        b.mode = 'roll';
        b.ladder = null;
      }
    } else {
      b.vy = Math.min(3.2, b.vy + 0.12);
      b.x += b.dir * v * 0.45;
      const ny = b.y + b.vy;
      const s = landing(b.x, b.y + 0.6, ny);
      if (s && s !== b.seg) {
        b.y = segY(s, b.x);
        b.seg = s;
        b.dir = downhill(s);
        b.mode = 'roll';
        emit('bounce', { x: b.x, y: b.y });
      } else {
        b.y = ny;
      }
    }
    // The oil drum lights up when a barrel reaches it.
    if (def.drum && b.mode === 'roll' && b.seg === girders[0] && b.x <= def.drum.x + 6) {
      b.dead = true;
      emit('ignite', { x: def.drum.x, y: def.drum.y });
      if (world.sparks.length < diff.sparkCap) spawnSpark(def.drum.x + 10, girders[0], 1);
    }
    if (b.y > FIELD.h + 20 || b.x < -20 || b.x > FIELD.w + 20) b.dead = true;
  }

  function spawnSpark(x, seg, dir) {
    world.sparks.push({ x, y: segY(seg, x), seg, dir, mode: 'walk', ladder: null, climbDir: 0, t: rand() * 100, think: 30 });
  }

  function stepSpark(s) {
    const v = diff.sparkSpeed;
    s.t++;
    if (s.mode === 'climb') {
      s.y += s.climbDir * v * 0.8;
      const end = s.climbDir < 0 ? s.ladder.top : s.ladder.bottom;
      if ((s.climbDir < 0 && s.y <= end) || (s.climbDir > 0 && s.y >= end)) {
        s.y = end;
        const g = groundAt(s.x, s.y, 3);
        if (!g) return (s.dead = true);
        s.seg = g;
        s.mode = 'walk';
        s.dir = rand() < 0.5 ? -1 : 1;
        s.think = 40;
      }
      return;
    }
    // Lift-stage patrollers never climb.
    if (!s.patrol && --s.think <= 0) {
      s.think = 20 + rand() * 50;
      // Head for the hero now and then; otherwise wander.
      if (rand() < 0.45) s.dir = hero.x < s.x ? -1 : 1;
      else if (rand() < 0.3) s.dir = -s.dir;
      for (const l of ladders) {
        if (Math.abs(l.x - s.x) > 2) continue;
        const wantUp = hero.y < s.y - 4;
        if (Math.abs(l.bottom - s.y) <= 3 && rand() < (wantUp ? 0.7 : 0.2)) {
          s.mode = 'climb';
          s.ladder = l;
          s.climbDir = -1;
          s.x = l.x;
          return;
        }
        if (Math.abs(l.top - s.y) <= 3 && rand() < (wantUp ? 0.15 : 0.6)) {
          s.mode = 'climb';
          s.ladder = l;
          s.climbDir = 1;
          s.x = l.x;
          return;
        }
      }
    }
    const nx = s.x + s.dir * v;
    const g = groundAt(nx, s.y, 3);
    if (!g || nx < 6 || nx > FIELD.w - 6) {
      s.dir = -s.dir;
      return;
    }
    s.x = nx;
    s.y = segY(g, nx);
    s.seg = g;
  }

  function spawnSpring() {
    world.springs.push({ x: world.boss.x + 16, y: def.springs.y, base: def.springs.y, phase: 0, mode: 'hop', vy: 0 });
    world.boss.anim = 'throw';
    world.boss.t = 0;
    emit('spring');
  }

  function stepSpring(sp) {
    const v = diff.springSpeed;
    if (sp.mode === 'hop') {
      sp.x += v;
      sp.phase += v / 32; // one hop per 32 px
      sp.y = sp.base - Math.sin((sp.phase % 1) * Math.PI) * 18;
      if (sp.x >= def.springs.dropX && sp.phase % 1 > 0.5) {
        sp.mode = 'drop';
        sp.vy = 0;
      }
    } else {
      sp.vy = Math.min(4, sp.vy + 0.14);
      sp.y += sp.vy;
      if (sp.y > FIELD.h + 20) sp.dead = true;
    }
  }

  function stepLifts() {
    for (const l of lifts) {
      const sh = l.shaft;
      l.dy = sh.dir * diff.liftSpeed;
      l.y += l.dy;
      if (sh.dir < 0 && l.y < sh.top) {
        l.y += sh.cycle;
        l.wrapped = true;
      } else if (sh.dir > 0 && l.y > sh.top + sh.cycle) {
        l.y -= sh.cycle;
        l.wrapped = true;
      }
    }
    // Riding a lift past the end of its shaft is fatal.
    if (hero.mode === 'walk' && hero.ground?.ref?.wrapped) die('lift');
    for (const l of lifts) l.wrapped = false;
  }

  /* ---------- Collisions and pickups ---------- */

  function hits(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < aw + bw && ay - ah < by && by - bh < ay;
  }

  function hammerBox() {
    // The hammer swings above the hero's head and down in front of him.
    return { x: hero.x + hero.face * 9, y: hero.y, w: 9, h: 22 };
  }

  function collide() {
    if (hero.mode === 'dead' || hero.mode === 'won') return;
    const hb = hero.hammer > 0 ? hammerBox() : null;
    for (const b of world.barrels) {
      if (b.dead) continue;
      if (hb && hits(hb.x, hb.y, hb.w, hb.h, b.x, b.y, 5, 10)) {
        b.dead = true;
        world.score += SCORE.smash;
        emit('smash', { x: b.x, y: b.y - 5, points: SCORE.smash });
        continue;
      }
      if (hits(hero.x, hero.y, 3.5, 13, b.x, b.y, 4.5, 9)) die('barrel');
      // Points for clearing a barrel in a jump.
      if (hero.mode === 'air' && hero.jumping && !hero.jumped.has(b) && Math.abs(b.x - hero.x) < 5 && b.y > hero.y && b.y - hero.y < 26) {
        hero.jumped.add(b);
        world.score += SCORE.jump;
        emit('points', { x: hero.x, y: hero.y - 18, points: SCORE.jump });
      }
    }
    for (const s of world.sparks) {
      if (s.dead) continue;
      if (hb && hits(hb.x, hb.y, hb.w, hb.h, s.x, s.y, 5, 10)) {
        s.dead = true;
        world.score += SCORE.smashSpark;
        emit('smash', { x: s.x, y: s.y - 5, points: SCORE.smashSpark });
        continue;
      }
      if (hits(hero.x, hero.y, 3.5, 13, s.x, s.y, 4, 8)) die('spark');
    }
    for (const sp of world.springs) {
      if (hits(hero.x, hero.y, 3.5, 13, sp.x, sp.y, 5, 9)) die('spring');
    }
    // Touching the boss.
    const bs = world.boss;
    if (Math.abs(hero.x - bs.x) < 16 && hero.y > bs.y - 30 && hero.y <= bs.y + 1) die('boss');
    // Hammers.
    for (const h of world.hammers) {
      if (h.taken) continue;
      // Hammers hang above the girder: jump to grab one.
      if (hero.mode === 'air' && Math.abs(hero.x - h.x) < 7 && hero.y < h.y - 6 && hero.y > h.y - 30) {
        h.taken = true;
        hero.hammer = PHYS.hammerSteps;
        emit('hammer');
      }
    }
  }

  function checkGoal() {
    if (hero.mode !== 'walk') return;
    if (def.goal) {
      if (hero.x >= def.goal.x1 && hero.x <= def.goal.x2 && Math.abs(hero.y - def.goal.y) < 2) win();
      return;
    }
    // Rivets: walking over one marks it; it pops once the hero steps clear.
    let popped = false;
    for (const r of def.rivets) {
      if (r.popped) continue;
      const onFloor = Math.abs(hero.y - r.y) < 1;
      if (onFloor && Math.abs(hero.x - r.x) < 3) r.touched = true;
      else if (r.touched && (!onFloor || Math.abs(hero.x - r.x) >= 8)) {
        r.popped = true;
        popped = true;
        world.score += SCORE.rivet;
        emit('rivet', { x: r.x, y: r.y });
      }
    }
    if (popped) {
      rebuildFloors();
      if (hero.ground) hero.ground = groundAt(hero.x, hero.y, 3);
      if (def.rivets.every((r) => r.popped)) win();
    }
  }

  /* ---------- Step ---------- */

  let jumpHeld = false;
  function step(input = {}) {
    events.length = 0;
    if (world.outcome) return;
    world.time++;
    const jumpPressed = !!input.jump && !jumpHeld;
    jumpHeld = !!input.jump;

    stepLifts();
    stepHero(input, jumpPressed);

    const active = hero.mode !== 'dead' && hero.mode !== 'won';
    if (active && world.hazards) {
      if (def.id === 'ramps' && --throwIn <= 0) {
        spawnBarrel();
        throwIn = diff.throwMin + rand() * (diff.throwMax - diff.throwMin);
      }
      if (def.id === 'lifts' && --springIn <= 0) {
        spawnSpring();
        springIn = diff.springEvery * (0.75 + rand() * 0.5);
      }
      if (def.id === 'lifts' && world.time === 1) {
        for (const p of def.patrols) {
          const g = girders[p.seg];
          spawnSpark((g.x1 + g.x2) / 2, g, 1);
          world.sparks[world.sparks.length - 1].patrol = true;
        }
      }
      if (def.id === 'rivets' && --ventIn <= 0) {
        ventIn = 300 - 30 * Math.min(round - 1, 4);
        if (world.sparks.length < diff.sparkCap) {
          // Spawn on a floor the hero is not on, at its far end.
          const vents = def.vents.filter((v) => Math.abs(def.floors[v.floor].y1 - hero.y) > 2);
          const v = vents[Math.floor(rand() * vents.length)];
          const g = groundAt(v.x, def.floors[v.floor].y1, 1);
          if (g) {
            spawnSpark(v.x, g, v.x < 112 ? 1 : -1);
            emit('vent', { x: v.x, y: g.y1 });
          }
        }
      }
    }
    if (active) {
      for (const b of world.barrels) stepBarrel(b);
      for (const s of world.sparks) stepSpark(s);
      for (const sp of world.springs) stepSpring(sp);
      world.barrels = world.barrels.filter((b) => !b.dead);
      world.sparks = world.sparks.filter((s) => !s.dead);
      world.springs = world.springs.filter((s) => !s.dead);
      collide();
      checkGoal();
      if (world.time % PHYS.bonusTick === 0) {
        world.bonus = Math.max(0, world.bonus - 100);
        if (world.bonus === 0) die('time');
      }
    }

    const bs = world.boss;
    bs.t++;
    if (bs.anim === 'throw' && bs.t > 40) bs.anim = 'idle';
    if (bs.anim === 'fall') bs.fallY = Math.min(bs.fallY + 1.6, 140);
  }

  return world;
}
