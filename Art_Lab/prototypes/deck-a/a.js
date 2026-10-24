// Deck A: tear a sealed pack, cards burst out into a fan, flip each to reveal.
import { pieces, makeCard, preload, anim, flip, tilt, wait, motion, sound, chrome, pad, RARITY } from '../shared/deck.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const pack = $('pack');
const packTop = pack.querySelector('.pack-top');
const packBody = pack.querySelector('.pack-body');
const hit = $('pack-hit');
const tearBar = $('tear-progress');
const cardsEl = $('cards');
const hint = $('hint');
const revealAllBtn = $('reveal-all');
const stamp = $('stamp');
const N = pieces.length;

let state = 'sealed'; // sealed | opening | fanned
let slots = [];
let geo = null;
let revealed = 0;
let opened = false;

// ---------- Pack outline: zigzag crimps and a ragged tear line ----------
const shadow = document.createElement('div');
shadow.className = 'pack-shadow';
shadow.setAttribute('aria-hidden', 'true');
pack.prepend(shadow);

function zig(teeth, yA, yB, reverse = false) {
  const pts = [];
  for (let k = 0; k <= teeth * 2; k++) pts.push(`${((k / (teeth * 2)) * 100).toFixed(2)}% ${k % 2 ? yB : yA}`);
  return reverse ? pts.reverse() : pts;
}

function shapePack() {
  const teeth = 14;
  const seam = [];
  const steps = 22;
  for (let k = 0; k <= steps; k++) seam.push([((k / steps) * 100).toFixed(2), (Math.random() * 5).toFixed(1)]);
  const top = zig(teeth, '6px', '0px');
  packTop.style.clipPath = `polygon(${[...top, ...seam.slice().reverse().map(([x, j]) => `${x}% calc(100% - ${j}px)`)].join(',')})`;
  const bottom = zig(teeth, 'calc(100% - 6px)', '100%', true);
  packBody.style.clipPath = `polygon(${[...seam.map(([x, j]) => `${x}% calc(17% - ${j}px)`), ...bottom].join(',')})`;
  shadow.style.clipPath = `polygon(${[...top, ...bottom].join(',')})`;
}

// Window strip on the pack: three real pieces peeking through.
$('pack-strip').innerHTML = ['lsd', 'blossoming-flowers', 'text-fields', 'adaptive-fields']
  .map((s) => pieces.find((p) => p.slug === s))
  .map((p) => `<img src="${p.thumb}" width="480" height="300" alt="" decoding="async">`)
  .join('');

// ---------- Layout ----------
function layout() {
  const W = stage.clientWidth;
  const H = stage.clientHeight;
  const portrait = W < 700 && H > W * 1.15;
  const rows = portrait ? [4, 3] : [N];
  const hudH = H < 480 ? 70 : 118;
  const availH = H - hudH - 24;
  const availW = W * (portrait ? 0.86 : 0.94);
  const maxPer = Math.max(...rows);
  const rowStep = 1.03; // second row sits just below the first
  let cw = Math.min(212, availH / (1.4 * (1 + (rows.length - 1) * rowStep) + 0.14));
  cw = Math.min(cw, availW / (1 + (maxPer - 1) * 0.46));
  cw = Math.floor(cw);
  const dx = Math.min(cw * 0.7, (availW - cw) / (maxPer - 1));
  const blockH = cw * 1.4 * (1 + (rows.length - 1) * rowStep);
  const top = 14 + (availH - blockH) / 2;
  const pos = [];
  rows.forEach((count, r) => {
    const rowY = top + cw * 0.7 + r * cw * 1.4 * rowStep;
    for (let j = 0; j < count; j++) {
      const t = j - (count - 1) / 2;
      pos.push({ x: t * dx, y: rowY + t * t * cw * 0.03, r: t * (rows.length > 1 ? 5 : 4) });
    }
  });
  const packCy = H / 2 - 26;
  return { W, H, cw, pos, packCy };
}

