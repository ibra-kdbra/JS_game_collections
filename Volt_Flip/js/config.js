/**
 * Every tuning lever for Volt Flip in one place. Units are world units
 * (the corridor is 300 tall), seconds and world units per second.
 * Ten world units make one metre on the HUD.
 */
export const STEPS_PER_SECOND = 60;
export const DT = 1 / STEPS_PER_SECOND;
export const UNITS_PER_METRE = 10;

export const WORLD = {
  height: 300, // floor surface at y = height, ceiling surface at y = 0
  playerX: 96, // where the courier sits on screen, in units from the left edge
  viewMinWidth: 520, // phones in portrait show at least this much corridor
  viewHeight: 400, // corridor plus a margin above and below
};

export const PLAYER = {
  size: 24, // drawn size
  hit: 9, // half-size of the hit box (smaller than the drawing, on purpose)
  gravity: 3400,
  kick: 320, // initial speed towards the other surface when flipping
  maxFall: 1500,
  coyote: 0.07, // a flip still works this long after leaving a surface
  buffer: 0.12, // a tap this long before landing flips on touchdown
};

/** Time a flip takes from one surface to the other (about 0.32 s). */
export const FLIP_TIME = (() => {
  const d = WORLD.height - PLAYER.size;
  const a = PLAYER.gravity / 2;
  return (-PLAYER.kick + Math.sqrt(PLAYER.kick ** 2 + 4 * a * d)) / (2 * a);
})();

export const SPEED = {
  start: 260,
  top: 480,
  ramp: 1500, // metres for about 63% of the way from start to top
};

/** Reaction time patterns leave between forced flips, shrinking with distance. */
export const MARGIN = {
  start: 0.46,
  end: 0.17,
  ramp: 900, // metres
};

/** Distance (metres) at which each kind of obstacle starts to appear. */
export const UNLOCK = {
  spikes: 0,
  gaps: 0,
  zigzag: 120,
  pylons: 220,
  drones: 420,
  shutters: 700,
  tunnels: 950,
  combos: 1250,
  sweepers: 1700,
  pistons: 2100,
};

/**
 * Overdrive: endless, but the corridor is built and timed as if the run were
 * already this many metres in, so it starts fast, tight and with every
 * obstacle unlocked.
 */
export const OVERDRIVE = { head: 2500 };

/** Piston spikes rise out of a rail and sink back on a cycle. */
export const PISTON = {
  height: 34, // fully raised
  lethal: 8, // raised past this, they hurt
};

/** Every 1000 m the city outside the corridor changes. Names are shown as you enter. */
export const SECTORS = [
  { name: 'Service Rails', tint: [250, 204, 21] },
  { name: 'Neon Row', tint: [232, 121, 249] },
  { name: 'Cold Storage', tint: [56, 189, 248] },
  { name: 'Redline', tint: [251, 113, 133] },
  { name: 'The Core', tint: [190, 242, 100] },
];
export const SECTOR_LENGTH = 1000; // metres

export const SCORE = {
  perMetre: 1,
  shard: 25,
  graze: 15,
  chainPerLevel: 8, // shards (or grazes) in a row to raise the multiplier
  maxMultiplier: 5,
};

export const PICKUPS = {
  shieldEvery: [650, 950], // metres between shield cells
  magnetEvery: [500, 800],
  magnetTime: 7,
  magnetRadius: 150,
  shardRadius: 20,
  invulnerable: 0.9,
};

export const speedAt = (metres) => SPEED.start + (SPEED.top - SPEED.start) * (1 - Math.exp(-metres / SPEED.ramp));
export const marginAt = (metres) => MARGIN.end + (MARGIN.start - MARGIN.end) * Math.exp(-metres / MARGIN.ramp);
