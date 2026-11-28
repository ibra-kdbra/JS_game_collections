/**
 * Shared by the browser gameplay checks (<Game>/tools/verify-play.mjs, run together by
 * tools/play-checks.mjs): serves the repository on a free port, starts Chromium through
 * Playwright, and opens a game page that records every uncaught error and console error.
 *
 * Playwright is found the same way as tools/smoke.mjs: PLAYWRIGHT_MODULE (the playwright
 * package directory) or a normal `playwright` install; CHROMIUM_PATH picks the browser.
 * Every cross-origin request is blocked, so the checks need no network.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.bmp': 'image/bmp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.wav': 'audio/wav', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8',
};

/** Serve the repository; resolves to { origin, close }. */
export async function serve(root = repoRoot) {
  const server = createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
      if (rel.includes('..')) throw new Error('bad path');
      let file = path.join(root, rel);
      if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

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

/**
 * Start a check: serve the repo and launch Chromium. Returns helpers:
 *   open(href, { viewport, intercept, init })  a page with error tracking (page.errors)
 *   ok(cond, msg) / fail(msg)                  record a result line
 *   finish()                                   close everything and exit 0 or 1
 * `intercept` maps a path (e.g. 'PacMan/pacman.js') to a function (source) => source,
 * so a check can expose a game's closure-scoped internals without changing the file.
 */
export async function startCheck(title) {
  const started = Date.now();
  console.log(title);
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  });
  let failures = 0;
  const pages = [];

  const ok = (cond, msg) => {
    if (cond) console.log(`  ok   ${msg}`);
    else {
      failures++;
      console.log(`  FAIL ${msg}`);
    }
    return !!cond;
  };
  const fail = (msg) => ok(false, msg);

  async function open(href, { viewport = { width: 1280, height: 800 }, intercept = {}, init, touch = false } = {}) {
    const context = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, serviceWorkers: 'block' });
    await context.route((url) => !url.href.startsWith(server.origin), (route) => route.abort('internetdisconnected'));
    for (const [rel, edit] of Object.entries(intercept)) {
      await context.route(`${server.origin}/${rel}`, async (route) => {
        const source = await readFile(path.join(repoRoot, rel), 'utf8');
        route.fulfill({ status: 200, contentType: 'text/javascript', body: edit(source) });
      });
    }
    if (init) await context.addInitScript(init);
    const page = await context.newPage();
    page.errors = [];
    page.on('pageerror', (err) => page.errors.push(`uncaught: ${err.message.split('\n')[0]}`));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      const text = msg.text();
      if (/^Failed to load resource/.test(text)) return;
      page.errors.push(`console: ${text.split('\n')[0].slice(0, 200)}`);
    });
    page.on('response', (res) => {
      if (res.url().startsWith(server.origin) && res.status() >= 400) {
        page.errors.push(`${res.status()} ${res.url().slice(server.origin.length)}`);
      }
    });
    pages.push(context);
    await page.goto(`${server.origin}/${href}`, { waitUntil: 'load', timeout: 30000 });
    return page;
  }

  /** Record a failure for every error the page logged (and clear the list). */
  const noErrors = (page, what = 'no script errors') => {
    const errs = page.errors.splice(0);
    ok(errs.length === 0, errs.length ? `${what}: ${errs.slice(0, 3).join('; ')}` : what);
  };

  async function finish() {
    for (const c of pages) await c.close().catch(() => {});
    await browser.close();
    server.close();
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(failures ? `${failures} check(s) failed (${secs}s)` : `All checks passed (${secs}s)`);
    process.exit(failures ? 1 : 0);
  }

  /** Run the body; any exception is a failure, and the check always finishes. */
  async function run(body) {
    try {
      await body();
    } catch (err) {
      fail(`crashed: ${err.message.split('\n')[0]}`);
    }
    await finish();
  }

  return { open, ok, fail, noErrors, run, origin: server.origin };
}

/** Poll `fn` in the page until it returns truthy or `timeout` ms pass; returns the last value. */
export async function waitFor(page, fn, arg, { timeout = 10000, interval = 100 } = {}) {
  const end = Date.now() + timeout;
  let value;
  do {
    value = await page.evaluate(fn, arg);
    if (value) return value;
    await page.waitForTimeout(interval);
  } while (Date.now() < end);
  return value;
}

/**
 * Insert `code` just before the final `})();` or `}).call(this);` of an IIFE-wrapped script,
 * so it runs inside the closure. Throws if the script no longer ends that way.
 */
export function beforeIifeEnd(source, code) {
  const m = source.match(/\}\)(\.call\(this\))?\(?\)?;\s*$/);
  if (!m) throw new Error('script does not end with an IIFE close');
  return source.slice(0, m.index) + '\n' + code + '\n' + source.slice(m.index);
}

/** A seeded Math.random for addInitScript, so runs are repeatable. */
export const seededRandom = (seed) => `(() => {
  let s = ${seed >>> 0} || 1;
  Math.random = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();`;
