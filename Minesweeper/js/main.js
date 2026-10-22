/**
 * Minesweeper UI: DOM grid, input (mouse, touch, keyboard), layout and zoom,
 * dialogs, stats and feel. Game rules live in game.js.
 */

import { initShell } from '../../assets/kit/shell.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { CUSTOM, DAILY, FEEL, INPUT, PRESETS, PUZZLES, RULES, VIEW } from './config.js';
import { FLAG, Game, QUESTION } from './game.js';
import { seeded } from './rng.js';
import { sfx } from './audio.js';
import { createStats, formatTime, STAT_KEYS } from './stats.js';

initShell({ slug: 'minesweeper' });

const SLUG = 'minesweeper';
const store = createStore(SLUG);
const stats = createStats(store);
const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const coarse = matchMedia('(pointer: coarse)');

const board = $('board');
const field = $('field');
const settings = { noGuess: true, questions: false, rotate: true, ...(store.get('settings', {}) ?? {}) };
sfx.setMuted(store.get('muted', false));

let mode = store.get('mode', null) ?? { kind: 'preset', id: 'beginner' };
let custom = store.get('custom', null) ?? { w: 20, h: 12, mines: 40 };
let game = null;
let cells = [];
let rendered = [];
let cursor = 0;
let flagMode = false;
let statToken = null;
let hintSrc = [];
let zoomCell = null;
let cellSize = 32;
let view = { cols: 9, rows: 9, transposed: false };
let busy = false;
let pausedBy = new Set();

/* ---------- Modes ---------- */

const MODES = [
  { key: 'beginner', label: 'Beginner', sub: '9×9 · 10' },
  { key: 'intermediate', label: 'Intermed.', sub: '16×16 · 40', title: 'Intermediate' },
  { key: 'expert', label: 'Expert', sub: '30×16 · 99' },
  { key: 'custom', label: 'Custom', sub: '' },
  { key: 'daily', label: 'Daily', sub: 'same for all' },
  { key: 'puzzle', label: 'Puzzles', sub: '12 levels' },
];

const utcDate = () => new Date().toISOString().slice(0, 10);
const centre = (p) => Math.floor(p.h / 2) * p.w + Math.floor(p.w / 2);
const modeKey = () => (mode.kind === 'preset' ? mode.id : mode.kind);

function modeTitle() {
  if (mode.kind === 'preset') return PRESETS[mode.id].label;
  if (mode.kind === 'custom') return `Custom ${custom.w}×${custom.h}`;
  if (mode.kind === 'daily') return `Daily ${utcDate()}`;
  return `Puzzle ${mode.level}`;
}

function gameConfig() {
  switch (mode.kind) {
    case 'custom':
      return { ...custom, noGuess: settings.noGuess };
    case 'daily':
      return { ...DAILY, noGuess: true, rng: seeded(`daily-${utcDate()}`), start: centre(DAILY) };
    case 'puzzle': {
      const p = PUZZLES[mode.level - 1];
      return { ...p, noGuess: true, rng: seeded(`puzzle-${mode.level}`), start: centre(p), minPair: p.pair, maxOpen: p.open };
    }
    default:
      return { ...PRESETS[mode.id], noGuess: settings.noGuess };
  }
}

function setMode(next) {
  const before = game && `${game.w}x${game.h}`;
  mode = next;
  store.set('mode', mode);
  newGame();
  if (`${game.w}x${game.h}` !== before) {
    zoomCell = null;
    layout();
  }
}

function renderModes() {
  const nav = $('modes');
  if (!nav.children.length) {
    for (const m of MODES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mode';
      b.dataset.key = m.key;
      b.innerHTML = `${m.label}<small>${m.sub}</small>`;
      if (m.title) b.setAttribute('aria-label', m.title);
      b.addEventListener('click', () => {
        sfx.unlock();
        if (m.key === 'custom') openCustom();
        else if (m.key === 'puzzle') openPuzzles();
        else if (m.key === 'daily') setMode({ kind: 'daily' });
        else setMode({ kind: 'preset', id: m.key });
      });
      nav.append(b);
    }
  }
  for (const b of nav.children) {
    b.setAttribute('aria-pressed', String(b.dataset.key === modeKey()));
    if (b.dataset.key === 'custom') b.querySelector('small').textContent = `${custom.w}×${custom.h} · ${custom.mines}`;
    if (b.dataset.key === 'puzzle' && mode.kind === 'puzzle') b.querySelector('small').textContent = `level ${mode.level}`;
  }
}

