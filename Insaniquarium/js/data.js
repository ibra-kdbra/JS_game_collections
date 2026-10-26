/**
 * Every number the game plays by. Most come straight from the original
 * program (Insaniquarium.exe v1.1), which runs at 100 updates a second: those
 * are written here in its own ticks and converted with `t()`. This game steps
 * 60 times a second. Coordinates are the original 640 x 480 screen; the shop
 * bar is the top 75 pixels.
 */

export const W = 640;
export const H = 480;
export const BAR = 75;
export const TANK = { surface: 82, top: 100, bottom: 400, floor: 440, sand: 425, left: 24, right: 616 };
export const STEP = 60;
const s = (sec) => Math.round(sec * STEP);
/** Original ticks (1/100 s) to our steps. */
export const t = (ticks) => Math.round((ticks * STEP) / 100);

/* ---------- Fish ---------- */

/*
 * Hunger, as in the original: every fish has a fullness counter that drops by
 * one a tick. It is hungry (and looks for food) at or below `hungryAt`, and
 * dies at zero. A meal adds `add[quality]`, up to `cap[quality]`.
 * Coin-dropping fish drop one every 200-450 ticks.
 */
const GUPPY_FULL = { start: [400, 600], hungryAt: 300, add: [500, 700, 1100], cap: [800, 1000, 1400] };
const PREDATOR_FULL = { start: [600, 800], hungryAt: 500, add: [1000, 1000, 1000], cap: [1400, 1400, 1400] };
export const COIN_EVERY = [200, 450];

export const FISH = {
  guppy: {
    name: 'Guppy',
    cost: 100,
    speed: [1.5, 1.4, 1.3, 1.3],
    size: [14, 20, 26, 26],
    // Growth points per pellet are 1, 2 or 3 by food quality; a small guppy
    // needs 4-5 to grow, a medium one 5-9 more.
    grow: [[4, 5], [5, 9]],
    coin: [null, 'silver', 'gold', 'star'],
    full: GUPPY_FULL,
  },
  carnivore: { name: 'Carnivore', cost: 1000, speed: 1.6, size: 26, coin: 'diamond', full: PREDATOR_FULL, eats: 'babies' },
  breeder: { name: 'Breeder', cost: 750, speed: 1.1, size: 24, breedEvery: s(25), full: GUPPY_FULL },
  starcatcher: { name: 'Starcatcher', cost: 750, speed: 1.2, size: 24, coin: 'diamond', full: PREDATOR_FULL, bottom: true },
  guppycruncher: { name: 'Guppycruncher', cost: 750, speed: 0.9, size: 24, coin: 'beetle', full: PREDATOR_FULL, bottom: true, eats: 'babies' },
  beetlemuncher: { name: 'Beetlemuncher', cost: 2000, speed: 1.3, size: 24, coin: 'pearl', full: PREDATOR_FULL },
  ultravore: { name: 'Ultravore', cost: 10000, speed: 1.2, size: 50, coin: 'chest', full: PREDATOR_FULL, eats: 'carnivores' },
};
export const POTION = { name: 'Star Potion', cost: 250 };
export const LIMITS = { fish: 40 };

/* ---------- Money (values from the original's coin table) ---------- */

export const COINS = {
  silver: { value: 15, row: 0 },
  gold: { value: 35, row: 1 },
  star: { value: 40, row: 2 },
  diamond: { value: 200, row: 3 },
  chest: { value: 2000, row: 4 },
  beetle: { value: 150, row: 5 },
  pearl: { value: 500 }, // the Beetlemuncher's pearl
  nikoPearl: { value: 250 },
  bomb: { value: 150 }, // Shrapnel's bombs
};
export const COIN = { sink: 0.8, floorLife: s(6), grab: 34 };

/* ---------- Food and weapon ---------- */

export const FOOD = {
  cost: 5,
  sink: 1.1,
  quality: [{ name: 'Food', growth: 1 }, { name: 'Better food', growth: 2 }, { name: 'Best food', growth: 3 }],
  qualityCost: [0, 200, 500],
  start: 1,
  max: 10,
  countCost: 300,
};

/** Each click does 3 damage per laser level (1-10). Upgrades cost the same all through a tank. */
export const WEAPON = { damage: (level) => 3 * level, max: 10 };

