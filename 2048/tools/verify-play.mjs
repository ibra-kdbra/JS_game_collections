/**
 * 2048 gameplay check (browser):
 *   node 2048/tools/verify-play.mjs
 *
 * 1. Plays 300 random moves with the arrow keys (restarting with R when a game ends). After
 *    every key the board must match an independent re-implementation of the slide and merge
 *    rules, plus exactly one new 2 or 4 when the board moved; the score must grow by the
 *    merged values; the game-over flag must match whether any move is left.
 * 2. Asks the AI for a hint (expectimax) and checks the suggestion is a legal move, then lets
 *    the AI play ("Watch AI") for at least 15 moves.
 * 3. Picks the Machine Learning strategy: its weights (model.gz, and never the old model.bmp)
 *    download, the worker unpacks them, the wasm reports it parsed them, the page says the
 *    model is ready, and that player then plays at least 40 moves.
 * 4. The tiles on screen match the board, and no script errors.
 * Exits non-zero on any failure.
 */
import { startCheck, waitFor, seededRandom } from '../../tools/play/harness.mjs';

const MOVES = 300;
const KEYS = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']; // the game's directions 0..3

// Board as rows[y][x] of values (0 = empty), straight from the game manager.
const readBoard = () => {
  const gm = window.__gm;
  const rows = [];
  for (let y = 0; y < gm.size; y++) {
    rows.push([]);
    for (let x = 0; x < gm.size; x++) rows[y].push(gm.grid.cells[x][y]?.value ?? 0);
  }
  return { rows, score: gm.score, over: gm.over, won: gm.won, keepPlaying: gm.keepPlaying, aiPlayed: gm.aiPlayed };
};

/** Reference slide: returns { rows, gained } for direction 0 up, 1 right, 2 down, 3 left. */
function slide(rows, dir) {
  const n = rows.length;
  const out = rows.map((r) => r.slice());
  let gained = 0;
  for (let i = 0; i < n; i++) {
    // Cells of one line, ordered from the side the tiles move towards.
    const coords = [];
    for (let j = 0; j < n; j++) {
      if (dir === 0) coords.push([j, i]);
      else if (dir === 2) coords.push([n - 1 - j, i]);
      else if (dir === 3) coords.push([i, j]);
      else coords.push([i, n - 1 - j]);
    }
    const vals = coords.map(([y, x]) => rows[y][x]).filter(Boolean);
    const merged = [];
    for (let k = 0; k < vals.length; k++) {
      if (k + 1 < vals.length && vals[k] === vals[k + 1]) {
        merged.push(vals[k] * 2);
        gained += vals[k] * 2;
        k++;
      } else merged.push(vals[k]);
    }
    coords.forEach(([y, x], k) => (out[y][x] = merged[k] ?? 0));
  }
  return { rows: out, gained };
}

const same = (a, b) => a.every((r, y) => r.every((v, x) => v === b[y][x]));
const anyMove = (rows) => [0, 1, 2, 3].some((d) => !same(slide(rows, d).rows, rows));
const isTile = (v) => v === 0 || (v >= 2 && (v & (v - 1)) === 0);

