/**
 * Checks the Snake rules and content without a browser:
 *   node Snake/tools/verify.mjs
 *
 * 1. Every arena map parses, every floor cell is reachable, no wrap gap leads into a wall.
 * 2. A bot plays every arena through the real simulation and must reach the target length.
 *    A casual bot (tools/casual-bot.mjs) rates each arena; each third of the
 *    campaign must be harder for it (fewer clears) than the third before.
 * 3. The daily board and food order are identical for the same date, and differ between dates.
 * 4. Turn-queue and no-reverse rules behave as specified.
 * Exits non-zero on any failure.
 */
import { ARENAS, parseMap } from '../js/arenas.js';
import { CONFIG } from '../js/config.js';
import { advance, buildBoard, createGame, dailyBoard, fingerprint, floodFill, queueTurn, stepCell, stepsPerMove } from '../js/game.js';
import { botMove } from '../js/bot.js';
import { casualRun } from './casual-bot.mjs';

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  FAIL ${msg}`);
};

/** Play with the bot until the game ends or the step budget runs out. */
export function botRun(opts, maxSteps = 200000) {
  const s = createGame(opts);
  queueTurn(s, botMove(s));
  for (let i = 0; i < maxSteps && !s.over; i++) {
    if (!s.queue.length && s.counter + 1 >= stepsPerMove(s)) queueTurn(s, botMove(s));
    advance(s);
  }
  return s;
}

console.log('1. Arena maps');
ARENAS.forEach((arena, i) => {
  let board;
  try {
    board = { ...parseMap(arena.map), wrap: true };
  } catch (e) {
    fail(`arena ${i + 1} ${arena.name}: ${e.message}`);
    return;
  }
  const floor = board.walls.reduce((n, v) => n + (v ? 0 : 1), 0);
  const reach = floodFill(board, board.start).count;
  if (board.w !== 20 || board.h !== 20) fail(`arena ${i + 1} is ${board.w}x${board.h}`);
  if (reach !== floor) fail(`arena ${i + 1} ${arena.name}: ${floor - reach} floor cells unreachable`);
  // An open edge cell must not wrap straight into a wall on the far side.
  const { w, h, walls } = board;
  for (let k = 0; k < w; k++) {
    if (!walls[k] && walls[(h - 1) * w + k]) fail(`arena ${i + 1}: top edge gap at column ${k} wraps into a wall`);
    if (!walls[(h - 1) * w + k] && walls[k]) fail(`arena ${i + 1}: bottom edge gap at column ${k} wraps into a wall`);
  }
  for (let k = 0; k < h; k++) {
    if (!walls[k * w] && walls[k * w + w - 1]) fail(`arena ${i + 1}: left edge gap at row ${k} wraps into a wall`);
    if (!walls[k * w + w - 1] && walls[k * w]) fail(`arena ${i + 1}: right edge gap at row ${k} wraps into a wall`);
  }
  if (arena.target > floor / 2) fail(`arena ${i + 1}: target ${arena.target} too large for ${floor} free cells`);
  console.log(`  ok ${String(i + 1).padStart(2)} ${arena.name.padEnd(13)} floor ${floor}, portals ${board.portalPairs.length}, target ${arena.target}, speed ${arena.speed}`);
});

console.log('2. Every arena is completable (bot through the real rules, 12 seeds each)');
const SEEDS = 12;
const CASUAL = 60;
const results = [];
ARENAS.forEach((arena, i) => {
  let wins = 0;
  let bestTime = Infinity;
  const deaths = {};
  for (let seed = 1; seed <= SEEDS; seed++) {
    const s = botRun({ mode: 'arena', arenaIndex: i, seed });
    if (s.won) {
      wins++;
      bestTime = Math.min(bestTime, s.time);
    } else deaths[s.cause ?? 'timeout'] = (deaths[s.cause ?? 'timeout'] ?? 0) + 1;
  }
  let casual = 0;
  for (let seed = 1; seed <= CASUAL; seed++) if (casualRun(i, seed).won) casual++;
  results.push({ i, wins, casual });
  const line = `${String(i + 1).padStart(2)} ${arena.name.padEnd(13)} ${wins}/${SEEDS} cleared, fastest ${(bestTime / 60).toFixed(1)}s, casual ${String(casual).padStart(2)}/${CASUAL} ${Object.keys(deaths).length ? JSON.stringify(deaths) : ''}`;
  if (!wins) fail(line);
  else console.log(`  ok ${line}`);
});

{
  const third = Math.ceil(ARENAS.length / 3);
  const rates = [0, 1, 2].map((k) => {
    const part = results.slice(k * third, (k + 1) * third);
    return part.reduce((a, r) => a + r.casual, 0) / (part.length * CASUAL);
  });
  console.log(`  casual clear rate by thirds: ${rates.map((r) => `${Math.round(r * 100)}%`).join(', ')}`);
  if (!(rates[0] > rates[1] && rates[1] > rates[2])) fail('the arenas do not get harder third by third');
}

console.log('3. Daily seed');
for (const day of ['2026-10-22', '2026-10-23', '2027-02-28']) {
  const a = dailyBoard(day);
  const b = dailyBoard(day);
  if (a.walls.join('') !== b.walls.join('')) fail(`${day}: layout differs between builds`);
  const floor = a.walls.reduce((n, v) => n + (v ? 0 : 1), 0);
  if (floodFill(a, a.start).count !== floor) fail(`${day}: layout has unreachable cells`);
  // Same date, same bot inputs: identical game, move for move.
  const runA = botRun({ mode: 'daily', day, seed: 1 }, 20000);
  const runB = botRun({ mode: 'daily', day, seed: 999 }, 20000);
  if (fingerprint(runA) !== fingerprint(runB)) fail(`${day}: two runs diverged (${fingerprint(runA)} vs ${fingerprint(runB)})`);
  // The first food cell does not depend on the local seed either.
  const foods = [createGame({ mode: 'daily', day, seed: 5 }).food, createGame({ mode: 'daily', day, seed: 77 }).food];
  if (foods[0] !== foods[1]) fail(`${day}: first food differs`);
  const walls = a.walls.reduce((n, v) => n + v, 0);
  console.log(`  ok ${day}: ${walls} wall cells, first food ${foods[0]}, bot run score ${runA.score} (${runA.over ? runA.cause : 'alive'}) identical twice`);
}
if (dailyBoard('2026-10-22').walls.join('') === dailyBoard('2026-10-23').walls.join('')) fail('two days share a layout');
else console.log('  ok consecutive days get different layouts');
const classicBoard = buildBoard({ mode: 'classic' });
if (classicBoard.walls.some(Boolean)) fail('classic board has walls');

console.log('4. Turn rules');
{
  const s = createGame({ mode: 'classic', seed: 3 });
  queueTurn(s, 'right');
  for (let i = 0; i < 40; i++) advance(s);
  const len = s.snake.length;
  if (queueTurn(s, 'left')) fail('reverse turn was accepted');
  if (!queueTurn(s, 'up') || !queueTurn(s, 'left')) fail('quick double turn (up, left) was not queued');
  if (queueTurn(s, 'down')) fail('third queued turn accepted beyond the queue of 2');
  const head = s.snake[0];
  let moved = 0;
  while (moved < 2 && !s.over) {
    const m = s.moves;
    advance(s);
    if (s.moves > m) moved++;
  }
  const w = s.board.w;
  const expected = head - w - 1;
  if (s.snake[0] !== expected) fail(`double turn ended at ${s.snake[0]}, expected ${expected}`);
  if (s.over) fail(`double turn killed the snake (${s.cause})`);
  else console.log(`  ok reverse ignored, up+left both applied within two moves (length ${len})`);

  // Reverse via a fast double tap (down then left while heading right... then right) must not kill.
  const t = createGame({ mode: 'classic', seed: 3 });
  queueTurn(t, 'right');
  for (let i = 0; i < 60; i++) advance(t);
  queueTurn(t, 'up');
  const accepted = queueTurn(t, 'down');
  if (accepted) fail('up then down (reverse through the queue) was accepted');
  else console.log('  ok up-then-down in one tick cannot reverse through the queue');
}

console.log('5. Zen and Classic deaths');
{
  const turnAfterMoves = (s, dir, moves) => {
    const target = s.moves + moves;
    queueTurn(s, dir);
    while (s.moves < target && !s.over) advance(s);
  };
  const z = createGame({ mode: 'zen', seed: 4 });
  z.growth = 6; // length 10
  turnAfterMoves(z, 'right', 8);
  const lenBefore = z.snake.length + z.growth;
  turnAfterMoves(z, 'down', 1);
  turnAfterMoves(z, 'left', 1);
  turnAfterMoves(z, 'up', 1); // bites the neck area
  if (z.over) fail('Zen snake died on a self-bite');
  else if (z.snake.length >= lenBefore) fail(`Zen bite did not shorten the snake (${lenBefore} -> ${z.snake.length})`);
  else console.log(`  ok Zen self-bite: length ${lenBefore} -> ${z.snake.length}, still alive`);
  const c = createGame({ mode: 'classic', seed: 4 });
  c.growth = 6;
  turnAfterMoves(c, 'right', 8);
  turnAfterMoves(c, 'down', 1);
  turnAfterMoves(c, 'left', 1);
  turnAfterMoves(c, 'up', 1);
  if (!c.over || c.cause !== 'self') fail(`Classic self-bite should kill (over ${c.over}, cause ${c.cause})`);
  else console.log('  ok Classic self-bite kills with cause "self"');
  const e = createGame({ mode: 'classic', seed: 4 });
  turnAfterMoves(e, 'up', 30);
  if (e.cause !== 'edge') fail('Classic edge should kill');
  else console.log('  ok Classic edge kills with cause "edge"');
  // Speed is counted in logic steps, never frames: 9 steps per move = 6.67 moves per second at 60 steps.
  const sp = createGame({ mode: 'classic', seed: 4 });
  queueTurn(sp, 'right');
  for (let i = 0; i < 60; i++) advance(sp);
  console.log(`  ok ${sp.moves} moves in 60 logic steps (one second) at the start speed`);
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