const at = (p, extra = '') => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.r.toFixed(2)}deg)${extra}`;

// ---------- Cards ----------
function buildCards() {
  cardsEl.innerHTML = '';
  cardsEl.className = 'cards';
  geo = layout();
  cardsEl.style.setProperty('--cw', geo.cw + 'px');
  slots = pieces.map((p, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    slot.setAttribute('role', 'listitem');
    slot.style.zIndex = String(i + 1);
    const card = makeCard(p, { down: true, sizes: Math.round(geo.cw * 2) + 'px', eager: true });
    const flash = document.createElement('div');
    flash.className = 'flash';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn';
    btn.disabled = true;
    btn.addEventListener('click', () => onCard(i));
    slot.append(card, flash, btn);
    cardsEl.append(slot);
    return { slot, card, btn, flash, p, up: false };
  });
  labelAll();
}

function labelAll() {
  slots.forEach((s, i) => {
    s.btn.setAttribute('aria-label', s.up
      ? `${s.p.title}, card ${i + 1} of ${N}, ${RARITY[s.p.rarity]}. Inspect`
      : `Card ${i + 1} of ${N}, face down. Reveal`);
  });
  const next = slots.findIndex((s) => !s.up);
  slots.forEach((s, i) => s.slot.classList.toggle('is-next', state === 'fanned' && i === next));
}

function placeFan() {
  geo = layout();
  cardsEl.style.setProperty('--cw', geo.cw + 'px');
  slots.forEach((s, i) => { s.slot.style.transform = at(geo.pos[i]); });
}

// ---------- Tearing ----------
let drag = null;
let dragged = false;

function setTear(p) {
  tearBar.style.transform = `scaleX(${p})`;
  packTop.style.transform = p ? `translateY(${(-p * 4).toFixed(1)}px) rotate(${(-p * 7).toFixed(2)}deg)` : '';
}

hit.addEventListener('pointerdown', (e) => {
  if (state !== 'sealed') return;
  drag = { x: e.clientX, y: e.clientY, p: 0, lastTick: 0 };
  dragged = false;
  hit.setPointerCapture(e.pointerId);
});

hit.addEventListener('pointermove', (e) => {
  if (state !== 'sealed') return;
  // foil follows the pointer; the pack leans toward it
  const r = pack.getBoundingClientRect();
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  pack.classList.remove('is-idle');
  pack.style.setProperty('--sx', `${(px * 60).toFixed(1)}%`);
  if (!motion.reduced) pack.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg)`;
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) dragged = true;
  const p = Math.max(0, Math.min(1, dx / (r.width * 0.8)));
  drag.p = p;
  setTear(p);
  if (p - drag.lastTick > 0.12) { drag.lastTick = p; sound.tick(); }
  if (p >= 1) { drag = null; open(); }
});

const endDrag = () => {
  if (!drag) return;
  const { p } = drag;
  drag = null;
  if (!dragged) return; // a tap: the click handler opens it
  if (p > 0.55) open();
  else springBack(p);
};
hit.addEventListener('pointerup', endDrag);
hit.addEventListener('pointercancel', endDrag);
hit.addEventListener('pointerleave', () => {
  if (state !== 'sealed' || drag) return;
  pack.classList.add('is-idle');
  pack.style.transform = '';
});
hit.addEventListener('click', () => {
  if (state !== 'sealed') return;
  if (dragged) { dragged = false; return; }
  autoTear();
});

async function springBack(p) {
  await Promise.all([
    anim(tearBar, [{ transform: `scaleX(${p})` }, { transform: 'scaleX(0)' }], { duration: 220, easing: 'ease-out' }),
    anim(packTop, [{ transform: packTop.style.transform || 'none' }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.3,1.6,.5,1)' }),
  ]);
  setTear(0);
}

async function autoTear() {
  if (state !== 'sealed') return;
  state = 'opening';
  if (!motion.reduced) {
    sound.tear();
    await Promise.all([
      anim(tearBar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 360, easing: 'cubic-bezier(.5,0,.3,1)' }),
      anim(packTop, [{ transform: 'none' }, { transform: 'translateY(-4px) rotate(-7deg)' }], { duration: 360, easing: 'cubic-bezier(.5,0,.3,1)' }),
    ]);
  }
  state = 'sealed';
  open();
}

