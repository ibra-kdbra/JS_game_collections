// Renders previews of the theme music to audio files, so it can be heard
// without opening the game.
//
//   node Brainy_Warrior/tools/render-music.mjs [out-dir] [--only=lead,pad] [--seed=7]
//
// Runs js/music.js in an OfflineAudioContext in headless Chromium (Playwright),
// pumping the same look-ahead scheduler the game uses, and plays a short
// script of game events (band changes, magic, the last enemy, a win...).
// Writes WAV files, plus MP3 when ffmpeg is on the PATH (or FFMPEG=...).
// Prints the in-game level of each render (peak and RMS in dBFS at the default
// music volume); the files themselves are normalised to -1 dBFS for listening.
//
// Environment: PLAYWRIGHT (path to the playwright package) and CHROME (a
// Chromium executable), as for perf-check.mjs.
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const outDir = resolve(args.find((a) => !a.startsWith('--')) || 'music-preview');
const only = flag('only')?.split(',') || null;
const seed = Number(flag('seed') || 7);
const RATE = 44100;

// [seconds, action, value]. Bands: 0 easy, 1 medium, 2 hard, 3 expert.
const RENDERS = {
    'brainy-theme': {
        seconds: 92,
        events: [
            [0, 'band', 0], [0, 'start'],
            [24, 'magic'], [31, 'band', 1], [44, 'magic'], [56, 'band', 2],
            [64, 'nearEnd', true], [80, 'stinger', 'win'],
        ],
    },
    'brainy-theme-expert': {
        seconds: 50,
        events: [[0, 'band', 3], [0, 'start'], [14, 'magic'], [22, 'ai', true], [40, 'ai', false], [41, 'stinger', 'win']],
    },
    'brainy-stingers': {
        seconds: 16,
        events: [[0, 'band', 1], [0, 'start'], [4, 'stinger', 'win'], [9, 'stinger', 'fall'], [13, 'stinger', 'stuck']],
    },
};

