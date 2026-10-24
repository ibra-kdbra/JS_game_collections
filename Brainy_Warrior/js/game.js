// Brainy Warrior 3D: game flow, input, UI and progress.
// Rules live in rules.js, the solver in wasm/solver.cpp, drawing in scene.js.
import { LEVELS, bandOf } from './levels.js';
import { apply, enemiesLeft, initialState, isWon, magic, slide } from './rules.js';
import { World } from './scene.js';
import { ALGORITHMS, solve, solverReady } from './solver-client.js';
import { audioInfo, configure as configureAudio, getSettings as audioSettings, jingle, musicCue, sfx, unlock as unlockAudio } from './audio.js';
import { DEFAULT_VOLUME } from './music-score.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { createTouchControls, onSwipe } from '../../assets/kit/input.js';
import { initShell } from '../../assets/kit/shell.js';

const SLUG = 'brainy-warrior';
const store = createStore(SLUG);
const $ = (id) => document.getElementById(id);

initShell({ slug: SLUG });

// ------------------------------------------------------------ progress --
// { [levelId]: { best: moves, stars: 0-3, ai?: true } }
const progress = store.get('progress-v2', {});
const saveProgress = () => store.set('progress-v2', progress);
const isCleared = (i) => !!progress[LEVELS[i].id];
const isUnlocked = (i) => i === 0 || isCleared(i - 1) || isCleared(i);
const totalStars = () => LEVELS.reduce((n, l) => n + (progress[l.id]?.stars || 0), 0);

// Sound settings: the toolbar speaker mutes everything; music and sound
// effects can also be switched separately (in the help dialog).
configureAudio({
    muted: store.get('muted', false),
    sfx: store.get('sfx', true),
    music: store.get('music', true),
    volume: store.get('music-volume', DEFAULT_VOLUME),
});

// --------------------------------------------------------------- state --
let levelIdx = 0;
let level = null;
let state = null;
let history = [];
let mode = 'play'; // play | busy | won | lost | ai
let queued = null;
let hintsUsed = 0;
let stuck = false;
let aiAlg = store.get('ai-alg', 'astar');
let aiRun = 0; // bumps to cancel a running AI playback
let enemyCount = 0;

const world = new World($('stage'));

// --------------------------------------------------------------- touch --
const touch = createTouchControls({
    dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
    buttons: [
        { label: 'Magic', key: ' ' },
        { label: 'Undo', key: 'z', small: true },
    ],
});
const hasTouch = !touch.el.hidden;
const touchMagic = [...touch.el.querySelectorAll('button')].find((b) => b.textContent === 'Magic');

// Phones held sideways: the touch pad and the AI panel sit beside the board, not under it.
const sideways = matchMedia('(orientation: landscape) and (max-height: 500px)');

function layout() {
    // Tell the camera how much of the screen the HUD and touch pad cover.
    const hud = $('hud').getBoundingClientRect();
    const W = window.innerWidth;
    let bottom = 16;
    let left = 0;
    let right = 0;
    const aiOpen = !$('ai-panel').hidden;
    if (sideways.matches) {
        if (hasTouch && !touch.el.hidden) {
            const pad = touch.el.querySelector('.gk-dpad')?.getBoundingClientRect();
            const btns = touch.el.querySelector('.gk-buttons')?.getBoundingClientRect();
            if (pad?.width) left = pad.right + 6;
            if (btns?.width) right = W - btns.left + 6;
        }
        if (aiOpen) right = Math.max(right, W - $('ai-panel').getBoundingClientRect().left + 6);
    } else {
        if (hasTouch && !touch.el.hidden) bottom = Math.max(bottom, window.innerHeight - touch.el.getBoundingClientRect().top + 4);
        if (aiOpen && W <= 720) {
            bottom = Math.max(bottom, window.innerHeight - $('ai-panel').getBoundingClientRect().top + 6);
        }
    }
    world.setInsets({ top: hud.bottom + 6, bottom, left, right });
}
let layoutFrame = 0;
addEventListener('resize', () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(layout);
});

