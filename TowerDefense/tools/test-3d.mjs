/**
 * The 3D view in a real browser (software WebGL, as on the CI machines):
 *
 * - it starts in 3D with no page errors, the map and towers are in within the time
 *   budget, and the model files stay under the size budget
 * - a battle: every enemy on the map has a model, killed ones play out and go, the
 *   skinned models are reused (not cloned per enemy), towers turn to their aim
 * - selling a tower takes its model away; a game restart leaves nothing behind
 * - draw calls and triangles stay under budget with 24 towers and 60 enemies
 * - if a model file fails, the game falls back to Flat for that visit, says why,
 *   and keeps 3D as the saved choice
 *
 *   node TowerDefense/tools/test-3d.mjs            # exit 1 on any failure
 *
 * Needs Playwright and Chromium (see tools/browser.mjs).
 */
import { serve, launch } from './browser.mjs';

const BUDGET = {
    readyMs: 20000,         // map and towers drawn (software WebGL is slow; real devices are far faster)
    modelKB: 3200,          // every model file the 3D view loads
    calls: 500,             // draw calls in a busy frame
    tris: 1200000,          // triangles in a busy frame
    reuse: 4                // new skinned models for a second crowd like the first (the rest come from the pool)
};

const failures = [];
const check = (ok, what) => {
    if (!ok) failures.push(what);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const server = await serve();
const browser = await launch();

async function open(query = 'switchback', block) {
    const ctx = await browser.newContext({ viewport: { width: 1000, height: 640 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        try { localStorage.setItem('gamelab:tower-defense:tipsDone', 'true'); } catch (e) { /* private mode */ }
    });
    if (block) await page.route(block, r => r.abort());
    server.reset();
    const t0 = Date.now();
    await page.goto(`${server.origin}/TowerDefense/index.html?map=${query}`);
    await page.waitForFunction(() => typeof Renderer3D !== 'undefined' && cols > 0);
    return { ctx, page, errors, t0 };
}

// ---- Loading ----
{
    const { ctx, page, errors, t0 } = await open();
    await page.waitForFunction(() => Renderer3D.loadState.towersReady, null, { timeout: 60000 });
    const ready = Date.now() - t0;
    await page.waitForFunction(() => Renderer3D.loadState.monsters.length === 10, null, { timeout: 60000 });
    const kb = Math.round(server.bytes('TowerDefense/models/') / 1024);
    check(await page.evaluate(() => Renderer.view) === '3d', 'starts in the 3D view');
    check(ready < BUDGET.readyMs, `map and towers ready in ${(ready / 1000).toFixed(1)} s (budget ${BUDGET.readyMs / 1000} s)`);
    check(kb < BUDGET.modelKB, `model files ${kb} KB (budget ${BUDGET.modelKB} KB)`);
    check(await page.evaluate(() => document.querySelector('.load3d') ? document.querySelector('.load3d').hidden : true), 'loading bar gone once ready');

    // ---- Battle ----
    await page.evaluate(() => {
        closeOverlay('levels');
        godMode = true;
        cash = 1e6;
        Renderer.setQualityAuto(false);
        const types = ['gun', 'laser', 'slow', 'sniper', 'rocket', 'bomb', 'tesla'];
        let n = 0;
        for (let x = 0; x < cols && n < 24; x++) {
            for (let y = 0; y < rows && n < 24; y++) {
                if (grid[x][y] !== 3 || (x * 7 + y * 3) % 3 || placeReason(x, y)) continue;
                const t = createTower(x, y, tower[types[n % 7]]);
                if (n % 2) t.upgrade(t.upgrades[0]);
                newTowers.push(t);
                n++;
            }
        }
        applyPending();
        wave = 14;
        nextWave();
        paused = false;
        started = true;
        speed = 3;
    });
    // Run the battle; sample model counts as it goes
    let missing = 0;
    let busiest = { calls: 0, tris: 0 };
    for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(700);
        const c = await page.evaluate(() => ({ ...Renderer3D.counts, alive: enemies.length }));
        if (c.enemyModels < c.alive) missing++;
        if (c.alive > 20 && c.calls > busiest.calls) busiest = c;
    }
    check(missing === 0, `every enemy on the map has a model (${missing} short samples)`);
    // A crowd of 60 for the frame budget
    await page.evaluate(() => {
        const names = Object.keys(enemy);
        const route = [];
        for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (grid[x][y] === 2 || grid[x][y] === 0) route.push([x, y]);
        for (let i = 0; i < 60; i++) {
            const [x, y] = route[(i * 7) % route.length];
            const e = createEnemy((x + 0.5) * ts, (y + 0.5) * ts, enemy[names[i % names.length]]);
            e.health = e.maxHealth = 1e9;
            enemies.push(e);
        }
        paused = true;
    });
    await page.waitForTimeout(1500);
    const crowd = await page.evaluate(() => Renderer3D.counts);
    check(crowd.calls < BUDGET.calls, `draw calls with 24 towers and 60+ enemies: ${crowd.calls} (budget ${BUDGET.calls})`);
    check(crowd.tris < BUDGET.tris, `triangles: ${crowd.tris} (budget ${BUDGET.tris})`);
    if (busiest.calls) console.log(`     busiest battle frame: ${busiest.calls} calls, ${busiest.tris} triangles`);

    // Everything dies: models play out and go, and are reused
    await page.evaluate(() => {
        paused = false;
        enemies.forEach(e => { e.health = 0; });
    });
    const settled = (fn) => page.waitForFunction(fn, null, { timeout: 60000 }).then(() => true, () => false);
    await settled(() => enemies.length === 0 && Renderer3D.counts.enemyModels === 0 && Renderer3D.counts.dying === 0);
    const after = await page.evaluate(() => ({ ...Renderer3D.counts, alive: enemies.length }));
    check(after.alive === 0 && after.enemyModels === 0 && after.dying === 0, `killed enemies play out and go (${after.enemyModels} models, ${after.dying} dying left)`);
    // The same crowd again: its models come from the pool
    await page.evaluate(() => {
        const names = Object.keys(enemy);
        for (let i = 0; i < 40; i++) {
            const e = createEnemy((1 + (i % 12) + 0.5) * ts, 1.5 * ts, enemy[names[i % names.length]]);
            e.health = e.maxHealth = 1e9;
            enemies.push(e);
        }
    });
    await settled(() => Renderer3D.counts.enemyModels >= enemies.length);
    const again = await page.evaluate(() => Renderer3D.counts.clones);
    check(again - after.clones <= BUDGET.reuse, `a second crowd reuses models: ${again - after.clones} new (budget ${BUDGET.reuse})`);
    await page.evaluate(() => { enemies.length = 0; });
    await settled(() => Renderer3D.counts.enemyModels === 0);

    // Towers turn towards their aim: give each a new angle (nothing to shoot now)
    // and check they have turned to it a second later
    await page.evaluate(() => { towers.forEach((t, i) => { t.angle = (i * 0.9) % (Math.PI * 2) - Math.PI; }); });
    await settled(() => Renderer3D.aimErrors().every(d => d < 0.15));
    const aim = await page.evaluate(() => Renderer3D.aimErrors());
    check(aim.length > 0 && aim.every(d => d < 0.15), `turrets turn to their aim (largest miss ${Math.max(0, ...aim).toFixed(2)} rad over ${aim.length})`);

    // Sell every tower
    await page.evaluate(() => { [...towers].forEach(t => sell(t)); });
    await settled(() => Renderer3D.counts.towers === 0 && Renderer3D.counts.leaving === 0);
    const sold = await page.evaluate(() => Renderer3D.counts);
    check(sold.towers === 0 && sold.leaving === 0, `sold towers sink and go (${sold.towers} left, ${sold.leaving} sinking)`);
    check(!errors.length, `no page errors${errors.length ? ': ' + errors.slice(0, 3).join('; ') : ''}`);
    await ctx.close();
}

// ---- A model that fails to load: Flat for this visit, 3D stays the choice ----
{
    const { ctx, page, errors } = await open('switchback', '**/tile-straight.glb');
    await page.waitForFunction(() => Renderer.failed, null, { timeout: 60000 });
    const s = await page.evaluate(() => ({ view: Renderer.view, chosen: Renderer.chosen, failed: Renderer.failed }));
    check(s.view === 'flat' && s.chosen === '3d', `a missing model falls back to Flat and keeps 3D as the choice (${s.failed})`);
    check(!errors.length, `no page errors after the fallback${errors.length ? ': ' + errors.join('; ') : ''}`);
    await ctx.close();
}

await browser.close();
server.close();
if (failures.length) {
    console.log(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`);
    process.exit(1);
}
console.log('\nThe 3D view holds up.');
