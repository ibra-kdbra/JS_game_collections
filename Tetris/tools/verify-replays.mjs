#!/usr/bin/env node
/**
 * Replays must reproduce the live game exactly.
 *
 * For every scenario below this plays a game live in the real game page, then
 * watches its replay and checks that the replay ends on the same step with the
 * same stack, lines, pieces, score and hold piece.
 *
 * The live game is played by a small bot that reads `piece` and `stack` and
 * presses keys (keydown/keyup events), mixed with a seeded stream of extra input:
 * arrows held across piece spawns and holds (so the DAS charge carries over),
 * one-step taps, keys pressed and released during the countdown, the on-screen
 * buttons, touch gestures and pauses. The scenarios cover the DAS/ARR and drop
 * settings and every mode, Survival (rising garbage, uses the rng) and Master
 * (20G) included. Some change the settings, or pause, while the replay plays.
 *
 * The game's real-time loop is switched off while a scenario runs and the test
 * advances the game one logic step at a time, drawing a frame every few steps
 * (a different rhythm live and in the replay), so a run takes seconds and never
 * depends on the machine's speed.
 *
 * Usage: node Tetris/tools/verify-replays.mjs [--verbose]
 *
 * Environment:
 *   PLAYWRIGHT_MODULE   path to the playwright package when it isn't resolvable from here
 *   CHROMIUM_PATH       Chromium executable to use instead of Playwright's own download
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const verbose = process.argv.includes('--verbose');

// ---------------------------------------------------------------- scenarios

/** Small seeded PRNG (mulberry32), so every run plays the same games. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Extra input on top of the bot's, keyed by logic step (counted from init,
 * paused steps included). Event kinds:
 *   ['kd', code] / ['ku', code]   keyboard down / up
 *   ['pd', flag] / ['pu', flag]   on-screen button down / up (by flag name)
 *   ['touch', acts]               queued touch gestures (see Touch.apply)
 *   ['pause'] / ['unpause']
 */
function makeScript(seed, { steps, touch = false, pad = false, pauses = false }) {
  const rand = prng(seed);
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const events = new Map();
  const at = (step, ev) => {
    if (!events.has(step)) events.set(step, []);
    events.get(step).push(ev);
  };
  // A key press: down before step `start`, up `len` steps later (len 0 is a
  // tap that goes down and up between the same two steps).
  const press = (start, code, len) => {
    at(start, ['kd', code]);
    at(start + len, ['ku', code]);
  };

  // During the countdown (GO is at step 99): taps of every kind, and keys
  // held past GO.
  press(30, pick(['KeyC', 'KeyX', 'KeyZ']), 0);
  press(40 + Math.floor(rand() * 20), pick(['KeyC', 'ArrowDown', 'ShiftLeft']), pick([0, 1, 5]));
  press(60 + Math.floor(rand() * 20), pick(['ArrowLeft', 'ArrowRight']), pick([0, 2, 12]));
  press(85 + Math.floor(rand() * 10), pick(['ArrowLeft', 'ArrowRight', 'KeyX', 'KeyC']), pick([0, 8, 30]));

  let t = 110;
  while (t < steps) {
    const r = rand();
    if (r < 0.25) {
      // An arrow held for a while: the bot drops, holds and rotates meanwhile.
      press(t, pick(['ArrowLeft', 'ArrowRight']), 10 + Math.floor(rand() * 90));
      t += 60 + Math.floor(rand() * 200);
    } else if (r < 0.4) {
      press(t, pick(['KeyC', 'KeyX', 'KeyZ', 'ShiftLeft', 'ArrowDown']), pick([0, 1, 3]));
      t += 40 + Math.floor(rand() * 150);
    } else if (r < 0.6 && touch) {
      let acts = '';
      const n = 1 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) acts += pick(['L', 'R', 'L', 'R', 'D', 'C', 'W', 'O', 'H']);
      at(t, ['touch', acts]);
      t += 20 + Math.floor(rand() * 100);
    } else if (r < 0.8 && pad) {
      const flag = pick(['moveLeft', 'moveRight', 'moveLeft', 'moveRight', 'hardDrop', 'rotRight', 'rotLeft', 'holdPiece', 'moveDown']);
      const len = pick([0, 1, 6, 30, 80]);
      at(t, ['pd', flag]);
      at(t + len, ['pu', flag]);
      t += 30 + Math.floor(rand() * 120);
    } else if (r < 0.9 && pauses) {
      // Pause while keys may be held; they count as released after the pause.
      at(t, ['pause']);
      at(t + 5 + Math.floor(rand() * 20), ['unpause']);
      t += 100 + Math.floor(rand() * 300);
    } else {
      t += 20 + Math.floor(rand() * 80);
    }
  }
  return [...events.entries()].sort((a, b) => a[0] - b[0]);
}

