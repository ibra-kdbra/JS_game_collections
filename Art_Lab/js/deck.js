// Art Lab page: the pack opening, the deck and the "All pieces" grid.
//
// Views (set on <html data-view>, first by the inline script in index.html):
//   opening  first visit: tear the pack, reveal the cards, then on to the deck
//   deck     the card stack (repeat visits start here)
//   grid     all pieces as a plain list (also the no-JavaScript view)
import { createStore } from '../../assets/kit/storage.js';
import { motion, sound, anim, N } from './cards.js';
import { createPack } from './pack.js';
import { createStack } from './stack.js';

const store = createStore('artlab'); // artlab.opened, artlab.view
const root = document.documentElement;
const $ = (id) => document.getElementById(id);

const viewBtn = $('view-btn');
const soundBtn = $('sound-btn');
const packBtn = $('pack-btn');
const skipBtn = $('skip-btn');
const subtitle = $('bar-sub');
const views = { opening: $('opening'), deck: $('deck'), grid: $('all') };

const stack = createStack();
const pack = createPack({ onComplete: handOver });

let view = null;
let busy = false;

// ---------- Views ----------
function setView(next, { focus = true, fade = true } = {}) {
  const prev = view;
  if (prev === next) return;
  view = next;
  if (prev === 'deck') stack.hide();
  if (prev === 'opening') pack.stop();
  root.dataset.view = next;
  for (const [name, el] of Object.entries(views)) el.inert = name !== next;

  viewBtn.setAttribute('aria-pressed', String(next === 'grid'));
  if (next !== 'opening') store.set('view', next);
  paintBar();

  if (next === 'deck') {
    stack.show();
    if (focus) stack.focus();
  } else if (next === 'grid') {
    if (location.hash !== '#all') history.replaceState(null, '', '#all');
    if (focus) $('all-title').focus({ preventScroll: true });
    scrollTo(0, 0);
  } else if (next === 'opening') {
    pack.start();
    if (focus) pack.focusStart();
  }
  if (next !== 'grid' && location.hash === '#all') history.replaceState(null, '', location.pathname + location.search);
  if (fade) anim(views[next], [{ opacity: 0 }, { opacity: 1 }], { duration: motion.reduced ? 200 : 260, easing: 'ease-out' });
}

function paintBar() {
  const opening = view === 'opening';
  skipBtn.hidden = !opening;
  packBtn.hidden = opening;
  subtitle.textContent = store.get('opened', false) ? `Series 01 · Set complete ${N}/${N}` : `Series 01 · ${N} generative pieces`;
}

function markOpened() {
  store.set('opened', true);
  paintBar();
}

// The opening is done: gather the fan onto the deck's top card, then cross-fade.
async function handOver(top = 0) {
  if (busy) return;
  busy = true;
  markOpened();
  root.classList.add('is-handoff');
  views.deck.inert = true;
  stack.show(top);
  await pack.gather(stack.topRect(), top);
  const ms = motion.reduced ? 200 : 240;
  await Promise.all([
    anim(views.opening, [{ opacity: 1 }, { opacity: 0 }], { duration: ms }),
    anim(views.deck, [{ opacity: 0 }, { opacity: 1 }], { duration: ms }),
  ]);
  root.classList.remove('is-handoff');
  views.opening.style.opacity = '';
  busy = false;
  setView('deck', { fade: false });
}

function skip() {
  if (view !== 'opening' || busy) return;
  markOpened();
  setView('deck');
}

// ---------- Top bar ----------
viewBtn.addEventListener('click', () => {
  if (busy) return;
  if (view === 'grid') setView(store.get('opened', false) ? 'deck' : 'opening');
  else {
    if (view === 'opening') markOpened();
    setView('grid');
  }
});

packBtn.addEventListener('click', () => {
  if (busy) return;
  setView('opening');
});

skipBtn.addEventListener('click', skip);

const ICON_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
function paintSound() {
  soundBtn.setAttribute('aria-pressed', String(sound.on));
  soundBtn.innerHTML = (sound.on ? ICON_ON : ICON_OFF) + '<span class="lbl">Sound</span>';
}
soundBtn.addEventListener('click', () => {
  sound.on = !sound.on;
  if (sound.on) {
    sound.ensure();
    sound.tick();
  }
  paintSound();
});
paintSound();

// "Skip to all pieces" and links to #all switch to the grid.
addEventListener('hashchange', () => {
  if (location.hash === '#all' && view !== 'grid') setView('grid');
});
$('skip-link').addEventListener('click', (e) => {
  e.preventDefault();
  if (view !== 'grid') setView('grid');
  else $('all-title').focus();
});

// ---------- Keys ----------
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], dialog, .feedback-modal')) return;
  if (view === 'opening' && e.key === 'Escape') {
    e.preventDefault();
    skip();
  } else if (view === 'deck') {
    // Keep Enter/Space on buttons and links doing what they say.
    const onControl = e.target.closest && e.target.closest('a, button') && (e.key === 'Enter' || e.key === ' ');
    if (!onControl && stack.onKey(e)) e.preventDefault();
  }
});

// ---------- Start ----------
let first = root.dataset.view;
if (location.hash === '#all') first = 'grid';
if (!views[first]) first = store.get('opened', false) || motion.reduced ? 'deck' : 'opening';
if (first === 'opening' && motion.reduced) first = 'deck'; // calm: straight to the deck
setView(first, { focus: false, fade: first === 'deck' });
