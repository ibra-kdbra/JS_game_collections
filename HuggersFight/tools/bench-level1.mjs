/**
 * HuggersFight level 1 bench (manual, not part of CI: a full run takes minutes).
 *   node HuggersFight/tools/bench-level1.mjs <keyboard|touch> <desktop|pixel7|iphone14L> <seeds> <level|cone> [minutes]
 *   e.g. node HuggersFight/tools/bench-level1.mjs touch pixel7 1,2,3,4,5,6 cone 8
 *
 * One bot plays level 1, either with key events on the window or with real touches (sent
 * through the DevTools protocol) on the on-screen controls of an emulated phone. It hunts the
 * nearest enemy, wall-climbs, digs and throws grenades when stuck below a target. Policy
 * `level` only shoots at enemies level with the player; `cone` also shoots at enemies up to
 * about 35 degrees above or below, as a player tends to on a phone. The engine is stepped from
 * here (60 steps per game second, the real-time loop is stopped), so a run is much faster than
 * real time. It prints one JSON line per seed (kills, cleared, game over, game seconds) and a
 * summary. A bot is not a person: use the numbers to compare inputs and versions, not as a
 * difficulty rating. Set REPO to bench another checkout (e.g. an exported older commit).
 */
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { serve, repoRoot } from '../../tools/play/harness.mjs';

async function loadPlaywright() {
  for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
    try {
      const mod = await import(path.isAbsolute(c) ? pathToFileURL(path.join(c, 'index.mjs')).href : c);
      return mod.chromium ? mod : mod.default;
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE.');
}

const { chromium, devices } = await loadPlaywright();
const [mode = 'keyboard', dev = 'desktop', seedsArg = '1', policy = 'level', minutesArg = '8'] = process.argv.slice(2);
const seeds = seedsArg.split(',').map(Number);
const FRAMES = Math.round(Number(minutesArg) * 60 * 60);
const ROOT = process.env.REPO || repoRoot;
const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  pixel7: devices['Pixel 7'],
  iphone14L: devices['iPhone 14 landscape'],
};
if (!DEVICES[dev] || !['keyboard', 'touch'].includes(mode) || !['level', 'cone'].includes(policy)) {
  console.error('usage: bench-level1.mjs <keyboard|touch> <desktop|pixel7|iphone14L> <seeds> <level|cone> [minutes]');
  process.exit(2);
}
const seeded = (seed) => `(() => { let s = ${seed >>> 0} || 1; Math.random = () => { s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();`;

