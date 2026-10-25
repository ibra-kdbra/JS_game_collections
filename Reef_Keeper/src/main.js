import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { FRAME, BAR, TANK, LEVELS, HARD_LEVELS, WORLDS, LEVELS_PER_WORLD, PETS, MAX_PETS, FISH, ALIENS, POTION, ENDLESS, FREE } from './config.js';
import { PARS } from './pars.js';
import { createWorld } from './sim.js';
import { createRenderer, slotRect, MENU } from './render.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';

const SLUG = 'reef-keeper';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const params = new URLSearchParams(location.search);
// ?speed=N runs N steps per tick, for testing.
const SPEED = Math.max(1, Math.min(20, +params.get('speed') || 1));

initShell({ slug: SLUG });
const store = createStore(SLUG);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const audio = createAudio({ muted: store.get('muted', false), music: store.get('music', true) });
const fx = createFx({ reducedMotion });
const canvas = $('game');
const renderer = createRenderer(canvas);

/* ---------- Progress ---------- */

const progress = store.get('progress2', { levels: {}, seen: [], endless: { wave: 0, earned: 0 }, tutorialDone: false, petChoice: [] });
const save = () => store.set('progress2', progress);
const listFor = (mode) => (mode === 'hard' ? HARD_LEVELS : LEVELS);
const cleared = (def) => progress.levels[def.id] !== undefined;
const isOpen = (def) => {
  if (def.mode === 'hard' && !cleared(LEVELS[LEVELS_PER_WORLD - 1])) return false;
  return def.index === 0 || cleared(listFor(def.mode)[def.index - 1]) || cleared(def);
};
const petsOwned = () => LEVELS.filter((L) => L.hatch && cleared(L)).map((L) => L.hatch);
const totalStars = () => Object.values(progress.levels).reduce((a, l) => a + (l.stars ?? 0), 0);

function starsFor(def, minutes) {
  const par = PARS[def.id] ?? 6;
  return minutes <= par * 1.25 ? 3 : minutes <= par * 1.75 ? 2 : 1;
}

/* ---------- Descriptions ---------- */

const ITEMS = {
  guppy: [FISH.guppy.name, FISH.guppy.what],
  quality: ['Better food', 'Fills fish up for longer. Capsules also grow them twice as fast.'],
  count: ['More food', 'Drop one more piece at a time.'],
  weapon: ['Zapper', 'Each zap hits aliens harder.'],
  egg: ['Egg piece', 'Buy all three to clear the level.'],
  potion: [POTION.name, POTION.what],
};
for (const id of Object.keys(FISH)) ITEMS[id] = [FISH[id].name, FISH[id].what];
ITEMS.more = ['More', 'Show the rest of the shop.'];
const describe = (id) => ITEMS[id] ?? (ALIENS[id] ? [ALIENS[id].name, ALIENS[id].what] : PETS[id] ? [PETS[id].name, PETS[id].what] : [id, '']);

/* ---------- State ---------- */

let screen = 'title';
let def = LEVELS[0];
let world = createWorld({ def: LEVELS[0], seed: 7, pets: ['snail'] });
let playing = false;
let tick = 0;
let cardT = 0;
let chosenPets = [];
let newQueue = [];
let tutorial = null; // { step, t }
/** The shop bar holds eight buttons; longer shops page through with a More button. */
function visibleShop(items) {
  if (items.length <= 8) return items;
  const per = 7;
  const pages = Math.ceil(items.length / per);
  ui.page %= pages;
  return [...items.slice(ui.page * per, ui.page * per + per), { id: 'more', cost: 0, level: null, maxed: false, affordable: true }];
}

const ui = { page: 0, hover: null, pressed: null, pressedT: 0, flashSlot: null, flashT: 0, moneyFlash: 0, money: world.money, shop: [], tip: null, hint: null };

/* ---------- Layout ---------- */

