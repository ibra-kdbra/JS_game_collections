/**
 * Snake for Game Lab: screens, input, layout, effects and the fixed-step loop.
 * The rules live in game.js; this file wires them to the page.
 */
import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, readBests, recordBest } from '../../assets/kit/storage.js';
import { createTouchControls, isTouchFirst } from '../../assets/kit/input.js';
import { CONFIG, MODES, STEPS_PER_SECOND } from './config.js';
import { ARENAS } from './arenas.js';
import { advance, createGame, moveProgress, queueTurn, stepsPerMove } from './game.js';
import { botMove } from './bot.js';
import { createRenderer, PALETTE, PORTAL_COLORS } from './render.js';
import { createAudio } from './audio.js';
import { utcDay } from './rng.js';

const SLUG = 'snake';
initShell({ slug: SLUG });
const store = createStore(SLUG);
const audio = createAudio(store);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');
const hud = $('#hud');
const stage = $('#stage');
const canvas = $('#board');
const renderer = createRenderer(canvas);

/* ------------------------------------------------------------- settings */

const settings = {
  dpad: store.get('dpad', false),
  motion: store.get('motion', 'system'), // 'system' | 'reduced' | 'full'
};
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => settings.motion === 'reduced' || (settings.motion === 'system' && motionQuery.matches);
const applyMotionClass = () => document.documentElement.classList.toggle('reduce-motion', reduced());
motionQuery.addEventListener?.('change', applyMotionClass);
applyMotionClass();

let dpad = null;
function applyDpad() {
  if (settings.dpad) {
    dpad ||= createTouchControls({
      dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      show: 'always',
    });
    dpad.show();
  } else if (dpad) dpad.hide();
  document.documentElement.classList.toggle('gk-has-touch', !!settings.dpad);
  layout();
}

/* ---------------------------------------------------------------- state */

let screen = 'title'; // title | arenas | settings | help | playing | paused | dying | over | replay
let returnTo = 'title'; // where Settings and Help go back to
let game = null;
let current = { mode: 'classic', arenaIndex: 0 };
let demo = null;
let snapshots = [];
let replay = null;
let dyingSteps = 0;
let streak = 0;
let lastEatTime = -1e9;
let result = null;

const fx = { particles: [], rings: [], popups: [], bulges: [], chomp: 0, shake: 0 };

function resetFx() {
  fx.particles.length = 0;
  fx.rings.length = 0;
  fx.popups.length = 0;
  fx.bulges.length = 0;
  fx.chomp = 0;
  fx.shake = 0;
}

/** True while the board shows the player's game (including Settings opened from the pause menu). */
function showingGame() {
  if (!game) return false;
  if (['playing', 'paused', 'dying', 'over', 'replay'].includes(screen)) return true;
  return screen === 'settings' && returnTo === 'paused';
}

const unlocked = () => Math.min(ARENAS.length, Math.max(1, store.get('unlocked', 1)));

/* --------------------------------------------------------------- layout */

/** Fit the square board into whatever space the HUD, kit buttons and d-pad leave. */
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sideHud = vw > vh && vh < 560;
  app.classList.toggle('is-side-hud', sideHud);
  const board = showingGame() ? game.board : demo?.board;
  if (!board) return;

  const pad = 10;
  const hudRect = hud.getBoundingClientRect();
  let top = pad;
  let left = pad;
  let right = vw - pad;
  let bottom = vh - pad;
  if (sideHud) {
    right = hudRect.left - pad;
    const shell = $('.gk-shell')?.getBoundingClientRect();
    if (shell) left = Math.max(left, shell.right + pad);
  } else {
    top = hudRect.bottom + 4;
    const hint = $('#keys-hint');
    if (!hint.hidden && getComputedStyle(hint).display !== 'none') bottom = hint.getBoundingClientRect().top - 6;
  }
  const pad2 = dpad && !dpad.el.hidden ? $('.gk-dpad', dpad.el)?.getBoundingClientRect() : null;
  if (pad2 && pad2.width) {
    if (vw > vh) left = Math.max(left, pad2.right + 12);
    else bottom = Math.min(bottom, pad2.top - 10);
  }
  const availW = Math.max(60, right - left);
  const availH = Math.max(60, bottom - top);
  const cell = Math.max(6, Math.floor(Math.min(availW / board.w, availH / board.h, 38)));
  const w = cell * board.w;
  const h = cell * board.h;
  // Centre on the screen when that stays clear of everything, otherwise within the free area.
  let x = (vw - w) / 2;
  if (x < left || x + w > right) x = left + (availW - w) / 2;
  const y = top + (availH - h) / 2;
  stage.style.left = `${Math.round(x)}px`;
  stage.style.top = `${Math.round(y)}px`;
  stage.style.width = `${w}px`;
  stage.style.height = `${h}px`;
  renderer.resize(w, h);
}

