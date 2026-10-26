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

/**
 * The laser, as in the original: its power starts at 2 and each upgrade adds 1,
 * up to 12. A click does 3 damage per point of power (2 per point + 2 to
 * Destructor). Upgrades cost the same all through a tank.
 */
export const WEAPON = { start: 2, max: 12, damage: (power, kind) => (kind === 'destructor' ? 2 * power + 2 : 3 * power) };

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
  // Bilaterus: a chain of bones with a head at each end. Only the heads can be
  // hurt (100 each, as in the original); he swims whichever way his live head faces.
  bilaterus: { name: 'Bilaterus', hp: 100, speed: v(1.2), r: 34, bite: s(2.2), sheet: 'bilaterus', bones: 8, heads: true },
  cyrax: { name: 'Cyrax', hp: 5000, speed: 0.7, r: 60, bite: 0, sheet: 'boss', boss: true },
  warning: t(275),
};

/** The original's alien codes for a level, as aliens. */
export const ALIEN_CODES = {
  1: ['sylvester'],
  2: ['sylvester2'],
  3: ['balrog'],
  4: ['gus'],
  5: ['destructor'],
  6: ['ulysses'],
  7: ['psychosquid'],
  8: ['bilaterus'],
  9: ['sylvester', 'balrog'],
  10: ['psychosquid', 'balrog'],
  11: ['destructor', 'ulysses'],
  12: ['balrog', 'bilaterus'],
  21: ['cyrax'],
};
/** Aliens come 30 s after the last one is beaten (17.5 s for the first in 1-2). */
export const ALIEN_EVERY = t(3000);

/**
 * After each attack, some levels change which aliens come next, as in the
 * original. `code` is the attack just sent; returns the next one.
 */
const NEXT_ATTACK = {
  '1-5': (code, r) => (r() < 0.5 ? 3 : 9),
  '2-5': (code, r) => {
    if (code === 9) code = r() < 0.5 ? 4 : 5;
    if (r() < 0.1) return code === 5 ? 4 : 5;
    return r() < 0.05 ? 9 : code;
  },
  '3-2': (code, r) => (r() < 0.1 ? (code === 5 ? 4 : 5) : code),
  '3-5': (code, r) => (r() < 0.5 ? 6 : 7),
  '4-3': (code, r) => (r() < 0.5 ? 4 : 10),
  '4-4': (code, r) => (r() < 0.5 ? 8 : 11),
  '4-5': (code, r) => [10, 10, 8, 8, 11][Math.floor(r() * 5)],
};
export function nextAttack(def, code, r, attacks) {
  const next = NEXT_ATTACK[def.levelId ?? def.id]?.(code, r) ?? code;
  // In Challenge, Bilaterus brings a Balrog along from the sixth attack on.
  return def.challenge && attacks >= 5 && next === 8 ? 12 : next;
}

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
  // The bonus pets, bought with Shells in the Fish Emporium.
  brinkley: { name: 'Brinkley', bonus: true },
  nostradamus: { name: 'Nostradamus', bonus: true },
  stanley: { name: 'Stanley', bonus: true },
  walter: { name: 'Walter', bonus: true },
};
/** The 20 pets hatched in Adventure, in order. */
export const PET_ORDER = Object.keys(PETS).filter((id) => !PETS[id].bonus);
export const BONUS_PETS = Object.keys(PETS).filter((id) => PETS[id].bonus);

/*
 * The bonus pets' abilities, from the original. Brinkley swims after food and
 * eats it; every 3rd pellet he gives back a shell coin worth a star, every 15th
 * one worth a diamond, every 45th a pearl and every 135th a chest. Shell coins
 * pay Shells, not money. Nostradamus makes a food pellet every
 * 3-6 s. Stanley shoots down alien missiles with balls and throws one at an
 * alien every second. Walter punches whatever fish or pet is in front of him
 * when you click him, and it drops its coin or uses its power at once.
 */
export const BONUS = {
  brinkley: { rest: t(108), every: 3, prizes: [[135, 'chest'], [45, 'pearl'], [15, 'diamond'], [1, 'star']] },
  nostradamus: { every: [t(300), t(600)] },
  stanley: { every: t(100), ballDamage: 8, ballSpeed: 4.5, rest: [t(30), t(60), t(90)] },
  walter: { punch: t(30), rest: t(40), reach: 40 },
};

/*
 * The Bonus Reward, as in the original: offered on the results screen after a
 * Time Trial, a Challenge tank or the final battle. Each buy gets the next item
 * in this order, at (items bought + 4) x 5,000 Shells, up to 50,000.
 */
export const BONUS_REWARD = {
  items: ['brinkley', 'nostradamus', 'stanley', 'walter', 'pets4', 'pets7'],
  price: (bought) => Math.min(50000, (bought + 4) * 5000),
};
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
      // Level L of tank T hatches pet 5T + L - 6; 4-5 leads to the final battle with no egg of its own.
      pet: PET_ORDER[ti * 5 + n] && !(ti === 3 && n === 4) ? PET_ORDER[ti * 5 + n] : null,
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
  pet: 'presto',
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

/*
 * Challenge, as in the original: tanks 1-4 played with their level-5 shop and
 * aliens, after Adventure is beaten. Egg pieces cost more, and every price
 * creeps up by 1% of its starting value every 1.5-2 s. Buying an egg piece puts
 * the other prices back and pauses the rises for 5 s. Every few attacks, one more
 * copy of the attacking aliens comes along.
 */
export const CHALLENGE = [
  { egg: 5000, inflateEvery: t(150), extraEvery: 4 },
  { egg: 5000, inflateEvery: t(150), extraEvery: 5 },
  { egg: 15000, inflateEvery: t(175), extraEvery: 5 },
  { egg: 25000, inflateEvery: t(200), extraEvery: 6 },
].map((c, i) => {
  const base = LEVELS[i * 5 + 4];
  return { ...base, ...c, id: `challenge${i + 1}`, levelId: base.id, challenge: i + 1, name: `Challenge Tank ${i + 1}`, pet: null };
});

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
export const SHELLS = {
  // Hatching Presto, by beating the final boss the first time.
  presto: 5000,
  // Beating the boss again: 5,000 for the second win, 5,000 more for each after, up to 25,000.
  boss: (wins) => Math.min(25000, Math.max(1, wins - 1) * 5000),
  // Time Trial: 5% of the money earned.
  timeTrialPercent: 5,
  // Challenge: 2,000 / 5,000 / 10,000 / 20,000 for clearing tanks 1-4.
  challenge: [2000, 5000, 10000, 20000],
};