const portrait = matchMedia('(orientation: portrait) and (pointer: coarse)');
function layout() {
  const w = document.documentElement.clientWidth || innerWidth;
  const h = window.visualViewport?.height ?? innerHeight;
  renderer.resize(w, h, Math.min(devicePixelRatio || 1, 2));
  $('rotateHint').hidden = !(portrait.matches && playing && !store.get('rotateHintSeen', false));
}
addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);
$('rotateHint').addEventListener('click', () => {
  store.set('rotateHintSeen', true);
  $('rotateHint').hidden = true;
});

/* ---------- Screens ---------- */

const SCREENS = { title: 'screenTitle', modes: 'screenModes', levels: 'screenLevels', pets: 'screenPets', help: 'screenHelp', pause: 'screenPause', result: 'screenResult', new: 'screenNew' };

function show(name) {
  screen = name;
  for (const [k, id] of Object.entries(SCREENS)) $(id).hidden = k !== name;
  if (name !== 'play') $(SCREENS[name])?.querySelector('button.btn--primary, button')?.focus({ preventScroll: true });
  layout();
}

const iconCache = {};
function iconUrl(id) {
  if (!iconCache[id]) iconCache[id] = renderer.iconCanvas(id, 64).toDataURL();
  return iconCache[id];
}

function refreshTitle() {
  const next = LEVELS.find((L) => !cleared(L) && isOpen(L));
  $('btnPlay').textContent = !progress.tutorialDone ? 'Play' : next ? `Play · ${next.name}` : 'Play';
  const n = LEVELS.filter(cleared).length;
  const stars = totalStars();
  $('titleBest').textContent = n ? `${n} of ${LEVELS.length} levels · ${stars} ★ · ${petsOwned().length} pets` : '';
}

/* ---------- Level select ---------- */

let levelMode = 'normal';
let levelWorld = 0;

function buildLevels() {
  const list = listFor(levelMode);
  $('levelsHeading').textContent = levelMode === 'hard' ? 'Hard' : 'Campaign';
  const tabs = $('worldTabs');
  tabs.innerHTML = '';
  WORLDS.forEach((W, w) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(w === levelWorld));
    b.textContent = `${w + 1}. ${W.name}`;
    b.disabled = !isOpen(list[w * LEVELS_PER_WORLD]);
    b.addEventListener('click', () => {
      levelWorld = w;
      buildLevels();
    });
    tabs.append(b);
  });
  const grid = $('levelGrid');
  grid.innerHTML = '';
  for (let n = 0; n < LEVELS_PER_WORLD; n++) {
    const L = list[levelWorld * LEVELS_PER_WORLD + n];
    const rec = progress.levels[L.id];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `level-btn${L.hatch && !rec ? ' has-pet' : ''}`;
    b.disabled = !isOpen(L);
    const stars = rec ? '★'.repeat(rec.stars) + '☆'.repeat(3 - rec.stars) : L.hatch ? 'PET' : '☆☆☆';
    b.innerHTML = `${L.name}<small class="${rec ? 'on' : ''}">${stars}</small>`;
    b.setAttribute('aria-label', `Level ${L.name}${rec ? `, ${rec.stars} stars` : ''}${L.hatch && !rec ? ', hatches a pet' : ''}${b.disabled ? ', locked' : ''}`);
    b.addEventListener('click', () => choosePets(L));
    grid.append(b);
  }
  const got = list.reduce((a, L) => a + (progress.levels[L.id]?.stars ?? 0), 0);
  $('starsLine').textContent = `${got} of ${list.length * 3} stars${levelMode === 'normal' ? ` · ${petsOwned().length} of 10 pets` : ''}`;
}

function openLevels(mode) {
  levelMode = mode;
  const list = listFor(mode);
  const next = list.find((L) => !cleared(L) && isOpen(L)) ?? list[0];
  levelWorld = next.world;
  buildLevels();
  show('levels');
}

/* ---------- Pets ---------- */

