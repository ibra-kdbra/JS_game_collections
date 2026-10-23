/**
 * Searches for an input run that clears a level (Go-Explore over the real game code).
 *
 *   node Souls-Bumper/tools/explore.mjs <level> [--no-death] [--max-deaths N]
 *        [--no-rewind] [--from "<run>"] [--seconds S] [--seed N] [--quiet]
 *
 * Keeps an archive of "cells" (where the hero is, whether a soul is out and
 * where it lies, doors, checkpoint), each with the shortest input run found
 * that reaches it. Every iteration picks a cell, replays its run and then
 * presses random keys for a while; new or faster cells go into the archive.
 *
 * --no-death throws a rollout away as soon as the hero dies. A level that is
 * meant to need the soul should come back "not cleared" with this flag: that
 * is how tools/levels-report.mjs checks the new levels need their mechanic.
 *
 * --from starts every search from the end of that run (e.g. a soul already placed).
 * --no-rewind never presses [E] (the soul stays where the hero died).
 *
 * Prints the run as runs.json tokens when it clears the level.
 */
import { createGame, restart, parseRun, KEYS } from "./sim.mjs";

const ACTIONS = ["R", "R", "RJ", "RJ", "L", "LJ", "J", "_", "E", "RE", "LE"];

export function encode(steps) {
  const out = [];
  for (const s of steps) {
    const k = s || "_";
    const last = out[out.length - 1];
    if (last && last[0] == k) last[1]++;
    else out.push([k, 1]);
  }
  return out.map(([k, n]) => k + n).join(" ");
}

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function press(sim, held) {
  const keys = [];
  for (const k of held) if (KEYS[k]) keys[KEYS[k]] = true;
  sim.mg.keys = keys;
  sim.step();
}

function cellKey(sim, num, maxDeaths, deaths) {
  const h = sim.cart.hero;
  const lvl = sim.cart.levels[num];
  const soul = h.hereos.length ? h.hereos[h.hereos.length - 1] : null;
  const body = soul && soul.length ? soul[soul.length - 1] : null;
  const fallen = lvl.tiles.reduce((n, t) => n + (t.e.falls && t.e.fall ? 1 : 0), 0);
  return [
    Math.floor(h.e.x / 16), Math.floor(h.e.y / 16), h.active ? 1 : 0,
    body ? Math.floor(body.x / 32) + ":" + Math.floor(body.y / 32) : "-",
    lvl.opendoors ? 1 : 0, Math.min(fallen, 6),
    lvl.tiles.some((t) => t.e.type == 19 && !t.e.chk) ? 1 : 0,
    maxDeaths > 0 ? Math.min(deaths, maxDeaths) : 0,
  ].join(",");
}

/**
 * Returns { run, steps, iterations, cells } when cleared, or { run: null, iterations, cells }.
 */
export function explore(num, { from = "", noDeath = false, noRewind = false, maxDeaths = 0, seconds = 60, seed = 1, quiet = true, maxLen = 3000 } = {}) {
  const sim = createGame(num, 1, { fast: true });
  const random = rng(seed);
  const actions = noRewind ? ACTIONS.filter((a) => !a.includes("E")) : ACTIONS;
  const portal = sim.cart.levels[num].tiles.find((t) => t.e.type == 9).e;
  const archive = new Map();
  const add = (key, steps, dist) => {
    const c = archive.get(key);
    if (!c) archive.set(key, { prefix: steps.slice(), chosen: 0, dist });
    else if (steps.length < c.prefix.length) c.prefix = steps.slice();
  };
  // Start from a given run prefix (a hint such as "place the soul first"), or from the level start.
  const start = from ? parseRun(from).map((h) => (h == "_" ? "" : h)) : [];
  restart(sim, num);
  for (const held of start) press(sim, held);
  add(cellKey(sim, num, maxDeaths, 0), start, 1e9);
  const t0 = Date.now();
  let it = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    it++;
    // Pick a cell: rarely chosen and close to the portal first.
    const cells = [...archive.values()];
    let total = 0;
    const w = cells.map((c) => { const v = (1 / Math.sqrt(c.chosen + 1)) * (1 + 3 / (1 + c.dist / 160)); total += v; return v; });
    let r = random() * total, pick = cells[0];
    for (let i = 0; i < cells.length; i++) { r -= w[i]; if (r <= 0) { pick = cells[i]; break; } }
    pick.chosen++;

    restart(sim, num);
    const h = sim.cart.hero;
    const d0 = h.deaths;
    const levelDeaths = () => h.deaths - d0;
    for (const held of pick.prefix) press(sim, held);
    const steps = pick.prefix.slice();
    let alive = true;
    const moves = 1 + Math.floor(random() * 8);
    for (let m = 0; m < moves && alive; m++) {
      const a = actions[Math.floor(random() * actions.length)];
      const n = 2 + Math.floor(random() * 24);
      for (let s = 0; s < n; s++) {
        const before = h.deaths;
        press(sim, a == "_" ? "" : a);
        steps.push(a == "_" ? "" : a);
        if (sim.completed == num) {
          const run = encode(steps);
          if (!quiet) console.log(`cleared after ${it} iterations, ${archive.size} cells`);
          return { run, steps: steps.length, iterations: it, cells: archive.size };
        }
        if (h.deaths > before) {
          if (noDeath) { alive = false; break; }
          if (maxDeaths && levelDeaths() > maxDeaths) { alive = false; break; }
        }
        if (steps.length > maxLen) { alive = false; break; }
        const dist = Math.hypot(h.e.x - portal.x, h.e.y - portal.y);
        add(cellKey(sim, num, maxDeaths, levelDeaths()), steps, dist);
      }
    }
    if (!quiet && it % 500 == 0) console.log(`${it} iterations, ${archive.size} cells`);
  }
  return { run: null, iterations: it, cells: archive.size };

}

if (import.meta.url == `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const num = +args[0] - 1;
  const opt = { quiet: args.includes("--quiet") };
  const val = (f, d) => (args.includes(f) ? +args[args.indexOf(f) + 1] : d);
  opt.noDeath = args.includes("--no-death");
  opt.noRewind = args.includes("--no-rewind");
  if (args.includes("--from")) opt.from = args[args.indexOf("--from") + 1];
  opt.maxDeaths = val("--max-deaths", 0);
  opt.seconds = val("--seconds", 60);
  opt.seed = val("--seed", 1);
  const res = explore(num, opt);
  console.log(JSON.stringify(res));
}
