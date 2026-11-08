/**
 * Render the pictures of each tower and enemy that the build menu, the tower panel
 * and the wave preview show, from the 3D models, into models/portraits/*.webp.
 * Run it again after changing a model or how it is coloured:
 *
 *   node TowerDefense/tools/make-portraits.mjs
 *
 * Needs Playwright and Chromium (see tools/browser.mjs).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { serve, launch, repoRoot } from './browser.mjs';

const out = path.join(repoRoot, 'TowerDefense/models/portraits');
const server = await serve();
const browser = await launch();
const page = await browser.newPage();
page.on('pageerror', e => console.error('page error:', e.message));
await page.goto(`${server.origin}/TowerDefense/index.html?map=spiral`);
await page.waitForFunction(() => typeof Renderer3D !== 'undefined' && Renderer3D.loadState.towersReady && Renderer3D.loadState.monsters.length === 10,
    null, { timeout: 120000 });
const pics = await page.evaluate(() => Renderer3D.renderPortraits());
await mkdir(out, { recursive: true });
let n = 0;
for (const [kind, set] of [['tower', pics.towers], ['enemy', pics.enemies]]) {
    for (const [name, url] of Object.entries(set)) {
        await writeFile(path.join(out, `${kind}-${name}.webp`), Buffer.from(url.split(',')[1], 'base64'));
        n++;
    }
}
console.log(`Wrote ${n} pictures to ${path.relative(repoRoot, out)}`);
await browser.close();
server.close();
