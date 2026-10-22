import { initShell } from '../../assets/kit/shell.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createTouchControls, onSwipe, isTouchFirst } from '../../assets/kit/input.js';
import { Round } from './round.js';
import { View } from './view.js';
import { Synth } from './audio.js';

const SLUG = 'tron';
const DIFFICULTY_NAMES = { 1: 'Easy', 2: 'Medium', 3: 'Hard' };
const COUNTDOWN = 3; // Seconds before the cycles launch.
const CRASH_LINGER = 0.9; // Seconds to show the crash before the result panel.

const KEYS = {
  blue: { ArrowUp: 'N', ArrowRight: 'E', ArrowDown: 'S', ArrowLeft: 'W' },
  orange: { KeyW: 'N', KeyD: 'E', KeyS: 'S', KeyA: 'W' },
};
const BOOST_KEYS = {
  blue: ['Space', 'Enter', 'ShiftRight'],
  orange: ['KeyQ', 'ShiftLeft'],
};

const store = createStore(SLUG);
const settings = {
  players: 1,
  difficulty: 1,
  arena: 'large',
  layout: 'open',
  match: 1,
  ...store.get('settings', {}),
};
const record = store.get('record', { cpu: {}, pvp: { blue: 0, orange: 0 } });

const $ = (sel) => document.querySelector(sel);
const stage = $('#stage');
const canvas = $('#arena');
const panels = { menu: $('#menu'), pause: $('#pause'), result: $('#result') };
const hud = {
  root: $('.hud'),
  blueName: $('#blue-name'),
  orangeName: $('#orange-name'),
  blueScore: $('#blue-score'),
  orangeScore: $('#orange-score'),
  blueBoost: $('#blue-boost'),
  orangeBoost: $('#orange-boost'),
  mid: $('#hud-mid'),
};

const view = new View(canvas);
const synth = new Synth(store.get('muted', false));
const held = new Set();

let state = 'menu'; // menu | countdown | playing | ending | paused | result
let resumeTo = null;
let round = null;
let timer = 0; // Countdown, or crash linger, in seconds.
let goFlash = 0;
let match = { blue: 0, orange: 0, round: 0 };

initShell({ slug: SLUG });

const controls = createTouchControls({
  dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  buttons: [
    { label: 'Boost', key: ' ' },
  ],
});
controls.hide();

// ---------- Menu ----------

function renderOptions() {
  document.querySelectorAll('[data-opt]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(String(settings[btn.dataset.opt]) === btn.dataset.value));
  });
  $('#difficulty-opt').setAttribute('aria-disabled', String(settings.players === 2));

  const r = record.cpu[settings.difficulty];
  $('#record').textContent =
    settings.players === 2
      ? `2-player tally: Blue ${record.pvp.blue} · Orange ${record.pvp.orange}`
      : r
        ? `Vs ${DIFFICULTY_NAMES[settings.difficulty]} computer: ${r.w} W · ${r.l} L · ${r.d} D · best streak ${r.best}`
        : `No rounds played against the ${DIFFICULTY_NAMES[settings.difficulty]} computer yet.`;
}

document.querySelectorAll('[data-opt]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const { opt, value } = btn.dataset;
    settings[opt] = /^\d+$/.test(value) ? Number(value) : value;
    store.set('settings', settings);
    renderOptions();
    newRound();
  });
});

function showPanel(name) {
  for (const [key, el] of Object.entries(panels)) el.hidden = key !== name;
}

function setLive(live) {
  document.body.classList.toggle('live', live);
  if (live && isTouchFirst()) controls.show();
  else controls.hide();
}

function toMenu() {
  state = 'menu';
  setLive(false);
  hud.root.hidden = true;
  $('#pause-btn').hidden = true;
  renderOptions();
  showPanel('menu');
  newRound();
}

// ---------- Rounds ----------

// A fresh board for the current settings; in the menu it doubles as a preview.
function stageIsPortrait() {
  const box = stage.getBoundingClientRect();
  return box.width < box.height * 0.95;
}

function newRound() {
  round = new Round({
    arena: settings.arena,
    layout: settings.layout,
    portrait: stageIsPortrait(),
    players: settings.players,
    difficulty: settings.difficulty,
  });
  view.setRound(round);
  fitArena();
}

