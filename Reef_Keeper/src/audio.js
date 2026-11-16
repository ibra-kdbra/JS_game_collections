/**
 * Synthesised sound: soft underwater effects and a calm original loop that
 * turns tense while an invader is in the tank. WebAudio only, no files of
 * our own; with the original game loaded, its sound effects play instead.
 */

import { decodeAu } from './original.js';

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

// Calm loop: D major pentatonic plucks over slow chords, 8 bars of 8 eighths.
const CHORDS = [[50, 57, 62, 66], [47, 54, 59, 62], [43, 50, 55, 59], [45, 52, 57, 61]];
const MELODY = [
  74, 0, 76, 78, 0, 81, 78, 0,
  76, 0, 74, 0, 71, 0, 0, 0,
  74, 0, 76, 78, 0, 83, 81, 0,
  78, 0, 76, 74, 0, 0, 0, 0,
  71, 0, 74, 76, 0, 78, 76, 0,
  74, 0, 71, 0, 69, 0, 0, 0,
  71, 0, 74, 76, 78, 0, 81, 0,
  78, 76, 0, 74, 0, 0, 0, 0,
];
const TENSE = [62, 0, 65, 0, 62, 0, 68, 0, 62, 0, 65, 0, 61, 0, 0, 0];

export function createAudio({ muted = false, music = true } = {}) {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let verb = null;
  let state = { muted, music };
  let timer = 0;
  let step = 0;
  let next = 0;
  let mood = 'calm';

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.muted ? 0 : 0.6;
    master.connect(ctx.destination);
    // A short generated reverb: the tank's "room".
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    verb.connect(wet).connect(master);
    musicBus = ctx.createGain();
    musicBus.gain.value = state.music ? 0.22 : 0;
    musicBus.connect(master);
    musicBus.connect(verb);
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone({ type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.2, at = 0, bus = null, attack = 0.005 }) {
    const c = ensure();
    if (!c) return;
    const t = Math.max(at, c.currentTime) + 0.005;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus ?? master);
    if (!bus) g.connect(verb);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const now = () => ensure()?.currentTime ?? 0;
  const sfx = {
    food: () => tone({ f0: 900, f1: 300, dur: 0.09, vol: 0.12 }),
    eat: () => tone({ type: 'triangle', f0: 260, f1: 520, dur: 0.07, vol: 0.12 }),
    grow: () => [0, 1, 2].forEach((i) => tone({ f0: NOTE(74 + i * 5), dur: 0.12, vol: 0.09, at: now() + i * 0.06 })),
    coin: (type) => {
      const base = type === 'silver' ? 88 : type === 'gold' ? 91 : type === 'chest' ? 84 : 95;
      tone({ type: 'triangle', f0: NOTE(base), dur: 0.12, vol: 0.12 });
      tone({ type: 'triangle', f0: NOTE(base + 7), dur: 0.18, vol: 0.1, at: now() + 0.05 });
    },
    buy: () => tone({ type: 'square', f0: NOTE(79), f1: NOTE(86), dur: 0.1, vol: 0.06 }),
    splash: () => tone({ type: 'sine', f0: 700, f1: 160, dur: 0.22, vol: 0.14 }),
    nope: () => tone({ type: 'square', f0: 180, dur: 0.12, vol: 0.05 }),
    starve: () => tone({ type: 'triangle', f0: 400, f1: 120, dur: 0.5, vol: 0.12 }),
    gulp: () => tone({ type: 'sine', f0: 200, f1: 60, dur: 0.18, vol: 0.2 }),
    warning: () => [0, 0.35, 0.7].forEach((d) => tone({ type: 'sawtooth', f0: 440, f1: 330, dur: 0.28, vol: 0.06, at: now() + d })),
    invader: () => tone({ type: 'sawtooth', f0: 90, f1: 60, dur: 0.6, vol: 0.12 }),
    hit: () => tone({ type: 'square', f0: 1400, f1: 500, dur: 0.06, vol: 0.06 }),
    defeat: () => [72, 76, 79, 84].forEach((n, i) => tone({ type: 'triangle', f0: NOTE(n), dur: 0.16, vol: 0.12, at: now() + i * 0.08 })),
    clear: () => [74, 78, 81, 86, 81, 86, 90].forEach((n, i) => tone({ type: 'triangle', f0: NOTE(n), dur: i === 6 ? 0.7 : 0.15, vol: 0.13, at: now() + i * 0.12 })),
    boom: () => tone({ type: 'sine', f0: 200, f1: 60, dur: 0.18, vol: 0.2 }),
    heal: () => tone({ type: 'square', f0: 180, dur: 0.12, vol: 0.05 }),
    lost: () => [74, 71, 67, 62].forEach((n, i) => tone({ type: 'triangle', f0: NOTE(n), dur: 0.3, vol: 0.12, at: now() + i * 0.22 })),
  };

  function schedule() {
    const c = ctx;
    const dur = 60 / 92 / 2; // eighth notes at 92 bpm
    while (next < c.currentTime + 0.3) {
      if (mood === 'calm') {
        const bar = Math.floor(step / 8) % 8;
        const chord = CHORDS[bar % 4];
        if (step % 8 === 0) for (const n of chord) tone({ f0: NOTE(n), dur: dur * 7.5, vol: 0.05, at: next, bus: musicBus, attack: 0.4 });
        const n = MELODY[step % MELODY.length];
        if (n) tone({ type: 'triangle', f0: NOTE(n), dur: dur * 1.8, vol: 0.12, at: next, bus: musicBus });
        if (step % 4 === 2) tone({ f0: NOTE(chord[0] - 12), dur: dur * 2, vol: 0.12, at: next, bus: musicBus });
      } else {
        const n = TENSE[step % TENSE.length];
        if (n) tone({ type: 'triangle', f0: NOTE(n), dur: dur * 0.9, vol: 0.12, at: next, bus: musicBus });
        if (step % 2 === 0) tone({ type: 'sine', f0: NOTE(38), dur: dur, vol: 0.2, at: next, bus: musicBus });
      }
      next += dur;
      step++;
    }
  }

  function startMusic() {
    const c = ensure();
    if (!c || timer) return;
    next = c.currentTime + 0.1;
    step = 0;
    timer = setInterval(schedule, 80);
  }

  function stopMusic() {
    clearInterval(timer);
    timer = 0;
  }

  function setMood(m) {
    if (m === mood) return;
    mood = m;
    step = 0;
  }

  function set(nextState) {
    state = { ...state, ...nextState };
    if (!ctx) return;
    master.gain.setTargetAtTime(state.muted ? 0 : 0.6, ctx.currentTime, 0.03);
    musicBus.gain.setTargetAtTime(state.music ? 0.22 : 0, ctx.currentTime, 0.1);
  }

  function suspend(on) {
    if (!ctx) return;
    if (on) ctx.suspend();
    else ctx.resume();
  }

  // Sound effects from the original game: name -> AudioBuffers.
  let samples = null;

  /** Use the original game's sounds: `table` maps our names to its files, `get` reads one. */
  async function useSamples(table, get) {
    if (!table) {
      samples = null;
      return;
    }
    const c = ensure();
    if (!c) return;
    const out = {};
    for (const [name, files] of Object.entries(table)) {
      const list = [];
      for (const file of files) {
        const s = get(file);
        if (!s) continue;
        try {
          const buf = await s.blob.arrayBuffer();
          if (s.au) {
            const d = decodeAu(buf);
            if (!d) continue;
            const b = c.createBuffer(1, d.data.length, d.rate);
            b.copyToChannel(d.data, 0);
            list.push(b);
          } else list.push(await c.decodeAudioData(buf));
        } catch {
          // A sound the browser can't decode keeps our own.
        }
      }
      if (list.length) out[name] = list;
    }
    samples = out;
  }

  function play(name, arg) {
    const list = samples?.[name === 'coin' ? `coin:${arg}` : name];
    if (!list) return sfx[name]?.(arg);
    const c = ensure();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    const g = c.createGain();
    g.gain.value = 0.8;
    src.connect(g).connect(master);
    src.start();
  }

  return { unlock, play, useSamples, startMusic, stopMusic, setMood, set, suspend, get state() { return state; } };
}
