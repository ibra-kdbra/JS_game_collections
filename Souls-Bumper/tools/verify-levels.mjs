/**
 * Proves every level can be cleared with the real game code.
 *
 *   node Souls-Bumper/tools/verify-levels.mjs
 *
 * Each level has a recorded input run in runs.json. The run is replayed in a
 * fresh game (with a few seeds, which only change decoration and particles)
 * and must reach the portal. Then all runs are played back to back in one
 * game from level 1, so a level plays the same however you got there.
 *
 * A run is a list of "<keys><steps>" tokens, one step being 20 ms:
 * L/R move, J jump, E rewind the soul, X reset the level, _ nothing.
 */
import { readFileSync } from "node:fs";
import { createGame, play, parseRun, KEYS } from "./sim.mjs";

const runs = JSON.parse(readFileSync(new URL("./runs.json", import.meta.url), "utf8"));
const SEEDS = [1, 2, 3];
let failures = 0;

const game = createGame(0);
const count = game.LEVELS.length - 1; // the last room is the "thank you" screen

for (let n = 1; n <= count; n++) {
  const name = game.LEVELS[n - 1].name;
  const run = runs[n];
  if (!run) {
    console.log(`FAIL ${String(n).padStart(2)} ${name.padEnd(16)} no recorded run`);
    failures++;
    continue;
  }
  const results = SEEDS.map((seed) => play(n - 1, run, { seed }));
  const ok = results.every((r) => r > 0);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${String(n).padStart(2)} ${name.padEnd(16)} ${ok ? "cleared in " + (results[0] * 0.02).toFixed(2) + " s" : "seeds " + results.join(",")}`);
}

// One game, every run in order, as a player going straight through would.
{
  const sim = createGame(0, 7);
  let level = 0;
  let steps = parseRun(runs[1] || "_1");
  let i = 0;
  let total = 0;
  while (level < count && total < 100000) {
    const held = steps[i++] || "";
    const keys = [];
    for (const k of held) if (KEYS[k]) keys[KEYS[k]] = true;
    sim.mg.keys = keys;
    if (held.includes("X")) sim.reload = true;
    sim.step();
    total++;
    if (sim.completed == level) {
      level++;
      steps = parseRun(runs[level + 1] || "_1");
      i = 0;
    } else if (i > steps.length + 200) {
      break;
    }
  }
  const ok = level == count;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} full run from level 1: ${ok ? "reached the end in " + (total * 0.02).toFixed(1) + " s" : "stuck on level " + (level + 1)}`);
}

if (failures) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${count} levels can be cleared.`);
