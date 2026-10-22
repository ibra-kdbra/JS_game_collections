import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { LevelRenderer } from './level.js';
import { Player } from './player.js';
import { Wizard } from './wizard.js';
import { solve } from './solver.js';
import { DIRECTIONS, enemiesLeft, initialState, isWon, moveWizard, slide } from './rules.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { createTouchControls, onSwipe } from '../../assets/kit/input.js';
import { initShell } from '../../assets/kit/shell.js';

const SLUG = 'brainy-warrior';
const SOLUTION_STEP_MS = 420;

const store = createStore(SLUG);
const $ = (id) => document.getElementById(id);
const ui = {
    container: $('game-container'),
    levelName: $('level-name'),
    levelHint: $('level-hint'),
    moves: $('move-count'),
    par: $('par-count'),
    enemies: $('enemy-count'),
    swords: $('sword-count'),
    toast: $('toast'),
    won: $('won-overlay'),
    wonText: $('won-text'),
    wonBest: $('won-best'),
    levels: $('levels-overlay'),
    levelGrid: $('level-grid'),
    btnNext: $('btn-next'),
    btnWizard: $('btn-wizard'),
    btnSolve: $('btn-solve'),
};

// Progress: { unlocked: highest playable index, best: { [index]: fewest moves } }.
const progress = store.get('progress', { unlocked: 0, best: {} });
const saveProgress = () => store.set('progress', progress);

initShell({ slug: SLUG });
const touch = createTouchControls({
    dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    buttons: [
        { label: 'Wizard', key: ' ' },
        { label: 'Undo', key: 'z', small: true },
    ],
});
const touchWizardButton = [...touch.el.querySelectorAll('button')].find((b) => b.textContent === 'Wizard');
const hasTouch = !touch.el.hidden;

// The on-screen pad would sit on top of dialogs, so it hides while one is open.
function setDialog(el, open) {
    el.hidden = !open;
    if (!hasTouch) return;
    if (ui.won.hidden && ui.levels.hidden) touch.show();
    else touch.hide();
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);
scene.fog = new THREE.Fog(0x0f172a, 18, 40);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
ui.container.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.7));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun, sun.target);

const board = new LevelRenderer(scene);
const player = new Player(board.hero, onStepEvent);

let levelIdx = 0;
let level = null;
let state = null;
let history = [];
let moves = 0;
let wizard = null;
let solutionQueue = [];
let solutionTimer = 0;
let usedSolution = false;
let won = false;
let toastTimer = 0;

function fitCamera() {
    const width = ui.container.clientWidth;
    const height = ui.container.clientHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (!level) return;

    const cx = (board.width - 1) / 2;
    const cz = (board.depth - 1) / 2;
    const view = new THREE.Vector3(0, 1, 0.62).normalize();
    const corners = [];
    for (const x of [-0.6, board.width - 0.4]) {
        for (const z of [-0.6, board.depth - 0.4]) {
            for (const y of [-0.5, 1]) corners.push(new THREE.Vector3(x, y, z));
        }
    }
    // Binary search for the closest distance that keeps the whole board on screen.
    let near = 2;
    let far = 80;
    for (let i = 0; i < 24; i++) {
        const mid = (near + far) / 2;
        camera.position.set(cx, 0, cz).addScaledVector(view, mid);
        camera.lookAt(cx, 0, cz);
        camera.updateMatrixWorld();
        const fits = corners.every((c) => {
            const p = c.clone().project(camera);
            return Math.abs(p.x) < 0.94 && Math.abs(p.y) < 0.94;
        });
        if (fits) far = mid;
        else near = mid;
    }
    camera.position.set(cx, 0, cz).addScaledVector(view, far);
    camera.lookAt(cx, 0, cz);
    sun.position.set(cx + 6, 14, cz + 8);
    sun.target.position.set(cx, 0, cz);
    const span = Math.max(board.width, board.depth);
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span });
    sun.shadow.camera.updateProjectionMatrix();
}

