import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest, readBests } from '../../assets/kit/storage.js';
import { createTouchControls, isTouchFirst } from '../../assets/kit/input.js';
import { FIELD, STAGES, roundStages } from './stages.js';
import { createWorld } from './sim.js';
import { createRenderer } from './render.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';

const SLUG = 'barrel-tower';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

initShell({ slug: SLUG });
const store = createStore(SLUG);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

const audio = createAudio({ muted: store.get('muted', false), music: store.get('music', true) });
const fx = createFx({ reducedMotion });
const canvas = $('game');
const renderer = createRenderer(canvas);

const touch = createTouchControls({
  dpad: { up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown' },
  buttons: [{ label: 'Jump', key: ' ' }],
});
touch.hide();

const TIPS = {
  ramps: 'Climb to the beacon. Jump the barrels.',
  lifts: 'Ride the lifts up. Mind the springs.',
  rivets: 'Walk over all eight rivets.',
};

/* ---------- State ---------- */

let screen = 'title'; // title | help | play | pause | over
let world = createWorld({ stage: 'ramps', round: 2, seed: 3, immortal: true }); // the attract-mode backdrop
let game = null; // { round, stageIndex, lives, score, extraGiven }
let phase = 'demo'; // demo | intro | play | clear | dead
let phaseT = 0;
let tick = 0;
const keys = { left: false, right: false, up: false, down: false, jump: false };
let layout = { x: 0, y: 0, scale: 1, vw: 0, vh: 0, dpr: 1 };

/* ---------- Layout ---------- */

function computeLayout() {
  const vw = document.documentElement.clientWidth || innerWidth;
  const vh = window.visualViewport?.height ?? innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const hudH = 48;
  const pad = 8;
  // On touch screens held upright, the controls sit under the field.
  const touchShown = !touch.el.hidden;
  const bottom = touchShown && vw < vh * 1.1 ? 196 : 0;
  let scale = Math.min((vw - pad * 2) / FIELD.w, (vh - hudH - bottom - pad * 2) / FIELD.h);
  // Whole-number scales keep every pixel the same size when there is room.
  if (scale >= 2) scale = Math.floor(scale * 2) / 2;
  scale = Math.max(0.5, scale);
  const w = FIELD.w * scale;
  const h = FIELD.h * scale;
  const x = Math.round((vw - w) / 2);
  const y = Math.round(Math.max(pad + hudH, (vh - bottom - h - hudH) / 2 + hudH));
  layout = { x, y, w, h, scale, vw, vh, dpr };
  renderer.resize(layout);
  const hud = $('hud');
  hud.style.left = `${x}px`;
  hud.style.width = `${w}px`;
  hud.style.top = `${y - 46}px`;
  const card = $('card');
  card.style.left = `${x + w / 2}px`;
  card.style.top = `${y + h * 0.45}px`;
  const toast = $('toast');
  toast.style.left = `${x + w / 2}px`;
  toast.style.top = `${y + 8}px`;
}

addEventListener('resize', computeLayout);
window.visualViewport?.addEventListener('resize', computeLayout);

/* ---------- Screens ---------- */

const SCREENS = { title: 'screenTitle', help: 'screenHelp', pause: 'screenPause', over: 'screenOver' };

function show(name) {
  screen = name;
  for (const [k, id] of Object.entries(SCREENS)) $(id).hidden = k !== name;
  const inGame = name === 'play' || name === 'pause';
  $('hud').hidden = !game || !(inGame || name === 'over');
  if (inGame && isTouchFirst()) touch.show();
  else touch.hide();
  computeLayout();
  if (name === 'play') document.activeElement?.blur?.();
  else $(SCREENS[name])?.querySelector('button')?.focus({ preventScroll: true });
}

function refreshTitle() {
  const b = readBests(SLUG);
  const best = b.default?.value;
  const round = store.get('bestRound', 0);
  $('titleBest').textContent = best ? `Best ${fmt(best)}${round > 1 ? ` · reached round ${round}` : ''}` : '';
}

let toastTimer = 0;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('is-on'), 1600);
}

/* ---------- HUD ---------- */