/* ---------- Game lifecycle ---------- */

function newGame() {
  game = new Game(gameConfig());
  statToken = null;
  hintSrc = [];
  cursor = game.fixedStart >= 0 ? game.fixedStart : centre(game);
  board.classList.remove('won');
  buildBoard();
  layout();
  renderModes();
  update();
  showResult(null);
  if (game.preopened) animateOpen(game.preopened, game.fixedStart);
  status(introText());
}

function introText() {
  if (mode.kind === 'daily') {
    const best = store.get(`daily.${utcDate()}`, null);
    return `Daily board for <strong>${utcDate()}</strong> (UTC), the same for everyone.${best ? ` Your best today: <strong>${formatTime(best)}</strong>.` : ' The start is already open.'}`;
  }
  if (mode.kind === 'puzzle') {
    const p = PUZZLES[mode.level - 1];
    return `Puzzle ${mode.level}/${PUZZLES.length}: ${p.w}×${p.h}, ${p.mines} mines${p.pair ? `, needs pair logic at least ${p.pair}×` : ''}.`;
  }
  return game.noGuess
    ? 'No-guess is on: every board can be cleared by logic. The first click is always safe.'
    : 'No-guess is off: some boards will need a guess. The first click is always safe.';
}

function buildBoard() {
  board.textContent = '';
  const frag = document.createDocumentFragment();
  cells = new Array(game.n);
  for (let i = 0; i < game.n; i++) {
    const el = document.createElement('div');
    el.className = 'c';
    el.dataset.i = i;
    cells[i] = el;
    frag.append(el);
  }
  board.append(frag);
  rendered = new Array(game.n).fill('');
  view.transposed = null; // force positions on next layout
}

/* ---------- Layout and zoom ---------- */

function layout() {
  if (!game) return;
  const portrait = field.clientHeight > field.clientWidth * 1.05;
  const transposed = settings.rotate && portrait && game.w > game.h;
  if (transposed !== view.transposed) {
    view.transposed = transposed;
    for (let i = 0; i < game.n; i++) {
      const s = cells[i].style;
      if (transposed) {
        s.gridColumn = String(Math.floor(i / game.w) + 1);
        s.gridRow = String((i % game.w) + 1);
      } else {
        s.gridColumn = '';
        s.gridRow = '';
      }
    }
  }
  view.cols = transposed ? game.h : game.w;
  view.rows = transposed ? game.w : game.h;
  board.style.setProperty('--cols', view.cols);

  const cs = getComputedStyle(field);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 8;
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + 8;
  const fitW = (field.clientWidth - padX) / view.cols;
  const fitH = (field.clientHeight - padY) / view.rows;
  let auto = Math.min(fitW, fitH);
  // On touch, keep cells tappable: fill the width and scroll the rest inside the field.
  if (coarse.matches && auto < 26) auto = Math.max(auto, Math.min(fitW, 26));
  auto = clamp(Math.floor(auto), VIEW.minCell, VIEW.maxCell);
  applyCell(zoomCell ?? auto);
}

function applyCell(c) {
  cellSize = c;
  board.style.setProperty('--cell', `${c}px`);
  $('zoom').value = String(c);
}

function setZoom(c, ax, ay) {
  const old = cellSize;
  c = clamp(Math.round(c), VIEW.minCell, VIEW.maxCell);
  if (c === old) return;
  const r = field.getBoundingClientRect();
  ax ??= r.width / 2;
  ay ??= r.height / 2;
  const cx = field.scrollLeft + ax;
  const cy = field.scrollTop + ay;
  zoomCell = c;
  applyCell(c);
  const k = c / old;
  field.scrollLeft = cx * k - ax;
  field.scrollTop = cy * k - ay;
}

$('zoom').min = String(VIEW.minCell);
$('zoom').max = String(VIEW.maxCell);
$('zoom').addEventListener('input', (e) => setZoom(+e.target.value));

let layoutQueued = false;
const queueLayout = () => {
  if (layoutQueued) return;
  layoutQueued = true;
  requestAnimationFrame(() => {
    layoutQueued = false;
    layout();
  });
};
addEventListener('resize', queueLayout);
if (window.ResizeObserver) new ResizeObserver(queueLayout).observe(field);