const BASE = { DAS: 10, ARR: 1, Gravity: 0, 'Soft Drop': 31, 'Lock Delay': 30, Ghost: 0 };
const SCENARIOS = [
  { name: 'Sprint, default handling', gametype: 0, seed: 1, settings: {} },
  { name: 'Sprint, DAS 0 ARR 0', gametype: 0, seed: 2, settings: { DAS: 0, ARR: 0 } },
  { name: 'Sprint, DAS 6 ARR 0', gametype: 0, seed: 3, settings: { DAS: 6, ARR: 0 } },
  { name: 'Sprint, DAS 0 ARR 3', gametype: 0, seed: 4, settings: { DAS: 0, ARR: 3 } },
  { name: 'Sprint, DAS 14 ARR 4, slow soft drop', gametype: 0, seed: 5, settings: { DAS: 14, ARR: 4, 'Soft Drop': 5 } },
  { name: 'Sprint, 20G gravity setting, lock delay 8', gametype: 0, seed: 6, settings: { Gravity: 84, 'Lock Delay': 8 } },
  { name: 'Sprint, touch gestures and buttons', gametype: 0, seed: 7, settings: {}, touch: true, pad: true },
  { name: 'Sprint, pauses while keys are held', gametype: 0, seed: 8, settings: {}, pauses: true },
  { name: 'Sprint, settings changed before the replay', gametype: 0, seed: 9, settings: { DAS: 7, ARR: 2 },
    replaySettings: { DAS: 16, ARR: 0, 'Soft Drop': 70, 'Lock Delay': 90, Gravity: 20, Ghost: 2 } },
  { name: 'Sprint, replay paused and resumed', gametype: 0, seed: 10, settings: {}, replayPauses: true },
  { name: 'Marathon', gametype: 4, seed: 11, settings: {}, touch: true },
  { name: 'Ultra', gametype: 5, seed: 12, settings: { DAS: 8, ARR: 0 } },
  { name: 'Dig Race', gametype: 3, seed: 13, settings: {}, pad: true },
  { name: 'Zen', gametype: 6, seed: 14, settings: { DAS: 0, ARR: 1 }, touch: true },
  { name: 'Survival', gametype: 7, seed: 15, settings: {}, touch: true, pad: true },
  { name: 'Survival, DAS 3 ARR 0', gametype: 7, seed: 16, settings: { DAS: 3, ARR: 0 }, pauses: true },
  { name: 'Master', gametype: 8, seed: 17, settings: {}, touch: true },
  { name: 'Master, DAS 0 ARR 0', gametype: 8, seed: 18, settings: { DAS: 0, ARR: 0 }, pad: true },
  { name: 'Marathon, everything at once', gametype: 4, seed: 19, settings: { DAS: 5, ARR: 2 }, touch: true, pad: true,
    pauses: true, replayPauses: true, replaySettings: { DAS: 0, ARR: 0, Ghost: 2 } },
];
const STEPS = 9000;

// ---------------------------------------------------------------- in the page

/**
 * Runs in the page: plays the game live (bot plus `script`), then the replay,
 * and returns both end states. Sent to the page as source.
 */
