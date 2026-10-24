// Art Lab cards: the pieces from the site registry, card markup, motion helpers
// and a tiny synth for the optional sound.
import { experiments } from '../../assets/js/data.js';

// Site root, so links and thumbnails resolve the same from any page URL.
const ROOT = new URL('../../', import.meta.url).href;

export const RARITY = ['', 'Common', 'Uncommon', 'Holo'];

export const pieces = experiments.map((e, i) => ({
  ...e,
  engine: e.engine || 'Canvas',
  input: e.input || 'Watch',
  rarity: e.rarity || 1,
  controls: e.controls || '',
  n: i + 1,
  total: experiments.length,
  url: ROOT + e.href,
  thumb: `${ROOT}assets/thumbs/${e.slug}-480.webp`,
  thumb2x: `${ROOT}assets/thumbs/${e.slug}-960.webp`,
}));

export const N = pieces.length;
export const pad = (n) => String(n).padStart(2, '0');
export const pips = (r) => '◆'.repeat(r) + '◇'.repeat(3 - r);
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Front face markup. `sizes` is the rendered card width, for srcset. */
function frontHTML(p, { sizes = '240px', eager = false } = {}) {
  return `<div class="card-face card-front">
  <div class="card-top"><span class="card-no">${pad(p.n)}<small>/${pad(p.total)}</small></span><span class="card-tech">${esc(p.engine)}</span></div>
  <div class="card-art"><img src="${p.thumb}" srcset="${p.thumb} 480w, ${p.thumb2x} 960w" sizes="${sizes}" width="480" height="300" alt="" decoding="async" loading="${eager ? 'eager' : 'lazy'}" draggable="false"></div>
  <div class="card-title">${esc(p.title)}</div>
  <div class="card-tags">${p.tags.map(esc).join(' · ')}</div>
  <dl class="card-stats">
    <div><dt>Engine</dt><dd>${esc(p.engine)}</dd></div>
    <div><dt>Input</dt><dd>${esc(p.input)}</dd></div>
    <div><dt>${RARITY[p.rarity]}</dt><dd class="pips">${pips(p.rarity)}</dd></div>
  </dl>
  <div class="card-sheen"></div>
</div>`;
}

const BACK = '<div class="card-face card-back"><div class="back-mark"><i><span>AL</span></i><b>ART LAB</b></div></div>';

/**
 * A card element: .card > .card-lift (tilt) > .card-inner (flip) > faces.
 * Cards that never flip (`flat`) skip the back face and the 3D context.
 */
export function makeCard(p, { down = false, flat = false, sizes, eager } = {}) {
  const el = document.createElement('div');
  el.className = 'card' + (down ? ' is-down' : '') + (flat ? ' is-flat' : '');
  el.dataset.rarity = p.rarity;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="card-lift"><div class="card-inner">${frontHTML(p, { sizes, eager })}${flat ? '' : BACK}</div></div>`;
  return el;
}

/** Warm the image cache so a flip never reveals an empty frame. */
let warmed = null;
export function preload() {
  warmed ||= Promise.all(
    pieces.map((p) => {
      const img = new Image();
      img.src = p.thumb;
      return img.decode().catch(() => {});
    }),
  );
  return warmed;
}

// ---------- Motion ----------
const mq = matchMedia('(prefers-reduced-motion: reduce)');
export const motion = {
  get reduced() {
    return mq.matches;
  },
};

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** element.animate that resolves when finished and keeps the end state. */
export function anim(el, frames, opts) {
  const a = el.animate(frames, { fill: 'forwards', ...opts });
  return a.finished.then(
    () => {
      try {
        a.commitStyles();
      } catch {
        /* element left the document */
      }
      a.cancel();
    },
    () => {},
  );
}

/** Turn a card face up (up=true) or down. A calm crossfade under reduced motion. */
export async function flip(card, up, { duration = 520 } = {}) {
  const inner = card.querySelector('.card-inner');
  const from = card.classList.contains('is-down') ? 180 : 0;
  const to = up ? 0 : 180;
  if (from === to) return;
  if (motion.reduced) {
    await anim(inner, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
    card.classList.toggle('is-down', !up);
    inner.style.transform = '';
    await anim(inner, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    inner.style.opacity = '';
    return;
  }
  await anim(
    inner,
    [
      { transform: `rotateY(${from}deg)` },
      { transform: `translateZ(60px) rotateY(${(from + to) / 2}deg) scale(1.08)`, offset: 0.5 },
      { transform: `rotateY(${to}deg)` },
    ],
    { duration, easing: 'cubic-bezier(.3,.7,.3,1)' },
  );
  card.classList.toggle('is-down', !up);
  inner.style.transform = '';
}

// ---------- Sound (off by default; short synth ticks, no files) ----------
export const sound = {
  on: false,
  ctx: null,
  noise: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      const len = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  burst({ dur = 0.04, freq = 3200, q = 1.2, gain = 0.22, sweep = 0, type = 'bandpass' } = {}) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(c.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  },
  tone(freq, dur = 0.12, gain = 0.06, when = 0) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  tick() {
    this.burst({ dur: 0.035, freq: 3400 + Math.random() * 600, gain: 0.25 });
  },
  flip() {
    this.burst({ dur: 0.09, freq: 1800, sweep: 4200, q: 0.8, gain: 0.2 });
  },
  thump() {
    this.burst({ dur: 0.07, freq: 500, q: 0.7, gain: 0.3, type: 'lowpass' });
  },
  tear() {
    this.burst({ dur: 0.45, freq: 700, sweep: 5200, q: 0.6, gain: 0.3 });
  },
  holo() {
    this.tone(880, 0.14);
    this.tone(1320, 0.22, 0.05, 0.07);
  },
};