/* ---------- Rendering ---------- */

function cellState(i) {
  const g = game;
  let cls = 'c';
  let txt = '';
  const lost = g.state === 'lost';
  if (g.open[i]) {
    const k = g.counts[i];
    cls += ' o';
    if (k) {
      cls += ` n${k}`;
      txt = String(k);
    }
  } else if (lost && g.mines[i] && g.mark[i] !== FLAG) {
    cls += ' o m';
    if (i === g.boom) cls += ' x';
  } else if (g.mark[i] === FLAG) {
    cls += ' f';
    if (lost && !g.mines[i]) cls += ' w';
  } else if (g.mark[i] === QUESTION) {
    cls += ' q';
    txt = '?';
  }
  if (i === cursor) cls += ' cur';
  if (i === g.hintCell && !g.open[i] && !g.over) cls += ' hint';
  if (hintSrc.includes(i) && g.hintCell !== undefined && !g.over) cls += ' src';
  return [cls, txt];
}

function update() {
  if (game.hintCell === undefined) hintSrc = [];
  for (let i = 0; i < game.n; i++) {
    const [cls, txt] = cellState(i);
    const key = cls + '|' + txt;
    if (rendered[i] === key) continue;
    rendered[i] = key;
    cells[i].className = cls;
    cells[i].textContent = txt;
  }
  const left = game.total - game.flags;
  $('mines-left').textContent = (left < 0 ? '-' : '') + String(Math.abs(left)).padStart(3, '0');
  $('btn-hint').disabled = game.state !== 'playing';
  renderFace();
  renderClock();
  renderNotes();
}

const FACES = {
  idle: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16" cy="16" r="4.5" fill="currentColor"/></svg>',
  won: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="currentColor"/><path d="M10.5 16.5l3.8 3.8 7.5-8" fill="none" stroke="#09090b" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lost: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2.5l11.7 6.75v13.5L16 29.5 4.3 22.75V9.25z" fill="none" stroke="#ff5d5d" stroke-width="2"/><path d="M11.5 11.5l9 9M20.5 11.5l-9 9" stroke="#ff5d5d" stroke-width="2.8" stroke-linecap="round"/></svg>',
};
let faceShown = '';
function renderFace() {
  const f = game.state === 'won' ? 'won' : game.state === 'lost' ? 'lost' : 'idle';
  if (f === faceShown) return;
  faceShown = f;
  $('btn-new').innerHTML = FACES[f];
}

function renderClock() {
  const s = game.seconds();
  $('clock').textContent = s < 1000 ? s.toFixed(1) : String(Math.floor(s));
  $('penalty').textContent = game.penalty ? `+${game.penalty}s` : '';
}

(function tick() {
  if (game?.clock.running) renderClock();
  requestAnimationFrame(tick);
})();

let notesKey = '';
function renderNotes() {
  const key = modeKey();
  const s = stats.get(key);
  const sig = key + JSON.stringify(s) + modeTitle();
  if (sig === notesKey) return;
  notesKey = sig;
  $('notes-title').textContent = modeTitle();
  $('notes-stats').innerHTML = `
    <dt>Played</dt><dd>${s.games}</dd>
    <dt>Won</dt><dd>${s.wins}</dd>
    <dt>Win rate</dt><dd>${s.games ? Math.round((s.wins / s.games) * 100) + '%' : '–'}</dd>
    <dt>Best time</dt><dd>${formatTime(s.best)}</dd>
    <dt>Streak</dt><dd>${s.streak}</dd>
    <dt>Longest streak</dt><dd>${s.bestStreak}</dd>`;
}

function status(html) {
  $('status').innerHTML = html;
}

/* ---------- Feel ---------- */

const animOK = () => !reduceMotion.matches;

