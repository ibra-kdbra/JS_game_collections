// Loads the C++/WebAssembly solver. Every search here takes milliseconds (the
// largest level has about 5,600 reachable states), so it runs on the main
// thread. If WebAssembly is unavailable the JavaScript BFS stands in, which
// covers hints, par and stuck detection; the algorithm comparison needs WASM.
import { createWasmSolver, ALGORITHMS } from './wasm-solver.js';
import { bfs } from './solver.js';

export { ALGORITHMS };

let impl = null;

export const solverReady = (async () => {
    try {
        const url = new URL('../wasm/solver.wasm', import.meta.url);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        impl = await createWasmSolver(await res.arrayBuffer());
        return 'wasm';
    } catch (err) {
        console.warn('Brainy Warrior: WebAssembly solver unavailable, using the JavaScript BFS.', err);
        impl = {
            solve(level, state) {
                const t0 = performance.now();
                const r = bfs(level, state);
                return { ...r, cost: r.path?.length ?? 0, ms: performance.now() - t0, fallback: true };
            },
        };
        return 'js';
    }
})();

/** Solve from `state`; see wasm-solver.js for the result shape. */
export function solve(level, state, alg = 'astar', opts) {
    if (!impl) return null;
    return impl.solve(level, state, alg, opts);
}
