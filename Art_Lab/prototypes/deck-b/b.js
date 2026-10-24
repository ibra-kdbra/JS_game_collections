// Deck B: the deck riffles, deals itself onto the table, and each card can be
// picked up, tilted and turned over to read its back.
import { pieces, makeCard, preload, anim, flip, tilt, wait, motion, sound, chrome, pad, RARITY } from '../shared/deck.js';

const $ = (id) => document.getElementById(id);
const table = $('table');
const mat = $('mat');
const dealtEl = $('dealt');
const dealBtn = $('deal-btn');
const status = $('status');
const scrim = $('scrim');
const tiltBtn = $('tilt-btn');
const N = pieces.length;

let state = 'deck'; // deck | busy | dealt | held
let geo = null;
let cards = []; // { el, card, hit, p, i, detach }
let deckOrder = []; // indices, bottom -> top
let slotOf = []; // piece index -> slot index
let held = null;

// ---------- Layout ----------
function layout() {
  const W = table.clientWidth;
  const H = table.clientHeight;
  const bottom = H < 480 ? 44 : 70;
  const availW = W - 24;
  const availH = H - bottom - 16;
  let best = null;
  for (const cols of [7, 4, 3, 2]) {
    const rows = Math.ceil(N / cols);
    const gap = 0.16;
    const cw = Math.min(208, availW / (cols + (cols - 1) * gap + 0.1), availH / (rows * 1.4 + (rows - 1) * gap * 1.1 + 0.12));
    if (!best || cw > best.cw + 0.5) best = { cols, rows, cw: Math.floor(cw), gap };
  }
  const { cols, rows, cw, gap } = best;
  const stepX = cw * (1 + gap);
  const stepY = cw * (1.4 + gap * 1.1);
  const top = 8 + (availH - (rows * cw * 1.4 + (rows - 1) * cw * gap * 1.1)) / 2 + cw * 0.7;
  const slots = [];
  for (let k = 0; k < N; k++) {
    const r = Math.floor(k / cols);
    const inRow = Math.min(cols, N - r * cols);
    const c = k - r * cols;
    slots.push({ x: W / 2 + (c - (inRow - 1) / 2) * stepX, y: top + r * stepY });
  }
  const deck = { x: W / 2, y: H / 2 - bottom / 2 + 4 };
  return { W, H, cw, slots, deck };
}

const T = (x, y, r = 0, s = 1) => `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg)${s !== 1 ? ` scale(${s})` : ''}`;
const deckT = (j) => T(geo.deck.x - j * 0.5, geo.deck.y - j * 1.3);

function drawMat(showDeck = true) {
  mat.innerHTML = geo.slots.map((s, k) => `<div class="mat-slot" style="transform:translate(${s.x}px,${s.y}px)">${pad(k + 1)}</div>`).join('')
    ;
}

// ---------- Build ----------
function build() {
  geo = layout();
  table.style.setProperty('--cw', geo.cw + 'px');
  dealtEl.innerHTML = '';
  dealtEl.classList.remove('is-dealt');
  cards = pieces.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'bcard';
    el.setAttribute('role', 'listitem');
    const card = makeCard(p, { down: true, sizes: Math.round(geo.cw * 2) + 'px', eager: true });
    const hit = document.createElement('button');
    hit.type = 'button';
    hit.className = 'card-hit';
    hit.setAttribute('aria-label', 'Face-down card');
    hit.addEventListener('click', () => onCard(i));
    el.append(card, hit);
    dealtEl.append(el);
    return { el, card, hit, p, i, detach: null };
  });
  deckOrder = cards.map((c) => c.i);
  stackDeck();
  drawMat(true);
}

function stackDeck() {
  deckOrder.forEach((ci, j) => {
    const c = cards[ci];
    c.el.style.zIndex = String(100 + j);
    c.el.style.transform = deckT(j);
  });
}

function setStatus(html) { status.innerHTML = html; }

