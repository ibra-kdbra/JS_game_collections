// Headless Souls Bumper: runs the real game scripts in a Node VM with the
// browser stubbed out, so an input run can be replayed step by step.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same order as index.html. The song generator is replaced: it only makes music.
const FILES = ["camera", "particle", "keys", "sound", "entity", "hero", "enums",
  "tile", "utility", "level", "levels", "cart", "game"];

// Key codes used by an input run: L R J (jump) E (rewind soul) X (reset level).
export const KEYS = { L: 37, R: 39, J: 32, E: 69 };

const noop = () => {};
const ctx2d = {};
for (const k of ["arc", "beginPath", "clearRect", "clip", "drawImage", "fill", "fillRect", "fillText", "rect",
  "restore", "rotate", "save", "scale", "setTransform", "strokeRect", "translate"]) ctx2d[k] = noop;
const element = () => ({
  style: {}, classList: { add: noop, toggle: noop, remove: noop }, addEventListener: noop,
  setAttribute: noop, append: noop, prepend: noop, getContext: () => ctx2d, textContent: "", innerText: "",
});

const source = FILES.map((f) => readFileSync(join(root, "js", f + ".js"), "utf8").replace(/^'use strict';/, ""))
  .join("\n;\n") + `
;
var audio = null, songLoaded = true;
function genAudio() {}
playSound = function() {};
globalThis.__sim = {
  mg, cart, LEVELS,
  start: startGame,
  startLevel,
  step: updateGameArea,
  get completed() { return completed; }, set completed(v) { completed = v; },
  get reload() { return RELOAD; }, set reload(v) { RELOAD = v; },
  // Searches only: particles are decoration, skipping them makes a step about twice as fast.
  noParticles() { particle = function() { this.remove = true; this.update = function() {}; }; },
};
var completed = -1;
const __onLevelComplete = onLevelComplete;
onLevelComplete = function(i) { completed = i; __onLevelComplete(i); };
`;
const script = new vm.Script("'use strict';\n" + source.replace("'use strict';", ""), { filename: "souls-bumper.js" });

function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A fresh game, started on level `num` (0-based). `fast` drops the particles (for searches).
export function createGame(num, seed = 1, { fast = false } = {}) {
  const math = Object.create(Math);
  math.random = seeded(seed);
  const doc = { createElement: element, getElementById: element, querySelectorAll: () => [], addEventListener: noop, hidden: false, body: element() };
  const sandbox = {
    Math: math, console, document: doc,
    window: { innerWidth: 800, innerHeight: 660, devicePixelRatio: 1, addEventListener: noop },
    Image: function() {}, AudioContext: function() { return { state: "running", resume: noop }; },
    GameKit: {
      createStore: () => ({ get: (k, d) => d, set: noop }),
      initShell: noop, isTouchFirst: () => false, recordBest: () => ({ isNew: false }),
      createTouchControls: () => ({ hide: noop, show: noop, el: { hidden: true } }),
      createLoop: () => ({ start: noop }),
    },
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  const sim = sandbox.__sim;
  if (fast) sim.noParticles();
  sim.start();
  sim.startLevel(num);
  return sim;
}

// Start `sim` on level `num` again, as picking it from the level select would.
export function restart(sim, num) {
  sim.completed = -1;
  sim.reload = false;
  sim.startLevel(num);
}

// Parse "R30 RJ12 E40 X1" into per-step key sets: letters held for N steps.
export function parseRun(run) {
  const steps = [];
  for (const tok of run.trim().split(/\s+/)) {
    const m = /^([LRJEX_]+)(\d+)$/.exec(tok);
    if (!m) throw new Error("bad token " + tok);
    for (let i = 0; i < +m[2]; i++) steps.push(m[1]);
  }
  return steps;
}

// Replay a run on level `num`. Returns the step the level was cleared on, or -1.
// Pass `sim` to reuse a game (restarted on the level) instead of building a fresh one.
export function play(num, run, { seed = 1, extra = 200, onStep, sim } = {}) {
  if (sim) restart(sim, num);
  else sim = createGame(num, seed);
  const steps = Array.isArray(run) ? run : parseRun(run);
  for (let i = 0; i < steps.length + extra; i++) {
    const held = steps[i] || "";
    const keys = [];
    for (const k of held) if (KEYS[k]) keys[KEYS[k]] = true;
    sim.mg.keys = keys;
    if (held.includes("X")) sim.reload = true;
    sim.step();
    if (onStep) onStep(sim, i);
    if (sim.completed == num) return i + 1;
  }
  return -1;
}
