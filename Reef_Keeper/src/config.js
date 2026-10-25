/**
 * Reef Keeper balance: every number the game plays by. Times are in steps
 * (60 per second). The whole game is one 640 x 480 frame, like the arcade PC
 * games it follows: the shop bar on top, the tank below it.
 */

export const FRAME = { w: 640, h: 480 };
export const BAR = { h: 74 }; // the shop bar across the top
export const TANK = { x: 0, y: BAR.h, w: 640, h: 480 - BAR.h, surface: BAR.h + 14, floor: 452 };

export const FISH = {
  guppy: {
    cost: 100,
    speed: [1.0, 0.95, 0.85],
    size: [19, 25, 32], // half-length
    grow: [2, 4], // meals to reach medium, then large
    coinEvery: [0, 540, 480], // steps between coins; small guppies drop none
    coin: [null, 'silver', 'gold'],
    hungryAfter: 900, // 15 s after a meal it looks for food
    starveAfter: 2700, // 45 s after a meal it dies
  },
  breeder: {
    cost: 750,
    speed: 0.8,
    size: 28,
    breedEvery: 1500, // a small guppy every 25 s while fed
    hungryAfter: 1200,
    starveAfter: 3000,
  },
  carnivore: {
    cost: 1000,
    speed: 1.15,
    size: 34,
    coinEvery: 720,
    coin: 'diamond',
    hungryAfter: 1500,
    starveAfter: 3300,
  },
};

export const COINS = {
  silver: { value: 15, r: 12 },
  gold: { value: 35, r: 13 },
  diamond: { value: 200, r: 14 },
  pearl: { value: 250, r: 13 },
  chest: { value: 1500, r: 19 },
  sink: 0.7,
  floorLife: 420, // 7 s on the sand before it fades
  grab: 22, // extra pixels around a coin that still count as a click on it
};

export const FOOD = {
  cost: 5,
  sink: 1.1,
  levels: [
    { name: 'Flakes', growth: 1, fed: 1 },
    { name: 'Pellets', growth: 1, fed: 1.6 },
    { name: 'Capsules', growth: 2, fed: 2.2 },
  ],
  qualityCost: [0, 200, 500],
  start: 3, // pieces in the water at once at the start
  max: 10,
  countCost: 300,
};

export const WEAPON = {
  damage: [1, 2, 3, 5],
  cost: [0, 1000, 2000, 3000],
};

export const ALIENS = {
  gobbler: { name: 'Gobbler', hp: 24, speed: 0.8, r: 40, bite: 150, reward: 'chest' },
  grinder: { name: 'Grinder', hp: 60, speed: 1.0, r: 46, bite: 110, reward: 'chest' },
  warning: 240,
};

/** Pets hatch from the egg at the end of a level and help in every level after. */
export const PETS = {
  snail: { name: 'Shelby', what: 'a snail that collects coins from the sand' },
  clam: { name: 'Pearl', what: 'a clam that makes a pearl worth 250 every 30 seconds' },
  puffer: { name: 'Puff', what: 'a pufferfish that feeds a starving fish now and then' },
};

/**
 * Levels. Each needs three egg pieces; the egg hatches the pet named here.
 * `aliens` is { kind, first, every } in steps, or null. `shop` is the bar.
 */
export const LEVELS = [
  { name: 'Tank 1-1', title: 'First Fish', start: { money: 200, guppies: 2 }, egg: 500, hatch: 'snail', aliens: null, shop: ['guppy', 'quality', 'count', 'egg'] },
  { name: 'Tank 1-2', title: 'Uninvited', start: { money: 200, guppies: 2 }, egg: 1650, hatch: 'clam', aliens: { kind: 'gobbler', first: 60 * 90, every: 60 * 120 }, shop: ['guppy', 'quality', 'count', 'weapon', 'egg'] },
  { name: 'Tank 1-3', title: 'Big Teeth', start: { money: 250, guppies: 2 }, egg: 3800, hatch: 'puffer', aliens: { kind: 'gobbler', first: 60 * 80, every: 60 * 100 }, shop: ['guppy', 'quality', 'count', 'carnivore', 'weapon', 'egg'] },
  { name: 'Tank 1-4', title: 'Nursery', start: { money: 250, guppies: 2 }, egg: 4800, hatch: null, aliens: { kind: 'gobbler', first: 60 * 75, every: 60 * 90 }, shop: ['guppy', 'quality', 'count', 'breeder', 'carnivore', 'weapon', 'egg'] },
  { name: 'Tank 1-5', title: 'The Grinder', start: { money: 300, guppies: 2 }, egg: 6200, hatch: null, aliens: { kind: 'grinder', first: 60 * 75, every: 60 * 90 }, shop: ['guppy', 'quality', 'count', 'breeder', 'carnivore', 'weapon', 'egg'] },
];

export const LIMITS = { fish: 30 };
