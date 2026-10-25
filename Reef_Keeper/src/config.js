/**
 * Reef Keeper balance: every number the game plays by. Times are in steps
 * (60 per second), distances in tank pixels (the tank is 800 x 480).
 */

export const TANK = { w: 800, h: 480, floor: 448, surface: 40 };

export const FISH = {
  minnow: {
    cost: 100,
    speed: [1.1, 1.0, 0.9], // small, medium, large
    size: [20, 28, 38], // body half-length
    grow: [3, 5], // pellets to reach medium, then large
    coinEvery: [0, 760, 700], // steps between coins; small fish drop none
    coin: [null, 'silver', 'gold'],
    hungryAfter: 720, // steps after a meal before it looks for food
    starveAfter: 1380, // steps after a meal before it dies
  },
  pike: {
    cost: 1000,
    speed: 1.25,
    size: 44,
    coinEvery: 900,
    coin: 'gem',
    hungryAfter: 1500,
    starveAfter: 2700,
  },
};

export const COINS = {
  silver: { value: 15, r: 12 },
  gold: { value: 35, r: 13 },
  gem: { value: 200, r: 14 },
  chest: { value: 1500, r: 20 },
  sink: 0.55, // px per step
  floorLife: 240, // steps a coin lies on the sand before it fades
};

export const FOOD = {
  cost: 5,
  sink: 0.75,
  // Each food level: how much a pellet grows a fish, and how long it keeps it fed.
  levels: [
    { name: 'Flakes', growth: 1, fed: 1 },
    { name: 'Pellets', growth: 2, fed: 1.25 },
    { name: 'Krill', growth: 3, fed: 1.5 },
  ],
  qualityCost: [0, 200, 650], // to reach level 1, level 2
  maxCount: [1, 9], // pellets in the water at once: start, most
  countCost: 300, // per extra pellet
};

export const WEAPON = {
  // Damage per click on an invader, by upgrade level.
  damage: [1, 2, 4, 7],
  cost: [0, 800, 2000, 4000],
};

export const INVADERS = {
  squid: { hp: 30, speed: 0.75, size: 58, bite: 140, reward: 'chest' }, // bite: steps between meals
  eel: { hp: 70, speed: 1.0, size: 66, bite: 110, reward: 'chest' },
  warning: 300, // steps of warning before one arrives
};

export const CRAB = { cost: 400, speed: 1.8 };

/**
 * Levels. `shard` is the price of each of the three pearl pieces; buying the
 * third clears the level. `invaders` lists [first arrival, then every] steps
 * and which kind; `shop` is what the shop offers.
 */
export const LEVELS = [
  {
    name: 'Shallows',
    start: { money: 200, minnows: 2 },
    shard: 600,
    invaders: { kind: 'squid', first: 60 * 150, every: 60 * 150 },
    shop: ['minnow', 'quality', 'count', 'weapon', 'shard'],
  },
  {
    name: 'Kelp Forest',
    start: { money: 200, minnows: 2 },
    shard: 1200,
    invaders: { kind: 'squid', first: 60 * 120, every: 60 * 110 },
    shop: ['minnow', 'quality', 'count', 'crab', 'weapon', 'shard'],
  },
  {
    name: 'Coral Shelf',
    start: { money: 250, minnows: 2 },
    shard: 2500,
    invaders: { kind: 'squid', first: 60 * 100, every: 60 * 95 },
    shop: ['minnow', 'quality', 'count', 'pike', 'crab', 'weapon', 'shard'],
  },
  {
    name: 'The Trench',
    start: { money: 300, minnows: 2 },
    shard: 4000,
    invaders: { kind: 'eel', first: 60 * 100, every: 60 * 90 },
    shop: ['minnow', 'quality', 'count', 'pike', 'crab', 'weapon', 'shard'],
  },
];

export const LIMITS = { fish: 30 };
