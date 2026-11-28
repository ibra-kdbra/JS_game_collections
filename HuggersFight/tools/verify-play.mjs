/**
 * HuggersFight gameplay check (browser): the core loop of level 1.
 *   node HuggersFight/tools/verify-play.mjs
 *
 * Clearing all of level 1 with a bot is not practical in CI time (an earlier bot killed 17
 * of ~26 enemies in 8 minutes), so this checks the loop a level is made of:
 * 1. Start on the title screen begins level 1, with enemies in it.
 * 2. The arrow keys move the player and Up jumps; Z fires bullets.
 * 3. A run-and-gun bot (arrow keys and Z only) hunts the nearest enemy until it kills one.
 * 4. The player takes damage: it throws a grenade (C), stands on it, and loses a life;
 *    it comes back at the checkpoint.
 * 5. Doing that until no lives are left gives Game Over; Z then starts a new game on level 1
 *    with full lives.
 * 6. Keyboard shots fly straight: an enemy level with the player is hit, one a little above
 *    it is not.
 * 7. Touch, on a phone-sized page with the on-screen controls: real touches (through the
 *    DevTools protocol) on Shoot hit that same enemy a little above, thanks to the aim
 *    assist; an enemy well above the cone or behind the player is not hit; after a real key
 *    press the assist is off again. The d-pad follows a sliding thumb (Left to Right, a
 *    diagonal), and tapping Jump while holding Up keeps Up held.
 * Steps 1-6 use key events on the window, read by the engine's own handlers. The engine's
 * real-time loop is held and its update steps are run from here (much faster than real
 * time); the step functions are reached by wrapping engineInit in the served copy of
 * engine/engine.js (the repository file is not changed). Exits non-zero on any failure.
 */
import { startCheck, waitFor, seededRandom } from '../../tools/play/harness.mjs';

const exposeEngine = {
  'HuggersFight/engine/engine.js': (src) => src + `
;(() => {
  const realInit = engineInit;
  engineInit = function (appInit, appUpdate, appUpdatePost, appRender, appRenderPost) {
    window.__huggers = { appUpdate, appUpdatePost };
    return realInit.apply(this, arguments);
  };
})();`,
};

// An aiming range high in the empty sky: the player and one enemy, both held in place, the
// enemy unarmed and too tough to die. aimRun steps the engine and reports the damage the
// enemy took, so a hit or a miss is certain whatever the bullet spread rolls.
function installAimRange() {
  const H = window.__huggers;
  H.step = () => {
    H.appUpdate();
    engineUpdateObjects();
    H.appUpdatePost();
    for (const device of inputData) device.map((k) => (k.r = k.p = 0));
  };
  H.aimSetup = (dx, dy) => {
    H.target && H.target.destroy();
    const me = players[0];
    H.spot = vec2((levelSize.x / 2 | 0) + .5, levelSize.y - 40);
    me.pos = H.spot.copy();
    me.velocity = vec2();
    me.mirror = 0; // facing right
    const enemy = H.target = new Enemy(H.spot.add(vec2(dx, dy)));
    enemy.health = enemy.healthMax = 1e3;
    enemy.weapon.update = () => {}; // never fires
    H.enemyAt = enemy.pos.copy();
    const pin = () => {
      me.pos = H.spot.copy();
      me.velocity = vec2();
      enemy.pos = H.enemyAt.copy();
      enemy.velocity = vec2();
    };
    H.pin = pin;
    for (let i = 0; i < 60 * 3; i++) {
      // let the camera settle on the new spot
      H.step();
      pin();
    }
    return { clear: !tileCollisionRaycast(me.pos, enemy.pos), alive: !me.isDead() };
  };
  H.aimRun = (frames, keys) => {
    const before = H.target.health;
    for (let i = 0; i < frames; i++) {
      keys ? H.frame(new Set(keys)) : H.step();
      H.pin();
    }
    for (let i = 0; i < 30; i++) {
      H.step(); // let bullets in flight land
      H.pin();
    }
    return before - H.target.health;
  };
}