function animateOpen(list, origin) {
  if (!animOK() || !list.length) return;
  const ox = origin % game.w;
  const oy = Math.floor(origin / game.w);
  const big = list.length > 1;
  for (const j of list) {
    const d = Math.max(Math.abs((j % game.w) - ox), Math.abs(Math.floor(j / game.w) - oy));
    const delay = Math.min(d * FEEL.cascadeStep, FEEL.cascadeMax);
    cells[j].animate(
      [
        { transform: 'scale(0.55)', opacity: 0.2, backgroundColor: 'rgba(250, 204, 21, 0.7)' },
        { transform: 'scale(1.06)', opacity: 1, backgroundColor: 'rgba(250, 204, 21, 0.18)', offset: 0.55 },
        { transform: 'scale(1)', opacity: 1, backgroundColor: '#0f1014' },
      ],
      { duration: big ? 300 : 160, delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' },
    );
  }
}

function animateMines(origin) {
  if (!animOK()) return;
  const ox = origin % game.w;
  const oy = Math.floor(origin / game.w);
  for (let j = 0; j < game.n; j++) {
    if (!game.mines[j] || game.mark[j] === FLAG || j === origin) continue;
    const d = Math.hypot((j % game.w) - ox, Math.floor(j / game.w) - oy);
    cells[j].animate(
      [
        { transform: 'scale(0.2)', opacity: 0 },
        { transform: 'scale(1.25)', opacity: 1, offset: 0.6 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: 260, delay: Math.min(d * FEEL.boomStep * 3, 900), easing: 'ease-out', fill: 'backwards' },
    );
  }
  field.classList.remove('shake');
  void field.offsetWidth;
  field.classList.add('shake');
}

function flashNeighbours(i) {
  for (const j of game.nb[i]) {
    if (game.open[j] || game.mark[j] === FLAG) continue;
    cells[j].classList.add('flash');
    setTimeout(() => cells[j]?.classList.remove('flash'), 220);
  }
}

function ensureVisible(i) {
  cells[i]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/* ---------- Actions ---------- */

function heavyBuild() {
  if (game.mines || !game.noGuess) return false;
  return game.total / game.n > 0.22 || game.n > 900;
}

function doReveal(i, built = false) {
  if (busy || game.over || i < 0) return;
  if (!built && heavyBuild()) {
    busy = true;
    field.classList.add('busy');
    setTimeout(() => {
      busy = false;
      field.classList.remove('busy');
      doReveal(i, true);
    }, 30);
    return;
  }
  const firstBuild = !game.mines;
  const res = game.reveal(i);
  if (firstBuild && game.genInfo?.failed) {
    status('<strong>No no-guess board found</strong> at this density in time; this one may need a guess.');
  } else if (firstBuild) {
    status(game.noGuess ? 'Board ready. Every cell can be found by logic from here.' : 'Board ready. Good luck.');
  }
  afterMove(res, i);
}

function doChord(i) {
  if (busy || game.over || i < 0 || !game.open[i]) return;
  afterMove(game.chord(i), i);
}

function doFlag(i) {
  if (busy || game.over || i < 0 || game.open[i]) return;
  const m = game.toggleMark(i, settings.questions);
  if (m === FLAG) {
    sfx.flag();
    if (animOK())
      cells[i].animate([{ transform: 'translateY(-30%) scale(1.3)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], {
        duration: 160,
        easing: 'cubic-bezier(.3,1.6,.5,1)',
      });
  } else sfx.unflag();
  update();
}

function afterMove(res, origin) {
  if (res.boom !== undefined) {
    sfx.boom();
    update();
    animateMines(res.boom);
    ensureVisible(res.boom);
    finish(false);
    return;
  }
  if (res.refused) {
    flashNeighbours(origin);
    sfx.refuse();
  }
  if (res.opened.length) {
    animateOpen(res.opened, origin);
    if (res.opened.length > 1) sfx.cascade(res.opened.length);
    else sfx.reveal();
  }
  update();
  if (game.state === 'won') {
    sfx.win();
    if (animOK()) board.classList.add('won');
    finish(true);
  }
}

function finish(won) {
  const sec = Math.round(game.seconds() * 10) / 10;
  const key = modeKey();
  const prev = stats.get(key).best;
  statToken = stats.record(key, won, sec);
  let isNew = false;
  if (won) {
    isNew = prev === null || sec < prev;
    const label = formatTime(sec);
    if (mode.kind === 'preset') isNew = recordBest(SLUG, sec, { lowerIsBetter: true, mode: mode.id, label }).isNew;
    if (mode.kind === 'daily') {
      recordBest(SLUG, sec, { lowerIsBetter: true, mode: 'daily', label });
      const k = `daily.${utcDate()}`;
      const old = store.get(k, null);
      isNew = old === null || sec < old;
      if (isNew) store.set(k, sec);
    }
    if (mode.kind === 'puzzle') {
      const prog = store.get('puzzles', {}) ?? {};
      isNew = prog[mode.level] === undefined || sec < prog[mode.level];
      if (isNew) prog[mode.level] = sec;
      store.set('puzzles', prog);
    }
  }
  showResult(won, sec, isNew);
  update();
}

function showResult(won, sec, isNew) {
  const box = $('result');
  const tools = $('toolset');
  if (won === null) {
    box.hidden = true;
    tools.hidden = false;
    return;
  }
  const s = stats.get(modeKey());
  box.className = `result ${won ? 'win' : 'lose'}`;
  const penalties = game.penalty ? ` incl. +${game.penalty}s` : '';
  if (won) {
    $('result-msg').innerHTML = `<b>Cleared${isNew ? '<span class="new-best">NEW BEST</span>' : ''}</b><span>${formatTime(sec)}${penalties} · best ${formatTime(s.best)} · streak ${s.streak}</span>`;
  } else {
    $('result-msg').innerHTML = game.canUndo()
      ? `<b>Detonated</b><span>Take back that click for +${RULES.undoPenalty}s, once per game.</span>`
      : `<b>Detonated</b><span>${formatTime(sec)} · streak reset · best ${formatTime(s.best)}</span>`;
  }
  $('btn-undo').hidden = !game.canUndo();
  const next = mode.kind === 'puzzle' && won && mode.level < PUZZLES.length;
  $('btn-again').textContent = next ? 'Next level' : mode.kind === 'daily' ? 'Replay' : 'Play again';
  $('btn-again').dataset.next = next ? '1' : '';
  box.hidden = false;
  tools.hidden = true;
}

function doUndo() {
  if (!game.canUndo()) return;
  game.undo();
  stats.revert(statToken);
  statToken = null;
  sfx.undo();
  field.classList.remove('shake');
  showResult(null);
  status(`Click taken back. +${RULES.undoPenalty}s. No more undos this game.`);
  update();
}

const RULE_TEXT = {
  single: 'one number settles it',
  pair: 'two neighbouring numbers together settle it',
  global: 'the mine counter settles it',
};

function doHint() {
  if (busy) return;
  if (game.state !== 'playing') {
    if (game.state === 'ready') status('Make the first move: the first click is always safe.');
    return;
  }
  const h = game.hint();
  if (!h) return;
  hintSrc = h.src ?? hintSrc;
  cursor = h.cell;
  ensureVisible(h.cell);
  sfx.hint();
  if (h.repeat) status('The glowing cell is still your hint.');
  else if (h.logical) status(`Hint: the glowing cell is safe, ${RULE_TEXT[h.rule]}. <strong>+${RULES.hintPenalty}s</strong>`);
  else status(`No logical move here, so this safe cell is a free pass. <strong>+${RULES.hintPenalty}s</strong>`);
  update();
}

$('btn-hint').addEventListener('click', doHint);
$('btn-undo').addEventListener('click', doUndo);
$('btn-again').addEventListener('click', () => {
  if ($('btn-again').dataset.next) setMode({ kind: 'puzzle', level: mode.level + 1 });
  else newGame();
});
$('btn-new').addEventListener('click', () => {
  sfx.unlock();
  newGame();
});

function setFlagMode(on) {
  flagMode = on;
  const b = $('btn-mode');
  b.setAttribute('aria-pressed', String(on));
  b.setAttribute('aria-label', `Tap action: ${on ? 'flag' : 'reveal'}. Press to switch.`);
}
$('btn-mode').addEventListener('click', () => {
  setFlagMode(!flagMode);
  sfx.unlock();
  if (!sfx.muted) flagMode ? sfx.flag() : sfx.reveal();
});

/* ---------- Pointer input ---------- */

let press = null;
let pinch = null;

const cellAt = (target) => {
  const el = target?.closest?.('.c');
  return el && el.parentNode === board ? +el.dataset.i : -1;
};

let pressed = [];
function showPress(i, chord) {
  for (const j of pressed) cells[j]?.classList.remove('press');
  pressed = [];
  if (i < 0 || game.over) return;
  const list = chord && game.open[i] ? [...game.nb[i]] : [i];
  for (const j of list) {
    if (game.open[j] || game.mark[j] === FLAG) continue;
    cells[j].classList.add('press');
    pressed.push(j);
  }
}

function endPress() {
  if (press?.timer) clearTimeout(press.timer);
  press = null;
  showPress(-1);
}

board.addEventListener('contextmenu', (e) => e.preventDefault());

board.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  const i = cellAt(e.target);
  if (i < 0) return;
  if (e.pointerType === 'mouse') {
    e.preventDefault();
    board.focus({ preventScroll: true });
    board.classList.remove('kbd');
    if (e.button === 2) {
      doFlag(i);
      press = { mouse: true, i, button: 2, chord: false };
    } else if (e.button === 1) {
      press = { mouse: true, i, button: 1, chord: true };
    } else if (e.button === 0) {
      press = { mouse: true, i, button: 0, chord: e.buttons === 3 };
    }
    if (press) showPress(i, press.chord || (press.button === 0 && game.open[i]));
    return;
  }
  if (!e.isPrimary || pinch) return;
  press = { touch: true, i, x: e.clientX, y: e.clientY, long: false };
  showPress(i, false);
  press.timer = setTimeout(() => {
    if (!press || press.i !== i) return;
    press.long = true;
    showPress(-1);
    navigator.vibrate?.(INPUT.vibrateMs);
    touchAction(i, true);
  }, INPUT.longPressMs);
});

board.addEventListener('pointermove', (e) => {
  if (!press) return;
  if (press.mouse) {
    if (e.buttons === 3) press.chord = true;
    press.i = cellAt(e.target);
    showPress(press.i, press.chord || (press.button === 0 && press.i >= 0 && game.open[press.i]));
    return;
  }
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > INPUT.moveTolerance) endPress();
});

board.addEventListener('pointerleave', (e) => {
  if (press?.mouse) {
    press.i = -1;
    showPress(-1);
  }
});

addEventListener('pointerup', (e) => {
  if (!press) return;
  const p = press;
  endPress();
  if (p.mouse) {
    if (p.i < 0) return;
    if (p.chord) doChord(p.i);
    else if (p.button === 0) doReveal(p.i);
    return;
  }
  if (!p.long && e.target && cellAt(e.target) === p.i) touchAction(p.i, false);
});
addEventListener('pointercancel', endPress);

/** Tap or long-press on a touch screen. The long press does the opposite of the tap mode. */
function touchAction(i, long) {
  if (game.open[i]) {
    if (!long) doChord(i);
    return;
  }
  const flag = flagMode !== long;
  if (flag) doFlag(i);
  else doReveal(i);
}

// Pinch to zoom inside the field (the page itself never zooms or scrolls).
const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
field.addEventListener(
  'touchstart',
  (e) => {
    if (e.touches.length === 2) {
      endPress();
      const r = field.getBoundingClientRect();
      pinch = {
        d: touchDist(e.touches),
        cell: cellSize,
        ax: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
        ay: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
      };
    }
  },
  { passive: true },
);
field.addEventListener(
  'touchmove',
  (e) => {
    if (!pinch || e.touches.length !== 2) return;
    if (e.cancelable) e.preventDefault();
    setZoom(pinch.cell * (touchDist(e.touches) / pinch.d), pinch.ax, pinch.ay);
  },
  { passive: false },
);
field.addEventListener('touchend', (e) => {
  if (e.touches.length < 2) pinch = null;
});

/* ---------- Keyboard ---------- */

function moveCursor(dx, dy) {
  if (view.transposed) [dx, dy] = [dy, dx];
  const x = clamp((cursor % game.w) + dx, 0, game.w - 1);
  const y = clamp(Math.floor(cursor / game.w) + dy, 0, game.h - 1);
  cursor = y * game.w + x;
  board.classList.add('kbd');
  update();
  ensureVisible(cursor);
  announce(cursor);
}

function announce(i) {
  const x = i % game.w;
  const y = Math.floor(i / game.w);
  const [col, row] = view.transposed ? [y, x] : [x, y];
  let what = 'hidden';
  if (game.open[i]) what = game.counts[i] ? String(game.counts[i]) : 'empty';
  else if (game.mark[i] === FLAG) what = 'flagged';
  else if (game.mark[i] === QUESTION) what = 'question mark';
  $('sr').textContent = `Row ${row + 1}, column ${col + 1}: ${what}`;
}

const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  if (e.target.matches?.('input, select, textarea')) return;
  const onBoard = e.target === board || e.target === document.body;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (ARROWS[k] && onBoard) {
    e.preventDefault();
    moveCursor(...ARROWS[k]);
  } else if ((k === ' ' || k === 'Enter') && onBoard) {
    e.preventDefault();
    sfx.unlock();
    board.classList.add('kbd');
    if (game.over) return;
    if (game.open[cursor]) doChord(cursor);
    else doReveal(cursor);
    announce(cursor);
  } else if (k === 'f') {
    board.classList.add('kbd');
    doFlag(cursor);
    announce(cursor);
  } else if (k === 'c') {
    doChord(cursor);
  } else if (k === 'h') {
    doHint();
  } else if (k === 'u') {
    doUndo();
  } else if (k === 'n') {
    newGame();
  } else return;
});

