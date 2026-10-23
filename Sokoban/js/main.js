import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { createTouchControls } from '../../assets/kit/input.js';
import { parseCollection, Puzzle, DIRS, lurdToDirs } from './puzzle.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';

const SLUG = 'sokoban';
const WORLD_NAMES = { 1: 'Intake', 2: 'Storage', 3: 'Sorting', 4: 'Night Shift' };
const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

initShell({ slug: SLUG });
const touch = createTouchControls({
  dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
  buttons: [
    { label: 'Undo', key: 'z', repeatMs: 170 },
    { label: 'Restart', key: 'r', small: true, repeatMs: 0 },
  ],
  repeatMs: 150,
  repeatDelayMs: 300, // a quick tap is one step; holding walks after 0.3 s
});

const store = createStore(SLUG);
const settings = { sound: true, deadlock: true, fast: false, ...store.get('settings', {}) };
const progress = store.get('progress', {}); // { [index]: { moves, pushes, lurd } }
const audio = createAudio({ muted: !settings.sound });
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const $ = (id) => document.getElementById(id);
const canvas = $('board');
const renderer = createRenderer(canvas);

let levels = [];
let current = 0;
let puzzle = null;
let mode = 'play'; // play | celebrate | replay
let stuckBefore = new Set();
let stuckHintShown = false;

/* ---------------------------------------------------------------- motion */

// The rules apply a step instantly; the view tweens toward it in fixed steps.
const queue = []; // pending directions of the active action
let activeAction = null; // { kind: 'key'|'walk'|'push'|'replay' }
let tween = null; // { t, dur, from, to, box, boxFrom, boxTo, push }
const rings = [];
let squash = 0;
let celebrate = null; // { t }
let hoverPath = null;
let drag = null;
let replay = null; // { dirs, i, speed }
let blinkClock = 0;

const stepTime = (kind) => {
  if (reducedMotion.matches) return kind === 'walk' || kind === 'replay' ? 0.05 : 0.06;
  if (kind === 'replay') return 0.13 / (replay?.speed ?? 1);
  if (kind === 'walk') return settings.fast ? 0.045 : 0.065;
  return settings.fast ? 0.075 : 0.11;
};

function startAction(kind, dirs) {
  finishTween();
  endAction();
  activeAction = { kind };
  queue.length = 0;
  queue.push(...dirs);
  puzzle.beginGroup();
}

function endAction() {
  if (!activeAction) return;
  queue.length = 0;
  puzzle.endGroup();
  activeAction = null;
}

/** Keys queue at most one step ahead so a held key never runs away. */
function keyStep(dir) {
  if (mode !== 'play') return;
  audio.unlock();
  hoverPath = null;
  if (activeAction && activeAction.kind !== 'key') {
    finishTween();
    endAction();
  }
  if (activeAction?.kind === 'key') {
    if (queue.length < 1) queue.push(dir);
    return;
  }
  startAction('key', [dir]);
}

function advance(dt) {
  blinkClock += dt;
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].t += dt / 0.45;
    if (rings[i].t >= 1) rings.splice(i, 1);
  }
  squash = Math.max(0, squash - dt * 6);
  if (celebrate) {
    celebrate.t += dt;
    if (celebrate.t >= (reducedMotion.matches ? 0.25 : 1.15)) {
      celebrate = null;
      showDone();
    }
  }
  if (tween) {
    tween.t += dt / tween.dur;
    if (tween.t >= 1) {
      tween = null;
      afterStep();
    }
  }
  if (!tween && activeAction) {
    if (!queue.length) {
      const kind = activeAction.kind;
      endAction();
      if (kind === 'replay') finishReplay();
      return;
    }
    const dir = queue.shift();
    const from = puzzle.player;
    const rec = puzzle.stepInGroup(dir);
    if (!rec) {
      if (activeAction.kind === 'key') {
        puzzle.facing = dir;
        audio.bump();
      }
      endAction();
      return;
    }
    const kind = activeAction.kind;
    tween = { t: 0, dur: stepTime(kind), from, to: puzzle.player, box: rec.box, push: rec.box >= 0 };
    if (rec.box >= 0) {
      tween.boxFrom = puzzle.player;
      tween.boxTo = puzzle.boxes[rec.box];
      audio.push();
      squash = 1;
    } else if (kind !== 'replay' || replay?.speed <= 1) {
      audio.step();
    }
    if (replay) replay.i++;
    updateHud();
  }
}

