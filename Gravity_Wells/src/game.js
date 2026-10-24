import { createStepper } from '../../assets/kit/loop.js';
import updateSystem from './update.js';
import drawSystem from './draw.js';
import resizeSystem from './resize.js';
import pointerSystem from './pointer.js';

const STEPS_PER_SECOND = 60;
const STEP_MS = 1000 / STEPS_PER_SECOND;

let setup = (entities) => {
    let game = entities.game;
    let ctx;
    let canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    let parent = document.querySelector(
        game.canvas.parentSelector
    );
    resizeSystem.resize(game, canvas);
    parent.appendChild(canvas);
    pointerSystem.add(game, canvas);

    // Logic advances in constant steps; a hidden tab or a slow frame never
    // fast-forwards the puzzle animations.
    let stepper = createStepper(STEPS_PER_SECOND);
    let simTime = 0;
    document.addEventListener('visibilitychange', () => stepper.reset());

    let step = () => {
        simTime = simTime + STEP_MS;

        let wasPointing = game.pointer.pointing;
        game.pointer.pointing = false;

        let updates = [];

        game.statemachine.active.forEach(id => {
            let entity = entities[id];
            if (entity.state === undefined) {
                return;
            }
            updates = [...updates, ...entity.state.updates];
        });

        updateSystem.process(entities, updates, simTime, STEP_MS);

        game.pointer.justDown = false;
        game.pointer.justUp = false;

        if (wasPointing && !game.pointer.pointing) {
            canvas.style.cursor = 'default';
        } else if (!wasPointing && game.pointer.pointing) {
            canvas.style.cursor = 'pointer';
        }
    };

    let onF = time => {
        resizeSystem.resize(game, canvas);

        let steps = stepper.advance(time, step);

        let draws = [];
        game.statemachine.active.forEach(id => {
            let entity = entities[id];
            if (entity.state !== undefined) {
                draws = [...draws, ...entity.state.draws];
            }
        });

        ctx.clearRect(0, 0, game.canvas.w, game.canvas.h);
        drawSystem.process(entities, draws, ctx, simTime, steps * STEP_MS);

        requestAnimationFrame(onF);
    };
    requestAnimationFrame(onF);
};

export default Object.freeze({
    setup
});
