/**
 * Difficulty table for every level, measured with the real game code.
 *
 *   node Souls-Bumper/tools/levels-report.mjs [--seconds S] [--seeds N] [--levels 3,7]
 *
 * Slow (each search runs for S seconds, four at a time), so it is not part of
 * verify-levels.mjs. For each level:
 *   run s, deaths, E   the recorded run in runs.json: its length, how often it
 *                      dies (the soul is made by dying) and how many steps it
 *                      holds [E] (rewinding the soul).
 *   no death           a search that may not die (explore.mjs --no-death).
 *   no [E]             a search that never rewinds (explore.mjs --no-rewind).
 *                      "-" = not cleared within S seconds; "cleared" = it was.
 *   search             iterations the free search needed to clear the level,
 *                      median over N seeds ("> n" when it ran out of time).
 *                      More iterations: the way through is harder to find.
 *
 * Levels that declare `needs: ["soul", "rewind"]` in js/levels.js must come
 * back "-" in the matching column; otherwise the script exits with code 1.
 */
import { readFileSync } from "node:fs";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { cpus } from "node:os";
import { explore } from "./explore.mjs";
import { play, parseRun, createGame } from "./sim.mjs";

if (!isMainThread) {
  parentPort.postMessage(explore(workerData.num, workerData));
} else {
  const args = process.argv.slice(2);
  const val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
  const seconds = +val("--seconds", 120);
  const seeds = +val("--seeds", 2);
  const runs = JSON.parse(readFileSync(new URL("./runs.json", import.meta.url), "utf8"));
  const game = createGame(0);
  const count = game.LEVELS.length - 1;
  const only = val("--levels", null);
  const levels = only ? only.split(",").map(Number) : [...Array(count).keys()].map((i) => i + 1);

  const jobs = [];
  for (const n of levels) {
    jobs.push({ n, kind: "nodeath", data: { num: n - 1, noDeath: true, seconds, seed: 1 } });
    jobs.push({ n, kind: "norewind", data: { num: n - 1, noRewind: true, seconds, seed: 1 } });
    for (let s = 1; s <= seeds; s++) jobs.push({ n, kind: "free", data: { num: n - 1, seconds, seed: s } });
  }
  const results = {};
  let next = 0;
  const workers = Math.max(1, Math.min(cpus().length, jobs.length));
  await Promise.all([...Array(workers)].map(async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const res = await new Promise((resolve, reject) => {
        const w = new Worker(new URL(import.meta.url), { workerData: job.data });
        w.once("message", resolve);
        w.once("error", reject);
      });
      const r = (results[job.n] ??= { free: [] });
      if (job.kind == "free") r.free.push(res);
      else r[job.kind] = res;
    }
  }));

  let failures = 0;
  console.log("  # name             run s  deaths    E  no death  no [E]    search (median iterations)");
  for (const n of levels) {
    let deaths = 0;
    const steps = play(n - 1, runs[n], { onStep: (s) => { deaths = s.cart.hero.deaths; } });
    const eSteps = parseRun(runs[n]).filter((k) => k.includes("E")).length;
    const r = results[n];
    const col = (x) => (x.run ? "cleared" : "-");
    const its = r.free.map((f) => (f.run ? f.iterations : Infinity)).sort((a, b) => a - b);
    const med = its[Math.floor(its.length / 2)];
    const search = med == Infinity ? `> ${Math.max(...r.free.map((f) => f.iterations))}` : String(med);
    const needs = game.LEVELS[n - 1].needs || [];
    const bad = [];
    if (needs.includes("soul") && r.nodeath.run) bad.push("cleared without dying");
    if (needs.includes("rewind") && r.norewind.run) bad.push("cleared without [E]");
    if (bad.length) failures++;
    console.log(`${String(n).padStart(3)} ${game.LEVELS[n - 1].name.padEnd(16)} ${(steps * 0.02).toFixed(1).padStart(5)} ${String(deaths).padStart(7)} ${String(eSteps).padStart(4)}  ${col(r.nodeath).padEnd(8)}  ${col(r.norewind).padEnd(8)}  ${search.padStart(6)}  [${its.map((x) => (x == Infinity ? "x" : x)).join(" ")}]` +
      (needs.length ? `  needs ${needs.join("+")}` : "") + (bad.length ? `  FAIL ${bad.join(", ")}` : ""));
  }
  if (failures) {
    console.log(`\n${failures} level(s) can be cleared without the mechanic they are meant to need`);
    process.exit(1);
  }
}