/** Effects that belong to the end of a step: pad chimes, stuck warning, win. */
function afterStep(record = true) {
  const last = puzzle.history.at(-1)?.at(-1);
  if (last && last.box >= 0) {
    const at = puzzle.boxes[last.box];
    const prev = puzzle.player; // the crate left the cell the player now stands on
    if (puzzle.goal[at]) {
      audio.goal();
      if (!reducedMotion.matches) rings.push({ ...puzzle.xy(at), t: 0 });
    } else if (puzzle.goal[prev]) {
      audio.unGoal();
    }
    if (settings.deadlock && mode === 'play') {
      const stuck = puzzle.stuckBoxes();
      for (const k of stuck) {
        if (!stuckBefore.has(k)) {
          audio.stuck();
          if (!stuckHintShown) toast('Striped crates are stuck for good. Undo (Z) takes the push back.', 3400);
          stuckHintShown = true;
          break;
        }
      }
      stuckBefore = stuck;
    }
  }
  if (record && mode === 'play' && puzzle.solved()) {
    endAction();
    onSolved();
  }
}

function finishTween() {
  if (!tween) return;
  tween = null;
  afterStep();
}

/* ------------------------------------------------------------------ view */

const ease = (t) => (t < 0 ? 0 : t > 1 ? 1 : 1 - (1 - t) * (1 - t) * (1 - t));

function view(alpha) {
  const xy = (i) => puzzle.xy(i);
  let px = xy(puzzle.player);
  let tweenBox = -1;
  let boxPos = null;
  if (tween) {
    const t = reducedMotion.matches ? Math.min(1, tween.t + alpha / 60 / tween.dur) : ease(tween.t + alpha / 60 / tween.dur);
    const a = xy(tween.from);
    const b = xy(tween.to);
    px = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (tween.push) {
      tweenBox = tween.box;
      const c = xy(tween.boxFrom);
      const d = xy(tween.boxTo);
      boxPos = { x: c.x + (d.x - c.x) * t, y: c.y + (d.y - c.y) * t };
    }
  }
  const stuck = settings.deadlock && mode !== 'replay' ? puzzle.stuckBoxes() : new Set();
  const cel = celebrate && !reducedMotion.matches ? celebrate.t : null;
  const boxes = puzzle.boxes.map((b, k) => {
    const p = k === tweenBox ? boxPos : xy(b);
    const onGoal = puzzle.goal[b] && !(k === tweenBox && tween.t < 0.6);
    let pulse = 0;
    if (cel != null) {
      const local = cel * 3 - (p.x + p.y) * 0.12;
      pulse = local > 0 && local < 1 ? Math.sin(local * Math.PI) : 0;
    }
    return { x: p.x, y: p.y, onGoal, stuck: stuck.has(k), pulse, glow: onGoal ? (cel != null ? 1 : 0.35) : 0 };
  });
  return {
    boxes,
    player: { ...px, facing: puzzle.facing, squash: reducedMotion.matches ? 0 : squash, blink: blinkClock % 4.2 > 4.05 },
    rings,
    hoverPath,
    drag,
    sweep: cel != null ? Math.min(1, cel / 0.9) : null,
  };
}

const loop = createLoop({
  update: advance,
  render(alpha) {
    if (puzzle) renderer.draw(view(alpha));
  },
});

/* ------------------------------------------------------------------- HUD */

function updateHud() {
  const lvl = levels[current];
  $('moves').textContent = puzzle.moves;
  $('pushes').textContent = puzzle.pushes;
  $('par').textContent = lvl.par;
  $('par-box').classList.toggle('counter--over', puzzle.pushes > lvl.par);
  if (replay) $('replay-count').textContent = `${replay.i} / ${replay.dirs.length}`;
}

function levelCode(i) {
  const lvl = levels[i];
  const inWorld = levels.slice(0, i + 1).filter((l) => l.world === lvl.world).length;
  return `${lvl.world}-${inWorld}`;
}

