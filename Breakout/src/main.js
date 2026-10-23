import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest, readBests } from '../../assets/kit/storage.js';
import { CONFIG, levelSpeed } from './config.js';
import { LEVELS, ACTS, generateLevel, mulberry32 } from './levels.js';
import { createWorld } from './sim.js';
import { createBot } from './bot.js';
import { createRenderer, drawBrick, drawCapsule, drawPowerupIcon, POWERUP_STYLE } from './render.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';

const SLUG = 'breakout';
const F = CONFIG.field;
const $ = (id) => document.getElementById(id);

initShell({ slug: SLUG });
const store = createStore(SLUG);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

/* ---------- Persistent state ---------- */

const settings = {
  muted: store.get('muted', false),
  shake: store.get('shake', reducedMotion ? 'low' : 'full'),
};
/** progress.levels[i] = { stars, best } for cleared levels. */
const progress = store.get('progress', { levels: {} });

const audio = createAudio({ muted: settings.muted });
const fx = createFx({ reducedMotion });
fx.shakeScale = CONFIG.fx.shake[settings.shake] ?? 1;

const canvas = $('game');
const renderer = createRenderer(canvas);

/* ---------- Session state ---------- */

let screen = 'title'; // title | levels | help | play | pause | result
let mode = 'demo'; // demo | campaign | endless
let world = null;
let bot = null;
let levelIndex = 0;
let stage = 1;
let endlessSeed = 1;
let run = { startScore: 0, startLives: CONFIG.lives.start }; // state on entering the current level
let carry = null; // state to take into the next level after a clear
let endTimer = 0;
let time = 0;
let layout = { x: 0, y: 0, scale: 1, vw: innerWidth, vh: innerHeight, dpr: 1, side: false };
const keys = { left: false, right: false };
let pointerTarget = null;
let launchQueued = false;
let drag = null;

/* ---------- Layout ---------- */

function computeLayout() {
  const vw = document.documentElement.clientWidth || innerWidth;
  const vh = window.visualViewport?.height ?? innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const pad = 8;
  const hudTopH = 96;
  const sideW = 176;
  const topScale = Math.min((vw - pad * 2 - 12) / F.w, (vh - hudTopH - pad * 2 - 6) / F.h);
  const sideScale = Math.min((vw - (sideW + 24) * 2) / F.w, (vh - pad * 2 - 12) / F.h);
  const side = sideScale > topScale;
  const scale = Math.max(0.2, side ? sideScale : topScale);
  const w = F.w * scale;
  const h = F.h * scale;
  let x;
  let y;
  if (side) {
    x = (vw - w) / 2;
    y = (vh - h) / 2;
  } else {
    x = (vw - w) / 2;
    const block = hudTopH + h;
    y = Math.max(pad, (vh - block) / 2) + hudTopH;
  }
  layout = { x, y, w, h, scale, vw, vh, dpr, side };
  renderer.resize(layout);
  placeHud();
}

function placeHud() {
  const hud = $('hud');
  const top = hud.querySelector('.hud-row--top');
  hud.classList.toggle('is-side', layout.side);
  if (layout.side) {
    const width = 168;
    hud.style.left = `${Math.max(8, layout.x - width - 22)}px`;
    hud.style.top = `${layout.y}px`;
    hud.style.width = `${width}px`;
    top.style.paddingLeft = '0px';
  } else {
    hud.style.left = `${layout.x}px`;
    hud.style.top = `${layout.y - 96}px`;
    hud.style.width = `${layout.w}px`;
    top.style.paddingLeft = '0px';
  }
  const msg = $('fieldMsg');
  msg.style.left = `${layout.x}px`;
  msg.style.width = `${layout.w}px`;
  msg.style.top = `${layout.y + layout.h * 0.42}px`;
  msg.style.height = `${layout.h * 0.44}px`;
  const toast = $('toast');
  toast.style.left = `${layout.x + layout.w / 2}px`;
  toast.style.top = `${layout.y + layout.h * 0.36}px`;
}

const toWorldX = (clientX) => (clientX - layout.x) / layout.scale;

/* ---------- Screens ---------- */

const SCREENS = { title: 'screenTitle', levels: 'screenLevels', help: 'screenHelp', pause: 'screenPause', result: 'screenResult' };

