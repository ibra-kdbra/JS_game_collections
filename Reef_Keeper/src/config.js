/**
 * Reef Keeper balance: every number the game plays by. Times are in steps
 * (60 per second). The whole game is one 640 x 480 frame: the shop bar on
 * top, the tank below it.
 */

export const FRAME = { w: 640, h: 480 };
export const BAR = { h: 74 };
export const TANK = { x: 0, y: BAR.h, w: 640, h: 480 - BAR.h, surface: BAR.h + 14, floor: 452 };

/* ---------- Fish ---------- */

export const FISH = {
  guppy: {
    name: 'Guppy',
    what: 'Grows as it eats, then drops silver and gold coins.',
    cost: 100,
    speed: [1.0, 0.95, 0.85, 0.9], // small, medium, large, star
    size: [19, 25, 32, 32],
    grow: [2, 4], // meals to reach medium, then large
    coinEvery: [0, 540, 480, 540],
    coin: [null, 'silver', 'gold', 'star'],
    hungryAfter: 900,
    starveAfter: 2700,
  },
  breeder: { name: 'Breeder', what: 'Has a baby guppy every 25 seconds while she is fed.', cost: 750, speed: 0.8, size: 28, breedEvery: 1500, hungryAfter: 1200, starveAfter: 3000 },
  carnivore: { name: 'Carnivore', what: 'Eats baby guppies. Drops diamonds.', cost: 1000, speed: 1.15, size: 34, coinEvery: 720, coin: 'diamond', hungryAfter: 1500, starveAfter: 3300 },
  leviathan: { name: 'Leviathan', what: 'Eats carnivores. Drops treasure chests.', cost: 5000, speed: 0.9, size: 52, coinEvery: 1500, coin: 'chest', hungryAfter: 2400, starveAfter: 4800 },
  starcatcher: { name: 'Starcatcher', what: 'Lives on the sand and eats falling stars. Drops diamonds.', cost: 750, speed: 1.1, size: 26, coinEvery: 0, coin: 'diamond', hungryAfter: 1500, starveAfter: 3600, bottom: true },
  grubber: { name: 'Grubber', what: 'Crawls on the sand dropping grubs.', cost: 500, speed: 0.6, size: 24, grubEvery: 900, hungryAfter: 1200, starveAfter: 3000, bottom: true },
  muncher: { name: 'Muncher', what: 'Eats grubs. Drops pearls.', cost: 600, speed: 1.0, size: 26, coinEvery: 0, coin: 'pearl', hungryAfter: 1200, starveAfter: 3000 },
};

/** A star potion turns the guppy that eats it into a star guppy. */
export const POTION = { name: 'Star potion', what: 'A guppy that drinks it drops stars.', cost: 250 };

export const COINS = {
  silver: { value: 15, r: 12 },
  gold: { value: 35, r: 13 },
  star: { value: 40, r: 13 },
  diamond: { value: 200, r: 14 },
  pearl: { value: 250, r: 13 },
  chest: { value: 1500, r: 19 },
  sink: 0.7,
  floorLife: 420,
  grab: 22,
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
  start: 3,
  max: 10,
  countCost: 300,
};

export const WEAPON = { damage: [1, 2, 3, 5, 8], cost: [0, 1000, 2000, 3000, 4000] };

/* ---------- Aliens ---------- */

export const ALIENS = {
  gobbler: { name: 'Gobbler', what: 'Eats your fish. Click it again and again to zap it.', hp: 24, speed: 0.8, r: 40, bite: 150 },
  grinder: { name: 'Grinder', what: 'Tougher and hungrier. Upgrade your zapper.', hp: 60, speed: 1.0, r: 46, bite: 110 },
  twins: { name: 'Twins', what: 'Two small gobblers at once.', hp: 16, speed: 0.95, r: 30, bite: 160 },
  glutton: { name: 'Glutton', what: "Zaps bounce off. Feed it until it bursts!", hp: 15, speed: 0.6, r: 44, bite: 240, feed: true },
  bomber: { name: 'Bomber', what: 'Sits on the sand firing bombs. Zap it, and pop the bombs.', hp: 40, speed: 0.5, r: 38, bite: 0, bombEvery: 150 },
  mirror: { name: 'Mirror', what: 'Zapping it while its shield glows heals it. Wait for the shield to drop.', hp: 50, speed: 0.85, r: 42, bite: 130, shield: [240, 180] },
  warning: 240,
};

/* ---------- Pets ---------- */

export const PETS = {
  snail: { name: 'Shelby', what: 'Snail: collects coins from the sand.' },
  clam: { name: 'Pearl', what: 'Clam: makes a $250 pearl every 30 seconds.' },
  puffer: { name: 'Puff', what: 'Pufferfish: feeds a starving fish now and then.' },
  seahorse: { name: 'Dash', what: 'Seahorse: darts out to grab coins in the water.' },
  turtle: { name: 'Shellsworth', what: 'Turtle: slows aliens down.' },
  octopus: { name: 'Inky', what: 'Octopus: inks each alien as it arrives, stunning it.' },
  angel: { name: 'Grace', what: 'Angelfish: brings a starved fish back to life every minute.' },
  eel: { name: 'Sparky', what: 'Electric eel: zaps aliens every two seconds.' },
  jelly: { name: 'Glo', what: 'Jellyfish: your fish get hungry 25% slower.' },
  crab: { name: 'Pinch', what: 'Crab: brings food that reaches the sand back to the top.' },
};
export const MAX_PETS = 3;

/* ---------- Worlds and levels ---------- */

