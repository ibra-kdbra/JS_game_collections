/**
 * Proves every campaign level is well formed and beatable.
 *
 *   node Breakout/tools/verify-levels.mjs [runsPerLevel]
 *
 * 1. Static check: every breakable brick can be reached from open air.
 * 2. Physics checks: a very fast ball can't tunnel; a flat ball can't loop.
 * 3. A 'perfect' bot plays each level with several seeds and must clear it.
 * 4. A 'casual' bot (keyboard speed, late, loose aim) rates the difficulty
 *    by how many lives it loses and how often it clears within 3 lives.
 * 5. The ramp: each act must cost the casual bot more lives on average than
 *    the act before. A level clearly easier than the one before it in the
 *    same act, or a last level that is not the hardest, is reported; with
 *    few runs that is noisy, so use 48 runs before reordering on it.
 */
import { CONFIG, levelSpeed } from '../src/config.js';
import { LEVELS, parseMap, unreachableCount, mulberry32, generateLevel } from '../src/levels.js';
import { createWorld } from '../src/sim.js';
import { createBot } from '../src/bot.js';

const RUNS = Number(process.argv[2] ?? 6);
const lostByLevel = [];
const DT = 1 / 60;
const LIMIT = 900; // seconds of game time per attempt
let failures = 0;

function play(map, speed, seed, skill, lives = 99) {
  const rng = mulberry32(seed);
  const world = createWorld({ map, speed, rng, lives });
  const bot = createBot(world, mulberry32(seed + 1), skill);
  let steps = 0;
  let maxSpeed = 0;
  while (world.state !== 'cleared' && world.state !== 'dead' && steps * DT < LIMIT) {
    world.step(DT, bot.input(DT));
    bot.observe(world.drainEvents());
    for (const b of world.balls) maxSpeed = Math.max(maxSpeed, b.speed);
    steps++;
  }
  return { cleared: world.state === 'cleared', time: steps * DT, lost: world.livesLost, left: world.breakable, score: world.score, maxSpeed };
}

// ---------- 2. Physics sanity ----------
{
  const map = '\n............\n............\n............\n............\n............\n............\n............\n111111111111';
  const world = createWorld({ map, speed: 3000, rng: mulberry32(3) });
  world.step(DT, { launch: true });
  world.balls[0].dx = 0.05;
  world.balls[0].dy = -1;
  let broke = 0;
  for (let i = 0; i < 30; i++) {
    world.step(DT, {});
    broke += world.drainEvents().filter((e) => e.type === 'break').length;
  }
  const ok = broke >= 1;
  console.log(`tunnelling at 3000 px/s: ${ok ? 'ok' : 'FAIL'} (broke ${broke})`);
  if (!ok) failures++;
}
{
  const map = '\n############\n............\n............';
  const world = createWorld({ map, speed: 400, rng: mulberry32(4) });
  world.step(DT, { launch: true });
  const b = world.balls[0];
  b.x = 240;
  b.y = 200;
  b.dx = 1;
  b.dy = 0;
  let minAbsDy = 1;
  for (let i = 0; i < 600; i++) {
    world.step(DT, { targetX: world.balls[0]?.x ?? 240 });
    if (world.balls[0]) minAbsDy = Math.min(minAbsDy, Math.abs(world.balls[0].dy));
  }
  const ok = minAbsDy >= CONFIG.ball.minVerticalRatio - 1e-6;
  console.log(`horizontal loop guard: ${ok ? 'ok' : 'FAIL'} (min |dy| ${minAbsDy.toFixed(3)})`);
  if (!ok) failures++;
}

// ---------- 1, 3, 4. Levels ----------
console.log('\n #  name               act  bricks  reach  perfect clears  avg time  casual 3-life clears  casual lives lost');
LEVELS.forEach((level, i) => {
  const cells = parseMap(level.map);
  const bricks = cells.flat().filter((c) => c && c.kind !== 'steel').length;
  const unreachable = unreachableCount(cells);
  const speed = levelSpeed(i + 1);
  const perfect = [];
  const casual = [];
  for (let s = 0; s < RUNS; s++) {
    perfect.push(play(level.map, speed, 1000 + i * 31 + s, 'perfect'));
    casual.push(play(level.map, speed, 5000 + i * 31 + s, 'casual'));
  }
  const pClear = perfect.filter((r) => r.cleared).length;
  const avg = perfect.reduce((a, r) => a + r.time, 0) / RUNS;
  const c3 = casual.filter((r) => r.cleared && r.lost < CONFIG.lives.start).length;
  const cLost = casual.reduce((a, r) => a + r.lost, 0) / RUNS;
  lostByLevel.push({ act: level.act, lost: cLost, name: level.name });
  const bad = unreachable > 0 || pClear < RUNS;
  if (bad) failures++;
  console.log(
    `${String(i + 1).padStart(2)}  ${level.name.padEnd(18)} ${String(level.act + 1).padStart(3)}  ${String(bricks).padStart(6)}  ${unreachable ? 'FAIL' : '  ok'}  ${String(pClear).padStart(7)}/${RUNS}       ${avg.toFixed(0).padStart(5)}s  ${String(c3).padStart(13)}/${RUNS}  ${cLost.toFixed(2).padStart(17)}`,
  );
});

// ---------- 5. Ramp ----------
{
  const acts = [...new Set(lostByLevel.map((l) => l.act))];
  const avg = acts.map((a) => {
    const ls = lostByLevel.filter((l) => l.act === a);
    return ls.reduce((s, l) => s + l.lost, 0) / ls.length;
  });
  console.log(`\ncasual lives lost per act: ${avg.map((v, i) => `act ${acts[i] + 1} ${v.toFixed(2)}`).join(', ')}`);
  for (let i = 1; i < avg.length; i++) {
    if (avg[i] <= avg[i - 1]) {
      console.log(`FAIL act ${acts[i] + 1} is not harder than act ${acts[i - 1] + 1}`);
      failures++;
    }
  }
  const last = lostByLevel[lostByLevel.length - 1];
  if (lostByLevel.some((l) => l.lost > last.lost)) console.log(`note: the last level (${last.name}) is not the hardest`);
  for (let i = 1; i < lostByLevel.length; i++) {
    const [a, b] = [lostByLevel[i - 1], lostByLevel[i]];
    if (a.act === b.act && b.lost < a.lost - 0.75) console.log(`note: ${b.name} (${b.lost.toFixed(2)}) is easier than ${a.name} (${a.lost.toFixed(2)}) before it`);
  }
}

// ---------- Endless sample ----------
let endlessOk = 0;
const STAGES = 20;
for (let stage = 1; stage <= STAGES; stage++) {
  const lvl = generateLevel(stage, 77);
  const r = play(lvl.map, CONFIG.endless.speedStart + CONFIG.endless.speedPerStage * stage, 900 + stage, 'perfect');
  if (r.cleared && unreachableCount(parseMap(lvl.map)) === 0) endlessOk++;
}
console.log(`\nendless stages 1-${STAGES} cleared by the bot: ${endlessOk}/${STAGES}`);
if (endlessOk < STAGES) failures++;

console.log(failures ? `\n${failures} problem(s) found` : '\nall levels verified');
process.exit(failures ? 1 : 0);