function show(name, focusId) {
  screen = name;
  for (const [key, id] of Object.entries(SCREENS)) $(id).hidden = key !== name;
  placeHud();
  const playing = name === 'play' || name === 'pause' || name === 'result';
  $('hud').hidden = !(playing && mode !== 'demo');
  document.body.classList.toggle('is-playing', name === 'play');
  if (name === 'play') {
    document.activeElement?.blur?.();
  } else {
    const target = (focusId && $(focusId)) || $(SCREENS[name])?.querySelector('button:not(:disabled)');
    target?.focus({ preventScroll: true });
  }
  updateFieldMsg();
}

function stars(n, total = 3) {
  const path = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z';
  let s = '';
  for (let i = 0; i < total; i++) s += `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="${i < n ? 'on' : 'off'}" d="${path}"/></svg>`;
  return s;
}

const fmt = (n) => Math.round(n).toLocaleString('en-US');

function unlockedCount() {
  let n = 1;
  for (let i = 0; i < LEVELS.length; i++) if (progress.levels[i]) n = Math.max(n, i + 2);
  return Math.min(LEVELS.length, n);
}

function nextLevelToPlay() {
  const open = unlockedCount();
  for (let i = 0; i < open; i++) if (!progress.levels[i]) return i;
  return open - 1;
}

function refreshTitle() {
  const next = nextLevelToPlay();
  $('btnContinue').textContent = progress.levels[0] ? `Play · Level ${next + 1}` : 'Play';
  const bests = readBests(SLUG);
  const bits = [];
  if (bests.default) bits.push(`Best ${fmt(bests.default.value)}`);
  if (bests.furthest) bits.push(bests.furthest.label);
  if (bests.endless) bits.push(`Endless ${fmt(bests.endless.value)}`);
  $('titleBest').textContent = bits.join(' · ');
}

function buildLevelGrid() {
  const grid = $('levelGrid');
  grid.innerHTML = '';
  const open = unlockedCount();
  let totalStars = 0;
  ACTS.forEach((act, a) => {
    const h = document.createElement('h3');
    h.className = 'act-title';
    h.innerHTML = `<b>${['I', 'II', 'III'][a]}</b> ${act}`;
    grid.append(h);
    LEVELS.forEach((level, i) => {
      if (level.act !== a) return;
      const p = progress.levels[i];
      totalStars += p?.stars ?? 0;
      const locked = i >= open;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'level-card' + (p ? ' is-cleared' : '');
      btn.disabled = locked;
      btn.dataset.level = i;
      btn.innerHTML = `<span class="level-card__num">${String(i + 1).padStart(2, '0')}</span>
        <span class="level-card__name">${level.name}</span>
        <span class="stars">${stars(p?.stars ?? 0)}</span>
        <span class="level-card__best">${locked ? 'Locked' : p ? `Best ${fmt(p.best)}` : 'Not cleared'}</span>`;
      btn.setAttribute(
        'aria-label',
        `Level ${i + 1}, ${level.name}. ${locked ? 'Locked' : p ? `${p.stars} of 3 stars, best ${fmt(p.best)}` : 'Not cleared yet'}`,
      );
      btn.addEventListener('click', () => {
        audio.play('ui');
        startCampaign(i, true);
      });
      grid.append(btn);
    });
  });
  $('levelsSummary').textContent = `${totalStars} / ${LEVELS.length * 3} stars`;
}

function openLevels() {
  buildLevelGrid();
  show('levels');
  const target = $('levelGrid').querySelector(`[data-level="${nextLevelToPlay()}"]`);
  target?.focus({ preventScroll: false });
}

