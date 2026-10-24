/**
 * Aiming under fire: in a late wave with many bomb and rocket towers exploding,
 * point at towers with a real mouse and click them, again and again. Each click
 * must select the tower under the pointer, the hovered tile must not move while
 * the mouse holds still, and the screen shake must stay small.
 *
 *   node TowerDefense/tools/aim-test.mjs            # exit 1 on any failure
 *
 * Needs Playwright and Chromium, like tools/smoke.mjs (same PLAYWRIGHT_MODULE and
 * CHROMIUM_PATH settings). Serves the repository itself; --root <dir> serves
 * another checkout instead (to compare with an older version).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const args = process.argv.slice(2);
const rootArg = args.indexOf('--root');
const root = rootArg >= 0 ? path.resolve(args[rootArg + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.wav': 'audio/wav', '.json': 'application/json' };
const server = createServer(async (req, res) => {
    try {
        let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
        if (rel.includes('..')) throw new Error('bad path');
        let file = path.join(root, rel);
        if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(body);
    } catch {
        res.writeHead(404);
        res.end();
    }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

async function loadPlaywright() {
    for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
        try {
            const mod = await import(path.isAbsolute(c) ? pathToFileURL(path.join(c, 'index.mjs')).href : c);
            return mod.chromium ? mod : mod.default;
        } catch { /* next */ }
    }
    throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE.');
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});

const failures = [];
const check = (ok, what) => {
    if (!ok) failures.push(what);
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

async function scenario({ shake, zoom, jitter, clicks }) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
        try { localStorage.setItem('gamelab:tower-defense:tipsDone', 'true'); } catch (e) { /* private mode */ }
    });
    await page.goto(`${origin}/TowerDefense/index.html?map=spiral`);
    await page.waitForFunction(() => typeof towers !== 'undefined' && typeof Renderer !== 'undefined' && cols > 0);

    // A late wave: 22 bomb and rocket towers (half of them upgraded) around the road,
    // six gun towers to aim at, no losing
    const targets = await page.evaluate(({ shake, zoom }) => {
        closeOverlay('levels');
        if (typeof endTips === 'function') endTips();
        if ('shakeLevel' in FX) FX.shakeLevel = shake; else FX.shakeOn = shake > 0;
        godMode = true;
        cash = 1e6;
        const free = [];
        for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (grid[x][y] === 3) free.push([x, y]);
        const aim = [7, 19, 31, 43, 55, 67].map(i => free[i % free.length]);
        const busy = free.filter(([x, y], i) => i % 3 === 1 && !aim.some(([a, b]) => a === x && b === y));
        const kinds = ['bomb', 'rocket'];
        busy.slice(0, 22).forEach(([x, y], i) => {
            const t = createTower(x, y, tower[kinds[i % 2]]);
            if (i % 2 === 0) t.upgrade(t.upgrades[0]), t.upgrades = [];
            newTowers.push(t);
        });
        aim.forEach(([x, y]) => newTowers.push(createTower(x, y, tower.gun)));
        applyPending();
        // Wave 25 of 30
        newEnemies = [];
        wave = 24;
        nextWave();
        speed = 2;
        pause();
        if (zoom > 1) Renderer.setZoom(zoom);
        window.__blasts = 0;
        const blast = FX.blast;
        FX.blast = (...a) => { window.__blasts++; return blast(...a); };
        // Shake offset of every frame
        window.__shakes = [];
        const frame = Renderer.frame;
        Renderer.frame = (s) => {
            frame(s);
            const sh = Renderer.shake;
            window.__shakes.push(sh ? Math.hypot(sh.x, sh.y) : FX.shakeMag * ts * 0.5 * Renderer.zoom * Math.SQRT1_2);
        };
        return aim;
    }, { shake, zoom });

    // Let the battle get going
    await page.waitForTimeout(2500);
    const label = `${['shake off', 'shake subtle', 'shake full'][shake]}, zoom ${zoom}, ${jitter}px hand jitter`;

    let hits = 0;
    let hoverJumps = 0;
    for (let i = 0; i < clicks; i++) {
        const [tx, ty] = targets[i % targets.length];
        const pos = await page.evaluate(([x, y]) => {
            const t = getTower(x, y);
            Renderer.reveal(t.pos.x, t.pos.y);
            return Renderer.toScreen(t.pos.x, t.pos.y);
        }, [tx, ty]);
        // Move in like a hand would, settle within a few pixels of the centre
        const j = () => (Math.random() - 0.5) * 6;
        await page.mouse.move(pos.x + 40, pos.y - 30);
        const at = { x: pos.x + j(), y: pos.y + j() };
        await page.mouse.move(at.x, at.y, { steps: 6 });
        // Hold still for a few frames: the hovered tile must stay the same
        const tiles = [];
        for (let k = 0; k < 5; k++) {
            tiles.push(await page.evaluate(() => {
                const h = Renderer.hover;
                return h ? `${Math.floor(h.x / ts)},${Math.floor(h.y / ts)}` : 'none';
            }));
            await page.waitForTimeout(40);
        }
        if (new Set(tiles).size !== 1 || tiles[0] !== `${tx},${ty}`) {
            hoverJumps++;
            console.log(`     hover on ${tx},${ty}: ${tiles.join(' ')}`);
        }
        // Click with the hand drifting `jitter` pixels between press and release
        const a = Math.random() * Math.PI * 2;
        await page.mouse.down();
        await page.mouse.move(at.x + Math.cos(a) * jitter, at.y + Math.sin(a) * jitter, { steps: 3 });
        await page.mouse.up();
        await page.waitForTimeout(60);
        const sel = await page.evaluate(() => selected ? [selected.gridPos.x, selected.gridPos.y] : null);
        if (sel && sel[0] === tx && sel[1] === ty) hits++;
        else console.log(`     click on ${tx},${ty} selected ${sel}`);
        await page.keyboard.press('Escape');
    }
    const blasts = await page.evaluate(() => window.__blasts);
    check(blasts >= 30, `${label}: explosions going off (${blasts} while aiming)`);
    const shakes = await page.evaluate(() => window.__shakes);
    const maxShake = Math.max(0, ...shakes);
    const moving = shakes.filter(s => s > 0.5).length / Math.max(1, shakes.length);
    const cap = shake === 0 ? 0 : shake === 1 ? 3.01 : 6.01;
    check(hits === clicks, `${label}: ${hits} of ${clicks} clicks selected the tower under the pointer`);
    check(hoverJumps === 0, `${label}: hovered tile steady on every target (${hoverJumps} jumps)`);
    check(maxShake <= cap, `${label}: biggest shake ${maxShake.toFixed(1)} px (limit ${cap.toFixed(0)} px)`);
    check(moving <= (shake === 2 ? 0.35 : 0.1), `${label}: map shaking in ${(moving * 100).toFixed(0)}% of frames`);
    check(!errors.length, `${label}: no page errors${errors.length ? ': ' + errors.join('; ') : ''}`);
    await page.close();
}

await scenario({ shake: 1, zoom: 1, jitter: 4, clicks: 18 });
await scenario({ shake: 2, zoom: 1, jitter: 4, clicks: 18 });
await scenario({ shake: 2, zoom: 2, jitter: 10, clicks: 12 });

await browser.close();
server.close();
if (failures.length) {
    console.log(`\n${failures.length} check${failures.length === 1 ? '' : 's'} failed`);
    process.exit(1);
}
console.log('\nAiming holds up under fire.');
