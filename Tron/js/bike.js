import { DIRS, OPPOSITE, TURNS } from './board.js';

// Boost tuning: a full tank lasts BOOST_DRAIN⁻¹ seconds and refills in BOOST_RECHARGE⁻¹ seconds.
export const BOOST = {
  multiplier: 1.75,
  drain: 0.8,
  recharge: 0.2,
  minToStart: 0.25,
};

// AI tuning per difficulty.
//   rethink:  chance per step to re-plan even when the way ahead looks clear
//   lookahead: re-plan whenever a wall is this many cells ahead or closer
//   cap:       flood-fill cell cap (higher sees traps sooner)
//   wander:    chance per step of a random safe turn (avoids wall hugging)
//   boost:     how eagerly the AI uses its boost
const AI = {
  1: { rethink: 0.03, lookahead: 1, cap: 120, wander: 0.02, boost: 0 },
  2: { rethink: 0.3, lookahead: 3, cap: 700, wander: 0.01, boost: 0.01 },
  3: { rethink: 1, lookahead: 6, cap: Infinity, wander: 0, boost: 0.05 },
};

export class Bike {
  constructor(board, id, { x, y, dir }) {
    this.board = board;
    this.id = id;
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.turns = [];
    this.alive = true;
    this.progress = 0;
    this.energy = 1;
    this.boostHeld = false;
    this.boosting = false;
    board.set(x, y, id);
  }

  // Buffer up to two turns so quick inputs (e.g. a U-turn as two taps) aren't lost.
  queueTurn(dir) {
    const last = this.turns.length ? this.turns[this.turns.length - 1] : this.dir;
    if (dir === last || dir === OPPOSITE[last] || this.turns.length >= 2) return;
    this.turns.push(dir);
  }

  updateBoost(dt) {
    if (this.boostHeld && (this.boosting || this.energy >= BOOST.minToStart)) {
      this.boosting = true;
      this.energy = Math.max(0, this.energy - BOOST.drain * dt);
      if (this.energy === 0) this.boosting = false;
    } else {
      this.boosting = false;
      this.energy = Math.min(1, this.energy + BOOST.recharge * dt);
    }
  }

  speed(base) {
    return this.boosting ? base * BOOST.multiplier : base;
  }

  // Apply the next buffered turn and return the cell this bike is about to enter.
  nextCell() {
    if (this.turns.length) this.dir = this.turns.shift();
    const d = DIRS[this.dir];
    return { x: this.x + d.x, y: this.y + d.y };
  }

  think(opponent, difficulty) {
    const ai = AI[difficulty];
    const { board } = this;
    const ahead = board.runLength(this.x, this.y, this.dir, ai.lookahead + 1);
    const options = [this.dir, ...TURNS[this.dir]];

    if (ahead > ai.lookahead && Math.random() < ai.wander) {
      const safe = TURNS[this.dir].filter((d) => board.runLength(this.x, this.y, d, 3) >= 3);
      if (safe.length) this.dir = safe[Math.floor(Math.random() * safe.length)];
    } else if (ahead <= ai.lookahead || Math.random() < ai.rethink) {
      let best = this.dir;
      let bestScore = -1;
      for (const d of options) {
        const step = DIRS[d];
        const nx = this.x + step.x;
        const ny = this.y + step.y;
        let score = board.floodArea(nx, ny, ai.cap);
        if (score > 0 && difficulty === 3) {
          // Among roomy options, lean towards the opponent to cut them off.
          const dist = Math.abs(nx - opponent.x) + Math.abs(ny - opponent.y);
          score += 1 / (1 + dist);
        }
        if (d === this.dir) score += 0.5; // Prefer going straight on ties.
        if (score > bestScore) {
          bestScore = score;
          best = d;
        }
      }
      this.dir = best;
    }

    const run = board.runLength(this.x, this.y, this.dir, 16);
    if (this.boosting) {
      this.boostHeld = run >= 6;
    } else if (ai.boost && this.energy > 0.6 && run >= 12) {
      const near = Math.abs(this.x - opponent.x) + Math.abs(this.y - opponent.y) < 24;
      this.boostHeld = Math.random() < (near ? ai.boost * 4 : ai.boost);
    }
  }
}
