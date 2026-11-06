/**
 * Volt Flip for Game Lab: screens, input, layout and the fixed-step loop.
 * The rules live in sim.js and course.js; this file wires them to the page.
 */
import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { SCORE, STEPS_PER_SECOND, WORLD } from './config.js';
import { createWorld, metres, step } from './sim.js';
import { botWantsFlip } from './bot.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';

const SLUG = 'volt-flip';
initShell({ slug: SLUG });
const store = createStore(SLUG);
const audio = createAudio(store);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');
const hud = $('#hud');
const canvas = $('#view');
const renderer = createRenderer(canvas);

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const applyMotion = () => renderer.setReduced(motionQuery.matches);
motionQuery.addEventListener?.('change', applyMotion);
applyMotion();

/* ---------------------------------------------------------------- state */

let screen = 'title'; // title | help | playing | paused | dying | over
let world = null; // the player's run
let demo = null; // the autopilot run behind the title
let demoRestart = 0;
let wantFlip = false;
let countdown = 0;
let dyingFor = 0;
let overAt = 0;
let prev = { dist: 0, y: 0 };
let best = readBest();

function readBest() {
  const b = store.get('best', null);
  return b && typeof b.score === 'number' ? b : { score: 0, metres: 0 };
}

const randomSeed = () => (Math.random() * 2 ** 32) >>> 0;

function newDemo() {
  demo = createWorld({ seed: randomSeed() });
  demoRestart = 0;
  prev = { dist: demo.dist, y: demo.p.y };
}

/* --------------------------------------------------------------- screens */

const screens = new Map($$('[data-screen]').map((el) => [el.dataset.screen, el]));

function show(name) {
  screen = name;
  for (const [key, el] of screens) el.hidden = key !== name;
  const card = screens.get(name);
  if (card) {
    const focus = $('.btn--primary', card) || $('.btn', card);
    // Don't pop the phone keyboard focus ring on touch; keyboard users get focus.
    if (focus && !matchMedia('(pointer: coarse)').matches) focus.focus({ preventScroll: true });
  }
  app.classList.toggle('is-title', name === 'title' || name === 'help');
  hud.querySelector('#btn-pause').hidden = !(name === 'playing' || name === 'paused');
  updateHint();
}

function updateTitle() {
  $('#title-best').textContent = best.score.toLocaleString('en-US');
  $('#title-far').textContent = `${best.metres.toLocaleString('en-US')} m`;
}

function start() {
  audio.unlock();
  audio.play('start');
  world = createWorld({ seed: randomSeed() });
  prev = { dist: world.dist, y: world.p.y };
  renderer.reset();
  wantFlip = false;
  countdown = 0;
  show('playing');
}

function pause(reason = '') {
  if (screen !== 'playing') return;
  wantFlip = false;
  $('#pause-sub').textContent = reason;
  show('paused');
}

function resume() {
  if (screen !== 'paused') return;
  show('playing');
  countdown = 0.9; // three short beats so the first obstacle isn't a surprise
  audio.play('tick');
}

function quit() {
  world = null;
  prev = { dist: demo.dist, y: demo.p.y };
  updateTitle();
  show('title');
}

const CAUSES = {
  spike: 'Caught on spikes',
  pylon: 'Ran into a pylon',
  drone: 'Clipped by a drone',
  shutter: 'Cut by a shutter',
  void: 'Fell through a hole',
  edge: 'Fell into a hole',
};

function finish() {
  const score = Math.floor(world.score);
  const far = metres(world);
  const isNew = score > best.score;
  if (isNew || far > best.metres) {
    best = { score: Math.max(score, best.score), metres: Math.max(far, best.metres) };
    store.set('best', best);
  }
  store.set('runs', store.get('runs', 0) + 1);
  recordBest(SLUG, score, { label: `${score.toLocaleString('en-US')} pts` });
  recordBest(SLUG, far, { mode: 'distance', label: `${far.toLocaleString('en-US')} m` });

  $('#over-h').textContent = CAUSES[world.cause] || 'Signal lost';
  $('#res-score').textContent = score.toLocaleString('en-US');
  $('#res-dist').textContent = `${far.toLocaleString('en-US')} m`;
  $('#res-shards').textContent = String(world.shards);
  $('#res-mult').textContent = `×${world.bestMult}`;
  $('#new-best').hidden = !(isNew && score > 0);
  $('#res-best').textContent = `Best ${best.score.toLocaleString('en-US')} · furthest ${best.metres.toLocaleString('en-US')} m`;
  $('#announce').textContent = `Run over. ${CAUSES[world.cause] || ''}. Score ${score}, ${far} metres.`;
  if (isNew && score > 0) audio.play('best');
  overAt = performance.now();
  show('over');
}

