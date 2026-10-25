/**
 * Builds input runs from a readable route (walk to x, climb, jump), checking
 * each step as it goes. Used to write tools/runs.json:
 *
 *   node Barrel_Tower/tools/route.mjs <stage>
 */
import { createWorld } from '../src/sim.js';
import { compress, inputFor } from './run.mjs';

export function recorder(stage, opts = {}) {
  const w = createWorld({ stage, hazards: false, ...opts });
  const steps = [];
  const h = w.hero;
  const press = (s, n = 1) => {
    for (let i = 0; i < n && !w.outcome; i++) {
      w.step(inputFor(s));
      steps.push(s);
    }
  };
  const api = {
    w,
    steps,
    walkTo(x) {
      let n = 0;
      while (Math.abs(h.x - x) > 0.6 && h.mode === 'walk') {
        press(h.x < x ? 'R' : 'L');
        if (++n > 600) throw new Error(`walkTo ${x} stuck at ${h.x}`);
      }
      if (h.mode !== 'walk' && h.mode !== 'won') throw new Error(`walkTo ${x}: ${h.mode} at ${h.x.toFixed(1)},${h.y.toFixed(1)}`);
      return api;
    },
    climb(dir) {
      const k = dir === 'up' ? 'U' : 'D';
      press(k);
      if (h.mode !== 'climb') throw new Error(`no ladder ${dir} at ${h.x.toFixed(1)},${h.y.toFixed(1)}`);
      while (h.mode === 'climb') press(k);
      return api;
    },
    jump(dir) {
      press(dir === 'left' ? 'LJ' : dir === 'right' ? 'RJ' : 'J');
      while (h.mode === 'air') press('_');
      if (h.mode !== 'walk' && h.mode !== 'won') throw new Error(`jump ${dir} ended ${h.mode} at ${h.x.toFixed(1)},${h.y.toFixed(1)}`);
      return api;
    },
    run: () => compress(steps),
  };
  return api;
}

const ROUTES = {
  ramps(r) {
    for (const x of [180, 104, 188, 76, 160, 112]) r.walkTo(x).climb('up');
  },
  rivets(r) {
    r.walkTo(112).climb('up'); // floor 1
    r.walkTo(176); // pops 168
    r.jump('left').walkTo(48); // over the new gap, then pops 56
    r.walkTo(32).climb('up'); // floor 2
    r.walkTo(64).walkTo(178); // pops 56, then 168
    r.walkTo(200).climb('up'); // floor 3
    r.walkTo(158).walkTo(46); // pops 168, then 56
    r.walkTo(36).climb('up'); // top floor
    r.walkTo(66).walkTo(80).climb('down'); // pops 56, back down to floor 3
    r.walkTo(163).jump('right').walkTo(188).climb('up'); // round to the right side
    r.walkTo(158); // pops the last rivet
  },
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const stage = process.argv[2];
  const r = recorder(stage);
  ROUTES[stage](r);
  for (let i = 0; i < 200 && !r.w.outcome; i++) r.w.step({});
  const left = r.w.def.rivets?.filter((x) => !x.popped).map((x) => `${x.x}@${x.y}`) ?? [];
  console.log(r.w.hero.mode, r.w.outcome, r.steps.length, 'steps', left.length ? 'rivets left: ' + left.join(' ') : '');
  console.log(r.run());
}