let resizeQueued = false;
function queueLayout() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    layout();
  });
}
window.addEventListener('resize', queueLayout);
window.addEventListener('orientationchange', queueLayout);

/* -------------------------------------------------------------- screens */

const screens = $$('[data-screen]');
const remembered = {};

function show(name) {
  const prev = screen;
  if (document.activeElement?.dataset && screens.some((s) => s.contains(document.activeElement))) {
    remembered[prev] = document.activeElement.dataset.mode ?? document.activeElement.dataset.arena ?? document.activeElement.dataset.action ?? document.activeElement.dataset.go;
  }
  screen = name;
  for (const s of screens) s.hidden = s.dataset.screen !== name;
  const el = screens.find((s) => s.dataset.screen === name);
  if (name === 'title') refreshTitle();
  if (name === 'arenas') buildArenaGrid();
  if (name === 'settings') refreshSettings();
  if (el) {
    const items = $$('[data-nav]:not([disabled]):not([hidden])', el);
    const key = remembered[name];
    const target = items.find((b) => [b.dataset.mode, b.dataset.arena, b.dataset.action, b.dataset.go].includes(key)) ?? items[0];
    target?.focus({ preventScroll: true });
  }
  const inGame = showingGame();
  if (!inGame) {
    ensureDemo();
    renderer.setBoard(demo.board);
  } else if (game) renderer.setBoard(game.board);
  $('#keys-hint').hidden = !(name === 'playing' && !isTouchFirst());
  updateReady();
  updateHud(true);
  layout();
}

