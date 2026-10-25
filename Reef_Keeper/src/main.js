import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { FRAME, BAR, TANK, LEVELS, PETS, FOOD, FISH, WEAPON } from './config.js';
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

/** progress.cleared[i] = best minutes for level i. */
const progress = store.get('progress', { cleared: {} });
const petsFor = (level) => LEVELS.slice(0, level).filter((L, i) => progress.cleared[i] !== undefined && L.hatch).map((L) => L.hatch);

const TIPS = [
  'Click the water to drop food. Click coins to collect them.',
  'An alien is coming! Click it again and again to zap it.',
  'Carnivores eat baby guppies and drop diamonds.',
  'A breeder has baby guppies while she is fed.',
  'The Grinder is tough. Upgrade your zapper.',
];

const ABOUT = {
  guppy: ['Guppy', 'Grows as it eats, then drops coins.'],
  quality: ['Better food', 'Fills fish up for longer.'],
  count: ['More food', 'Drop one more piece at a time.'],
  carnivore: ['Carnivore', 'Eats baby guppies, drops diamonds.'],
  breeder: ['Breeder', 'Has baby guppies while fed.'],
  weapon: ['Zapper', 'Hits aliens harder.'],
  egg: ['Egg piece', 'Buy all three to clear the tank.'],
};

let screen = 'title';
let world = createWorld({ level: 0, seed: 7, pets: ['snail'] });
let playing = false;
let levelIndex = 0;
let tick = 0;
let cardT = 0;
const ui = { hover: null, pressed: null, pressedT: 0, flashSlot: null, flashT: 0, moneyFlash: 0, money: world.money, shop: world.shop(), tip: null };

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

const SCREENS = { title: 'screenTitle', levels: 'screenLevels', help: 'screenHelp', pause: 'screenPause', result: 'screenResult' };

function show(name) {
  screen = name;
  for (const [k, id] of Object.entries(SCREENS)) $(id).hidden = k !== name;
  if (name !== 'play') $(SCREENS[name])?.querySelector('button')?.focus({ preventScroll: true });
  layout();
}

function refreshTitle() {
  const n = Object.keys(progress.cleared).length;
  $('btnPlay').textContent = n && n < LEVELS.length ? `Play · Tank 1-${n + 1}` : 'Play';
  $('titleBest').textContent = n ? `${n} of ${LEVELS.length} tanks cleared` : '';
}

function petImg(kind) {
  const img = document.createElement('img');
  img.alt = '';
  img.src = renderer.iconCanvas(kind, 64).toDataURL();
  return img;
}

function buildLevels() {
  const grid = $('levelGrid');
  grid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const done = progress.cleared[i];
    const open = i === 0 || progress.cleared[i - 1] !== undefined || done !== undefined;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `level-card${done !== undefined ? ' is-done' : ''}`;
    b.disabled = !open;
    b.innerHTML = `<b>${L.name}</b><span>${L.title}</span><span>${done !== undefined ? `Cleared in ${done.toFixed(1)} min` : open ? `Egg pieces $${fmt(L.egg)}` : 'Locked'}</span>`;
    b.addEventListener('click', () => startLevel(i));
    grid.append(b);
  });
  const pets = $('petList');
  pets.innerHTML = '';
  const have = petsFor(LEVELS.length);
  if (!have.length) pets.textContent = 'Clear tanks to hatch pets that help you.';
  for (const kind of have) {
    const chip = document.createElement('span');
    chip.className = 'pet-chip';
    chip.append(petImg(kind), document.createTextNode(`${PETS[kind].name}: ${PETS[kind].what}`));
    pets.append(chip);
  }
}

function startLevel(i) {
  audio.unlock();
  levelIndex = i;
  world = createWorld({ level: i, seed: (Date.now() & 0xffff) || 1, pets: petsFor(i) });
  fx.clear();
  ui.money = world.money;
  playing = true;
  cardT = 170;
  $('cardKicker').textContent = LEVELS[i].name;
  $('cardTitle').textContent = LEVELS[i].title;
  $('cardTip').textContent = TIPS[i];
  $('card').hidden = false;
  audio.setMood('calm');
  audio.startMusic();
  show('play');
}

