// Reference solver in plain JavaScript: breadth-first search over the rules in
// rules.js. The game normally uses the faster C++/WebAssembly solver
// (wasm/solver.cpp); this one is the fallback when WebAssembly can't load and
// the independent cross-check used by tools/verify-levels.mjs.
import { initialState, isWon, stateKey, successors } from './rules.js';

/**
 * Fewest-moves solution from `start`.
 * Returns { path: action[] | null, expanded, generated }.
 * `path` is [] when already won and null when the position can't be won.
 */
export function bfs(level, start = initialState(level), maxStates = 400000) {
    if (isWon(start)) return { path: [], expanded: 0, generated: 1 };
    const parent = new Map([[stateKey(start), null]]);
    let frontier = [start];
    let expanded = 0;
    while (frontier.length && parent.size < maxStates) {
        const next = [];
        for (const state of frontier) {
            expanded++;
            const key = stateKey(state);
            for (const { action, state: after } of successors(level, state)) {
                const k = stateKey(after);
                if (parent.has(k)) continue;
                parent.set(k, { key, action });
                if (isWon(after)) {
                    const path = [];
                    for (let cur = parent.get(k); cur; cur = parent.get(cur.key)) path.unshift(cur.action);
                    return { path, expanded, generated: parent.size };
                }
                next.push(after);
            }
        }
        frontier = next;
    }
    return { path: null, expanded, generated: parent.size };
}

/** Average number of live moves per explored state (a difficulty signal). */
export function branching(level, start = initialState(level), limit = 200000) {
    const seen = new Set([stateKey(start)]);
    const queue = [start];
    let edges = 0;
    for (let i = 0; i < queue.length && seen.size < limit; i++) {
        const succ = successors(level, queue[i]);
        edges += succ.length;
        for (const { state } of succ) {
            const k = stateKey(state);
            if (!seen.has(k)) {
                seen.add(k);
                queue.push(state);
            }
        }
    }
    return { reachable: seen.size, branching: edges / queue.length };
}