function refreshTitle() {
  const bests = readBests(SLUG);
  const day = utcDay();
  for (const btn of $$('.mode')) {
    const id = btn.dataset.mode;
    $('.mode-desc', btn).textContent = MODES[id].blurb;
    let best = '';
    if (id === 'arena') best = `${Object.keys(bests).filter((k) => k.startsWith('arena-')).length}/${ARENAS.length}`;
    else if (id === 'daily') best = bests[`daily-${day}`] ? `Today ${bests[`daily-${day}`].value}` : new Date(`${day}T12:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    else if (id === 'zen') best = bests.zen ? `Len ${bests.zen.value}` : '';
    else best = bests[id] ? `Best ${bests[id].value}` : '';
    $('.mode-best', btn).textContent = best;
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1).padStart(4, '0');
  return m ? `${m}:${s}` : `${(seconds % 60).toFixed(1)}s`;
}

function buildArenaGrid() {
  const grid = $('#arena-grid');
  const bests = readBests(SLUG);
  const open = unlocked();
  grid.innerHTML = '';
  let cleared = 0;
  ARENAS.forEach((arena, i) => {
    const key = `arena-${String(i + 1).padStart(2, '0')}`;
    const best = bests[key];
    if (best) cleared++;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `arena${best ? ' is-cleared' : ''}`;
    b.dataset.nav = '';
    b.dataset.arena = String(i);
    const locked = i >= open;
    b.disabled = locked;
    b.innerHTML = `<span class="arena-no">${String(i + 1).padStart(2, '0')}</span><span class="arena-name"></span><span class="arena-meta"></span><span class="arena-best"></span>`;
    $('.arena-name', b).textContent = arena.name;
    $('.arena-meta', b).textContent = locked ? 'Locked' : `Reach ${arena.target}`;
    $('.arena-best', b).textContent = best ? formatTime(best.value) : '';
    b.setAttribute('aria-label', `Arena ${i + 1}, ${arena.name}. ${locked ? 'Locked.' : `Reach length ${arena.target}.`}${best ? ` Best ${formatTime(best.value)}.` : ''}`);
    li.append(b);
    grid.append(li);
  });
  $('#arenas-progress').textContent = `${cleared} of ${ARENAS.length} cleared`;
}

function refreshSettings() {
  const sound = $('[data-setting="sound"]');
  sound.setAttribute('aria-checked', String(!audio.muted));
  $('.toggle-state', sound).textContent = audio.muted ? 'Off' : 'On';
  const pad = $('[data-setting="dpad"]');
  pad.setAttribute('aria-checked', String(settings.dpad));
  $('.toggle-state', pad).textContent = settings.dpad ? 'On' : 'Off';
  const motion = $('[data-setting="motion"]');
  const label = { system: `System (${motionQuery.matches ? 'reduced' : 'full'})`, reduced: 'Reduced', full: 'Full' }[settings.motion];
  $('.toggle-state', motion).textContent = label;
  motion.setAttribute('aria-label', `Motion: ${label}. Press to change.`);
}

function refreshMute() {
  const btn = $('#btn-mute');
  btn.setAttribute('aria-pressed', String(audio.muted));
  btn.setAttribute('aria-label', audio.muted ? 'Sound off (M)' : 'Sound on (M)');
}

function toggleMute() {
  audio.setMuted(!audio.muted);
  refreshMute();
  if (screen === 'settings') refreshSettings();
  announce(audio.muted ? 'Sound off' : 'Sound on');
}

function announce(text) {
  const el = $('#announce');
  el.textContent = '';
  requestAnimationFrame(() => (el.textContent = text));
}

/* ---------------------------------------------------------------- HUD */

const hudCache = {};
function setText(id, value) {
  if (hudCache[id] === value) return;
  hudCache[id] = value;
  $(`#${id}`).textContent = value;
}

function bestFor(mode, arenaIndex) {
  const bests = readBests(SLUG);
  if (mode === 'arena') return bests[`arena-${String(arenaIndex + 1).padStart(2, '0')}`];
  if (mode === 'daily') return bests[`daily-${utcDay()}`];
  return bests[mode];
}

function updateHud(force = false) {
  if (force) for (const k of Object.keys(hudCache)) delete hudCache[k];
  const g = showingGame() ? game : null;
  if (!g) {
    setText('hud-mode', 'snake');
    setText('hud-sub', 'choose a mode');
    setText('stat-a-label', 'Score');
    setText('stat-a', '—');
    setText('stat-b-label', 'Length');
    setText('stat-b', '—');
    setText('stat-c-label', 'Best');
    setText('stat-c', '—');
    $('#boost').hidden = true;
    return;
  }
  const best = bestFor(g.mode, g.arenaIndex);
  if (g.mode === 'arena') {
    setText('hud-mode', `arena ${String(g.arenaIndex + 1).padStart(2, '0')}`);
    setText('hud-sub', g.board.arena.name);
    setText('stat-a-label', 'Time');
    setText('stat-a', formatTime(g.time / STEPS_PER_SECOND));
    setText('stat-b-label', 'Length');
    setText('stat-b', `${g.snake.length}/${g.target}`);
    setText('stat-c-label', 'Best');
    setText('stat-c', best ? formatTime(best.value) : '—');
  } else if (g.mode === 'zen') {
    setText('hud-mode', 'zen');
    setText('hud-sub', 'no walls, no death');
    setText('stat-a-label', 'Length');
    setText('stat-a', String(g.snake.length));
    setText('stat-b-label', 'Longest');
    setText('stat-b', String(g.maxLength));
    setText('stat-c-label', 'Best');
    setText('stat-c', best ? String(Math.max(best.value, g.maxLength)) : String(g.maxLength));
  } else {
    setText('hud-mode', MODES[g.mode].name.toLowerCase());
    setText('hud-sub', g.mode === 'daily' ? `${g.day} · UTC` : `${(STEPS_PER_SECOND / stepsPerMove(g)).toFixed(1)} cells/s`);
    setText('stat-a-label', 'Score');
    setText('stat-a', String(g.score));
    setText('stat-b-label', 'Length');
    setText('stat-b', String(g.snake.length));
    setText('stat-c-label', 'Best');
    setText('stat-c', String(Math.max(best?.value ?? 0, g.score)));
  }
  const boost = $('#boost');
  if (g.boost) {
    boost.hidden = false;
    boost.dataset.kind = g.boost.kind;
    const k = g.boost.left / g.boost.max;
    $('#boost-fill').style.transform = app.classList.contains('is-side-hud') ? `scaleY(${k})` : `scaleX(${k})`;
  } else boost.hidden = true;
}

function updateReady() {
  const el = $('#ready');
  const show = screen === 'playing' && game && !game.started;
  el.hidden = !show;
  if (show) el.textContent = isTouchFirst() || settings.dpad ? 'Swipe anywhere to start' : 'Press an arrow key or WASD to start';
}

/* ----------------------------------------------------------------- game */

function ensureDemo() {
  if (demo && !demo.over) return;
  const arenaIndex = Math.floor(Math.random() * ARENAS.length);
  demo = createGame({ mode: 'arena', arenaIndex, seed: (Math.random() * 2 ** 32) >>> 0 });
  demo.target = 0; // The demo just keeps going.
  if (!showingGame()) {
    renderer.setBoard(demo.board);
    layout();
  }
}

function snapshot(g) {
  return {
    step: g.time,
    snake: g.snake.slice(),
    prev: g.prev.slice(),
    dirs: g.dirs.slice(),
    food: g.food,
    golden: g.golden && { ...g.golden },
    power: g.power && { ...g.power },
  };
}

function startGame(mode, arenaIndex = 0) {
  audio.unlock();
  current = { mode, arenaIndex };
  game = createGame({ mode, arenaIndex, day: utcDay(), seed: (Math.random() * 2 ** 32) >>> 0 });
  store.set('lastMode', mode);
  snapshots = [snapshot(game)];
  replay = null;
  result = null;
  streak = 0;
  resetFx();
  renderer.setBoard(game.board);
  loop.resume();
  show('playing');
  canvas.setAttribute('aria-label', `${MODES[mode].name}${mode === 'arena' ? ` arena ${arenaIndex + 1}, ${ARENAS[arenaIndex].name}, reach length ${ARENAS[arenaIndex].target}` : ''}. Use the arrow keys to steer.`);
  announce(mode === 'arena' ? `Arena ${arenaIndex + 1}: ${ARENAS[arenaIndex].name}. ${ARENAS[arenaIndex].hint} Reach length ${ARENAS[arenaIndex].target}.` : `${MODES[mode].name}. ${MODES[mode].blurb}`);
}

function steer(dir) {
  audio.unlock();
  if (screen !== 'playing' || !game) return;
  const wasStarted = game.started;
  if (queueTurn(game, dir)) {
    if (!wasStarted) {
      audio.play('start');
      updateReady();
    }
  }
}

function pause() {
  if (screen !== 'playing') return;
  loop.pause();
  $('#pause-sub').textContent = game.mode === 'arena' ? `${ARENAS[game.arenaIndex].name} · reach ${game.target}` : MODES[game.mode].name;
  returnTo = 'paused';
  show('paused');
}

function resume() {
  if (game.started) game.grace = CONFIG.resumeGrace;
  show('playing');
  loop.resume();
}

function quitToMenu() {
  if (game?.mode === 'zen') recordZen();
  returnTo = 'title';
  loop.resume();
  show(current.mode === 'arena' ? 'arenas' : 'title');
}

function recordZen() {
  if (!game || game.maxLength <= CONFIG.startLength) return;
  recordBest(SLUG, game.maxLength, { mode: 'zen', label: `Zen: length ${game.maxLength}` });
}

const CAUSES = {
  edge: ['Hit the edge', 'The solid edge kills in this mode.'],
  wall: ['Hit a wall', 'Hatched blocks are solid.'],
  self: ['Bit your own tail', 'Your body is solid. Leave yourself a way out.'],
};

function finish() {
  const g = game;
  const day = utcDay();
  let rec = null;
  if (g.won && g.mode === 'arena') {
    const t = Math.round((g.time / STEPS_PER_SECOND) * 10) / 10;
    const key = `arena-${String(g.arenaIndex + 1).padStart(2, '0')}`;
    rec = recordBest(SLUG, t, { lowerIsBetter: true, mode: key, label: `${ARENAS[g.arenaIndex].name} in ${formatTime(t)}` });
    store.set('unlocked', Math.max(unlocked(), Math.min(ARENAS.length, g.arenaIndex + 2)));
    result = { won: true, a: ['Time', formatTime(t)], b: ['Best', formatTime(rec.best)], isNew: rec.isNew };
  } else if (g.mode === 'arena') {
    const best = bestFor('arena', g.arenaIndex);
    result = { won: false, a: ['Length', `${g.snake.length}/${g.target}`], b: ['Best', best ? formatTime(best.value) : '—'], isNew: false };
  } else if (g.mode === 'daily') {
    rec = recordBest(SLUG, g.score, { mode: `daily-${day}`, label: `Daily ${day}: ${g.score}` });
    result = { won: g.won, a: ['Score', String(g.score)], b: ['Today best', String(rec.best)], isNew: rec.isNew && g.score > 0 };
  } else {
    rec = recordBest(SLUG, g.score, { mode: g.mode, label: `${MODES[g.mode].name}: ${g.score}` });
    result = { won: g.won, a: ['Score', String(g.score)], b: ['Best', String(rec.best)], isNew: rec.isNew && g.score > 0 };
  }
}

function showOver() {
  const g = game;
  const won = g.won;
  $('#over-eyebrow').textContent = g.mode === 'arena' ? `Arena ${String(g.arenaIndex + 1).padStart(2, '0')} · ${ARENAS[g.arenaIndex].name}` : g.mode === 'daily' ? `Daily · ${g.day}` : MODES[g.mode].name;
  $('#over-h').textContent = won ? (g.mode === 'arena' ? 'Arena cleared' : 'Board full!') : CAUSES[g.cause][0];
  $('#over-cause').textContent = won ? (g.mode === 'arena' && g.arenaIndex === ARENAS.length - 1 ? 'Every arena cleared. The circle is closed.' : '') : CAUSES[g.cause][1];
  $('#over-cause').hidden = !$('#over-cause').textContent;
  $('#res-a-label').textContent = result.a[0];
  $('#res-a').textContent = result.a[1];
  $('#res-b-label').textContent = result.b[0];
  $('#res-b').textContent = result.b[1];
  $('#new-best').hidden = !result.isNew;
  const hasNext = won && g.mode === 'arena' && g.arenaIndex < ARENAS.length - 1;
  $('#btn-next').hidden = !hasNext;
  $('#btn-replay').hidden = snapshots.length < 2;
  $('#btn-again').classList.toggle('btn--primary', !hasNext);
  remembered.over = hasNext ? 'next' : 'restart';
  show('over');
  announce(`${$('#over-h').textContent}. ${result.a[0]} ${result.a[1]}. ${result.b[0]} ${result.b[1]}.${result.isNew ? ' New personal best.' : ''}`);
}

function startReplay() {
  if (snapshots.length < 2) return;
  replay = { t: snapshots[0].step, end: snapshots[snapshots.length - 1].step, hold: 0 };
  for (const s of screens) s.hidden = true;
  screen = 'replay';
  $('#replay-tag').hidden = false;
  $('#keys-hint').hidden = true;
}

function stopReplay() {
  $('#replay-tag').hidden = true;
  replay = null;
  remembered.over = 'restart';
  show('over');
}

/* -------------------------------------------------------------- effects */

const rand = (a, b) => a + Math.random() * (b - a);

function cellCenter(board, cell) {
  return { x: (cell % board.w) + 0.5, y: Math.floor(cell / board.w) + 0.5 };
}

function burst(board, cell, color, count = 12, size = 1.6) {
  const { x, y } = cellCenter(board, cell);
  fx.rings.push({ x, y, age: 0, life: 22, size, color });
  if (reduced()) return;
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const v = rand(0.04, 0.14);
    fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(18, 36), size: rand(0.07, 0.16), color });
  }
}

