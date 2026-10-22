import { DIRECTIONS, isWon, moveWizard, slide, stateKey } from './rules.js';

const MAX_STATES = 200000;

/**
 * Breadth-first search over puzzle states, so the first solution found uses the
 * fewest moves (slides and wizard teleports both count as one move).
 * Returns an array of actions ('up' | 'down' | 'left' | 'right' | 'wizard'),
 * `[]` when the state is already won, or `null` when no solution exists.
 */
export function solve(level, start) {
    if (isWon(level, start)) return [];
    const seen = new Set([stateKey(start)]);
    let frontier = [{ state: start, path: [] }];

    while (frontier.length > 0 && seen.size < MAX_STATES) {
        const next = [];
        for (const { state, path } of frontier) {
            const options = Object.entries(DIRECTIONS).map(([action, { dx, dz }]) => {
                const result = slide(level, state, dx, dz);
                return [action, result && !result.died ? result.state : null];
            });
            options.push(['wizard', moveWizard(level, state)]);

            for (const [action, after] of options) {
                if (!after) continue;
                const key = stateKey(after);
                if (seen.has(key)) continue;
                seen.add(key);
                const route = [...path, action];
                if (isWon(level, after)) return route;
                next.push({ state: after, path: route });
            }
        }
        frontier = next;
    }
    return null;
}
