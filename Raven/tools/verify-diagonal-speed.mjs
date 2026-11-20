/**
 * Proves moving diagonally is no faster than moving in a straight line.
 *
 *   node Raven/tools/verify-diagonal-speed.mjs   # exit 1 on a problem
 *
 * Holds two directions at once (the same game.input flags the touch
 * twin-stick sets) and compares the player's steady-state speed against the
 * per-second cap and against straight-line movement.
 */
import { createLevel } from "./sim.mjs";

const FRAMES = 45; // accel 400/s up to maxSpeed 110 needs ~0.3 s, so ~0.75 s is plenty

function terminalSpeed(keys) {
    const lv = createLevel(0);
    const game = lv.game;
    for (let i = 0; i < FRAMES; i++) {
        lv.step({ keys });
        if (lv.dead) { console.log("FAIL the player died during the test run"); process.exit(1); }
    }
    return Math.hypot(game.player.vx, game.player.vy);
}

const maxSpeed = createLevel(0).game.player._maxSpeed;
const straight = terminalSpeed({ right: true });
const diagonal = terminalSpeed({ up: true, right: true });

let failures = 0;
if (Math.abs(straight - maxSpeed) > 1e-6) {
    console.log(`FAIL straight-line speed ${straight.toFixed(2)} is not the cap (${maxSpeed})`);
    failures++;
}
if (diagonal > maxSpeed + 1e-6) {
    console.log(`FAIL diagonal speed ${diagonal.toFixed(2)} exceeds the cap (${maxSpeed}); a straight line runs ${straight.toFixed(2)}`);
    failures++;
}
console.log(failures
    ? `${failures} problem(s)`
    : `straight ${straight.toFixed(1)} px/s, diagonal ${diagonal.toFixed(1)} px/s, cap ${maxSpeed} px/s`);
process.exit(failures ? 1 : 0);