// ---------- Shuffle ----------
async function riffle(speed = 1) {
  const L = deckOrder.slice(0, Math.ceil(N / 2));
  const R = deckOrder.slice(Math.ceil(N / 2));
  const off = geo.cw * 0.62;
  const d = (ms) => ms * speed;
  await Promise.all([
    ...L.map((ci, j) => anim(cards[ci].el, [{ transform: cards[ci].el.style.transform }, { transform: T(geo.deck.x - off, geo.deck.y - j * 1.3 + 6, -7) }], { duration: d(240), easing: 'cubic-bezier(.3,.7,.3,1)' })),
    ...R.map((ci, j) => anim(cards[ci].el, [{ transform: cards[ci].el.style.transform }, { transform: T(geo.deck.x + off, geo.deck.y - j * 1.3 + 6, 7) }], { duration: d(240), easing: 'cubic-bezier(.3,.7,.3,1)' })),
  ]);
  // interleave from the bottom of each half
  const merged = [];
  for (let k = 0; k < Math.max(L.length, R.length); k++) {
    if (L[k] !== undefined) merged.push(L[k]);
    if (R[k] !== undefined) merged.push(R[k]);
  }
  const drops = merged.map((ci, j) => wait(d(j * 52)).then(() => {
    const el = cards[ci].el;
    el.style.zIndex = String(100 + j);
    sound.tick();
    return anim(el, [{ transform: el.style.transform }, { transform: deckT(j) }], { duration: d(170), easing: 'cubic-bezier(.4,0,.6,1)' });
  }));
  await Promise.all(drops);
  deckOrder = merged;
  // square the deck
  await Promise.all(deckOrder.map((ci, j) => anim(cards[ci].el, [
    { transform: deckT(j) }, { transform: T(geo.deck.x - j * 0.5, geo.deck.y - j * 1.3 - 6, 0, 1.02) }, { transform: deckT(j) },
  ], { duration: d(200), easing: 'ease-out' })));
}

function randomise() {
  for (let k = deckOrder.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [deckOrder[k], deckOrder[j]] = [deckOrder[j], deckOrder[k]];
  }
  stackDeck(); // face-down backs are identical, so this reorder is invisible
}

