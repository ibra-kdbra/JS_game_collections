// Brainy Warrior rules as pure functions: no DOM, no three.js.
// The game, the JS reference solver and tools/verify-levels.mjs all use this
// module, and the C++/WebAssembly solver (wasm/solver.cpp) mirrors it exactly;
// verify-levels replays every WASM solution through these functions.
//
// Rules (Coolmath Games' Brainy Warrior):
//  * Each move the warrior slides in a straight line until something stops it.
//  * A rock wall stops the warrior on the tile in front of it.
//  * Sliding into an enemy defeats it; the warrior stops on the enemy's tile.
//  * The wizard stands on one of a few marked spots and stops the warrior like
//    a wall. The magic button sends the wizard to its next free spot (one move).
//  * Sliding with nothing to stop you sends the warrior into the sea: the level
//    is lost (undo or restart). The island is surrounded by sea, so leaving the
//    map counts as the sea too.
//  * The level is won when every enemy is defeated.

export const SEA = 0;
export const LAND = 1;
export const WALL = 2;

export const DIRS = ['up', 'down', 'left', 'right'];
export const ACTIONS = [...DIRS, 'magic'];
export const DELTA = {
    up: { dx: 0, dz: -1 },
    down: { dx: 0, dz: 1 },
    left: { dx: -1, dz: 0 },
    right: { dx: 1, dz: 0 },
};

/** Tile type at (x, z); anything outside the map is sea. */
export function tileAt(level, x, z) {
    if (x < 0 || z < 0 || x >= level.width || z >= level.height) return SEA;
    return level.cells[z * level.width + x];
}

/** Index of the living enemy on (x, z), or -1. */
export function enemyAt(level, alive, x, z) {
    const idx = level.enemyIndex[z * level.width + x];
    if (idx === undefined || idx < 0) return -1;
    return alive & (1 << idx) ? idx : -1;
}

export function wizardAt(level, state) {
    return level.wizardSpots.length ? level.wizardSpots[state.wiz] : null;
}

/** Starting state. `alive` is a bitmask of enemies still standing. */
export function initialState(level) {
    return {
        x: level.start.x,
        z: level.start.z,
        alive: level.enemies.length >= 31 ? -1 : (1 << level.enemies.length) - 1,
        wiz: level.wizardStart,
        dead: false,
    };
}

export function enemiesLeft(state) {
    let n = 0;
    for (let m = state.alive >>> 0; m; m &= m - 1) n++;
    return n;
}

export const isWon = (state) => !state.dead && state.alive === 0;

/**
 * Slide one way. Returns `null` when the warrior can't move at all (a wall or
 * the wizard is right next to him), otherwise
 *   { state, path: [{x, z}], event: 'stop' | 'defeat' | 'fall', enemy }
 * where `path` lists every tile entered (the last one is where he ends up, or
 * the sea tile he falls into).
 */
export function slide(level, state, dir) {
    if (state.dead) return null;
    const { dx, dz } = DELTA[dir];
    const wiz = wizardAt(level, state);
    const path = [];
    let { x, z } = state;
    for (;;) {
        const nx = x + dx;
        const nz = z + dz;
        const tile = tileAt(level, nx, nz);
        if (tile === WALL || (wiz && wiz.x === nx && wiz.z === nz)) {
            if (!path.length) return null;
            return { state: { ...state, x, z }, path, event: 'stop', enemy: -1 };
        }
        path.push({ x: nx, z: nz });
        if (tile === SEA) {
            return { state: { ...state, x: nx, z: nz, dead: true }, path, event: 'fall', enemy: -1 };
        }
        const enemy = enemyAt(level, state.alive, nx, nz);
        if (enemy >= 0) {
            return {
                state: { ...state, x: nx, z: nz, alive: state.alive & ~(1 << enemy) },
                path,
                event: 'defeat',
                enemy,
            };
        }
        x = nx;
        z = nz;
    }
}

/**
 * The magic button: the wizard moves to the next spot in its cycle that isn't
 * occupied by the warrior or an enemy. Null when there is no wizard or nowhere
 * free to go.
 */
export function magic(level, state) {
    const spots = level.wizardSpots;
    if (state.dead || spots.length < 2) return null;
    for (let step = 1; step < spots.length; step++) {
        const wiz = (state.wiz + step) % spots.length;
        const s = spots[wiz];
        if (s.x === state.x && s.z === state.z) continue;
        if (enemyAt(level, state.alive, s.x, s.z) >= 0) continue;
        return { state: { ...state, wiz }, from: state.wiz, to: wiz };
    }
    return null;
}

/** Apply any action ('up' | 'down' | 'left' | 'right' | 'magic'). */
export function apply(level, state, action) {
    return action === 'magic' ? magic(level, state) : slide(level, state, action);
}

/** Successor states that keep the warrior alive, for search. */
export function successors(level, state) {
    const out = [];
    for (const action of ACTIONS) {
        const r = apply(level, state, action);
        if (r && !r.state.dead) out.push({ action, state: r.state });
    }
    return out;
}

export const stateKey = (s) => `${s.x},${s.z},${s.wiz},${s.alive >>> 0}`;