function buildLegend() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const mk = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w * dpr;
    c.height = h * dpr;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    draw(ctx);
    return c;
  };
  const bricks = [
    [{ kind: 'normal', color: 2, hp: 1, maxHp: 1 }, 'Tile: one hit'],
    [{ kind: 'tough2', hp: 2, maxHp: 2 }, 'Plate: two hits'],
    [{ kind: 'tough3', hp: 3, maxHp: 3 }, 'Armour: three hits'],
    [{ kind: 'steel', hp: 1, maxHp: 1 }, 'Steel: never breaks'],
    [{ kind: 'bomb', hp: 1, maxHp: 1 }, 'Charge: clears its neighbours'],
    [{ kind: 'normal', color: 4, hp: 1, maxHp: 1, drop: true }, 'Marked: always drops a power-up'],
  ];
  const lb = $('legendBricks');
  for (const [b, text] of bricks) {
    const row = document.createElement('div');
    row.append(mk(40, 20, (ctx) => drawBrick(ctx, b, 1, 1, 38, 18, 0)), document.createTextNode(text));
    lb.append(row);
  }
  const lp = $('legendPowerups');
  const what = {
    wide: 'Wide paddle',
    multi: 'Multi-ball: two extra balls',
    slow: 'Slow ball',
    laser: 'Laser: paddle fires on its own',
    catch: 'Catch: ball sticks, tap to release',
    life: 'Extra life',
  };
  for (const type of Object.keys(what)) {
    const row = document.createElement('div');
    row.append(mk(40, 20, (ctx) => drawCapsule(ctx, type, 20, 10, 36, 16, 0)), document.createTextNode(what[type]));
    lp.append(row);
  }
}

/* ---------- HUD ---------- */

const hudCache = {};
function setText(id, text) {
  if (hudCache[id] === text) return;
  hudCache[id] = text;
  $(id).textContent = text;
}

let multBumpTimer = 0;
function updateHud(dt) {
  if (!world || mode === 'demo') return;
  setText('hudScore', fmt(world.score));
  const mult = world.multiplier();
  const multEl = $('hudMult');
  if (hudCache.mult !== mult) {
    if (mult > (hudCache.mult ?? 1)) {
      multEl.classList.add('is-bump');
      multBumpTimer = 0.15;
    }
    hudCache.mult = mult;
    multEl.firstElementChild.textContent = `×${mult}`;
    multEl.classList.toggle('is-hot', mult > 1);
    multEl.setAttribute('aria-label', `Combo multiplier ${mult}`);
  }
  if (multBumpTimer > 0) {
    multBumpTimer -= dt;
    if (multBumpTimer <= 0) multEl.classList.remove('is-bump');
  }
  const livesKey = `${world.lives}`;
  if (hudCache.lives !== livesKey) {
    hudCache.lives = livesKey;
    const el = $('hudLives');
    el.innerHTML = '';
    const slots = Math.max(CONFIG.lives.start, world.lives);
    for (let i = 0; i < slots; i++) {
      const pip = document.createElement('i');
      if (i >= world.lives) pip.className = 'is-gone';
      el.append(pip);
    }
    el.setAttribute('aria-label', `${world.lives} lives`);
  }
  const active = Object.keys(world.effects).filter((k) => world.effects[k] > 0);
  const key = active.join(',');
  const fxEl = $('hudEffects');
  if (hudCache.effects !== key) {
    hudCache.effects = key;
    fxEl.innerHTML = '';
    for (const type of active) {
      const chip = document.createElement('span');
      chip.className = 'fx-chip';
      chip.dataset.type = type;
      chip.style.setProperty('--chip', POWERUP_STYLE[type].color);
      const c = document.createElement('canvas');
      const dpr = layout.dpr;
      c.width = 26 * dpr;
      c.height = 12 * dpr;
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      drawCapsule(ctx, type, 13, 6, 26, 12, 0);
      chip.append(c, document.createTextNode(POWERUP_STYLE[type].label), document.createElement('b'));
      fxEl.append(chip);
    }
  }
  for (const chip of fxEl.children) {
    const type = chip.dataset.type;
    const frac = world.effects[type] / CONFIG.powerups.duration[type];
    chip.lastElementChild.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  }
}

function resetHudCache() {
  for (const k of Object.keys(hudCache)) delete hudCache[k];
}

function setLevelLabel() {
  if (mode === 'endless') {
    setText('hudLevel', `S${String(stage).padStart(2, '0')}`);
    setText('hudName', 'Endless');
  } else {
    setText('hudLevel', `L${String(levelIndex + 1).padStart(2, '0')}`);
    setText('hudName', LEVELS[levelIndex].name);
  }
}