function popup(board, cell, text, color) {
  const { x, y } = cellCenter(board, cell);
  // Keep labels fully on the board even when food sits on an edge.
  const cx = Math.min(board.w - 1.2, Math.max(1.2, x));
  fx.popups.push({ x: cx, y: Math.max(1.4, y - 0.3), text, color, age: 0, life: 44 });
}

function stepFx() {
  for (const p of fx.particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.age++;
  }
  for (const r of fx.rings) r.age++;
  for (const t of fx.popups) t.age++;
  fx.particles = fx.particles.filter((p) => p.age < p.life);
  fx.rings = fx.rings.filter((r) => r.age < r.life);
  fx.popups = fx.popups.filter((t) => t.age < t.life);
  fx.chomp = Math.max(0, fx.chomp - 0.1);
  fx.shake = Math.max(0, fx.shake * 0.86 - 0.02);
}

const ITEM_COLOR = { food: PALETTE.food, golden: PALETTE.golden, fast: PALETTE.fast, slow: PALETTE.slow };

function handleEvents(events) {
  const board = game.board;
  for (const e of events) {
    switch (e.type) {
      case 'eat': {
        if (game.time - lastEatTime < 4 * STEPS_PER_SECOND) streak++;
        else streak = 0;
        lastEatTime = game.time;
        if (e.kind === 'food') audio.play('eat', streak);
        else audio.play(e.kind);
        burst(board, e.cell, ITEM_COLOR[e.kind], e.kind === 'golden' ? 22 : 12, e.kind === 'golden' ? 2.4 : 1.5);
        const label = game.mode === 'arena' || game.mode === 'zen' ? (e.kind === 'golden' ? '+3' : e.kind === 'food' ? '+1' : e.kind === 'fast' ? 'FAST' : 'SLOW') : e.kind === 'fast' ? 'FAST' : e.kind === 'slow' ? 'SLOW' : `+${e.points}`;
        popup(board, e.cell, label, ITEM_COLOR[e.kind]);
        fx.bulges.push({ seg: 0 });
        fx.chomp = 1;
        if (e.kind === 'golden' && !reduced()) fx.shake = 4;
        if (game.mode === 'zen' && game.snake.length + game.growth > (bestFor('zen')?.value ?? 0)) recordZen();
        break;
      }
      case 'portal':
        audio.play('portal');
        burst(board, e.from, PORTAL_COLORS[0], 0, 1.2);
        burst(board, e.to, PORTAL_COLORS[0], 6, 1.6);
        break;
      case 'chop':
        audio.play('chop');
        for (const c of e.cells) burst(board, c, '#71717a', 3, 0.8);
        popup(board, e.at, `-${e.cells.length}`, '#e4e4e7');
        fx.bulges = fx.bulges.filter((b) => b.seg < game.snake.length);
        if (!reduced()) fx.shake = 3;
        break;
      case 'spawn':
        if (e.kind === 'golden') burst(board, e.cell, PALETTE.golden, 0, 1);
        break;
      case 'boostEnd':
        audio.play('boostEnd');
        break;
      case 'die':
        audio.play('die');
        if (!reduced()) fx.shake = 9;
        if (navigator.vibrate && isTouchFirst()) navigator.vibrate(60);
        break;
      case 'win':
        audio.play('win');
        burst(board, game.snake[0], PALETTE.golden, 30, 3);
        break;
      default:
    }
  }
}

