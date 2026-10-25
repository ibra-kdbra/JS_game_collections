import { initShell } from '../../assets/kit/shell.js';
import { createLoop } from '../../assets/kit/loop.js';
import { createStore, recordBest } from '../../assets/kit/storage.js';
import { TANK, LEVELS, FOOD } from './config.js';
import { createWorld } from './sim.js';
import { createRenderer } from './render.js';
import { createFx } from './fx.js';
import { createAudio } from './audio.js';

const SLUG = 'reef-keeper';
const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
// ?speed=N runs N steps per tick, for testing.
const SPEED = Math.max(1, Math.min(20, +new URLSearchParams(location.search).get('speed') || 1));

initShell({ slug: SLUG });
const store = createStore(SLUG);
const audio = createAudio({ muted: store.get('muted', false), music: store.get('music', true) });
const fx = createFx();
const canvas = $('tank');
const renderer = createRenderer(canvas);

/** progress.cleared[i] = best minutes for tank i. */
const progress = store.get('progress', { cleared: {} });

const TIPS = [
  'Click the water to drop food for hungry fish.',
  'A crab in the shop will pick up coins for you.',
  'Pike eat small minnows and drop gems.',
  'Eels are tougher than squid. Upgrade the zapper.',
];

let screen = 'title'; // title | levels | help | play | pause | result
let world = createWorld({ level: 0, seed: 7 });
let playing = false;
let levelIndex = 0;
let introT = 0;
let tick = 0;

/* ---------- Layout ---------- */

const portrait = matchMedia('(max-aspect-ratio: 4/5)');
portrait.addEventListener?.('change', () => layout());

function layout() {
  const wrap = $('tankWrap');
  const r = wrap.getBoundingClientRect();
  let w;
  let h;
  if (portrait.matches) {
    // Upright phones: full width, with a sand bed under the tank.
    w = r.width;
    h = Math.round(w * 0.74);
  } else {
    w = Math.max(200, Math.min(r.width, (r.height * TANK.w) / TANK.h));
    h = (w * TANK.h) / TANK.w;
  }
  renderer.resize(Math.floor(w), Math.floor(h), Math.min(devicePixelRatio || 1, 2));
}
new ResizeObserver(layout).observe($('tankWrap'));

/* ---------- Shop ---------- */

const icons = {};
function iconUrl(id) {
  if (!icons[id]) icons[id] = renderer.icon(id).toDataURL();
  return icons[id];
}

let shopKey = '';
function renderShop() {
  const items = world.shop();
  const key = items.map((i) => `${i.id}:${i.cost}:${i.affordable}:${i.level}`).join('|');
  if (key === shopKey) return;
  shopKey = key;
  const shop = $('shop');
  if (shop.children.length !== items.length) {
    shop.innerHTML = '';
    items.forEach((item, n) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `shop-btn${item.id === 'shard' ? ' shop-btn--pearl' : ''}`;
      b.dataset.id = item.id;
      b.innerHTML = `<img alt="" src="${iconUrl(item.id)}"><span class="label"></span><span class="cost"></span><span class="lvl"></span>`;
      b.title = `${n + 1}`;
      b.addEventListener('click', () => buy(item.id, b));
      shop.append(b);
    });
  }
  items.forEach((item, n) => {
    const b = shop.children[n];
    b.querySelector('.label').textContent = item.label;
    b.querySelector('.cost').textContent = item.maxed ? 'Max' : fmt(item.cost);
    const lvl = item.id === 'weapon' ? `${item.level + 1}` : item.id === 'shard' ? `${item.level}/3` : '';
    b.querySelector('.lvl').textContent = lvl;
    b.disabled = !playing || item.maxed;
    b.classList.toggle('is-maxed', item.maxed);
    b.classList.toggle('is-short', !item.affordable);
    b.setAttribute('aria-label', `${item.label}${item.maxed ? ', maxed' : `, ${fmt(item.cost)} coins`}. Key ${n + 1}`);
  });
}

function buy(id, btn) {
  if (!playing || screen !== 'play') return;
  audio.unlock();
  if (world.buy(id)) {
    audio.play('buy');
    btn?.classList.remove('is-bought');
    void btn?.offsetWidth;
    btn?.classList.add('is-bought');
  } else {
    audio.play('nope');
    const m = $('money').parentElement;
    m.classList.remove('is-short');
    void m.offsetWidth;
    m.classList.add('is-short');
  }
  handleEvents();
}

/* ---------- HUD ---------- */