// ---------- Deal ----------
async function deal() {
  state = 'busy';
  dealBtn.hidden = true;
  await preload();
  if (motion.reduced) {
    randomise();
    slotOf = [];
    deckOrder.slice().reverse().forEach((ci, k) => { slotOf[ci] = k; });
    await anim(dealtEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
    cards.forEach((c) => {
      const s = geo.slots[slotOf[c.i]];
      c.el.style.transform = T(s.x, s.y);
      c.el.style.zIndex = String(slotOf[c.i] + 1);
      c.card.classList.remove('is-down');
    });
    drawMat(false);
    await anim(dealtEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
    return ready();
  }
  setStatus('Shuffling…');
  await riffle(1);
  randomise();
  await riffle(0.8);
  setStatus('Dealing…');
  slotOf = [];
  const order = deckOrder.slice().reverse(); // top card first
  const flights = order.map((ci, k) => wait(k * 115).then(async () => {
    slotOf[ci] = k;
    const c = cards[ci];
    const s = geo.slots[k];
    const from = c.el.style.transform;
    const sign = s.x < geo.deck.x ? -1 : 1;
    const midX = geo.deck.x + (s.x - geo.deck.x) * 0.55;
    const midY = geo.deck.y + (s.y - geo.deck.y) * 0.55 - geo.cw * 0.35;
    const endR = (Math.random() - 0.5) * 4;
    c.el.style.zIndex = String(200 + k); // in flight, above the deck
    sound.tick();
    await anim(c.el, [
      { transform: from },
      { transform: T(midX, midY, sign * 28, 1.1), offset: 0.5 },
      { transform: T(s.x, s.y, endR) },
    ], { duration: 470, easing: 'cubic-bezier(.25,.75,.35,1)' });
    c.el.style.zIndex = String(k + 1);
    sound.thump();
  }));
  await Promise.all(flights);
  drawMat(false);
  // turn them over, left to right
  await Promise.all(order.map((ci, k) => wait(k * 85).then(() => { sound.flip(); return flip(cards[ci].card, true, { duration: 500 }); })));
  ready();
}

function ready() {
  state = 'dealt';
  dealtEl.classList.add('is-dealt');
  cards.forEach((c) => {
    c.hit.disabled = false;
    c.hit.tabIndex = 0;
    c.hit.setAttribute('aria-label', `${c.p.title}, card ${c.p.n} of ${N}, ${RARITY[c.p.rarity]}. Pick up`);
    if (matchMedia('(hover: hover)').matches) c.detach = tilt(c.card, { max: 16, target: c.el, lift: 1.02 });
  });
  // tab order follows the table
  cards.slice().sort((a, b) => slotOf[a.i] - slotOf[b.i]).forEach((c) => dealtEl.append(c.el));
  setStatus('Tap a card to pick it up');
  // the deal button is gone; keep keyboard users on the table
  if (!document.activeElement || document.activeElement === document.body) dealtEl.querySelector('.card-hit').focus({ preventScroll: true });
}

// ---------- Gather (shuffle again) ----------
async function gather() {
  if (state === 'busy') return;
  if (state === 'held') await putDown();
  state = 'busy';
  dealtEl.classList.remove('is-dealt');
  cards.forEach((c) => { c.hit.disabled = true; if (c.detach) { c.detach(); c.detach = null; } });
  geo = layout();
  table.style.setProperty('--cw', geo.cw + 'px');
  if (motion.reduced) {
    await anim(dealtEl, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
    cards.forEach((c) => c.card.classList.add('is-down'));
    stackDeck();
    drawMat(true);
    dealtEl.style.opacity = '';
    return deal();
  }
  setStatus('Gathering…');
  const bySlot = cards.slice().sort((a, b) => slotOf[a.i] - slotOf[b.i]);
  await Promise.all(bySlot.map((c, k) => wait(k * 50).then(() => flip(c.card, false, { duration: 360, lift: false }))));
  drawMat(true);
  deckOrder = bySlot.map((c) => c.i);
  await Promise.all(bySlot.map((c, j) => wait(j * 60).then(() => {
    c.el.style.zIndex = String(100 + j);
    sound.tick();
    return anim(c.el, [{ transform: c.el.style.transform }, { transform: deckT(j) }], { duration: 380, easing: 'cubic-bezier(.3,.8,.3,1)' });
  })));
  deal();
}

// ---------- Pick up / put down ----------
function infoHTML(p) {
  return `<div class="bi-top"><span>No. ${pad(p.n)}</span><span>${RARITY[p.rarity]} ${'◆'.repeat(p.rarity)}</span></div>
<h2 class="bi-title" id="held-title">${p.title}</h2>
<div class="bi-tags">${p.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>
<p class="bi-desc">${p.blurb}</p>
<p class="bi-ctrl"><b>Controls</b>${p.controls}</p>
<dl class="bi-stats"><div><dt>Engine</dt><dd>${p.engine}</dd></div><div><dt>Input</dt><dd>${p.input}</dd></div><div><dt>Card</dt><dd>${pad(p.n)}/${pad(p.total)}</dd></div></dl>
<div class="bi-actions">
  <a class="btn btn-primary" href="${p.url}" target="_blank" rel="noopener" aria-label="Enter ${p.title} (opens in a new tab)">Enter <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
  <button class="btn" type="button" data-act="down" aria-label="Put the card down (Esc)">Back</button>
</div>`;
}

function heldSize() {
  const W = table.clientWidth, H = table.clientHeight;
  return Math.floor(Math.min(372, W * 0.86, (H - 28) / 1.4));
}

function rectDelta(fromEl, toEl) {
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  return {
    dx: a.left + a.width / 2 - (b.left + b.width / 2),
    dy: a.top + a.height / 2 - (b.top + b.height / 2),
    s: a.width / b.width,
  };
}

async function pickUp(ci, dir = 0) {
  if (state !== 'dealt') return;
  state = 'busy';
  const c = cards[ci];
  const cw = heldSize();
  const wrap = document.createElement('div');
  wrap.className = 'held';
  wrap.style.setProperty('--cw', cw + 'px');
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'held-title');
  const card = makeCard(c.p, { sizes: cw * 2 + 'px', eager: true, back: infoHTML(c.p) });
  wrap.append(card);
  table.append(wrap);
  scrim.hidden = false;
  const endR = c.el.style.transform.match(/rotate\(([-\d.]+)deg\)/);
  const { dx, dy, s } = rectDelta(c.card, card);
  c.el.classList.add('is-held');
  held = { c, wrap, card, detach: null };
  card.querySelector('[data-act="down"]').addEventListener('click', () => putDown());
  sound.flip();
  if (motion.reduced || dir) {
    card.classList.add('is-down');
    await Promise.all([
      anim(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: dir ? 1 : 160 }),
      anim(wrap, dir && !motion.reduced
        ? [{ transform: `translateX(${dir * 60}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }]
        : [{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }),
    ]);
  } else {
    anim(scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    const lift = card.querySelector('.card-lift');
    const inner = card.querySelector('.card-inner');
    await Promise.all([
      anim(wrap, [
        { transform: `translate(${dx}px, ${dy}px) rotate(${endR ? endR[1] : 0}deg) scale(${s})` },
        { transform: `translate(${dx * 0.4}px, ${dy * 0.4 - 30}px) rotate(-4deg) scale(${(s + 1) / 2 * 1.04})`, offset: 0.45 },
        { transform: 'none' },
      ], { duration: 620, easing: 'cubic-bezier(.3,.7,.25,1)' }),
      anim(inner, [
        { transform: 'rotateY(0deg)' },
        { transform: 'rotateY(0deg)', offset: 0.2 },
        { transform: 'rotateY(180deg)' },
      ], { duration: 620, easing: 'cubic-bezier(.4,.1,.3,1)' }),
    ]);
    card.classList.add('is-down');
    inner.style.transform = '';
    wrap.style.transform = '';
    lift.style.transform = '';
  }
  held.detach = tilt(card, { max: 9, target: wrap, lift: 1 });
  card.querySelector('.bi-actions a').focus();
  state = 'held';
  setStatus('Esc or tap outside to put it down');
}

async function putDown(next = 0) {
  if (!held) return;
  state = 'busy';
  const { c, wrap, card, detach } = held;
  if (detach) detach();
  if (motion.reduced || next) {
    await Promise.all([
      next ? Promise.resolve() : anim(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }),
      anim(wrap, next && !motion.reduced
        ? [{ transform: 'none', opacity: 1 }, { transform: `translateX(${-next * 60}px)`, opacity: 0 }]
        : [{ opacity: 1 }, { opacity: 0 }], { duration: 160 }),
    ]);
  } else {
    const inner = card.querySelector('.card-inner');
    const { dx, dy, s } = rectDelta(c.card, card);
    const endR = c.el.style.transform.match(/rotate\(([-\d.]+)deg\)/);
    anim(scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: 420 });
    await Promise.all([
      anim(wrap, [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) rotate(${endR ? endR[1] : 0}deg) scale(${s})` }], { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)' }),
      anim(inner, [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: 420, easing: 'cubic-bezier(.4,0,.3,1)' }),
    ]);
    sound.thump();
  }
  if (!next) { scrim.hidden = true; scrim.style.opacity = ''; }
  wrap.remove();
  c.el.classList.remove('is-held');
  held = null;
  state = 'dealt';
  if (!next) { c.hit.focus({ preventScroll: true }); setStatus('Tap a card to pick it up'); }
}

async function step(d) {
  if (!held || state !== 'held') return;
  const k = (slotOf[held.c.i] + d + N) % N;
  const ci = slotOf.indexOf(k);
  await putDown(d);
  pickUp(ci, d);
}

function onCard(i) {
  if (state === 'deck') return deal();
  if (state === 'dealt') pickUp(i);
}

// swipe the held card left/right to move along the table
let sw = null;
table.addEventListener('pointerdown', (e) => { if (held && held.wrap.contains(e.target)) sw = { x: e.clientX, y: e.clientY }; });
table.addEventListener('pointerup', (e) => {
  if (!sw) return;
  const dx = e.clientX - sw.x;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - sw.y) * 1.3) step(dx < 0 ? 1 : -1);
  sw = null;
});

