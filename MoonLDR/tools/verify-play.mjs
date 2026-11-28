/**
 * MoonLDR gameplay check (browser):
 *   node MoonLDR/tools/verify-play.mjs
 *
 * On the classic terrain at PILOT difficulty, with a seeded Math.random (fixed spawns):
 * 1. An autopilot flies the lander with the arrow keys (key events on the window, read by
 *    the game's own handlers) and lands on a flat pad three rounds in a row: each landing
 *    must be accepted by the game (score up, fuel not penalised).
 * 2. A round with no input ends in a crash: score unchanged, the fuel penalty applied.
 * The game's fixed-step loop is stopped and stepped here at 60 Hz, so the run is
 * repeatable and much faster than real time. Exits non-zero on any failure.
 */
import { startCheck, seededRandom } from '../../tools/play/harness.mjs';

const LANDINGS = 3;

const check = await startCheck('MoonLDR: scripted landings on a flat pad');
await check.run(async () => {
  const page = await check.open('MoonLDR/index.html', { init: seededRandom(7) });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof loop !== 'undefined' && loop && typeof lander !== 'undefined' && lander);
  // Classic terrain, pilot difficulty (the defaults), started from the menu with Enter.
  await page.keyboard.press('Enter');
  const started = await page.evaluate(() => !isGameOver && !isPaused && settings.terrain === 'classic' && settings.difficulty === 'pilot');
  check.ok(started, 'Enter starts a classic-terrain PILOT game');

  // Install the stepper and the autopilot in the page.
  await page.evaluate(() => {
    loop.stop();
    const held = { ArrowUp: false, ArrowLeft: false, ArrowRight: false };
    const press = (key, down) => {
      if (held[key] === down) return;
      held[key] = down;
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key, bubbles: true }));
    };
    window.__release = () => Object.keys(held).forEach((k) => press(k, false));
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // The flat pad nearest the lander (at least 20 wide), as { cx, y, l, r }.
    window.__pickPad = () => {
      let best = null;
      lineSegments.forEach(([a, b], j) => {
        if (heightDifferences[j] > 0.0001 || b.x - a.x < 20) return;
        const pad = { cx: (a.x + b.x) / 2, y: a.y, l: a.x, r: b.x };
        const d = Math.abs(pad.cx - lander.position.x);
        if (!best || d < best.d) best = { ...pad, d };
      });
      return best;
    };
    // Highest terrain between two x positions (with a margin either side).
    const ceiling = (x0, x1) => {
      const lo = Math.min(x0, x1) - 20;
      const hi = Math.max(x0, x1) + 20;
      let top = -Infinity;
      for (const [a, b] of lineSegments) if (b.x >= lo && a.x <= hi) top = Math.max(top, a.y, b.y);
      return top;
    };

    window.__autopilot = (pad) => {
      const x = lander.position.x;
      const y = lander.position.y;
      const z = lander.rotation.z;
      const ex = pad.cx - x;
      const alt = y - mainScale - pad.y; // height of the feet above the pad
      // Start the descent once roughly over the pad and slow; give it up only if blown well off.
      if (!pad.descending && Math.abs(ex) < 5 && Math.abs(velocityX) < 2) pad.descending = true;
      else if (pad.descending && Math.abs(ex) > 15) pad.descending = false;
      let vxDes, vyDes, maxTilt;
      if (!pad.descending) {
        // Travel: hold a safe height above the terrain on the way, close in on the pad.
        vxDes = Math.sign(ex) * Math.min(25, Math.sqrt(3 * Math.abs(ex)), 0.5 * Math.abs(ex));
        const yDes = Math.max(pad.y + 35, ceiling(x, pad.cx) + 25);
        vyDes = clamp((yDes - y) * 0.5, -12, 8);
        maxTilt = 1.1;
      } else {
        // Descent: straight down, slowing near the pad.
        vxDes = ex * 0.4;
        vyDes = -clamp(alt * 0.3, 1.2, 12);
        maxTilt = alt > 12 ? 0.35 : 0.1;
      }
      // Thrust vector wanted: up to hold gravity and reach vyDes, sideways to reach vxDes.
      const ax = (vxDes - velocityX) * 0.8;
      const ay = gravity + (vyDes - velocityY) * 1.5;
      let zDes = clamp(-Math.atan2(ax, Math.max(ay, 0.5)), -maxTilt, maxTilt);
      if (alt < 10) zDes = 0;
      press('ArrowLeft', z < zDes - 0.015);
      press('ArrowRight', z > zDes + 0.015);
      // Enough thrust that its upward part gives ay, and more for the sideways part as long
      // as that doesn't push the lander up much faster than wanted.
      const c = Math.max(Math.cos(z), 0.3);
      const up = Math.max(ay, 0) / c;
      const side = Math.min(Math.abs(ax) / Math.max(Math.abs(Math.sin(z)), 0.1), (Math.max(ay, 0) + 1.5) / c);
      press('ArrowUp', currentAcceleration < Math.min(thrusterAccelerationMax, Math.max(up, side)));
    };

    // Step the game at 60 Hz until the round ends. Returns what happened.
    window.__flyRound = (useAutopilot, maxSeconds = 90) => {
      const pad = window.__pickPad();
      const before = { score: currentScore, fuel: currentFuel };
      for (let i = 0; i < maxSeconds * 60 && !isBetweenRounds && !isGameOver; i++) {
        if (useAutopilot) window.__autopilot(pad);
        deltaTime = 1 / 60;
        update();
      }
      window.__release();
      const out = {
        ended: isBetweenRounds,
        landed: isBetweenRounds && hasLanded,
        crash: crashInfo,
        pad: [Math.round(pad.l + halfWidth), Math.round(pad.r + halfWidth)],
        x: Math.round(lander.position.x + halfWidth),
        scoreGain: currentScore - before.score,
        fuelBefore: Math.round(before.fuel),
        fuelChange: Math.round(currentFuel - before.fuel),
        time: Math.round(currentTime),
      };
      // Sit out the pause between rounds; the next round spawns at its end.
      for (let i = 0; i < 400 && isBetweenRounds; i++) {
        deltaTime = 1 / 60;
        update();
      }
      render();
      return out;
    };
  });

  for (let n = 1; n <= LANDINGS; n++) {
    const r = await page.evaluate(() => {
      crashInfo = '';
      return window.__flyRound(true);
    });
    check.ok(r.landed && r.scoreGain > 0,
      `landing ${n}: ${r.landed ? `landed on the pad at x ${r.pad[0]}-${r.pad[1]}, +${r.scoreGain} points` : r.ended ? `crashed (${r.crash}) at x ${r.x}` : 'no result after 90 s'} (game clock ${r.time}s)`);
  }

  const crash = await page.evaluate(() => {
    crashInfo = '';
    return window.__flyRound(false);
  });
  check.ok(crash.ended && !crash.landed && crash.scoreGain === 0 && crash.fuelChange <= -Math.min(290, crash.fuelBefore),
    `with no input the lander crashes (${crash.crash || 'hit the ground too fast'}), no points, fuel ${crash.fuelChange}`);
  check.noErrors(page);
});
