// Headless ReWire: runs the real game scripts in a Node VM with the browser
// stubbed out. A level can be played by sending pointer events and stepping
// the fixed 1/60 s update, exactly as the page does.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same order as index.html, minus rendering, audio, menus and resources.
const FILES = ["types", "math-util", "vector", "space", "input", "mouse-drag-system", "spool-system", "game", "level"];

// Top-level `const` becomes `var` so the harness can reach (and wrap) the game's functions.
const source = FILES.map((f) => readFileSync(join(root, "js", f + ".js"), "utf8"))
  .join("\n;\n")
  .replace(/^const (\w+) =/gm, "var $1 =");
const script = new vm.Script(source, { filename: "rewire.js" });

const noop = () => {};

export function createContext() {
  const listeners = {};
  const element = () => ({ style: {}, innerHTML: "", getContext: () => ({}) });
  const sandbox = {
    console, Math,
    document: {
      body: element(),
      addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
      removeEventListener: (t, f) => { listeners[t] = (listeners[t] || []).filter((g) => g !== f); },
    },
    nodeInfo: element(),
    playSound: noop, Sounds: {},
    stageWidth: 1280, stageHeight: 720, stageRotated: false,
    createGameBackground: noop, fitStageCanvas: noop,
    createStageCanvas: () => [{ getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, width: 1280, height: 720 }) }, {}],
    createSpoolRenderSystem: () => ({ addEntity: noop, render: noop }),
    createCableRenderSystem: () => ({ addEntity: noop, render: noop }),
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  sandbox.__listeners = listeners;
  return sandbox;
}

// A level running in the real game code. pointer(type, x, y) sends a pointer
// event in stage coordinates; step() runs one fixed update.
export function createLevel(levelData, ctx = createContext()) {
  let update = null;
  let space = null;
  let completed = false;
  const realSpace = ctx.createSpace;
  ctx.createSpace = () => (space = realSpace());
  ctx.startFrameLoop = (u) => { update = u; return noop; };
  const game = ctx.createGame();
  game.createLevel(levelData, null, () => { completed = true; });
  ctx.createSpace = realSpace;
  const cable = space.entities.find((e) => e.cable);
  let time = 0;
  const target = { closest: () => null };
  return {
    ctx,
    get completed() { return completed; },
    get attachments() { return cable.cable.attachments; },
    entities: space.entities,
    pointer(type, x, y, pointerType = "mouse") {
      const e = { pointerId: 1, pointerType, clientX: x, clientY: y, target, preventDefault: noop };
      for (const f of ctx.__listeners["pointer" + type] || []) f(e);
    },
    step() {
      if (completed) return;
      time += 1 / 60;
      update(time);
    },
  };
}

export function levels() {
  return createContext().gameData.levels;
}
