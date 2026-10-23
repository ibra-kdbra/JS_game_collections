// Synthesised sound effects (WebAudio). No audio files.
let ctx = null;
let master = null;
let muted = false;
let noiseBuf = null;

function ac() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.5;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

export function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.5;
}
export const isMuted = () => muted;

/** Call from a user gesture so mobile browsers allow sound. */
export function unlock() {
    ac();
}

function tone({ type = 'sine', from, to = from, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005 }) {
    const c = ac();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, type = 'lowpass', from = 2000, to = 400, q = 1, delay = 0 }) {
    const c = ac();
    if (!c || muted) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
}

export const sfx = {
    slide(tiles = 2) {
        noise({ dur: 0.08 + tiles * 0.06, vol: 0.12, type: 'bandpass', from: 600, to: 1800, q: 0.8 });
    },
    stop() {
        tone({ type: 'sine', from: 140, to: 60, dur: 0.14, vol: 0.35 });
        noise({ dur: 0.08, vol: 0.12, from: 900, to: 200 });
    },
    defeat() {
        tone({ type: 'square', from: 520, to: 160, dur: 0.16, vol: 0.12 });
        noise({ dur: 0.18, vol: 0.25, type: 'highpass', from: 3000, to: 800 });
        tone({ type: 'triangle', from: 880, to: 1320, dur: 0.12, vol: 0.12, delay: 0.08 });
    },
    splash() {
        noise({ dur: 0.6, vol: 0.4, from: 3000, to: 150, q: 0.5 });
        tone({ type: 'sine', from: 300, to: 80, dur: 0.35, vol: 0.2 });
    },
    magic() {
        [660, 880, 1100, 1320, 1760].forEach((f, i) => tone({ type: 'sine', from: f, to: f * 1.01, dur: 0.18, vol: 0.12, delay: i * 0.045 }));
    },
    blocked() {
        tone({ type: 'square', from: 120, to: 100, dur: 0.08, vol: 0.08 });
    },
    undo() {
        tone({ type: 'triangle', from: 600, to: 300, dur: 0.1, vol: 0.12 });
    },
    hint() {
        tone({ type: 'sine', from: 988, dur: 0.12, vol: 0.15 });
        tone({ type: 'sine', from: 1319, dur: 0.2, vol: 0.12, delay: 0.09 });
    },
    think() {
        tone({ type: 'sine', from: 400 + Math.random() * 600, dur: 0.05, vol: 0.04 });
    },
    click() {
        tone({ type: 'triangle', from: 1200, to: 900, dur: 0.05, vol: 0.08 });
    },
    win() {
        [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.25, vol: 0.2, delay: i * 0.11 }));
        tone({ type: 'sine', from: 1568, dur: 0.6, vol: 0.12, delay: 0.46 });
    },
    lose() {
        [392, 330, 262].forEach((f, i) => tone({ type: 'triangle', from: f, to: f * 0.97, dur: 0.24, vol: 0.16, delay: i * 0.14 }));
    },
};
