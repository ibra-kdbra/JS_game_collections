// Art Lab deck prototypes: shared data, card markup, motion helpers and a tiny synth.
// Data comes from the site registry so the prototypes always show the real pieces.
import { experiments } from '../../../assets/js/data.js';

const ROOT = '../../../';

// Card "stats" per piece: the engine it runs on, how you interact with it, a rarity
// (1 common, 2 uncommon, 3 holo) and a one-line controls hint for the detail view.
const EXTRA = {
  'blossoming-flowers': { engine: 'CSS', input: 'Watch', rarity: 1, controls: 'No input: sit back and let it bloom. Pure CSS, no canvas.' },
  'flow-fields': { engine: 'Canvas', input: 'Keys', rarity: 1, controls: 'D or double-tap shows the hidden field. Click to reseed.' },
  'text-fields': { engine: 'Canvas', input: 'Keys', rarity: 2, controls: 'D or double-tap shows the field under the letters.' },
  'experimental-math': { engine: 'Canvas', input: 'Watch', rarity: 1, controls: 'No input: equations drift and redraw on their own.' },
  'adaptive-fields': { engine: 'p5.js', input: 'Panel', rarity: 2, controls: 'Tune particles, speed and colour in the panel; Enter applies.' },
  lsd: { engine: 'WebGL', input: 'Keys', rarity: 3, controls: 'R randomise, Space pause, S screenshot, V record a clip.' },
  'particular-drift': { engine: 'WebGL 2', input: 'Keys', rarity: 3, controls: 'U upload your image, R randomise, C palette, S save.' },
};

export const RARITY = ['', 'Common', 'Uncommon', 'Holo'];

export const pieces = experiments.map((e, i) => ({
  ...e,
  ...(EXTRA[e.slug] || { engine: 'Canvas', input: 'Watch', rarity: 1, controls: '' }),
  n: i + 1,
  total: experiments.length,
  url: ROOT + e.href,
  thumb: `${ROOT}assets/thumbs/${e.slug}-480.webp`,
  thumb2x: `${ROOT}assets/thumbs/${e.slug}-960.webp`,
}));

export const pad = (n) => String(n).padStart(2, '0');
export const pips = (r) => '◆'.repeat(r) + '◇'.repeat(3 - r);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Front face markup. `sizes` is the rendered card width for srcset selection. */
export function frontHTML(p, { sizes = '240px', eager = false } = {}) {
  return `<div class="card-face card-front">
  <div class="card-top"><span class="card-no">${pad(p.n)}<small>/${pad(p.total)}</small></span><span class="card-tech">${esc(p.engine)}</span></div>
  <div class="card-art"><img src="${p.thumb}" srcset="${p.thumb} 480w, ${p.thumb2x} 960w" sizes="${sizes}" width="480" height="300" alt="" decoding="async" loading="${eager ? 'eager' : 'lazy'}" draggable="false"></div>
  <div class="card-title">${esc(p.title)}</div>
  <div class="card-tags">${p.tags.map(esc).join(' · ')}</div>
  <dl class="card-stats">
    <div><dt>Engine</dt><dd>${esc(p.engine)}</dd></div>
    <div><dt>Input</dt><dd>${esc(p.input)}</dd></div>
    <div><dt>${RARITY[p.rarity]}</dt><dd class="pips" aria-label="Rarity ${p.rarity} of 3">${pips(p.rarity)}</dd></div>
  </dl>
  <div class="card-sheen"></div>
</div>`;
}

export function backHTML(inner = '') {
  return inner
    ? `<div class="card-face card-back is-info">${inner}</div>`
    : '<div class="card-face card-back"><div class="back-mark"><i><span>AL</span></i><b>ART LAB</b></div></div>';
}

/** Build a full card element (shadow, lift, flip layers). */
export function makeCard(p, { tag = 'div', down = false, sizes, eager, back = '' } = {}) {
  const el = document.createElement(tag);
  el.className = 'card' + (down ? ' is-down' : '');
  el.dataset.rarity = p.rarity;
  el.dataset.slug = p.slug;
  el.innerHTML = `<div class="card-lift"><div class="card-inner">${frontHTML(p, { sizes, eager })}${backHTML(back)}</div></div>`;
  return el;
}

