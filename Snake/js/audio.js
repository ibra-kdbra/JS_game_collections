/**
 * Every sound is synthesized with WebAudio: no files, nothing to download.
 * The context starts on the first key press or tap (browsers require a gesture).
 */
export function createAudio(store) {
  let ctx = null;
  let master = null;
  let muted = store.get('muted', false);

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ type = 'square', f0, f1 = f0, dur = 0.08, vol = 0.18, delay = 0, attack = 0.003 }) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.15, vol = 0.15, freq = 1200, q = 1, delay = 0, sweepTo }) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t);
  }

  // A minor pentatonic ladder so streaks of food climb pleasantly.
  const LADDER = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];
  const note = (semi) => 440 * 2 ** (semi / 12);

  const sounds = {
    eat(streak = 0) {
      const semi = LADDER[Math.min(streak, LADDER.length - 1)];
      tone({ type: 'square', f0: note(semi + 3), f1: note(semi + 15), dur: 0.07, vol: 0.12 });
      tone({ type: 'triangle', f0: note(semi + 15), dur: 0.09, vol: 0.14, delay: 0.03 });
    },
    golden() {
      [0, 4, 7, 12, 16].forEach((s, i) => tone({ type: 'triangle', f0: note(s + 12), dur: 0.12, vol: 0.13, delay: i * 0.045 }));
      noise({ dur: 0.25, vol: 0.04, freq: 6000, q: 0.7, delay: 0.05 });
    },
    fast() {
      tone({ type: 'sawtooth', f0: 220, f1: 1320, dur: 0.22, vol: 0.08 });
      tone({ type: 'square', f0: 660, dur: 0.05, vol: 0.06, delay: 0.2 });
    },
    slow() {
      tone({ type: 'sine', f0: 880, f1: 180, dur: 0.35, vol: 0.16 });
    },
    boostEnd() {
      tone({ type: 'sine', f0: 520, f1: 440, dur: 0.08, vol: 0.08 });
    },
    portal() {
      noise({ dur: 0.22, vol: 0.12, freq: 400, sweepTo: 3200, q: 4 });
      tone({ type: 'sine', f0: 300, f1: 900, dur: 0.18, vol: 0.08 });
    },
    chop() {
      noise({ dur: 0.18, vol: 0.2, freq: 900, q: 0.8 });
      tone({ type: 'square', f0: 180, f1: 90, dur: 0.15, vol: 0.08 });
    },
    die() {
      noise({ dur: 0.3, vol: 0.25, freq: 600, sweepTo: 120, q: 0.9 });
      tone({ type: 'sawtooth', f0: 330, f1: 55, dur: 0.55, vol: 0.14, delay: 0.02 });
    },
    win() {
      [0, 7, 12, 16, 19, 24].forEach((s, i) => tone({ type: 'square', f0: note(s), dur: 0.14, vol: 0.09, delay: i * 0.07 }));
    },
    turn() {
      tone({ type: 'sine', f0: 1400, dur: 0.018, vol: 0.025 });
    },
    ui() {
      tone({ type: 'triangle', f0: 1046, dur: 0.035, vol: 0.06 });
    },
    start() {
      tone({ type: 'square', f0: 392, dur: 0.06, vol: 0.08 });
      tone({ type: 'square', f0: 784, dur: 0.08, vol: 0.08, delay: 0.07 });
    },
  };

  return {
    unlock: ensure,
    play(name, ...args) {
      sounds[name]?.(...args);
    },
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      store.set('muted', muted);
      if (master) master.gain.value = muted ? 0 : 0.42;
    },
  };
}
