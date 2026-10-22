// Run: node Minesweeper/test/solver.test.mjs [boardsPerPreset]
// Generates boards per preset with no-guess on, then replays each one with the
// solver from the first click and asserts it is cleared with no guess.
// Also checks the safe opening, determinism of seeded boards and the puzzle ladder.

import assert from 'node:assert/strict';
import { PRESETS, PUZZLES, DAILY } from '../js/config.js';
import { generate, safeZone } from '../js/generator.js';
import { solve, deduce, countMines, floodOpen } from '../js/solver.js';
import { seeded, mulberry32 } from '../js/rng.js';

const PER = Number(process.argv[2]) || 200;
let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

console.log(`No-guess generation, ${PER} boards per preset`);
for (const p of Object.values(PRESETS)) {
  const rng = mulberry32(0xc0ffee + p.w * 31 + p.mines);
  const times = [];
  let attempts = 0;
  let relaxed = 0;
  check(`${p.label} ${p.w}x${p.h}/${p.mines}`, () => {
    for (let k = 0; k < PER; k++) {
      const start = Math.floor(rng() * p.w * p.h);
      const g = generate({ w: p.w, h: p.h, mines: p.mines, start, rng, noGuess: true });
      times.push(g.ms);
      attempts += g.attempts;
      if (g.failed) relaxed++;
      assert.ok(!g.failed, `board ${k} fell back to a guessing board`);
      const mineCount = g.mines.reduce((a, b) => a + b, 0);
      assert.equal(mineCount, p.mines, 'mine count');
      for (const z of safeZone(p.w, p.h, p.mines, start)) assert.equal(g.mines[z], 0, 'first click zone has a mine');
      assert.equal(countMines(p.w, p.h, g.mines)[start], 0, 'first click opens an area');
      const r = solve(p.w, p.h, g.mines, start);
      assert.ok(r.solved, `board ${k} not solvable without guessing`);
    }
  });
  times.sort((a, b) => a - b);
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(
    `       generation ms: avg ${avg.toFixed(1)}, median ${times[times.length >> 1].toFixed(1)}, ` +
      `p95 ${times[Math.floor(times.length * 0.95)].toFixed(1)}, max ${times[times.length - 1].toFixed(1)}; ` +
      `${(attempts / PER).toFixed(2)} attempts/board; fallbacks ${relaxed}`,
  );
}

console.log('Solver rules');
check('single rule finds a safe cell and a mine', () => {
  // 3x1: [1][?][?] with mine at x=1 -> after opening x=0 the 1 sees one unknown.
  const w = 3, h = 1;
  const mines = Uint8Array.from([0, 1, 0]);
  const counts = countMines(w, h, mines);
  const open = Uint8Array.from([1, 0, 0]);
  const d = deduce({ w, h, counts, open, known: new Uint8Array(3), total: 1 });
  assert.equal(d.rule, 'single');
  assert.deepEqual(d.mines, [1]);
});
check('pair rule (1-2 pattern) resolves what single cannot', () => {
  // Row 0 open: counts 1,2,... over hidden row 1. Classic 1-2-1.
  const w = 5, h = 2;
  const mines = Uint8Array.from([0, 0, 0, 0, 0, 0, 1, 0, 1, 0]);
  const counts = countMines(w, h, mines);
  const open = Uint8Array.from([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  const d0 = deduce({ w, h, counts, open, known: new Uint8Array(10), total: 2 }, { pair: false, global: false });
  assert.equal(d0.rule, null, 'single alone should stall');
  const d = deduce({ w, h, counts, open, known: new Uint8Array(10), total: 2 }, { global: false });
  assert.equal(d.rule, 'pair');
  for (const s of d.safe) assert.equal(mines[s], 0, 'pair marked a mine safe');
  for (const m of d.mines) assert.equal(mines[m], 1, 'pair marked a safe cell as a mine');
});

console.log('Seeded boards');
check('daily board is identical for the same date', () => {
  const mk = () => generate({ ...DAILY, start: 8 * 16 + 8, rng: seeded('daily-2026-10-22') });
  assert.deepEqual(mk().mines, mk().mines);
});
check('puzzle ladder: every level solvable and meets its logic target', () => {
  const t0 = Date.now();
  const rows = [];
  PUZZLES.forEach((p, i) => {
    const start = Math.floor(p.h / 2) * p.w + Math.floor(p.w / 2);
    const g = generate({ w: p.w, h: p.h, mines: p.mines, start, rng: seeded(`puzzle-${i + 1}`), minPair: p.pair, maxOpen: p.open });
    assert.ok(g.noGuess && !g.failed, `level ${i + 1} not no-guess`);
    assert.ok(!g.relaxed, `level ${i + 1} missed pair target ${p.pair}`);
    assert.ok(solve(p.w, p.h, g.mines, start).solved, `level ${i + 1} unsolvable`);
    const opening = floodOpen(p.w, p.h, g.counts, new Uint8Array(p.w * p.h), start).length;
    assert.ok(opening <= p.open * (p.w * p.h - p.mines), `level ${i + 1} opens ${opening} cells at the start`);
    rows.push(`${i + 1}:${p.w}x${p.h}/${p.mines} open ${opening} pair ${g.steps.pair}`);
  });
  console.log(`       ${PUZZLES.length} levels in ${Date.now() - t0} ms\n       ${rows.join('\n       ')}`);
});

console.log(failures ? `\n${failures} failing` : '\nall passed');
process.exit(failures ? 1 : 0);