let hudCache = '';
function updateHud() {
  if (!game) return;
  const score = game.score + world.score;
  const key = `${score}|${world.bonus}|${game.lives}|${game.round}|${game.stageIndex}`;
  if (key === hudCache) return;
  hudCache = key;
  $('hudScore').textContent = fmt(score);
  $('hudBonus').textContent = world.bonus;
  $('hudBonus').parentElement.classList.toggle('is-low', world.bonus <= 1000 && phase === 'play');
  const stages = roundStages(game.round);
  $('hudStageLabel').textContent = `Round ${game.round} · ${game.stageIndex + 1}/${stages.length}`;
  $('hudLives').innerHTML = '<i></i>'.repeat(Math.max(0, game.lives - 1));
}

/* ---------- Game flow ---------- */

function stageId() {
  return roundStages(game.round)[game.stageIndex];
}

function newGame() {
  audio.unlock();
  game = { round: 1, stageIndex: 0, lives: 3, score: 0, extraGiven: false, seed: (Date.now() & 0xffff) || 1 };
  if (params.has('round')) game.round = Math.max(1, +params.get('round') || 1);
  if (params.has('stage')) {
    const i = roundStages(game.round).indexOf(params.get('stage'));
    if (i >= 0) game.stageIndex = i;
  }
  startStage();
  show('play');
}

function startStage() {
  fx.clear();
  game.seed = (game.seed * 1103515245 + 12345) & 0x7fffffff;
  world = createWorld({ stage: stageId(), round: game.round, seed: game.seed });
  phase = 'intro';
  phaseT = 0;
  hudCache = '';
  const def = STAGES[stageId()]();
  $('cardKicker').textContent = `Round ${game.round} · Stage ${game.stageIndex + 1}`;
  $('cardTitle').textContent = def.name;
  $('cardTip').textContent = TIPS[def.id];
  $('card').hidden = false;
  audio.stopMusic();
  audio.play('start');
  updateHud();
}

function stageCleared() {
  game.score += world.score + world.bonus;
  awardExtra();
  const stages = roundStages(game.round);
  game.stageIndex++;
  if (game.stageIndex >= stages.length) {
    game.stageIndex = 0;
    game.round++;
    store.set('bestRound', Math.max(store.get('bestRound', 0), game.round));
    toast(`Round ${game.round}: everything gets faster`);
  }
  startStage();
}

function lifeLost() {
  game.score += world.score;
  game.lives--;
  if (game.lives <= 0) return gameOver();
  startStage();
}

function awardExtra() {
  if (!game.extraGiven && game.score + world.score >= 10000) {
    game.extraGiven = true;
    game.lives++;
    toast('Extra life');
    audio.play('hammer');
  }
}

function gameOver() {
  audio.stopMusic();
  const { isNew } = recordBest(SLUG, game.score, { label: `Round ${game.round}` });
  store.set('bestRound', Math.max(store.get('bestRound', 0), game.round));
  $('overKicker').textContent = `Round ${game.round} · ${STAGES[stageId()]().name}`;
  $('overScore').textContent = fmt(game.score);
  $('overBest').hidden = !isNew;
  phase = 'demo';
  updateHud();
  show('over');
  refreshTitle();
}

function quitToTitle() {
  audio.stopMusic();
  game = null;
  phase = 'demo';
  world = createWorld({ stage: 'ramps', round: 2, seed: 3, immortal: true });
  refreshTitle();
  show('title');
}

function pause(on) {
  if (on && screen === 'play') {
    show('pause');
    audio.suspend(true);
  } else if (!on && screen === 'pause') {
    show('play');
    audio.suspend(false);
  }
}

/* ---------- Events from the world ---------- */

const PARTICLES = {
  smash: ['#ffffff', '#ffb02e', '#b8692e', '#6d3a15'],
  rivet: ['#facc15', '#fff1a8', '#e2573f'],
  ignite: ['#ff5a1f', '#ffb02e', '#fff1a8'],
};

