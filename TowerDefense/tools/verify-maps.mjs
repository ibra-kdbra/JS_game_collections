/**
 * Plays every campaign map with a simple build-order bot in the real game logic,
 * and rates how hard each one is.
 *
 *   node TowerDefense/tools/verify-maps.mjs             # CI check: exit 1 on any problem
 *   node TowerDefense/tools/verify-maps.mjs --rate      # also measure each map's margin (slower)
 *   node TowerDefense/tools/verify-maps.mjs --map spiral,moat --seeds 5 --debug
 *
 * The game scripts (towers, enemies, waves, maps and sketch.js itself) run in a Node
 * VM with the browser stubbed out: no drawing, sound or page interface, the same
 * game ticks. Checks per campaign map (CAMPAIGN in scripts/maps.js):
 *   - every portal reaches the gate by following the enemy directions, along tiles
 *     enemies can walk; so do enemies from a Hive's portal, which opens wherever the
 *     Hive dies and sends them on the way the Hive was walking
 *   - the bot wins all 30 campaign waves on Normal, on every seed
 *
 * The bot plays fair: Normal lives and gold, the map's own tuning, no early wave
 * calls, no god mode. It follows one fixed list of builds and upgrades (BUILD), buying
 * the next entry as soon as it can pay for it, and puts each tower on the free tile
 * whose range covers the most of the enemies' way (tiles that several portals' enemies
 * walk count more). With no free tile left it sells its cheapest small tower on a
 * useful spot and builds there.
 *
 * Columns: route = average tiles from portal to gate; lives left (of 40) per seed;
 * margin (--rate) = the largest extra enemy health (x1 to x3) the bot still wins
 * with on seed 1. Bigger margin = easier map; the CAMPAIGN order should follow it.
 */
import { readFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Same order as index.html (drawing, sound and page scripts left out)
const FILES = ['vendor/lz-string-1.5.0.min.js', 'scripts/utils.js', 'scripts/enemy.js', 'scripts/enemies.js',
    'scripts/effect.js', 'scripts/effects.js', 'scripts/tower.js', 'scripts/towers.js', 'scripts/missile.js',
    'scripts/maps.js', 'scripts/waves.js', 'scripts/sketch.js'];

// The bot's build list: the opening once, then the cycle over and over.
// 'up:gun' upgrades the most useful gun tower that can still be upgraded.
const OPENING = 'gun gun gun gun gun gun up:gun up:gun gun gun up:gun up:gun'.split(' ');
const CYCLE = 'bomb up:bomb gun up:gun sniper up:sniper laser up:laser'.split(' ');

// ---------- Browser and p5 stand-ins ----------

const PRELUDE = `
const PI = Math.PI, TWO_PI = Math.PI * 2;
class Vec {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    set(x, y) { if (typeof x === 'object') { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; } return this; }
    copy() { return new Vec(this.x, this.y); }
    add(v, y) { if (typeof v === 'object') { this.x += v.x; this.y += v.y; } else { this.x += v; this.y += y; } return this; }
    sub(v, y) { if (typeof v === 'object') { this.x -= v.x; this.y -= v.y; } else { this.x -= v; this.y -= y; } return this; }
    mult(k) { this.x *= k; this.y *= k; return this; }
    magSq() { return this.x * this.x + this.y * this.y; }
    mag() { return Math.sqrt(this.magSq()); }
    normalize() { const m = this.mag(); if (m > 0) { this.x /= m; this.y /= m; } return this; }
    limit(max) { if (this.magSq() > max * max) this.normalize().mult(max); return this; }
    dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
    equals(x, y) { if (typeof x === 'object') { y = x.y; x = x.x; } return this.x === x && this.y === y; }
    static sub(a, b) { return new Vec(a.x - b.x, a.y - b.y); }
}
const p5 = { Vector: Vec };
const createVector = (x, y) => new Vec(x, y);
function random(a, b) {
    const r = Math.random();
    if (Array.isArray(a)) return a[Math.floor(r * a.length)];
    if (a === undefined) return r;
    if (b === undefined) return r * a;
    return a + r * (b - a);
}
const round = Math.round, cos = Math.cos, sin = Math.sin, sq = (n) => n * n;
let frameCount = 0;
const noop = () => {};
const FX = new Proxy({}, { get: (t, k) => k === 'muzzle' ? () => ({ x: 0, y: 0 }) : noop });
const Terrain = { themeFor: () => 'meadow' };
const Renderer = { mapChanged: noop, resize: noop, hover: null };
const playSound = noop, sfx = noop, toast = noop, textDialog = noop;
const updateInfo = noop, updateControls = noop, updateStatus = noop, updateBest = noop, closeOverlay = noop,
    flashLives = noop, tipEvent = noop, announceWave = noop, waveCleared = noop, recordWave = noop,
    openOverlayId = () => null, syncSettings = noop;
let __won = null;
function endGame(won) { gameOver = true; paused = true; __won = won; }
const MAP_LIST = [];
`;

const EXPORTS = `
globalThis.__td = {
    maps, CAMPAIGN, tower, campaignWaves,
    tick, resetGame, createTower, buy, upgrade, sell, placeReason, applyPending,
    get state() {
        return { cash, health, maxHealth, wave, gameOver, won: __won, pathVersion, cols, rows, grid, paths,
            flowPaths, exit, spawnpoints, towers, enemies };
    },
    set mapId(v) { mapId = v; }, set diffId(v) { diffId = v; }, set modeId(v) { modeId = v; },
    set selected(v) { selected = v; },
    start() { paused = false; started = true; },
    // Extra enemy health on top of Normal and the map's tuning (for the margin)
    scaleHp(k) { difficulties.normal = Object.assign({}, difficulties.normal, { hp: k }); },
};`;

let script = null;
function createGame(seed) {
    if (!script) {
        const source = PRELUDE + FILES.map(f => `\n;// ${f}\n` + readFileSync(join(root, f), 'utf8')).join('\n') + EXPORTS;
        script = new vm.Script(source, { filename: 'tower-defense.js' });
    }
    const math = Object.create(Math);
    math.random = seeded(seed);
    const el = () => ({ clientWidth: 0, clientHeight: 0, classList: { toggle() {}, add() {}, remove() {} }, style: {} });
    const sandbox = {
        Math: math, console,
        document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: el() },
        matchMedia: () => ({ matches: false }),
        location: { search: '' }, URLSearchParams,
        performance: { now: () => 0 },
        navigator: {},
        GameKit: {
            createStore: () => ({ get: (k, d) => d, set() {} }),
            createStepper: () => ({ advance() { return 0; }, reset() {} }),
            initShell() {}, readBests: () => ({}), recordBest: () => ({ isNew: false }),
        },
    };
    vm.createContext(sandbox);
    script.runInContext(sandbox);
    return sandbox.__td;
}

