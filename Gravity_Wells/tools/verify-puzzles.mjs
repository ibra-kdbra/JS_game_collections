/**
 * Solves every Gravity Wells puzzle with the game's own move rules and prints
 * how hard each one is.
 *
 *   node Gravity_Wells/tools/verify-puzzles.mjs [--solutions]
 *
 * The move rules follow shiftPieces/moves in src/updates/puzzle.js: a tapped
 * arrow pushes itself and the row of pieces in front of it one cell; the
 * last piece of a row that ends in a black hole falls in and is gone (the
 * "top" layer it lands on is cleared by home.js once the fall animation
 * ends); a row that would leave the board does not move and costs no move;
 * an X square vanishes; a neutron star becomes a black hole.
 *
 * Columns:
 *   moves     the puzzle's move limit
 *   best      shortest solution (breadth-first search over board states)
 *   states    boards reachable within the move limit, counted once per move
 *             number they can be reached at
 *   wins      different tap sequences that clean the board within the limit
 *   random    chance that tapping a random piece that moves, every turn, cleans
 *             the board within the limit; "1 in N" (bigger N = harder)
 *
 * Fails (exit 1) when a puzzle cannot be solved within its move limit, when
 * its limit is not its shortest solution (two older puzzles, snatch and swivel,
 * are allowed their original slack), or when one of the puzzles added to the
 * original 18 is not harder (a smaller random chance) than the puzzle before it.
 */
import { readFileSync } from 'node:fs';

const entities = JSON.parse(readFileSync(new URL('../assets/entities.json', import.meta.url), 'utf8'));
const sequence = entities.game.levels.sequence;
const SLACK = { snatch: true, swivel: true };
// Added to the original 18; each must be harder than the puzzle it follows.
const ADDED = ['relay', 'pivot', 'orbit', 'shield', 'pulsar', 'eclipse', 'maelstrom'];

// Piece codes as in puzzle.js.
const EMPTY = 0, HOLE = 1, X = 3, UP = 4, RIGHT = 5, DOWN = 6, LEFT = 7, STAR = 8;
const pushable = (t) => t >= 2 && t <= 8;
const clickable = (t) => t >= 3 && t <= 8;

/** Apply a tap on cell i. Returns the new board or null when nothing moves. */
export function tap(state, i) {
  const t = state[i];
  if (!clickable(t)) return null;
  const s = state.slice();
  if (t == X) { s[i] = EMPTY; return s; }
  if (t == STAR) { s[i] = HOLE; return s; }
  let search, max, min;
  if (t == UP) { search = -6; max = 35; min = 0; }
  if (t == DOWN) { search = 6; max = 35; min = 0; }
  if (t == RIGHT || t == LEFT) { search = t == RIGHT ? 1 : -1; max = i + (5 - (i % 6)); min = i - (i % 6); }
  // Walk the row in front of the arrow (the arrow included) to the first
  // empty cell or black hole.
  const row = [];
  let j = i;
  for (;;) {
    if (!pushable(s[j])) break;
    row.push(j);
    j += search;
    if (j > max || j < min) return null;
  }
  // Everything moves one cell; into a black hole the last piece is lost.
  const end = s[j];
  for (let k = row.length - 1; k >= 0; k--) {
    const to = row[k] + search;
    if (to == j && end == HOLE) continue;
    s[to] = s[row[k]];
  }
  s[i] = EMPTY;
  return s;
}

const solved = (s) => !s.some(pushable);

function moves(s) {
  const out = [];
  for (let i = 0; i < 36; i++) {
    const n = tap(s, i);
    if (n) out.push([i, n]);
  }
  return out;
}

// Boards are stored as 18-character strings (two cells per character) to keep big puzzles in memory.
const pack = (b) => { let k = ''; for (let i = 0; i < 36; i += 2) k += String.fromCharCode(b[i] * 9 + b[i + 1]); return k; };
const unpack = (k) => { const b = new Array(36); for (let i = 0; i < 18; i++) { const c = k.charCodeAt(i); b[2 * i] = (c / 9) | 0; b[2 * i + 1] = c % 9; } return b; };

export function analyse(grid, limit) {
  // Layer by layer: how many tap sequences reach each board, and with what
  // chance a random tapper gets there. A clean board ends its sequence.
  let layer = new Map([[pack(grid), { paths: 1, p: 1, path: [] }]]);
  let best = -1, path = [], wins = 0, p = 0, states = 1;
  for (let d = 0; d < limit && layer.size; d++) {
    const next = new Map();
    for (const [key, node] of layer) {
      const ms = moves(unpack(key));
      for (const [i, b] of ms) {
        const q = node.p / ms.length;
        if (solved(b)) {
          wins += node.paths;
          p += q;
          if (best < 0) { best = d + 1; path = node.path.concat(i); }
          continue;
        }
        const k = pack(b);
        const n = next.get(k);
        if (n) { n.paths += node.paths; n.p += q; }
        else next.set(k, { paths: node.paths, p: q, path: best < 0 ? node.path.concat(i) : null });
      }
    }
    states += next.size;
    layer = next;
  }
  return { best, path, wins, p, states };
}

function main() {
  const show = process.argv.includes('--solutions');
  let failures = 0;
  let n = 0;
  let prev = null;
  console.log(' #  puzzle      moves  best    states    wins   random');
  for (const id of sequence) {
    const p = entities[id]?.puzzle;
    if (!p || !p.grid.length) continue;
    n++;
    const r = analyse(p.grid, p.taps);
    let status = '';
    if (r.best < 0) status = 'FAIL unsolvable within its moves';
    else if (r.best != p.taps && !SLACK[id]) status = `FAIL limit ${p.taps} but best is ${r.best}`;
    else if (ADDED.includes(id) && prev && r.p >= prev.p) status = `FAIL not harder than ${prev.id} before it`;
    if (status) failures++;
    const odds = r.p > 0 ? '1 in ' + Math.round(1 / r.p) : 'never';
    console.log(`${String(n).padStart(2)}  ${id.padEnd(10)} ${String(p.taps).padStart(5)} ${String(r.best).padStart(5)} ${String(r.states).padStart(9)} ${String(r.wins).padStart(7)}   ${odds} ${status}`);
    if (show) console.log('     taps (cell = row*6+col): ' + r.path.join(' '));
    prev = { id, p: r.p };
  }
  if (failures) {
    console.log(`\n${failures} puzzle(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${n} puzzles can be solved within their move limit.`);
}

main();