/* ----------------------------------------------------------------- loop */

function updateDemo() {
  if (!demo || reduced()) return;
  if (demo.over) {
    ensureDemo();
    return;
  }
  if (!demo.started) queueTurn(demo, botMove(demo));
  if (!demo.queue.length && demo.counter + 1 >= stepsPerMove(demo)) queueTurn(demo, botMove(demo));
  advance(demo);
  if (demo.time > 90 * STEPS_PER_SECOND) demo.over = true;
}

function update() {
  if (screen === 'playing' && game) {
    const moves = game.moves;
    const events = advance(game);
    if (game.moves !== moves) {
      for (const b of fx.bulges) b.seg++;
      fx.bulges = fx.bulges.filter((b) => b.seg < game.snake.length);
      snapshots.push(snapshot(game));
      const keep = CONFIG.replaySeconds * STEPS_PER_SECOND;
      while (snapshots.length > 2 && snapshots[1].step < game.time - keep) snapshots.shift();
    }
    if (events.length) handleEvents(events);
    if (game.started && !$('#ready').hidden) updateReady();
    if (game.over) {
      finish();
      dyingSteps = game.won ? 50 : 55;
      screen = 'dying';
      $('#keys-hint').hidden = true;
    }
    updateHud();
  } else if (screen === 'dying') {
    if (--dyingSteps <= 0) showOver();
  } else if (screen === 'replay' && replay) {
    if (replay.t < replay.end) replay.t++;
    else if (++replay.hold > 50) stopReplay();
  } else if (!['paused', 'over'].includes(screen)) {
    updateDemo();
  }
  stepFx();
}