// ---------------------------------------------------------------- HUD --
function updateHud() {
    const moves = history.length;
    $('lvl-num').textContent = levelIdx + 1;
    $('level-name').textContent = level.name;
    $('moves').textContent = moves;
    $('moves').className = moves > level.par ? 'over' : moves === level.par && isWon(state) ? 'on-par' : '';
    $('optimal').textContent = level.par;
    $('enemies').textContent = enemiesLeft(state);
    $('btn-undo').disabled = history.length === 0;
    // The music adds a sparkle while the last enemy stands.
    musicCue.nearEnd(enemyCount > 1 && enemiesLeft(state) === 1 && !state.dead && !isWon(state));
}

let toastTimer = 0;
function toast(text, ms = 1500) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), ms);
}

function banner(text, { action = null, good = false } = {}) {
    const el = $('banner');
    if (!text) {
        el.hidden = true;
        return;
    }
    $('banner-text').textContent = text;
    el.classList.toggle('good', good);
    const btn = $('banner-btn');
    btn.hidden = !action;
    if (action) {
        btn.textContent = action.label;
        btn.onclick = action.run;
    }
    el.hidden = false;
}

function anyDialogOpen() {
    return ['won', 'lost', 'levels', 'help'].some((id) => !$(id).hidden);
}

function showDialog(id, open) {
    $(id).hidden = !open;
    if (hasTouch) {
        if (anyDialogOpen() || !$('ai-panel').hidden) touch.hide();
        else touch.show();
    }
    if (open) ($(id).querySelector('.btn-primary:not([hidden])') || $(id).querySelector('button'))?.focus({ preventScroll: true });
    layout();
}

// -------------------------------------------------------------- levels --
function loadLevel(idx, { keepAi = false } = {}) {
    aiRun++;
    levelIdx = Math.max(0, Math.min(idx, LEVELS.length - 1));
    level = LEVELS[levelIdx];
    state = initialState(level);
    enemyCount = enemiesLeft(state);
    history = [];
    hintsUsed = 0;
    stuck = false;
    queued = null;
    mode = 'play';
    musicCue.band(bandOf(levelIdx));
    musicCue.ai(false);
    $('level-tip').textContent = level.tip;
    const hasWizard = level.wizardSpots.length > 1;
    $('btn-magic').hidden = !hasWizard;
    if (touchMagic) touchMagic.hidden = !hasWizard;
    ['won', 'lost', 'levels'].forEach((id) => ($(id).hidden = true));
    if (!keepAi) closeAi();
    showDialog('won', false);
    banner(null);
    world.build(level, state);
    store.set('last-level', level.id);
    updateHud();
    layout();
}

function restart() {
    if (mode === 'busy') return;
    aiRun++;
    musicCue.ai(false);
    state = initialState(level);
    history = [];
    stuck = false;
    queued = null;
    mode = 'play';
    showDialog('won', false);
    showDialog('lost', false);
    banner(null);
    world.clearHighlights();
    world.clearHeat();
    world.sync(state, { facing: 'down' });
    updateHud();
}

function undo() {
    if (mode === 'busy' || mode === 'ai' || !history.length) return;
    state = history.pop();
    mode = 'play';
    stuck = false;
    showDialog('lost', false);
    showDialog('won', false);
    banner(null);
    world.clearHighlights();
    world.sync(state);
    sfx.undo();
    updateHud();
    checkStuck();
}