/* ---------- Pause when hidden or behind a dialog ---------- */

function pause(reason) {
  if (game?.clock.running) {
    game.stopClock();
    pausedBy.add(reason);
  }
}
function resume(reason) {
  if (!pausedBy.delete(reason) || pausedBy.size) return;
  if (game?.state === 'playing') game.startClock();
}
document.addEventListener('visibilitychange', () => (document.hidden ? pause('hidden') : resume('hidden')));

/* ---------- Dialogs ---------- */

function openDialog(d) {
  pause('dialog');
  d.showModal();
}
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('close', () => {
    resume('dialog');
    board.focus({ preventScroll: true });
  });
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close(); // backdrop
  });
  for (const b of d.querySelectorAll('[data-close]')) b.addEventListener('click', () => d.close());
}

// Settings
const SET_IDS = { noGuess: 'set-noguess', questions: 'set-questions', rotate: 'set-rotate' };
$('btn-settings').addEventListener('click', () => {
  for (const [k, id] of Object.entries(SET_IDS)) $(id).checked = !!settings[k];
  $('set-sound').checked = !sfx.muted;
  openDialog($('dlg-settings'));
});
for (const [k, id] of Object.entries(SET_IDS)) {
  $(id).addEventListener('change', (e) => {
    settings[k] = e.target.checked;
    store.set('settings', settings);
    if (k === 'rotate') layout();
    if (k === 'noGuess' && game.state === 'ready' && !game.mines) newGame();
  });
}
$('set-sound').addEventListener('change', (e) => setMuted(!e.target.checked));

