/**
 * Tron gameplay check (no browser):
 *   node Tron/tools/verify.mjs
 *
 * Runs the real round logic (js/round.js, js/bike.js, js/board.js) at a fixed 60 Hz step,
 * with a seeded Math.random so every run is the same:
 * 1. AI against AI on every arena size, layout and orientation, at each difficulty: both
 *    cycles are steered by the game's own AI (Bike.think). Every round must finish within
 *    three minutes of game time with a result that matches which cycle crashed, every
 *    painted cell must belong to the cycle that moved there, and rounds must on average
 *    last much longer than a cycle that never turns (so the AI really avoids walls).
 * 2. One player against the CPU: a player who never turns hits the wall first and the
 *    CPU wins; a U-turn is refused and a quick double tap (left, left) is kept.
 * Exits non-zero on any failure.
 */
import { Round } from '../js/round.js';
import { ARENAS, LAYOUTS } from '../js/board.js';

let s = 1;
Math.random = () => {
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DT = 1 / 60;
const MAX_SECONDS = 180;
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

/** Play a round to the end. `steer(round)` runs before every update. Returns stats. */
function play(round, steer) {
  const trail = { 1: 0, 2: 0 };
  let t = 0;
  while (!round.over && t < MAX_SECONDS) {
    steer?.(round);
    round.moved.length = 0;
    round.update(DT);
    for (const m of round.moved) {
      trail[m.id]++;
      if (round.board.cells[round.board.index(m.x, m.y)] !== m.id) fail(`cell ${m.x},${m.y} moved into by ${m.id} is not painted`);
    }
    t += DT;
  }
  return { t, trail };
}

console.log('1. AI against AI');
const started = Date.now();
for (const difficulty of [1, 2, 3]) {
  let rounds = 0;
  let totalSeconds = 0;
  let straightSeconds = 0;
  const results = { blue: 0, orange: 0, draw: 0 };
  for (const arena of Object.keys(ARENAS)) {
    for (const layout of Object.keys(LAYOUTS)) {
      for (const portrait of [false, true]) {
        const opts = { arena, layout, portrait, players: 1, difficulty };
        const round = new Round(opts);
        // players: 1 makes the round steer orange with the AI; steer blue the same way.
        const { t, trail } = play(round, (r) => r.blue.think(r.orange, difficulty));
        rounds++;
        totalSeconds += t;
        const name = `${arena}/${layout}${portrait ? '/portrait' : ''} difficulty ${difficulty}`;
        if (!round.over) {
          fail(`${name}: no result after ${MAX_SECONDS}s`);
          continue;
        }
        results[round.result]++;
        const expect = !round.blue.alive && !round.orange.alive ? 'draw' : !round.blue.alive ? 'orange' : 'blue';
        if (round.result !== expect) fail(`${name}: result ${round.result} but expected ${expect}`);
        if (!round.crashes.length) fail(`${name}: a round ended with no crash`);
        if (trail[1] < 10 || trail[2] < 10) fail(`${name}: a cycle barely moved (${trail[1]}, ${trail[2]} cells)`);
        // A crash is into a wall or trail, or both cycles entering the same free cell.
        for (const c of round.crashes) {
          const headOn = round.crashes.some((o) => o.id !== c.id && o.x === c.x && o.y === c.y);
          if (round.board.isFree(c.x, c.y) && !headOn) fail(`${name}: crash at ${c.x},${c.y} into a free cell`);
        }
        // How long a cycle that never turns lasts on the same board.
        // (players: 2 has no AI, and nobody steers.)
        const plain = play(new Round({ ...opts, players: 2 }));
        straightSeconds += Math.min(plain.t, MAX_SECONDS);
      }
    }
  }
  const avg = totalSeconds / rounds;
  const avgStraight = straightSeconds / rounds;
  console.log(`  ${rounds} rounds at difficulty ${difficulty}: blue ${results.blue}, orange ${results.orange}, draw ${results.draw}; ` +
    `average ${avg.toFixed(1)}s (a cycle that never turns: ${avgStraight.toFixed(1)}s)`);
  if (avg < avgStraight * 2) fail(`difficulty ${difficulty}: AI rounds last ${avg.toFixed(1)}s on average, under twice a straight run`);
}

console.log('2. One player against the CPU');
{
  // In this round the CPU still thinks for orange; blue never turns.
  const round = new Round({ arena: 'medium', layout: 'open', portrait: false, players: 1, difficulty: 2 });
  const { x: sx, y: sy } = round.blue;
  const { t } = play(round);
  if (round.result !== 'orange') fail(`a player who never turns should lose to the CPU, result ${round.result}`);
  else if (round.blue.y !== sy || round.blue.dir !== 'W') fail(`the player's cycle left its lane (${round.blue.x},${round.blue.y} heading ${round.blue.dir})`);
  else console.log(`  ok   a player who never turns crashes after ${sx - round.blue.x} cells (${t.toFixed(1)}s); the CPU wins`);

  const r2 = new Round({ arena: 'small', layout: 'open', portrait: false, players: 1, difficulty: 1 });
  r2.blue.queueTurn('E'); // reverse of W: refused
  if (r2.blue.turns.length) fail('a U-turn was queued');
  r2.blue.queueTurn('N');
  r2.blue.queueTurn('E'); // a quick second tap completes the U-turn over two cells
  if (r2.blue.turns.join() !== 'N,E') fail(`two quick turns were not both kept (${r2.blue.turns.join()})`);
  const y0 = r2.blue.y;
  const x0 = r2.blue.x;
  for (let i = 0; i < 30 && r2.blue.turns.length; i++) r2.update(DT);
  for (let i = 0; i < 30; i++) r2.update(DT);
  if (!(r2.blue.y === y0 - 1 && r2.blue.x > x0 && r2.blue.dir === 'E')) fail(`after N, E the cycle is at ${r2.blue.x},${r2.blue.y} heading ${r2.blue.dir}`);
  else console.log('  ok   a U-turn is refused; a quick double tap turns the cycle round one lane over');
}

console.log(failures ? `${failures} failure(s)` : `All checks passed (${((Date.now() - started) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