let pendingDef = null;
function choosePets(L) {
  pendingDef = L;
  const owned = petsOwned();
  if (owned.length <= MAX_PETS) {
    chosenPets = owned;
    return startDef(L);
  }
  chosenPets = progress.petChoice.filter((p) => owned.includes(p)).slice(0, MAX_PETS);
  const grid = $('petGrid');
  grid.innerHTML = '';
  for (const kind of owned) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pet-pick';
    b.setAttribute('aria-pressed', String(chosenPets.includes(kind)));
    b.innerHTML = `<img alt="" src="${iconUrl(kind)}"><span><b>${PETS[kind].name}</b>${PETS[kind].what}</span>`;
    b.addEventListener('click', () => {
      if (chosenPets.includes(kind)) chosenPets = chosenPets.filter((p) => p !== kind);
      else if (chosenPets.length < MAX_PETS) chosenPets.push(kind);
      else return;
      b.setAttribute('aria-pressed', String(chosenPets.includes(kind)));
    });
    grid.append(b);
  }
  show('pets');
}

$('btnPetsGo').addEventListener('click', () => {
  progress.petChoice = chosenPets.slice();
  save();
  startDef(pendingDef);
});
$('petsBack').addEventListener('click', () => openLevels(levelMode));

/* ---------- Starting and finishing ---------- */

function startDef(d, { forceTutorial = false } = {}) {
  audio.unlock();
  def = d;
  const pets = d.endless || d.free ? petsOwned().slice(0, MAX_PETS) : chosenPets;
  world = createWorld({ def: d, seed: (Date.now() & 0xffff) || 1, pets });
  fx.clear();
  ui.page = 0;
  ui.money = world.money;
  playing = true;
  cardT = 170;
  $('cardKicker').textContent = d.endless ? 'Endless' : d.free ? 'Free tank' : `${d.mode === 'hard' ? 'Hard ' : 'Level '}${d.name}`;
  $('cardTitle').textContent = d.endless ? 'Survive!' : d.free ? 'Relax' : d.worldName;
  $('cardTip').textContent = d.endless ? 'Aliens keep coming, faster each wave.' : d.free ? 'No aliens. Buy any fish you like.' : `Egg pieces $${fmt(d.egg)} each`;
  $('card').hidden = false;
  audio.setMood('calm');
  audio.startMusic();
  tutorial = null;
  if ((d.id === LEVELS[0].id && !progress.tutorialDone) || forceTutorial) {
    tutorial = { step: 0, t: 0 };
    cardT = 0;
    $('card').hidden = true;
  }
  // Cards for anything new in this level's shop (aliens get theirs when they arrive).
  newQueue = [];
  // (Not in the free tank or endless: they open with the whole shop at once.)
  if (!tutorial && !d.free && !d.endless) for (const id of d.shop) if (!['guppy', 'quality', 'count', 'egg'].includes(id)) queueNew(id);
  for (const p of pets) queueNew(p);
  show('play');
  showNextNew();
}

function queueNew(id) {
  if (progress.seen.includes(id) || newQueue.includes(id)) return;
  newQueue.push(id);
}

function showNextNew() {
  if (!newQueue.length || screen !== 'play') return;
  const id = newQueue.shift();
  progress.seen.push(id);
  save();
  const [name, what] = describe(id);
  const art = $('newArt');
  const g = art.getContext('2d');
  g.clearRect(0, 0, art.width, art.height);
  g.drawImage(renderer.iconCanvas(id, 80), 0, 0, art.width, art.height);
  $('newHeading').textContent = name;
  $('newWhat').textContent = what;
  show('new');
}

$('btnNewOk').addEventListener('click', () => {
  show('play');
  showNextNew();
});

