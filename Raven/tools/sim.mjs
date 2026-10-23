// Headless Raven: runs the real game logic (Game, Player, Enemy, Camera,
// Terminal, Door, Util, LevelCache) in a Node VM with drawing, audio and the
// browser stubbed out. Time is a fixed 1/60 s step, so a run is deterministic.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["Util", "Player", "Enemy", "Camera", "Terminal", "Door", "Game", "LevelCache"];
const source = FILES.map((f) => readFileSync(join(root, "js", f + ".js"), "utf8")).join("\n;\n") +
  "\n;globalThis.__R = { Game, Util, LevelCache };\n";
const script = new vm.Script(source, { filename: "raven.js" });

export const DT = 1 / 60;

// Whole-pixel crosshair offset 150 px out at `deg` degrees.
export const aimVector = (deg) => [Math.round(Math.cos(deg * Math.PI / 180) * 150), Math.round(Math.sin(deg * Math.PI / 180) * 150)];
const noop = () => {};
const ctx2d = new Proxy({}, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });

export function createContext() {
  const clock = { ms: 1000 };
  const sandbox = {
    console, Math,
    performance: { now: () => clock.ms },
    document: { addEventListener: noop, getElementById: () => ({ getContext: () => ctx2d }) },
    Asset: { drawSprite: noop, drawSprite2: noop, getFontString: () => "" },
    Intro: class { constructor() { this.state = "dead"; } update() {} },
    GameKit: { readBests: () => ({}), recordBest: () => ({ isNew: true, best: 0 }) },
  };
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  sandbox.__clock = clock;
  return sandbox;
}

export function levelCount() {
  return createContext().__R.LevelCache.length;
}

