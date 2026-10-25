/**
 * Synthesised sound: chip-style effects and a short original loop, all made
 * with WebAudio oscillators. No audio files.
 */

const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);

// An original two-part loop in A minor, 16 steps a bar, 8 bars. Numbers are MIDI notes.
const LEAD = [
  69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0,
  69, 0, 72, 0, 76, 0, 79, 77, 76, 0, 74, 0, 72, 0, 0, 0,
  65, 0, 69, 0, 72, 0, 71, 69, 67, 0, 69, 0, 71, 0, 0, 0,
  64, 0, 67, 0, 71, 0, 72, 74, 76, 0, 0, 0, 0, 0, 0, 0,
  69, 0, 72, 0, 76, 0, 74, 72, 71, 0, 72, 0, 74, 0, 0, 0,
  77, 0, 76, 0, 74, 0, 72, 71, 72, 0, 74, 0, 76, 0, 0, 0,
  74, 0, 72, 0, 71, 0, 69, 68, 69, 0, 71, 0, 72, 0, 0, 0,
  71, 0, 68, 0, 64, 0, 68, 71, 69, 0, 0, 0, 0, 0, 0, 0,
];
const BASS = [45, 45, 41, 40, 45, 41, 38, 40]; // one root a bar
const HAMMER = [81, 0, 84, 0, 88, 0, 84, 0, 81, 0, 84, 0, 86, 0, 84, 0];

export function createAudio({ muted = false, music = true } = {}) {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let state = { muted, music };
  let seqTimer = 0;
  let step = 0;
  let nextTime = 0;
  let mode = 'off'; // off | play | hammer
  const TEMPO = 132;
  const stepDur = 60 / TEMPO / 4;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = state.muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = state.music ? 0.32 : 0;
    musicBus.connect(master);
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  function tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol = 0.2, at = 0, bus = master, attack = 0.004 }) {
    const c = ensure();
    if (!c || (state.muted && bus === master)) return;
    const t = (at || c.currentTime) + 0.005;
    const o = c.createOscillator();
    const gn = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + attack);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.15, vol = 0.2, f = 1200, q = 0.8, at = 0 }) {
    const c = ensure();
    if (!c || state.muted) return;
    const t = (at || c.currentTime) + 0.005;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = f;
    filt.Q.value = q;
    const gn = c.createGain();
    gn.gain.value = vol;
    src.connect(filt).connect(gn).connect(master);
    src.start(t);
  }

  const sfx = {
    jump: () => tone({ f0: 330, f1: 660, dur: 0.12, vol: 0.12 }),
    land: () => tone({ type: 'triangle', f0: 140, f1: 70, dur: 0.06, vol: 0.12 }),
    step: () => tone({ type: 'triangle', f0: 90, dur: 0.025, vol: 0.05 }),
    points: () => {
      tone({ f0: 988, dur: 0.06, vol: 0.09 });
      tone({ f0: 1319, dur: 0.08, vol: 0.09, at: (ctx?.currentTime ?? 0) + 0.06 });
    },
    smash: () => {
      noise({ dur: 0.18, vol: 0.35, f: 900 });
      tone({ type: 'sawtooth', f0: 220, f1: 60, dur: 0.18, vol: 0.12 });
    },
    hammer: () => [0, 1, 2].forEach((i) => tone({ f0: NOTE(76 + i * 4), dur: 0.07, vol: 0.1, at: (ctx?.currentTime ?? 0) + i * 0.06 })),
    throw: () => noise({ dur: 0.25, vol: 0.18, f: 260, q: 2 }),
    bounce: () => tone({ type: 'triangle', f0: 120, f1: 80, dur: 0.07, vol: 0.12 }),
    spring: () => tone({ type: 'sine', f0: 300, f1: 900, dur: 0.18, vol: 0.12 }),
    ignite: () => noise({ dur: 0.4, vol: 0.2, f: 500, q: 0.5 }),
    rivet: () => {
      tone({ f0: 1568, dur: 0.05, vol: 0.12 });
      noise({ dur: 0.08, vol: 0.15, f: 3000, q: 3 });
    },
    vent: () => noise({ dur: 0.2, vol: 0.08, f: 1800, q: 1 }),
    die: () => {
      stopMusic();
      const t0 = ensure()?.currentTime ?? 0;
      [72, 71, 70, 69, 68, 67, 66, 60].forEach((n, i) => tone({ f0: NOTE(n), dur: 0.14, vol: 0.13, at: t0 + i * 0.12 }));
    },
    clear: () => {
      stopMusic();
      const t0 = ensure()?.currentTime ?? 0;
      [69, 72, 76, 81, 76, 81, 84].forEach((n, i) => tone({ f0: NOTE(n), dur: i === 6 ? 0.5 : 0.12, vol: 0.13, at: t0 + i * 0.11 }));
      [57, 64, 69].forEach((n, i) => tone({ type: 'triangle', f0: NOTE(n), dur: 0.3, vol: 0.14, at: t0 + 0.33 * i }));
    },
    start: () => {
      const t0 = ensure()?.currentTime ?? 0;
      [64, 69, 72, 76].forEach((n, i) => tone({ f0: NOTE(n), dur: 0.1, vol: 0.1, at: t0 + i * 0.09 }));
    },
  };

  /* ---------- Music ---------- */

  function schedule() {
    const c = ctx;
    if (!c) return;
    while (nextTime < c.currentTime + 0.25) {
      const s = step % LEAD.length;
      if (mode === 'hammer') {
        const n = HAMMER[step % HAMMER.length];
        if (n) tone({ f0: NOTE(n), dur: stepDur * 0.9, vol: 0.18, at: nextTime, bus: musicBus });
        if (step % 4 === 0) tone({ type: 'triangle', f0: NOTE(45), dur: stepDur * 2, vol: 0.3, at: nextTime, bus: musicBus });
      } else {
        const n = LEAD[s];
        if (n) tone({ type: 'square', f0: NOTE(n), dur: stepDur * 1.6, vol: 0.12, at: nextTime, bus: musicBus });
        if (s % 4 === 0) {
          const root = BASS[Math.floor(s / 16)];
          tone({ type: 'triangle', f0: NOTE(root + (s % 8 === 4 ? 7 : 0)), dur: stepDur * 3, vol: 0.32, at: nextTime, bus: musicBus });
        }
        if (s % 8 === 4) tone({ type: 'square', f0: 2200, f1: 1800, dur: 0.02, vol: 0.05, at: nextTime, bus: musicBus });
      }
      nextTime += stepDur;
      step++;
    }
  }

  function startMusic(kind = 'play') {
    const c = ensure();
    if (!c) return;
    if (mode === kind && seqTimer) return;
    mode = kind;
    step = 0;
    nextTime = c.currentTime + 0.05;
    clearInterval(seqTimer);
    seqTimer = setInterval(schedule, 60);
    schedule();
  }

  function stopMusic() {
    clearInterval(seqTimer);
    seqTimer = 0;
    mode = 'off';
  }

  function set(next) {
    state = { ...state, ...next };
    if (!ctx) return;
    master.gain.setTargetAtTime(state.muted ? 0 : 0.5, ctx.currentTime, 0.02);
    musicBus.gain.setTargetAtTime(state.music ? 0.32 : 0, ctx.currentTime, 0.05);
  }

  function suspend(on) {
    if (!ctx) return;
    if (on) ctx.suspend();
    else ctx.resume();
  }

  return { unlock, play: (name) => sfx[name]?.(), startMusic, stopMusic, set, suspend, get state() { return state; } };
}
