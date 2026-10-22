// Checks that every level is solvable with the game's own rules and that its
// `par` equals the optimal move count found by the solver.
// Run from the repo root: node Brainy_Warrior/tools/verify-levels.mjs
import { LEVELS } from '../js/levels.js';
import { solve } from '../js/solver.js';
import { initialState } from '../js/rules.js';

let failures = 0;
LEVELS.forEach((level, i) => {
    const path = solve(level, initialState(level));
    const ok = path !== null && path.length === level.par;
    if (!ok) failures++;
    const found = path ? `${path.length} moves: ${path.join(' ')}` : 'no solution';
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(i + 1).padStart(2)} ${level.name.padEnd(16)} par ${String(level.par).padStart(2)}  ${found}`);
});
console.log(failures ? `${failures} level(s) failed.` : `All ${LEVELS.length} levels are solvable at par.`);
process.exitCode = failures ? 1 : 0;
