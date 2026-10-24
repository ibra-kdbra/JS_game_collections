/**
 * Proves every Raven level can be cleared and prints how hard each one is.
 *
 *   node Raven/tools/verify-levels.mjs           # CI check: exit 1 on any problem
 *
 * Each level has a recorded input run in runs.json (found by search-runs.mjs).
 * The run is replayed in the real game logic (sim.mjs, unmodified attack grid)
 * and must reach the exit without dying. While it plays, the checker measures
 * how much danger the run had to get through.
 *
 * Columns:
 *   raven       Raven on the level (los: wake on sight, pat: patrolling)
 *   term/cam    terminals to use, cameras they switch on
 *   route       shortest walk enter -> every terminal -> exit, in tiles
 *   clear       length of the recorded clear, seconds
 *   awake       most Raven awake at once and not held by a camera
 *   press       pressure: Raven-seconds of awake Raven not held by a camera,
 *               summed over the run (the run kept is the shortest one found)
 *   rush        seconds during which at least one Raven was charging
 *   close       nearest a charging Raven came, px (14 kills)
 *   search      deaths the search bot needed per seed before it found a clear
 *               (x: none within the budget); luck plays a big part here
 *   score       difficulty: pressure + 10 x awake. Levels after the original
 *               ten must score above every original and rise in order.
 */
import { readFileSync } from "node:fs";
import { createLevel, levelCount } from "./sim.mjs";
import { decodeRun } from "./bot.mjs";

const ORIGINAL = 10; // levels 1-10 are the original game; 11+ were added later
const runs = JSON.parse(readFileSync(new URL("./runs.json", import.meta.url), "utf8"));
let failures = 0;
const rows = [];

function routeLength(game) {
  const L = game.level, W = L.width;
  const bfs = (from) => {
    const d = new Array(W * L.height).fill(Infinity);
    const q = [from];
    d[from] = 0;
    for (let i = 0; i < q.length; i++) {
      const k = q[i];
      for (const n of [k - 1, k + 1, k - W, k + W]) {
        if (L.data[n] === 2 && d[n] === Infinity) { d[n] = d[k] + 1; q.push(n); }
      }
    }
    return d;
  };
  const tile = (x, y) => Math.floor(y / 32) * W + Math.floor(x / 32);
  const e = L.enter, x = L.exit;
  const start = tile((e.p1.x + e.p2.x) / 2, (e.p1.y + e.p2.y) / 2);
  const end = tile((x.p1.x + x.p2.x) / 2, (x.p1.y + x.p2.y) / 2);
  const stops = game.terminals.map((t) => tile(t.x, t.y));
  const dist = new Map([start, ...stops].map((s) => [s, bfs(s)]));
  let best = Infinity;
  const perm = (at, left, sum) => {
    if (!left.length) { best = Math.min(best, sum + dist.get(at)[end]); return; }
    left.forEach((s, i) => perm(s, left.filter((_, j) => j !== i), sum + dist.get(at)[s]));
  };
  perm(start, stops, 0);
  return best;
}

for (let n = 1; n <= levelCount(); n++) {
  const lv = createLevel(n - 1);
  const { game } = lv;
  const row = {
    n, kind: n <= ORIGINAL ? "orig" : "new", name: game.level.name,
    raven: game.enemies.length,
    los: game.enemies.filter((e) => e.wake === "los").length,
    pat: game.enemies.filter((e) => e._patrol).length,
    term: game.terminals.length, cam: game.cameras.length,
    route: routeLength(game),
  };
  const rec = runs[n];
  if (!rec) {
    console.log(`FAIL level ${n}: no recorded run`);
    failures++;
    rows.push(row);
    continue;
  }
  const run = decodeRun(rec.run);
  let awake = 0, rush = 0, close = Infinity, cleared = 0, pressure = 0;
  for (let i = 0; i < run.length && !cleared; i++) {
    lv.step(run[i]);
    const vis = game.vision.slice(0, -1); // everything but the player's own cone
    const held = (e) => vis.some((poly) => pointIn(e, poly, lv));
    const loose = game.enemies.filter((e) => e.state !== "asleep" && !held(e)).length;
    awake = Math.max(awake, loose);
    pressure += loose;
    const charging = game.enemies.filter((e) => e.state === "attack");
    if (charging.length) rush++;
    for (const e of charging) close = Math.min(close, Math.hypot(e.x - game.player.x, e.y - game.player.y));
    if (lv.dead) break;
    if (lv.cleared) cleared = i + 1;
  }
  Object.assign(row, {
    cleared, clear: cleared / 60, awake, rush: rush / 60, close, pressure: pressure / 60,
    search: rec.searchDeaths || [],
  });
  row.score = row.pressure + 10 * awake;
  if (!cleared) { console.log(`FAIL level ${n}: the recorded run does not clear it`); failures++; }
  rows.push(row);
}

function pointIn(e, poly, lv) {
  const Util = lv.ctx.__R.Util;
  const dx = e.width / 2, dy = e.height / 2;
  return [[0, 0], [-dx, -dy], [dx, dy], [-dx, dy], [dx, -dy]].some(([ox, oy]) => Util.pointInPolygon({ x: e.x + ox, y: e.y + oy }, poly));
}

const pad = (v, k) => String(v).padStart(k);
console.log(" lvl kind  name                       raven los pat term cam route  clear awake press  rush close  search            score");
for (const r of rows) {
  if (r.cleared === undefined) continue;
  console.log(`${pad(r.n, 4)} ${r.kind.padEnd(5)} ${r.name.padEnd(26)} ${pad(r.raven, 5)} ${pad(r.los, 3)} ${pad(r.pat, 3)} ${pad(r.term, 4)} ${pad(r.cam, 3)} ${pad(r.route, 5)} ${pad(r.clear.toFixed(1), 6)} ${pad(r.awake, 5)} ${pad(r.pressure.toFixed(0), 5)} ${pad(r.rush.toFixed(1), 5)} ${pad(isFinite(r.close) ? r.close.toFixed(0) : "-", 5)}  ${r.search.map((d) => (d === null ? "x" : d)).join(",").padEnd(16)} ${pad(r.score.toFixed(0), 5)}` + (r.cleared ? "" : "  FAIL"));
}

const hardestOriginal = Math.max(...rows.slice(0, ORIGINAL).map((r) => r.score ?? 0));
const added = rows.slice(ORIGINAL);
added.forEach((r, k) => {
  if (!(r.score > hardestOriginal)) { console.log(`FAIL level ${r.n} scores ${r.score?.toFixed(0)}, not above the hardest original (${hardestOriginal.toFixed(0)})`); failures++; }
  if (k > 0 && !(r.score > added[k - 1].score)) { console.log(`FAIL level ${r.n} scores ${r.score?.toFixed(0)}, not above level ${r.n - 1} (${(added[k - 1].score ?? 0).toFixed(0)})`); failures++; }
});
console.log(failures ? `\n${failures} problem(s)` : `\nall ${rows.length} levels cleared by their recorded runs; added levels ${ORIGINAL + 1}-${rows.length} score ${added.map((r) => (r.score ?? 0).toFixed(0)).join(", ")} (hardest original ${hardestOriginal.toFixed(0)})`);
process.exit(failures ? 1 : 0);