function stars(i) {
  const p = progress[i];
  if (!p) return 0;
  return p.pushes <= levels[i].par ? 2 : 1;
}

let toastTimer = 0;
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------------------------------------------------------------- levels */

function loadLevel(i, { keepReplay = false } = {}) {
  current = (i + levels.length) % levels.length;
  const lvl = levels[current];
  puzzle = new Puzzle(lvl);
  tween = null;
  activeAction = null;
  queue.length = 0;
  rings.length = 0;
  celebrate = null;
  hoverPath = null;
  drag = null;
  stuckBefore = new Set();
  if (!keepReplay) stopReplay(false);
  mode = keepReplay ? 'replay' : 'play';
  renderer.setPuzzle(puzzle);
  store.set('current', current);
  $('world-label').textContent = `World ${lvl.world} · ${WORLD_NAMES[lvl.world] ?? ''}`;
  $('level-code').textContent = levelCode(current);
  $('level-name').textContent = lvl.title;
  const best = progress[current];
  const bestText = best ? ` <span class="best">Best: ${best.pushes} pushes, ${best.moves} moves.</span>` : '';
  $('brief').innerHTML = `<b>Brief</b> ${escapeHtml(lvl.idea)}${bestText}`;
  canvas.setAttribute('aria-label', `Level ${levelCode(current)}, ${lvl.title}: ${lvl.idea} ${puzzle.boxes.length} crates. Use the arrow keys to move.`);
  document.title = `${levelCode(current)} ${lvl.title} · Crate Lab`;
  updateHud();
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function undo() {
  if (mode === 'replay') return;
  if (mode === 'celebrate') return;
  audio.unlock();
  finishTween();
  endAction();
  const res = puzzle.undo();
  if (!res) return;
  audio.undo();
  if (res === 'restart') toast('Moves restored.');
  stuckBefore = settings.deadlock ? puzzle.stuckBoxes() : new Set();
  hoverPath = null;
  updateHud();
}

function restart() {
  if (mode !== 'play') return;
  finishTween();
  endAction();
  if (puzzle.restart()) {
    audio.undo();
    stuckBefore = new Set();
    toast('Restarted. Undo (Z) brings your moves back.');
    updateHud();
  }
}

/* ------------------------------------------------------------------ win */

function onSolved() {
  mode = 'celebrate';
  celebrate = { t: 0 };
  audio.solved();
  const lurd = puzzle.lurd();
  const prev = progress[current];
  const better = !prev || puzzle.pushes < prev.pushes || (puzzle.pushes === prev.pushes && puzzle.moves < prev.moves);
  lastSolve = { moves: puzzle.moves, pushes: puzzle.pushes, lurd, newBest: better && !!prev, first: !prev };
  if (better) {
    progress[current] = { moves: puzzle.moves, pushes: puzzle.pushes, lurd };
    store.set('progress', progress);
  }
  const solved = Object.keys(progress).length;
  const atPar = levels.filter((_, i) => stars(i) === 2).length;
  recordBest(SLUG, solved, { label: `${solved}/${levels.length} levels` });
  store.set('summary', { solved, atPar });
}

let lastSolve = null;

function showDone() {
  const lvl = levels[current];
  const s = lastSolve;
  $('done-level').textContent = `${levelCode(current)} ${lvl.title}`;
  $('done-moves').textContent = s.moves;
  $('done-pushes').textContent = s.pushes;
  $('done-par').textContent = lvl.par;
  const atPar = s.pushes <= lvl.par;
  const st = $('done-stars');
  st.innerHTML = `<span class="star on"></span><span class="star ${atPar ? 'on' : ''}"></span>`;
  st.setAttribute('aria-label', atPar ? 'Two stars: solved at par' : 'One star: solved');
  const over = s.pushes - lvl.par;
  let note = atPar ? 'At par. That is the fewest pushes possible.' : `${over} push${over === 1 ? '' : 'es'} over par. Par earns the second star.`;
  if (s.newBest) note += ' New best.';
  $('done-note').textContent = note;
  const last = current === levels.length - 1;
  $('done-next').textContent = last ? 'Back to level 1' : 'Next level';
  mode = 'play';
  openDialog('done-panel');
}

/* ---------------------------------------------------------------- replay */

function startReplay(lurd) {
  closeDialogs();
  loadLevel(current, { keepReplay: true });
  replay = { dirs: lurdToDirs(lurd), i: 0, speed: replay?.speed ?? 1 };
  mode = 'replay';
  $('replay-bar').hidden = false;
  $('replay-speed').textContent = `${replay.speed}×`;
  updateHud();
  // A beat of stillness before the first move.
  setTimeout(() => {
    if (!replay) return;
    activeAction = { kind: 'replay' };
    queue.length = 0;
    queue.push(...replay.dirs);
    puzzle.beginGroup();
  }, 450);
}

function finishReplay() {
  if (!replay) return;
  setTimeout(() => {
    if (!replay) return;
    stopReplay(true);
  }, 700);
}

function stopReplay(reload = true) {
  if (!replay) return;
  replay = null;
  $('replay-bar').hidden = true;
  if (reload) {
    loadLevel(current);
    if (lastSolve) openDialog('done-panel');
  }
}

/* ----------------------------------------------------------------- input */

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (mode === 'replay') {
    if (e.key === 'Escape' || e.key === ' ') {
      e.preventDefault();
      stopReplay(true);
    }
    return;
  }
  const dir = KEY_DIRS[e.key];
  if (dir) {
    e.preventDefault();
    keyStep(dir);
    return;
  }
  switch (e.key.toLowerCase()) {
    case 'z':
    case 'u':
    case 'backspace':
      e.preventDefault();
      undo();
      break;
    case 'r':
      if (!e.repeat) restart();
      break;
    case 'l':
    case 'escape':
      openLevels();
      break;
    case 'm':
      setSound(!settings.sound);
      break;
    case '[':
      loadLevel(current - 1);
      break;
    case ']':
      loadLevel(current + 1);
      break;
  }
});

