/**
 * Wahdatio gameplay check (browser):
 *   node Wahdatio/tools/verify-play.mjs
 *
 * A player bot that only uses the mouse, the way a person plays:
 * 1. Clicks the TUTORIAL 1 node on the menu sphere, then wins level 1 (TUTORIAL 1) by
 *    dragging from its blue node onto the red one until no red node is active ("ONLINE!").
 * 2. Plays EASY, the first level where the red nodes fight back (the red start node is on
 *    the far side of the sphere): it spreads to the free nodes, drags the sphere round to
 *    find the red nodes, and attacks them until it wins.
 * The script runs inside a closure; the check reads its state (dot positions, owners,
 * winner) through a getter appended to the served copy, without changing the file.
 * Exits non-zero on any failure.
 */
import { startCheck, waitFor, beforeIifeEnd, seededRandom } from '../../tools/play/harness.mjs';

const check = await startCheck('Wahdatio: a mouse-driven bot wins level 1 and EASY');

// Screen positions and state of every node, as the player sees them.
const readDots = () => {
  const w = window.__wah.world;
  return w.dots.map((d, i) => {
    const p = window.__wah.u2s(d.v);
    return { i, x: p.x, y: p.y, v: [d.v.x, d.v.y, d.v.z], front: d.depth() >= 0.6, own: d.own, units: d.units, target: d.targetUnits, active: d.units >= d.minUnits };
  });
};

/** Drag from one screen point to another with the left button, like a person. */
async function drag(page, a, b, { hold = 0, steps = 8 } = {}) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps });
  if (hold) await page.waitForTimeout(hold); // let the spin die down so the release adds none
  await page.mouse.up();
}

const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
/** Processes that arrive when `src` attacks `dst` (the game's rule: half, less a distance cost). */
const arriving = (src, dst) => Math.ceil(Math.ceil(src.target * 0.5) * (1 - (0.5 * angle(src.v, dst.v) * 180 / Math.PI) / 180));

/**
 * Turn the sphere by dragging on empty space beside it, so `goal` (a node) comes to the
 * front. Dragging sideways by d pixels turns the sphere by d / radius radians.
 */
async function turnTowards(page, goal, c) {
  const [x, y, z] = goal.v;
  const yaw = Math.atan2(x, z);
  const pitch = Math.atan2(y, Math.hypot(x, z));
  const max = c.r * 0.8;
  const dx = Math.max(-max, Math.min(max, -yaw * c.r));
  const dy = Math.max(-max, Math.min(max, -pitch * c.r));
  const start = { x: c.x - c.r - 30, y: c.y };
  await drag(page, start, { x: start.x + dx, y: start.y + dy }, { hold: 600, steps: 12 });
}