function showToast(text, ms = 1600) {
    ui.toast.textContent = text;
    ui.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (ui.toast.hidden = true), ms);
}

function updateUI() {
    ui.moves.textContent = moves;
    ui.par.textContent = level.par;
    ui.enemies.textContent = enemiesLeft(level, state);
    ui.swords.textContent = state.swords;
    ui.swords.parentElement.hidden = !level.entities.some((e) => e.type === 'sword');
}

function loadLevel(idx) {
    levelIdx = Math.max(0, Math.min(idx, LEVELS.length - 1));
    level = LEVELS[levelIdx];
    board.build(level);
    wizard = level.wizard ? new Wizard(board.root, level.wizard.positions) : null;
    state = initialState(level);
    history = [];
    moves = 0;
    won = false;
    usedSolution = false;
    solutionQueue = [];
    player.place(state.x, state.z);
    ui.levelName.textContent = `${levelIdx + 1}. ${level.name}`;
    ui.levelHint.textContent = level.hint;
    setDialog(ui.won, false);
    ui.btnWizard.hidden = !wizard;
    if (touchWizardButton) touchWizardButton.hidden = !wizard;
    store.set('lastLevel', levelIdx);
    updateUI();
    fitCamera();
}

function applyState(next) {
    state = next;
    player.place(state.x, state.z);
    board.syncEntities(state.alive);
    wizard?.place(state.wizardIdx);
    updateUI();
}

function onStepEvent(step) {
    if (step.event === 'kill') board.defeat(step.id);
    if (step.event === 'pickup') board.defeat(step.id);
}

function act(action) {
    if (won || player.isMoving || wizard?.teleport > 0) return false;
    if (action === 'wizard') {
        const next = moveWizard(level, state);
        if (!next) {
            showToast(wizard ? 'The wizard can’t teleport onto someone.' : 'No wizard on this level.');
            return false;
        }
        history.push(state);
        state = next;
        moves++;
        wizard.moveTo(state.wizardIdx);
        updateUI();
        return true;
    }
    const { dx, dz } = DIRECTIONS[action];
    const result = slide(level, state, dx, dz);
    if (!result) {
        player.nudge(dx, dz);
        return false;
    }
    const before = state;
    history.push(before);
    moves++;
    updateUI();
    player.follow(result.steps, () => {
        if (result.died) {
            // A fall costs nothing but time: the hero climbs back to where the slide began.
            history.pop();
            moves--;
            solutionQueue = [];
            applyState(before);
            showToast('Splash! You slid into the water.');
            return;
        }
        state = result.state;
        updateUI();
        if (isWon(level, state)) finishLevel();
    });
    return true;
}

function undo() {
    if (won || player.isMoving || history.length === 0) return;
    solutionQueue = [];
    moves--;
    applyState(history.pop());
}

function finishLevel() {
    won = true;
    const best = progress.best[levelIdx];
    const isNewBest = !usedSolution && (best === undefined || moves < best);
    if (isNewBest) progress.best[levelIdx] = moves;
    progress.unlocked = Math.max(progress.unlocked, Math.min(levelIdx + 1, LEVELS.length - 1));
    saveProgress();
    const cleared = Object.keys(progress.best).length;
    recordBest(SLUG, cleared, { label: `${cleared}/${LEVELS.length} levels` });

    let text = `${moves} moves (par ${level.par}).`;
    if (usedSolution) text += ' Solved with help, so it doesn\u2019t count as a best.';
    else if (moves <= level.par) text += ' Perfect: you matched the solver!';
    else if (!isNewBest) text += ` Your best is ${best}.`;
    ui.wonText.textContent = text;
    ui.wonBest.hidden = !isNewBest || best === undefined;
    ui.btnNext.textContent = levelIdx === LEVELS.length - 1 ? 'Level select' : 'Next level';
    setDialog(ui.won, true);
    ui.btnNext.focus({ preventScroll: true });
}