// Pointer: tap to walk, tap a neighbouring crate to push it, drag a crate to push it
// in a line, swipe elsewhere (touch) to step.
let gesture = null;

canvas.addEventListener('pointerdown', (e) => {
  if (mode !== 'play' || e.button > 0) return;
  audio.unlock();
  const cell = renderer.cellAt(e.clientX, e.clientY);
  const idx = cell ? puzzle.index(cell.x, cell.y) : -1;
  const box = idx >= 0 ? puzzle.occ[idx] : -1;
  gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, cell, box, type: e.pointerType, moved: false };
  canvas.setPointerCapture(e.pointerId);
  hoverPath = null;
});

canvas.addEventListener('pointermove', (e) => {
  if (!gesture) {
    if (e.pointerType === 'mouse' && mode === 'play' && !activeAction) updateHover(e);
    return;
  }
  if (e.pointerId !== gesture.id) return;
  const dx = e.clientX - gesture.x;
  const dy = e.clientY - gesture.y;
  const dist = Math.hypot(dx, dy);
  const tile = renderer.tile;
  if (dist > Math.max(10, tile * 0.3)) gesture.moved = true;
  if (gesture.box >= 0 && gesture.moved) {
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const dir = horiz ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    const want = Math.max(1, Math.round((horiz ? Math.abs(dx) : Math.abs(dy)) / tile));
    const plan = puzzle.planPush(gesture.box, dir, want);
    const from = puzzle.xy(puzzle.boxes[gesture.box]);
    const d = DIRS[dir];
    if (plan) {
      const to = puzzle.xy(plan.end);
      // Dots for the walk to the pushing spot, so the whole action is visible before release.
      const walk = [];
      let c = puzzle.player;
      for (const d of plan.dirs.slice(0, plan.dirs.length - plan.pushes)) {
        c = puzzle.step(c, d);
        const p = puzzle.xy(c);
        walk.push([p.x, p.y]);
      }
      drag = { from: [from.x, from.y], to: [to.x, to.y], ok: plan.pushes === want, plan, walk };
    } else {
      drag = { from: [from.x, from.y], to: [from.x + d.dx, from.y + d.dy], ok: false, plan: null };
    }
  }
});