/** Warm the image cache so a flip never reveals an empty frame. */
export function preload(list = pieces) {
  return Promise.all(list.map((p) => {
    const img = new Image();
    img.src = p.thumb;
    return img.decode().catch(() => {});
  }));
}

// ---------- Motion ----------
const mq = matchMedia('(prefers-reduced-motion: reduce)');
export const motion = { get reduced() { return mq.matches || document.documentElement.dataset.motion === 'reduced'; } };

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** element.animate that resolves when finished and commits the end state. */
export function anim(el, frames, opts) {
  const a = el.animate(frames, { fill: 'forwards', ...opts });
  return a.finished.then(() => {
    try { a.commitStyles(); } catch { /* element detached */ }
    a.cancel();
  }, () => {});
}

/** Flip a card face up (up=true) or down. Calm crossfade under reduced motion. */
export async function flip(card, up, { duration = 520, lift = true } = {}) {
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
  const mid = (from + to) / 2;
  const z = lift ? 'translateZ(60px)' : '';
  const frames = [
    { transform: `rotateY(${from}deg)` },
    { transform: `${z} rotateY(${mid}deg) scale(${lift ? 1.08 : 1})`, offset: 0.5 },
    { transform: `rotateY(${to}deg)` },
  ];
  await anim(inner, frames, { duration, easing: 'cubic-bezier(.3,.7,.3,1)' });
  card.classList.toggle('is-down', !up);
  inner.style.transform = '';
}

/** Pointer-driven tilt + sheen for a card. Returns a detach function. */
export function tilt(card, { max = 12, target = card, lift = 1.03 } = {}) {
  const layer = card.querySelector('.card-lift');
  let raf = 0, rx = 0, ry = 0, sx = -40, on = false;
  const apply = () => {
    raf = 0;
    layer.style.transform = on ? `rotateX(${rx}deg) rotateY(${ry}deg) scale(${lift})` : '';
    card.style.setProperty('--sheen-x', sx + '%');
  };
  const move = (e) => {
    if (motion.reduced) return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx = (-py * max).toFixed(2);
    ry = (px * max).toFixed(2);
    sx = (-40 + (px + 0.5) * 50).toFixed(1);
    on = true;
    card.classList.add('is-lit');
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const leave = () => {
    on = false;
    card.classList.remove('is-lit');
    if (!raf) raf = requestAnimationFrame(apply);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerleave', leave);
  target.addEventListener('pointercancel', leave);
  return () => {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerleave', leave);
    target.removeEventListener('pointercancel', leave);
    leave();
  };
}

// ---------- Sound (off by default) ----------
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
    const c = this.ctx, t = c.currentTime;
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
  tone(freq, dur = 0.12, gain = 0.06, type = 'triangle', when = 0) {
    if (!this.on || !this.ensure()) return;
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  },
  tick() { this.burst({ dur: 0.035, freq: 3400 + Math.random() * 600, gain: 0.25 }); },
  flip() { this.burst({ dur: 0.09, freq: 1800, sweep: 4200, q: 0.8, gain: 0.2 }); },
  thump() { this.burst({ dur: 0.07, freq: 500, q: 0.7, gain: 0.3, type: 'lowpass' }); },
  tear() { this.burst({ dur: 0.45, freq: 700, sweep: 5200, q: 0.6, gain: 0.3 }); },
  holo() { this.tone(880, 0.14); this.tone(1320, 0.22, 0.05, 'triangle', 0.07); },
};

const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';

/** Wire the shared top-bar buttons. */
export function chrome({ onReplay } = {}) {
  const s = document.getElementById('sound-btn');
  if (s) {
    const paint = () => {
      s.setAttribute('aria-pressed', String(sound.on));
      s.innerHTML = (sound.on ? ICON_ON : ICON_OFF) + '<span class="lbl">Sound</span>';
    };
    paint();
    s.addEventListener('click', () => {
      sound.on = !sound.on;
      if (sound.on) { sound.ensure(); sound.tick(); }
      paint();
    });
  }
  const r = document.getElementById('replay-btn');
  if (r && onReplay) r.addEventListener('click', onReplay);
}
