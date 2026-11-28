/**
 * Tetris gameplay check (browser): a seeded Sprint, played with the keyboard.
 *   node Tetris/tools/verify-play.mjs
 *
 * With Math.random seeded (so the replay seed, and the piece order, are always the same),
 * opens Sprint from the menu and plays it to the end:
 * 1. For each piece, a planner picks a rotation and column (it scores the stack: height,
 *    holes, bumpiness, lines), then plays it with real key events: X to rotate, the arrow
 *    keys to shift one column per tap, Space to hard drop.
 * 2. Every piece must land where it was planned, and lines must clear; Sprint must end with
 *    40 lines and the win screen (gameState 1), not a top-out.
 * The game's 60 Hz steps are driven from here (the page's own clock is held), one step per
 * key change, so the run is the same every time. Exits non-zero on any failure.
 */
import { startCheck, waitFor, seededRandom } from '../../tools/play/harness.mjs';

const SEED = 40;
const MAX_PIECES = 250;

const check = await startCheck('Tetris: a seeded Sprint, played with the keyboard, clears 40 lines');
await check.run(async () => {
  const page = await check.open('Tetris/index.html', { init: seededRandom(SEED) });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);

  // Sprint from the menu.
  await page.getByText('Sprint', { exact: false }).first().click();
  const started = await waitFor(page, () => gametype === 0 && (gameState === 2 || gameState === 0));
  check.ok(started, 'the Sprint menu entry starts a Sprint (40 lines)');
  if (!started) return;

  // Hold the page's clock: from now on the game advances only when step() is called here.
  await page.evaluate(() => {
    stepper.advance = () => 0;
    window.__steps = (n) => {
      for (let i = 0; i < n; i++) step();
      return gameState;
    };
    // The planner: try every rotation and column on a copy of the stack.
    window.__plan = () => {
      const save = { x: piece.x, y: piece.y, tetro: piece.tetro, pos: piece.pos, lastRotate: piece.lastRotate, lastKick: piece.lastKick, dirty: piece.dirty, lockDelay: piece.lockDelay };
      const restore = () => Object.assign(piece, save);
      const audio = window.audioManager;
      if (audio) window.audioManager = undefined; // no rotate sounds while planning
      let best = null;
      for (let rot = 0; rot < 4; rot++) {
        restore();
        for (let r = 0; r < rot; r++) piece.rotate(1);
        const baseX = piece.x;
        const tetro = piece.tetro;
        for (let dx = -10; dx <= 10; dx++) {
          // Walk there one column at a time, as the taps will.
          let ok = true;
          const step = Math.sign(dx);
          let x = baseX;
          for (let k = 0; k < Math.abs(dx); k++) {
            piece.x = x;
            if (!piece.moveValid(step, 0, tetro)) {
              ok = false;
              break;
            }
            x += step;
          }
          if (!ok) continue;
          piece.x = x;
          const drop = piece.getDrop(22);
          const py = Math.floor(piece.y) + drop;
          // Place on a copy and score it.
          const g = stack.grid.map((col) => col.slice());
          for (let i = 0; i < tetro.length; i++) for (let j = 0; j < tetro[i].length; j++) if (tetro[i][j]) g[x + i][py + j] = 1;
          let cleared = 0;
          for (let row = 0; row < 22; row++) if (g.every((col) => col[row])) cleared++;
          const heights = g.map((col) => {
            let h = 0;
            for (let row = 0; row < 22; row++) if (col[row]) { h = 22 - row; break; }
            return h - cleared;
          });
          let holes = 0;
          g.forEach((col) => {
            let seen = false;
            for (let row = 0; row < 22; row++) {
              const full = g.every((c) => c[row]);
              if (col[row] && !full) seen = true;
              else if (!col[row] && seen) holes++;
            }
          });
          let bump = 0;
          for (let i = 0; i < 9; i++) bump += Math.abs(heights[i] - heights[i + 1]);
          const agg = heights.reduce((a, b) => a + b, 0);
          const score = -0.51 * agg + 0.76 * cleared - 0.36 * holes - 0.18 * bump;
          if (!best || score > best.score) best = { score, rot, dx, x, y: py };
        }
      }
      restore();
      if (audio) window.audioManager = audio;
      return best;
    };
    window.__info = () => ({ state: gameState, lines, pieces: piecesSet, x: piece.x, y: Math.floor(piece.y), pos: piece.pos, frame });
  });

  // Countdown (READY, GO!) then the first piece.
  await page.evaluate(() => window.__steps(101));
  const tap = async (key) => {
    await page.keyboard.down(key);
    await page.evaluate(() => window.__steps(1));
    await page.keyboard.up(key);
    await page.evaluate(() => window.__steps(1));
  };

  let misplaced = 0;
  let info = await page.evaluate(() => window.__info());
  while (info.state === 0 && info.pieces < MAX_PIECES) {
    const plan = await page.evaluate(() => window.__plan());
    if (!plan) break;
    for (let r = 0; r < plan.rot; r++) await tap('x');
    for (let k = 0; k < Math.abs(plan.dx); k++) await tap(plan.dx < 0 ? 'ArrowLeft' : 'ArrowRight');
    const before = await page.evaluate(() => window.__info());
    if (before.x !== plan.x || before.pos !== plan.rot % 4) {
      misplaced++;
      if (misplaced <= 3) check.fail(`piece ${info.pieces + 1}: keys put it at column ${before.x} rotation ${before.pos}, planned ${plan.x} rotation ${plan.rot}`);
    }
    await tap('Space');
    // Lock (the hard drop locks it on the next step) and wait for the next piece.
    for (let i = 0; i < 5; i++) {
      const now = await page.evaluate(() => window.__info());
      if (now.pieces > info.pieces || now.state !== 0) break;
      await page.evaluate(() => window.__steps(1));
    }
    info = await page.evaluate(() => window.__info());
  }
  check.ok(misplaced === 0, `every piece went where its keys sent it (${info.pieces} pieces)`);
  const end = await page.evaluate(() => ({ ...window.__info(), msg: document.getElementById('msg')?.textContent || '', seed: replayKeys.seed }));
  check.ok(end.lines >= 40 && end.state === 1, `Sprint ends with ${end.lines} lines and the win (state ${end.state}${end.msg ? `, "${end.msg}"` : ''}) after ${end.frame} frames (piece seed ${end.seed})`);
  check.noErrors(page);
});