function endGesture(e) {
  if (!gesture || e.pointerId !== gesture.id) return;
  const g = gesture;
  gesture = null;
  const dx = e.clientX - g.x;
  const dy = e.clientY - g.y;
  if (mode !== 'play') {
    drag = null;
    return;
  }
  if (g.box >= 0 && g.moved) {
    const plan = drag?.plan;
    drag = null;
    if (plan) startAction('push', plan.dirs);
    else {
      audio.bump();
      toast('That crate can’t be pushed that way from here.', 1800);
    }
    return;
  }
  drag = null;
  if (!g.moved) {
    tapCell(g.cell);
    return;
  }
  if (g.type !== 'mouse' && Math.max(Math.abs(dx), Math.abs(dy)) >= 24) {
    keyStep(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  }
}

canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', () => {
  gesture = null;
  drag = null;
});
canvas.addEventListener('pointerleave', () => {
  if (!gesture) hoverPath = null;
});

function tapCell(cell) {
  if (!cell) return;
  const idx = puzzle.index(cell.x, cell.y);
  if (idx === puzzle.player) return;
  const box = puzzle.occ[idx];
  if (box >= 0) {
    // A crate next to the bot: push it once.
    for (const [dir, d] of Object.entries(DIRS)) {
      if (puzzle.step(puzzle.player, dir) === idx) {
        startAction('key', [dir]);
        return;
      }
    }
    toast('Drag a crate to push it, or walk next to it first.', 1800);
    return;
  }
  const path = puzzle.walkPath(idx);
  if (!path) {
    if (puzzle.floor[idx]) audio.bump();
    return;
  }
  startAction('walk', path);
}

function updateHover(e) {
  const cell = renderer.cellAt(e.clientX, e.clientY);
  if (!cell) {
    hoverPath = null;
    return;
  }
  const idx = puzzle.index(cell.x, cell.y);
  const path = puzzle.floor[idx] && puzzle.occ[idx] < 0 ? puzzle.walkPath(idx) : null;
  if (!path || !path.length) {
    hoverPath = null;
    return;
  }
  let p = puzzle.player;
  hoverPath = path.map((d) => {
    p = puzzle.step(p, d);
    const { x, y } = puzzle.xy(p);
    return [x, y];
  });
}

/* --------------------------------------------------------------- dialogs */

function openDialog(id) {
  closeDialogs();
  const d = $(id);
  d.showModal();
}

function closeDialogs() {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
}

for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close(); // backdrop click
  });
}
for (const b of document.querySelectorAll('[data-close]')) b.addEventListener('click', () => b.closest('dialog').close());

function openLevels() {
  buildLevelList();
  openDialog('levels-panel');
  const cur = document.querySelector('.level-tile.is-current');
  cur?.scrollIntoView({ block: 'nearest' });
}