// ---------------------------------------------------------------- moves --
async function act(action, { fromAi = false, speed = 1 } = {}) {
    if (mode === 'busy' && !fromAi) {
        queued = action;
        return;
    }
    if (mode !== 'play' && !(fromAi && mode === 'ai')) return;
    const result = apply(level, state, action);
    if (!result) {
        sfx.blocked();
        if (action === 'magic' && level.wizardSpots.length > 1) toast('The wizard has nowhere free to go');
        return;
    }
    world.clearHighlights();
    banner(null);
    const prev = state;
    history.push(prev);
    state = result.state;
    mode = fromAi ? 'ai' : 'busy';
    updateHud();

    if (action === 'magic') {
        sfx.magic();
        musicCue.magic();
        await world.magic(level, result.from, result.to, speed);
    } else {
        sfx.slide(result.path.length);
        await world.slide(prev, action, result, { onDefeat: () => sfx.defeat(), onStop: () => sfx.stop(), onFall: () => sfx.splash() }, speed);
    }
    if (fromAi) return;
    mode = 'play';
    afterMove();
    if (queued && mode === 'play') {
        const next = queued;
        queued = null;
        act(next);
    }
    queued = null;
}

function afterMove({ ai = false } = {}) {
    updateHud();
    if (isWon(state)) return win({ ai });
    if (state.dead) return lose();
    checkStuck({ cue: true });
}

/** After every move, ask the solver whether the level can still be won. */
function checkStuck({ cue = false } = {}) {
    if (state.dead || isWon(state)) return;
    const r = solve(level, state, 'astar');
    stuck = !!r && !r.path && !r.overflow;
    if (stuck) {
        if (cue) jingle('stuck');
        banner('No way to win from here.', { action: { label: 'Undo', run: undo } });
    }
}

function win({ ai = false } = {}) {
    mode = 'won';
    queued = null;
    world.celebrate();
    musicCue.ai(false);
    jingle('win');
    const moves = history.length;
    const stars = ai ? 0 : starsFor(moves, level.par, hintsUsed);
    const prev = progress[level.id];
    let isNew = false;
    if (!ai) {
        isNew = !prev || prev.ai || moves < prev.best;
        progress[level.id] = {
            best: prev && !prev.ai ? Math.min(prev.best, moves) : moves,
            stars: Math.max(prev?.stars || 0, stars),
        };
    } else if (!prev) {
        progress[level.id] = { best: moves, stars: 0, ai: true };
    }
    saveProgress();
    const total = totalStars();
    recordBest(SLUG, total, { label: `${total}/${LEVELS.length * 3} stars` });

    const starsEl = $('won-stars');
    starsEl.innerHTML = [0, 1, 2].map((i) => starSvg(i < stars)).join('');
    $('won-title').textContent = ai ? 'Solved by the AI' : stars === 3 ? 'Perfect!' : 'Victory!';
    $('won-text').textContent = ai
        ? `${ALGORITHMS.find((a) => a.id === aiAlg).name} cleared it in ${moves} moves (optimal is ${level.par}). Now try it yourself!`
        : moves === level.par
          ? `${plural(moves, 'move')}: you matched the optimal solution.${hintsUsed ? ` You used ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}.` : ''}`
          : `${plural(moves, 'move')}. The optimal solution takes ${level.par}.${hintsUsed ? ` You used ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}.` : ''}`;
    $('won-best').hidden = !(isNew && !ai && prev);
    $('won-next').hidden = levelIdx >= LEVELS.length - 1;
    setTimeout(() => {
        if (mode === 'won') showDialog('won', true);
    }, 900);
}

function lose() {
    mode = 'lost';
    queued = null;
    setTimeout(() => {
        if (mode !== 'lost') return;
        jingle('fall');
        showDialog('lost', true);
    }, 250);
}

export function starsFor(moves, par, hints) {
    let s = moves <= par ? 3 : moves <= par + Math.max(2, Math.ceil(par / 4)) ? 2 : 1;
    if (hints) s = Math.min(s, 2);
    return s;
}

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const STAR_PATH = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z';
const starSvg = (lit) => `<svg viewBox="0 0 24 24" class="${lit ? 'lit' : ''}"><path d="${STAR_PATH}"/></svg>`;