function startMatch() {
  synth.unlock();
  match = { blue: 0, orange: 0, round: 0 };
  const cpu = settings.players === 1;
  hud.blueName.textContent = cpu ? 'You' : 'P1';
  hud.orangeName.textContent = cpu ? 'CPU' : 'P2';
  hud.root.hidden = false;
  $('#pause-btn').hidden = false;
  startRound();
}

function startRound() {
  synth.unlock();
  synth.startMusic();
  match.round++;
  showPanel(null);
  setLive(true);
  newRound();
  held.clear();
  state = 'countdown';
  timer = COUNTDOWN;
  synth.beep(false);
  updateHud();
}

function finishRound() {
  const { result } = round;
  if (result !== 'draw') match[result]++;
  const target = Math.ceil(settings.match / 2);
  const matchOver = match.blue >= target || match.orange >= target;
  const cpu = settings.players === 1;

  if (cpu) {
    const r = (record.cpu[settings.difficulty] ??= { w: 0, l: 0, d: 0, streak: 0, best: 0 });
    if (result === 'blue') {
      r.w++;
      r.streak++;
      r.best = Math.max(r.best, r.streak);
      const name = DIFFICULTY_NAMES[settings.difficulty];
      recordBest(SLUG, r.streak, {
        mode: `streak-${name.toLowerCase()}`,
        label: `${r.streak} win${r.streak === 1 ? '' : 's'} in a row (${name})`,
      });
    } else if (result === 'orange') {
      r.l++;
      r.streak = 0;
    } else {
      r.d++;
    }
  } else if (result !== 'draw') {
    record.pvp[result]++;
  }
  store.set('record', record);

  const names = cpu ? { blue: 'You', orange: 'Computer' } : { blue: 'Player 1', orange: 'Player 2' };
  const title =
    result === 'draw' ? 'Draw!' : result === 'blue' && cpu ? 'You win!' : `${names[result]} wins!`;
  let detail = result === 'draw' ? 'Both cycles crashed at the same moment.' : '';
  if (settings.match > 1) {
    const score = `${match.blue}–${match.orange}`;
    if (matchOver) {
      const winner = match.blue > match.orange ? 'blue' : 'orange';
      detail = cpu
        ? winner === 'blue'
          ? `You take the match ${score}.`
          : `The computer takes the match ${score}.`
        : `${names[winner]} takes the match ${score}.`;
    } else {
      detail = `${detail} Match score ${score}, first to ${target}.`.trim();
    }
  }

  const title$ = $('#result-title');
  title$.textContent = title;
  title$.className = result === 'blue' ? 'c-blue' : result === 'orange' ? 'c-orange' : '';
  $('#result-detail').textContent = detail;
  $('#next').textContent = settings.match > 1 && !matchOver ? 'NEXT ROUND' : 'PLAY AGAIN';
  $('#next').dataset.newMatch = String(settings.match === 1 || matchOver);

  state = 'result';
  setLive(false);
  updateHud();
  showPanel('result');
}

function updateHud() {
  hud.blueScore.textContent = match.blue;
  hud.orangeScore.textContent = match.orange;
  hud.mid.textContent =
    settings.match > 1 ? `Round ${match.round} · first to ${Math.ceil(settings.match / 2)}` : 'Single round';
}

function pause() {
  if (state !== 'countdown' && state !== 'playing') return;
  resumeTo = state;
  state = 'paused';
  held.clear();
  synth.suspend();
  showPanel('pause');
}

function resume() {
  if (state !== 'paused') return;
  state = resumeTo;
  synth.resume();
  showPanel(null);
}

// ---------- Loop ----------

