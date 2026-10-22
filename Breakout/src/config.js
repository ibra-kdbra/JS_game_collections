/**
 * Every tuning lever in one place. Units: world pixels (the field is 480 x 640)
 * and seconds. The simulation reads only from here, so balancing never means
 * hunting through code.
 */
export const CONFIG = {
  field: { w: 480, h: 640 },

  grid: {
    cols: 12,
    maxRows: 15,
    cellW: 40,
    cellH: 20,
    top: 56, // y of the first brick row; the lane above is open air
    inset: 1, // visual and collision gap on each side of a brick
  },

  paddle: {
    y: 596,
    h: 12,
    w: 80,
    wideW: 124,
    minX: 0,
    keySpeed: 640, // keyboard max speed
    keyAccel: 5200, // keyboard acceleration, px/s^2
    followSpeed: 2600, // cap for pointer and bot movement, px/s
    dragGain: 1.15, // touch: world px moved per screen px dragged (after scale)
    maxBounceDeg: 62, // angle from vertical at the very edge of the paddle
    resizeRate: 260, // px/s the paddle grows or shrinks
  },

  ball: {
    r: 6,
    baseSpeed: 300, // level 1 launch speed
    speedPerLevel: 6, // added per campaign level
    maxSpeedOver: 140, // speed may rise this much above the level's launch speed
    speedPerHit: 1.6, // added on every brick hit
    maxSubstep: 3, // px per substep; ball radius is 6, so nothing tunnels
    minVerticalRatio: 0.28, // |dy| never drops below this (guards horizontal loops)
    idleNudgeAfter: 7, // s without touching the paddle or a breakable brick
    idleNudgeDeg: 14, // random tilt applied per bounce while idle
    maxBalls: 8,
    launchSpreadDeg: 18,
    catchHoldMax: 3, // s before a caught ball releases itself
    trail: 9, // samples kept for the trail
  },

  bricks: {
    normal: { hp: 1, score: 10 },
    tough2: { hp: 2, score: 25 },
    tough3: { hp: 3, score: 45 },
    steel: { hp: Infinity, score: 0 },
    bomb: { hp: 1, score: 30, chainDelay: 0.07, radius: 1 },
    hitScore: 5, // for a hit that doesn't destroy
  },

  combo: {
    step: 4, // bricks per multiplier step
    maxMult: 6,
  },

  lives: { start: 3, max: 6 },

  powerups: {
    dropChance: 0.13,
    minGap: 1.2, // s between random drops
    maxFalling: 2,
    fallSpeed: 130,
    w: 36,
    h: 16,
    weights: { wide: 3, multi: 3, slow: 2, laser: 2, catch: 2, life: 0.55 },
    duration: { wide: 18, slow: 12, laser: 11, catch: 15 },
    slowFactor: 0.66,
    stallDrop: 14, // s without hitting a breakable brick before a free multi-ball drops
    multiSpreadDeg: 24,
  },

  laser: {
    interval: 0.32,
    speed: 900,
    w: 3,
    h: 12,
  },

  scoring: {
    clearBonus: 500,
    flawlessBonus: 1000, // no life lost on this level
    lifeBonus: 150, // per life left at clear
  },

  endless: {
    speedStart: 320,
    speedPerStage: 9,
    lifeEvery: 3, // stages
  },

  fx: {
    shake: { full: 1, low: 0.35, off: 0 },
    shakeBrick: 1.2,
    shakeBomb: 7,
    shakeLife: 10,
    shakeDecay: 7.5, // per second, exponential
    particlesPerBrick: 10,
    particleCap: 420,
  },
};

/** Ball launch speed for a campaign level (1-based) or endless stage. */
export function levelSpeed(levelIndex, cfg = CONFIG) {
  return cfg.ball.baseSpeed + cfg.ball.speedPerLevel * levelIndex;
}
