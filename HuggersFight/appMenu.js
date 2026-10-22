// Title screen, pause menu, touch controls and saved best level.
// Loaded as a module after the engine's classic scripts, so it can read and set the
// engine's globals (`paused`, `level`, `clearInput`).
import { initShell } from '../assets/kit/shell.js';
import { createTouchControls } from '../assets/kit/input.js';
import { readBests, recordBest } from '../assets/kit/storage.js';

const SLUG = 'huggers-fight';
const titleScreen = document.getElementById('title');
const pauseScreen = document.getElementById('pause');
const bestText = document.getElementById('best');

initShell({ slug: SLUG });
const touch = createTouchControls({
    dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    buttons: [
        { label: 'Jump', key: 'ArrowUp' },
        { label: 'Shoot', key: 'z' },
        { label: 'Grenade', key: 'c' },
        { label: 'Roll', key: 'x' },
        { label: 'Pause', key: 'p', small: true },
    ],
});
const hasTouch = !touch.el.hidden;

let state = 'title'; // title | playing | paused

function show(screen) {
    titleScreen.hidden = screen !== titleScreen;
    pauseScreen.hidden = screen !== pauseScreen;
    if (hasTouch) screen ? touch.hide() : touch.show();
    screen?.querySelector('button')?.focus({ preventScroll: true });
}

function renderBest() {
    const best = readBests(SLUG).default;
    bestText.textContent = best ? `Best: ${best.label}` : '';
}

function play() {
    state = 'playing';
    clearInput(); // drop keys pressed while the menu was up
    paused = 0;
    show(null);
    document.activeElement?.blur();
}

function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    paused = 1;
    show(pauseScreen);
}

document.getElementById('start').addEventListener('click', play);
document.getElementById('resume').addEventListener('click', play);
document.getElementById('restart').addEventListener('click', () => {
    resetGame();
    play();
});

addEventListener('keydown', (e) => {
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (state === 'playing') pause();
        else if (state === 'paused') play();
    }
});
document.addEventListener('visibilitychange', () => document.hidden && pause());
addEventListener('blur', pause);

addEventListener('huggers:level', (e) => {
    // Reaching level N means levels 1..N-1 were cleared.
    recordBest(SLUG, e.detail, { label: `Level ${e.detail}` });
});

// Freeze the level behind the title screen once its fade-in from black has finished.
function holdOnTitle() {
    if (state !== 'title') return;
    if (renderWindowSize && levelTimer.get() > 2) paused = 1;
    else requestAnimationFrame(holdOnTitle);
}

holdOnTitle();
renderBest();
show(titleScreen);