function showSolution() {
    if (won || player.isMoving) return;
    const path = solve(level, state);
    if (!path) {
        showToast('No way to win from here. Undo or restart.', 2400);
        return;
    }
    usedSolution = true;
    solutionQueue = path;
    solutionTimer = SOLUTION_STEP_MS / 1000;
    showToast(`Solution: ${path.length} move${path.length === 1 ? '' : 's'} from here.`);
}

function renderLevelGrid() {
    ui.levelGrid.replaceChildren(
        ...LEVELS.map((lvl, i) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'level-btn';
            const locked = i > progress.unlocked;
            button.disabled = locked;
            const best = progress.best[i];
            button.innerHTML = `<span class="level-num">${i + 1}</span><span class="level-title"></span><span class="level-score"></span>`;
            button.querySelector('.level-title').textContent = locked ? 'Locked' : lvl.name;
            button.querySelector('.level-score').textContent =
                best === undefined ? `par ${lvl.par}` : `best ${best} / par ${lvl.par}`;
            if (best !== undefined && best <= lvl.par) button.classList.add('perfect');
            if (i === levelIdx) button.setAttribute('aria-current', 'true');
            button.addEventListener('click', () => {
                setDialog(ui.levels, false);
                loadLevel(i);
            });
            return button;
        }),
    );
}

function openLevels() {
    renderLevelGrid();
    setDialog(ui.won, false);
    setDialog(ui.levels, true);
    ui.levelGrid.querySelector('[aria-current]')?.focus({ preventScroll: true });
}

function nextLevel() {
    if (levelIdx === LEVELS.length - 1) openLevels();
    else loadLevel(levelIdx + 1);
}

const KEY_ACTIONS = {
    ArrowUp: 'up', w: 'up',
    ArrowDown: 'down', s: 'down',
    ArrowLeft: 'left', a: 'left',
    ArrowRight: 'right', d: 'right',
    ' ': 'wizard', e: 'wizard',
};

window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!ui.levels.hidden) {
        if (key === 'Escape' || key === 'l') setDialog(ui.levels, false);
        return;
    }
    if (!ui.won.hidden) {
        if (key === 'Enter' && document.activeElement !== ui.btnNext) nextLevel();
        return;
    }
    if (e.target.closest?.('button') && (key === ' ' || key === 'Enter')) return;
    if (KEY_ACTIONS[key]) {
        e.preventDefault();
        solutionQueue = [];
        act(KEY_ACTIONS[key]);
    } else if (key === 'z' || key === 'u' || key === 'Backspace') {
        undo();
    } else if (key === 'r') {
        loadLevel(levelIdx);
    } else if (key === 'l') {
        openLevels();
    } else if (key === 'h') {
        showSolution();
    }
});

onSwipe(renderer.domElement, (dir) => {
    if (!ui.levels.hidden || !ui.won.hidden) return;
    solutionQueue = [];
    act(dir);
});

$('btn-restart').addEventListener('click', () => loadLevel(levelIdx));
$('btn-undo').addEventListener('click', undo);
$('btn-levels').addEventListener('click', openLevels);
$('btn-close-levels').addEventListener('click', () => setDialog(ui.levels, false));
ui.btnSolve.addEventListener('click', showSolution);
ui.btnWizard.addEventListener('click', () => act('wizard'));
ui.btnNext.addEventListener('click', nextLevel);
$('btn-replay').addEventListener('click', () => loadLevel(levelIdx));

new ResizeObserver(fitCamera).observe(ui.container);

const loop = createLoop({
    update(dt) {
        player.update(dt);
        wizard?.update(dt);
        board.update(dt);
        if (solutionQueue.length && !player.isMoving && !(wizard?.teleport > 0) && !won) {
            solutionTimer -= dt;
            if (solutionTimer <= 0) {
                solutionTimer = SOLUTION_STEP_MS / 1000;
                act(solutionQueue.shift());
            }
        }
    },
    render() {
        renderer.render(scene, camera);
    },
});

loadLevel(Math.min(store.get('lastLevel', 0), progress.unlocked));
loop.start();