// ---------------------------------------------------------------- hint --
function hint() {
    if (mode !== 'play') return;
    const r = solve(level, state, 'astar');
    if (!r) return toast('The solver is still loading');
    if (!r.path) {
        banner('No way to win from here.', { action: { label: 'Undo', run: undo } });
        return;
    }
    hintsUsed++;
    sfx.hint();
    const action = r.path[0];
    const left = r.path.length;
    if (action === 'magic') {
        const m = magic(level, state);
        world.showHint([level.wizardSpots[m.to]], { color: 0xa78bfa });
        toast(`Use magic. ${left} move${left > 1 ? 's' : ''} to go.`, 2200);
    } else {
        const s = slide(level, state, action);
        world.showHint(s.path, { arrowDir: action });
        toast(`Slide ${action}. ${left} move${left > 1 ? 's' : ''} to go.`, 2200);
    }
}

// ----------------------------------------------------------- AI watch --
function buildAlgoButtons() {
    const box = $('algos');
    box.innerHTML = '';
    for (const a of ALGORITHMS) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'algo';
        b.textContent = a.name;
        b.title = a.long;
        b.setAttribute('role', 'radio');
        b.dataset.id = a.id;
        b.addEventListener('click', () => {
            aiAlg = a.id;
            store.set('ai-alg', aiAlg);
            sfx.click();
            setAiStats(null);
            renderAlgo();
        });
        box.append(b);
    }
    renderAlgo();
}

const ALGO_NOTES = {
    bfs: 'Explores every position one move deeper at a time. Always finds the fewest moves.',
    dfs: 'Dives down one line of moves until it wins or runs dry. Fast to code, rarely the shortest.',
    ucs: 'Expands the cheapest path first, where cost is tiles travelled: the shortest run, not the fewest moves.',
    greedy: 'Hill climbing: always tries the position that looks closest to the goal. Quick, but can wander.',
    astar: 'Moves so far + a lower bound on moves left (enemies left, +1 if none is in line). Optimal and focused.',
};

function renderAlgo() {
    for (const b of $('algos').children) b.setAttribute('aria-checked', String(b.dataset.id === aiAlg));
    $('algo-note').textContent = ALGO_NOTES[aiAlg];
}

function openAi() {
    if (mode === 'busy') return;
    $('ai-panel').hidden = false;
    document.body.classList.add('ai-open');
    if (hasTouch) touch.hide();
    $('compare').hidden = true;
    layout();
}

function closeAi() {
    aiRun++;
    musicCue.ai(false);
    $('ai-panel').hidden = true;
    document.body.classList.remove('ai-open');
    world.clearHeat();
    if (mode === 'ai') {
        mode = 'play';
        updateHud();
        checkStuck();
    }
    if (hasTouch && !anyDialogOpen()) touch.show();
    layout();
}

function setAiStats(r) {
    $('ai-expanded').textContent = r ? r.expanded.toLocaleString() : '-';
    $('ai-generated').textContent = r ? r.generated.toLocaleString() : '-';
    $('ai-moves').textContent = r ? (r.path ? r.path.length : 'none') : '-';
    $('ai-time').textContent = r ? `${r.ms < 1 ? r.ms.toFixed(2) : r.ms.toFixed(1)}ms` : '-';
}

async function runAi() {
    if (mode === 'busy') return;
    const run = ++aiRun;
    restart();
    aiRun = run;
    mode = 'ai';
    musicCue.ai(true);
    setAiStats(null);
    $('ai-run').textContent = 'Stop';
    const r = solve(level, state, aiAlg, { withTrace: true });
    if (!r) {
        toast('The solver is still loading');
        mode = 'play';
        musicCue.ai(false);
        return;
    }
    const thinking = setInterval(() => sfx.think(), 90);
    await world.showSearch(r.trace || [], Math.min(2.4, 0.6 + (r.trace?.length || 0) / 600));
    clearInterval(thinking);
    if (run !== aiRun) return;
    setAiStats(r);
    world.fadeHeat();
    if (!r.path) {
        toast('No solution found');
        mode = 'play';
        musicCue.ai(false);
        $('ai-run').textContent = 'Solve from start';
        return;
    }
    const speed = r.path.length > 16 ? 1.6 : 1.25;
    for (const action of r.path) {
        if (run !== aiRun) return;
        await act(action, { fromAi: true, speed });
        await world.wait(0.12);
    }
    if (run !== aiRun) return;
    $('ai-run').textContent = 'Solve from start';
    world.clearHeat();
    afterMove({ ai: true });
}

