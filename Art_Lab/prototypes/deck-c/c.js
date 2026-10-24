// Deck C: lift the flap of a card box, slide the deck out, then flick through it.
// The card on top is alive: its art drifts under the pointer (or on its own) and
// can switch to a live, running preview of the real piece.
import { pieces, makeCard, preload, anim, wait, motion, sound, chrome, pad, pips, RARITY } from '../shared/deck.js';

const $ = (id) => document.getElementById(id);
const browser = $('browser');
const area = $('card-area');
const stack = $('stack');
const flap = $('box-flap');
const seal = $('box-seal');
const hit = $('box-hit');
const info = $('info-inner');
const pipsNav = $('pips');
const pipRow = $('pip-row');
const boxParts = [...stack.querySelectorAll('.boxpart')];
const N = pieces.length;

let state = 'closed'; // closed | opening | browse | moving
let cw = 300;
let cards = [];
let order = pieces.map((_, i) => i); // order[0] is on top
let live = false;
let liveTimer = 0;
let queue = 0;

// ---------- Size ----------
function measure() {
  const r = area.getBoundingClientRect();
  const landscapePhone = innerHeight <= 500 && innerWidth > innerHeight;
  const byH = (r.height - 28) / 1.4;
  cw = Math.floor(landscapePhone ? Math.min(byH, 260) : Math.min(380, r.width * 0.8, byH));
  browser.style.setProperty('--cw', cw + 'px');
}

// Depth pose: a loose, slightly fanned pile under the top card.
const ROT = [0, -2.2, 2.6, -3.4, 3.8, -4.6, 5];
function pose(d) {
  if (d === 0) return 'translate(0px, 0px) rotate(0deg)';
  const k = Math.min(d, 6);
  return `translate(${(k * cw * 0.012).toFixed(1)}px, ${(k * cw * 0.018).toFixed(1)}px) rotate(${ROT[k]}deg) scale(${(1 - k * 0.02).toFixed(3)})`;
}

function build() {
  cards.forEach((c) => c.el.remove());
  cards = pieces.map((p, i) => {
    const el = document.createElement('div');
    el.className = 'ccard';
    el.setAttribute('aria-hidden', 'true');
    el.append(makeCard(p, { sizes: Math.round(cw * 2) + 'px', eager: i < 2 }));
    stack.prepend(el);
    return { el, p, card: el.firstElementChild, img: el.querySelector('.card-art img'), art: el.querySelector('.card-art'), sheen: el.querySelector('.card-sheen'), lift: el.querySelector('.card-lift') };
  });
  order = pieces.map((_, i) => i);
  restack(false);
}

function restack(inBox) {
  order.forEach((ci, d) => {
    const c = cards[ci];
    c.el.style.zIndex = String(10 - d);
    c.el.style.transform = inBox ? `translateY(${-d * 0.4}px)` : pose(d);
    c.el.classList.toggle('is-top', !inBox && d === 0);
  });
}

// ---------- Opening ----------
let fdrag = null;
let fdragged = false;
const setFlap = (p) => { flap.style.transform = `perspective(700px) rotateX(${(p * 172).toFixed(1)}deg)`; };

hit.addEventListener('pointerdown', (e) => {
  if (state !== 'closed') return;
  fdrag = { y: e.clientY, x: e.clientX, p: 0 };
  fdragged = false;
  hit.setPointerCapture(e.pointerId);
});
hit.addEventListener('pointermove', (e) => {
  if (!fdrag || state !== 'closed') return;
  const dy = fdrag.y - e.clientY;
  if (Math.abs(dy) > 8 || Math.abs(e.clientX - fdrag.x) > 8) fdragged = true;
  const p = Math.max(0, Math.min(1, dy / (cw * 0.5)));
  fdrag.p = p;
  if (!motion.reduced) setFlap(p * 0.9);
  if (p >= 1) { fdrag = null; openBox(0.9); }
});
const endFlap = () => {
  if (!fdrag) return;
  const { p } = fdrag;
  fdrag = null;
  if (!fdragged) return;
  if (p > 0.4) openBox(p * 0.9);
  else anim(flap, [{ transform: flap.style.transform || 'none' }, { transform: 'perspective(700px) rotateX(0deg)' }], { duration: 240, easing: 'cubic-bezier(.3,1.5,.5,1)' });
};
hit.addEventListener('pointerup', endFlap);
hit.addEventListener('pointercancel', endFlap);
hit.addEventListener('click', () => { if (fdragged) { fdragged = false; return; } openBox(0); });

