/**
 * A simple, human-like bot: it follows each stage's route (the same one as
 * tools/route.mjs) and reacts to hazards the way a careful player would: it
 * jumps a barrel or spark coming at it along the girder, and waits at the foot
 * or the top of a ladder while something is coming down it.
 *
 *   node Barrel_Tower/tools/bot.mjs [tries]
 *
 * Prints how often it clears each stage in each round. The lifts need timing
 * the bot doesn't attempt, so they are left to tools/explore.mjs --hazards.
 */
import { createWorld } from '../src/sim.js';

const ROUTES = {
  ramps: [['walk', 180], ['up'], ['walk', 104], ['up'], ['walk', 188], ['up'], ['walk', 76], ['up'], ['walk', 160], ['up'], ['walk', 112], ['up']],
  rivets: [
    ['walk', 112], ['up'], ['walk', 176], ['jump', -1], ['walk', 48], ['walk', 32], ['up'],
    ['walk', 64], ['walk', 178], ['walk', 200], ['up'], ['walk', 158], ['walk', 46], ['walk', 36], ['up'],
    ['walk', 66], ['walk', 80], ['down'], ['walk', 163], ['jump', 1], ['walk', 188], ['up'], ['walk', 158],
  ],
};

export function playBot(stage, round, seed) {
  const w = createWorld({ stage, round, seed });
  const h = w.hero;
  const route = ROUTES[stage];
  let op = 0;
  let wait = 0;
  let jumpHeld = false;
  for (let t = 0; t < 60 * 120 && !w.outcome; t++) {
    const input = {};
    if (h.mode === 'walk' && op < route.length) {
      const [kind, arg] = route[op];
      const threats = [...w.barrels, ...w.sparks].filter((e) => e.mode !== 'ladder' && e.mode !== 'climb' && Math.abs(e.y - h.y) < 4);
      if (kind === 'walk') {
        const dir = Math.sign(arg - h.x);
        if (Math.abs(arg - h.x) <= 0.6) {
          op++;
        } else {
          // Jump whatever is coming at us along this girder.
          const ahead = threats.some((e) => {
            const d = (e.x - h.x) * dir;
            return d > 0 && d < 22;
          });
          if (dir < 0) input.left = true;
          else input.right = true;
          if (ahead && !jumpHeld) input.jump = true;
        }
      } else if (kind === 'jump') {
        input.jump = !jumpHeld;
        if (arg < 0) input.left = true;
        else input.right = true;
        if (input.jump) op++;
      } else {
        // Don't start up or down a ladder while something is on it or about to drop on it.
        const ladder = w.ladders.find((l) => !l.broken && Math.abs(l.x - h.x) <= 4 && Math.abs(l[kind === 'up' ? 'bottom' : 'top'] - h.y) <= 3);
        const busy =
          ladder &&
          [...w.barrels, ...w.sparks].some(
            (e) => (Math.abs(e.x - ladder.x) < 8 && e.y >= ladder.top - 2 && e.y <= ladder.bottom + 2) || (Math.abs(e.y - ladder.top) < 4 && Math.abs(e.x - ladder.x) < 30),
          );
        const near = threats.some((e) => Math.abs(e.x - h.x) < 18);
        if (near && !jumpHeld) input.jump = true;
        else if (busy && wait < 240) wait++;
        else {
          input[kind] = true;
          wait = 0;
        }
      }
    } else if (h.mode === 'climb') {
      input[route[op][0]] = true;
      if (route[op][0] !== 'up' && route[op][0] !== 'down') input.up = true;
    }
    jumpHeld = !!input.jump;
    const before = h.mode;
    w.step(input);
    if (before === 'climb' && h.mode === 'walk') op++;
  }
  return w.hero.mode === 'won' || w.outcome === 'clear';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tries = +(process.argv[2] || 40);
  for (const stage of Object.keys(ROUTES)) {
    const row = [];
    for (let round = 1; round <= 5; round++) {
      let wins = 0;
      for (let seed = 1; seed <= tries; seed++) if (playBot(stage, round, seed)) wins++;
      row.push(`r${round} ${((wins / tries) * 100).toFixed(0).padStart(3)}%`);
    }
    console.log(stage.padEnd(7), row.join('  '));
  }
}