// ---------- Opening sequence ----------
async function open() {
  if (opened) return;
  opened = true;
  state = 'opening';
  hit.disabled = true;
  pack.classList.add('is-torn');
  pack.classList.remove('is-idle');
  shadow.style.clipPath = packBody.style.clipPath; // the torn-off strip takes its shadow with it
  hint.textContent = 'Opening…';
  await preload();
  geo = layout();
  const pr = pack.getBoundingClientRect();
  const s0 = (pr.width * 0.84) / geo.cw;
  const start = { x: 0, y: geo.packCy + pr.height * 0.08, r: 0 };

  if (motion.reduced) {
    await Promise.all([
      anim(pack, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }),
    ]);
    pack.classList.add('is-gone');
    placeFan();
    cardsEl.classList.add('is-live');
    await anim(cardsEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    return fanned();
  }

  sound.tear();
  // 1. the strip flies off
  const flyTop = anim(packTop, [
    { transform: packTop.style.transform || 'none', opacity: 1 },
    { transform: `translate(${pr.width * 0.5}px, ${-pr.height * 0.45}px) rotate(28deg)`, opacity: 0 },
  ], { duration: 520, easing: 'cubic-bezier(.2,.6,.3,1)' });
  pack.style.transform = '';
  anim(pack, [
    { transform: 'translateX(0)' }, { transform: 'translateX(-5px) rotate(-1deg)' },
    { transform: 'translateX(4px) rotate(.8deg)' }, { transform: 'translateX(0)' },
  ], { duration: 220 });

  // 2. cards rise out of the pack, still face down
  slots.forEach((s) => { s.slot.style.transform = at(start, ` scale(${s0})`); });
  cardsEl.classList.add('is-live');
  await wait(140);
  await Promise.all(slots.map((s, i) => {
    const jitter = { x: (i - 3) * pr.width * 0.012, y: geo.packCy - pr.height * 0.5 - i * 2, r: (i - 3) * 1.6 };
    return wait(i * 28).then(() => { sound.tick(); return anim(s.slot, [
      { transform: at(start, ` scale(${s0})`) },
      { transform: at(jitter, ` scale(${s0})`) },
    ], { duration: 420, easing: 'cubic-bezier(.15,.8,.25,1)' }); });
  }));
  await flyTop;

  // 3. the empty pack drops away; cards come to the front
  cardsEl.style.zIndex = '4';
  anim(pack, [
    { transform: 'none', opacity: 1 },
    { transform: `translateY(${geo.H * 0.55}px) rotate(9deg)`, opacity: 0 },
  ], { duration: 520, easing: 'cubic-bezier(.5,0,.8,.4)' }).then(() => pack.classList.add('is-gone'));

  // 4. burst into the fan
  await Promise.all(slots.map((s, i) => wait(60 + i * 46).then(() => {
    sound.tick();
    return anim(s.slot, [
      { transform: s.slot.style.transform },
      { transform: at(geo.pos[i]) },
    ], { duration: 560, easing: 'cubic-bezier(.2,1.25,.35,1)' });
  })));
  fanned();
}

function fanned() {
  state = 'fanned';
  cardsEl.classList.add('is-fanned');
  slots.forEach((s) => { s.btn.disabled = false; });
  revealAllBtn.hidden = false;
  updateHint();
  labelAll();
}

function updateHint() {
  hint.innerHTML = revealed < N
    ? `Tap a card to reveal it · <b>${revealed}/${N}</b>`
    : 'Full set \u00B7 tap a card to inspect';
}

// ---------- Reveal ----------
async function reveal(i, fast = false) {
  const s = slots[i];
  if (s.up) return;
  s.up = true;
  revealed++;
  labelAll();
  updateHint();
  sound.flip();
  await flip(s.card, true, { duration: fast ? 420 : 560 });
  if (motion.reduced) { afterReveal(); return; }
  if (s.p.rarity >= 2) {
    anim(s.flash, [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(1.08)' },
    ], { duration: 520, easing: 'ease-out' });
  }
  if (s.p.rarity === 3) {
    sound.holo();
    const sheen = s.card.querySelector('.card-sheen');
    anim(sheen, [
      { transform: 'translateX(-45%)', opacity: 1 },
      { transform: 'translateX(45%)', opacity: 1 },
    ], { duration: 760, easing: 'cubic-bezier(.4,0,.2,1)' }).then(() => { sheen.style.transform = ''; sheen.style.opacity = ''; });
  }
  afterReveal();
}