// Sound
const SOUND_ICON = {
  on: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  off: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/></svg>',
};
function setMuted(m) {
  sfx.setMuted(m);
  store.set('muted', m);
  const b = $('btn-sound');
  b.innerHTML = SOUND_ICON[m ? 'off' : 'on'];
  b.setAttribute('aria-pressed', String(m));
  b.setAttribute('aria-label', m ? 'Unmute sound' : 'Mute sound');
}
$('btn-sound').addEventListener('click', () => {
  setMuted(!sfx.muted);
  if (!sfx.muted) {
    sfx.unlock();
    sfx.flag();
  }
});
setMuted(sfx.muted);

// Stats
function renderStats() {
  $('stats-body').innerHTML = STAT_KEYS.map(([key, label]) => {
    const s = stats.get(key);
    const pct = s.games ? Math.round((s.wins / s.games) * 100) + '%' : '–';
    return `<tr><th scope="row">${label}</th><td>${s.games}</td><td>${s.wins}</td><td>${pct}</td><td>${formatTime(s.best)}</td><td>${s.streak} / ${s.bestStreak}</td></tr>`;
  }).join('');
}
$('btn-stats').addEventListener('click', () => {
  renderStats();
  openDialog($('dlg-stats'));
});
$('btn-reset-stats').addEventListener('click', () => {
  if (!confirm('Reset all Minesweeper statistics?')) return;
  stats.reset();
  renderStats();
  notesKey = '';
  renderNotes();
});