function compareAll() {
    const start = initialState(level);
    const rows = ALGORITHMS.map((a) => ({ a, r: solve(level, start, a.id) }));
    const tbody = $('compare').querySelector('tbody');
    tbody.innerHTML = rows
        .map(({ a, r }) => {
            const len = r?.path?.length;
            const opt = len === level.par;
            return `<tr><td>${a.name}</td><td>${r ? r.expanded.toLocaleString() : '-'}</td><td class="${opt ? 'opt' : ''}">${len ?? '-'}</td><td>${opt ? 'optimal' : ''}</td></tr>`;
        })
        .join('');
    $('compare').hidden = false;
    sfx.click();
}

$('ai-run').addEventListener('click', () => {
    if (mode === 'ai') {
        aiRun++;
        mode = 'play';
        musicCue.ai(false);
        $('ai-run').textContent = 'Solve from start';
        world.clearHeat();
        updateHud();
        checkStuck();
    } else runAi();
});
$('ai-compare').addEventListener('click', compareAll);
$('ai-close').addEventListener('click', closeAi);

// --------------------------------------------------------- level select --
function openLevels() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((l, i) => {
        const p = progress[l.id];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `level-card${i === levelIdx ? ' current' : ''}`;
        b.disabled = !isUnlocked(i);
        const wiz = l.wizardSpots.length > 1;
        b.innerHTML = `<span class="num">${i + 1}</span><span class="name">${l.name}</span>
            <span class="meta"><span class="mini-stars">${[0, 1, 2].map((k) => starSvg(k < (p?.stars || 0))).join('')}</span><span>${p && !p.ai ? `${p.best}/${l.par}` : `par ${l.par}`}</span></span>
            ${b.disabled ? '<svg class="lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' : wiz ? '<svg class="wiz" viewBox="0 0 24 24"><path d="m15 4-1.5 3L10 8.5l3.5 1.5L15 13l1.5-3L20 8.5 16.5 7z"/><path d="M4 20 13 11"/></svg>' : ''}`;
        b.setAttribute('aria-label', `Level ${i + 1}: ${l.name}${b.disabled ? ' (locked)' : `, ${p?.stars || 0} stars`}`);
        b.addEventListener('click', () => {
            sfx.click();
            loadLevel(i);
        });
        grid.append(b);
    });
    $('levels-total').textContent = `${totalStars()} / ${LEVELS.length * 3} stars`;
    showDialog('levels', true);
    grid.querySelector('.current')?.focus({ preventScroll: true });
}

// --------------------------------------------------------------- input --
const KEYS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
    ' ': 'magic',
    e: 'magic',
};

function onKey(e) {
    unlockAudio();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === 'Escape') {
        if (!$('levels').hidden) showDialog('levels', false);
        else if (!$('help').hidden) showDialog('help', false);
        else if (!$('ai-panel').hidden) closeAi();
        else openLevels();
        e.preventDefault();
        return;
    }
    if (!$('won').hidden) {
        if (k === 'Enter' || k === 'n') $('won-next').hidden ? openLevels() : loadLevel(levelIdx + 1);
        else if (k === 'r') restart();
        else if (k === 'z' || k === 'u' || k === 'Backspace') undo();
        else return;
        e.preventDefault();
        return;
    }
    if (!$('levels').hidden || !$('help').hidden) return;
    if (KEYS[k]) {
        e.preventDefault();
        if (e.repeat && mode === 'busy') return;
        if (mode === 'lost') return;
        act(KEYS[k]);
        return;
    }
    const actions = {
        z: undo,
        u: undo,
        Backspace: undo,
        r: restart,
        h: hint,
        i: () => ($('ai-panel').hidden ? openAi() : closeAi()),
        l: openLevels,
        m: () => (e.shiftKey ? toggleMusic() : toggleSound()),
        '?': () => showDialog('help', true),
        c: () => world.resetView(),
    };
    if (actions[k]) {
        e.preventDefault();
        actions[k]();
    }
}
document.addEventListener('keydown', onKey);