async function openBox(from = 0) {
  if (state !== 'closed') return;
  state = 'opening';
  document.body.classList.remove('is-closed');
  await preload();
  const H = cw * 1.4;

  if (motion.reduced) {
    await Promise.all(boxParts.map((el) => anim(el, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 })));
    boxParts.forEach((el) => { el.hidden = true; });
    restack(false);
    return browse();
  }

  sound.flip();
  anim(info, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
  // seal peels, flap swings open and drops behind the deck
  anim(seal, [{ transform: 'none', opacity: 1 }, { transform: 'rotate(-30deg) translate(-20%, -60%) scaleX(.4)', opacity: 0 }], { duration: 260, easing: 'ease-in' });
  const flapAnim = anim(flap, [
    { transform: `perspective(700px) rotateX(${from * 172}deg)` },
    { transform: 'perspective(700px) rotateX(186deg)', offset: 0.8 },
    { transform: 'perspective(700px) rotateX(172deg)' },
  ], { duration: 460, easing: 'cubic-bezier(.3,.6,.3,1)' });
  await wait(200);
  flap.style.zIndex = '0';
  await flapAnim;

  // hold the deck, pull the box down and away
  sound.tear();
  order.forEach((ci, d) => anim(cards[ci].el, [
    { transform: cards[ci].el.style.transform || 'none' },
    { transform: `translateY(${-H * 0.07 - d * 0.4}px)` },
  ], { duration: 520, easing: 'cubic-bezier(.3,.7,.3,1)' }));
  const fall = { duration: 780, easing: 'cubic-bezier(.45,0,.4,1)' };
  const fade = [{ opacity: 1 }, { opacity: 1, offset: 0.62 }, { opacity: 0 }];
  boxParts.filter((el) => el !== seal).forEach((el) => {
    const base = el.style.transform || '';
    const move = [
      { transform: `translateY(0px) ${base}` },
      { transform: `translateY(${H * 0.62}px) ${base}`, offset: 0.62 },
      { transform: `translateY(${H * 0.95}px) ${base}` },
    ];
    // opacity on the 3D flap would flatten it, so fade its faces instead
    if (el === flap) { anim(el, move, fall); flap.querySelectorAll('div').forEach((f) => anim(f, fade, fall)); }
    else anim(el, move.map((k, i) => ({ ...k, ...fade[i] })), fall);
  });
  await wait(640);

  // deck settles, then fans once to show it holds seven
  await Promise.all(order.map((ci, d) => wait(d * 30).then(() => anim(cards[ci].el, [
    { transform: cards[ci].el.style.transform },
    { transform: pose(d) },
  ], { duration: 520, easing: 'cubic-bezier(.2,1.2,.35,1)' }))));
  boxParts.forEach((el) => { el.hidden = true; });
  sound.thump();
  await Promise.all(order.map((ci, d) => {
    const a = (d - (N - 1) / 2) * 9;
    return wait(d * 24).then(() => anim(cards[ci].el, [
      { transform: pose(d) },
      { transform: `rotate(${a}deg) translateY(${-Math.abs(a) * 0.4}px)`, offset: 0.45 },
      { transform: `rotate(${a}deg) translateY(${-Math.abs(a) * 0.4}px)`, offset: 0.6 },
      { transform: pose(d) },
    ], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' }));
  }));
  browse();
}

function browse() {
  state = 'browse';
  restack(false);
  pipsNav.hidden = false;
  renderPips();
  renderInfo(true);
  measure();
  restack(false);
  startAlive();
  scheduleLive();
}

// ---------- Info ----------
function renderInfo(animate = true) {
  const p = pieces[order[0]];
  info.innerHTML = `<p class="info-no">No. ${pad(p.n)} / ${pad(p.total)} &middot; ${RARITY[p.rarity]} <span aria-hidden="true">${pips(p.rarity)}</span></p>
<h2 class="info-title">${p.title}</h2>
<div class="info-tags">${p.tags.some((t) => t.toLowerCase() === p.engine.toLowerCase()) ? '' : `<span class="chip">${p.engine}</span>`}${p.tags.map((t) => `<span class="chip">${t}</span>`).join('')}</div>
<p class="info-desc">${p.blurb}</p>
<p class="info-ctrl"><b>How to play with it</b>${p.controls}</p>
<div class="info-actions">
  <a class="btn btn-primary" href="${p.url}" target="_blank" rel="noopener" aria-label="Enter ${p.title} (opens in a new tab)">Enter piece <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
  <button class="btn" type="button" id="live-btn" aria-pressed="${live}">Live preview</button>
</div>
<p class="info-hint">Swipe the card, scroll, or use <kbd>&larr;</kbd> <kbd>&rarr;</kbd></p>`;
  $('live-btn').addEventListener('click', toggleLive);
  if (animate && !motion.reduced) anim(info, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: 'ease-out' });
}

function renderPips() {
  if (!pipRow.children.length) {
    pipRow.innerHTML = pieces.map((p, i) => `<button class="pip" type="button" data-i="${i}" aria-label="${p.title}, card ${p.n}">${pad(p.n)}</button>`).join('');
    pipRow.addEventListener('click', (e) => { const b = e.target.closest('.pip'); if (b) goTo(+b.dataset.i); });
  }
  [...pipRow.children].forEach((b, i) => b.setAttribute('aria-current', String(i === order[0])));
}

// ---------- Moving through the deck ----------
async function next(dir = -1, fast = false, fromDrag = null) {
  if (state === 'moving') { queue = 1; return; }
  if (state !== 'browse') return;
  state = 'moving';
  unmountLive();
  const top = cards[order[0]];
  calm(top);
  order.push(order.shift());
  renderPips();
  renderInfo();
  sound.flip();
  const t = fast ? 0.55 : 1;
  if (motion.reduced) {
    await anim(top.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
    restack(false);
    await anim(top.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
  } else {
    const out = `translate(${dir * cw * 1.08}px, ${-cw * 0.06}px) rotate(${dir * 16}deg)`;
    order.slice(0, -1).forEach((ci, d) => {
      const c = cards[ci];
      c.el.style.zIndex = String(10 - d);
      anim(c.el, [{ transform: c.el.style.transform }, { transform: pose(d) }], { duration: 300 * t, delay: 60 * t, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    await anim(top.el, [{ transform: fromDrag || top.el.style.transform }, { transform: out }], { duration: 210 * t, easing: 'cubic-bezier(.4,0,1,1)' });
    top.el.style.zIndex = '1';
    await anim(top.el, [{ transform: out }, { transform: pose(N - 1) }], { duration: 300 * t, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  settle();
}

async function prev(fast = false) {
  if (state === 'moving') { queue = -1; return; }
  if (state !== 'browse') return;
  state = 'moving';
  unmountLive();
  calm(cards[order[0]]);
  const ci = order.pop();
  order.unshift(ci);
  const c = cards[ci];
  renderPips();
  renderInfo();
  sound.flip();
  const t = fast ? 0.55 : 1;
  if (motion.reduced) {
    restack(false);
    await anim(c.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
  } else {
    const out = `translate(${cw * 1.08}px, ${-cw * 0.06}px) rotate(16deg)`;
    await anim(c.el, [{ transform: c.el.style.transform }, { transform: out }], { duration: 220 * t, easing: 'cubic-bezier(.3,0,.6,1)' });
    c.el.style.zIndex = '20';
    order.slice(1).forEach((cj, d) => {
      const o = cards[cj];
      o.el.style.zIndex = String(9 - d);
      anim(o.el, [{ transform: o.el.style.transform }, { transform: pose(d + 1) }], { duration: 280 * t, easing: 'cubic-bezier(.2,.8,.2,1)' });
    });
    await anim(c.el, [{ transform: out }, { transform: pose(0) }], { duration: 300 * t, easing: 'cubic-bezier(.2,.9,.25,1)' });
  }
  settle();
}

function settle() {
  restack(false);
  state = 'browse';
  if (queue) { const q = queue; queue = 0; return q > 0 ? next(-1, true) : prev(true); }
  scheduleLive();
}

async function goTo(i) {
  const k = order.indexOf(i);
  if (k <= 0 || state !== 'browse') return;
  if (k <= N / 2) for (let s = 0; s < k; s++) { await next(-1, true); await waitIdle(); }
  else for (let s = 0; s < N - k; s++) { await prev(true); await waitIdle(); }
}
const waitIdle = () => new Promise((r) => { const f = () => (state === 'browse' ? r() : requestAnimationFrame(f)); f(); });

// Drag the top card; let go past the threshold to flick it under the deck.
let drag = null;
stack.addEventListener('pointerdown', (e) => {
  if (state !== 'browse') return;
  const top = cards[order[0]];
  if (!top.el.contains(e.target)) return;
  drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, el: top.el };
  stack.setPointerCapture(e.pointerId);
});
stack.addEventListener('pointermove', (e) => {
  if (!drag) return;
  drag.dx = e.clientX - drag.x;
  drag.dy = e.clientY - drag.y;
  if (!motion.reduced) drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy * 0.25}px) rotate(${drag.dx * 0.06}deg)`;
});
const endDrag = () => {
  if (!drag) return;
  const { dx, dy, t, el } = drag;
  drag = null;
  const v = Math.abs(dx) / Math.max(1, performance.now() - t);
  if (Math.abs(dx) > cw * 0.25 || (v > 0.5 && Math.abs(dx) > 30)) return next(dx < 0 ? -1 : 1, false, el.style.transform);
  if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return next(-1); // a tap flips to the next card
  anim(el, [{ transform: el.style.transform }, { transform: pose(0) }], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' });
};
stack.addEventListener('pointerup', endDrag);
stack.addEventListener('pointercancel', endDrag);

let wheelAcc = 0;
let wheelLock = 0;
browser.addEventListener('wheel', (e) => {
  if (state === 'closed' || state === 'opening') return;
  e.preventDefault();
  const now = performance.now();
  if (now < wheelLock) return;
  wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  if (Math.abs(wheelAcc) > 50) {
    if (wheelAcc > 0) next(-1); else prev();
    wheelAcc = 0;
    wheelLock = now + 340;
  }
}, { passive: false });

document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (state === 'closed' && (e.key === 'Enter' || e.key === ' ') && document.activeElement === document.body) { e.preventDefault(); openBox(0); return; }
  if (state !== 'browse' && state !== 'moving') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); next(-1); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); prev(); }
  else if (e.key === 'Home') goTo(0);
  else if (e.key === 'End') goTo(N - 1);
  else if (e.key === 'Escape' && live) toggleLive();
});

$('next-btn').addEventListener('click', () => next(-1));
$('prev-btn').addEventListener('click', () => prev());
$('open-btn').addEventListener('click', () => openBox(0));

// ---------- Alive: the top card's art drifts on its own (a compositor-run CSS
// animation); with a mouse over it, parallax, tilt and sheen follow the pointer.
let raf = 0;
let pointer = { x: 0, y: 0 };
let lastPointer = 0;
let cur = { x: 0, y: 0 };
browser.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || motion.reduced || state !== 'browse') return;
  const r = stack.getBoundingClientRect();
  pointer = { x: Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width - 0.5)), y: Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height - 0.5)) };
  lastPointer = performance.now();
  if (!raf) {
    const top = cards[order[0]];
    // start from where the drift animation currently has the art
    stack.classList.add('is-steer');
    top.card.classList.add('is-lit');
    raf = requestAnimationFrame(frame);
  }
});

function frame(now) {
  const top = cards[order[0]];
  if (state !== 'browse' || drag || now - lastPointer > 1800) {
    raf = 0;
    calm(top);
    stack.classList.remove('is-steer');
    return;
  }
  raf = requestAnimationFrame(frame);
  cur.x += (pointer.x - cur.x) * 0.12;
  cur.y += (pointer.y - cur.y) * 0.12;
  top.img.style.transform = `translate(${(-cur.x * 7).toFixed(2)}%, ${(-cur.y * 7).toFixed(2)}%) scale(1.14)`;
  top.lift.style.transform = `perspective(1000px) rotateX(${(-cur.y * 7).toFixed(2)}deg) rotateY(${(cur.x * 9).toFixed(2)}deg)`;
  top.sheen.style.transform = `translateX(${(-40 + (cur.x + 0.5) * 55).toFixed(1)}%)`;
}

function calm(c) {
  c.img.style.transform = '';
  c.sheen.style.transform = '';
  c.lift.style.transform = '';
  c.card.classList.remove('is-lit');
}

function startAlive() {
  cancelAnimationFrame(raf);
  raf = 0;
  stack.classList.remove('is-steer');
  cards.forEach(calm);
}

// ---------- Live preview: the real piece, running inside the art window ----------
function toggleLive() {
  live = !live;
  const b = $('live-btn');
  if (b) b.setAttribute('aria-pressed', String(live));
  if (live) scheduleLive(0); else unmountLive();
}

function scheduleLive(delay = 450) {
  clearTimeout(liveTimer);
  if (!live || state !== 'browse') return;
  liveTimer = setTimeout(mountLive, delay);
}

function unmountLive() {
  clearTimeout(liveTimer);
  stack.querySelectorAll('.live-frame, .live-tag').forEach((f) => f.remove());
}

function mountLive() {
  unmountLive();
  const top = cards[order[0]];
  const r = top.art.getBoundingClientRect();
  const scale = 0.5; // render the piece at 2x the window, shown at half size
  const f = document.createElement('iframe');
  f.className = 'live-frame';
  f.title = `${top.p.title}, live preview`;
  f.tabIndex = -1;
  f.setAttribute('aria-hidden', 'true');
  f.setAttribute('allow', "autoplay 'none'");
  f.width = Math.round(r.width / scale);
  f.height = Math.round(r.height / scale);
  f.style.transform = `scale(${scale})`;
  f.src = top.p.url;
  f.addEventListener('load', () => {
    // Pieces are same-origin: hide their own UI and pin the main canvas full-frame.
    const tidy = () => {
      try {
        const d = f.contentDocument;
        if (!d) return;
        const canv = [...d.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
        if (canv && !canv.dataset.live) {
          canv.dataset.live = '1';
          const st = d.createElement('style');
          st.textContent = 'html,body{overflow:hidden!important;background:#000!important}'
            + 'canvas[data-live]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;object-fit:cover;z-index:2147483647!important}';
          d.head.append(st);
        }
      } catch { /* cross-origin: leave as is */ }
    };
    tidy();
    setTimeout(tidy, 400);
    setTimeout(() => { tidy(); f.classList.add('is-on'); }, 700);
  });
  const tag = document.createElement('span');
  tag.className = 'live-tag';
  tag.textContent = 'Live';
  top.art.append(f, tag);
}

// ---------- Re-box ----------
async function rebox() {
  if (state === 'closed' || state === 'opening') return;
  if (live) toggleLive();
  startAlive();
  await waitIdle();
  state = 'opening';
  pipsNav.hidden = true;
  const fade = motion.reduced ? 120 : 200;
  await anim(stack, [{ opacity: 1 }, { opacity: 0 }], { duration: fade });
  measure();
  build();
  restack(true);
  boxParts.forEach((el) => { el.hidden = false; el.style.transform = ''; el.style.opacity = ''; el.style.zIndex = ''; });
  flap.querySelectorAll('div').forEach((f) => { f.style.opacity = ''; });
  seal.style.transform = ''; seal.style.opacity = '';
  setFlap(0);
  info.innerHTML = initialInfo;
  $('open-btn').addEventListener('click', () => openBox(0));
  document.body.classList.add('is-closed');
  state = 'closed';
  stack.style.opacity = '';
  if (!motion.reduced) anim(stack, [{ transform: `translateY(${-cw * 0.3}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.9,.3,1)' });
}

let rz = 0;
addEventListener('resize', () => {
  cancelAnimationFrame(rz);
  rz = requestAnimationFrame(() => {
    measure();
    if (state === 'browse') { restack(false); if (live) scheduleLive(200); }
  });
});

const initialInfo = info.innerHTML;
chrome({ onReplay: rebox });
measure();
build();
restack(true);
setFlap(0);
// warm the art while the visitor looks at the closed deck
(window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => preload());