let hudKey = '';
function updateHud() {
  const key = `${world.money}|${world.shards}|${world.warning > 0}|${!!world.invader}`;
  if (key !== hudKey) {
    hudKey = key;
    $('money').textContent = fmt(world.money);
    [...$('pearls').children].forEach((el, i) => el.classList.toggle('is-on', i < world.shards));
    $('pearls').setAttribute('aria-label', `Pearls: ${world.shards} of 3`);
    $('banner').hidden = !(playing && world.warning > 0);
  }
  renderShop();
}

/* ---------- Screens ---------- */

const SCREENS = { title: 'screenTitle', levels: 'screenLevels', help: 'screenHelp', pause: 'screenPause', result: 'screenResult' };

function show(name) {
  screen = name;
  for (const [k, id] of Object.entries(SCREENS)) $(id).hidden = k !== name;
  shopKey = '';
  updateHud();
  if (name !== 'play') $(SCREENS[name])?.querySelector('button')?.focus({ preventScroll: true });
}

function refreshTitle() {
  const n = Object.keys(progress.cleared).length;
  $('btnPlay').textContent = n && n < LEVELS.length ? `Play · Tank ${n + 1}` : 'Play';
  $('titleBest').textContent = n ? `${n} of ${LEVELS.length} tanks cleared` : '';
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
    b.innerHTML = `<b>${i + 1}. ${L.name}</b><span>${done !== undefined ? `Cleared in ${done.toFixed(1)} min` : open ? `Pearls ${fmt(L.shard)} each` : 'Locked'}</span>`;
    b.addEventListener('click', () => startLevel(i));
    grid.append(b);
  });
}

function startLevel(i) {
  audio.unlock();
  levelIndex = i;
  world = createWorld({ level: i, seed: (Date.now() & 0xffff) || 1 });
  fx.clear();
  playing = true;
  introT = 150;
  $('levelName').textContent = `Tank ${i + 1} · ${LEVELS[i].name}`;
  $('cardKicker').textContent = `Tank ${i + 1}`;
  $('cardTitle').textContent = LEVELS[i].name;
  $('cardTip').textContent = TIPS[i];
  $('card').hidden = false;
  audio.setMood('calm');
  audio.startMusic();
  show('play');
}

function finish(outcome) {
  playing = false;
  $('banner').hidden = true;
  $('card').hidden = true;
  const minutes = world.time / 3600;
  const L = LEVELS[levelIndex];
  $('resultKicker').textContent = `Tank ${levelIndex + 1} · ${L.name}`;
  if (outcome === 'clear') {
    audio.play('clear');
    const prev = progress.cleared[levelIndex];
    progress.cleared[levelIndex] = prev === undefined ? minutes : Math.min(prev, minutes);
    store.set('progress', progress);
    recordBest(SLUG, Object.keys(progress.cleared).length, { label: `${Object.keys(progress.cleared).length} tanks` });
    $('resultHeading').textContent = 'Tank cleared';
    $('resultLine').textContent = `${minutes.toFixed(1)} minutes · ${world.stats.coins} coins collected${prev !== undefined && minutes < prev ? ' · new best' : ''}`;
    $('btnNext').hidden = levelIndex >= LEVELS.length - 1;
    $('btnNext').textContent = 'Next tank';
  } else {
    audio.play('lost');
    $('resultHeading').textContent = 'The tank is empty';
    $('resultLine').textContent = 'No fish left and not enough coins for a new one.';
    $('btnNext').hidden = true;
  }
  if (levelIndex >= LEVELS.length - 1 && outcome === 'clear') $('resultLine').textContent += ' · every tank cleared!';
  audio.stopMusic();
  refreshTitle();
  show('result');
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

/* ---------- Events ---------- */

const COIN_COLORS = { silver: '#dfe5ec', gold: '#ffd84d', gem: '#4fd8ff', chest: '#facc15' };

function handleEvents() {
  for (const e of world.events) {
    switch (e.type) {
      case 'food':
        audio.play('food');
        break;
      case 'eat':
        audio.play('eat');
        fx.bubbles(e.x, e.y, 3);
        break;
      case 'grow':
        audio.play('grow');
        fx.burst(e.x, e.y, ['#ffffff', '#ffd84d'], 10, 1.6);
        break;
      case 'coin':
        audio.play('coin', e.coin);
        fx.burst(e.x, e.y, [COIN_COLORS[e.coin], '#ffffff'], 8, 1.8);
        fx.popup(e.x, e.y - 12, `+${e.value}`, COIN_COLORS[e.coin]);
        break;
      case 'starve':
        audio.play('starve');
        break;
      case 'gulp':
        audio.play('gulp');
        fx.bubbles(e.x, e.y, 8);
        break;
      case 'warning':
        audio.play('warning');
        break;
      case 'invader':
        audio.play('invader');
        audio.setMood('tense');
        break;
      case 'hit':
        audio.play('hit');
        fx.burst(e.x, e.y, ['#fff7ae', '#facc15', '#ffffff'], 6, 2.4);
        break;
      case 'defeat':
        audio.play('defeat');
        audio.setMood('calm');
        fx.burst(e.x, e.y, ['#a55bd1', '#ffffff', '#facc15'], 24, 3);
        break;
      case 'clear':
      case 'lost':
        finish(e.type);
        break;
    }
  }
}

/* ---------- Input ---------- */

canvas.addEventListener('pointerdown', (e) => {
  if (screen !== 'play' || !playing) return;
  audio.unlock();
  const r = canvas.getBoundingClientRect();
  const { x, y } = renderer.toTank(e.clientX - r.left, e.clientY - r.top);
  introT = Math.min(introT, 20);
  const did = world.click(x, y);
  if (did === 'none' && world.money < FOOD.cost) audio.play('nope');
  handleEvents();
});

addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
    if (screen === 'play') pause(true);
    else if (screen === 'pause') pause(false);
    else if (screen === 'help' || screen === 'levels') show('title');
    e.preventDefault();
  } else if (e.key === 'm' || e.key === 'M') {
    toggleMute();
  } else if (screen === 'play' && /^[1-9]$/.test(e.key)) {
    const btn = $('shop').children[+e.key - 1];
    if (btn) buy(btn.dataset.id, btn);
  }
});