// Custom
function readCustom() {
  const w = Number($('cw').value);
  const h = Number($('ch').value);
  const m = Number($('cm').value);
  const errs = [];
  const bad = { cw: false, ch: false, cm: false };
  if (!Number.isInteger(w) || w < CUSTOM.minSide || w > CUSTOM.maxW) {
    errs.push(`Width must be a whole number from ${CUSTOM.minSide} to ${CUSTOM.maxW}.`);
    bad.cw = true;
  }
  if (!Number.isInteger(h) || h < CUSTOM.minSide || h > CUSTOM.maxH) {
    errs.push(`Height must be a whole number from ${CUSTOM.minSide} to ${CUSTOM.maxH}.`);
    bad.ch = true;
  }
  const maxM = bad.cw || bad.ch ? null : w * h - CUSTOM.safeZone;
  if (!Number.isInteger(m) || m < CUSTOM.minMines || (maxM !== null && m > maxM)) {
    errs.push(`Mines must be a whole number from ${CUSTOM.minMines} to ${maxM ?? 'width × height − 9'}.`);
    bad.cm = true;
  }
  for (const [id, b] of Object.entries(bad)) $(id).setAttribute('aria-invalid', String(b));
  return { w, h, mines: m, errs };
}
function refreshCustom() {
  const c = readCustom();
  $('custom-err').textContent = c.errs[0] ?? '';
  const info = $('custom-info');
  info.classList.remove('warn');
  if (c.errs.length) {
    info.textContent = '';
  } else {
    const density = c.mines / (c.w * c.h);
    const limit = c.w * c.h > CUSTOM.largeBoard ? CUSTOM.noGuessMaxDensityLarge : CUSTOM.noGuessMaxDensity;
    const dense = settings.noGuess && density > limit;
    info.textContent = `${c.w * c.h} cells, ${Math.round(density * 100)}% mines. ` +
      (!settings.noGuess ? 'No-guess is off.' : dense ? 'Very dense: a no-guess board may not be found, and you may need to guess.' : 'No-guess board.');
    if (dense) info.classList.add('warn');
  }
  $('custom-go').disabled = c.errs.length > 0;
  return c;
}
function openCustom() {
  $('cw').value = custom.w;
  $('ch').value = custom.h;
  $('cm').value = custom.mines;
  $('cw').max = CUSTOM.maxW;
  $('ch').max = CUSTOM.maxH;
  for (const id of ['cw', 'ch', 'cm']) $(id).min = id === 'cm' ? CUSTOM.minMines : CUSTOM.minSide;
  refreshCustom();
  openDialog($('dlg-custom'));
}
$('custom-form').addEventListener('input', refreshCustom);
$('custom-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const c = refreshCustom();
  if (c.errs.length) return;
  custom = { w: c.w, h: c.h, mines: c.mines };
  store.set('custom', custom);
  $('dlg-custom').close();
  setMode({ kind: 'custom' });
});