// Swipes (touch) slide the warrior; two fingers move the camera instead.
const canvas = world.renderer.domElement;
const pointers = new Map();
let multiTouchUntil = 0;
onSwipe(canvas, (dir) => {
    if (performance.now() < multiTouchUntil) return;
    if (mode === 'lost' || anyDialogOpen()) return;
    act(dir);
});
let pinchDist = 0;
canvas.addEventListener('pointerdown', (e) => {
    unlockAudio();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    if (pointers.size >= 2) {
        multiTouchUntil = performance.now() + 400;
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
});
canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (p.type === 'mouse' && e.buttons) {
        world.orbit(-dx * 0.005, -dy * 0.005);
    } else if (pointers.size >= 2) {
        multiTouchUntil = performance.now() + 400;
        world.orbit(-dx * 0.0025, -dy * 0.0025);
        p.x = e.clientX;
        p.y = e.clientY;
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist) world.zoomBy(d / pinchDist);
        pinchDist = d;
        return;
    }
    p.x = e.clientX;
    p.y = e.clientY;
});
const dropPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
};
canvas.addEventListener('pointerup', dropPointer);
canvas.addEventListener('pointercancel', dropPointer);
canvas.addEventListener(
    'wheel',
    (e) => {
        e.preventDefault();
        world.zoomBy(e.deltaY > 0 ? 0.92 : 1.08);
    },
    { passive: false },
);
canvas.addEventListener('dblclick', () => world.resetView());

// ---------------------------------------------------------------- sound --
const STORE_KEYS = { muted: 'muted', sfx: 'sfx', music: 'music', volume: 'music-volume' };
function setAudio(next) {
    configureAudio(next);
    const s = audioSettings();
    for (const k of Object.keys(next)) store.set(STORE_KEYS[k], s[k]);
    renderAudio();
}
const musicAudible = (s) => s.music && s.volume > 0;
const silent = (s) => s.muted || (!s.sfx && !musicAudible(s));

/** Toolbar speaker and M: everything on or off. */
function toggleSound() {
    const s = audioSettings();
    if (!silent(s)) return setAudio({ muted: true });
    // Unmuting with both switched off in the settings turns both back on.
    if (!s.sfx && !musicAudible(s)) setAudio({ muted: false, sfx: true, music: true, volume: s.volume || DEFAULT_VOLUME });
    else setAudio({ muted: false });
}

/** Hold the speaker, or Shift+M: only the music. */
function toggleMusic() {
    const s = audioSettings();
    const on = s.muted || !musicAudible(s);
    setAudio(on ? { muted: false, music: true, volume: s.volume || DEFAULT_VOLUME } : { music: false });
    toast(on ? 'Music on' : 'Music off', 1100);
}

function renderAudio() {
    const s = audioSettings();
    const off = silent(s);
    const btn = $('btn-sound');
    btn.setAttribute('aria-pressed', String(off));
    btn.setAttribute('aria-label', off ? 'Unmute sound' : 'Mute sound');
    $('opt-music').checked = !s.muted && s.music;
    $('opt-sfx').checked = !s.muted && s.sfx;
    $('opt-volume').value = String(Math.round(s.volume * 100));
    $('opt-volume-out').textContent = `${Math.round(s.volume * 100)}%`;
    $('audio-muted').hidden = !s.muted;
}