// The bot, installed in the page. Steps the engine and decides which controls to hold.
function installBot(policy) {
  paused = 1;
  window.requestAnimationFrame = () => 0; // stop the real-time loop (and its rendering)
  const H = window.__h;
  const CODES = { left: 37, up: 38, right: 39, down: 40, shoot: 90, roll: 88, grenade: 67 };
  const KEYS = { 37: ['ArrowLeft', 'ArrowLeft'], 38: ['ArrowUp', 'ArrowUp'], 39: ['ArrowRight', 'ArrowRight'],
    40: ['ArrowDown', 'ArrowDown'], 90: ['KeyZ', 'z'], 88: ['KeyX', 'x'], 67: ['KeyC', 'c'] };
  H.sync = (want) => {
    for (const [name, code] of Object.entries(CODES)) {
      const on = want.includes(name);
      if (on === !!keyIsDown(code)) continue;
      const [physical, key] = KEYS[code];
      window.dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { bubbles: true, code: physical, key }));
    }
  };
  H.step = () => {
    H.u();
    engineUpdateObjects();
    H.up();
    for (const device of inputData) device.map((k) => (k.r = k.p = 0));
  };
  let task = '', taskUntil = 0, wanderDir = 'left', wanderN = 0, stuck = 0, lastX = 0;
  let target = null, best = 1e9, lastProgress = 0, f = 0;
  const banned = new Map();
  H.decide = () => {
    f++;
    const me = players[0];
    const want = [];
    if (!me || me.isDead()) {
      target = null;
      stuck = 0;
      return want;
    }
    const foes = engineCollideObjects.filter((o) => o.isCharacter && o.team === team_enemy && !o.isDead() && !((banned.get(o) || 0) > f))
      .sort((a, b) => a.pos.distance(me.pos) - b.pos.distance(me.pos));
    if (!foes.length) {
      banned.clear();
      return want;
    }
    if (!target || target.isDead() || target.destroyed || target.team !== team_enemy
      || foes[0].pos.distance(me.pos) < target.pos.distance(me.pos) - 3) {
      target = foes[0];
      best = 1e9;
      lastProgress = f;
    }
    const dist = target.pos.distance(me.pos);
    if (dist < best - 0.5) {
      best = dist;
      lastProgress = f;
    }
    if (f - lastProgress > 60 * 40) {
      // no closer in 40 s: try another enemy for a minute
      banned.set(target, f + 60 * 60);
      target = null;
      return want;
    }
    const dx = target.pos.x - me.pos.x, dy = target.pos.y - me.pos.y;
    const facing = me.mirror ? -1 : 1;
    const see = !tileCollisionRaycast(me.pos, target.pos);
    const inLine = policy === 'cone' ? Math.abs(dy) < Math.max(1.2, 0.7 * Math.abs(dx)) : Math.abs(dy) < 1.2;
    const dir = dx < 0 ? 'left' : 'right';
    stuck = Math.abs(me.pos.x - lastX) < 0.02 ? stuck + 1 : Math.max(0, stuck - 2);
    lastX = me.pos.x;
    if (see && inLine && Math.abs(dx) < 12) {
      if (Math.sign(dx) !== facing) want.push(dir);
      want.push('shoot');
      stuck = 0;
      return want;
    }
    // Above the target with no way down: wander to find one, or blow a hole with a grenade.
    if (task && f < taskUntil) {
      if (task === 'throw') {
        want.push('grenade');
        task = 'away';
        taskUntil = f + 70;
      } else want.push(wanderDir);
      if (stuck > 15 && f % 25 < 18) want.push('up');
      return want;
    }
    task = '';
    if (dy < -2 && Math.abs(dx) < 4 && f - lastProgress > 180) {
      lastProgress = f;
      wanderN++;
      if (me.grenadeCount > 0 && wanderN % 2 === 0) {
        wanderDir = dx < 0 ? 'right' : 'left';
        task = 'throw';
        taskUntil = f + 2;
      } else {
        wanderDir = wanderN % 4 === 1 ? 'left' : 'right';
        task = 'wander';
        taskUntil = f + 60 * (2 + wanderN % 5);
      }
      return want;
    }
    if (Math.abs(dx) > 0.4) want.push(dir);
    else if (dy < -1.5) want.push('down');
    // jump (and wall-climb) in pulses, so each one is a new press
    if ((dy > 1.5 || stuck > 15) && f % 25 < 18) want.push('up');
    if (stuck > 90 && stuck < 200) want.push('shoot'); // dig through
    if (stuck > 200 && f % 60 === 0) want.push('roll');
    if (stuck > 260) stuck = 0;
    return want;
  };
  const alive = () => engineCollideObjects.filter((o) => o.isCharacter && o.team === team_enemy).length;
  H.status = () => {
    const left = alive();
    return { kills: totalKills, left, lives: playerLives, cleared: !left || level > 1,
      over: playerLives <= 0 && players.every((p) => p.isDead()) };
  };
  // Keyboard: decide, send keys, step.
  H.runKeys = (n) => {
    let s;
    for (let i = 0; i < n; i++) {
      H.sync(H.decide());
      H.step();
      s = H.status();
      if (s.cleared || s.over) return { s, done: i + 1 };
    }
    return { s, done: n };
  };
  // Touch: step while the bot wants what is held; return as soon as it wants something else.
  H.runHeld = (n, held) => {
    let s;
    for (let i = 1; i <= n; i++) {
      H.step();
      s = H.status();
      if (s.cleared || s.over) return { s, want: held, done: i };
      const want = H.decide();
      if (want.length !== held.length || want.some((w) => !held.includes(w))) return { s, want, done: i };
    }
    return { s, want: held, done: n };
  };
}

