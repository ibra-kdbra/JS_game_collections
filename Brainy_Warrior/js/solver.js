import { TILE_TYPES, ENTITY_TYPES } from './levels.js';

export class Solver {
    constructor(levelData) {
        this.levelData = levelData;
    }

    solve(startX, startZ, enemies, wizardIdx = 0) {
        // Initial state
        const initialState = {
            x: startX,
            z: startZ,
            enemies: enemies.filter(e => e.type !== ENTITY_TYPES.SWORD).map(e => ({ x: e.x, z: e.z, type: e.type })),
            hasSword: false,
            wizardIdx: wizardIdx,
            path: []
        };

        const queue = [initialState];
        const visited = new Set();

        while (queue.length > 0) {
            const current = queue.shift();

            // Hash the state
            const enemyHash = current.enemies.map(e => `${e.x},${e.z},${e.type}`).sort().join('|');
            const stateHash = `${current.x},${current.z},${current.wizardIdx},${current.hasSword},${enemyHash}`;

            if (visited.has(stateHash)) continue;
            visited.add(stateHash);

            // Check Win Condition: All enemies (normal and strong) are gone
            if (current.enemies.length === 0) {
                return current.path;
            }

            // Options: Move (4 directions) or Toggle Wizard (only if wizard exists)
            const directions = [{ dx: 0, dz: -1, name: 'Up' }, { dx: 0, dz: 1, name: 'Down' }, { dx: -1, dz: 0, name: 'Left' }, { dx: 1, dz: 0, name: 'Right' }];
            
            for (let dir of directions) {
                const next = this.simulateSlide(current, dir.dx, dir.dz);
                if (next) {
                    queue.push({ ...next, path: [...current.path, { type: 'move', dx: dir.dx, dz: dir.dz }] });
                }
            }

            if (this.levelData.wizard && this.levelData.wizard.positions.length > 1) {
                const nextWizardIdx = (current.wizardIdx + 1) % this.levelData.wizard.positions.length;
                queue.push({
                    ...current,
                    wizardIdx: nextWizardIdx,
                    path: [...current.path, { type: 'wizard' }]
                });
            }
        }

        return null;
    }

    simulateSlide(state, dx, dz) {
        let tx = state.x;
        let tz = state.z;
        let hasSword = state.hasSword;
        let remainingEnemies = JSON.parse(JSON.stringify(state.enemies));
        
        // Find if sword is in the level but not yet picked up
        const sword = this.levelData.entities.find(e => e.type === ENTITY_TYPES.SWORD);
        let swordX = sword ? sword.x : -1;
        let swordZ = sword ? sword.z : -1;

        while (true) {
            let nx = tx + dx;
            let nz = tz + dz;

            // Water/OOB
            if (nz < 0 || nz >= this.levelData.grid.length || nx < 0 || nx >= this.levelData.grid[0].length || this.levelData.grid[nz][nx] === TILE_TYPES.WATER) {
                return null; // Death
            }

            // Wall/Fence
            if (this.levelData.grid[nz][nx] === TILE_TYPES.WALL || this.levelData.grid[nz][nx] === TILE_TYPES.FENCE) {
                break;
            }

            // Wizard
            if (this.levelData.wizard) {
                const wPos = this.levelData.wizard.positions[state.wizardIdx];
                if (nx === wPos.x && nz === wPos.z) {
                    break;
                }
            }

            // Sword pickup
            if (!hasSword && nx === swordX && nz === swordZ) {
                hasSword = true;
            }

            // Enemy collision
            const enemyIdx = remainingEnemies.findIndex(e => e.x === nx && e.z === nz);
            if (enemyIdx !== -1) {
                const ent = remainingEnemies[enemyIdx];
                if (ent.type === ENTITY_TYPES.ENEMY) {
                    tx = nx;
                    tz = nz;
                    remainingEnemies.splice(enemyIdx, 1);
                    break; // Stops
                } else if (ent.type === ENTITY_TYPES.STRONG_ENEMY) {
                    if (hasSword) {
                        tx = nx;
                        tz = nz;
                        remainingEnemies.splice(enemyIdx, 1);
                        break;
                    } else {
                        break; // Blocked
                    }
                }
            }

            tx = nx;
            tz = nz;
        }

        if (tx === state.x && tz === state.z && hasSword === state.hasSword) return null;

        return {
            x: tx,
            z: tz,
            enemies: remainingEnemies,
            hasSword: hasSword,
            wizardIdx: state.wizardIdx
        };
    }
}
