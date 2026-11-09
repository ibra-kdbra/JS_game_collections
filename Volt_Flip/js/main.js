/**
 * Volt Flip for Game Lab: screens, input, layout and the fixed-step loop.
 * The rules live in sim.js and course.js, the campaign levels in levels.js;
 * this file wires them to the page.
 */
import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { SCORE, STEPS_PER_SECOND, WORLD } from './config.js';
import { createWorld, metres, step } from './sim.js';
import { botWantsFlip } from './bot.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { CHAPTERS, EPILOGUE, LEVELS, shardTarget } from './levels.js';
import { createProgress } from './progress.js';

const SLUG = 'volt-flip';
initShell({ slug: SLUG });
const store = createStore(SLUG);
const audio = createAudio(store);
const progress = createProgress(store);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const app = $('#app');
const hud = $('#hud');
const canvas = $('#view');
const renderer = createRenderer(canvas);
const coarse = () => matchMedia('(pointer: coarse)').matches;

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const applyMotion = () => renderer.setReduced(motionQuery.matches);
motionQuery.addEventListener?.('change', applyMotion);
applyMotion();

/* ---------------------------------------------------------------- state */

// title | help | map | story | playing | paused | dying | winning | over | clear | failed
let screen = 'title';
let world = null; // the player's run
let level = null; // the campaign level being played, or null in endless
let demo = null; // the autopilot run behind the title
let demoRestart = 0;
let wantFlip = false;
let countdown = 0;
let beat = 0.3; // seconds per count-in number
let endingFor = 0;
let shownAt = 0;
let prev = { dist: 0, y: 0 };
let best = readBest();
let mapChapter = progress.current().chapter;
let storyDone = null; // what the chapter card's Continue does

/** Screens drawn over the autopilot demo rather than the player's run. */
const DEMO_SCREENS = new Set(['title', 'help', 'map', 'story']);

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

function show(name, focusSel) {
  screen = name;
  for (const [key, el] of screens) el.hidden = key !== name;
  const card = screens.get(name);
  if (card) {
    const focus = (focusSel && $(focusSel, card)) || $('.btn--primary', card) || $('.btn', card);
    // Don't pop the phone keyboard focus ring on touch; keyboard users get focus.
    if (focus && !coarse()) focus.focus({ preventScroll: true });
    shownAt = performance.now();
  }
  app.classList.toggle('is-title', DEMO_SCREENS.has(name));
  app.dataset.mode = level ? 'campaign' : 'endless';
  hud.querySelector('#btn-pause').hidden = !(name === 'playing' || name === 'paused');
  updateHint();
  updateBanner();
}

function updateTitle() {
  $('#title-best').textContent = best.score.toLocaleString('en-US');
  $('#title-far').textContent = `${best.metres.toLocaleString('en-US')} m`;
  const stars = progress.total();
  $('#title-stars').textContent = stars ? `★ ${stars} / ${progress.max}` : `${LEVELS.length} levels`;
}

function begin(w) {
  audio.unlock();
  audio.play('start');
  world = w;
  prev = { dist: world.dist, y: world.p.y };
  renderer.reset();
  wantFlip = false;
}

/** An endless run. */
function start() {
  level = null;
  begin(createWorld({ seed: randomSeed() }));
  countdown = 0;
  show('playing');
}

/** A campaign level, after a 3-2-1 count-in with its name and goal on screen. */
function startLevel(lv) {
  level = lv;
  mapChapter = lv.chapter;
  begin(createWorld({ level: lv }));
  beat = 0.5;
  countdown = beat * 3;
  audio.play('tick');
  show('playing');
}

/** Play a level, showing its chapter's story card first if this is the first visit. */
function enterLevel(lv) {
  if (lv.number === 1 && !progress.seen(lv.chapter)) {
    progress.markSeen(lv.chapter);
    showStory(lv.chapter, () => startLevel(lv));
  } else startLevel(lv);
}

function pause(reason = '') {
  if (screen !== 'playing') return;
  wantFlip = false;
  $('#pause-sub').textContent = reason;
  $('#pause-quit').textContent = level ? 'Level map' : 'Quit to title';
  show('paused');
}