// Game._buildAttackGrid relaxes costs with a FIFO queue until nothing improves,
// which ends at the cheapest cost per tile. This computes the same costs with
// Dijkstra (all costs are integers, so the grids are identical) and is much
// faster; `checkFastGrid` compares the two on every step.
export function fastAttackGrid(game, Util) {
  const W = game.level.width;
  const target = { x: game.player.x - Util.cos(game.facing) * 34, y: game.player.y - Util.sin(game.facing) * 34 };
  const pu = Math.floor(target.x / 32), pv = Math.floor(target.y / 32);
  const grid = [];
  const done = new Set();
  const heap = [[2, pu, pv]];
  const push = (c, u, v) => {
    let i = heap.length;
    heap.push([c, u, v]);
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const penalty = (u, v) => (!(u === pu && v === pv) && Util.pointSpottedXY(u * 32 + 16, v * 32 + 16) ? 10000 : 0);
  if (Util.wallAtUV(pu, pv)) { grid[pv * W + pu] = 50000; heap.length = 0; }
  while (heap.length) {
    const [c, u, v] = pop();
    const k = v * W + u;
    if (done.has(k)) continue;
    done.add(k);
    grid[k] = c;
    for (const [nu, nv] of [[u - 1, v], [u + 1, v], [u, v - 1], [u, v + 1]]) {
      const nk = nv * W + nu;
      if (Util.wallAtUV(nu, nv)) { grid[nk] = 50000; continue; }
      if (!done.has(nk)) push(c + 32 + penalty(nu, nv), nu, nv);
    }
  }
  game.attackGrid = grid;
}

// A game on level `index` (0-based), past any intro text, ready to play.
// `view` is the logical view size (desktop 1280x800; phones are zoomed out).
// `fast` swaps in the equivalent Dijkstra attack grid (see above).
export function createLevel(index, { view = { w: 1280, h: 800 }, makeContext = createContext, ctx = makeContext(), fast = false, checkFastGrid = false } = {}) {
  const { Game, Util } = ctx.__R;
  const game = new Game();
  ctx.game = game;
  game._renderTileNoise = noop; // drawing only
  if (fast) game._buildAttackGrid = () => fastAttackGrid(game, Util);
  if (checkFastGrid) {
    const real = Game.prototype._buildAttackGrid;
    game._buildAttackGrid = () => {
      fastAttackGrid(game, Util);
      const fastGrid = game.attackGrid;
      real.call(game);
      const n = Math.max(fastGrid.length, game.attackGrid.length);
      for (let i = 0; i < n; i++) if (fastGrid[i] !== game.attackGrid[i]) throw new Error(`attack grid differs at ${i}: ${fastGrid[i]} vs ${game.attackGrid[i]}`);
    };
  }
  Object.assign(game, {
    canvas: {}, ctx: ctx2d, _losCtx: ctx2d, _tileCanvas: {}, _tileCtx: ctx2d,
    input: {}, audio: { update: noop, playSiren: noop, playTri: noop, playBloop: noop, playClick: noop },
    touch: { active: false, render: noop }, store: { get: (k, d) => d, set: noop },
    crosshair: { x: 0, y: 0 }, mouse: { x: 0, y: 0 },
    tileVisibilityInset: 4, lockCrosshairToMap: false, facing: 0, fov: 120,
    paused: false, framems: ctx.__clock.ms, enemies: [],
    viewW: view.w, viewH: view.h, zoom: 1,
  });
  const clock = ctx.__clock;
  // As in the page: picking a level from the menu sets the pending index, and
  // the next update loads the level and runs its first step with no input.
  game._pendingLevelIndex = index;
  clock.ms += DT * 1000;
  game.framems = clock.ms;
  game.update(DT);
  return {
    game, ctx,
    // keys: { up, down, left, right }; aim: [dx, dy] crosshair offset in view
    // pixels, or an angle in degrees (or undefined to keep it where it is);
    // use: press the terminal key this step.
    step({ keys = {}, aim, use } = {}) {
      clock.ms += DT * 1000;
      game.framems = clock.ms;
      game.input.up = keys.up || undefined;
      game.input.down = keys.down || undefined;
      game.input.left = keys.left || undefined;
      game.input.right = keys.right || undefined;
      if (aim !== undefined) {
        // the crosshair sits at this offset from the player, as a mouse
        // pointer that far from the middle of the view puts it
        const [ax, ay] = typeof aim === "number" ? aimVector(aim) : aim;
        game.crosshair.x = game.player.x + ax;
        game.crosshair.y = game.player.y + ay;
      }
      if (use) game.onToggle();
      game.update(DT);
    },
    get dead() { return game.player.dead; },
    get cleared() { return !!game.levelComplete; },
    snapshot: () => snapshot(game, clock),
    restore: (s) => restore(game, clock, s),
  };
}

// Copies of every moving part of a running level, so a search can rewind.
const copy = (o) => Object.assign(Object.create(Object.getPrototypeOf(o)), o);
function cloneParts(src) {
  const cameras = src.cameras.map(copy);
  const terminals = src.terminals.map((t) => Object.assign(copy(t), { cameras: t.cameras.map((c) => cameras[src.cameras.indexOf(c)]) }));
  const enemies = src.enemies.map((e) => {
    const c = copy(e);
    c._eyeQueue = e._eyeQueue.slice();
    if (e._patrol) c._patrol = Object.assign(e._patrol.slice(), { next: e._patrol.next, after: e._patrol.after });
    return c;
  });
  return {
    player: copy(src.player), enemies, cameras, terminals, doors: src.doors.map(copy),
    _activeTerminal: src._activeTerminal && terminals[src.terminals.indexOf(src._activeTerminal)],
    crosshair: { ...src.crosshair }, input: { ...src.input },
    levelComplete: src.levelComplete, levelCompleteMs: src.levelCompleteMs, levelTime: src.levelTime,
    facing: src.facing, framems: src.framems, deathFrame: src.deathFrame, offset: src.offset && { ...src.offset },
    vision: src.vision, attackGrid: src.attackGrid,
  };
}
function snapshot(game, clock) {
  return { parts: cloneParts(game), ms: clock.ms };
}
function restore(game, clock, s) {
  Object.assign(game, cloneParts(s.parts));
  clock.ms = s.ms;
}
