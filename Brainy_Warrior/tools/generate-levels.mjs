// Solver-driven level generator. Grows island-shaped layouts, then hill-climbs
// them (move a rock, an enemy, the warrior or a wizard circle; grow or erode
// the coast) towards a higher difficulty score from tools/difficulty.mjs, and
// prints the best distinct candidates as text maps for hand-picking.
//
//   node Brainy_Warrior/tools/generate-levels.mjs [options]
//     --seed N         random seed (default 1)
//     --w N --h N      map size including the sea border (default 9 x 9)
//     --enemies N      enemy count (default 5)
//     --spots N        wizard circles, 0 for none (default 3)
//     --restarts N     fresh islands to try (default 30)
//     --steps N        hill-climbing steps per island (default 400)
//     --min N --max N  keep candidates scoring in [min, max] (default 100, 999)
//     --maxsol N       at most this many optimal solutions (default 4)
//     --minmagic N     at least this many required magic moves (default 0)
//     --minpar N       at least this many optimal moves (default 0)
//     --target N       climb towards this score instead of upwards
//     --top N          how many to print (default 6)
import { parseLevel } from '../js/levels.js';
import { measure, rng } from './difficulty.mjs';

const args = Object.fromEntries(
    process.argv
        .slice(2)
        .join(' ')
        .split('--')
        .filter(Boolean)
        .map((s) => s.trim().split(/\s+/))
        .map(([k, v]) => [k, Number(v)]),
);
const opt = {
    seed: 1,
    w: 9,
    h: 9,
    enemies: 5,
    spots: 3,
    restarts: 30,
    steps: 400,
    min: 100,
    max: 999,
    maxsol: 4,
    minmagic: 0,
    minpar: 0,
    top: 6,
    ...args,
};
const rand = rng(opt.seed);
const ri = (n) => Math.floor(rand() * n);
const pick = (a) => a[ri(a.length)];

function island() {
    const { w, h } = opt;
    const g = Array.from({ length: h }, () => Array(w).fill('~'));
    const inside = (x, z) => x > 0 && z > 0 && x < w - 1 && z < h - 1;
    const target = Math.floor((w - 2) * (h - 2) * (0.55 + rand() * 0.2));
    const cells = [[w >> 1, h >> 1]];
    g[h >> 1][w >> 1] = '.';
    let n = 1;
    while (n < target) {
        const [x, z] = pick(cells);
        const [dx, dz] = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
        const nx = x + dx;
        const nz = z + dz;
        if (!inside(nx, nz) || g[nz][nx] !== '~') continue;
        g[nz][nx] = '.';
        cells.push([nx, nz]);
        n++;
    }
    // Rocks: mostly on the coast (cliffs), a few inland.
    for (const [x, z] of cells) {
        const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => g[z + dz][x + dx] === '~');
        if (rand() < (coast ? 0.28 : 0.08)) g[z][x] = '#';
    }
    const free = () => {
        for (;;) {
            const [x, z] = pick(cells);
            if (g[z][x] === '.') return [x, z];
        }
    };
    const [px, pz] = free();
    g[pz][px] = 'P';
    for (let i = 0; i < opt.enemies; i++) {
        const [x, z] = free();
        g[z][x] = 'E';
    }
    for (let i = 0; i < opt.spots; i++) {
        const [x, z] = free();
        g[z][x] = i === 0 ? 'W' : 'w';
    }
    return g;
}