/* ------------------------------------------------------------------ hint */

let flippedOnce = store.get('flipped', false);
if (matchMedia('(pointer: coarse)').matches) $('#hint').innerHTML = '<kbd>Tap</kbd> anywhere to flip gravity';
function updateHint() {
  const el = $('#hint');
  const showIt = screen === 'playing' && world && (!flippedOnce || world.t < 2.2) && world.flips === 0;
  if (el.hidden === !showIt) return;
  el.hidden = !showIt;
}

/* ----------------------------------------------------------------- input */

function press() {
  audio.unlock();
  switch (screen) {
    case 'title':
      start();
      break;
    case 'playing':
      if (countdown <= 0) wantFlip = true;
      break;
    case 'paused':
      resume();
      break;
    case 'over':
      if (performance.now() - overAt > 550) start();
      break;
  }
}

app.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  if (e.target.closest('button, a, .card')) return;
  e.preventDefault();
  press();
});

// A long press shouldn't open a context menu or select anything on phones.
app.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.card')) e.preventDefault();
});

const FLIP_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter', 'NumpadEnter']);

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const code = e.code;
  if (code === 'KeyM') {
    toggleMute();
    return;
  }
  if (code === 'KeyP' || code === 'Escape') {
    e.preventDefault();
    if (screen === 'playing') pause();
    else if (screen === 'paused' && code === 'KeyP') resume();
    else if (screen === 'paused' || screen === 'over') quit();
    else if (screen === 'help') show('title');
    return;
  }
  if (!FLIP_KEYS.has(code)) return;
  const onButton = document.activeElement?.closest?.('button');
  if (screen !== 'playing' && onButton && (code === 'Space' || code === 'Enter')) return; // let the button click
  e.preventDefault();
  if (e.repeat) return;
  if (screen === 'help') return;
  press();
});

for (const btn of $$('[data-action]')) {
  btn.addEventListener('click', () => {
    audio.unlock();
    audio.play('ui');
    const a = btn.dataset.action;
    if (a === 'start' || a === 'restart') start();
    else if (a === 'help') show('help');
    else if (a === 'back') show('title');
    else if (a === 'resume') resume();
    else if (a === 'quit') quit();
  });
}

const muteBtn = $('#btn-mute');
function syncMute() {
  muteBtn.setAttribute('aria-pressed', String(audio.muted));
  muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute sound (M)' : 'Mute sound (M)');
}
function toggleMute() {
  audio.unlock();
  audio.setMuted(!audio.muted);
  syncMute();
}
muteBtn.addEventListener('click', toggleMute);
syncMute();

$('#btn-pause').addEventListener('click', () => (screen === 'playing' ? pause() : resume()));

// Leaving the tab or window pauses the run (the loop itself also stops while hidden).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause('Paused while the tab was hidden.');
});
window.addEventListener('blur', () => pause());

/* ---------------------------------------------------------------- layout */

// env(safe-area-inset-bottom) is only readable through an element that uses it.
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
document.body.append(safeProbe);

let view = { scale: 1, top: 0 };
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hudBottom = hud.getBoundingClientRect().bottom;
  const safeB = safeProbe.getBoundingClientRect().height;
  const top = hudBottom + 4;
  const bottom = vh - Math.max(10, safeB) - (vh > vw ? 56 : 14);
  const availH = Math.max(120, bottom - top);
  const scale = Math.min(availH / WORLD.viewHeight, vw / WORLD.viewMinWidth);
  const corridor = WORLD.height * scale;
  // Centre the corridor in the free space, a touch high on tall screens so the hint sits below it.
  const y = top + (availH - corridor) / 2;
  view = { scale, top: Math.round(y) };
  renderer.resize(vw, vh, view);
  // The hint goes under the floor rail when there is room, otherwise mid-corridor.
  const hint = $('#hint');
  const below = y + (WORLD.height + 22) * scale;
  if (vh - below - safeB > 70) {
    hint.style.top = `${Math.round(below + 18)}px`;
    hint.style.bottom = 'auto';
  } else {
    hint.style.top = `${Math.round(y + corridor * 0.5 - 18)}px`;
    hint.style.bottom = 'auto';
  }
}

let layoutQueued = false;
function queueLayout() {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    layout();
  });
}
window.addEventListener('resize', queueLayout);
window.visualViewport?.addEventListener('resize', queueLayout);
matchMedia('(orientation: portrait)').addEventListener?.('change', queueLayout);

/* ------------------------------------------------------------------- HUD */