$('opt-music').addEventListener('change', (e) => setAudio(e.target.checked ? { music: true, muted: false } : { music: false }));
$('opt-sfx').addEventListener('change', (e) => setAudio(e.target.checked ? { sfx: true, muted: false } : { sfx: false }));
$('opt-volume').addEventListener('input', (e) => {
    const volume = Number(e.target.value) / 100;
    configureAudio(volume > 0 ? { volume, music: true, muted: false } : { volume });
    renderAudio();
});
$('opt-volume').addEventListener('change', (e) => {
    const volume = Number(e.target.value) / 100;
    setAudio(volume > 0 ? { volume, music: true, muted: false } : { volume });
});

// A long press on the speaker switches only the music.
{
    const btn = $('btn-sound');
    let timer = 0;
    let held = false;
    btn.addEventListener('pointerdown', () => {
        held = false;
        clearTimeout(timer);
        timer = setTimeout(() => {
            held = true;
            toggleMusic();
        }, 550);
    });
    for (const type of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(type, () => clearTimeout(timer));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
        unlockAudio();
        e.currentTarget.blur();
        if (held) held = false;
        else toggleSound();
    });
}
renderAudio();

const click = (id, fn) =>
    $(id).addEventListener('click', (e) => {
        unlockAudio();
        e.currentTarget.blur();
        fn();
    });
click('btn-undo', undo);
click('btn-restart', restart);
click('btn-magic', () => act('magic'));
click('btn-hint', hint);
click('btn-ai', () => ($('ai-panel').hidden ? openAi() : closeAi()));
click('btn-levels', openLevels);
click('btn-help', () => showDialog('help', true));
click('won-next', () => loadLevel(levelIdx + 1));
click('won-replay', () => loadLevel(levelIdx));
click('won-levels', openLevels);
click('lost-undo', undo);
click('lost-restart', restart);
click('levels-close', () => showDialog('levels', false));
click('help-close', () => showDialog('help', false));
click('help-ok', () => showDialog('help', false));
for (const id of ['levels', 'help']) {
    $(id).addEventListener('click', (e) => {
        if (e.target === e.currentTarget) showDialog(id, false);
    });
}

// ---------------------------------------------------------------- start --
buildAlgoButtons();
const lastId = store.get('last-level', null);
const lastIdx = LEVELS.findIndex((l) => l.id === lastId);
// The character models load lazily; show a short loading state meanwhile.
const loading = $('loading');
const loadingTimer = setTimeout(() => (loading.hidden = false), 150);
world.onProgress = (p) => ($('loading-bar').style.transform = `scaleX(${Math.max(0.04, p)})`);
const ready = world.ready.then(() => {
    clearTimeout(loadingTimer);
    loading.hidden = true;
    loadLevel(lastIdx >= 0 && isUnlocked(lastIdx) ? lastIdx : 0);
    if (!store.get('seen-help', false)) {
        showDialog('help', true);
        store.set('seen-help', true);
    }
});
solverReady.then((kind) => {
    document.documentElement.dataset.solver = kind;
    if (kind !== 'wasm') $('ai-compare').disabled = true;
});

// Handy for automated checks and the curious: window.brainy.
window.brainy = {
    get level() {
        return level;
    },
    get state() {
        return state;
    },
    get mode() {
        return mode;
    },
    get moves() {
        return history.length;
    },
    get levelIndex() {
        return levelIdx;
    },
    get idle() {
        return world.tweens.size === 0;
    },
    get renderInfo() {
        const info = world.renderer.info;
        return {
            calls: info.render.calls,
            triangles: info.render.triangles,
            textures: info.memory.textures,
            geometries: info.memory.geometries,
            programs: info.programs.length,
            quality: world.quality.settings.name,
            models: world.gltf ? 'gltf' : 'procedural',
        };
    },
    get levelIds() {
        return LEVELS.map((l) => l.id);
    },
    ready,
    solverReady,
    get audio() {
        return audioInfo();
    },
    // The 3D world, for the perf overlay and profiling (?perf=1 only).
    world: new URLSearchParams(location.search).get('perf') === '1' ? world : undefined,
    loadLevel,
    solve: (alg = 'astar') => solve(level, state, alg),
};
