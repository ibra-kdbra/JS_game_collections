// Proves every level can be won and that its `par` is the true optimum.
//
//  * Runs the C++/WebAssembly solver (wasm/solver.wasm) with BFS and A*, and the
//    independent JavaScript BFS (js/solver.js); all three must agree on the
//    optimal move count, and it must equal the level's `par`.
//  * Replays the WASM solutions move by move through the game's own rules
//    (js/rules.js) and checks they really win, so the C++ and JS rules can't drift.
//  * Reports the other algorithms (DFS, UCS, Greedy) for comparison, plus the
//    difficulty measures used to order the levels.
//
// Run from the repo root:  node Brainy_Warrior/tools/verify-levels.mjs
import { readFileSync } from 'node:fs';
import { LEVELS } from '../js/levels.js';
import { bfs, branching } from '../js/solver.js';
import { apply, initialState, isWon } from '../js/rules.js';
import { createWasmSolver } from '../js/wasm-solver.js';

const wasm = await createWasmSolver(readFileSync(new URL('../wasm/solver.wasm', import.meta.url)));

function replay(level, path) {
    let state = initialState(level);
    for (const action of path) {
        const r = apply(level, state, action);
        if (!r || r.state.dead) return false;
        state = r.state;
    }
    return isWon(state);
}

let failures = 0;
const ids = new Set();
const pad = (v, n) => String(v ?? '-').padStart(n);
console.log(' #  level               par  BFS A*  JS | expanded BFS  A*   | DFS UCS Greedy | branch reach');
LEVELS.forEach((level, i) => {
    const start = initialState(level);
    const js = bfs(level, start);
    const r = Object.fromEntries(['bfs', 'astar', 'dfs', 'ucs', 'greedy'].map((a) => [a, wasm.solve(level, start, a)]));
    const problems = [];
    if (ids.has(level.id)) problems.push('duplicate id');
    ids.add(level.id);
    if (!js.path) problems.push('unsolvable');
    if (r.bfs.path?.length !== js.path?.length) problems.push('WASM BFS disagrees with JS BFS');
    if (r.astar.path?.length !== js.path?.length) problems.push('A* not optimal');
    if (js.path && js.path.length !== level.par) problems.push(`par should be ${js.path.length}`);
    for (const a of Object.keys(r)) {
        if (r[a].path && !replay(level, r[a].path)) problems.push(`${a} solution fails in rules.js`);
        if (!r[a].path) problems.push(`${a} found nothing`);
    }
    const b = branching(level, start);
    if (problems.length) failures++;
    console.log(
        `${pad(i + 1, 2)}  ${level.name.padEnd(19)} ${pad(level.par, 3)} ${pad(r.bfs.path?.length, 4)} ${pad(r.astar.path?.length, 2)} ${pad(js.path?.length, 3)} |` +
            ` ${pad(r.bfs.expanded, 12)} ${pad(r.astar.expanded, 4)} |` +
            ` ${pad(r.dfs.path?.length, 3)} ${pad(r.ucs.path?.length, 3)} ${pad(r.greedy.path?.length, 6)} | ${b.branching.toFixed(2).padStart(6)} ${pad(b.reachable, 5)}` +
            (problems.length ? `  FAIL: ${problems.join('; ')}` : ''),
    );
});
// Hints come from A* on whatever position the player is in, so check it from
// mid-game positions too: every 7th reachable state of every level.
let checked = 0;
for (const level of LEVELS) {
    const seen = new Set();
    const queue = [initialState(level)];
    for (let i = 0; i < queue.length && i < 3000; i++) {
        const s = queue[i];
        for (const action of ['up', 'down', 'left', 'right', 'magic']) {
            const r = apply(level, s, action);
            if (!r || r.state.dead) continue;
            const k = `${r.state.x},${r.state.z},${r.state.wiz},${r.state.alive}`;
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push(r.state);
        }
        if (i % 7) continue;
        checked++;
        const a = wasm.solve(level, s, 'astar').path;
        const j = bfs(level, s).path;
        if ((a === null) !== (j === null) || (a && a.length !== j.length)) {
            failures++;
            console.log(`FAIL hint from mid-game state in ${level.name}: A* ${a?.length} vs BFS ${j?.length}`);
        }
    }
}
console.log(`\nA* hints match BFS from ${checked} mid-game positions, winnable or not.`);

// Rule spot checks on a tiny hand-made board.
{
    const { parseLevel } = await import('../js/levels.js');
    const t = parseLevel({ name: 'test', map: ['~~~~~~', '~P.E#~', '~..W.~', '~#.w.~', '~~~~~~'] });
    const s = initialState(t);
    const expect = (cond, what) => {
        if (!cond) {
            failures++;
            console.log(`FAIL rule: ${what}`);
        }
    };
    const right = apply(t, s, 'right');
    expect(right.event === 'defeat' && right.state.x === 3 && right.state.alive === 0, 'sliding into an enemy defeats it and stops there');
    expect(apply(t, s, 'up').event === 'fall' && apply(t, s, 'up').state.dead, 'sliding off with nothing in the way is a fall');
    const down = apply(t, { ...s, alive: 1 }, 'down');
    expect(down.event === 'stop' && down.state.z === 2, 'a rock stops you on the tile before it');
    const fromBelow = apply(t, { ...s, x: 3, z: 3, alive: 1 }, 'up');
    expect(fromBelow === null, 'the wizard right next to you blocks the move');
    const m = apply(t, s, 'magic');
    expect(m && m.state.wiz === 1, 'magic sends the wizard to the next spot');
    expect(apply(t, { ...s, x: 3, z: 3 }, 'magic') === null, 'magic skips a spot the warrior is standing on');
    console.log('Rule spot checks done.');
}

console.log(failures ? `\n${failures} check(s) failed.` : `\nAll ${LEVELS.length} levels are winnable, par is optimal, and the C++ and JS rules agree.`);
process.exitCode = failures ? 1 : 0;