function afterReveal() {
  if (revealed === N && stamp.hidden) {
    revealAllBtn.hidden = true;
    stamp.hidden = false;
    if (!motion.reduced) {
      anim(stamp, [
        { transform: 'rotate(-4deg) scale(1.8)', opacity: 0 },
        { transform: 'rotate(-4deg) scale(1)', opacity: 1 },
      ], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' }).then(() => { stamp.style.transform = ''; });
    }
  }
}

revealAllBtn.addEventListener('click', async () => {
  revealAllBtn.hidden = true;
  for (let i = 0; i < N; i++) {
    if (slots[i].up) continue;
    reveal(i, true);
    await wait(motion.reduced ? 60 : 150);
  }
});

function onCard(i) {
  if (state !== 'fanned') return;
  if (!slots[i].up) reveal(i);
  else openInspect(i);
}

// ---------- Inspect ----------
const ins = $('inspect');
const insCard = $('ins-card');
let insIndex = -1;
let detachTilt = null;
let returnFocus = null;

function fillInspect(i) {
  const p = pieces[i];
  insIndex = i;
  if (detachTilt) detachTilt();
  insCard.innerHTML = '';
  const card = makeCard(p, { sizes: '680px', eager: true });
  insCard.append(card);
  detachTilt = tilt(card, { max: 14 });
  $('ins-no').textContent = `No. ${pad(p.n)} / ${pad(p.total)} · ${RARITY[p.rarity]}`;
  $('ins-title').textContent = p.title;
  $('ins-tags').innerHTML = p.tags.map((t) => `<span class="chip">${t}</span>`).join('');
  $('ins-desc').textContent = p.blurb;
  $('ins-stats').innerHTML = `<div><dt>Engine</dt><dd>${p.engine}</dd></div><div><dt>Input</dt><dd>${p.input}</dd></div><div><dt>Card</dt><dd>${pad(p.n)}/${pad(p.total)}</dd></div>`;
  $('ins-ctrl').innerHTML = `<b>How to play with it</b>${p.controls}`;
  const enter = $('ins-enter');
  enter.href = p.url;
  enter.setAttribute('aria-label', `Enter ${p.title} (opens in a new tab)`);
  return card;
}

async function openInspect(i) {
  returnFocus = document.activeElement;
  const card = fillInspect(i);
  ins.hidden = false;
  $('ins-close').focus();
  if (motion.reduced) return anim(ins, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  // zoom from the fan card into place
  const from = slots[i].card.getBoundingClientRect();
  const to = card.getBoundingClientRect();
  const sx = from.width / to.width;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  anim(ins, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
  await anim(card, [
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}) rotate(${geo.pos[i].r}deg)` },
    { transform: 'none' },
  ], { duration: 380, easing: 'cubic-bezier(.2,.9,.25,1)' });
  card.style.transform = '';
}

function navInspect(d) {
  const i = (insIndex + d + N) % N;
  const s = slots[i];
  if (!s.up) { s.up = true; revealed++; s.card.classList.remove('is-down'); labelAll(); updateHint(); afterReveal(); }
  sound.tick();
  const card = fillInspect(i);
  if (!motion.reduced) anim(card, [
    { transform: `translateX(${d * 40}px) rotate(${d * 4}deg)`, opacity: 0 },
    { transform: 'none', opacity: 1 },
  ], { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' }).then(() => { card.style.transform = ''; card.style.opacity = ''; });
}

async function closeInspect() {
  if (ins.hidden) return;
  if (detachTilt) { detachTilt(); detachTilt = null; }
  if (!motion.reduced) await anim(ins, [{ opacity: 1 }, { opacity: 0 }], { duration: 140 });
  ins.hidden = true;
  ins.style.opacity = '';
  const target = slots[insIndex] && slots[insIndex].btn;
  (target || returnFocus)?.focus();
}

$('ins-close').addEventListener('click', closeInspect);
$('ins-prev').addEventListener('click', () => navInspect(-1));
$('ins-next').addEventListener('click', () => navInspect(1));
ins.addEventListener('click', (e) => { if (e.target === ins) closeInspect(); });

// swipe the big card to move through the set
let sw = null;
insCard.addEventListener('pointerdown', (e) => { sw = { x: e.clientX, y: e.clientY }; });
insCard.addEventListener('pointerup', (e) => {
  if (!sw) return;
  const dx = e.clientX - sw.x;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - sw.y)) navInspect(dx < 0 ? 1 : -1);
  sw = null;
});

document.addEventListener('keydown', (e) => {
  if (!ins.hidden) {
    if (e.key === 'Escape') { e.preventDefault(); closeInspect(); }
    else if (e.key === 'ArrowRight') navInspect(1);
    else if (e.key === 'ArrowLeft') navInspect(-1);
    else if (e.key === 'Tab') {
      const f = [...ins.querySelectorAll('a[href], button:not([disabled])')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
});

// ---------- Replay / resize ----------
async function reset() {
  if (!ins.hidden) await closeInspect();
  if (state === 'opening') return;
  await anim(stage, [{ opacity: 1 }, { opacity: 0 }], { duration: motion.reduced ? 100 : 180 });
  state = 'sealed';
  opened = false;
  revealed = 0;
  stamp.hidden = true;
  revealAllBtn.hidden = true;
  hit.disabled = false;
  pack.className = 'pack is-idle';
  for (const el of [pack, packTop, packBody, tearBar]) { el.style.transform = ''; el.style.opacity = ''; }
  cardsEl.style.zIndex = '';
  shapePack();
  setTear(0);
  buildCards();
  hint.textContent = 'Drag along the top edge to tear, or tap';
  stage.style.opacity = '';
  if (!motion.reduced) {
    anim(pack, [{ transform: 'translateY(40%)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.9,.3,1)' })
      .then(() => { pack.style.transform = ''; pack.style.opacity = ''; });
  }
}

let rz = 0;
addEventListener('resize', () => {
  cancelAnimationFrame(rz);
  rz = requestAnimationFrame(() => { if (state === 'fanned') placeFan(); });
});

chrome({ onReplay: reset });
shapePack();
buildCards();
pack.classList.add('is-idle');
// warm the art while the visitor looks at the closed deck
(window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => preload());
