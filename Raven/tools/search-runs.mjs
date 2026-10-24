/**
 * Finds a clearing run for Raven levels with the search bot and stores it in
 * runs.json, together with how much the search had to try.
 *
 *   node Raven/tools/search-runs.mjs 11,12,13 [--seeds 5] [--deaths 400] [--from 4]
 *
 * Each seed is a separate search; the shortest run found is kept (after it
 * has been replayed through the unmodified game code), and the deaths of
 * every seed are recorded as the level's search effort (null: no clear within
 * the budget). --from adds seeds to the ones already recorded.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { search, replay, encodeRun } from "./bot.mjs";

const file = new URL("./runs.json", import.meta.url);
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? +args[i + 1] : def; };
const list = args[0].split(",").map(Number);
const seeds = opt("--seeds", 5);
const from = opt("--from", 1);
const maxDeaths = opt("--deaths", 400);

for (const n of list) {
  const before = existsSync(file) ? JSON.parse(readFileSync(file, "utf8"))[n] : null;
  const efforts = from > 1 && before ? before.searchDeaths.slice(0, from - 1) : [];
  let kept = from > 1 && before ? { run: before.run, steps: before.steps, seed: before.seed } : null;
  for (let seed = from; seed <= seeds; seed++) {
    const t = Date.now();
    const r = search(n - 1, { seed, maxDeaths });
    const ok = r && replay(n - 1, r.run) > 0;
    efforts.push(ok ? r.deaths : null);
    console.log(`level ${n} seed ${seed}: ${ok ? `cleared in ${(r.steps / 60).toFixed(1)} s after ${r.deaths} deaths` : "not cleared"} (${((Date.now() - t) / 1000).toFixed(0)} s)`);
    if (ok && (!kept || r.steps < kept.steps)) kept = { run: encodeRun(r.run), steps: r.steps, seed };
  }
  const runs = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  if (kept) runs[n] = { ...kept, searchDeaths: efforts };
  else console.log(`level ${n}: no run found`);
  writeFileSync(file, JSON.stringify(runs, null, 1) + "\n");
}