function finish(outcome) {
  playing = false;
  tutorial = null;
  ui.hint = null;
  $('card').hidden = true;
  const minutes = world.time / 3600;
  $('hatch').hidden = true;
  $('resultStars').innerHTML = '';
  $('btnNext').hidden = true;
  if (def.endless) {
    const best = progress.endless;
    const isBest = world.wave > best.wave || (world.wave === best.wave && world.stats.earned > best.earned);
    if (isBest) progress.endless = { wave: world.wave, earned: world.stats.earned };
    save();
    $('resultKicker').textContent = 'Endless';
    $('resultHeading').textContent = `${world.wave} waves`;
    $('resultLine').textContent = `Survived ${minutes.toFixed(1)} minutes and earned $${fmt(world.stats.earned)}${isBest ? ' · new best!' : ''}`;
  } else if (outcome === 'clear') {
    const stars = starsFor(def, minutes);
    const prev = progress.levels[def.id];
    const firstClear = !prev;
    progress.levels[def.id] = { min: prev ? Math.min(prev.min, minutes) : minutes, stars: Math.max(prev?.stars ?? 0, stars) };
    save();
    recordBest(SLUG, totalStars(), { label: `${totalStars()} stars` });
    $('resultKicker').textContent = `${def.mode === 'hard' ? 'Hard ' : 'Level '}${def.name} · ${def.worldName}`;
    $('resultHeading').textContent = 'Level cleared!';
    $('resultStars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
    $('resultStars').setAttribute('aria-label', `${stars} of 3 stars`);
    const par = PARS[def.id];
    $('resultLine').textContent = `${minutes.toFixed(1)} min${par ? ` · 3 stars under ${(par * 1.25).toFixed(1)} min` : ''}`;
    if (def.hatch && firstClear) {
      const art = $('hatchArt');
      const g = art.getContext('2d');
      g.clearRect(0, 0, art.width, art.height);
      g.drawImage(renderer.iconCanvas(def.hatch, 80), 0, 0, art.width, art.height);
      $('hatchLine').textContent = `The egg hatched ${PETS[def.hatch].name}! ${PETS[def.hatch].what}`;
      $('hatch').hidden = false;
    }
    const list = listFor(def.mode);
    $('btnNext').hidden = def.index >= list.length - 1;
  } else {
    $('resultKicker').textContent = def.free ? 'Free tank' : `Level ${def.name}`;
    $('resultHeading').textContent = 'Tank empty';
    $('resultLine').textContent = 'No fish left and not enough money for a new one.';
  }
  audio.stopMusic();
  refreshTitle();
  setTimeout(() => show('result'), outcome === 'clear' ? 900 : 600);
}

function pause(on) {
  if (on && screen === 'play' && playing) {
    show('pause');
    audio.suspend(true);
  } else if (!on && screen === 'pause') {
    show('play');
    audio.suspend(false);
  }
}

/* ---------- Tutorial ---------- */

// Each step: a hint, and what moves it on ('tap' waits for a click on the hint).
const TUTORIAL = [
  { text: 'Welcome to your tank! Your fish are hungry. Click the water to drop food.', on: 'food', target: () => ({ x: 320, y: 200 }) },
  { text: 'Fish eat when they are hungry, then grow. Keep feeding them until one drops a coin.', on: 'drop' },
  { text: 'A coin! Click it before it fades on the sand.', on: 'coin', target: () => { const c = world.coins[0]; return c ? { x: c.x, y: c.y } : null; } },
  { text: 'Coins buy things in the shop up here. Buy another guppy.', on: 'buy:guppy', target: () => slotCenter('guppy'), boxY: 120 },
  { text: 'Watch out: hungry fish turn olive and open their mouths. Starving fish tremble and show a red !. Feed them or they die.', on: 'tap' },
  { text: 'Better food keeps fish full for longer. More food lets you drop more at once.', on: 'tap', target: () => slotCenter('quality'), boxY: 120 },
  { text: 'Save up and buy all three egg pieces to clear the level. Good luck!', on: 'tap', target: () => slotCenter('egg'), boxY: 120 },
];

function slotCenter(id) {
  const i = ui.shop.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const r = slotRect(i);
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 + 4 };
}