function replayScene() {
  const snaps = snapshots;
  let k = 0;
  while (k < snaps.length - 2 && snaps[k + 1].step <= replay.t) k++;
  const a = snaps[k];
  const b = snaps[Math.min(k + 1, snaps.length - 1)];
  const span = Math.max(1, b.step - a.step);
  const t = Math.min(1, Math.max(0, (replay.t - a.step) / span));
  const last = replay.t >= replay.end;
  return {
    snake: b.snake,
    prev: b.prev,
    dirs: b.dirs,
    t,
    food: b.food,
    golden: b.golden,
    power: b.power,
    lookAt: b.food,
    bulges: [],
    dead: last && !game.won,
    death: last && !game.won ? { cause: game.cause, x: game.causeX, y: game.causeY } : null,
  };
}

function render(alpha) {
  const time = performance.now() / 1000;
  const calm = reduced();
  let scene;
  if (screen === 'replay' && replay) {
    scene = replayScene();
  } else {
    const inGame = showingGame();
    const g = inGame ? game : demo;
    if (!g) return;
    const dead = g.over && !g.won;
    scene = {
      snake: g.snake,
      prev: g.prev,
      dirs: g.dirs,
      t: screen === 'paused' ? moveProgress(g, 0) : moveProgress(g, alpha),
      food: g.food,
      golden: g.golden,
      power: g.power,
      lookAt: g.food,
      bulges: inGame ? fx.bulges : [],
      dead: inGame && dead,
      death: inGame && dead ? { cause: g.cause, x: g.causeX, y: g.causeY } : null,
      chomp: inGame ? fx.chomp : 0,
    };
  }
  scene.time = time;
  scene.reduced = calm;
  scene.effects = fx;
  scene.shake = fx.shake > 0.1 && !calm ? { x: rand(-fx.shake, fx.shake), y: rand(-fx.shake, fx.shake) } : null;
  renderer.draw(scene);
}