function finish(outcome) {
  playing = false;
  $('card').hidden = true;
  const minutes = world.time / 3600;
  const L = LEVELS[levelIndex];
  $('resultKicker').textContent = `${L.name} · ${L.title}`;
  $('hatch').hidden = true;
  if (outcome === 'clear') {
    const prev = progress.cleared[levelIndex];
    progress.cleared[levelIndex] = prev === undefined ? minutes : Math.min(prev, minutes);
    store.set('progress', progress);
    const n = Object.keys(progress.cleared).length;
    recordBest(SLUG, n, { label: `${n} tanks` });
    $('resultHeading').textContent = 'Tank cleared!';
    $('resultLine').textContent = `${minutes.toFixed(1)} minutes · ${world.stats.coins} coins${prev !== undefined && minutes < prev ? ' · new best' : ''}`;
    if (L.hatch && prev === undefined) {
      const art = $('hatchArt');
      const g = art.getContext('2d');
      g.clearRect(0, 0, art.width, art.height);
      g.drawImage(renderer.iconCanvas(L.hatch, 80), 0, 0, art.width, art.height);
      $('hatchLine').textContent = `The egg hatched ${PETS[L.hatch].name}, ${PETS[L.hatch].what}!`;
      $('hatch').hidden = false;
    }
    $('btnNext').hidden = levelIndex >= LEVELS.length - 1;
    if (levelIndex >= LEVELS.length - 1) $('resultLine').textContent += ' · every tank cleared!';
  } else {
    $('resultHeading').textContent = 'Tank empty';
    $('resultLine').textContent = 'No fish left and not enough money for a new one.';
    $('btnNext').hidden = true;
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

/* ---------- Feedback for what happened in the world ---------- */

const COIN_COLOR = { silver: '#e3e9f0', gold: '#ffd84a', diamond: '#7fe6ff', pearl: '#ffffff', chest: '#ffd84a' };

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
        audio.play('grow');
        fx.stars(e.x, e.y, ['#ffffff', '#ffe14d'], 8, 2);
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
      case 'gulp':
        audio.play('gulp');
        fx.bubbles(e.x, e.y, 8);
        if (e.by === 'alien') fx.shake(3, 10);
        break;
      case 'birth':
        audio.play('grow');
        fx.stars(e.x, e.y, ['#ff8fc7', '#ffffff'], 6, 1.4);
        break;
      case 'pearl':
        audio.play('coin', 'pearl');
        fx.stars(e.x, e.y - 10, ['#ffffff', '#e6d5f2'], 8, 1.6);
        break;
      case 'petFood':
        fx.bubbles(e.x, e.y, 4);
        break;
      case 'warning':
        audio.play('warning');
        break;
      case 'alien':
        audio.play('invader');
        audio.setMood('tense');
        fx.shake(5, 18);
        break;
      case 'hit':
        audio.play('hit');
        fx.stars(e.x, e.y, ['#ffffff', '#ffe14d', '#ff9f43'], 6, 2.6);
        fx.popup(e.x + 14, e.y - 16, `-${e.damage}`, '#ffffff', 16);
        fx.shake(1.5, 4);
        break;
      case 'miss':
        fx.ring(e.x, e.y, 'rgba(255,90,90,0.9)', 12);
        break;
      case 'defeat':
        audio.play('defeat');
        audio.setMood('calm');
        fx.stars(e.x, e.y, ['#c78cf0', '#ffffff', '#ffe14d'], 16, 3.5);
        fx.shake(4, 14);
        break;
      case 'buy':
        audio.play('buy');
        flashSlot(e.id);
        if (FISH[e.id]) {
          audio.play('splash');
          fx.ring(world.fish[world.fish.length - 1].x, TANK.surface + 4, 'rgba(255,255,255,0.9)', 22);
          fx.bubbles(world.fish[world.fish.length - 1].x, TANK.surface + 10, 8);
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
  const slot = slotAt(p);
  if (slot === 'menu') return pause(true);
  if (slot !== null) {
    ui.pressed = slot;
    ui.pressedT = 6;
    world.buy(ui.shop[slot].id);
  } else if (p.y >= BAR.h) {
    world.click(p.x, p.y);
  }
  handleEvents();
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const p = framePoint(e);
  const slot = screen === 'play' ? slotAt(p) : null;
  ui.hover = slot;
  canvas.classList.toggle('is-pointer', slot !== null);
  if (typeof slot === 'number' && ABOUT[ui.shop[slot]?.id]) {
    const [title, body] = ABOUT[ui.shop[slot].id];
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
    else if (screen === 'help' || screen === 'levels') show('title');
    e.preventDefault();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  } else if (screen === 'play' && playing && /^[1-9]$/.test(e.key)) {
    const item = ui.shop[+e.key - 1];
    if (item) {
      ui.pressed = +e.key - 1;
      ui.pressedT = 6;
      world.buy(item.id);
      handleEvents();
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

$('btnPlay').addEventListener('click', () => startLevel(Math.min(Object.keys(progress.cleared).length, LEVELS.length - 1)));
$('btnLevels').addEventListener('click', () => {
  buildLevels();
  show('levels');
});
$('levelsBack').addEventListener('click', () => show('title'));
$('btnHelp').addEventListener('click', () => show('help'));
$('helpBack').addEventListener('click', () => show('title'));
$('btnResume').addEventListener('click', () => pause(false));
$('btnRestart').addEventListener('click', () => {
  audio.suspend(false);
  startLevel(levelIndex);
});
$('btnQuit').addEventListener('click', () => {
  playing = false;
  audio.suspend(false);
  audio.stopMusic();
  $('card').hidden = true;
  refreshTitle();
  show('title');
});
$('btnNext').addEventListener('click', () => startLevel(levelIndex + 1));
$('btnRetry').addEventListener('click', () => startLevel(levelIndex));
$('btnResultTitle').addEventListener('click', () => {
  refreshTitle();
  show('title');
});
$('btnSound').addEventListener('click', toggleMute);
$('btnMusic').addEventListener('click', () => {
  audio.set({ music: !audio.state.music });
  store.set('music', audio.state.music);
  syncSound();
});

/* ---------- Loop ---------- */

// Behind the title the first tank plays itself.
function attract() {
  for (const f of world.fish) if (world.isHungry(f)) f.fedUntil = world.time + 900;
  if (world.time % 300 === 0 && world.fish.length < 7) {
    world.money += 100;
    world.buy('guppy');
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
    if (screen === 'pause') return;
    if (!playing) {
      if (screen === 'title' || screen === 'levels' || screen === 'help') attract();
      ui.shop = world.shop();
      return;
    }
    if (cardT > 0 && --cardT === 0) $('card').hidden = true;
    for (let i = 0; i < SPEED && playing; i++) {
      world.step();
      handleEvents();
    }
    ui.shop = world.shop();
  },
  render() {
    renderer.draw(world, ui, fx, tick);
  },
  onPauseChange(paused) {
    if (paused) pause(true);
  },
});

void FOOD;
void WEAPON;
syncSound();
refreshTitle();
layout();
show('title');
loop.start();