/* ---------- Aliens (health and speed from the original) ---------- */

// Speeds are the original's pixels per tick, converted to our steps.
const v = (perTick) => (perTick * 100) / STEP;

export const ALIENS = {
  sylvester: { name: 'Sylvester', hp: 50, speed: v(2.0), r: 46, bite: s(2.4), sheet: 'sylv' },
  sylvester2: { name: 'Sylvester', hp: 60, speed: v(1.6), r: 46, bite: s(2.2), sheet: 'sylv' },
  balrog: { name: 'Balrog', hp: 130, speed: v(1.2), r: 50, bite: s(2), sheet: 'balrog' },
  minisylvester: { name: 'Minisylvester', hp: 3, speed: v(1.0), r: 30, bite: s(2.6), sheet: 'smallsylv' },
  // Gus only takes food: a pellet does 4, 6 or 8 damage by quality.
  gus: { name: 'Gus', hp: 100, speed: v(1.6), r: 50, bite: s(3.5), sheet: 'gus', eatsFood: true, foodDamage: [4, 6, 8] },
  destructor: { name: 'Destructor', hp: 150, speed: v(1.2), r: 48, bite: 0, sheet: 'destructor', missileEvery: s(2.6), floor: true },
  ulysses: { name: 'Ulysses', hp: 220, speed: v(3.5), r: 50, bite: s(2.4), sheet: 'ulysses', missileEvery: s(3.5), deflect: true },
  // Psychosquid's shield: 2 s up, 4 s down. Shots while it's up heal him.
  psychosquid: { name: 'Psychosquid', hp: 260, speed: v(0.5), r: 50, bite: s(2.2), sheet: 'psychosquid', shield: [t(400), t(200)] },
  cyrax: { name: 'Cyrax', hp: 5000, speed: 0.7, r: 60, bite: 0, sheet: 'boss', boss: true },
  warning: t(275),
};

/** The original's alien codes for a level, as aliens. 8 (Bilaterus) is played as two Balrogs. */
export const ALIEN_CODES = {
  1: ['sylvester'],
  2: ['sylvester2'],
  3: ['balrog'],
  4: ['gus'],
  5: ['destructor'],
  6: ['ulysses'],
  7: ['psychosquid'],
  8: ['balrog', 'balrog'],
  9: ['sylvester', 'balrog'],
  10: ['psychosquid', 'balrog'],
  11: ['destructor', 'ulysses'],
  12: ['balrog', 'balrog', 'balrog'],
  21: ['cyrax'],
};
/** Aliens come 30 s after the last one is beaten (17.5 s for the first in 1-2). */
export const ALIEN_EVERY = t(3000);

/* ---------- Pets (what each does is in the game text: say('pet.<id>')) ---------- */

export const PETS = {
  stinky: { name: 'Stinky' },
  niko: { name: 'Niko' },
  itchy: { name: 'Itchy' },
  prego: { name: 'Prego' },
  zorf: { name: 'Zorf' },
  clyde: { name: 'Clyde' },
  vert: { name: 'Vert' },
  rufus: { name: 'Rufus' },
  meryl: { name: 'Meryl' },
  wadsworth: { name: 'Wadsworth' },
  seymour: { name: 'Seymour' },
  shrapnel: { name: 'Shrapnel' },
  gumbo: { name: 'Gumbo' },
  blip: { name: 'Blip' },
  rhubarb: { name: 'Rhubarb' },
  nimbus: { name: 'Nimbus' },
  amp: { name: 'Amp' },
  gash: { name: 'Gash' },
  angie: { name: 'Angie' },
  presto: { name: 'Presto' },
};
export const PET_ORDER = Object.keys(PETS);
export const MAX_PETS = 3;

/* ---------- Adventure (shops, prices and eggs from the original) ---------- */

/*
 * Each tank's shop. `extra` is the tank's two special items; `weapon` its
 * laser price. Level rows: [egg price, alien code(s), items missing that level].
 */