function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'jump':
      case 'land':
      case 'throw':
      case 'spring':
      case 'vent':
        audio.play(e.type);
        break;
      case 'bounce':
        audio.play('bounce');
        fx.shake(0.6, 4);
        break;
      case 'points':
        audio.play('points');
        fx.popup(e.x, e.y, e.points);
        break;
      case 'smash':
        audio.play('smash');
        fx.burst(e.x, e.y, PARTICLES.smash, 14, 1.6);
        fx.popup(e.x, e.y - 6, e.points);
        fx.shake(1.5, 8);
        break;
      case 'hammer':
        audio.play('hammer');
        audio.startMusic('hammer');
        break;
      case 'hammerEnd':
        audio.startMusic('play');
        break;
      case 'ignite':
        audio.play('ignite');
        fx.drumLit = 90;
        fx.burst(e.x, e.y - 14, PARTICLES.ignite, 12, 1);
        break;
      case 'rivet':
        audio.play('rivet');
        fx.burst(e.x, e.y + 2, PARTICLES.rivet, 12, 1.4);
        fx.popup(e.x, e.y - 14, 100);
        fx.shake(1, 6);
        break;
      case 'die':
        audio.play('die');
        fx.shake(2.5, 14);
        navigator.vibrate?.(120);
        phase = 'dead';
        break;
      case 'clear':
        audio.play('clear');
        if (world.def.id === 'rivets') fx.shake(3, 40);
        phase = 'clear';
        break;
    }
  }
  if (game) awardExtra();
}

/* ---------- Loop ---------- */

let stepSoundT = 0;
function update() {
  tick++;
  fx.step();
  if (screen === 'pause') return;
  if (!game) {
    // Attract mode: the boss keeps throwing behind the title.
    world.step({});
    if (world.outcome || world.time > 3600) world = createWorld({ stage: 'ramps', round: 2, seed: (tick & 0xff) + 1, immortal: true });
    return;
  }
  if (phase === 'intro') {
    phaseT++;
    if (phaseT > 90 || (phaseT > 20 && (keys.jump || keys.left || keys.right || keys.up))) {
      phase = 'play';
      $('card').hidden = true;
      audio.startMusic('play');
    }
    updateHud();
    return;
  }
  if (screen !== 'play' && phase === 'play') return;
  world.step(phase === 'play' ? keys : {});
  handleEvents();
  const h = world.hero;
  if (h.moving && h.mode === 'walk' && ++stepSoundT % 10 === 0) audio.play('step');
  if (h.mode === 'climb' && (keys.up || keys.down) && ++stepSoundT % 12 === 0) audio.play('step');
  if (world.outcome === 'clear') stageCleared();
  else if (world.outcome === 'dead') lifeLost();
  updateHud();
}

function render() {
  renderer.draw(world, fx, tick, fx.offset());
}

const loop = createLoop({
  update,
  render,
  onPauseChange(paused) {
    if (paused) pause(true);
  },
});

/* ---------- Input ---------- */

const KEYMAP = {
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ' ': 'jump', z: 'jump', Z: 'jump', k: 'jump', K: 'jump', x: 'jump', X: 'jump',
};

addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (screen === 'play' && k) {
    keys[k] = true;
    e.preventDefault();
    return;
  }
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (screen === 'play') pause(true);
    else if (screen === 'pause') pause(false);
    else if (screen === 'help') show('title');
    e.preventDefault();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  }
});

addEventListener('keyup', (e) => {
  const k = KEYMAP[e.key];
  if (k) keys[k] = false;
});

addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  pause(true);
});

function toggleMute() {
  const muted = !audio.state.muted;
  audio.set({ muted });
  store.set('muted', muted);
  syncSoundButtons();
}

function syncSoundButtons() {
  const { muted, music } = audio.state;
  $('muteBtn').setAttribute('aria-pressed', String(muted));
  $('btnSound').textContent = `Sound: ${muted ? 'off' : 'on'}`;
  $('btnSound').setAttribute('aria-pressed', String(!muted));
  $('btnMusic').textContent = `Music: ${music ? 'on' : 'off'}`;
  $('btnMusic').setAttribute('aria-pressed', String(music));
}

$('btnPlay').addEventListener('click', newGame);
$('btnAgain').addEventListener('click', newGame);
$('btnHelp').addEventListener('click', () => show('help'));
$('helpBack').addEventListener('click', () => show('title'));
$('btnResume').addEventListener('click', () => pause(false));
$('btnQuit').addEventListener('click', quitToTitle);
$('btnOverTitle').addEventListener('click', quitToTitle);
$('pauseBtn').addEventListener('click', () => pause(true));
$('muteBtn').addEventListener('click', toggleMute);
$('btnSound').addEventListener('click', toggleMute);
$('btnMusic').addEventListener('click', () => {
  const music = !audio.state.music;
  audio.set({ music });
  store.set('music', music);
  syncSoundButtons();
});

syncSoundButtons();
refreshTitle();
show('title');
loop.start();