let introShown = false;
function updateFieldMsg() {
  const el = $('fieldMsg');
  const serving = screen === 'play' && world && world.state === 'serve' && mode !== 'demo';
  el.hidden = !serving;
  if (!serving) return;
  const launchHint = coarse ? 'Tap to launch' : 'Click or press Space to launch';
  const first = !introShown;
  const kicker = mode === 'endless' ? `Endless · stage ${stage}` : `Level ${levelIndex + 1} · ${ACTS[LEVELS[levelIndex].act]}`;
  const title = mode === 'endless' ? `Stage ${stage}` : LEVELS[levelIndex].name;
  const tip = first && mode === 'campaign' ? LEVELS[levelIndex].tip : `${world.lives} ${world.lives === 1 ? 'ball' : 'balls'} left`;
  setText('msgKicker', kicker);
  setText('msgTitle', title);
  setText('msgTip', tip);
  setText('msgHint', launchHint);
}

let toastTimer = 0;
function toast(text, seconds = 1.4) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('is-on');
  toastTimer = seconds;
}

/* ---------- Game flow ---------- */

function newWorld(map, speed, lives, score) {
  world = createWorld({ map, speed, lives, score, rng: Math.random });
  fx.clear();
  resetHudCache();
  introShown = false;
  endTimer = 0;
}

function startCampaign(index, fresh) {
  mode = 'campaign';
  levelIndex = index;
  if (fresh) run = { startScore: 0, startLives: CONFIG.lives.start };
  newWorld(LEVELS[index].map, levelSpeed(index + 1), run.startLives, run.startScore);
  store.set('lastLevel', index);
  setLevelLabel();
  show('play');
  loop.resume();
}

function startEndless(fresh = true) {
  mode = 'endless';
  if (fresh) {
    stage = 1;
    endlessSeed = (Date.now() % 100000) + 1;
    run = { startScore: 0, startLives: CONFIG.lives.start };
  }
  const lvl = generateLevel(stage, endlessSeed);
  newWorld(lvl.map, CONFIG.endless.speedStart + CONFIG.endless.speedPerStage * (stage - 1), run.startLives, run.startScore);
  setLevelLabel();
  show('play');
  loop.resume();
}

function startDemo() {
  mode = 'demo';
  const pick = Math.floor(Math.random() * 10);
  world = createWorld({ map: LEVELS[pick].map, speed: levelSpeed(pick + 1), lives: 99, rng: Math.random });
  bot = createBot(world, mulberry32(Date.now() % 9999), 'perfect');
  fx.clear();
}

function goTitle() {
  if (mode !== 'demo') startDemo();
  refreshTitle();
  show('title');
  loop.resume();
}

function finishLevel() {
  const S = CONFIG.scoring;
  const bricksScore = world.score - run.startScore;
  const flawless = world.livesLost === 0;
  const bonus = S.clearBonus + (flawless ? S.flawlessBonus : 0) + S.lifeBonus * world.lives;
  world.score += bonus;
  const levelScore = world.score - run.startScore;
  if (mode === 'endless') {
    stage++;
    let extra = '';
    if ((stage - 1) % CONFIG.endless.lifeEvery === 0 && world.lives < CONFIG.lives.max) {
      world.lives++;
      extra = ' · +1 ball';
    }
    run = { startScore: world.score, startLives: world.lives };
    toast(`Stage clear +${fmt(bonus)}${extra}`, 1.6);
    recordBest(SLUG, world.score, { label: `${fmt(world.score)} pts` });
    setTimeout(() => {
      if (mode === 'endless' && screen === 'play') startEndless(false);
    }, 1300);
    return;
  }
  const starsWon = world.livesLost === 0 ? 3 : world.livesLost === 1 ? 2 : 1;
  const prev = progress.levels[levelIndex];
  const newBest = !prev || levelScore > prev.best;
  progress.levels[levelIndex] = { stars: Math.max(prev?.stars ?? 0, starsWon), best: Math.max(prev?.best ?? 0, levelScore) };
  store.set('progress', progress);
  recordBest(SLUG, world.score, { label: `${fmt(world.score)} pts` });
  recordBest(SLUG, levelIndex + 1, { mode: 'furthest', label: `Level ${levelIndex + 1}` });
  carry = { startScore: world.score, startLives: world.lives };

  const last = levelIndex === LEVELS.length - 1;
  $('resultKicker').textContent = `Level ${levelIndex + 1} · ${LEVELS[levelIndex].name}`;
  $('resultHeading').textContent = last ? 'Campaign complete' : 'Level clear';
  const st = $('resultStars');
  st.hidden = false;
  st.innerHTML = stars(starsWon);
  st.setAttribute('aria-label', `${starsWon} of 3 stars`);
  st.setAttribute('role', 'img');
  $('resultTally').innerHTML = `
    <dt>Bricks and combos</dt><dd>${fmt(bricksScore)}</dd>
    <dt>Clear bonus</dt><dd>${fmt(S.clearBonus)}</dd>
    ${flawless ? `<dt>Flawless</dt><dd>${fmt(S.flawlessBonus)}</dd>` : ''}
    <dt>Balls left × ${world.lives}</dt><dd>${fmt(S.lifeBonus * world.lives)}</dd>
    <dt>Best combo</dt><dd>${world.bestCombo}</dd>
    <dt class="total">Run score</dt><dd class="total">${fmt(world.score)}</dd>`;
  $('resultBest').hidden = !newBest;
  $('resultBest').textContent = `New level best: ${fmt(levelScore)}`;
  $('btnNext').hidden = false;
  $('btnNext').textContent = last ? 'Level select' : 'Next level';
  $('btnRetry').textContent = 'Retry';
  show('result', 'btnNext');
}

