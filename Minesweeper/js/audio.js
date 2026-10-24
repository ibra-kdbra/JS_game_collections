/**
 * Synthesized sound: no files, just a few oscillators and a noise buffer.
 * The context is created on the first user gesture (autoplay rules).
 */

let ctx = null;
let master = null;
let noise = null;
let muted = false;

function ensure() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ f = 440, f2, type = 'sine', at = 0, dur = 0.08, vol = 0.3, attack = 0.002 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst({ at = 0, dur = 0.3, vol = 0.5, from = 4000, to = 120, q = 0.8 }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
const note = (base, step) => base * 2 ** (PENTA[step % PENTA.length] / 12 + Math.floor(step / PENTA.length));

export const sfx = {
  setMuted(v) {
    muted = !!v;
    if (ctx) muted ? ctx.suspend() : ctx.resume();
  },
  get muted() {
    return muted;
  },
  unlock() {
    ensure();
  },
  reveal() {
    if (!ensure()) return;
    tone({ f: 1500, f2: 900, type: 'triangle', dur: 0.045, vol: 0.22 });
  },
  cascade(size) {
    if (!ensure()) return;
    burst({ dur: 0.18, vol: 0.12, from: 6000, to: 1500, q: 2 });
    const notes = Math.min(6, 2 + Math.floor(Math.log2(size)));
    for (let k = 0; k < notes; k++) tone({ f: note(660, k), type: 'sine', at: k * 0.035, dur: 0.16, vol: 0.12 });
  },
  flag() {
    if (!ensure()) return;
    tone({ f: 520, type: 'square', dur: 0.04, vol: 0.08 });
    tone({ f: 1040, type: 'triangle', at: 0.035, dur: 0.07, vol: 0.18 });
  },
  unflag() {
    if (!ensure()) return;
    tone({ f: 800, f2: 400, type: 'triangle', dur: 0.06, vol: 0.14 });
  },
  refuse() {
    if (!ensure()) return;
    tone({ f: 180, type: 'square', dur: 0.07, vol: 0.06 });
  },
  hint() {
    if (!ensure()) return;
    tone({ f: 1318, type: 'sine', dur: 0.4, vol: 0.18 });
    tone({ f: 1976, type: 'sine', at: 0.06, dur: 0.5, vol: 0.1 });
  },
  boom() {
    if (!ensure()) return;
    burst({ dur: 0.9, vol: 0.9, from: 3000, to: 60, q: 0.5 });
    tone({ f: 110, f2: 32, type: 'sine', dur: 0.7, vol: 0.8 });
  },
  win() {
    if (!ensure()) return;
    [0, 2, 4, 5, 7].forEach((s, k) => tone({ f: note(523, s), type: 'triangle', at: k * 0.075, dur: 0.35, vol: 0.2 }));
    tone({ f: note(523, 9), type: 'sine', at: 0.4, dur: 0.9, vol: 0.18 });
  },
  undo() {
    if (!ensure()) return;
    tone({ f: 300, f2: 900, type: 'sine', dur: 0.2, vol: 0.18 });
  },
};