function tutorialStep(events) {
  if (!tutorial) return;
  const step = TUTORIAL[tutorial.step];
  tutorial.t++;
  // Be gentle while learning: nobody starves, and there's money for a guppy.
  for (const f of world.fish) f.starveAt = Math.max(f.starveAt, world.time + 1500);
  if (tutorial.step === 0) for (const f of world.fish) f.fedUntil = Math.min(f.fedUntil, world.time);
  if (step.on === 'buy:guppy' && world.money < FISH.guppy.cost) world.money = FISH.guppy.cost;
  const done = events.some((e) => (step.on === 'buy:guppy' ? e.type === 'buy' && e.id === 'guppy' : e.type === step.on));
  if (done) advanceTutorial();
  const s = TUTORIAL[tutorial?.step];
  if (!s) return;
  const target = s.target?.();
  ui.hint = { text: s.text, tap: s.on === 'tap', boxY: s.boxY ?? (target && target.y > 260 ? 110 : 300), ...(target ? { x: target.x, y: target.y } : {}) };
}

function advanceTutorial() {
  tutorial.step++;
  tutorial.t = 0;
  if (tutorial.step >= TUTORIAL.length) {
    tutorial = null;
    ui.hint = null;
    progress.tutorialDone = true;
    save();
  }
}

/* ---------- Feedback for what happened in the world ---------- */

const COIN_COLOR = { silver: '#e3e9f0', gold: '#ffd84a', star: '#fff36b', diamond: '#7fe6ff', pearl: '#ffffff', chest: '#ffd84a' };

function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'food':
        audio.play('food');
        fx.ring(e.x, e.y);
        fx.bubbles(e.x, e.y, 2);
        break;
      case 'full':
        audio.play('nope');
        fx.ring(e.x, e.y, 'rgba(255,170,60,0.95)');
        fx.popup(e.x, e.y - 10, 'MAX FOOD', '#ffb02e', 16);
        flashSlot('count');
        break;
      case 'broke':
      case 'cantBuy':
        audio.play('nope');
        ui.moneyFlash = 24;
        if (e.type === 'broke') fx.popup(e.x, e.y - 10, 'NO MONEY', '#ff6b6b', 16);
        break;
      case 'eat':
        audio.play('eat');
        fx.bubbles(e.x, e.y, 3);
        break;
      case 'grow':
      case 'birth':
        audio.play('grow');
        fx.stars(e.x, e.y, e.type === 'birth' ? ['#ff8fc7', '#ffffff'] : ['#ffffff', '#ffe14d'], 8, 2);
        break;
      case 'star':
        audio.play('grow');
        fx.stars(e.x, e.y, ['#fff36b', '#ffffff', '#ffb02e'], 14, 3);
        fx.popup(e.x, e.y - 20, 'STAR GUPPY!', '#fff36b', 16);
        break;
      case 'coin':
        audio.play('coin', e.coin);
        fx.fly(e.coin, e.x, e.y);
        fx.popup(e.x, e.y - 14, `+$${e.value}`, COIN_COLOR[e.coin], 20);
        fx.stars(e.x, e.y, [COIN_COLOR[e.coin], '#ffffff'], 6, 1.6);
        break;
      case 'land':
        fx.burst(e.x, e.y + 8, ['rgba(255,240,200,0.8)'], 4, 0.8);
        break;
      case 'starve':
        audio.play('starve');
        fx.bubbles(e.x, e.y, 6);
        break;
      case 'revive':
        audio.play('grow');
        fx.stars(e.x, e.y, ['#ffffff', '#cfe8ff', '#ffe14d'], 12, 2.4);
        fx.popup(e.x, e.y - 20, 'SAVED!', '#cfe8ff', 16);
        break;
      case 'gulp':
        audio.play('gulp');
        fx.bubbles(e.x, e.y, 8);
        if (e.by === 'alien' || e.by === 'bomb') fx.shake(3, 10);
        break;
      case 'boom':
        audio.play('gulp');
        fx.burst(e.x, e.y, ['#ff9f43', '#ffe14d', '#555555'], 16, 3);
        fx.shake(3, 8);
        break;
      case 'pop':
        audio.play('hit');
        fx.burst(e.x, e.y, ['#ffffff', '#cccccc'], 8, 2);
        break;
      case 'pearl':
        audio.play('coin', 'pearl');
        fx.stars(e.x, e.y - 10, ['#ffffff', '#e6d5f2'], 8, 1.6);
        break;
      case 'petFood':
      case 'recycle':
      case 'grub':
        fx.bubbles(e.x, e.y, 3);
        break;
      case 'warning':
        audio.play('warning');
        break;
      case 'alien':
        audio.play('invader');
        audio.setMood('tense');
        fx.shake(5, 18);
        if (!progress.seen.includes(e.kind)) {
          queueNew(e.kind);
          showNextNew();
        }
        break;
      case 'ink':
        fx.burst(e.x, e.y, ['#2a1f3d', '#3d2f5a'], 18, 2.5);
        break;
      case 'zap':
        audio.play('hit');
        fx.stars(e.tx, e.ty, ['#78dcff', '#ffffff'], 5, 2);
        break;
      case 'hit':
        audio.play('hit');
        fx.stars(e.x, e.y, ['#ffffff', '#ffe14d', '#ff9f43'], 6, 2.6);
        fx.popup(e.x + 14, e.y - 16, `-${e.damage}`, '#ffffff', 16);
        fx.shake(1.5, 4);
        break;
      case 'heal':
        audio.play('nope');
        fx.popup(e.x, e.y - 50, 'SHIELD! WAIT!', '#78dcff', 16);
        break;
      case 'bounce':
        audio.play('nope');
        fx.popup(e.x, e.y - 20, 'FEED IT!', '#ffb02e', 16);
        break;
      case 'gorge':
        audio.play('eat');
        break;
      case 'miss':
        fx.ring(e.x, e.y, 'rgba(255,90,90,0.9)', 12);
        break;
      case 'defeat':
        audio.play('defeat');
        if (!world.aliens.length) audio.setMood('calm');
        fx.stars(e.x, e.y, ['#c78cf0', '#ffffff', '#ffe14d'], 16, 3.5);
        fx.shake(4, 14);
        break;
      case 'wave':
        fx.popup(FRAME.w / 2, TANK.y + 120, `WAVE ${e.wave} CLEARED`, '#ffe14d', 26);
        break;
      case 'buy':
        audio.play('buy');
        flashSlot(e.id);
        if (e.x !== undefined) {
          audio.play('splash');
          fx.ring(e.x, TANK.surface + 4, 'rgba(255,255,255,0.9)', 22);
          fx.bubbles(e.x, TANK.surface + 10, 8);
        }
        break;
      case 'clear':
        audio.play('clear');
        fx.stars(FRAME.w / 2, TANK.y + 140, ['#ffe14d', '#ffffff', '#ffb02e'], 24, 4);
        finish('clear');
        break;
      case 'lost':
        finish('lost');
        break;
    }
  }
}