function gameOver() {
  const S = $('resultStars');
  S.hidden = true;
  const best = recordBest(SLUG, world.score, { label: `${fmt(world.score)} pts` });
  if (mode === 'endless') {
    const e = recordBest(SLUG, world.score, { mode: 'endless', label: `Endless ${fmt(world.score)} (stage ${stage})` });
    $('resultKicker').textContent = `Endless · stage ${stage}`;
    $('resultHeading').textContent = 'Out of balls';
    $('resultTally').innerHTML = `
      <dt>Stages cleared</dt><dd>${stage - 1}</dd>
      <dt>Best combo</dt><dd>${world.bestCombo}</dd>
      <dt class="total">Score</dt><dd class="total">${fmt(world.score)}</dd>
      <dt>Endless best</dt><dd>${fmt(e.best)}</dd>`;
    $('resultBest').hidden = !e.isNew;
    $('resultBest').textContent = 'New endless best';
    $('btnNext').hidden = true;
    $('btnRetry').textContent = 'Play again';
  } else {
    $('resultKicker').textContent = `Level ${levelIndex + 1} · ${LEVELS[levelIndex].name}`;
    $('resultHeading').textContent = 'Out of balls';
    $('resultTally').innerHTML = `
      <dt>Bricks left</dt><dd>${world.breakable}</dd>
      <dt>Best combo</dt><dd>${world.bestCombo}</dd>
      <dt class="total">Run score</dt><dd class="total">${fmt(world.score)}</dd>
      <dt>All-time best</dt><dd>${fmt(best.best)}</dd>`;
    $('resultBest').hidden = !best.isNew || world.score === 0;
    $('resultBest').textContent = 'New best score';
    $('btnNext').hidden = true;
    $('btnRetry').textContent = 'Retry level';
  }
  show('result', 'btnRetry');
}

function retry() {
  if (mode === 'endless') {
    startEndless(true);
  } else {
    // A retry after game over starts the level fresh; after a clear it replays with the same entry state.
    if (world?.state === 'dead') run = { startScore: 0, startLives: CONFIG.lives.start };
    startCampaign(levelIndex, false);
  }
}

function openPause() {
  if (screen !== 'play') return;
  loop.pause();
  syncSettingButtons();
  show('pause');
}

function resume() {
  show('play');
  loop.resume();
}

/* ---------- Simulation hookup ---------- */