addEventListener('blur', () => pause(true));

function toggleMute() {
  audio.set({ muted: !audio.state.muted });
  store.set('muted', audio.state.muted);
  syncSound();
}

function syncSound() {
  const { muted, music } = audio.state;
  $('muteBtn').setAttribute('aria-pressed', String(muted));
  $('btnSound').textContent = `Sound: ${muted ? 'off' : 'on'}`;
  $('btnMusic').textContent = `Music: ${music ? 'on' : 'off'}`;
}

$('btnPlay').addEventListener('click', () => {
  const n = Object.keys(progress.cleared).length;
  startLevel(Math.min(n, LEVELS.length - 1));
});
$('btnLevels').addEventListener('click', () => {
  buildLevels();
  show('levels');
});
$('levelsBack').addEventListener('click', () => show('title'));
$('btnHelp').addEventListener('click', () => show('help'));
$('helpBack').addEventListener('click', () => show('title'));
$('btnResume').addEventListener('click', () => pause(false));
$('btnQuit').addEventListener('click', () => {
  playing = false;
  audio.suspend(false);
  audio.stopMusic();
  $('card').hidden = true;
  $('banner').hidden = true;
  refreshTitle();
  show('title');
});
$('btnNext').addEventListener('click', () => startLevel(levelIndex + 1));
$('btnRetry').addEventListener('click', () => startLevel(levelIndex));
$('btnResultTitle').addEventListener('click', () => show('title'));
$('pauseBtn').addEventListener('click', () => pause(true));
$('muteBtn').addEventListener('click', toggleMute);
$('btnSound').addEventListener('click', toggleMute);
$('btnMusic').addEventListener('click', () => {
  audio.set({ music: !audio.state.music });
  store.set('music', audio.state.music);
  syncSound();
});

/* ---------- Loop ---------- */

// Behind the title, the first tank plays itself: fed and kept alive.
function attract() {
  for (const f of world.fish) if (world.isHungry(f)) f.fedUntil = world.time + 600;
  if (world.time % 400 === 0 && world.fish.length < 7) world.buy('minnow') || (world.money += 100);
  if (world.time % 20 === 0 && world.coins.length) world.click(world.coins[0].x, world.coins[0].y);
  world.warning = 0;
  world.nextInvader = Infinity;
  world.step();
}

const loop = createLoop({
  update() {
    tick++;
    fx.step();
    if (screen === 'pause') return;
    if (!playing) {
      if (screen !== 'result') attract();
      return;
    }
    if (introT > 0 && --introT === 0) $('card').hidden = true;
    for (let i = 0; i < SPEED && playing; i++) {
      world.step();
      handleEvents();
    }
    updateHud();
  },
  render() {
    renderer.draw(world, fx, tick);
  },
  onPauseChange(paused) {
    if (paused) pause(true);
  },
});

syncSound();
refreshTitle();
layout();
show('title');
loop.start();