const check = await startCheck('2048: random play, the slide rules, and an AI move');
await check.run(async () => {
  const page = await check.open('2048/index.html', {
    init: seededRandom(2048),
    intercept: {
      // Expose the game manager, which index.js only hands to main().
      '2048/js/index.js': (src) => {
        const out = src.replace('main(new GameManager(', 'main(window.__gm = new GameManager(');
        if (out === src) throw new Error('2048/js/index.js no longer creates the GameManager inline');
        return out;
      },
    },
  });
  await waitFor(page, () => !!window.__gm);
  // Start from a fresh 4x4 game in Play mode.
  await page.evaluate(() => window.__gm.restart());

  let bad = 0;
  let moved = 0;
  let restarts = 0;
  let best = 0;
  let r = 12345;
  const rand = () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < MOVES && bad < 3; i++) {
    const before = await page.evaluate(readBoard);
    if (before.over || (before.won && !before.keepPlaying)) {
      await page.keyboard.press('r');
      restarts++;
      const fresh = await page.evaluate(readBoard);
      const tiles = fresh.rows.flat().filter(Boolean);
      if (fresh.score !== 0 || tiles.length !== 2 || fresh.over) {
        check.fail(`R did not start a fresh game (score ${fresh.score}, ${tiles.length} tiles)`);
        bad++;
      }
      continue;
    }
    const dir = Math.floor(rand() * 4);
    await page.keyboard.press(KEYS[dir]);
    const after = await page.evaluate(readBoard);
    const ref = slide(before.rows, dir);
    const problems = [];
    if (!after.rows.flat().every(isTile)) problems.push('a tile is not a power of two');
    if (same(ref.rows, before.rows)) {
      if (!same(after.rows, before.rows) || after.score !== before.score) problems.push('board changed on a blocked move');
    } else {
      moved++;
      const extra = [];
      after.rows.forEach((row, y) => row.forEach((v, x) => {
        if (v !== ref.rows[y][x]) extra.push({ was: ref.rows[y][x], v });
      }));
      if (extra.length !== 1 || extra[0].was !== 0 || (extra[0].v !== 2 && extra[0].v !== 4)) {
        problems.push(`board does not match the slide rules plus one new tile (${JSON.stringify(extra)})`);
      }
      if (after.score !== before.score + ref.gained) problems.push(`score ${before.score} -> ${after.score}, expected +${ref.gained}`);
      if (after.over !== !anyMove(after.rows)) problems.push(`game-over flag is ${after.over} with moves ${anyMove(after.rows) ? '' : 'not '}left`);
    }
    best = Math.max(best, ...after.rows.flat());
    if (problems.length) {
      bad++;
      check.fail(`move ${i + 1} (${KEYS[dir]}): ${problems.join('; ')}\n         before ${JSON.stringify(before.rows)}\n         after  ${JSON.stringify(after.rows)}`);
    }
  }
  check.ok(bad === 0 && moved > MOVES / 2, `${MOVES} random key presses: ${moved} moved the board, all followed the rules (best tile ${best}, ${restarts} restart(s))`);

  // AI hint: the default strategy (expectimax) runs in a WASM web worker.
  await page.evaluate(() => window.__gm.restart());
  const ready = await waitFor(page, () => !document.getElementById('hintButton').disabled, null, { timeout: 30000 });
  check.ok(ready, 'the AI worker loads (hint button enabled)');
  if (ready) {
    const board = await page.evaluate(readBoard);
    await page.click('#hintButton');
    const status = await waitFor(page, () => {
      const t = document.getElementById('status').textContent;
      return /AI suggests/.test(t) ? t : '';
    }, null, { timeout: 20000 });
    const dir = ['↑ up', '→ right', '↓ down', '← left'].findIndex((name) => status.includes(name));
    check.ok(dir >= 0 && !same(slide(board.rows, dir).rows, board.rows), `the AI hint is a legal move (${status || 'no hint shown'})`);

    // Watch AI: it plays on its own.
    await page.click('label[for="aiOn"]');
    const start = await page.evaluate(() => window.__gm.grid.serialize());
    const played = await waitFor(page, () => {
      const gm = window.__gm;
      const tiles = [];
      gm.grid.eachCell((x, y, t) => t && tiles.push(t.value));
      return gm.aiPlayed && tiles.reduce((a, b) => a + b, 0) >= 4 + 15 * 2 ? tiles.length : 0;
    }, null, { timeout: 30000 });
    const after = await page.evaluate(readBoard);
    check.ok(played && after.rows.flat().every(isTile) && JSON.stringify(start) !== JSON.stringify(await page.evaluate(() => window.__gm.grid.serialize())),
      `Watch AI plays at least 15 moves on its own (score ${after.score})`);
    await page.click('label[for="aiOff"]');

    // The Machine Learning strategy downloads its weights (model.gz) when it is picked, and the
    // worker unpacks them for the wasm, which still asks for model.bmp.
    const requested = [];
    page.context().on('request', (req) => requested.push(new URL(req.url()).pathname));
    let parsed = false;  // players.wasm logs this once it has the weights
    page.on('console', (msg) => { if (msg.text().includes('fetch succeeded')) parsed = true; });
    await page.evaluate(() => { document.querySelector('.ai-drawer').open = true; });
    await page.click('label[for="nTupleStrategy"]');
    const loaded = await waitFor(page, () => {
      const t = document.querySelector('#modelStatus span').textContent;
      return /ready|fail|unpack/i.test(t) ? t : '';
    }, null, { timeout: 60000 });
    const progressMax = await page.evaluate(() => document.getElementById('modelProgress').max);
    const models = requested.filter((p) => /model\.(gz|bmp)$/.test(p));
    check.ok(loaded === 'AI model ready.' && models.join() === '/2048/model.gz' && parsed,
      `Machine Learning: the weights download and unpack ("${loaded}"; requests ${JSON.stringify(models)}; ` +
      `progress bar out of ${progressMax} bytes; ${parsed ? '' : 'no '}"fetch succeeded" from the wasm)`);
    await page.evaluate(() => window.__gm.restart());
    await page.click('label[for="aiOn"]');
    const mlPlayed = await waitFor(page, () => {
      const gm = window.__gm;
      let sum = 0;
      gm.grid.eachCell((x, y, t) => { if (t) sum += t.value; });
      return gm.aiPlayed && sum >= 4 + 40 * 2 ? sum : 0;
    }, null, { timeout: 30000 });
    check.ok(mlPlayed, `the Machine Learning player plays at least 40 moves (tile sum ${mlPlayed})`);
    await page.click('label[for="aiOff"]');
  }

  // What the page shows matches the board once the animation settles.
  await page.waitForTimeout(400);
  const shown = await page.evaluate(() => {
    const gm = window.__gm;
    const want = [];
    gm.grid.eachCell((x, y, t) => t && want.push(`${x + 1}-${y + 1}:${t.value}`));
    const got = new Set();
    document.querySelectorAll('.tile-container .tile').forEach((el) => {
      const pos = [...el.classList].find((c) => c.startsWith('tile-position-'))?.slice(14);
      const val = el.querySelector('.tile-inner')?.textContent;
      got.add(`${pos}:${val}`);
    });
    return want.every((w) => got.has(w)) && want.length > 0 ? '' : `board ${want.join(' ')} / shown ${[...got].join(' ')}`;
  });
  check.ok(!shown, shown || 'the tiles on screen match the board');
  check.noErrors(page);
});