async function runScenario({ sc, script, base, steps }) {
  const CODES = { ArrowLeft: 37, ArrowRight: 39, ArrowDown: 40, Space: 32, KeyX: 88, KeyZ: 90, ShiftLeft: 16, KeyC: 67 };
  const NAMES = { ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight', ArrowDown: 'ArrowDown', Space: ' ', KeyX: 'x', KeyZ: 'z', ShiftLeft: 'Shift', KeyC: 'c' };
  // keyCode is set too, so the test also runs against versions of the game that read it.
  const key = (type, code) => {
    window.dispatchEvent(new KeyboardEvent(type, { code, key: NAMES[code], keyCode: CODES[code], which: CODES[code], bubbles: true, cancelable: true }));
  };
  let seed = sc.seed * 2654435761 % 2147483647 || 1;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

  // A frame drawn between steps, as gameLoop draws it (the ghost piece probes
  // the stack); now and then a real animation frame as well.
  let drawn = 0;
  const draw = async () => {
    if (gameState === 0) {
      clear(activeCtx);
      piece.drawGhost();
      piece.draw();
    }
    if (++drawn % 300 === 0) await new Promise((r) => requestAnimationFrame(() => r()));
  };
  let gap = 1;
  const nextGap = () => 1 + Math.floor(rand() * 5);

  // ---- the bot: picks a placement for each piece, then presses keys to get there.
  const rotateCW = (t) => {
    const n = t.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      out[i] = [];
      for (let row = n - 1; row >= 0; row--) out[i][row] = t[row][n - 1 - i];
    }
    return out;
  };
  const cellsOf = (t) => {
    const cells = [];
    for (let x = 0; x < t.length; x++) for (let y = 0; y < t[x].length; y++) if (t[x][y]) cells.push([x, y]);
    return cells;
  };
  const leftOf = (t) => Math.min(...cellsOf(t).map((c) => c[0]));
  function plan() {
    const grid = stack.grid;
    let best = null;
    let t = pieces[piece.index].tetro;
    for (let pos = 0; pos < 4; pos++, t = rotateCW(t)) {
      const cells = cellsOf(t);
      const minX = Math.min(...cells.map((c) => c[0]));
      const maxX = Math.max(...cells.map((c) => c[0]));
      for (let col = 0; col + maxX - minX < 10; col++) {
        const ox = col - minX;
        const ok = (oy) => cells.every(([x, y]) => oy + y < 22 && (oy + y < 0 || !grid[ox + x][oy + y]));
        let oy = -2;
        if (!ok(oy)) continue;
        while (ok(oy + 1)) oy++;
        const g = grid.map((c) => c.slice(0, 22).map(Boolean));
        for (const [x, y] of cells) if (oy + y >= 0) g[ox + x][oy + y] = true;
        let cleared = 0;
        for (let y = 0; y < 22; y++) {
          if (g.every((c) => c[y])) {
            cleared++;
            for (const c of g) {
              c.splice(y, 1);
              c.unshift(false);
            }
          }
        }
        let agg = 0;
        let holes = 0;
        let bump = 0;
        let prev = -1;
        for (const c of g) {
          const top = c.indexOf(true);
          const h = top < 0 ? 0 : 22 - top;
          agg += h;
          if (top >= 0) for (let y = top; y < 22; y++) if (!c[y]) holes++;
          if (prev >= 0) bump += Math.abs(h - prev);
          prev = h;
        }
        const value = -0.51 * agg + 0.76 * cleared - 0.36 * holes - 0.18 * bump + rand() * 0.05;
        if (!best || value > best.value) best = { value, pos, col };
      }
    }
    return best || { pos: 0, col: 4 };
  }
  let current = '';
  let target = null;
  let onPiece = 0;
  let wait = 0;
  let carry = false;
  let softDrop = false;
  const upNext = [];
  const held = (flag) => keysDown & flag;
  const tap = (code) => {
    key('keydown', code);
    if (rand() < 0.4) key('keyup', code); // a tap shorter than a step
    else upNext.push(code);
  };
  function bot() {
    if (gameState !== 0 || paused) return;
    const id = piecesSet + ':' + piece.held + ':' + piece.index;
    if (id !== current) {
      current = id;
      target = plan();
      onPiece = 0;
      wait = 0;
      if (softDrop) {
        key('keyup', 'ArrowDown');
        softDrop = false;
      }
      // Sometimes hold, possibly while an arrow is still held from the last piece.
      if (!piece.held && rand() < 0.1) {
        tap('KeyC');
        return;
      }
    }
    onPiece++;
    if (wait > 0) {
      wait--;
      return;
    }
    const col = piece.x + leftOf(piece.tetro);
    const wantRot = (target.pos - piece.pos + 4) % 4;
    if (wantRot && onPiece < 120) {
      tap(wantRot === 1 ? 'KeyX' : wantRot === 3 ? 'KeyZ' : 'ShiftLeft');
      wait = 1;
      return;
    }
    const width = Math.max(...cellsOf(piece.tetro).map((c) => c[0])) - leftOf(piece.tetro) + 1;
    const dir = Math.sign(target.col - col);
    const toWall = target.col === 0 || target.col + width === 10;
    const arrows = { [-1]: ['ArrowLeft', flags.moveLeft], [1]: ['ArrowRight', flags.moveRight] };
    if (dir !== 0 && onPiece < 150) {
      const [code, flag] = arrows[dir];
      const [other, otherFlag] = arrows[-dir];
      if (held(otherFlag)) key('keyup', other);
      if (toWall) {
        // Hold the arrow (DAS) all the way to the wall.
        if (!held(flag)) key('keydown', code);
      } else if (!held(flag)) {
        tap(code);
        wait = 1;
      } else {
        key('keyup', code);
      }
      return;
    }
    // In place: let go of the arrows, unless carrying one into the next piece.
    if (dir === 0 && toWall && onPiece < 150 && !carry) carry = rand() < 0.5;
    for (const d of [-1, 1]) {
      if (held(arrows[d][1]) && !(carry && d === Math.sign(target.col - 4.5))) key('keyup', arrows[d][0]);
    }
    carry = false;
    if (!softDrop && rand() < 0.15 && onPiece < 150) {
      key('keydown', 'ArrowDown');
      softDrop = true;
    } else if (!softDrop) {
      tap('Space');
      wait = 3;
    }
  }

  const noLoop = { advance() {}, reset() {} };
  // The state after every step (keyed by frame), to point at the first step
  // where the replay went its own way.
  const state = () =>
    [frame, gameState, lastKeys, rng.seed, piece.index, piece.x, piece.y, piece.pos, piece.shiftDir, piece.shiftDelay, piece.arrDelay, piece.shiftReleased, piece.lockDelay, piecesSet, hold.piece, preview.grabBag.join('')].join(' ');
  const traces = [new Map(), new Map()];
  const snapshot = () => ({
    gameState,
    frame,
    lines,
    piecesSet,
    score,
    hold: hold.piece === undefined ? null : hold.piece,
    // Array.from, not map: columns can have holes (never-filled cells), which map skips.
    stack: stack.grid.map((col) => Array.from({ length: 22 }, (_, y) => col[y] || 0).join('')).join('|'),
  });

  // ---- live
  Object.assign(settings, base, sc.settings);
  const realRandom = Math.random;
  Math.random = rand;
  init(sc.gametype);
  Math.random = realRandom;
  window.stepper = noLoop;
  const byStep = new Map(script);
  for (let i = 0; i < steps && (gameState === 0 || gameState === 2); i++) {
    for (const code of upNext.splice(0)) key('keyup', code);
    for (const ev of byStep.get(i) || []) {
      if (ev[0] === 'kd' || ev[0] === 'ku') key(ev[0] === 'kd' ? 'keydown' : 'keyup', ev[1]);
      else if (ev[0] === 'pd') {
        if (gameState === 0 && !paused) keysDown |= flags[ev[1]];
      } else if (ev[0] === 'pu') releaseKey(flags[ev[1]]);
      else if (ev[0] === 'touch') {
        if (gameState === 0 && !paused) Touch.push(ev[1]);
      } else if (ev[0] === 'pause') pause();
      else if (ev[0] === 'unpause' && paused) unpause();
    }
    bot();
    step();
    traces[0].set(frame, state());
    if (--gap === 0) {
      await draw();
      gap = nextGap();
    }
  }
  const live = snapshot();
  // Let go of everything still held, as a player would.
  for (const code of Object.keys(CODES)) key('keyup', code);

  // ---- replay
  if (sc.replaySettings) Object.assign(settings, sc.replaySettings);
  init('replay');
  window.stepper = noLoop;
  let pausedAt = -1;
  for (let j = 0; j < steps * 2 && (gameState === 0 || gameState === 2) && frame < live.frame; j++) {
    if (sc.replayPauses && gameState === 0) {
      // Pause and resume the replay now and then (Esc, or leaving the tab).
      if (pausedAt < 0 && frame % 400 === 150) {
        pause();
        pausedAt = j;
      } else if (pausedAt >= 0 && j - pausedAt > 20) {
        unpause();
        pausedAt = -1;
      }
    }
    step();
    if (!traces[1].has(frame)) traces[1].set(frame, state());
    if (--gap === 0) {
      await draw();
      gap = nextGap();
    }
  }
  const replay = snapshot();
  Object.assign(settings, base);
  watchingReplay = false;
  menu(0);
  let first = null;
  for (const [f, st] of traces[0]) {
    // The piece only exists from GO on.
    if (f < 100) continue;
    if (traces[1].get(f) !== st) {
      first = { before: traces[0].get(f - 1), live: st, replay: traces[1].get(f) };
      break;
    }
  }
  return { live, replay, first };
}