function flashSlot(id) {
  const i = ui.shop.findIndex((s) => s.id === id);
  if (i >= 0) {
    ui.flashSlot = i;
    ui.flashT = 10;
  }
}

/* ---------- Input ---------- */

function slotAt(p) {
  if (p.y >= BAR.h) return null;
  if (p.x >= MENU.x && p.x <= MENU.x + MENU.w && p.y >= MENU.y && p.y <= MENU.y + MENU.h) return 'menu';
  for (let i = 0; i < ui.shop.length; i++) {
    const r = slotRect(i);
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) return i;
  }
  return null;
}

function framePoint(e) {
  const r = canvas.getBoundingClientRect();
  return renderer.toFrame(e.clientX - r.left, e.clientY - r.top);
}

canvas.addEventListener('pointerdown', (e) => {
  if (screen !== 'play' || !playing) return;
  audio.unlock();
  const p = framePoint(e);
  if (p.x < 0 || p.x > FRAME.w || p.y < 0 || p.y > FRAME.h) return;
  if (cardT > 20) cardT = 20;
  if (tutorial && TUTORIAL[tutorial.step].on === 'tap' && tutorial.t > 20) {
    advanceTutorial();
    return;
  }
  const slot = slotAt(p);
  if (slot === 'menu') return pause(true);
  if (slot !== null && ui.shop[slot]?.id === 'more') {
    ui.page++;
    ui.shop = visibleShop(world.shop());
    audio.play('buy');
  } else if (slot !== null) {
    ui.pressed = slot;
    ui.pressedT = 6;
    world.buy(ui.shop[slot].id);
  } else if (p.y >= BAR.h) {
    world.click(p.x, p.y);
  }
  const events = world.events.slice();
  handleEvents();
  if (tutorial) tutorialStep(events);
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const p = framePoint(e);
  const slot = screen === 'play' ? slotAt(p) : null;
  ui.hover = slot;
  canvas.classList.toggle('is-pointer', slot !== null);
  if (typeof slot === 'number' && ui.shop[slot]) {
    const [title, body] = describe(ui.shop[slot].id);
    const r = slotRect(slot);
    ui.tip = { x: r.x + r.w / 2, y: BAR.h + 6, title, body };
  } else ui.tip = null;
});

