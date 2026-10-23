// Performance budget check for Brainy Warrior 3D.
//
//   node Brainy_Warrior/tools/perf-check.mjs
//
// Serves the repository on a local port, opens the game in headless Chromium
// (Playwright) at the highest quality tier (the worst case: real character
// shadows, so every skinned mesh is drawn twice), loads every level and checks
// the budgets below. It also checks the total download of the game. Frame
// rate is not checked: headless Chromium renders on the CPU (SwiftShader), so
// its fps says nothing about a phone. Draw calls, triangles, textures and
// bytes do.
//
// Environment: PLAYWRIGHT (path to the playwright package, default: resolve
// "playwright", then /opt/node22/lib/node_modules/playwright) and CHROME (a
// Chromium executable; default: Playwright's own).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BUDGET = {
    drawCalls: 150, //       per frame, including the shadow pass
    triangles: 300_000, //   per frame, including the shadow pass
    textures: 32, //         live GPU textures
    downloadBytes: 5 * 1024 * 1024, // everything the game fetches, uncompressed
    modelBytes: 1024 * 1024, // the character models together
    heapMB: 32, //           JS heap after visiting every level
};

const ROOT = normalize(join(fileURLToPath(import.meta.url), '../../..'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };
const served = new Map();
const server = createServer(async (req, res) => {
    const path = normalize(join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!path.startsWith(ROOT)) return res.writeHead(403).end();
    try {
        const body = await readFile((await stat(path)).isDirectory() ? join(path, 'index.html') : path);
        served.set(req.url.split('?')[0], body.length);
        res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' }).end(body);
    } catch {
        res.writeHead(404).end();
    }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const require = createRequire(import.meta.url);
let playwright;
for (const p of [process.env.PLAYWRIGHT, 'playwright', '/opt/node22/lib/node_modules/playwright'].filter(Boolean)) {
    try {
        playwright = require(p);
        break;
    } catch {}
}
if (!playwright) {
    console.log('Playwright not found: set PLAYWRIGHT to the playwright package.');
    process.exit(2);
}
const browser = await playwright.chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const t0 = Date.now();
await page.goto(`${base}/Brainy_Warrior/index.html?quality=0&speed=8`);
await page.waitForFunction(() => window.brainy?.level, null, { timeout: 120000 });
const loadMs = Date.now() - t0;
const models = await page.evaluate(() => window.brainy.renderInfo.models);

let failures = 0;
const fail = (what) => {
    failures++;
    console.log(`FAIL ${what}`);
};
const ids = await page.evaluate(() => window.brainy.levelIds);
console.log(' #  level                 calls  triangles  textures  geometries');
let worst = { calls: 0, triangles: 0 };
for (let i = 0; i < ids.length; i++) {
    await page.evaluate((i) => window.brainy.loadLevel(i), i);
    await page.waitForFunction(() => window.brainy.idle, null, { timeout: 60000 });
    // Two frames so the numbers describe a settled frame.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const r = await page.evaluate(() => window.brainy.renderInfo);
    worst = { calls: Math.max(worst.calls, r.calls), triangles: Math.max(worst.triangles, r.triangles) };
    console.log(`${String(i + 1).padStart(2)}  ${ids[i].padEnd(20)} ${String(r.calls).padStart(6)} ${String(r.triangles).padStart(10)} ${String(r.textures).padStart(9)} ${String(r.geometries).padStart(11)}`);
    if (r.calls > BUDGET.drawCalls) fail(`${ids[i]}: ${r.calls} draw calls > ${BUDGET.drawCalls}`);
    if (r.triangles > BUDGET.triangles) fail(`${ids[i]}: ${r.triangles} triangles > ${BUDGET.triangles}`);
    if (r.textures > BUDGET.textures) fail(`${ids[i]}: ${r.textures} textures > ${BUDGET.textures}`);
}
// Collect garbage first, so the heap reflects what the game keeps alive.
const cdp = await page.context().newCDPSession(page);
await cdp.send('HeapProfiler.collectGarbage');
const heapMB = (await cdp.send('Runtime.getHeapUsage')).usedSize / 1048576;
const total = [...served.values()].reduce((a, b) => a + b, 0);
const modelBytes = [...served].filter(([u]) => u.endsWith('.glb')).reduce((a, [, b]) => a + b, 0);
console.log(`\nModels: ${models}. Load to first level: ${loadMs} ms (headless, CPU rendering).`);
console.log(`Download: ${(total / 1024).toFixed(0)} KB in ${served.size} files (models ${(modelBytes / 1024).toFixed(0)} KB).`);
console.log(`Worst level: ${worst.calls} draw calls, ${worst.triangles} triangles. JS heap ${heapMB.toFixed(1)} MB.`);
if (models !== 'gltf') fail('the character models did not load');
if (total > BUDGET.downloadBytes) fail(`download ${total} bytes > ${BUDGET.downloadBytes}`);
if (modelBytes > BUDGET.modelBytes) fail(`models ${modelBytes} bytes > ${BUDGET.modelBytes}`);
if (heapMB > BUDGET.heapMB) fail(`JS heap ${heapMB.toFixed(1)} MB > ${BUDGET.heapMB}`);
for (const e of errors) fail(`page error: ${e}`);
console.log(failures ? `\n${failures} budget check(s) failed.` : '\nAll performance budgets met.');
await browser.close();
server.close();
process.exitCode = failures ? 1 : 0;