const server = await serve(ROOT);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const touch = mode === 'touch';
const results = [];
for (const seed of seeds) {
  const d = DEVICES[dev];
  const context = await browser.newContext({ ...d, hasTouch: touch || !!d.hasTouch, isMobile: !!d.isMobile, serviceWorkers: 'block' });
  await context.route((u) => !u.href.startsWith(server.origin), (r) => r.abort());
  await context.route(`${server.origin}/HuggersFight/engine/engine.js`, async (route) => {
    const src = await readFile(path.join(ROOT, 'HuggersFight/engine/engine.js'), 'utf8');
    route.fulfill({ status: 200, contentType: 'text/javascript', body: src + `
;(() => { const realInit = engineInit; engineInit = function (a, u, up) { window.__h = { u, up }; return realInit.apply(this, arguments); }; })();` });
  });
  await context.addInitScript(seeded(seed));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${server.origin}/HuggersFight/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('#start', { state: 'visible' });
  await page.waitForFunction(() => typeof players !== 'undefined' && players[0] && levelTimer.get() > 2);
  if (touch) await page.tap('#start');
  else await page.click('#start');
  await page.waitForTimeout(200);

  const boxes = await page.evaluate(() => {
    const centre = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const button = (label) => centre([...document.querySelectorAll('.gk-btn')].find((e) => e.textContent === label));
    return { left: centre(document.querySelector('.gk-dpad-left')), right: centre(document.querySelector('.gk-dpad-right')),
      down: centre(document.querySelector('.gk-dpad-down')), up: button('Jump'), shoot: button('Shoot'),
      grenade: button('Grenade'), roll: button('Roll'), shown: !document.querySelector('.gk-touch').hidden };
  });
  if (touch && !boxes.shown) throw new Error('the touch controls are not shown');
  await page.evaluate(installBot, policy);
  const start = await page.evaluate(() => window.__h.status());
  const t0 = Date.now();
  let st = start, f = 0;
  if (!touch) {
    while (f < FRAMES) {
      const r = await page.evaluate((n) => window.__h.runKeys(n), Math.min(600, FRAMES - f));
      st = r.s;
      f += r.done;
      if (st.cleared || st.over) break;
    }
  } else {
    const cdp = await context.newCDPSession(page);
    const held = new Map(); // control -> touch id
    const send = (type) => cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: [...held].map(([n, id]) => ({ x: boxes[n].x, y: boxes[n].y, id, radiusX: 8, radiusY: 8, force: 1 })),
    });
    let want = await page.evaluate(() => window.__h.decide());
    while (f < FRAMES) {
      for (const n of [...held.keys()]) {
        if (want.includes(n)) continue;
        held.delete(n);
        await send('touchEnd');
      }
      for (const n of want) {
        if (held.has(n)) continue;
        held.set(n, [...Array(10).keys()].find((i) => ![...held.values()].includes(i)));
        await send('touchStart');
      }
      const r = await page.evaluate(([n, w]) => window.__h.runHeld(n, w), [Math.min(600, FRAMES - f), want]);
      st = r.s;
      want = r.want;
      f += r.done;
      if (st.cleared || st.over) break;
    }
    if (held.size) {
      held.clear();
      await send('touchEnd');
    }
  }
  const res = { seed, mode, dev, policy, enemies: start.left, kills: st.kills, left: st.left, cleared: st.cleared,
    over: st.over, livesLeft: st.lives, gameSecs: Math.round(f / 60), wallSecs: Math.round((Date.now() - t0) / 1000), errors: errors.length };
  console.log(JSON.stringify(res));
  results.push(res);
  await context.close();
}
const n = results.length;
const count = (k) => results.filter((r) => r[k]).length;
const kills = results.reduce((a, r) => a + r.kills, 0);
const share = results.reduce((a, r) => a + r.kills / r.enemies, 0);
console.log(`SUMMARY ${mode} ${dev} ${policy}: cleared ${count('cleared')}/${n}, game over ${count('over')}/${n}, `
  + `kills ${kills} (mean ${(kills / n).toFixed(1)}, ${Math.round(100 * share / n)}% of each level's enemies on average)`);
await browser.close();
server.close();