function resume() {
  if (screen !== 'paused') return;
  show('playing');
  beat = 0.3;
  countdown = beat * 3; // three short beats so the first obstacle isn't a surprise
  audio.play('tick');
}

function restart() {
  if (level) startLevel(level);
  else start();
}

function toDemo() {
  world = null;
  prev = { dist: demo.dist, y: demo.p.y };
}

function quit() {
  if (level) return openMap();
  toDemo();
  updateTitle();
  show('title');
}

function toTitle() {
  level = null;
  toDemo();
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

/** End of an endless run. */
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
  show('over');
}

/* -------------------------------------------------------------- campaign */

const STAR_NAMES = ['Reach the uplink', 'Shards', 'No hit'];
const starGoal = (lv, total, i) => (i === 1 ? `${shardTarget(lv, total)} shards` : i === 2 ? 'Keep your shield' : 'Reach the uplink');
const levelTotal = new Map(); // level id -> shard count, filled as levels are built
function totalShards(lv) {
  if (!levelTotal.has(lv.id)) levelTotal.set(lv.id, createWorld({ level: lv }).course.totalShards);
  return levelTotal.get(lv.id);
}

const progressOf = (w) => Math.min(1, w.dist / w.course.finish);

/** End of a campaign try: record it and show the clear or failed card. */
function finishLevel() {
  const lv = level;
  const total = world.course.totalShards;
  const rec = progress.record(lv, { won: world.won, shards: world.shards, hits: world.hits, total });
  recordBest(SLUG, progress.total(), { mode: 'campaign', label: `${progress.total()} campaign stars` });
  if (!world.won) {
    const pct = Math.floor(progressOf(world) * 100);
    $('#failed-eyebrow').textContent = `Level ${lv.id} · ${lv.name}`;
    $('#failed-h').textContent = CAUSES[world.cause] || 'Signal lost';
    $('#failed-bar').style.width = `${pct}%`;
    $('#failed-line').textContent = `${pct}% of the way to the uplink · ${world.shards} shards`;
    $('#announce').textContent = `${CAUSES[world.cause] || 'Signal lost'} at ${pct}% of level ${lv.id}.`;
    show('failed');
    return;
  }
  $('#clear-eyebrow').textContent = `Level ${lv.id} clear`;
  $('#clear-h').textContent = lv.name;
  const list = $('#clear-stars');
  list.innerHTML = '';
  rec.now.forEach((got, i) => {
    const li = document.createElement('li');
    li.className = `${got ? 'got' : ''}${rec.fresh[i] ? ' fresh' : ''}`;
    li.style.setProperty('--i', String(i));
    li.innerHTML = `<span class="star${got ? ' on' : ''}" aria-hidden="true"></span><span>${starGoal(lv, total, i)}</span>`;
    li.setAttribute('aria-label', `${STAR_NAMES[i]}: ${got ? 'earned' : 'not earned'}`);
    list.append(li);
  });
  $('#clear-shards').textContent = `${world.shards} / ${total}`;
  $('#clear-shield').textContent = world.hits ? 'Broken' : 'Intact';
  const fresh = rec.fresh.some(Boolean) && !rec.firstClear;
  $('#clear-new').hidden = !fresh;
  const kept = rec.result.stars.filter(Boolean).length;
  $('#clear-best').textContent = `Best: ${kept} of 3 stars · ${rec.result.shards} shards`;
  const next = LEVELS[lv.index + 1];
  $('#clear-next').innerHTML = next ? 'Next level <kbd>Space</kbd>' : 'Finish the story <kbd>Space</kbd>';
  $('#announce').textContent = `Level ${lv.id} clear. ${rec.now.filter(Boolean).length} of 3 stars this run.`;
  audio.play('best');
  rec.now.forEach((got, i) => got && setTimeout(() => screen === 'clear' && audio.play('star', i), 420 + i * 170));
  show('clear');
}

function nextLevel() {
  const next = LEVELS[level.index + 1];
  if (!next) {
    progress.markEpilogue();
    showStory(null, () => openMap(), 'Back to the map');
    return;
  }
  enterLevel(next);
}

/* chapter cards */

