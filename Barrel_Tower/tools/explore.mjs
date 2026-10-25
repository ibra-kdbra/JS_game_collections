/**
 * Searches for an input run that clears a stage, Go-Explore style: keep an
 * archive of distinct positions reached, pick one (rare and close to the goal
 * first), replay the run to it and try random input from there.
 *
 *   node Barrel_Tower/tools/explore.mjs <stage> [round] [seed] [iterations] [--hazards]
 *
 * Prints the run in the format of tools/runs.json.
 */
import { createWorld } from '../src/sim.js';
import { compress, inputFor } from './run.mjs';

const [stage = 'ramps', round = '1', seed = '1', iters = '20000'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const hazards = process.argv.includes('--hazards');
const ACTIONS = ['R', 'L', 'U', 'D', 'RJ', 'LJ', 'J', '_'];

function play(steps, onStep) {
  const w = createWorld({ stage, round: +round, seed: +seed, hazards });
  for (let i = 0; i < steps.length; i++) {
    w.step(inputFor(steps[i]));
    if (onStep && onStep(w, i) === false) break;
    if (w.hero.mode === 'won' || w.hero.mode === 'dead') break;
  }
  return w;
}

function progress(w) {
  const h = w.hero;
  const d = w.def;
  if (d.goal) return Math.hypot(h.x - (d.goal.x1 + d.goal.x2) / 2, (h.y - d.goal.y) * 2.5);
  const left = d.rivets.filter((r) => !r.popped);
  if (!left.length) return 0;
  return left.length * 400 + Math.min(...left.map((r) => Math.abs(h.x - r.x) + Math.abs(h.y - r.y) * 3));
}

function cell(w) {
  const h = w.hero;
  const bits = w.def.rivets ? w.def.rivets.map((r) => (r.popped ? 1 : 0)).join('') : '';
  const lift = w.lifts.length ? Math.floor((w.lifts[0].y % 64) / 16) : 0;
  return [h.x >> 3, h.y >> 3, h.mode, h.hammer > 0 ? 1 : 0, bits, lift, hazards && process.env.TIMECELL ? Math.floor(w.time / 120) : 0].join(';');
}

const archive = new Map();
const add = (k, steps, w) => {
  const c = archive.get(k);
  if (!c) archive.set(k, { steps, visits: 0, d: progress(w) });
  else if (steps.length < c.steps.length) c.steps = steps;
};
add('start', [], createWorld({ stage, round: +round, seed: +seed, hazards }));

function suffix(n) {
  const out = [];
  let a = ACTIONS[0];
  while (out.length < n) {
    if (Math.random() < 0.4) a = ACTIONS[(Math.random() * ACTIONS.length) | 0];
    const len = 4 + ((Math.random() * 30) | 0);
    for (let i = 0; i < len; i++) out.push(a);
    // Jumps need the button released between presses.
    if (a.includes('J')) out.push(a.replace('J', '') || '_');
  }
  return out.slice(0, n);
}

const t0 = Date.now();
let cells = [];
for (let it = 0; it < +iters; it++) {
  if (it % 50 === 0) cells = [...archive.values()];
  let total = 0;
  const wts = cells.map((c) => {
    const v = (1 / Math.sqrt(c.visits + 1)) * (1 + 6 * Math.exp(-c.d / 40));
    total += v;
    return v;
  });
  let r = Math.random() * total;
  let pick = cells[0];
  for (let i = 0; i < cells.length; i++) if ((r -= wts[i]) <= 0) { pick = cells[i]; break; }
  pick.visits++;
  const steps = pick.steps.concat(suffix(120));
  let won = -1;
  play(steps, (w, i) => {
    if (w.hero.mode === 'won') { won = i; return false; }
    if (w.hero.mode === 'dead') return false;
    if (i >= pick.steps.length - 1) add(cell(w), steps.slice(0, i + 1), w);
  });
  if (won >= 0) {
    const run = steps.slice(0, won + 1);
    const w = play(run);
    console.log(`solved after ${it} tries, ${archive.size} cells, ${run.length} steps, ${((Date.now() - t0) / 1000).toFixed(1)} s: ${w.hero.mode}`);
    console.log(compress(run));
    process.exit(0);
  }
  if (it % 1000 === 0) {
    const best = [...archive.values()].sort((a, b) => a.d - b.d)[0];
    console.error(`it ${it} cells ${archive.size} best ${best.d.toFixed(0)} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
{
  const best = [...archive.values()].sort((a, b) => a.d - b.d)[0];
  const w = play(best.steps);
  const left = w.def.rivets ? w.def.rivets.filter((r) => !r.popped).map((r) => `${r.x}@${r.y}`).join(' ') : '';
  console.log(`not solved; closest ${best.d.toFixed(0)} at ${w.hero.x.toFixed(0)},${w.hero.y.toFixed(0)} ${w.hero.mode} ${left}`);
}
process.exit(1);