const loop = createLoop({ update, render, stepsPerSecond: STEPS_PER_SECOND });

/* ---------------------------------------------------------------- input */

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right',
};

/** Spatial focus movement for menus: the nearest item in the pressed direction. */
function moveFocus(dir) {
  const el = screens.find((s) => !s.hidden);
  if (!el) return;
  const items = $$('[data-nav]:not([disabled]):not([hidden])', el);
  if (!items.length) return;
  const active = document.activeElement;
  if (!items.includes(active)) {
    items[0].focus();
    return;
  }
  const r = active.getBoundingClientRect();
  const ax = r.left + r.width / 2;
  const ay = r.top + r.height / 2;
  let best = null;
  let bestD = Infinity;
  for (const item of items) {
    if (item === active) continue;
    const q = item.getBoundingClientRect();
    const dx = q.left + q.width / 2 - ax;
    const dy = q.top + q.height / 2 - ay;
    const along = { up: -dy, down: dy, left: -dx, right: dx }[dir];
    const across = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (along <= 1) continue;
    const d = along + across * 2.5;
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  if (!best && (dir === 'up' || dir === 'down')) {
    // Wrap around vertical lists.
    best = dir === 'down' ? items[0] : items[items.length - 1];
  }
  if (best) {
    best.focus();
    best.scrollIntoView?.({ block: 'nearest' });
    audio.play('ui');
  }
}

function back() {
  if (screen === 'arenas' || screen === 'help') show('title');
  else if (screen === 'settings') show(returnTo === 'paused' ? 'paused' : 'title');
  else if (screen === 'paused') resume();
  else if (screen === 'over') quitToMenu();
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  audio.unlock();
  const dir = KEY_DIRS[e.key];
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (screen === 'playing') {
    if (dir) {
      e.preventDefault();
      steer(dir);
    } else if (key === 'p' || key === 'Escape') {
      e.preventDefault();
      pause();
    } else if (key === 'm') toggleMute();
    else if (key === ' ') e.preventDefault();
    return;
  }
  if (screen === 'dying') {
    if (dir || key === ' ') e.preventDefault();
    return;
  }
  if (screen === 'replay') {
    e.preventDefault();
    stopReplay();
    return;
  }
  if (key === 'm') {
    toggleMute();
    return;
  }
  if (key === 'Escape') {
    e.preventDefault();
    back();
    return;
  }
  if (screen === 'paused' && key === 'p') {
    e.preventDefault();
    resume();
    return;
  }
  if (screen === 'over') {
    if (key === 'r') {
      e.preventDefault();
      startReplay();
      return;
    }
  }
  if (dir) {
    e.preventDefault();
    moveFocus(dir);
  }
});