function showStory(ch, done, label = 'Start') {
  storyDone = done;
  $('#story-eyebrow').textContent = ch ? `Chapter ${ch.id} · ${ch.teaches}` : 'Epilogue';
  $('#story-h').textContent = ch ? ch.name : 'Lights on';
  const box = $('#story-lines');
  box.innerHTML = '';
  (ch ? ch.story : EPILOGUE).forEach((line, i) => {
    const p = document.createElement('p');
    p.textContent = line;
    p.style.setProperty('--i', String(i));
    box.append(p);
  });
  $('#story-go').innerHTML = `${label} <kbd>Space</kbd>`;
  world = null;
  show('story');
}

function storyContinue() {
  if (performance.now() - shownAt < 250) return; // the tap that opened it
  const done = storyDone || (() => openMap());
  storyDone = null;
  done();
}

/* level select */

const tabsEl = $('#map-tabs');
const levelsEl = $('#map-levels');

function starsHtml(stars) {
  return stars.map((on) => `<span class="star${on ? ' on' : ''}"></span>`).join('');
}

function openMap(ch = mapChapter) {
  level = null;
  toDemo();
  mapChapter = ch || progress.current().chapter;
  renderMap();
  show('map', '.level:not([disabled]).is-next, .level:not([disabled])');
}

function renderMap(focusTab = false) {
  $('#map-stars').textContent = `${progress.total()} / ${progress.max}`;
  tabsEl.innerHTML = '';
  for (const ch of CHAPTERS) {
    const open = progress.chapterUnlocked(ch);
    const got = ch.levels.reduce((n, lv) => n + progress.starCount(lv), 0);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.role = 'tab';
    b.id = `tab-${ch.id}`;
    b.setAttribute('aria-selected', String(ch === mapChapter));
    b.setAttribute('aria-controls', 'map-panel');
    b.tabIndex = ch === mapChapter ? 0 : -1;
    b.dataset.chapter = String(ch.id);
    b.innerHTML = `<span class="tab-num">${open ? ch.id : '<span class="lock" aria-hidden="true"></span>'}</span><span class="tab-name">${ch.name}</span><span class="tab-stars">${got}/${ch.levels.length * 3}</span>`;
    b.setAttribute('aria-label', `Chapter ${ch.id}, ${ch.name}${open ? `, ${got} of ${ch.levels.length * 3} stars` : ', locked'}`);
    tabsEl.append(b);
  }
  const ch = mapChapter;
  $('#map-panel').setAttribute('aria-labelledby', `tab-${ch.id}`);
  $('#map-chapter').textContent = `Chapter ${ch.id} · ${ch.name}`;
  const open = progress.chapterUnlocked(ch);
  $('#map-teaches').textContent = open ? `New: ${ch.teaches.toLowerCase()}` : `Clear chapter ${ch.id - 1} to open`;
  $('[data-action="story"]').hidden = !open;
  const nextUp = progress.current();
  levelsEl.innerHTML = '';
  for (const lv of ch.levels) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'level';
    const unlocked = progress.unlocked(lv);
    const r = progress.result(lv);
    b.disabled = !unlocked;
    b.dataset.level = lv.id;
    if (lv === nextUp && !progress.cleared(lv)) b.classList.add('is-next');
    if (lv.finale) b.classList.add('is-finale');
    const stars = progress.stars(lv);
    const total = unlocked ? totalShards(lv) : 0;
    const sub = !unlocked ? 'Locked' : r && r.clears ? `${r.shards}/${total} shards` : lv.finale ? 'Finale' : 'New';
    b.innerHTML = `<span class="level-id">${unlocked ? lv.id : '<span class="lock" aria-hidden="true"></span>'}</span><span class="level-name">${lv.name}</span><span class="level-stars" aria-hidden="true">${starsHtml(stars)}</span><span class="level-sub">${sub}</span>`;
    b.setAttribute(
      'aria-label',
      `Level ${lv.id}, ${lv.name}${lv.finale ? ', finale' : ''}${unlocked ? `, ${stars.filter(Boolean).length} of 3 stars${r && r.clears ? `, best ${r.shards} shards` : ''}` : ', locked'}`,
    );
    li.append(b);
    levelsEl.append(li);
  }
  if (focusTab && !coarse()) $(`#tab-${ch.id}`)?.focus({ preventScroll: true });
}

tabsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  audio.unlock();
  audio.play('ui');
  mapChapter = CHAPTERS.find((ch) => String(ch.id) === b.dataset.chapter) || mapChapter;
  renderMap(true);
});