function buildLevelList() {
  const wrap = $('worlds');
  wrap.textContent = '';
  const solved = Object.keys(progress).length;
  const atPar = levels.filter((_, i) => stars(i) === 2).length;
  $('levels-summary').textContent = `${solved} of ${levels.length} solved · ${atPar} at par`;
  const cont = $('continue-btn');
  cont.innerHTML = `Continue <small>${levelCode(current)} ${escapeHtml(levels[current].title)}</small>`;
  for (const w of [1, 2, 3, 4]) {
    const idx = levels.map((l, i) => (l.world === w ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) continue;
    const sec = document.createElement('section');
    sec.className = 'world';
    const done = idx.filter((i) => progress[i]).length;
    sec.innerHTML = `<h3><span>World ${w} · ${WORLD_NAMES[w]}</span><span>${done}/${idx.length}</span></h3>`;
    const grid = document.createElement('div');
    grid.className = 'level-grid';
    for (const i of idx) {
      const s = stars(i);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `level-tile${i === current ? ' is-current' : ''}${s ? ' is-solved' : ''}`;
      b.setAttribute('aria-label', `${levelCode(i)} ${levels[i].title}, par ${levels[i].par}${s === 2 ? ', solved at par' : s ? ', solved' : ''}`);
      b.innerHTML = `<span class="code">${levelCode(i)}</span><span class="name">${escapeHtml(levels[i].title)}</span><span class="pips" aria-hidden="true"><span class="pip ${s >= 1 ? 'on' : ''}"></span><span class="pip ${s >= 2 ? 'on' : ''}"></span></span>`;
      b.title = `${levels[i].title} · par ${levels[i].par}`;
      b.addEventListener('click', () => {
        audio.unlock();
        audio.click();
        closeDialogs();
        loadLevel(i);
      });
      grid.append(b);
    }
    sec.append(grid);
    wrap.append(sec);
  }
}

$('continue-btn').addEventListener('click', () => {
  audio.unlock();
  closeDialogs();
});
$('btn-levels').addEventListener('click', (e) => {
  e.currentTarget.blur();
  openLevels();
});
$('btn-undo').addEventListener('click', (e) => {
  e.currentTarget.blur();
  undo();
});
$('btn-restart').addEventListener('click', (e) => {
  e.currentTarget.blur();
  restart();
});
$('btn-settings').addEventListener('click', () => {
  $('set-sound').checked = settings.sound;
  $('set-deadlock').checked = settings.deadlock;
  $('set-fast').checked = settings.fast;
  openDialog('settings-panel');
});
$('btn-sound').addEventListener('click', (e) => {
  e.currentTarget.blur();
  setSound(!settings.sound);
});

function setSound(on) {
  settings.sound = on;
  audio.muted = !on;
  store.set('settings', settings);
  $('btn-sound').setAttribute('aria-pressed', String(on));
  $('btn-sound').setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  if (on) audio.click();
}

$('set-sound').addEventListener('change', (e) => setSound(e.target.checked));
$('set-deadlock').addEventListener('change', (e) => {
  settings.deadlock = e.target.checked;
  store.set('settings', settings);
  stuckBefore = settings.deadlock && puzzle ? puzzle.stuckBoxes() : new Set();
});
$('set-fast').addEventListener('change', (e) => {
  settings.fast = e.target.checked;
  store.set('settings', settings);
});
$('reset-progress').addEventListener('click', () => {
  if (!confirm('Erase all solved levels and best scores?')) return;
  for (const k of Object.keys(progress)) delete progress[k];
  store.set('progress', progress);
  store.remove('summary');
  closeDialogs();
  loadLevel(0);
  toast('Progress erased.');
});

$('done-next').addEventListener('click', () => {
  closeDialogs();
  lastSolve = null;
  loadLevel(current + 1);
});
$('done-retry').addEventListener('click', () => {
  closeDialogs();
  lastSolve = null;
  loadLevel(current);
});
$('done-replay').addEventListener('click', () => {
  if (lastSolve) startReplay(lastSolve.lurd);
});
$('replay-stop').addEventListener('click', () => stopReplay(true));
$('replay-speed').addEventListener('click', (e) => {
  if (!replay) return;
  replay.speed = replay.speed >= 4 ? 1 : replay.speed * 2;
  e.currentTarget.textContent = `${replay.speed}×`;
});

/* ------------------------------------------------------------------ boot */

const ro = new ResizeObserver(() => {
  const r = canvas.getBoundingClientRect();
  renderer.resize(r.width, r.height);
});
ro.observe(canvas);
// Zooming changes devicePixelRatio without resizing the canvas box.
window.addEventListener('resize', () => {
  const r = canvas.getBoundingClientRect();
  renderer.resize(r.width, r.height);
});

async function boot() {
  const text = await fetch('levels/crate-lab.xsb').then((r) => {
    if (!r.ok) throw new Error(`levels: ${r.status}`);
    return r.text();
  });
  levels = parseCollection(text);
  setSound(settings.sound);
  const saved = Number(store.get('current', 0));
  loadLevel(Number.isInteger(saved) && saved >= 0 && saved < levels.length ? saved : 0);
  const r = canvas.getBoundingClientRect();
  renderer.resize(r.width, r.height);
  loop.start();
  const params = new URLSearchParams(location.search);
  if (params.has('level')) loadLevel(Math.max(0, Number(params.get('level')) - 1));
  else openLevels();
  // Read-only handle for automated play tests.
  window.crateLab = { get puzzle() { return puzzle; }, get levels() { return levels; }, get busy() { return !!(tween || activeAction || celebrate); }, get mode() { return mode; } };
}

boot().catch((err) => {
  console.error(err);
  $('brief').textContent = 'Could not load the levels. Serve this folder over http (for example python3 -m http.server) and reload.';
});

void touch;
