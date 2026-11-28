/**
 * PacMan Slasher gameplay check (browser):
 *   node PacMan_Slasher/tools/verify-play.mjs
 *
 * 1. Starts a first game (the practice round) and draws each of the eight symbols with the
 *    mouse on the game canvas: line, vertical line, V, inverted V, '/', '\', circle and the
 *    bonus zigzag. Each stroke must be recognised as that symbol by the game's own
 *    recogniser (cogniteGesture, as called when the stroke ends). A short tap must not
 *    count as a symbol.
 * 2. The last two strokes (line and vertical line) slash the two practice Pac-Men, which
 *    starts wave 1.
 * 3. A bot reads the symbols over each Pac-Man and draws them until wave 1 is clear,
 *    without losing all its lives.
 * The game's state is read through a small accessor added to the served copy of
 * js/game.js (the repository file is not changed). Exits non-zero on any failure.
 */
import { startCheck, waitFor, seededRandom } from '../../tools/play/harness.mjs';

const G = { unknown: 0, click: 1, swypeLR: 2, swypeTD: 3, swypeDTD: 4, swypeTDT: 5, swypeTLRD: 6, slash: 7, backslash: 8, circle: 9 };
const NAME = Object.fromEntries(Object.entries(G).map(([k, v]) => [v, k]));

/** Stroke points (client pixels) for each symbol, around the centre (cx, cy). */
function strokeFor(token, cx, cy, s = 120) {
  switch (token) {
    case G.swypeLR: return [[cx - s, cy], [cx + s, cy]];
    case G.swypeTD: return [[cx, cy - s], [cx, cy + s]];
    case G.swypeDTD: return [[cx - s, cy - s], [cx, cy + s], [cx + s, cy - s]]; // V
    case G.swypeTDT: return [[cx - s, cy + s], [cx, cy - s], [cx + s, cy + s]]; // inverted V
    case G.slash: return [[cx - s, cy + s], [cx + s, cy - s]];
    case G.backslash: return [[cx - s, cy - s], [cx + s, cy + s]];
    case G.swypeTLRD: return [[cx - s / 2, cy - s], [cx + s / 2, cy - s / 3], [cx - s / 2, cy + s / 3], [cx + s / 2, cy + s]];
    case G.circle: {
      const pts = [];
      for (let i = 0; i <= 24; i++) pts.push([cx + s * Math.cos((i / 24) * 2 * Math.PI), cy + s * Math.sin((i / 24) * 2 * Math.PI)]);
      return pts;
    }
    default: throw new Error(`no stroke for ${token}`);
  }
}

/** Draw a stroke with the mouse (pressed between the first and last point). */
async function draw(page, points) {
  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    await page.mouse.move(x1, y1, { steps: Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 12)) });
  }
  await page.mouse.up();
}

const check = await startCheck('PacMan Slasher: every symbol is recognised, wave 1 is cleared');
await check.run(async () => {
  const page = await check.open('PacMan_Slasher/index.html', {
    init: seededRandom(3),
    intercept: {
      'PacMan_Slasher/js/game.js': (src) => {
        const hook = '  return _engine;\n}());';
        if (!src.includes(hook)) throw new Error('PacMan_Slasher/js/game.js: engine closure end not found');
        return src.replace(hook, '  _engine.__peek = () => ({ enemies, wave, wavePhase, score, mode, health: player.health, active: isActive });\n' + hook);
      },
    },
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#start:not(.hidden)', { timeout: 20000 });
  // Record what the recogniser returns; the last call for a stroke is the one at mouse-up.
  await page.evaluate(() => {
    const real = window.cogniteGesture;
    window.__lastGesture = null;
    window.cogniteGesture = (path) => (window.__lastGesture = real(path));
  });
  await page.click('#start');
  const demo = await waitFor(page, () => engine.isActive() && engine.__peek().mode === 'demo' && engine.__peek().enemies.length === 2);
  check.ok(demo, 'Start opens the practice round with two Pac-Men');

  const box = await page.evaluate(() => {
    const r = document.getElementById('txt').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  });
  const size = Math.min(120, Math.min(box.w, box.h) / 3);

  // 1. Each symbol, drawn with the mouse. Line and vertical line last: they slash the practice Pac-Men.
  const order = [G.swypeDTD, G.swypeTDT, G.slash, G.backslash, G.circle, G.swypeTLRD, G.swypeLR, G.swypeTD];
  const recognised = [];
  for (const token of order) {
    await page.evaluate(() => (window.__lastGesture = null));
    await draw(page, strokeFor(token, box.x, box.y, size));
    const got = await page.evaluate(() => window.__lastGesture);
    recognised.push(got === token);
    check.ok(got === token, `${NAME[token].padEnd(9)} drawn with the mouse is recognised (${NAME[got] ?? got})`);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => (window.__lastGesture = null));
  await page.mouse.click(box.x + 5, box.y + 5);
  const tap = await page.evaluate(() => window.__lastGesture);
  check.ok(tap === G.click, `a tap is a click, not a symbol (${NAME[tap] ?? tap})`);

  // 2. The two practice Pac-Men are gone and wave 1 starts.
  const wave1 = await waitFor(page, () => engine.__peek().mode === 'waves' && engine.__peek().wave === 1, null, { timeout: 5000 });
  const afterDemo = await page.evaluate(() => engine.__peek().score);
  check.ok(wave1 && afterDemo > 0, `slashing the practice Pac-Men starts wave 1 (score ${afterDemo})`);

  // 3. Clear wave 1: draw the last symbol of the chain over the nearest Pac-Man.
  const started = Date.now();
  let strokes = 0;
  let state;
  while (Date.now() - started < 60000) {
    state = await page.evaluate(() => {
      const s = engine.__peek();
      return {
        wave: s.wave, phase: s.wavePhase, score: s.score, health: s.health, active: s.active,
        next: s.enemies.filter((e) => e.active && e.tokens.length)
          .sort((a, b) => a.tokens.length - b.tokens.length)
          .map((e) => e.tokens[e.tokens.length - 1])[0],
      };
    });
    if (!state.active || state.wave > 1 || state.phase === 'clear') break;
    if (state.phase === 'fight' && state.next) {
      await draw(page, strokeFor(state.next, box.x, box.y, size));
      strokes++;
    }
    await page.waitForTimeout(150);
  }
  check.ok(state.active && (state.phase === 'clear' || state.wave > 1),
    `the bot clears wave 1 with ${strokes} strokes (score ${state.score}, lives left ${state.health}, ${((Date.now() - started) / 1000).toFixed(0)}s)`);
  check.noErrors(page);
});