function handleEvents(events, silent) {
  for (const e of events) {
    fx.onEvent(e);
    if (silent) continue;
    switch (e.type) {
      case 'paddle':
        audio.play('paddle', e.t);
        break;
      case 'wall':
        audio.play('wall');
        break;
      case 'break':
        if (e.kind !== 'bomb') audio.play('brick', e.combo);
        break;
      case 'hit':
        audio.play('hit');
        break;
      case 'steel':
        audio.play('steel');
        break;
      case 'explode':
        audio.play('explode');
        break;
      case 'laser':
        audio.play('laser');
        break;
      case 'catch':
        audio.play('catch');
        break;
      case 'launch':
        audio.play('launch');
        introShown = true;
        updateFieldMsg();
        break;
      case 'powerup':
        audio.play('powerup', e.type);
        toast(POWERUP_STYLE[e.type].name);
        break;
      case 'supply':
        audio.play('supply');
        toast('Supply drop');
        break;
      case 'lifeLost':
        if (world.lives > 0) audio.play('lifeLost');
        updateFieldMsg();
        break;
      case 'cleared':
        audio.play('clear');
        endTimer = 1.1;
        break;
      case 'gameOver':
        audio.play('gameOver');
        endTimer = 1.3;
        break;
    }
  }
}

function update(dt) {
  time += dt;
  fx.update(dt);
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('is-on');
  }
  if (!world) return;
  if (mode === 'demo') {
    world.step(dt, bot.input(dt));
    const ev = world.drainEvents();
    bot.observe(ev);
    handleEvents(ev, true);
    if (world.state === 'cleared' || world.state === 'dead') {
      endTimer = endTimer || 2;
      endTimer -= dt;
      if (endTimer <= 0) {
        endTimer = 0;
        startDemo();
      }
    }
    return;
  }
  if (screen !== 'play') return;
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const input = { targetX: dir ? null : pointerTarget, moveDir: dir, launch: launchQueued };
  launchQueued = false;
  world.step(dt, input);
  const events = world.drainEvents();
  handleEvents(events, false);
  updateHud(dt);
  if (endTimer > 0) {
    endTimer -= dt;
    if (endTimer <= 0) {
      if (world.state === 'cleared') finishLevel();
      else if (world.state === 'dead') gameOver();
    }
  }
}

const loop = createLoop({
  update,
  render(alpha) {
    renderer.draw(world, fx, alpha, time, { aim: mode !== 'demo' });
  },
});

/* ---------- Input ---------- */

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (screen !== 'play') return;
  if (e.pointerType === 'mouse') {
    pointerTarget = toWorldX(e.clientX);
    if (e.button === 0) launchQueued = true;
    return;
  }
  if (drag) return;
  canvas.setPointerCapture?.(e.pointerId);
  drag = { id: e.pointerId, sx: e.clientX, px: world.paddle.x, t: performance.now(), moved: 0 };
  pointerTarget = world.paddle.x;
});

canvas.addEventListener('pointermove', (e) => {
  if (screen !== 'play' || !world) return;
  if (e.pointerType === 'mouse') {
    pointerTarget = toWorldX(e.clientX);
    return;
  }
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.sx;
  drag.moved = Math.max(drag.moved, Math.abs(dx));
  const x = drag.px + (dx / layout.scale) * CONFIG.paddle.dragGain;
  const half = world.paddle.w / 2;
  pointerTarget = Math.max(half, Math.min(F.w - half, x));
  // Re-anchor at the walls so reversing direction responds immediately.
  if (x !== pointerTarget) {
    drag.sx = e.clientX;
    drag.px = pointerTarget;
  }
});

function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const quick = performance.now() - drag.t < 350;
  if (e.type === 'pointerup' && quick && drag.moved < 12 && screen === 'play') launchQueued = true;
  drag = null;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const LAUNCH = new Set(['Space', 'ArrowUp', 'KeyW']);

addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'KeyM' && !e.repeat) {
    toggleMute();
    return;
  }
  if (screen === 'play') {
    if (LEFT.has(e.code)) keys.left = true;
    else if (RIGHT.has(e.code)) keys.right = true;
    else if (LAUNCH.has(e.code)) launchQueued = true;
    else if (e.code === 'KeyP' || e.code === 'Escape') openPause();
    else return;
    pointerTarget = null;
    e.preventDefault();
    return;
  }
  if (e.code === 'Escape' || (e.code === 'KeyP' && screen === 'pause')) {
    if (screen === 'pause') resume();
    else if (screen === 'levels' || screen === 'help') goTitle();
    e.preventDefault();
    return;
  }
  menuArrows(e);
});