tabsEl.addEventListener('keydown', (e) => {
  const i = CHAPTERS.indexOf(mapChapter);
  let j = i;
  if (e.key === 'ArrowRight') j = Math.min(CHAPTERS.length - 1, i + 1);
  else if (e.key === 'ArrowLeft') j = Math.max(0, i - 1);
  else if (e.key === 'Home') j = 0;
  else if (e.key === 'End') j = CHAPTERS.length - 1;
  else return;
  e.preventDefault();
  e.stopPropagation();
  if (j === i) return;
  mapChapter = CHAPTERS[j];
  audio.play('ui');
  renderMap(true);
});

levelsEl.addEventListener('click', (e) => {
  const b = e.target.closest('.level');
  if (!b || b.disabled) return;
  audio.unlock();
  audio.play('ui');
  enterLevel(LEVELS.find((lv) => lv.id === b.dataset.level));
});

// Arrow keys move between level tiles.
levelsEl.addEventListener('keydown', (e) => {
  const dirs = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  if (!(e.key in dirs)) return;
  const tiles = $$('.level:not([disabled])', levelsEl);
  const i = tiles.indexOf(document.activeElement);
  if (i < 0) return;
  e.preventDefault();
  e.stopPropagation();
  tiles[Math.max(0, Math.min(tiles.length - 1, i + dirs[e.key]))].focus();
});

/* ---------------------------------------------------------- hint, banner */

let flippedOnce = store.get('flipped', false);
if (coarse()) $('#hint').innerHTML = '<kbd>Tap</kbd> anywhere to flip gravity';
function updateHint() {
  const el = $('#hint');
  const showIt = screen === 'playing' && world && !level && (!flippedOnce || world.t < 2.2) && world.flips === 0;
  if (el.hidden === !showIt) return;
  el.hidden = !showIt;
}

/** The level's name and goal, during the count-in and the first moments of the run. */
function updateBanner() {
  const el = $('#banner');
  const showIt = Boolean(level && world && screen === 'playing' && world.t < 1.6);
  if (showIt && el.dataset.level !== level.id) {
    el.dataset.level = level.id;
    $('#banner-id').textContent = `Level ${level.id}${level.finale ? ' · Finale' : ''}`;
    $('#banner-name').textContent = level.name;
    const tip = level.tip ? (coarse() ? level.tip.replace('Tap, click or press Space', 'Tap anywhere') : level.tip) : `Reach the uplink. ${shardTarget(level, world.course.totalShards)} shards for a star.`;
    $('#banner-tip').textContent = tip;
  }
  if (!showIt) delete el.dataset.level;
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
      if (performance.now() - shownAt > 550) start();
      break;
    case 'story':
      storyContinue();
      break;
    case 'clear':
      if (performance.now() - shownAt > 550) nextLevel();
      break;
    case 'failed':
      if (performance.now() - shownAt > 550) startLevel(level);
      break;
  }
}

app.addEventListener('pointerdown', (e) => {
  if (e.button > 0) return;
  if (e.target.closest('button, a')) return;
  // The chapter card is skipped by a tap anywhere, the card included.
  if (e.target.closest('.card') && screen !== 'story') return;
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
    else if (screen === 'help' || screen === 'map') toTitle();
    else if (screen === 'clear' || screen === 'failed') openMap();
    else if (screen === 'story') storyContinue();
    return;
  }
  if (!FLIP_KEYS.has(code)) return;
  const onButton = document.activeElement?.closest?.('button');
  if (screen !== 'playing' && onButton && (code === 'Space' || code === 'Enter')) return; // let the button click
  if (screen === 'map' || screen === 'help') return; // arrows move focus there
  e.preventDefault();
  if (e.repeat) return;
  press();
});