function update(dt) {
  if (state === 'countdown') {
    const before = Math.ceil(timer);
    timer -= dt;
    if (timer <= 0) {
      state = 'playing';
      goFlash = 0.6;
      synth.beep(true);
    } else if (Math.ceil(timer) !== before) {
      synth.beep(false);
    }
    return;
  }
  if (state === 'playing') {
    goFlash = Math.max(0, goFlash - dt);
    const blueBoost = BOOST_KEYS.blue.some((k) => held.has(k));
    const orangeBoost = BOOST_KEYS.orange.some((k) => held.has(k));
    const wasBoosting = round.blue.boosting || (settings.players === 2 && round.orange.boosting);
    if (settings.players === 2) {
      round.blue.boostHeld = blueBoost;
      round.orange.boostHeld = orangeBoost;
    } else {
      round.blue.boostHeld = blueBoost || orangeBoost;
    }
    round.update(dt);
    const isBoosting = round.blue.boosting || (settings.players === 2 && round.orange.boosting);
    if (isBoosting && !wasBoosting) synth.boost();
    if (round.over) {
      synth.crash();
      state = 'ending';
      timer = CRASH_LINGER;
    }
    return;
  }
  if (state === 'ending') {
    timer -= dt;
    if (timer <= 0) finishRound();
  }
}

function render() {
  if (!round) return;
  let text = '';
  if (state === 'countdown' || (state === 'paused' && resumeTo === 'countdown')) text = String(Math.ceil(timer));
  else if (state === 'playing' && goFlash > 0) text = 'GO';
  const intro = state === 'menu' || state === 'countdown' || (state === 'paused' && resumeTo === 'countdown');
  view.draw(performance.now(), text, intro);
  hud.blueBoost.style.transform = `scaleX(${round.blue.energy})`;
  hud.orangeBoost.style.transform = `scaleX(${round.orange.energy})`;
}

const loop = createLoop({ update, render });

function fitArena() {
  const style = getComputedStyle(stage);
  const w = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 6;
  const h = stage.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 6;
  view.fit(w, h);
}

// In the menu the preview follows the screen's orientation; mid-round the board keeps its shape.
new ResizeObserver(() => {
  if (state === 'menu' && round.board.portrait !== stageIsPortrait()) newRound();
  else fitArena();
}).observe(stage);

// ---------- Input ----------

function steer(dir, who = 'blue') {
  if (state !== 'countdown' && state !== 'playing') return;
  round[who].queueTurn(dir);
}

window.addEventListener('keydown', (e) => {
  const code = e.code || e.key;
  if (code === 'KeyP' || code === 'Escape') {
    if (state === 'paused') resume();
    else pause();
    e.preventDefault();
    return;
  }
  if (state === 'countdown' || state === 'playing') {
    if (KEYS.blue[code]) steer(KEYS.blue[code]);
    else if (KEYS.orange[code]) steer(KEYS.orange[code], settings.players === 2 ? 'orange' : 'blue');
    held.add(code);
    if (KEYS.blue[code] || code === 'Space' || code === 'Enter') e.preventDefault();
    return;
  }
  if ((code === 'Enter' || code === 'Space') && !e.repeat && document.activeElement === document.body) {
    const primary = panels[state]?.querySelector('.big-btn');
    if (primary) {
      e.preventDefault();
      primary.click();
    }
  }
});

window.addEventListener('keyup', (e) => held.delete(e.code || e.key));
window.addEventListener('blur', () => held.clear());

// Hiding the tab pauses a round and silences the music until you come back.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pause();
    synth.suspend();
  } else if (state !== 'paused') {
    synth.resume();
  }
});

onSwipe(stage, (dir) => steer({ up: 'N', right: 'E', down: 'S', left: 'W' }[dir]), { preventScroll: false });

$('#start').addEventListener('click', startMatch);
$('#resume').addEventListener('click', resume);
$('#pause-btn').addEventListener('click', () => (state === 'paused' ? resume() : pause()));
$('#next').addEventListener('click', (e) => {
  if (e.currentTarget.dataset.newMatch === 'true') startMatch();
  else startRound();
});
document.querySelectorAll('[data-action="menu"]').forEach((btn) => btn.addEventListener('click', toMenu));

const muteBtn = $('#mute-btn');
function renderMute() {
  muteBtn.setAttribute('aria-pressed', String(synth.muted));
  muteBtn.setAttribute('aria-label', synth.muted ? 'Unmute music' : 'Mute music');
}
muteBtn.addEventListener('click', () => {
  synth.unlock();
  synth.setMuted(!synth.muted);
  store.set('muted', synth.muted);
  renderMute();
  muteBtn.blur();
});

renderMute();
toMenu();
loop.start();