// ---------------------------------------------------------------- server and browser

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.json': 'application/json', '.ico': 'image/x-icon',
};
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (rel.includes('..')) throw new Error('bad path');
    let file = path.join(root, rel);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function loadPlaywright() {
  for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
    try {
      const mod = await import(path.isAbsolute(c) ? pathToFileURL(path.join(c, 'index.mjs')).href : c);
      return mod.chromium ? mod : mod.default;
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE.');
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
// Nothing from other origins is needed here.
await context.route((url) => !url.href.startsWith(origin), (route) => route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message.split('\n')[0]));
await page.goto(`${origin}/Tetris/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof init === 'function' && typeof Touch !== 'undefined' && document.getElementById('settings').children.length > 0);

let failed = 0;
const describe = (s) => `step ${s.frame} (${['playing', 'won', '', '', '', '', '', '', '', 'lost'][s.gameState] ?? s.gameState}), ${s.lines} lines, ${s.piecesSet} pieces, score ${s.score}`;
for (const sc of SCENARIOS) {
  const script = makeScript(sc.seed, { steps: STEPS, touch: sc.touch, pad: sc.pad, pauses: sc.pauses });
  const { live, replay, first } = await page.evaluate(`(${runScenario.toString()})(${JSON.stringify({ sc, script, base: BASE, steps: STEPS })})`);
  const diffs = Object.keys(live).filter((k) => live[k] !== replay[k]);
  if (diffs.length) failed++;
  console.log(`${diffs.length ? 'FAIL' : 'ok  '} ${sc.name}: ${describe(live)}`);
  if (diffs.length) {
    console.log(`       replay: ${describe(replay)}; differs in ${diffs.join(', ')}`);
    if (first) {
      console.log('       first step that differs (frame gameState lastKeys rng.seed piece x y pos shiftDir shiftDelay arrDelay shiftReleased lockDelay pieces hold bag):');
      console.log(`         before  ${first.before}\n         live    ${first.live}\n         replay  ${first.replay}`);
    }
  } else if (verbose) {
    console.log(`       stack ${live.stack}`);
  }
}
if (errors.length) {
  failed++;
  console.log('\nPage errors:');
  for (const e of [...new Set(errors)]) console.log(`  ${e}`);
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} replay check(s) failed.` : `\nAll ${SCENARIOS.length} replays match their live games.`);
process.exit(failed ? 1 : 0);
