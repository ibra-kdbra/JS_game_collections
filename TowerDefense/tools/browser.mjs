/**
 * Shared by the browser tools (make-portraits.mjs, test-3d.mjs): serve the
 * repository on a free port and start Chromium through Playwright.
 *
 * Playwright is found the same way as tools/smoke.mjs: PLAYWRIGHT_MODULE (the
 * playwright package directory) or a normal `playwright` install; CHROMIUM_PATH
 * picks the browser binary.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.wav': 'audio/wav', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm'
};

/** Serve `root`; resolves to { origin, close, bytes(prefix) } where bytes counts what was sent. */
export async function serve(root = repoRoot) {
    const sent = [];
    const server = createServer(async (req, res) => {
        try {
            const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
            if (rel.includes('..')) throw new Error('bad path');
            let file = path.join(root, rel);
            if ((await stat(file).catch(() => null))?.isDirectory()) file = path.join(file, 'index.html');
            const body = await readFile(file);
            sent.push([rel, body.length]);
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(body);
        } catch {
            res.writeHead(404);
            res.end();
        }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    return {
        origin: `http://127.0.0.1:${server.address().port}`,
        close: () => server.close(),
        bytes: (prefix) => sent.filter(([rel]) => rel.startsWith(prefix)).reduce((n, [, len]) => n + len, 0),
        reset: () => { sent.length = 0; }
    };
}

/** Chromium with software WebGL (the CI machines have no GPU). */
export async function launch() {
    let pw = null;
    for (const c of [process.env.PLAYWRIGHT_MODULE, 'playwright'].filter(Boolean)) {
        try {
            const mod = await import(path.isAbsolute(c) ? pathToFileURL(path.join(c, 'index.mjs')).href : c);
            pw = mod.chromium ? mod : mod.default;
            break;
        } catch { /* next */ }
    }
    if (!pw) throw new Error('Playwright not found. Run `npm i --no-save playwright` or set PLAYWRIGHT_MODULE.');
    return pw.chromium.launch({
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
    });
}
