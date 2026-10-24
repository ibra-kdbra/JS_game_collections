// Thin JavaScript binding for the C++ solver in wasm/solver.cpp.
// Works in the browser (inside solver-worker.js) and in Node (verify-levels).

export const ALGORITHMS = [
    { id: 'bfs', code: 0, name: 'BFS', long: 'Breadth-first search', optimal: true },
    { id: 'dfs', code: 1, name: 'DFS', long: 'Depth-first search', optimal: false },
    { id: 'ucs', code: 2, name: 'UCS', long: 'Uniform-cost search (shortest distance)', optimal: false },
    { id: 'greedy', code: 3, name: 'Greedy', long: 'Greedy best-first (hill climbing)', optimal: false },
    { id: 'astar', code: 4, name: 'A*', long: 'A* search', optimal: true },
];
const ACTION_NAMES = ['up', 'down', 'left', 'right', 'magic'];

/** Instantiate the solver from the .wasm bytes. */
export async function createWasmSolver(bytes) {
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const ex = instance.exports;
    let loadedLevel = null;

    const view = () => new Int32Array(ex.memory.buffer);

    function load(level) {
        if (loadedLevel === level) return;
        const io = view();
        let p = ex.bw_io() >> 2;
        io[p++] = level.width;
        io[p++] = level.height;
        for (let i = 0; i < level.width * level.height; i++) io[p++] = level.cells[i];
        io[p++] = level.enemies.length;
        for (const e of level.enemies) {
            io[p++] = e.x;
            io[p++] = e.z;
        }
        io[p++] = level.wizardSpots.length;
        for (const s of level.wizardSpots) {
            io[p++] = s.x;
            io[p++] = s.z;
        }
        const rc = ex.bw_load();
        if (rc !== 0) throw new Error(`solver could not load level (${rc})`);
        loadedLevel = level;
    }

    /**
     * Solve from `state` with an algorithm id ('bfs', 'astar', ...).
     * Returns { path: action[] | null, expanded, generated, cost, trace?: Uint16Array, ms }.
     * `path` is null when the position can't be won; `overflow` is set when
     * the search hit its memory limit.
     */
    function solve(level, state, alg = 'astar', { withTrace = false } = {}) {
        load(level);
        const code = ALGORITHMS.find((a) => a.id === alg)?.code ?? 4;
        const t0 = performance.now();
        const len = ex.bw_solve(code, state.x, state.z, state.alive >>> 0, state.wiz);
        const ms = performance.now() - t0;
        const io = view();
        const stats = io.subarray(ex.bw_stats() >> 2, (ex.bw_stats() >> 2) + 3);
        const out = { path: null, expanded: stats[0], generated: stats[1], cost: stats[2], ms, overflow: len === -2 };
        if (len >= 0) {
            const base = ex.bw_io() >> 2;
            out.path = Array.from(io.subarray(base, base + len), (a) => ACTION_NAMES[a]);
        }
        if (withTrace) {
            const n = ex.bw_trace_len();
            out.trace = new Uint16Array(ex.memory.buffer, ex.bw_trace(), n).slice();
        }
        return out;
    }

    return { solve };
}
