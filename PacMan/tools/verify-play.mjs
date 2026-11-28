/**
 * PacMan gameplay check (browser):
 *   node PacMan/tools/verify-play.mjs
 *
 * 1. Starts a Pac-Man game from the menus with the keyboard (Down and Enter on PAC-MAN,
 *    then on PLAY): the level loads with its 244 dots and the game reaches play.
 * 2. A bot steers with the arrow keys (held down, as a player does) towards the nearest dot,
 *    keeping two tiles away from any ghost that isn't frightened. It must eat at least
 *    DOTS dots without losing a life; meanwhile the ghosts must leave home and move.
 * 3. Parking Pac-Man in a corner with no input lets a ghost catch him: a life is lost and
 *    the game carries on (dead state, then ready to restart).
 * pacman.js is one closure; the check reads its state through an accessor appended to the
 * served copy (the repository file is not changed). Exits non-zero on any failure.
 */
import { startCheck, waitFor, beforeIifeEnd, seededRandom } from '../../tools/play/harness.mjs';

const DOTS = 120;
const KEYS = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']; // the game's DIR_UP, DIR_LEFT, DIR_DOWN, DIR_RIGHT

const check = await startCheck('PacMan: the level loads, the ghosts move, Pac-Man eats and survives');
await check.run(async () => {
  const page = await check.open('PacMan/index.html', {
    init: seededRandom(11),
    intercept: {
      'PacMan/pacman.js': (src) => beforeIifeEnd(src, `
window.__pac = {
  get state() { return state; },
  states: { play: playState, dead: deadState, home: homeState, over: overState },
  get map() { return map; },
  pacman: pacman,
  ghosts: ghosts,
  get lives() { return extraLives; },
  score: function () { return getScore(); },
  GHOST_OUTSIDE: GHOST_OUTSIDE
};`),
    },
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => window.__pac && window.__pac.state === window.__pac.states.home);
  await page.waitForTimeout(300);

  // 1. Menus: Down selects the first entry, Enter picks it: PAC-MAN, then PLAY.
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  const loaded = await waitFor(page, () => !!window.__pac.map && window.__pac.map.numDots, null, { timeout: 10000 });
  check.ok(loaded === 244, `PLAY loads the Pac-Man maze (${loaded || 'no map'} dots)`);
  const playing = await waitFor(page, () => window.__pac.state === window.__pac.states.play, null, { timeout: 15000 });
  check.ok(playing, 'the game reaches play after READY');
  if (!playing) return;
  const start = await page.evaluate(() => ({
    lives: window.__pac.lives,
    ghosts: window.__pac.ghosts.map((g) => ({ x: g.pixel.x, y: g.pixel.y })),
  }));

  // 2. The bot. Breadth-first search over floor tiles to the nearest dot, avoiding tiles
  // near dangerous ghosts; returns the direction of the first step.
  await page.evaluate(() => {
    const P = window.__pac;
    const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]]; // up, left, down, right
    window.__plan = () => {
      const map = P.map;
      const me = P.pacman.tile;
      const danger = new Set();
      for (const g of P.ghosts) {
        if (g.mode !== P.GHOST_OUTSIDE || g.scared) continue;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dy) <= 2) danger.add(`${g.tile.x + dx},${g.tile.y + dy}`);
        }
      }
      const wrap = (x) => (x + map.numCols) % map.numCols;
      const seen = new Map([[`${me.x},${me.y}`, -1]]);
      const queue = [[me.x, me.y, -1]];
      while (queue.length) {
        const [x, y, first] = queue.shift();
        const t = map.getTile(x, y);
        if (first >= 0 && (t === '.' || t === 'o')) return first;
        DIRS.forEach(([dx, dy], d) => {
          const nx = wrap(x + dx);
          const ny = y + dy;
          const key = `${nx},${ny}`;
          if (seen.has(key) || !map.isFloorTile(nx, ny) || danger.has(key)) return;
          seen.set(key, first < 0 ? d : first);
          queue.push([nx, ny, first < 0 ? d : first]);
        });
      }
      // No safe way to a dot: step to the open neighbour farthest from the ghosts.
      let best = -1;
      let bestDist = -1;
      DIRS.forEach(([dx, dy], d) => {
        const nx = wrap(me.x + dx);
        const ny = me.y + dy;
        if (!map.isFloorTile(nx, ny)) return;
        const dist = Math.min(...P.ghosts.map((g) => Math.abs(g.tile.x - nx) + Math.abs(g.tile.y - ny)));
        if (dist > bestDist) {
          bestDist = dist;
          best = d;
        }
      });
      return best;
    };
    window.__status = () => ({
      state: P.state === P.states.play ? 'play' : P.state === P.states.dead ? 'dead' : 'other',
      eaten: P.map.dotsEaten,
      lives: P.lives,
      score: P.score(),
      out: P.ghosts.filter((g) => g.mode === P.GHOST_OUTSIDE).length,
    });
  });

  let held = null;
  const hold = async (d) => {
    const key = d >= 0 ? KEYS[d] : null;
    if (key === held) return;
    if (held) await page.keyboard.up(held);
    if (key) await page.keyboard.down(key);
    held = key;
  };
  const began = Date.now();
  let st = await page.evaluate(() => window.__status());
  let maxOut = 0;
  while (Date.now() - began < 60000 && st.state === 'play' && st.eaten < DOTS) {
    await hold(await page.evaluate(() => window.__plan()));
    await page.waitForTimeout(15);
    st = await page.evaluate(() => window.__status());
    maxOut = Math.max(maxOut, st.out);
  }
  await hold(-1);
  const secs = ((Date.now() - began) / 1000).toFixed(0);
  check.ok(st.eaten >= DOTS && st.lives === start.lives && st.state === 'play',
    `the bot eats ${st.eaten} dots in ${secs}s without dying (score ${st.score}, lives ${st.lives}/${start.lives})`);
  const moved = await page.evaluate((before) => window.__pac.ghosts.filter((g, i) => g.pixel.x !== before[i].x || g.pixel.y !== before[i].y).length, start.ghosts);
  check.ok(moved === 4 && maxOut >= 2, `the ghosts move (${moved} of 4 moved, up to ${maxOut} outside home at once)`);

  // 3. No input: a ghost catches Pac-Man, a life is lost and play resumes.
  const caught = await waitFor(page, () => window.__pac.state === window.__pac.states.dead, null, { timeout: 40000, interval: 50 });
  check.ok(caught, 'with no input a ghost catches Pac-Man');
  const resumed = await waitFor(page, (lives) => window.__pac.state === window.__pac.states.play && window.__pac.lives === lives - 1, start.lives, { timeout: 15000 });
  check.ok(resumed, `a life is lost and play resumes (lives ${await page.evaluate(() => window.__pac.lives)})`);
  check.noErrors(page);
});