// Swipes: a turn fires as soon as the finger has moved far enough, and the
// gesture re-anchors so one continuous stroke can chain several turns.
let swipe = null;
const SWIPE_PX = 22;
app.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (e.pointerType === 'mouse') return;
  if (screen === 'replay') {
    stopReplay();
    return;
  }
  if (screen !== 'playing') return;
  if (e.target.closest('button, a')) return;
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY };
});
app.addEventListener('pointermove', (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x;
  const dy = e.clientY - swipe.y;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  swipe.x = e.clientX;
  swipe.y = e.clientY;
});
const endSwipe = (e) => {
  if (swipe && e.pointerId === swipe.id) swipe = null;
};
app.addEventListener('pointerup', endSwipe);
app.addEventListener('pointercancel', endSwipe);

app.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  audio.unlock();
  if (btn.dataset.mode) {
    audio.play('ui');
    if (btn.dataset.mode === 'arena') {
      current.mode = 'arena';
      show('arenas');
    } else startGame(btn.dataset.mode);
    return;
  }
  if (btn.dataset.arena !== undefined) {
    startGame('arena', Number(btn.dataset.arena));
    return;
  }
  if (btn.dataset.go) {
    audio.play('ui');
    if (btn.dataset.go === 'settings' || btn.dataset.go === 'help') returnTo = screen === 'paused' ? 'paused' : 'title';
    if (btn.dataset.go === 'title') current.mode = 'classic';
    show(btn.dataset.go);
    return;
  }
  if (btn.dataset.setting) {
    const s = btn.dataset.setting;
    if (s === 'sound') toggleMute();
    if (s === 'dpad') {
      settings.dpad = !settings.dpad;
      store.set('dpad', settings.dpad);
      applyDpad();
    }
    if (s === 'motion') {
      const order = ['system', 'reduced', 'full'];
      settings.motion = order[(order.indexOf(settings.motion) + 1) % order.length];
      store.set('motion', settings.motion);
      applyMotionClass();
    }
    refreshSettings();
    audio.play('ui');
    return;
  }
  switch (btn.dataset.action) {
    case 'resume':
      resume();
      break;
    case 'restart':
      startGame(current.mode, current.arenaIndex);
      break;
    case 'next':
      startGame('arena', current.arenaIndex + 1);
      break;
    case 'replay':
      startReplay();
      break;
    case 'quit':
      quitToMenu();
      break;
    case 'back':
      back();
      break;
    default:
  }
  if (btn.id === 'btn-pause') screen === 'playing' ? pause() : screen === 'paused' && resume();
  if (btn.id === 'btn-mute') toggleMute();
  if (btn.id === 'btn-mute') btn.blur();
});

// Hidden tab or lost focus: open the pause menu so nobody returns to a moving snake.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', () => pause());

/* ----------------------------------------------------------------- boot */

refreshMute();
ensureDemo();
renderer.setBoard(demo.board);
applyDpad();
show('title');
loop.start();
document.fonts?.ready.then(() => layout());

// For automated checks: read-only peek at the current state.
Object.defineProperty(window, '__snake', {
  value: {
    get screen() {
      return screen;
    },
    get game() {
      return game;
    },
    get demo() {
      return demo;
    },
  },
});