// Puzzles
function openPuzzles() {
  const prog = store.get('puzzles', {}) ?? {};
  const maxPair = Math.max(...PUZZLES.map((p) => p.pair), 1);
  $('levels').innerHTML = PUZZLES.map((p, k) => {
    const n = k + 1;
    const open = n === 1 || prog[n - 1] !== undefined;
    const done = prog[n] !== undefined;
    const density = p.mines / (p.w * p.h);
    // Difficulty meter: five bars from density and required logic together.
    const score = Math.round(((density - 0.1) / 0.1) * 2 + (p.pair / maxPair) * 3);
    const bars = Array.from({ length: 5 }, (_, b) => `<i class="${b < Math.max(1, score) ? 'on' : ''}" style="height:${40 + b * 15}%"></i>`).join('');
    return `<button type="button" class="level${done ? ' done' : ''}" data-level="${n}" ${open ? '' : 'disabled'}
      aria-label="Level ${n}, ${p.w} by ${p.h}, ${p.mines} mines${done ? `, best ${formatTime(prog[n])}` : open ? '' : ', locked'}">
      <span class="num">${String(n).padStart(2, '0')}</span>
      <span class="meter" aria-hidden="true">${bars}</span>
      <small>${p.w}×${p.h} · ${p.mines}</small>
      <small>${done ? formatTime(prog[n]) : open ? 'open' : 'locked'}</small>
    </button>`;
  }).join('');
  openDialog($('dlg-puzzles'));
}
$('levels').addEventListener('click', (e) => {
  const b = e.target.closest('.level');
  if (!b || b.disabled) return;
  $('dlg-puzzles').close();
  setMode({ kind: 'puzzle', level: +b.dataset.level });
});

/* ---------- Start ---------- */

if (mode.kind === 'puzzle' && !PUZZLES[mode.level - 1]) mode = { kind: 'puzzle', level: 1 };
if (mode.kind === 'preset' && !PRESETS[mode.id]) mode = { kind: 'preset', id: 'beginner' };
setFlagMode(false);
newGame();
board.focus({ preventScroll: true });

// Small hook for automated checks.
window.__ms = {
  get game() {
    return game;
  },
  get view() {
    return { ...view, cell: cellSize };
  },
};