canvas.addEventListener('pointerleave', () => {
  ui.hover = null;
  ui.tip = null;
});

addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (screen === 'play') pause(true);
    else if (screen === 'pause') pause(false);
    else if (['help', 'levels', 'modes'].includes(screen)) show('title');
    e.preventDefault();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  } else if (screen === 'play' && playing && /^[1-9]$/.test(e.key)) {
    const item = ui.shop[+e.key - 1];
    if (item?.id === 'more') {
      ui.page++;
      ui.shop = visibleShop(world.shop());
    } else if (item) {
      ui.pressed = +e.key - 1;
      ui.pressedT = 6;
      world.buy(item.id);
      const events = world.events.slice();
      handleEvents();
      if (tutorial) tutorialStep(events);
    }
  }
});

addEventListener('blur', () => pause(true));

function toggleMute() {
  audio.set({ muted: !audio.state.muted });
  store.set('muted', audio.state.muted);
  syncSound();
}

function syncSound() {
  $('btnSound').textContent = `Sound: ${audio.state.muted ? 'off' : 'on'}`;
  $('btnMusic').textContent = `Music: ${audio.state.music ? 'on' : 'off'}`;
}

/* ---------- Menus ---------- */

function buildCodex() {
  const codex = $('codex');
  codex.innerHTML = '';
  const ids = [...Object.keys(FISH), 'potion', ...Object.keys(ALIENS).filter((k) => k !== 'warning'), ...Object.keys(PETS)];
  for (const id of ids) {
    const known = progress.seen.includes(id) || id === 'guppy' || (PETS[id] && petsOwned().includes(id));
    const [name, what] = describe(id);
    const el = document.createElement('div');
    el.className = `codex-item${known ? '' : ' is-locked'}`;
    el.innerHTML = `<img alt="" src="${iconUrl(id)}"><span><b>${known ? name : '???'}</b>${known ? what : 'Not met yet.'}</span>`;
    codex.append(el);
  }
}

function playNext() {
  if (!progress.tutorialDone) return choosePets(LEVELS[0]);
  const next = LEVELS.find((L) => !cleared(L) && isOpen(L)) ?? LEVELS[LEVELS.length - 1];
  choosePets(next);
}

