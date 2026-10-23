// Print a level map as text: node tools/map.mjs <level number, 1-based>
import { createGame } from "./sim.mjs";
const CH = { 0: ".", 1: "#", 2: "H", 3: "^", 4: "v", 5: "<", 6: ">", 7: "T", 8: "b", 9: "P", 10: "D",
  11: ":", 12: ":", 15: ":", 16: ":", 13: "*", 14: ",", 17: "F", 18: ".", 19: "C" };
const g = createGame(0);
for (const n of process.argv.slice(2)) {
  const lvl = g.LEVELS[n - 1];
  console.log(`Level ${n}: ${lvl.name}`);
  console.log("    " + [...Array(lvl.map[0].length).keys()].map((c) => c % 10).join(""));
  lvl.map.forEach((row, r) => console.log(String(r).padStart(3) + " " + row.slice(0, lvl.map[0].length).map((t) => CH[t] ?? "?").join("")));
}
