/**
 * Synthesized sound: no audio files. The context starts on the first user
 * gesture (browsers block it before that) and every call is a no-op when muted.
 */
export function createAudio({ muted = false } = {}) {
  let ctx = null;
  let master = null;
  let noise = null;
  let isMuted = muted;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function tone({ freq, to = freq, type = 'sine', start = 0, dur = 0.12, gain = 0.3, attack = 0.005 }) {
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function hiss({ start = 0, dur = 0.08, gain = 0.2, freq = 900, q = 1.2, type = 'bandpass' }) {
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const play = (fn) => (...args) => {
    if (isMuted || !ensure()) return;
    fn(...args);
  };

  return {
    unlock: () => {
      if (!isMuted) ensure();
    },
    get muted() {
      return isMuted;
    },
    set muted(v) {
      isMuted = v;
      if (!v) ensure();
    },
    step: play(() => {
      tone({ freq: 190, to: 150, type: 'triangle', dur: 0.04, gain: 0.05 });
    }),
    push: play(() => {
      // A low scrape: filtered noise over a short thud.
      hiss({ dur: 0.11, gain: 0.22, freq: 420, q: 0.9 });
      tone({ freq: 95, to: 62, type: 'sine', dur: 0.12, gain: 0.32 });
    }),
    bump: play(() => {
      tone({ freq: 120, to: 90, type: 'square', dur: 0.05, gain: 0.05 });
    }),
    goal: play(() => {
      tone({ freq: 660, type: 'triangle', dur: 0.16, gain: 0.18 });
      tone({ freq: 990, type: 'sine', start: 0.06, dur: 0.24, gain: 0.14 });
      hiss({ dur: 0.05, gain: 0.08, freq: 5200, q: 4, type: 'highpass' });
    }),
    unGoal: play(() => {
      tone({ freq: 520, to: 380, type: 'triangle', dur: 0.12, gain: 0.08 });
    }),
    undo: play(() => {
      tone({ freq: 330, to: 240, type: 'sine', dur: 0.07, gain: 0.08 });
    }),
    stuck: play(() => {
      tone({ freq: 160, to: 110, type: 'sawtooth', dur: 0.18, gain: 0.05 });
    }),
    solved: play(() => {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.075, dur: 0.32, gain: 0.16 }));
      tone({ freq: 261.6, type: 'sine', start: 0, dur: 0.7, gain: 0.18 });
      hiss({ start: 0.3, dur: 0.5, gain: 0.05, freq: 7000, q: 0.6, type: 'highpass' });
    }),
    click: play(() => {
      tone({ freq: 880, type: 'square', dur: 0.025, gain: 0.03 });
    }),
  };
}