$('btnPlay').addEventListener('click', playNext);
$('btnLevels').addEventListener('click', () => openLevels('normal'));
$('btnModes').addEventListener('click', () => {
  const hardOpen = cleared(LEVELS[LEVELS_PER_WORLD - 1]);
  $('modeHard').disabled = !hardOpen;
  $('hardLock').textContent = hardOpen ? '' : 'Clear level 1-10 to unlock.';
  $('endlessBest').textContent = progress.endless.wave ? `Best: ${progress.endless.wave} waves, $${fmt(progress.endless.earned)}` : '';
  show('modes');
});
$('modesBack').addEventListener('click', () => show('title'));
$('modeCampaign').addEventListener('click', () => openLevels('normal'));
$('modeHard').addEventListener('click', () => openLevels('hard'));
$('modeEndless').addEventListener('click', () => {
  chosenPets = [];
  startDef({ mode: 'endless', endless: true, id: 'endless', index: 0, world: 4, name: 'Endless', start: ENDLESS.start, shop: ENDLESS.shop, aliens: null });
});
$('modeFree').addEventListener('click', () => {
  chosenPets = [];
  startDef({ mode: 'free', free: true, id: 'free', index: 0, world: 0, name: 'Free tank', start: FREE.start, shop: FREE.shop, aliens: null });
});
$('levelsBack').addEventListener('click', () => show(levelMode === 'hard' ? 'modes' : 'title'));
$('btnHelp').addEventListener('click', () => {
  buildCodex();
  show('help');
});
$('helpBack').addEventListener('click', () => show('title'));
$('btnTutorial').addEventListener('click', () => {
  chosenPets = [];
  startDef(LEVELS[0], { forceTutorial: true });
});
$('btnResume').addEventListener('click', () => pause(false));
$('btnRestart').addEventListener('click', () => {
  audio.suspend(false);
  startDef(def);
});
$('btnQuit').addEventListener('click', () => {
  playing = false;
  tutorial = null;
  ui.hint = null;
  audio.suspend(false);
  audio.stopMusic();
  $('card').hidden = true;
  refreshTitle();
  show('title');
});
$('btnNext').addEventListener('click', () => choosePets(listFor(def.mode)[def.index + 1]));
$('btnRetry').addEventListener('click', () => startDef(def));
$('btnResultLevels').addEventListener('click', () => (def.endless || def.free ? show('modes') : openLevels(def.mode)));
$('btnSound').addEventListener('click', toggleMute);
$('btnMusic').addEventListener('click', () => {
  audio.set({ music: !audio.state.music });
  store.set('music', audio.state.music);
  syncSound();
});

/* ---------- Loop ---------- */

// Behind the menus a tank plays itself.
function attract() {
  for (const f of world.fish) if (world.isHungry(f)) f.fedUntil = world.time + 900;
  if (world.time % 300 === 0 && world.fish.length < 8) {
    world.money += 1000;
    world.buy(world.time % 1200 === 0 ? 'carnivore' : 'guppy');
  }
  if (world.time % 30 === 0 && world.coins.length) {
    const c = world.coins.find((k) => k.floorT > 0) ?? world.coins[0];
    world.click(c.x, c.y);
  }
  world.step();
  for (const e of world.events) if (e.type === 'coin') fx.fly(e.coin, e.x, e.y);
}

const loop = createLoop({
  update() {
    tick++;
    fx.step();
    if (ui.pressedT > 0 && --ui.pressedT === 0) ui.pressed = null;
    if (ui.flashT > 0 && --ui.flashT === 0) ui.flashSlot = null;
    if (ui.moneyFlash > 0) ui.moneyFlash--;
    ui.money += (world.money - ui.money) * 0.2;
    if (Math.abs(world.money - ui.money) < 0.5) ui.money = world.money;
    if (screen === 'pause' || screen === 'new') return;
    if (!playing) {
      if (['title', 'levels', 'help', 'modes', 'pets'].includes(screen)) attract();
      ui.shop = visibleShop(world.shop());
      return;
    }
    if (cardT > 0 && --cardT === 0) $('card').hidden = true;
    for (let i = 0; i < SPEED && playing; i++) {
      world.step();
      const events = world.events.slice();
      handleEvents();
      if (tutorial) tutorialStep(events);
      if (screen !== 'play') break;
    }
    ui.shop = visibleShop(world.shop());
  },
  render() {
    renderer.draw(world, ui, fx, tick);
  },
  onPauseChange(paused) {
    if (paused) pause(true);
  },
});

world = createWorld({ def: { ...FREE, mode: 'free', free: true, id: 'attract', index: 0, world: 0, name: '', start: { money: 300, guppies: 4 }, shop: FREE.shop, aliens: null }, seed: 7, pets: ['snail', 'seahorse'] });
syncSound();
refreshTitle();
layout();
show('title');
loop.start();