scrim.addEventListener('click', () => { if (state === 'held') putDown(); });
document.addEventListener('keydown', (e) => {
  if (state !== 'held' || !held) return;
  if (e.key === 'Escape') { e.preventDefault(); putDown(); }
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'Tab') {
    const f = [...held.wrap.querySelectorAll('a[href], button')];
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

// ---------- Gyro tilt (phones; opt-in) ----------
let gyroOn = false;
function onOrient(e) {
  if (!gyroOn || motion.reduced) return;
  const rx = Math.max(-12, Math.min(12, (e.beta || 0) - 40)) * 0.8;
  const ry = Math.max(-12, Math.min(12, e.gamma || 0)) * 0.8;
  const targets = held ? [held.card] : cards.map((c) => c.card);
  for (const t of targets) {
    t.querySelector('.card-lift').style.transform = `rotateX(${-rx}deg) rotateY(${ry}deg)`;
    t.style.setProperty('--sheen-x', `${-40 + (ry / 12 + 1) * 25}%`);
    t.classList.add('is-lit');
  }
}
if ('DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches) {
  tiltBtn.hidden = false;
  tiltBtn.addEventListener('click', async () => {
    if (!gyroOn && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try { if (await DeviceOrientationEvent.requestPermission() !== 'granted') return; } catch { return; }
    }
    gyroOn = !gyroOn;
    tiltBtn.setAttribute('aria-pressed', String(gyroOn));
    if (gyroOn) addEventListener('deviceorientation', onOrient);
    else {
      removeEventListener('deviceorientation', onOrient);
      cards.forEach((c) => { c.card.querySelector('.card-lift').style.transform = ''; c.card.classList.remove('is-lit'); });
    }
  });
}

// ---------- Resize ----------
let rz = 0;
addEventListener('resize', () => {
  cancelAnimationFrame(rz);
  rz = requestAnimationFrame(() => {
    if (state === 'busy') return;
    geo = layout();
    table.style.setProperty('--cw', geo.cw + 'px');
    if (state === 'deck') { stackDeck(); drawMat(true); return; }
    drawMat(false);
    cards.forEach((c) => {
      const s = geo.slots[slotOf[c.i]];
      const r = c.el.style.transform.match(/rotate\(([-\d.]+)deg\)/);
      c.el.style.transform = T(s.x, s.y, r ? +r[1] : 0);
    });
    if (held) held.wrap.style.setProperty('--cw', heldSize() + 'px');
  });
});

chrome({ onReplay: () => (state === 'deck' ? deal() : gather()) });
dealBtn.addEventListener('click', deal);
build();
dealBtn.hidden = false;
cards.forEach((c) => { c.hit.tabIndex = -1; c.hit.setAttribute('aria-label', 'Deck of 7 cards. Shuffle and deal'); });
// warm the art while the visitor looks at the closed deck
(window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => preload());