function mutate(g0) {
    const g = g0.map((r) => [...r]);
    const { w, h } = opt;
    const all = [];
    for (let z = 1; z < h - 1; z++) for (let x = 1; x < w - 1; x++) all.push([x, z]);
    const of = (ch) => all.filter(([x, z]) => g[z][x] === ch);
    const kind = ri(6);
    if (kind <= 2) {
        // Move a piece (warrior, enemy, wizard circle or rock) to a grass tile.
        const pieces = all.filter(([x, z]) => 'PEWw#'.includes(g[z][x]));
        const grass = of('.');
        if (!pieces.length || !grass.length) return g;
        const [ax, az] = pick(pieces);
        const [bx, bz] = pick(grass);
        g[bz][bx] = g[az][ax];
        g[az][ax] = '.';
    } else if (kind === 3) {
        // Toggle grass and rock.
        const [x, z] = pick(all);
        if (g[z][x] === '.') g[z][x] = '#';
        else if (g[z][x] === '#') g[z][x] = '.';
    } else {
        // Coast: grow land next to the island, or erode an empty coastal tile.
        const [x, z] = pick(all);
        const nearLand = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => g[z + dz][x + dx] !== '~');
        if (g[z][x] === '~' && nearLand) g[z][x] = rand() < 0.75 ? '.' : '#';
        else if ((g[z][x] === '.' || g[z][x] === '#') && kind === 5) g[z][x] = '~';
    }
    return g;
}

/** Every land and rock tile must be one 4-connected island. */
function connected(g) {
    const land = [];
    g.forEach((row, z) => row.forEach((c, x) => c !== '~' && land.push([x, z])));
    if (!land.length) return false;
    const seen = new Set([land[0].join()]);
    const stack = [land[0]];
    while (stack.length) {
        const [x, z] = stack.pop();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const k = `${x + dx},${z + dz}`;
            if (seen.has(k) || (g[z + dz]?.[x + dx] ?? '~') === '~') continue;
            seen.add(k);
            stack.push([x + dx, z + dz]);
        }
    }
    return seen.size === land.length;
}

function evaluate(g, runs = 300) {
    if (!connected(g)) return null;
    let level;
    try {
        level = parseLevel({ id: 'gen', name: 'gen', par: 0, map: g.map((r) => r.join('')) });
    } catch {
        return null;
    }
    const m = measure(level, { runs });
    if (!m || !m.solvable || m.reach > 60000) return null;
    let fit = opt.target ? -Math.abs(m.score - opt.target) : m.score;
    if (m.solutions > opt.maxsol) fit -= 6 * Math.log2(m.solutions / opt.maxsol);
    if (m.magic < opt.minmagic) fit -= 15 * (opt.minmagic - m.magic);
    if (m.opt < opt.minpar) fit -= 8 * (opt.minpar - m.opt);
    return { m, fit };
}

const found = new Map();
for (let r = 0; r < opt.restarts; r++) {
    let g = island();
    let cur = evaluate(g);
    for (let tries = 0; !cur && tries < 50; tries++) {
        g = island();
        cur = evaluate(g);
    }
    if (!cur) continue;
    for (let s = 0; s < opt.steps; s++) {
        const g2 = mutate(g);
        const e = evaluate(g2);
        if (!e) continue;
        if (e.fit >= cur.fit || rand() < 0.02) {
            g = g2;
            cur = e;
        }
    }
    const full = evaluate(g, 3000);
    if (!full) continue;
    const { m } = full;
    const key = g.map((row) => row.join('')).join('/');
    const ok = m.score >= opt.min && m.score <= opt.max && m.solutions <= opt.maxsol && m.magic >= opt.minmagic && m.opt >= opt.minpar;
    process.stderr.write(`restart ${r}: score ${m.score} opt ${m.opt} sols ${m.solutions} magic ${m.magic} bot ${m.bot.toFixed(3)}${ok ? ' *' : ''}\n`);
    if (ok) found.set(key, { g, m });
}
const rank = (x) => (opt.target ? -Math.abs(x.m.score - opt.target) : x.m.score);
const best = [...found.values()].sort((a, b) => rank(b) - rank(a)).slice(0, opt.top);
for (const { g, m } of best) {
    console.log(`// score ${m.score}  par ${m.opt}  solutions ${m.solutions}  magic ${m.magic}  bot ${m.bot.toFixed(3)}  trap ${m.pathTrap.toFixed(2)}  reach ${m.reach}`);
    console.log(`map: [\n${g.map((row) => `    '${row.join('')}',`).join('\n')}\n],`);
}
