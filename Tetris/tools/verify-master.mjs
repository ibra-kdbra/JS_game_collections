#!/usr/bin/env node
/**
 * Master check: at the top level's lock delay, a piece can still be moved from spawn to
 * both walls before it locks, with the keyboard and with the on-screen buttons, and the
 * move reset runs out.
 *
 *   node Tetris/tools/verify-master.mjs
 *
 * 1. Keyboard (DAS 6, ARR 0, real key events) and touch (an emulated phone, touch events
 *    on the pad buttons, the default DAS 10 and ARR 1): every piece, flat and turned once,
 *    is held to the left and the right wall at level 15 on an empty board, pressed with the
 *    timing profiles of tools/playtest-master.mjs (no jitter), then hard dropped. It must
 *    lock against the wall, and only after the drop.
 * 2. Move reset: a piece on the floor at level 15, rotated back and forth just before its
 *    lock delay runs out, must still lock after 15 restarts.
 * Seeded and stepped from here (the page's clock is held), so it plays the same every run.
 */
import { startCheck } from '../../tools/play/harness.mjs';
import { install, PLAYERS, schedule, makeDriver, play, startMaster, prng } from './playtest-master.mjs';

const check = await startCheck('Tetris: Master at its top lock delay reaches both walls, and move reset runs out');
await check.run(async () => {
  for (const name of ['keyboard', 'touch']) {
    const p = PLAYERS[name];
    const touch = p.input === 'touch';
    const page = await check.open('Tetris/index.html', touch ? { viewport: { width: 390, height: 844 }, touch: true } : {});
    await page.waitForFunction(() => typeof init === 'function' && typeof Touch !== 'undefined');
    await page.evaluate(install);
    if (touch) check.ok(await page.evaluate(() => Touch.enabled), 'the phone page uses the touch controls');
    const driver = await makeDriver(page, p.input);
    const rand = prng(1);
    const misses = [];
    let limit = 0;
    let tried = 0;
    for (let index = 0; index < 7; index++) {
      for (const rot of [[], ['cw']]) {
        for (const wall of ['WL', 'WR']) {
          await startMaster(page, p, 1000 + index);
          limit = await page.evaluate((index) => {
            level = MASTER_MAX_LEVEL;
            piece.new(index);
            return lockLimit();
          }, index);
          const ops = rot.concat([wall]);
          const want = await page.evaluate(({ ops, q }) => window.__mt.simulate(ops, q), { ops, q: p });
          const res = await play(page, driver, schedule(ops, p, rand, { jitter: 0 }, want.walls));
          const cols = res.lock ? res.lock.cells.map((c) => c[0]) : [];
          const atWall = wall === 'WL' ? Math.min(...cols) === 0 : Math.max(...cols) === 9;
          tried++;
          if (!res.lock || res.early || !atWall) misses.push(`${'IJLOSTZ'[index]}${rot.length ? ' turned' : ''} to the ${wall === 'WL' ? 'left' : 'right'}${res.early ? ' (locked before the drop)' : ''}`);
        }
      }
    }
    check.ok(misses.length === 0, `${name}: ${tried - misses.length}/${tried} pieces reach the wall at lock delay ${limit} steps${misses.length ? `; missed: ${misses.slice(0, 4).join(', ')}` : ''}`);

    if (!touch) {
      // Rotate back and forth on the floor, each press 2 steps before the lock would come.
      await startMaster(page, p, 7);
      const r = await page.evaluate(() => {
        level = MASTER_MAX_LEVEL;
        piece.new(3); // O: turning it never changes its lowest row
        const before = piecesSet;
        const keys = ['KeyX', 'KeyZ'];
        const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
        let presses = 0;
        let maxResets = 0;
        for (let s = 0; s < 2000 && piecesSet === before; s++) {
          if (piece.lockDelay === lockLimit() - 2) {
            key('keydown', keys[presses++ % 2]);
            step();
            key('keyup', keys[(presses - 1) % 2]);
          } else step();
          maxResets = Math.max(maxResets, piece.resets);
        }
        return { locked: piecesSet !== before, presses, maxResets, cap: MASTER_LOCK_RESETS };
      });
      check.ok(r.locked && r.maxResets === r.cap, `stalling with rotations: the piece locks after ${r.maxResets} lock delay restarts (cap ${r.cap}, ${r.presses} presses)`);

      // Other modes keep tetr.js's unlimited restarts.
      const m = await page.evaluate(() => {
        init(4);
        stepper.advance = () => 0;
        while (gameState === 2) step();
        settings['Lock Delay'] = 30;
        while (!landed && gameState === 0) step();
        const before = piecesSet;
        const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));
        for (let s = 0, n = 0; s < 1500 && piecesSet === before; s++) {
          if (piece.lockDelay === lockLimit() - 2) {
            const code = n++ % 2 ? 'KeyZ' : 'KeyX';
            key('keydown', code);
            step();
            key('keyup', code);
          } else step();
        }
        return piecesSet === before;
      });
      check.ok(m, 'Marathon still restarts the lock delay on every move (no cap outside Master)');
    }
    check.noErrors(page);
  }
});
