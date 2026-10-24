/**
 * Synthesized sound effects. Everything is built from oscillators and a noise
 * buffer at play time; there are no audio files.
 */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let noise = null;
  let isMuted = muted;
  const last = new Map(); // throttle per sound

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = isMuted ? 0 : 0.55;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return true;
  }

  function throttle(name, ms) {
    const now = performance.now();
    if (now - (last.get(name) ?? 0) < ms) return false;
    last.set(name, now);
    return true;
  }

  function tone({ type = 'square', freq = 440, to = null, dur = 0.08, vol = 0.2, delay = 0, attack = 0.003 }) {
    if (!ctx || isMuted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function burst({ dur = 0.3, vol = 0.4, freq = 1200, to = 120, q = 0.8, delay = 0 }) {
    if (!ctx || isMuted) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const note = (semi, base = 523.25) => base * 2 ** (semi / 12);

  const sounds = {
    paddle(t = 0) {
      tone({ type: 'square', freq: 330 + Math.abs(t) * 90, to: 240, dur: 0.07, vol: 0.16 });
    },
    wall() {
      if (throttle('wall', 40)) tone({ type: 'triangle', freq: 760, dur: 0.035, vol: 0.09 });
    },
    brick(combo = 0) {
      if (!throttle('brick', 18)) return;
      const n = note(PENTA[Math.min(PENTA.length - 1, combo)], 440);
      tone({ type: 'square', freq: n, dur: 0.06, vol: 0.13 });
      tone({ type: 'triangle', freq: n * 2, dur: 0.09, vol: 0.07, delay: 0.01 });
    },
    hit() {
      if (throttle('hit', 25)) tone({ type: 'square', freq: 210, to: 180, dur: 0.06, vol: 0.13 });
    },
    steel() {
      if (!throttle('steel', 35)) return;
      tone({ type: 'triangle', freq: 1240, dur: 0.11, vol: 0.09 });
      tone({ type: 'sine', freq: 1870, dur: 0.16, vol: 0.05 });
    },
    explode() {
      if (!throttle('explode', 45)) return;
      burst({ dur: 0.45, vol: 0.5, freq: 1800, to: 80 });
      tone({ type: 'sine', freq: 120, to: 38, dur: 0.35, vol: 0.4 });
    },
    laser() {
      if (throttle('laser', 60)) tone({ type: 'sawtooth', freq: 1400, to: 380, dur: 0.07, vol: 0.06 });
    },
    powerup(type) {
      const base = type === 'life' ? 659.25 : 523.25;
      [0, 4, 7, 12].forEach((s, i) => tone({ type: 'square', freq: note(s, base), dur: 0.09, vol: 0.1, delay: i * 0.055 }));
    },
    catch() {
      tone({ type: 'sine', freq: 520, to: 700, dur: 0.08, vol: 0.14 });
    },
    launch() {
      tone({ type: 'triangle', freq: 300, to: 900, dur: 0.12, vol: 0.13 });
    },
    lifeLost() {
      [0, -3, -7, -12].forEach((s, i) => tone({ type: 'square', freq: note(s, 392), dur: 0.14, vol: 0.12, delay: i * 0.11 }));
      burst({ dur: 0.3, vol: 0.15, freq: 600, to: 100 });
    },
    clear() {
      [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'square', freq: note(s), dur: 0.14, vol: 0.1, delay: i * 0.07 }));
    },
    gameOver() {
      [7, 3, 0, -5].forEach((s, i) => tone({ type: 'triangle', freq: note(s, 330), dur: 0.28, vol: 0.16, delay: i * 0.2 }));
    },
    supply() {
      tone({ type: 'sine', freq: 880, dur: 0.1, vol: 0.1 });
      tone({ type: 'sine', freq: 1320, dur: 0.12, vol: 0.08, delay: 0.1 });
    },
    ui() {
      tone({ type: 'triangle', freq: 660, dur: 0.04, vol: 0.08 });
    },
  };

  return {
    unlock: ensure,
    play(name, ...args) {
      if (isMuted || !ensure()) return;
      sounds[name]?.(...args);
    },
    get muted() {
      return isMuted;
    },
    setMuted(value) {
      isMuted = value;
      if (master) master.gain.value = isMuted ? 0 : 0.55;
    },
  };
}