/**
 * Five worlds of ten levels. Each level needs three egg pieces; a few levels'
 * eggs hatch a pet. Every level's shop has the basics (guppy, food, more food,
 * the zapper from level 1-3, the egg) plus up to three featured specials from
 * `feature(n)`, so the bar never holds more than eight buttons.
 */
export const WORLDS = [
  {
    name: 'Shallows',
    eggBase: 500,
    eggStep: 180,
    feature: (n) => (n >= 6 ? ['breeder'] : []),
    aliens: { 3: ['gobbler'] },
    hatch: { 5: 'snail', 10: 'clam' },
  },
  {
    name: 'Kelp Forest',
    eggBase: 1500,
    eggStep: 220,
    feature: (n) => (n <= 5 ? ['carnivore', 'breeder'] : ['carnivore', 'potion', 'starcatcher']),
    aliens: { 1: ['gobbler'], 5: ['gobbler', 'grinder'], 10: ['twins'] },
    hatch: { 5: 'puffer', 10: 'seahorse' },
  },
  {
    name: 'Coral Shelf',
    eggBase: 2600,
    eggStep: 260,
    feature: (n) => (n <= 5 ? ['grubber', 'muncher', 'breeder'] : ['carnivore', 'leviathan', 'breeder']),
    aliens: { 1: ['gobbler', 'grinder'], 3: ['glutton', 'gobbler'], 7: ['glutton', 'grinder', 'twins'] },
    hatch: { 5: 'turtle', 10: 'octopus' },
  },
  {
    name: 'Shipwreck',
    eggBase: 3800,
    eggStep: 300,
    feature: (n) => (n % 2 ? ['carnivore', 'potion', 'starcatcher'] : ['grubber', 'muncher', 'carnivore']),
    aliens: { 1: ['grinder', 'twins'], 2: ['bomber', 'grinder'], 6: ['mirror', 'bomber', 'glutton'] },
    hatch: { 5: 'angel', 10: 'eel' },
  },
  {
    name: 'The Trench',
    eggBase: 5200,
    eggStep: 350,
    feature: (n) => [['carnivore', 'leviathan', 'breeder'], ['potion', 'starcatcher', 'carnivore'], ['grubber', 'muncher', 'breeder']][(n - 1) % 3],
    aliens: { 1: ['mirror', 'grinder', 'twins', 'bomber', 'glutton'] },
    hatch: { 5: 'jelly', 10: 'crab' },
  },
];

export const LEVELS_PER_WORLD = 10;

/** Hard mode: hungrier fish, tougher and earlier aliens, dearer eggs. */
export const HARD = { hunger: 0.75, alienHp: 1.4, alienEvery: 0.75, egg: 1.3 };

/** Build the level list for a mode ('normal' or 'hard'). */
export function buildLevels(mode = 'normal') {
  const hard = mode === 'hard';
  const levels = [];
  let pool = [];
  WORLDS.forEach((W, w) => {
    for (let n = 1; n <= LEVELS_PER_WORLD; n++) {
      if (W.aliens[n]) pool = W.aliens[n];
      const index = levels.length;
      const shop = ['guppy', 'quality', 'count', ...W.feature(n), ...(index >= 2 ? ['weapon'] : []), 'egg'];
      // Aliens arrive sooner and more often through each world and across worlds.
      const pressure = w * LEVELS_PER_WORLD + n;
      const hasAliens = index >= 2;
      const every = Math.round(60 * Math.max(55, 125 - pressure * 1.4) * (hard ? HARD.alienEvery : 1));
      const first = Math.round(60 * Math.max(45, 100 - pressure) * (hard ? HARD.alienEvery : 1));
      levels.push({
        id: `${mode}-${w + 1}-${n}`,
        mode,
        index,
        world: w,
        number: n,
        name: `${w + 1}-${n}`,
        worldName: W.name,
        egg: Math.round(((W.eggBase + W.eggStep * (n - 1)) * (hard ? HARD.egg : 1)) / 50) * 50,
        start: { money: 200 + w * 50, guppies: 2 },
        shop: order(shop),
        aliens: hasAliens ? { kinds: pool, first, every } : null,
        hatch: hard ? null : (W.hatch[n] ?? null),
        hunger: hard ? HARD.hunger : 1,
        alienHp: hard ? HARD.alienHp : 1,
      });
    }
  });
  return levels;
}

const SHOP_ORDER = ['guppy', 'quality', 'count', 'breeder', 'carnivore', 'potion', 'starcatcher', 'grubber', 'muncher', 'leviathan', 'weapon', 'egg'];
const order = (ids) => SHOP_ORDER.filter((id) => ids.includes(id));

export const LEVELS = buildLevels('normal');
export const HARD_LEVELS = buildLevels('hard');

/** Endless mode: aliens keep coming, faster and in bigger mixes. */
export const ENDLESS = {
  start: { money: 400, guppies: 3 },
  shop: SHOP_ORDER.filter((id) => id !== 'egg'),
  first: 60 * 60,
  every: (wave) => Math.round(60 * Math.max(15, 60 - wave * 4)),
  count: (wave) => 1 + Math.floor(wave / 2), // aliens per wave
  kinds: (wave) => ['gobbler', 'gobbler', 'twins', 'grinder', 'glutton', 'bomber', 'mirror'].slice(0, Math.min(7, 2 + Math.floor(wave / 2))),
  hp: (wave) => 1 + wave * 0.5,
};

/** Free tank: no aliens, no goal, plenty of money. */
export const FREE = { start: { money: 5000, guppies: 4 }, shop: SHOP_ORDER.filter((id) => id !== 'egg') };

export const LIMITS = { fish: 36 };
