#!/usr/bin/env node
/**
 * Smoke test: serves the repository the way GitHub Pages publishes it and opens the hub,
 * the Art Lab and every game and experiment registered in assets/js/data.js, at phone size
 * (390x844, touch) and desktop size (1280x800).
 *
 * A page fails on an uncaught error, a console error, or any same-origin request that
 * returns 404 (or another 4xx/5xx) or fails. Paths excluded from the published site by
 * _config.yml are served as 404 here, so a page that needs one fails too.
 *
 * It also checks the registry itself: every local path in data.js (pages and thumbnails)
 * must exist; external URLs are only listed.
 *
 * Usage: node tools/smoke.mjs [--only <slug,...>] [--viewport phone|desktop]
 *
 * Environment:
 *   PLAYWRIGHT_MODULE   path to the playwright package when it isn't resolvable from here
 *                       (e.g. a global install: /usr/lib/node_modules/playwright)
 *   CHROMIUM_PATH       Chromium executable to use instead of Playwright's own download
 *   SMOKE_OFFLINE=1     block every cross-origin request (no network needed)
 *   SMOKE_STRICT=1      also fail on warnings: scripts, styles or fonts loaded from another
 *                       origin (the site should be self-hosted) and failed external requests
 *   SMOKE_SETTLE_MS     how long to watch each page after load (default 2500)
 *   SMOKE_CONCURRENCY   pages checked in parallel (default 4)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const only = argValue('--only')?.split(',').filter(Boolean);
const onlyViewport = argValue('--viewport');
const SETTLE_MS = Number(process.env.SMOKE_SETTLE_MS || 2500);
const CONCURRENCY = Number(process.env.SMOKE_CONCURRENCY || 4);
const OFFLINE = process.env.SMOKE_OFFLINE === '1';
const STRICT = process.env.SMOKE_STRICT === '1';

// ---------------------------------------------------------------- registry checks

const { games, experiments, thumbSet } = await import(pathToFileURL(path.join(root, 'assets/js/data.js')).href);

const registryProblems = [];
const externalUrls = new Set();
const isExternal = (p) => /^[a-z][a-z0-9+.-]*:/i.test(p) || p.startsWith('//');

function checkLocalPath(p, what) {
  if (isExternal(p)) {
    externalUrls.add(p);
    return;
  }
  const clean = decodeURIComponent(p.split(/[?#]/)[0]);
  if (!existsSync(path.join(root, clean))) registryProblems.push(`${what}: ${p} does not exist`);
}

for (const entry of [...games, ...experiments]) {
  if (!entry.slug || !entry.title || !entry.href) {
    registryProblems.push(`entry ${JSON.stringify(entry.slug ?? entry.title)} is missing slug, title or href`);
    continue;
  }
  checkLocalPath(entry.href, `${entry.slug} href`);
  const t = thumbSet(entry.slug, '');
  checkLocalPath(t.src, `${entry.slug} thumbnail`);
  for (const part of t.srcset.split(',')) checkLocalPath(part.trim().split(/\s+/)[0], `${entry.slug} thumbnail`);
}
// Any other URL-looking strings in the registry source (links in blurbs and the like).
const dataSource = readFileSync(path.join(root, 'assets/js/data.js'), 'utf8');
for (const m of dataSource.matchAll(/https?:\/\/[^\s'"`)<>]+/g)) externalUrls.add(m[0]);

const slugs = new Set();
for (const entry of [...games, ...experiments]) {
  if (slugs.has(entry.slug)) registryProblems.push(`duplicate slug ${entry.slug}`);
  slugs.add(entry.slug);
}

// ---------------------------------------------------------------- static server

/** Top-level `exclude:` list from _config.yml (the only Jekyll setting this site uses). */
function readExcludes() {
  const file = path.join(root, '_config.yml');
  if (!existsSync(file)) return [];
  const out = [];
  let inExclude = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (/^exclude:\s*$/.test(line)) inExclude = true;
    else if (/^\S/.test(line)) inExclude = false;
    else if (inExclude) {
      const m = line.match(/^\s*-\s*["']?([^"'#]+?)["']?\s*(#.*)?$/);
      if (m) out.push(m[1].replace(/\/$/, ''));
    }
  }
  return out;
}
const excludes = readExcludes();
const isExcluded = (rel) =>
  rel.split('/').some((part) => part.startsWith('.') || part.startsWith('_')) ||
  excludes.some((ex) => rel === ex || rel.startsWith(ex + '/'));

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
  '.frag': 'text/plain', '.vert': 'text/plain', '.webmanifest': 'application/manifest+json',
};

const server = createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
    if (rel.includes('..')) throw new Error('bad path');
    let file = path.join(root, rel);
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) {
      if (rel && !rel.endsWith('/')) {
        res.writeHead(301, { Location: '/' + rel + '/' });
        return res.end();
      }
      rel = path.posix.join(rel, 'index.html');
      file = path.join(root, rel);
      info = await stat(file).catch(() => null);
    }
    if (!info || isExcluded(rel)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(400);
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

// ---------------------------------------------------------------- browser

async function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean);
  for (const c of candidates) {
    try {
      const spec = path.isAbsolute(c) ? pathToFileURL(path.join(c, 'index.mjs')).href : c;
      const mod = await import(spec);
      return mod.chromium ? mod : mod.default;
    } catch {
      /* try the next one */
    }
  }
  throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE.');
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
};

const pages = [
  { slug: 'hub', title: 'Hub', href: 'index.html' },
  { slug: 'art-lab', title: 'Art Lab', href: 'Art_Lab/index.html' },
  ...games,
  ...experiments,
].filter((p) => !only || only.includes(p.slug));

