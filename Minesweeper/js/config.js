/**
 * Every tuning lever in one place. Logic modules read from here; nothing else
 * hard-codes a number that a designer might want to turn.
 */

export const PRESETS = {
  beginner: { id: 'beginner', label: 'Beginner', w: 9, h: 9, mines: 10 },
  intermediate: { id: 'intermediate', label: 'Intermediate', w: 16, h: 16, mines: 40 },
  expert: { id: 'expert', label: 'Expert', w: 30, h: 16, mines: 99 },
};

/** Limits for the Custom board form. */
export const CUSTOM = {
  minSide: 5,
  maxW: 50,
  maxH: 40,
  minMines: 1,
  /** Cells kept clear around the first click (3x3). */
  safeZone: 9,
  /** Above these densities no-guess generation may run out of time (measured, see README). */
  noGuessMaxDensity: 0.3,
  noGuessMaxDensityLarge: 0.22,
  largeBoard: 1000,
};

export const GEN = {
  /** Hard ceiling on whole-board retries before giving up on no-guess. */
  maxAttempts: 20000,
  /** Wall-clock budget for one no-guess generation, in ms. */
  timeBudget: 1500,
  /** Mine moves tried per attempt to repair a board where the solver stalls. */
  repairs: 40,
};

export const RULES = {
  /** Seconds added to the clock for each hint. */
  hintPenalty: 10,
  /** Seconds added for taking back the losing click (once per game). */
  undoPenalty: 15,
  undosPerGame: 1,
};

export const INPUT = {
  /** Hold time for a touch flag, ms. */
  longPressMs: 350,
  /** Finger travel that cancels a long press, px. */
  moveTolerance: 10,
  vibrateMs: 18,
};

export const FEEL = {
  /** Delay per ring of the cascade reveal, ms. */
  cascadeStep: 22,
  /** Longest a cascade may take regardless of size, ms. */
  cascadeMax: 650,
  /** Delay between mines detonating on a loss, ms. */
  boomStep: 18,
};

export const VIEW = {
  /** Cell size bounds in CSS px for the zoom slider and pinch. */
  minCell: 18,
  maxCell: 56,
  /** Preferred smallest cell before the board starts to scroll instead of shrink. */
  comfortCell: 30,
};

/**
 * Puzzle mode: a fixed ladder of seeded boards. Each step adds size, density or
 * a stronger logic requirement, so the curve reads at a glance in the level list.
 *   pair: minimum rounds of pair/subset reasoning the solution must need. Each
 *         target is the count the seeded board actually needs, so the ladder
 *         never gets easier (test/solver.test.mjs checks it) and the last
 *         level reaches Expert density. Every board is found in a few hundred
 *         attempts at most, well inside GEN.timeBudget on a phone.
 *   open: largest share of the safe cells the starting area may reveal, so the
 *         first levels are not half solved before the player moves.
 */
export const PUZZLES = [
  { w: 8, h: 8, mines: 7, pair: 1, open: 0.5 },
  { w: 8, h: 8, mines: 9, pair: 1, open: 0.45 },
  { w: 9, h: 9, mines: 11, pair: 3, open: 0.4 },
  { w: 10, h: 10, mines: 14, pair: 3, open: 0.4 },
  { w: 10, h: 10, mines: 16, pair: 4, open: 0.35 },
  { w: 12, h: 10, mines: 20, pair: 4, open: 0.35 },
  { w: 12, h: 12, mines: 25, pair: 5, open: 0.3 },
  { w: 14, h: 12, mines: 30, pair: 7, open: 0.3 },
  { w: 14, h: 14, mines: 36, pair: 8, open: 0.3 },
  { w: 16, h: 14, mines: 42, pair: 9, open: 0.25 },
  { w: 16, h: 16, mines: 50, pair: 9, open: 0.25 },
  { w: 20, h: 16, mines: 66, pair: 10, open: 0.25 },
];

export const DAILY = { w: 16, h: 16, mines: 40 };