for (const btn of $$('[data-action]')) {
  btn.addEventListener('click', () => {
    audio.unlock();
    audio.play('ui');
    const a = btn.dataset.action;
    if (a === 'start') start();
    else if (a === 'restart') restart();
    else if (a === 'campaign') openMap(progress.current().chapter);
    else if (a === 'help') show('help');
    else if (a === 'back') toTitle();
    else if (a === 'resume') resume();
    else if (a === 'quit') quit();
    else if (a === 'map') openMap();
    else if (a === 'retry') startLevel(level);
    else if (a === 'next') nextLevel();
    else if (a === 'story') showStory(mapChapter, () => openMap(mapChapter), 'Back to the map');
    else if (a === 'story-go') storyContinue();
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
  // The level banner sits just under the ceiling rail.
  $('#banner').style.top = `${Math.round(y + 26 * scale)}px`;
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
  level: $('#hud-level'),
  shards: $('#hud-shards'),
  target: $('#hud-target'),
  pct: $('#hud-pct'),
};
const barEl = $('#hud-bar');
hudEls.pips.innerHTML = '<i></i>'.repeat(SCORE.chainPerLevel);
const pipEls = [...hudEls.pips.children];
const shown = {};
function setText(key, value) {
  if (shown[key] === value) return;
  shown[key] = value;
  hudEls[key].textContent = value;
}

function updateHud(w) {
  if (w && w.level) {
    const pct = Math.floor(progressOf(w) * 100);
    setText('level', w.level.id);
    setText('shards', String(w.shards));
    setText('target', `/${w.course.totalShards}`);
    setText('pct', `${pct}%`);
    if (shown.bar !== pct) {
      shown.bar = pct;
      barEl.style.width = `${pct}%`;
    }
    hudEls.shards.parentElement.classList.toggle('is-met', w.shards >= shardTarget(w.level, w.course.totalShards));
    return;
  }
  const live = w || { score: 0, mult: 1, chain: 0, dist: 0 };
  setText('score', Math.floor(live.score).toLocaleString('en-US'));
  setText('mult', `×${live.mult}`);
  setText('dist', Math.floor(live.dist / 10).toLocaleString('en-US'));
  setText('best', best.score.toLocaleString('en-US'));
  if (shown.multLevel !== live.mult) {
    shown.multLevel = live.mult;
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
      case 'finish':
        audio.play('finish');
        break;
      case 'die':
        audio.play('die');
        try {
          if (coarse()) navigator.vibrate?.(40);
        } catch {}
        break;
    }
  }
}

function update(dt) {
  if (screen === 'playing' && world) {
    if (countdown > 0) {
      const before = Math.ceil(countdown / beat);
      countdown -= dt;
      if (countdown > 0 && Math.ceil(countdown / beat) !== before) audio.play('tick');
      return;
    }
    prev.dist = world.dist;
    prev.y = world.p.y;
    step(world, wantFlip);
    wantFlip = false;
    handleEvents(world, true);
    if (world.over) {
      endingFor = 0;
      screen = world.won ? 'winning' : 'dying';
      $('#btn-pause').hidden = true;
      updateBanner();
    }
    return;
  }
  if (screen === 'dying' || screen === 'winning') {
    endingFor += dt;
    if (endingFor > (screen === 'winning' ? 1 : 0.85)) {
      if (level) finishLevel();
      else finish();
    }
    return;
  }
  if (DEMO_SCREENS.has(screen) && demo) {
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
  const onDemo = DEMO_SCREENS.has(screen);
  const showing = onDemo ? demo : world || demo;
  if (!showing) return;
  const moving = showing === demo ? onDemo : screen === 'playing' && countdown <= 0;
  const a = moving ? alpha : 1;
  const dist = prev.dist + (showing.dist - prev.dist) * a;
  const y = prev.y + (showing.p.y - prev.y) * a;
  renderer.draw(showing, dist, y, screen === 'paused' ? 0 : dt, { dim: showing === demo ? 0.25 : 0 });
  updateHud(showing === demo ? null : showing);
  if (screen === 'playing') {
    updateHint();
    updateBanner();
  }
  // The count-in shows in the level banner when it is up, otherwise mid-screen.
  const counting = screen === 'playing' && countdown > 0;
  const inBanner = counting && !$('#banner').hidden;
  const n = counting ? String(Math.ceil(countdown / beat)) : '';
  const cd = $('#countdown');
  const bc = $('#banner-count');
  if (bc.textContent !== (inBanner ? n : '')) bc.textContent = inBanner ? n : '';
  if (counting && !inBanner) {
    cd.hidden = false;
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
  get level() {
    return level?.id ?? null;
  },
};