const ROOT = normalize(join(fileURLToPath(import.meta.url), '../../..'));
const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (url === '/__render') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>render</title>');
    const path = normalize(join(ROOT, decodeURIComponent(url)));
    if (!path.startsWith(ROOT)) return res.writeHead(403).end();
    try {
        const body = await readFile((await stat(path)).isDirectory() ? join(path, 'index.html') : path);
        res.writeHead(200, { 'content-type': extname(path) === '.js' ? 'text/javascript' : 'application/octet-stream' }).end(body);
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
const browser = await playwright.chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/__render`);
await mkdir(outDir, { recursive: true });

let ffmpeg = process.env.FFMPEG || 'ffmpeg';
try {
    execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
    ffmpeg = null;
}

for (const [name, spec] of Object.entries(RENDERS)) {
    const t0 = Date.now();
    const stats = await page.evaluate(
        async ({ spec, rate, only, seed }) => {
            const { createMusic } = await import('/Brainy_Warrior/js/music.js');
            const { MUSIC_LEVEL, DEFAULT_VOLUME, LOOKAHEAD } = await import('/Brainy_Warrior/js/music-score.js');
            const ctx = new OfflineAudioContext(2, Math.ceil(rate * spec.seconds), rate);
            const vol = ctx.createGain();
            vol.gain.value = MUSIC_LEVEL * DEFAULT_VOLUME ** 2;
            vol.connect(ctx.destination);
            const music = createMusic(ctx, vol, { seed, only });
            const events = spec.events.slice();
            const fire = (now) => {
                while (events.length && events[0][0] <= now + 1e-6) {
                    const [t, what, v] = events.shift();
                    if (what === 'start') music.start(t);
                    else if (what === 'band') music.setBand(v, t);
                    else if (what === 'ai') music.setAi(v, t);
                    else if (what === 'nearEnd') music.setNearEnd(v, t);
                    else if (what === 'magic') music.shimmer(t);
                    else if (what === 'stinger') music.stinger(v, t);
                }
                music.pump(now + LOOKAHEAD);
            };
            fire(0);
            const tick = 0.1;
            for (let t = tick; t < spec.seconds; t += tick) {
                ctx.suspend(t).then(() => {
                    fire(ctx.currentTime);
                    ctx.resume();
                });
            }
            const buf = await ctx.startRendering();
            const L = buf.getChannelData(0);
            const R = buf.getChannelData(1);
            let peak = 0;
            let peakAt = 0;
            let sum = 0;
            for (let i = 0; i < L.length; i++) {
                const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
                if (a > peak) {
                    peak = a;
                    peakAt = i / rate;
                }
                sum += L[i] * L[i] + R[i] * R[i];
            }
            const rms = Math.sqrt(sum / (2 * L.length));
            // Loudest 3-second window, a rough "short-term loudness".
            const win = rate * 3;
            let best = 0;
            for (let s = 0; s + win <= L.length; s += rate / 2) {
                let w = 0;
                for (let i = s; i < s + win; i++) w += L[i] * L[i] + R[i] * R[i];
                best = Math.max(best, Math.sqrt(w / (2 * win)));
            }
            // 16-bit WAV, normalised to -1 dBFS.
            const gain = peak ? 0.891 / peak : 1;
            const n = L.length;
            const bytes = new Uint8Array(44 + n * 4);
            const dv = new DataView(bytes.buffer);
            const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
            str(0, 'RIFF');
            dv.setUint32(4, 36 + n * 4, true);
            str(8, 'WAVEfmt ');
            dv.setUint32(16, 16, true);
            dv.setUint16(20, 1, true);
            dv.setUint16(22, 2, true);
            dv.setUint32(24, rate, true);
            dv.setUint32(28, rate * 4, true);
            dv.setUint16(32, 4, true);
            dv.setUint16(34, 16, true);
            str(36, 'data');
            dv.setUint32(40, n * 4, true);
            for (let i = 0; i < n; i++) {
                dv.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(L[i] * gain * 32767))), true);
                dv.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(R[i] * gain * 32767))), true);
            }
            window.__wav = bytes;
            const db = (x) => (x ? 20 * Math.log10(x) : -Infinity);
            return { peak: db(peak), peakAt, rms: db(rms), loudest3s: db(best), bytes: bytes.length };
        },
        { spec, rate: RATE, only, seed },
    );
    // Pull the WAV out in slices.
    const chunks = [];
    const SLICE = 4 * 1024 * 1024;
    for (let o = 0; o < stats.bytes; o += SLICE) {
        const b64 = await page.evaluate(
            ({ o, n }) => {
                const part = window.__wav.subarray(o, o + n);
                let s = '';
                for (let i = 0; i < part.length; i += 0x8000) s += String.fromCharCode.apply(null, part.subarray(i, i + 0x8000));
                return btoa(s);
            },
            { o, n: SLICE },
        );
        chunks.push(Buffer.from(b64, 'base64'));
    }
    const suffix = only ? `-${only.join('+')}` : '';
    const wav = join(outDir, `${name}${suffix}.wav`);
    await writeFile(wav, Buffer.concat(chunks));
    let mp3 = '';
    if (ffmpeg) {
        mp3 = wav.replace(/\.wav$/, '.mp3');
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-q:a', '2', mp3]);
    }
    const f = (x) => x.toFixed(1).padStart(6);
    console.log(
        `${(name + suffix).padEnd(30)} ${spec.seconds}s  in-game peak ${f(stats.peak)} dBFS (at ${stats.peakAt.toFixed(1)} s)  RMS ${f(stats.rms)} dBFS  loudest 3 s ${f(stats.loudest3s)} dBFS  (${((Date.now() - t0) / 1000).toFixed(1)} s)`,
    );
    console.log(`  ${wav}${mp3 ? `\n  ${mp3}` : ''}`);
}
for (const e of errors) console.log(`page error: ${e}`);
await browser.close();
server.close();
process.exitCode = errors.length ? 1 : 0;