function seeded(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---------- Routes ----------

const DX = [0, -1, 0, 1, 0];
const DY = [0, 0, -1, 0, 1];

// Walk from (x, y) the way an enemy would, starting in direction d (0: from rest);
// the tiles walked with the direction it entered each one, or why it fails
function follow(s, x, y, d = 0) {
    const out = [];
    const seen = new Set();
    for (;;) {
        if (x < 0 || y < 0 || x >= s.cols || y >= s.rows) return { fail: `leaves the map at ${x},${y}` };
        const g = s.grid[x][y];
        if (g === 1 || g === 3) return { fail: `runs into a wall or pad at ${x},${y}` };
        out.push([x, y, d]);
        if (x === s.exit.x && y === s.exit.y) return { tiles: out };
        const key = `${x},${y},${d}`;
        if (seen.has(key)) return { fail: `goes round in circles at ${x},${y}` };
        seen.add(key);
        // Same rule as Enemy.steer: the tile's direction, else keep going, else the shortest way
        d = s.paths[x][y] || d || s.flowPaths[x][y];
        if (!d) return { fail: `has no way on at ${x},${y}` };
        x += DX[d];
        y += DY[d];
    }
}

// Every portal reaches the gate; so do enemies from a Hive's portal, which may open
// on any tile of the way and set off in the direction the Hive was walking
function checkRoutes(s) {
    const problems = [];
    if (!s.exit) return { problems: ['no gate'], routes: [] };
    const routes = [];
    for (const p of s.spawnpoints) {
        const r = follow(s, p.x, p.y);
        if (r.fail) problems.push(`portal ${p.x},${p.y} ${r.fail}`);
        else routes.push(r.tiles);
    }
    const seen = new Set();
    for (const [x, y, d] of routes.flat()) {
        if (seen.has(`${x},${y},${d}`)) continue;
        seen.add(`${x},${y},${d}`);
        const r = follow(s, x, y, d);
        if (r.fail) problems.push(`a Hive portal at ${x},${y} ${r.fail}`);
    }
    return { problems, routes };
}

// ---------- Bot ----------

function baseOf(game, t) {
    for (const [name, tpl] of Object.entries(game.tower)) {
        if (name === t.name || tpl.upgrades.some(u => u.name === t.name)) return name;
    }
    return t.name;
}

function makeBot(game) {
    let step = 0;
    let version = -1;
    let weight = null;          // Map tile -> how many portal routes walk it
    let scores = {};            // range -> Float32Array of coverage per tile
    const plan = (i) => i < OPENING.length ? OPENING[i] : CYCLE[(i - OPENING.length) % CYCLE.length];

    // Enemy routes changed (a tower went on open ground): forget the cached scores
    function refresh() {
        const s = game.state;
        if (s.pathVersion === version) return;
        version = s.pathVersion;
        scores = {};
        weight = new Map();
        for (const p of s.spawnpoints) {
            const r = follow(s, p.x, p.y);
            if (r.fail) continue;
            for (const [x, y] of r.tiles) weight.set(x * 1000 + y, (weight.get(x * 1000 + y) || 0) + 1);
        }
    }

    // Route tiles (weighted) within reach of a tower with this range, for every tile
    function scoreMap(range) {
        refresh();
        if (scores[range]) return scores[range];
        const s = game.state;
        const out = new Float32Array(s.cols * s.rows);
        const r2 = (range + 1) ** 2;
        for (let x = 0; x < s.cols; x++) {
            for (let y = 0; y < s.rows; y++) {
                let sum = 0;
                for (const [k, n] of weight) {
                    const dx = Math.floor(k / 1000) - x;
                    const dy = (k % 1000) - y;
                    if (dx * dx + dy * dy < r2) sum += n;
                }
                out[x * s.rows + y] = sum;
            }
        }
        return (scores[range] = out);
    }

    const coverage = (t, range) => scoreMap(range)[t.gridPos.x * game.state.rows + t.gridPos.y];

    // Free tile covering the most of the way (pads first on a tie)
    function bestTile(name) {
        const s = game.state;
        const sc = scoreMap(game.tower[name].range);
        const cands = [];
        for (let x = 0; x < s.cols; x++) {
            for (let y = 0; y < s.rows; y++) {
                const g = s.grid[x][y];
                const v = sc[x * s.rows + y];
                if ((g === 0 || g === 3) && v > 0) cands.push([v + (g === 3 ? 0.5 : 0), x, y]);
            }
        }
        cands.sort((a, b) => b[0] - a[0]);
        for (const [, x, y] of cands) if (!game.placeReason(x, y)) return [x, y];
        return null;
    }

    // No free tile: sell the tower on the most useful spot among those worth at most
    // a third of the new one (never an upgraded one), and build there
    function makeRoom(name) {
        const s = game.state;
        const tpl = game.tower[name];
        let best = null;
        for (const t of s.towers) {
            if (!t.alive || t.totalCost * 3 > tpl.cost || !game.tower[t.name]) continue;
            const v = coverage(t, tpl.range);
            if (!best || v > best[0]) best = [v, t];
        }
        if (!best || best[0] <= 0) return null;
        const t = best[1];
        game.selected = t;
        game.sell(t);
        game.applyPending();
        return game.placeReason(t.gridPos.x, t.gridPos.y) ? null : [t.gridPos.x, t.gridPos.y];
    }

    // Buy the next entry if there is gold for it; false when it has to wait
    function act() {
        const s = game.state;
        for (let guard = 0; guard < CYCLE.length; guard++) {
            const item = plan(step);
            if (item.startsWith('up:')) {
                const base = item.slice(3);
                const t = s.towers.filter(t => t.alive && t.upgrades.length && baseOf(game, t) === base)
                    .sort((a, b) => coverage(b, b.upgrades[0].range || b.range) - coverage(a, a.upgrades[0].range || a.range))[0];
                if (!t) { step++; continue; }
                if (s.cash < t.upgrades[0].cost) return false;
                game.selected = t;
                game.upgrade(t.upgrades[0]);
                game.selected = null;
                step++;
                return true;
            }
            if (s.cash < game.tower[item].cost) return false;
            const tile = bestTile(item) || makeRoom(item);
            game.selected = null;
            if (!tile) { step++; continue; }
            game.buy(game.createTower(tile[0], tile[1], game.tower[item]));
            game.selected = null;
            step++;
            return true;
        }
        return false;
    }
    return { act };
}

// ---------- Play ----------

function play(id, seed, hp = 1, debug = false) {
    const game = createGame(seed);
    game.scaleHp(hp);
    game.mapId = id;
    game.modeId = 'campaign';
    game.diffId = 'normal';
    game.resetGame();
    const bot = makeBot(game);
    while (bot.act()) { /* spend the starting gold before the first wave */ }
    game.start();
    let ticks = 0;
    let shown = 0;
    const limit = 60 * 60 * 90;     // 90 minutes of game time
    while (!game.state.gameOver && ticks < limit) {
        game.tick();
        ticks++;
        if (ticks % 6 === 0) while (bot.act()) { /* buy whatever the gold allows */ }
        if (debug && game.state.wave !== shown) {
            shown = game.state.wave;
            const kinds = {};
            game.state.towers.forEach(t => { kinds[t.name] = (kinds[t.name] || 0) + 1; });
            console.log(`  ${id} seed ${seed} wave ${shown}: lives ${game.state.health}, gold ${game.state.cash}, ${JSON.stringify(kinds)}`);
        }
    }
    const s = game.state;
    return { won: s.won === true, lives: s.health, waves: s.won ? game.campaignWaves.length : s.wave - 1 };
}

// Route check and the facts for the table, without playing
function inspect(id) {
    const game = createGame(1);
    game.mapId = id;
    game.resetGame();
    const s = game.state;
    const { problems, routes } = checkRoutes(s);
    const route = routes.length ? Math.round(routes.reduce((a, r) => a + r.length, 0) / routes.length) : 0;
    return { problems, route, size: `${s.cols}x${s.rows}`, portals: s.spawnpoints.length };
}

if (!isMainThread) {
    const { job } = workerData;
    const out = job.kind === 'inspect' ? inspect(job.id) : play(job.id, job.seed, job.hp, job.debug);
    parentPort.postMessage(out);
} else {
    await main();
}

async function main() {
    const args = process.argv.slice(2);
    const flag = (name) => args.includes(name);
    const value = (name, def) => {
        const i = args.indexOf(name);
        return i >= 0 ? args[i + 1] : def;
    };
    const seeds = Number(value('--seeds', 3));
    const rate = flag('--rate');
    const debug = flag('--debug');
    const MARGINS = [1.1, 1.2, 1.3, 1.45, 1.6, 1.8, 2, 2.3, 2.6, 3];

    const probe = createGame(1);
    const order = probe.CAMPAIGN.map(m => m.id);
    const ids = value('--map') ? value('--map').split(',') : order;
    let failures = 0;
    const loose = Object.keys(probe.maps).filter(id => !order.includes(id));
    if (loose.length) {
        console.log(`maps missing from CAMPAIGN: ${loose.join(', ')}`);
        failures++;
    }
    const unknown = order.filter(id => !probe.maps[id]);
    if (unknown.length) {
        console.log(`CAMPAIGN lists maps that don't exist: ${unknown.join(', ')}`);
        failures++;
    }

    // Run jobs on worker threads, a few at a time
    // (--debug plays on this thread so the log lines come out in order)
    const local = (job) => job.kind === 'inspect' ? inspect(job.id) : play(job.id, job.seed, job.hp, job.debug);
    const run = (job) => debug ? Promise.resolve(local(job)) : new Promise((resolve, reject) => {
        const w = new Worker(new URL(import.meta.url), { workerData: { job } });
        w.once('message', resolve);
        w.once('error', reject);
    });
    const pool = async (jobs, n = Math.max(1, availableParallelism() - 1)) => {
        const out = new Array(jobs.length);
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(n, jobs.length) }, async () => {
            while (next < jobs.length) {
                const i = next++;
                out[i] = await run(jobs[i]);
            }
        }));
        return out;
    };

    const info = await pool(ids.map(id => ({ kind: 'inspect', id })));
    const playable = ids.filter((id, i) => !info[i].problems.length);
    const games = await pool(playable.flatMap(id => Array.from({ length: seeds }, (_, k) => ({ kind: 'play', id, seed: k + 1, hp: 1, debug }))));
    const results = {};
    playable.forEach((id, i) => { results[id] = games.slice(i * seeds, (i + 1) * seeds); });

    // Margin: the largest extra health the bot still wins with (all steps run at once)
    const margins = {};
    if (rate) {
        const jobs = playable.flatMap(id => MARGINS.map(hp => ({ kind: 'play', id, seed: 1, hp })));
        const out = await pool(jobs);
        playable.forEach((id, i) => {
            let best = results[id][0]?.won ? 1 : 0;
            MARGINS.forEach((hp, j) => { if (out[i * MARGINS.length + j].won && hp > best && (best >= MARGINS[j - 1] || j === 0)) best = hp; });
            margins[id] = best;
        });
    }

    console.log(`  # map            size    portals  route  lives left by seed  waves${rate ? '  margin' : ''}`);
    ids.forEach((id, i) => {
        const { problems, route, size, portals } = info[i];
        const res = results[id] || [];
        const lives = res.map(r => r.won ? String(r.lives).padStart(2) : ' -').join(' ');
        const waves = res.length ? Math.min(...res.map(r => r.waves)) : '-';
        const pos = String(order.indexOf(id) + 1).padStart(3);
        const margin = rate && id in margins ? `x${margins[id] || 0}`.padStart(8) : '';
        console.log(`${pos} ${id.padEnd(14)} ${size.padEnd(7)} ${String(portals).padStart(7)}  ${String(route).padStart(5)}  ${lives.padEnd(19)} ${String(waves).padStart(5)}${margin}`);
        for (const p of problems) {
            console.log(`      route problem: ${p}`);
            failures++;
        }
        const lost = res.filter(r => !r.won);
        if (lost.length) {
            console.log(`      the bot lost on ${lost.length} of ${res.length} seeds (best ${Math.max(...res.map(r => r.waves))} waves)`);
            failures++;
        }
    });

    if (failures) {
        console.log(`\n${failures} problem${failures === 1 ? '' : 's'}`);
        process.exit(1);
    }
    console.log(`\nAll ${ids.length} maps: every route reaches the gate, the bot won every game.`);
}