const check = await startCheck('HuggersFight: level 1 core loop (move, shoot, kill, get hurt, game over, restart)');
await check.run(async () => {
  const page = await check.open('HuggersFight/index.html', { init: seededRandom(21), intercept: exposeEngine });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#start', { state: 'visible', timeout: 15000 });
  await waitFor(page, () => typeof players !== 'undefined' && players[0] && levelTimer.get() > 2);
  await page.click('#start');
  await page.waitForTimeout(200);

  // Hold the real-time loop and step the engine from here. Keys are real key events.
  await page.evaluate(() => {
    paused = 1;
    const H = window.__huggers;
    // Key numbers as the game asks for them (keyIsDown(38) and so on), and the
    // physical key a browser reports for each in KeyboardEvent.code.
    const CODES = { left: 37, up: 38, right: 39, down: 40, shoot: 90, grenade: 67, z: 90 };
    const KEYS = { 37: ['ArrowLeft', 'ArrowLeft'], 38: ['ArrowUp', 'ArrowUp'], 39: ['ArrowRight', 'ArrowRight'],
      40: ['ArrowDown', 'ArrowDown'], 90: ['KeyZ', 'z'], 67: ['KeyC', 'c'] };
    const send = (code, down) => {
      const [physical, key] = KEYS[code];
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { bubbles: true, code: physical, key }));
    };
    // Make the held keys match `want` (a set of names), then run one engine step.
    H.frame = (want) => {
      for (const [name, code] of Object.entries(CODES)) {
        if (name === 'z') continue;
        const on = want.has(name);
        if (on !== !!keyIsDown(code)) send(code, on);
      }
      H.appUpdate();
      engineUpdateObjects();
      H.appUpdatePost();
      for (const device of inputData) device.map((k) => (k.r = k.p = 0));
    };
    H.me = () => players[0];
    H.enemies = () => engineCollideObjects.filter((o) => o.isCharacter && o.team === team_enemy && !o.isDead());
    H.bullets = () => engineObjects.filter((o) => o instanceof Bullet && o.attacker === players[0]).length;
    H.info = () => {
      const p = players[0];
      return {
        level, lives: playerLives, kills: totalKills, enemies: H.enemies().length,
        dead: !p || p.isDead(), x: p ? +p.pos.x.toFixed(2) : 0, y: p ? +p.pos.y.toFixed(2) : 0,
        grenades: p ? p.grenadeCount : 0,
      };
    };
    // Run `frames` steps with a fixed set of keys.
    H.hold = (keys, frames) => {
      const want = new Set(keys);
      for (let i = 0; i < frames; i++) H.frame(want);
      return H.info();
    };
  });
  const run = (keys, frames) => page.evaluate(([k, f]) => window.__huggers.hold(k, f), [keys, frames]);

  // 1. Level 1 with enemies.
  const start = await run([], 30);
  check.ok(start.level === 1 && start.enemies > 0 && !start.dead, `Start begins level 1 (${start.enemies} enemies, ${start.lives} lives)`);

  // 2. Move, jump, shoot.
  const right = await run(['right'], 40);
  const left = await run(['left'], 40);
  check.ok(right.x > start.x + 1 || left.x < right.x - 1, `the arrow keys move the player (x ${start.x} -> ${right.x} -> ${left.x})`);
  await run([], 30);
  const ground = await page.evaluate(() => window.__huggers.info().y);
  const jumps = await page.evaluate(() => {
    const H = window.__huggers;
    let top = H.me().pos.y;
    const want = new Set(['up']);
    for (let i = 0; i < 25; i++) {
      H.frame(want);
      top = Math.max(top, H.me().pos.y);
    }
    return top;
  });
  check.ok(jumps > ground + 0.5, `Up jumps (height ${ground.toFixed(1)} -> ${jumps.toFixed(1)})`);
  await run([], 60);
  const shots = await page.evaluate(() => {
    const H = window.__huggers;
    let most = 0;
    const want = new Set(['shoot']);
    for (let i = 0; i < 20; i++) {
      H.frame(want);
      most = Math.max(most, H.bullets());
    }
    H.hold([], 30);
    return most;
  });
  check.ok(shots >= 2, `Z fires bullets (${shots} in flight)`);

  // 3. Hunt: walk towards the nearest enemy, jump over steps, shoot when level with it.
  const hunt = await page.evaluate(() => {
    const H = window.__huggers;
    const startKills = totalKills;
    let stuck = 0;
    let lastX = 0;
    for (let f = 0; f < 60 * 240 && totalKills === startKills; f++) {
      const me = H.me();
      const want = new Set();
      if (me && !me.isDead()) {
        const foes = H.enemies().sort((a, b) => a.pos.distance(me.pos) - b.pos.distance(me.pos));
        const foe = foes[0];
        if (foe) {
          const dx = foe.pos.x - me.pos.x;
          const dy = foe.pos.y - me.pos.y;
          const facing = me.mirror ? -1 : 1;
          const level = Math.abs(dy) < 1.2;
          if (level && Math.abs(dx) < 14) {
            if (Math.sign(dx) !== facing) want.add(dx < 0 ? 'left' : 'right');
            want.add('shoot');
          } else {
            want.add(dx < 0 ? 'left' : 'right');
            if (dy > 1.5 || stuck > 10) want.add('up');
          }
          stuck = Math.abs(me.pos.x - lastX) < 0.01 ? stuck + 1 : 0;
          if (stuck > 40) stuck = 0;
          lastX = me.pos.x;
        }
      }
      H.frame(want);
    }
    return { ...H.info(), frames: 0, killed: totalKills - startKills };
  });
  check.ok(hunt.killed >= 1, `a run-and-gun bot kills an enemy (${hunt.killed} kill(s), ${hunt.enemies} enemies left)`);

  // 4. Damage: throw a grenade, stand on it until it goes off.
  await run([], 150); // be alive and still
  const suicide = () => page.evaluate(() => {
    const H = window.__huggers;
    // Wait to be alive (respawn takes two seconds).
    for (let i = 0; i < 60 * 5 && (!H.me() || H.me().isDead()); i++) H.frame(new Set());
    // A new player can't be hurt for two seconds.
    for (let i = 0; i < 60 * 3 && H.me() && H.me().getAliveTime() < 2.2; i++) H.frame(new Set());
    const lives = playerLives;
    const me = H.me();
    if (!me || me.isDead()) return { ok: false, why: 'no living player' };
    const grenadesBefore = me.grenadeCount;
    me.grenadeCount = Math.max(me.grenadeCount, 1); // the check needs one each time
    H.frame(new Set(['grenade']));
    H.frame(new Set());
    const g = engineObjects.find((o) => o instanceof Grenade);
    if (!g) return { ok: false, why: 'no grenade thrown' };
    for (let i = 0; i < 60 * 4 && !me.isDead(); i++) {
      const want = new Set();
      if (!g.destroyed) {
        const dx = g.pos.x - me.pos.x;
        if (Math.abs(dx) > 0.3) want.add(dx < 0 ? 'left' : 'right');
      }
      H.frame(want);
    }
    return { ok: me.isDead(), lives, after: playerLives, grenadesBefore };
  });
  const hurt = await suicide();
  // Lives are spent when the player respawns, so wait for the respawn.
  const back = await page.evaluate(() => {
    const H = window.__huggers;
    for (let i = 0; i < 60 * 5 && (!H.me() || H.me().isDead()); i++) H.frame(new Set());
    return { alive: H.me() && !H.me().isDead(), lives: playerLives };
  });
  check.ok(hurt.ok && back.alive && back.lives === hurt.lives - 1,
    `standing on a grenade kills the player; it respawns with a life less (${hurt.why || `lives ${hurt.lives} -> ${back.lives}`})`);

  // 5. Spend every life: Game Over, then Z starts again.
  let rounds = 0;
  while (rounds < 15) {
    const st = await page.evaluate(() => ({ lives: playerLives, allDead: players.every((p) => p.isDead()) }));
    if (st.lives <= 0 && st.allDead) break;
    const r = await suicide();
    if (!r.ok) {
      check.fail(`death ${rounds + 2}: ${r.why || 'the grenade did not kill the player'}`);
      break;
    }
    rounds++;
  }
  const over = await page.evaluate(() => {
    const H = window.__huggers;
    H.hold([], 60 * 4); // the restart prompt waits three seconds
    return { lives: playerLives, allDead: players.every((p) => p.isDead()) };
  });
  check.ok(over.lives <= 0 && over.allDead, `after ${rounds} more deaths it is Game Over (lives ${over.lives})`);
  const restarted = await page.evaluate(() => {
    const H = window.__huggers;
    H.frame(new Set(['shoot']));
    H.hold([], 60);
    return H.info();
  });
  check.ok(restarted.level === 1 && !restarted.dead && restarted.lives === start.lives && restarted.enemies > 0,
    `Z starts a new game: level ${restarted.level}, ${restarted.lives} lives, ${restarted.enemies} enemies`);

  // 6. Keyboard shots are not aimed.
  await page.evaluate(installAimRange);
  const keyboardAim = await page.evaluate(() => {
    const H = window.__huggers;
    const level = H.aimSetup(5, 0);
    const levelHit = H.aimRun(40, ['shoot']);
    const above = H.aimSetup(5, 1.6);
    const aboveHit = H.aimRun(40, ['shoot']);
    H.target.destroy();
    return { ok: level.clear && above.clear && level.alive, levelHit, aboveHit };
  });
  check.ok(keyboardAim.ok && keyboardAim.levelHit > 0 && keyboardAim.aboveHit === 0,
    `keyboard shots fly straight: a level enemy takes ${keyboardAim.levelHit} hit(s), one 1.6 tiles above takes ${keyboardAim.aboveHit}`);
  check.noErrors(page);

  // 7. Touch: aim assist and the d-pad, with real touches on a phone-sized page.
  const phone = await check.open('HuggersFight/index.html', {
    init: seededRandom(21), intercept: exposeEngine, touch: true, viewport: { width: 915, height: 412 },
  });
  await phone.waitForSelector('#start', { state: 'visible', timeout: 15000 });
  await waitFor(phone, () => typeof players !== 'undefined' && players[0] && levelTimer.get() > 2);
  await phone.tap('#start');
  await phone.waitForTimeout(200);
  const where = await phone.evaluate(() => {
    paused = 1;
    const centre = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    };
    const pad = document.querySelector('.gk-dpad');
    const button = (label) => centre([...document.querySelectorAll('.gk-btn')].find((b) => b.textContent === label));
    return {
      shown: !document.querySelector('.gk-touch').hidden,
      left: centre(pad.querySelector('.gk-dpad-left')), right: centre(pad.querySelector('.gk-dpad-right')),
      up: centre(pad.querySelector('.gk-dpad-up')), jump: button('Jump'), shoot: button('Shoot'),
    };
  });
  check.ok(where.shown, 'a touch phone shows the on-screen controls');
  await phone.evaluate(installAimRange);
  const cdp = await phone.context().newCDPSession(phone);
  const touches = (type, points) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: points.map(([p, id]) => ({ x: p.x, y: p.y, id })),
  });
  // Hold Shoot with a real touch for `frames` engine steps.
  const touchShoot = async (frames) => {
    const before = await phone.evaluate(() => window.__huggers.target.health);
    await touches('touchStart', [[where.shoot, 0]]);
    await phone.evaluate((n) => window.__huggers.aimRun(n), frames);
    await touches('touchEnd', []);
    return before - await phone.evaluate(() => window.__huggers.target.health);
  };
  const aimAt = async (dx, dy) => {
    const at = await phone.evaluate(([x, y]) => window.__huggers.aimSetup(x, y), [dx, dy]);
    return { ...at, damage: await touchShoot(40) };
  };
  const above = await aimAt(5, 1.6); // about 18 degrees up
  const steep = await aimAt(4, 4.5); // about 48 degrees up, outside the cone
  const behind = await aimAt(-5, 1); // behind the player
  check.ok(above.clear && above.alive && above.damage > 0,
    `touch aim assist: a touch shot hits the enemy 1.6 tiles above the line (${above.damage} hit(s))`);
  check.ok(steep.clear && steep.damage === 0 && behind.damage === 0,
    `the assist stays in its cone: an enemy at 48 degrees takes ${steep.damage} hit(s), one behind takes ${behind.damage}`);
  // The same shot from a real keyboard (trusted key events) on the same phone is not aimed.
  await phone.evaluate(() => window.__huggers.aimSetup(5, 1.6));
  const before = await phone.evaluate(() => window.__huggers.target.health);
  await phone.keyboard.down('z');
  await phone.evaluate(() => window.__huggers.aimRun(40));
  await phone.keyboard.up('z');
  const keyDamage = before - await phone.evaluate(() => window.__huggers.target.health);
  check.ok(keyDamage === 0, `a real Z key on the same phone fires straight: the enemy above takes ${keyDamage} hit(s)`);
  await phone.evaluate(() => window.__huggers.target.destroy());

  // Keys the game sees as held. Touch moves reach the page with the next frame, so wait two.
  const keys = () => phone.evaluate(async () => {
    for (let i = 0; i < 2; i++) await new Promise((r) => requestAnimationFrame(r));
    return ['L', 'U', 'R'].filter((k, i) => keyIsDown([37, 38, 39][i])).join('') || '-';
  });
  await touches('touchStart', [[where.left, 0]]);
  const slideFrom = await keys();
  for (let i = 1; i <= 6; i++) {
    await touches('touchMove', [[{ x: where.left.x + (where.right.x - where.left.x) * i / 6, y: where.left.y }, 0]]);
  }
  const slideTo = await keys();
  await touches('touchMove', [[{ x: where.right.x, y: where.up.y }, 0]]);
  const diagonal = await keys();
  await touches('touchEnd', []);
  check.ok(slideFrom === 'L' && slideTo === 'R' && diagonal === 'UR',
    `the d-pad follows a sliding thumb: ${slideFrom} -> ${slideTo}, up-right corner ${diagonal}`);
  await touches('touchStart', [[where.up, 0]]);
  await touches('touchStart', [[where.up, 0], [where.jump, 1]]);
  await touches('touchEnd', [[where.up, 0]]);
  const upHeld = await keys();
  await touches('touchEnd', []);
  const upReleased = await keys();
  check.ok(upHeld === 'U' && upReleased === '-', `tapping Jump while holding Up keeps Up held (${upHeld}, then ${upReleased} once lifted)`);
  check.noErrors(phone);
});
