/**
 * Proves every ReWire level can be solved and prints how hard each one is.
 *
 *   node ReWire/tools/verify-levels.mjs           # table + checks, exit 1 on a problem
 *   node ReWire/tools/verify-levels.mjs --routes  # also print one solution per level
 *
 * The solver (solver.mjs) enumerates every finished cable the game accepts,
 * using the game's own geometry code. One of those cables is then played in
 * the real game code (sim.mjs): the cable end is dragged with pointer events
 * along the route, one fixed update per move, and the level must report done.
 *
 * Columns:
 *   spools/iso/blocks  pieces on the board
 *   routes    distinct winning cables (order of wraps and the side of each)
 *   nodes     partial cables the exhaustive search has to try (no dead
 *             wrap, no crossing, no touching a block)
 *   bits      log2(nodes / routes): how much searching one solution costs.
 *             This is the difficulty score; every level after the original
 *             sixteen must score above all of them, rising level by level.
 *   start     opening moves that still lead to a win / opening moves possible
 *   gap       closest pass (px) of the roomiest winning cable to a piece
 */
import { createContext } from "./sim.mjs";
import { solve } from "./solver.mjs";
import { routePath, playPath } from "./replay.mjs";

const ORIGINAL = 16; // levels 1-16 are the original game; 17+ were added later
const showRoutes = process.argv.includes("--routes");

const ctx = createContext();
const levels = ctx.gameData.levels;
const rows = [];
let failures = 0;

for (let i = 0; i < levels.length; i++) {
  const lv = levels[i];
  const t = Date.now();
  const { stats, solutions } = solve(ctx, lv);
  const row = {
    n: i + 1, kind: i < ORIGINAL ? "orig" : "new",
    spools: lv.spools.length, iso: lv.isolators.length, blocks: lv.blocks.length,
    routes: stats.solutions, nodes: stats.nodes,
    bits: stats.solutions ? Math.log2(stats.nodes / stats.solutions) : Infinity,
    start: `${stats.firstGood}/${stats.firstMoves}`,
    gap: solutions.reduce((m, s) => Math.max(m, s.clearance), -Infinity),
    played: false, ms: 0,
  };
  // play the roomiest routes until one clears in the real game
  const tries = [...solutions].sort((a, b) => b.clearance - a.clearance).slice(0, 20);
  for (const s of tries) {
    for (const margin of [14, 12, 18, 11, 24]) {
      let pts;
      try { pts = routePath(ctx, lv, s.route, { margin }); } catch { continue; }
      if (playPath(lv, pts).completed) { row.played = true; row.route = s.route; break; }
    }
    if (row.played) break;
  }
  row.ms = Date.now() - t;
  if (!row.played) failures++;
  rows.push(row);
}

const pad = (v, n) => String(v).padStart(n);
console.log(" lvl kind  spools iso blocks  routes    nodes   bits  start    gap  check");
for (const r of rows) {
  console.log(`${pad(r.n, 4)} ${r.kind.padEnd(5)} ${pad(r.spools, 6)} ${pad(r.iso, 3)} ${pad(r.blocks, 6)} ${pad(r.routes, 7)} ${pad(r.nodes, 8)} ${pad(r.bits.toFixed(1), 6)} ${pad(r.start, 6)} ${pad(r.gap.toFixed(1), 6)}  ${r.played ? "ok" : "FAIL no route played to the end"}`);
  if (showRoutes && r.route) {
    const names = (k) => (k < levels[r.n - 1].spools.length ? "s" + k : "i" + (k - levels[r.n - 1].spools.length));
    console.log("      route: " + r.route.map((s) => names(s.node) + (s.side < 0 ? "L" : "R")).join(" "));
  }
}

// Difficulty order: every added level beats the hardest original, and they ramp up.
const hardestOriginal = Math.max(...rows.slice(0, ORIGINAL).map((r) => r.bits));
const added = rows.slice(ORIGINAL);
added.forEach((r, k) => {
  if (!(r.bits > hardestOriginal)) {
    console.log(`FAIL level ${r.n} scores ${r.bits.toFixed(1)} bits, not above the hardest original (${hardestOriginal.toFixed(1)})`);
    failures++;
  }
  if (k > 0 && !(r.bits > added[k - 1].bits)) {
    console.log(`FAIL level ${r.n} scores ${r.bits.toFixed(1)} bits, not above level ${r.n - 1} (${added[k - 1].bits.toFixed(1)})`);
    failures++;
  }
});

console.log(failures ? `\n${failures} problem(s)` : `\nall ${rows.length} levels solved and played; added levels ${ORIGINAL + 1}-${rows.length} ramp from ${added.length ? added[0].bits.toFixed(1) : "-"} to ${added.length ? added[added.length - 1].bits.toFixed(1) : "-"} bits (hardest original ${hardestOriginal.toFixed(1)})`);
process.exit(failures ? 1 : 0);