addEventListener('keyup', (e) => {
  if (LEFT.has(e.code)) keys.left = false;
  if (RIGHT.has(e.code)) keys.right = false;
});

/** Arrow keys move focus inside menus and the level grid. */
function menuArrows(e) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const root = $(SCREENS[screen]);
  if (!root) return;
  const items = [...root.querySelectorAll('button:not(:disabled):not([hidden])')].filter((b) => b.offsetParent !== null);
  if (!items.length) return;
  const i = items.indexOf(document.activeElement);
  let step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
  if (screen === 'levels' && document.activeElement?.classList.contains('level-card')) {
    const cards = items.filter((b) => b.classList.contains('level-card'));
    const ci = cards.indexOf(document.activeElement);
    const cols = getComputedStyle($('levelGrid')).gridTemplateColumns.split(' ').length;
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -cols : cols;
    const next = cards[Math.max(0, Math.min(cards.length - 1, ci + delta))];
    if (e.key === 'ArrowUp' && ci - cols < 0) $('levelsBack').focus();
    else next?.focus();
    e.preventDefault();
    return;
  }
  const next = items[(i + step + items.length) % items.length] ?? items[0];
  next.focus();
  e.preventDefault();
}

/* ---------- Buttons ---------- */

function toggleMute() {
  settings.muted = !settings.muted;
  store.set('muted', settings.muted);
  audio.setMuted(settings.muted);
  syncSettingButtons();
  if (!settings.muted) audio.play('ui');
}

function syncSettingButtons() {
  $('muteBtn').setAttribute('aria-pressed', String(settings.muted));
  $('muteBtn').setAttribute('aria-label', settings.muted ? 'Unmute sound (M)' : 'Mute sound (M)');
  $('btnToggleSound').textContent = `Sound: ${settings.muted ? 'off' : 'on'}`;
  $('btnToggleSound').setAttribute('aria-pressed', String(!settings.muted));
  $('btnToggleShake').textContent = `Screen shake: ${settings.shake}`;
}

const on = (id, fn) =>
  $(id).addEventListener('click', (e) => {
    audio.unlock();
    fn(e);
  });

on('btnContinue', () => startCampaign(nextLevelToPlay(), true));
on('btnLevels', openLevels);
on('btnEndless', () => startEndless(true));
on('btnHelp', () => show('help'));
on('helpBack', goTitle);
on('levelsBack', goTitle);
on('pauseBtn', (e) => {
  openPause();
  e.currentTarget.blur();
});
on('muteBtn', (e) => {
  toggleMute();
  e.currentTarget.blur();
});
on('btnResume', resume);
on('btnRestart', () => {
  if (mode === 'endless') startEndless(true);
  else startCampaign(levelIndex, false);
});
on('btnToggleSound', toggleMute);
on('btnToggleShake', () => {
  const order = ['full', 'low', 'off'];
  settings.shake = order[(order.indexOf(settings.shake) + 1) % order.length];
  store.set('shake', settings.shake);
  fx.shakeScale = CONFIG.fx.shake[settings.shake];
  syncSettingButtons();
});
on('btnQuit', goTitle);
on('btnNext', () => {
  if (levelIndex >= LEVELS.length - 1) openLevels();
  else {
    run = carry ?? run;
    startCampaign(levelIndex + 1, false);
  }
});
on('btnRetry', retry);
on('btnResultLevels', () => {
  mode = 'demo';
  startDemo();
  openLevels();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) openPause();
});

/* ---------- Boot ---------- */

addEventListener('resize', computeLayout);
addEventListener('load', computeLayout);
window.visualViewport?.addEventListener('resize', computeLayout);
addEventListener('load', computeLayout);
addEventListener('orientationchange', () => setTimeout(computeLayout, 120));

computeLayout();
buildLegend();
syncSettingButtons();
document.fonts?.load('800 13px "JetBrains Mono"').catch(() => {});

const startParam = params.get('level');
if (params.has('endless')) startEndless(true);
// ?level=N deep-links to a level the player has already unlocked.
else if (startParam && Number(startParam) >= 1 && Number(startParam) <= unlockedCount()) startCampaign(Number(startParam) - 1, true);
else {
  startDemo();
  refreshTitle();
  show('title');
}
loop.start();