const hudEls = {
  score: $('#score'),
  mult: $('#mult'),
  multBox: $('#mult-box'),
  pips: $('#pips'),
  dist: $('#dist'),
  best: $('#best'),
};
hudEls.pips.innerHTML = '<i></i>'.repeat(SCORE.chainPerLevel);
const pipEls = [...hudEls.pips.children];
const shown = {};
function setText(key, value) {
  if (shown[key] === value) return;
  shown[key] = value;
  hudEls[key].textContent = value;
}

function updateHud(w) {
  const live = w || { score: 0, mult: 1, chain: 0, dist: 0 };
  setText('score', Math.floor(live.score).toLocaleString('en-US'));
  setText('mult', `×${live.mult}`);
  setText('dist', Math.floor(live.dist / 10).toLocaleString('en-US'));
  setText('best', best.score.toLocaleString('en-US'));
  if (shown.level !== live.mult) {
    shown.level = live.mult;
    hudEls.multBox.dataset.level = String(live.mult);
  }
  const chain = live.mult >= SCORE.maxMultiplier ? SCORE.chainPerLevel : live.chain;
  if (shown.chain !== chain) {
    shown.chain = chain;
    pipEls.forEach((p, i) => p.classList.toggle('on', i < chain));
  }
}

/* ------------------------------------------------------------------ loop */

function handleEvents(w, sound) {
  for (const e of w.events) {
    renderer.onEvent(e, w);
    if (!sound) continue;
    switch (e.type) {
      case 'flip':
        audio.play('flip', e.g);
        if (!flippedOnce) {
          flippedOnce = true;
          store.set('flipped', true);
        }
        break;
      case 'land':
        audio.play('land');
        break;
      case 'shard':
        audio.play('shard', e.chain);
        break;
      case 'graze':
        audio.play('graze');
        break;
      case 'mult':
        audio.play('mult', e.mult);
        break;
      case 'miss':
        audio.play('miss');
        break;
      case 'shield':
        audio.play('shield');
        break;
      case 'shieldBreak':
        audio.play('shieldBreak');
        break;
      case 'magnet':
        audio.play('magnet');
        break;
      case 'milestone':
        audio.play('milestone');
        break;
      case 'die':
        audio.play('die');
        try {
          if (matchMedia('(pointer: coarse)').matches) navigator.vibrate?.(40);
        } catch {}
        break;
    }
  }
}

function update(dt) {
  if (screen === 'playing' && world) {
    if (countdown > 0) {
      const before = Math.ceil(countdown / 0.3);
      countdown -= dt;
      if (countdown > 0 && Math.ceil(countdown / 0.3) !== before) audio.play('tick');
      return;
    }
    prev.dist = world.dist;
    prev.y = world.p.y;
    step(world, wantFlip);
    wantFlip = false;
    handleEvents(world, true);
    if (world.over) {
      dyingFor = 0;
      screen = 'dying';
      $('#btn-pause').hidden = true;
    }
    return;
  }
  if (screen === 'dying') {
    dyingFor += dt;
    if (dyingFor > 0.85) finish();
    return;
  }
  if ((screen === 'title' || screen === 'help') && demo) {
    if (demo.over) {
      demoRestart += dt;
      if (demoRestart > 1.2) newDemo();
      return;
    }
    prev.dist = demo.dist;
    prev.y = demo.p.y;
    step(demo, botWantsFlip(demo, { horizon: 1 }));
    handleEvents(demo, false);
  }
}

let lastFrame = performance.now();
function render(alpha) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  const showing = screen === 'title' || screen === 'help' ? demo : world || demo;
  if (!showing) return;
  const moving = showing === demo ? screen === 'title' || screen === 'help' : screen === 'playing' && countdown <= 0;
  const a = moving ? alpha : 1;
  const dist = prev.dist + (showing.dist - prev.dist) * a;
  const y = prev.y + (showing.p.y - prev.y) * a;
  renderer.draw(showing, dist, y, screen === 'paused' ? 0 : dt, { dim: showing === demo ? 0.25 : 0 });
  updateHud(showing === demo ? null : showing);
  if (screen === 'playing') updateHint();
  const cd = $('#countdown');
  if (screen === 'playing' && countdown > 0) {
    cd.hidden = false;
    const n = String(Math.ceil(countdown / 0.3));
    if (cd.textContent !== n) cd.textContent = n;
  } else if (!cd.hidden) cd.hidden = true;
}

/* ------------------------------------------------------------------ boot */

newDemo();
prev = { dist: demo.dist, y: demo.p.y };
updateTitle();
layout();
show('title');
document.fonts?.ready?.then(queueLayout);

const loop = createLoop({ update, render, stepsPerSecond: STEPS_PER_SECOND });
loop.start();

// For automated checks: the current screen and run, read only.
window.voltFlip = {
  get screen() {
    return screen;
  },
  get world() {
    return world;
  },
};