const sameOrigin = (url) => url.startsWith(origin);
const short = (url) => (sameOrigin(url) ? url.slice(origin.length) : url);

async function check(entry, vpName) {
  const context = await browser.newContext({ ...VIEWPORTS[vpName], serviceWorkers: 'block' });
  const problems = [];
  const warnings = [];
  const note = (msg) => {
    if (!problems.includes(msg)) problems.push(msg);
  };
  const warn = (msg) => {
    if (!warnings.includes(msg)) warnings.push(msg);
  };
  if (OFFLINE) {
    await context.route((url) => !url.href.startsWith(origin), (route) => route.abort('internetdisconnected'));
  }
  const page = await context.newPage();
  page.on('pageerror', (err) => note(`uncaught: ${err.message.split('\n')[0]}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // Failed loads are reported (with their URL) by the response and requestfailed handlers.
    if (/^Failed to load resource/.test(text)) return;
    // Embedded third-party frames (the YouTube player) log their own errors; not ours.
    const where = msg.location()?.url || '';
    if (where && !sameOrigin(where)) return;
    note(`console: ${text.split('\n')[0].slice(0, 200)}`);
  });
  page.on('response', (res) => {
    if (sameOrigin(res.url()) && res.status() >= 400) note(`${res.status()} ${short(res.url())}`);
  });
  page.on('request', (req) => {
    const type = req.resourceType();
    if (!sameOrigin(req.url()) && !req.url().startsWith('data:') && ['script', 'stylesheet', 'font'].includes(type)) {
      warn(`${type} from another origin: ${req.url()}`);
    }
  });
  page.on('requestfailed', (req) => {
    const reason = req.failure()?.errorText || 'failed';
    // Navigating away or stopping media mid-download aborts requests; that isn't a failure.
    if (reason === 'net::ERR_ABORTED') return;
    if (sameOrigin(req.url())) note(`request failed (${reason}) ${short(req.url())}`);
    else if (!OFFLINE) warn(`external request failed (${reason}) ${req.url()}`);
  });

  try {
    const res = await page.goto(`${origin}/${entry.href}`, { waitUntil: 'load', timeout: 30000 });
    if (!res || !res.ok()) note(`page answered ${res?.status() ?? 'nothing'}`);
    await page.waitForTimeout(SETTLE_MS);
    // A light poke so start screens and first frames run: a key press, and a tap on phones.
    await page.keyboard.press('Enter').catch(() => {});
    if (VIEWPORTS[vpName].hasTouch) {
      const { width, height } = VIEWPORTS[vpName].viewport;
      await page.touchscreen.tap(width / 2, height * 0.75).catch(() => {});
    }
    await page.waitForTimeout(1000);
  } catch (err) {
    note(`load: ${err.message.split('\n')[0]}`);
  }
  await context.close();
  if (STRICT) problems.push(...warnings.splice(0));
  return { problems, warnings };
}

const jobs = [];
for (const entry of pages) {
  for (const vp of Object.keys(VIEWPORTS)) {
    if (!onlyViewport || onlyViewport === vp) jobs.push({ entry, vp });
  }
}
const results = new Map();
let next = 0;
await Promise.all(
  Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const result = await check(job.entry, job.vp);
      results.set(`${job.entry.slug}|${job.vp}`, result);
      process.stdout.write(result.problems.length ? 'F' : result.warnings.length ? 'w' : '.');
    }
  }),
);
process.stdout.write('\n\n');
await browser.close();
server.close();

// ---------------------------------------------------------------- report

let failed = registryProblems.length > 0;
console.log('Registry (assets/js/data.js)');
if (registryProblems.length) for (const p of registryProblems) console.log(`  FAIL ${p}`);
else console.log(`  ok   ${games.length} games and ${experiments.length} experiments: every local path exists`);
if (externalUrls.size) {
  console.log('  External URLs (not fetched):');
  for (const u of externalUrls) console.log(`       ${u}`);
}
// Firefox ignores an import map that comes after a module script or modulepreload,
// so every bare import ("three") then fails there; Chromium is lenient and won't show it.
console.log('\nHTML');
let htmlProblems = 0;
for (const entry of pages) {
  const file = path.join(root, decodeURIComponent(entry.href.split(/[?#]/)[0]));
  if (!existsSync(file)) continue;
  const html = readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const map = html.search(/<script[^>]*type=["']importmap["']/i);
  const module = html.search(/<script[^>]*type=["']module["']|<link[^>]*rel=["']modulepreload["']/i);
  if (map >= 0 && module >= 0 && module < map) {
    console.log(`  FAIL ${entry.href}: the import map comes after a module script or modulepreload`);
    htmlProblems++;
  }
}
if (htmlProblems) failed = true;
else console.log('  ok   import maps come before any module script or modulepreload');

console.log('\nPages');
for (const entry of pages) {
  for (const vp of Object.keys(VIEWPORTS)) {
    const result = results.get(`${entry.slug}|${vp}`);
    if (!result) continue;
    const { problems, warnings } = result;
    const label = `${entry.title} (${entry.href}) @ ${vp}`;
    if (problems.length) failed = true;
    console.log(`  ${problems.length ? 'FAIL' : warnings.length ? 'warn' : 'ok  '} ${label}`);
    for (const p of problems) console.log(`         ${p}`);
    for (const w of warnings) console.log(`         (warning) ${w}`);
  }
}
console.log(failed ? '\nSmoke test failed.' : '\nSmoke test passed.');
process.exit(failed ? 1 : 0);