const TANKS = [
  {
    aquarium: 'aquarium1',
    first: 'guppy',
    extra: ['carnivore'],
    weapon: 1000,
    levels: [
      [150, null, ['quality', 'count', 'carnivore', 'weapon']],
      [500, [1], ['carnivore', 'weapon'], t(1750)],
      [2000, [2]],
      [3000, [3]],
      [5000, [3]],
    ],
  },
  {
    aquarium: 'aquarium2',
    first: 'guppy',
    extra: ['potion', 'starcatcher'],
    weapon: 1000,
    levels: [[750, [2], ['weapon', 'starcatcher']], [3000, [3]], [5000, [4]], [7500, [5]], [10000, [4, 5]]],
  },
  {
    aquarium: 'aquarium4',
    first: 'guppy',
    extra: ['guppycruncher', 'beetlemuncher'],
    weapon: 2000,
    levels: [[1000, [3], ['weapon', 'beetlemuncher']], [5000, [4, 5]], [7500, [7]], [10000, [6]], [15000, [6, 7]]],
  },
  {
    aquarium: 'aquarium5',
    first: 'breeder',
    extra: ['carnivore', 'ultravore'],
    weapon: 5000,
    levels: [[3000, [3], ['weapon', 'ultravore']], [25000, [8]], [50000, [4]], [75000, [8]], [99999, [8]]],
  },
];

export const LEVELS = [];
TANKS.forEach((T, ti) => {
  T.levels.forEach(([egg, codes, missing = [], first], n) => {
    const shop = [T.first, 'quality', 'count', ...T.extra, 'weapon', 'egg'].filter((id) => !missing.includes(id));
    LEVELS.push({
      id: `${ti + 1}-${n + 1}`,
      tank: ti,
      index: LEVELS.length,
      name: `Tank ${ti + 1}-${n + 1}`,
      aquarium: T.aquarium,
      egg,
      weaponCost: T.weapon,
      shop,
      // The original picks one of the level's alien codes at random for each attack.
      aliens: codes ? { codes, first: first ?? ALIEN_EVERY, every: ALIEN_EVERY } : null,
      pet: PET_ORDER[ti * 5 + n],
      start: { money: 200, guppies: 2, fish: T.first },
    });
  });
});

/** Tank 5: the final battle with Cyrax. */
export const BOSS = {
  id: 'boss',
  name: 'Final Boss',
  aquarium: 'aquarium6',
  egg: null,
  weaponCost: 5000,
  shop: ['guppy', 'quality', 'count', 'carnivore', 'breeder', 'weapon'],
  aliens: { codes: [21], first: s(30), every: s(9999) },
  boss: true,
  start: { money: 2000, guppies: 4 },
};

/* ---------- Other modes ---------- */

export const TIME_TRIAL = {
  id: 'timetrial',
  name: 'Time Trial',
  aquarium: 'aquarium1',
  seconds: 5 * 60,
  shop: ['guppy', 'quality', 'count', 'carnivore', 'breeder', 'potion', 'starcatcher', 'weapon'],
  weaponCost: 1000,
  aliens: { codes: [1, 2, 3], first: ALIEN_EVERY, every: ALIEN_EVERY },
  start: { money: 300, guppies: 2 },
};

export const CHALLENGE = {
  id: 'challenge',
  name: 'Challenge',
  aquarium: 'aquarium5',
  shop: ['guppy', 'quality', 'count', 'carnivore', 'breeder', 'ultravore', 'weapon'],
  weaponCost: 2000,
  start: { money: 400, guppies: 3 },
  first: s(45),
  every: (wave) => s(Math.max(18, 55 - wave * 3)),
  count: (wave) => 1 + Math.floor(wave / 3),
  hp: (wave) => 1 + wave * 0.35,
  inflation: (wave) => 1 + wave * 0.08,
  kinds: (wave) => ['sylvester', 'sylvester2', 'balrog', 'gus', 'minisylvester', 'destructor', 'psychosquid', 'ulysses'].slice(0, Math.min(8, 2 + wave)),
};

export const VIRTUAL = {
  id: 'virtual',
  name: 'Virtual Tank',
  aquarium: 'aquarium1',
  shop: ['guppy', 'quality', 'count', 'carnivore', 'breeder', 'starcatcher', 'ultravore'],
  start: { money: 1000, guppies: 3 },
  aliens: null,
  immortal: true,
};

/** Shells: the Virtual Tank currency, earned in the other modes. */
export const SHELLS = { level: 20, boss: 5000, timeTrialPer1000: 1 };
