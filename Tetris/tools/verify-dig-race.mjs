/**
 * Proves a Dig Race can be finished: clears its ten garbage lines in several
 * orders (bottom up, top down and seeded random orders, so garbage above a
 * cleared line has to move down with it) and checks the "Left" count drops by
 * one each time and the race ends with a win after the tenth.
 *
 *   node Tetris/tools/verify-dig-race.mjs        # exit 1 on a problem
 *
 * Each line is cleared by locking a one-cell piece into its hole, through the
 * game's own stack.addPiece and finish check. Runs in Chromium through
 * Playwright and serves the repository itself.
 *
 * Environment:
 *   PLAYWRIGHT_MODULE   path to the playwright package when it isn't resolvable from here
 *   CHROMIUM_PATH       Chromium executable to use instead of Playwright's own download
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const ORDERS = [
  { name: 'bottom line first', pick: 'bottom' },
  { name: 'top garbage line first', pick: 'top' },
  { name: 'random order, seed 1', pick: 'random', seed: 1 },
  { name: 'random order, seed 7', pick: 'random', seed: 7 },
  { name: 'random order, seed 42', pick: 'random', seed: 42 },
];

/** Runs in the page: starts a Dig Race and clears its garbage in the given order. */
function runOrder({ pick, seed }) {
  let s = seed || 1;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  init(3);
  // Skip the READY / GO count-in.
  while (gameState === 2) step();
  const counts = [digLines.length];
  for (let k = 0; k < 12 && gameState === 0; k++) {
    // Rows that still hold garbage (cells of value 8), top to bottom.
    const rows = [];
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 10; x++) {
        if (stack.grid[x][y] === 8) {
          rows.push(y);
          break;
        }
      }
    }
    if (!rows.length) break;
    const row = pick === 'top' ? rows[0] : pick === 'bottom' ? rows[rows.length - 1] : rows[Math.floor(rand() * rows.length)];
    let hole = -1;
    for (let x = 0; x < 10; x++) if (!stack.grid[x][row]) hole = x;
    piece.new(0);
    piece.tetro = [[1]];
    piece.x = hole;
    piece.y = row;
    piece.lastRotate = false;
    stack.addPiece(piece.tetro);
    step(); // runs the finish check
    counts.push(digLines.length);
  }
  return { counts, shown: document.getElementById('line').textContent, gameState, msg: document.getElementById('msg').textContent };
}

// ---------------------------------------------------------------- server and browser

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.json': 'application/json', '.ico': 'image/x-icon',
};
const server = createServer(async (req, res) => {
  try {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (rel.includes('..')) throw new Error('bad path');
    let file = path.join(root, rel);
    if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
await context.route((url) => !url.href.startsWith(origin), (route) => route.abort());
const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message.split('\n')[0]));
await page.goto(`${origin}/Tetris/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof init === 'function' && typeof stack !== 'undefined');

let failed = 0;
const expected = '10,9,8,7,6,5,4,3,2,1,0';
for (const order of ORDERS) {
  const r = await page.evaluate(`(${runOrder.toString()})(${JSON.stringify(order)})`);
  const counts = r.counts.join(',');
  const ok = counts === expected && r.gameState === 1 && r.shown === '0';
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${order.name}: lines left ${counts}${r.gameState === 1 ? ', won' : `, still playing (shows ${r.shown} left)`}`);
}
if (errors.length) {
  failed++;
  console.log('\nPage errors:');
  for (const e of errors) console.log(`  ${e}`);
}
await browser.close();
server.close();
console.log(failed ? `\n${failed} problem(s)` : '\nEvery Dig Race order clears all 10 garbage lines and ends in a win.');
process.exit(failed ? 1 : 0);
