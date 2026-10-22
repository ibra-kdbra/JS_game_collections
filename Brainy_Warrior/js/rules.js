// The puzzle rules as pure functions, shared by the game and the solver so the
// "Show solution" button can never disagree with what the player experiences.
import { TILE_TYPES, ENTITY_TYPES } from './levels.js';

export const DIRECTIONS = {
    up: { dx: 0, dz: -1 },
    down: { dx: 0, dz: 1 },
    left: { dx: -1, dz: 0 },
    right: { dx: 1, dz: 0 },
};

/** The starting state of a level. Entities keep their level index as `id`. */
export function initialState(level) {
    return {
        x: level.spawn.x,
        z: level.spawn.z,
        swords: 0,
        wizardIdx: 0,
        alive: level.entities.map((_, id) => id),
    };
}

const isBlocking = (tile) => tile === TILE_TYPES.WALL || tile === TILE_TYPES.FENCE;

export function wizardPosition(level, state) {
    return level.wizard ? level.wizard.positions[state.wizardIdx] : null;
}

export function enemiesLeft(level, state) {
    return state.alive.filter((id) => level.entities[id].type !== ENTITY_TYPES.SWORD).length;
}

export const isWon = (level, state) => enemiesLeft(level, state) === 0;

/**
 * Slide until something stops the hero.
 * Returns `null` when the hero can't move at all, otherwise
 * `{ state, steps: [{ x, z, event, id? }], died }` where event is
 * 'move' | 'pickup' | 'kill' | 'fall'.
 */
export function slide(level, state, dx, dz) {
    const { grid } = level;
    const wizard = wizardPosition(level, state);
    const alive = new Set(state.alive);
    const steps = [];
    let { x, z, swords } = state;
    let died = false;

    for (;;) {
        const nx = x + dx;
        const nz = z + dz;
        const tile = grid[nz]?.[nx];
        if (tile === undefined || tile === TILE_TYPES.WATER) {
            steps.push({ x: nx, z: nz, event: 'fall' });
            died = true;
            break;
        }
        if (isBlocking(tile)) break;
        if (wizard && wizard.x === nx && wizard.z === nz) break;

        const id = [...alive].find((i) => level.entities[i].x === nx && level.entities[i].z === nz);
        const entity = id === undefined ? null : level.entities[id];
        if (entity?.type === ENTITY_TYPES.SWORD) {
            alive.delete(id);
            swords++;
            x = nx;
            z = nz;
            steps.push({ x, z, event: 'pickup', id });
            continue;
        }
        if (entity?.type === ENTITY_TYPES.STRONG_ENEMY && swords === 0) break;
        if (entity) {
            if (entity.type === ENTITY_TYPES.STRONG_ENEMY) swords--;
            alive.delete(id);
            x = nx;
            z = nz;
            steps.push({ x, z, event: 'kill', id });
            break;
        }
        x = nx;
        z = nz;
        steps.push({ x, z, event: 'move' });
    }

    if (steps.length === 0) return null;
    return {
        state: { ...state, x, z, swords, alive: state.alive.filter((id) => alive.has(id)) },
        steps,
        died,
    };
}

/** Teleport the wizard to its next spot. Null when there's no wizard or the spot is taken. */
export function moveWizard(level, state) {
    if (!level.wizard || level.wizard.positions.length < 2) return null;
    const wizardIdx = (state.wizardIdx + 1) % level.wizard.positions.length;
    const target = level.wizard.positions[wizardIdx];
    const occupied =
        (target.x === state.x && target.z === state.z) ||
        state.alive.some((id) => level.entities[id].x === target.x && level.entities[id].z === target.z);
    if (occupied) return null;
    return { ...state, wizardIdx };
}

export function stateKey(state) {
    return `${state.x},${state.z},${state.swords},${state.wizardIdx},${state.alive.join('.')}`;
}