/** Play the current level until someone wins or `ms` passes. */
async function playLevel(page, ms) {
  const end = Date.now() + ms;
  const stats = { winner: null, attacks: 0, spreads: 0, turns: 0 };
  while (Date.now() < end) {
    stats.winner = await page.evaluate(() => window.__wah.world.winner);
    if (stats.winner) break;
    const c = await page.evaluate(() => window.__wah.center());
    const dots = await page.evaluate(readDots);
    // Our settled nodes with processes to spare, anywhere on the sphere.
    const mine = dots.filter((d) => d.own === 'usr' && d.units === d.target && d.target >= 24);
    const reds = dots.filter((d) => d.own === 'bot' && d.active);
    if (!reds.length) {
      await page.waitForTimeout(300); // the win is counted on the next tick
      continue;
    }
    // Attack the red node that the fewest of our nodes can switch off together (bring under
    // the 12 processes a node needs to act, or take over), starting with the strongest blow.
    let move = null;
    for (const red of reds) {
      // (Only nodes that can share the screen with it: not more than ~135 degrees away.)
      const blows = mine.filter((src) => angle(src.v, red.v) < 2.4).map((src) => ({ src, n: arriving(src, red) })).sort((a, b) => b.n - a.n);
      let sum = 0;
      let count = 0;
      for (const b of blows) {
        if (sum >= red.target - 11) break;
        sum += b.n;
        count++;
      }
      if (sum < red.target - 11 || !count) continue;
      if (!move || count < move.count || (count === move.count && red.v[2] > move.dst.v[2])) {
        move = { src: blows[0].src, dst: red, count, kind: 'attacks' };
      }
    }
    if (!move) {
      const giver = mine.filter((d) => d.target >= 30).sort((a, b) => b.target - a.target)[0];
      const free = dots.filter((d) => d.own === '');
      if (giver && free.length) {
        const dst = free.sort((a, b) => angle(giver.v, a.v) - angle(giver.v, b.v))[0];
        move = { src: giver, dst, kind: 'spreads' };
      }
    }
    // Nothing decisive: drain a red node when waiting won't help (no growth on this level)
    // or a node of ours is full enough.
    const growth = await page.evaluate(() => window.__wah.world.addUnit);
    if (!move) {
      for (const src of mine.filter((d) => !growth || d.target >= 100)) {
        for (const red of reds.filter((d) => angle(src.v, d.v) < 2.4)) {
          const n = arriving(src, red);
          if (!move || n > move.n) move = { src, dst: red, n, kind: 'attacks' };
        }
      }
    }
    if (!move) {
      await page.waitForTimeout(400); // grow
      continue;
    }
    if (move.src.front && move.dst.front) {
      await drag(page, move.src, move.dst);
      stats[move.kind]++;
      await page.waitForTimeout(250);
    } else {
      // Turn the sphere so both nodes face the player.
      const m = move.src.v.map((v, k) => v + move.dst.v[k]);
      const len = Math.hypot(...m) || 1;
      await turnTowards(page, { v: m.map((v) => v / len) }, c);
      stats.turns++;
    }
  }
  return stats;
}

await check.run(async () => {
  const page = await check.open('Wahdatio/index.html', {
    init: seededRandom(5),
    intercept: {
      'Wahdatio/script.js': (src) => beforeIifeEnd(src, `
        window.__wah = {
          get world() { return world; },
          u2s: u2s,
          center: function() { return { x: screen.center.x, y: screen.center.y, r: screen.radius }; },
          load: forceLevel
        };`),
    },
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, () => window.__wah?.world.level?.name === 'menu');
  await page.waitForTimeout(500);

  // 1. Level 1 from the menu.
  const menuDot = await page.evaluate(() => {
    const w = window.__wah.world;
    const d = w.dots.find((x) => x.level === 'TUTORIAL 1');
    const p = window.__wah.u2s(d.v);
    return { x: p.x, y: p.y };
  });
  // The first press anywhere clears the title that covers the middle of the sphere.
  const c0 = await page.evaluate(() => window.__wah.center());
  await page.mouse.click(c0.x + c0.r * 1.2, c0.y + c0.r * 0.9);
  await page.waitForTimeout(200);
  await page.mouse.click(menuDot.x, menuDot.y);
  const loaded = await waitFor(page, () => window.__wah.world.level?.name === 'TUTORIAL 1');
  check.ok(loaded, 'clicking the TUTORIAL 1 node on the menu opens level 1');
  const one = await playLevel(page, 30000);
  check.ok(one.winner === 'usr', `the bot wins level 1 (winner ${one.winner}, ${one.attacks} drag attack(s))`);
  const shown = await page.evaluate(() => document.querySelector('.msg')?.textContent || '');
  check.ok(/ONLINE/.test(shown), `the win message shows (${shown || 'none'})`);
  check.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('wahdatio.prefs') || '{}')['TUTORIAL 1'] === true), 'the win is saved');

  // 2. EASY: the red nodes fight back. (Opened by name: on the menu its node sits on the rim.)
  await page.evaluate(() => window.__wah.load('EASY'));
  const easy = await page.evaluate(() => window.__wah.world.level?.name === 'EASY' && !window.__wah.world.winner);
  check.ok(easy, 'EASY loads');
  if (easy) {
    const two = await playLevel(page, 90000);
    check.ok(two.winner === 'usr', `the bot wins EASY against the red AI (winner ${two.winner}: ${two.spreads} spread(s), ${two.attacks} attack(s), ${two.turns} turn(s) of the sphere)`);
  }
  check.noErrors(page);
});
