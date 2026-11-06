/**
 * Every sound is synthesized with WebAudio: no files, nothing to download.
 * Levels are kept low and run through a compressor, so a long streak of
 * shards never gets loud. The context starts on the first tap or key press.
 */
const VOLUME = 0.32;

export function createAudio(store) {
  let ctx = null;
  let master = null;
  let muted = store.get('muted', false);

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
      } catch {
        return null;
      }
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 8;
      master = ctx.createGain();
      master.gain.value = muted ? 0 : VOLUME;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function tone({ type = 'sine', f0, f1 = f0, dur = 0.08, vol = 0.12, delay = 0, attack = 0.004 }) {
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
    osc.stop(t + dur + 0.03);
  }

  let noiseBuffer = null;
  function noise({ dur = 0.15, vol = 0.1, freq = 1200, q = 1, delay = 0, sweepTo }) {
    if (muted || !ensure()) return;
    const t = ctx.currentTime + delay;
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  // A major pentatonic ladder, so a chain of shards climbs instead of repeating.
  const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const note = (semi) => 523.25 * 2 ** (semi / 12);

  const sounds = {
    flip(g) {
      // Up and down get a different sweep, so you can hear which way you went.
      if (g < 0) tone({ type: 'triangle', f0: 260, f1: 520, dur: 0.09, vol: 0.07 });
      else tone({ type: 'triangle', f0: 480, f1: 240, dur: 0.09, vol: 0.07 });
      noise({ dur: 0.07, vol: 0.025, freq: 2400, q: 0.8 });
    },
    land() {
      noise({ dur: 0.05, vol: 0.03, freq: 500, q: 1.2 });
    },
    shard(chain = 0) {
      const semi = LADDER[Math.min(chain, LADDER.length - 1)];
      tone({ type: 'sine', f0: note(semi), dur: 0.09, vol: 0.07 });
      tone({ type: 'triangle', f0: note(semi + 12), dur: 0.06, vol: 0.03, delay: 0.02 });
    },
    graze() {
      noise({ dur: 0.12, vol: 0.05, freq: 3000, sweepTo: 7000, q: 3 });
    },
    mult(level) {
      [0, 4, 7, 12].forEach((s, i) => tone({ type: 'square', f0: note(s + level * 2), dur: 0.08, vol: 0.035, delay: i * 0.05 }));
    },
    miss() {
      tone({ type: 'sine', f0: 440, f1: 300, dur: 0.16, vol: 0.06 });
    },
    shield() {
      tone({ type: 'sine', f0: 330, f1: 990, dur: 0.25, vol: 0.08 });
      tone({ type: 'triangle', f0: 660, dur: 0.18, vol: 0.04, delay: 0.12 });
    },
    shieldBreak() {
      noise({ dur: 0.3, vol: 0.12, freq: 1800, sweepTo: 300, q: 0.9 });
      tone({ type: 'triangle', f0: 880, f1: 220, dur: 0.3, vol: 0.07 });
    },
    magnet() {
      tone({ type: 'sawtooth', f0: 110, f1: 220, dur: 0.3, vol: 0.04 });
      tone({ type: 'sine', f0: 660, f1: 880, dur: 0.2, vol: 0.05, delay: 0.05 });
    },
    milestone() {
      [0, 7, 12].forEach((s, i) => tone({ type: 'triangle', f0: note(s - 12), dur: 0.12, vol: 0.05, delay: i * 0.07 }));
    },
    die() {
      noise({ dur: 0.45, vol: 0.16, freq: 900, sweepTo: 90, q: 0.8 });
      tone({ type: 'sawtooth', f0: 220, f1: 40, dur: 0.6, vol: 0.07, delay: 0.02 });
    },
    best() {
      [0, 4, 7, 12, 16].forEach((s, i) => tone({ type: 'triangle', f0: note(s), dur: 0.14, vol: 0.06, delay: 0.25 + i * 0.07 }));
    },
    finish() {
      noise({ dur: 0.35, vol: 0.05, freq: 2000, sweepTo: 6000, q: 1.5 });
      [0, 7, 12, 19].forEach((s, i) => tone({ type: 'triangle', f0: note(s), dur: 0.16, vol: 0.06, delay: i * 0.08 }));
    },
    star(n = 0) {
      tone({ type: 'sine', f0: note(12 + n * 4), dur: 0.12, vol: 0.07 });
      tone({ type: 'triangle', f0: note(24 + n * 4), dur: 0.08, vol: 0.03, delay: 0.03 });
    },
    start() {
      tone({ type: 'triangle', f0: 392, dur: 0.07, vol: 0.06 });
      tone({ type: 'triangle', f0: 784, dur: 0.1, vol: 0.06, delay: 0.08 });
    },
    tick() {
      tone({ type: 'sine', f0: 880, dur: 0.05, vol: 0.05 });
    },
    ui() {
      tone({ type: 'triangle', f0: 1046, dur: 0.035, vol: 0.04 });
    },
  };

  return {
    unlock: ensure,
    play(name, ...args) {
      try {
        sounds[name]?.(...args);
      } catch {
        // Audio is decoration; never let it stop the game.
      }
    },
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      store.set('muted', muted);
      if (master) master.gain.value = muted ? 0 : VOLUME;
    },
  };
}
