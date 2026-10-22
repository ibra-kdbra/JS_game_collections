/**
 * Every tuning lever for Snake lives here, so balancing never means hunting
 * through game code. Times are in fixed logic steps (60 per second) so they
 * never depend on the display's refresh rate.
 */
export const STEPS_PER_SECOND = 60;

export const CONFIG = {
  /** Board used by Classic, Wrap, Zen and Daily (arenas bring their own map). */
  board: { w: 20, h: 20 },
  /** Segments the snake starts with. They begin coiled on the start cell. */
  startLength: 4,
  /** Turns buffered ahead of the next move, so quick double-turns register. */
  turnQueue: 2,

  speed: {
    /** Logic steps per grid move at the start (9 = 6.7 cells per second). */
    start: 9,
    /** Fastest the ramp can go (5 = 12 cells per second). */
    min: 5,
    /** Every `rampEvery` foods eaten, moves get `rampBy` steps quicker. */
    rampEvery: 4,
    rampBy: 0.5,
  },

  food: { score: 10, grow: 1 },

  golden: {
    /** Chance a golden bonus appears after a normal food is eaten. */
    chance: 0.22,
    /** Steps before it disappears (5.5 s). */
    life: 330,
    score: 50,
    grow: 3,
  },

  power: {
    /** Chance a speed-up or slow-down capsule appears after a normal food. */
    chance: 0.16,
    /** Share of those capsules that are speed-ups (the rest are slow-downs). */
    fastShare: 0.5,
    /** Steps the capsule waits on the board (10 s). */
    life: 600,
    /** Steps the effect lasts once eaten (6 s). */
    duration: 360,
    /** Move-time multipliers while the effect runs. */
    fastFactor: 0.62,
    slowFactor: 1.6,
    /** Food is worth this much more while the speed-up runs: risk pays. */
    fastScoreMultiplier: 2,
    score: 5,
  },

  zen: {
    /** Biting yourself in Zen cuts the tail off here, but never below this length. */
    minLength: 3,
  },

  daily: {
    /** Obstacle pieces stamped (each is mirrored four ways). */
    pieces: 5,
  },

  /** Seconds of play kept for the game-over replay. */
  replaySeconds: 3,

  /** Steps the snake waits after resuming from pause, so nobody resumes into a wall. */
  resumeGrace: 40,
};

export const MODES = {
  classic: { id: 'classic', name: 'Classic', wrap: false, zen: false, blurb: 'The edges are walls. Eat, grow, speed up.' },
  wrap: { id: 'wrap', name: 'Wrap', wrap: true, zen: false, blurb: 'Leave one edge, come back through the other.' },
  arena: { id: 'arena', name: 'Arenas', wrap: true, zen: false, blurb: '20 hand-built arenas. Reach the target length to clear each.' },
  daily: { id: 'daily', name: 'Daily', wrap: false, zen: false, blurb: 'One layout and food order for everyone, new every day (UTC).' },
  zen: { id: 'zen', name: 'Zen', wrap: true, zen: true, blurb: 'No death. Bite yourself and you lose the tail instead.' },
};
