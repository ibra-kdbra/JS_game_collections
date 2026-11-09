// Sound effects through the Web Audio API.
// The context starts on the first user gesture (browsers block audio before that).

// [file, gain, longest play in seconds, most copies at once, shortest gap in seconds].
// Gains are set from each file's measured loudness so that tower shots, which fire all
// the time, sit well under explosions and kills. The sniper and railgun files are about
// 7 dB louder than the explosion and ring for seconds, so they are cut short with a fade.
const soundFiles = {
    boom: ['sounds/boom.wav', 0.16, 1.2, 3, 0.08],        // missile explosion
    missile: ['sounds/missile.wav', 0.06, 0.9, 2, 0.12],  // missile launch
    pop: ['sounds/pop.wav', 0.22, 0.3, 4, 0.05],          // enemy death
    railgun: ['sounds/railgun.wav', 0.07, 0.7, 2, 0.15],
    sniper: ['sounds/sniper.wav', 0.05, 0.6, 2, 0.15],
    spark: ['sounds/spark.wav', 0.12, 0.45, 2, 0.1],      // tesla coil
    taunt: ['sounds/taunt.wav', 0.14, 1.2, 2, 0.1]        // taunt enemy death
};

let soundVolume = 0.7;      // master volume, 0-1, from the Settings slider

let audioCtx = null;
let masterGain = null;
const soundBuffers = {};
const soundLastPlayed = {};
const soundVoices = {};     // copies of each sound playing now

/** Set the master volume (0-1); applies at once if audio has started. */
function setSoundVolume(v) {
    soundVolume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.setTargetAtTime(soundVolume, audioCtx.currentTime, 0.02);
}

function startAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    // A limiter after the master volume, so a crowd of shots never gets harsh.
    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -18;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    limiter.connect(audioCtx.destination);
    masterGain = audioCtx.createGain();
    masterGain.gain.value = soundVolume;
    masterGain.connect(limiter);
    Object.entries(soundFiles).forEach(([name, [url]]) => {
        fetch(url)
            .then(r => r.arrayBuffer())
            .then(data => audioCtx.decodeAudioData(data))
            .then(buffer => { soundBuffers[name] = buffer; })
            .catch(() => {});
    });
}

// Left-right position of a sound from where it happens on the map (x in game
// pixels): the left edge of the map plays a little left, the right edge right
function panFor(x) {
    if (typeof x !== 'number' || typeof cols === 'undefined' || !cols) return 0;
    return Math.max(-1, Math.min(1, (x / (cols * ts)) * 2 - 1)) * 0.65;
}

// A stereo panner in front of the master volume, or the master itself
function outFor(x) {
    const pan = panFor(x);
    if (!pan || !audioCtx.createStereoPanner) return masterGain;
    const p = audioCtx.createStereoPanner();
    p.pan.value = pan;
    p.connect(masterGain);
    return p;
}

// x: where on the map it happens, for the stereo position
function playSound(name, x) {
    if (muteSounds || !audioCtx || audioCtx.state !== 'running') return;
    const buffer = soundBuffers[name];
    if (!buffer) return;
    const [, vol, maxLen, maxVoices, minGap] = soundFiles[name];
    const now = audioCtx.currentTime;
    if (now - (soundLastPlayed[name] || -1) < minGap) return;
    if ((soundVoices[name] || 0) >= maxVoices) return;
    soundLastPlayed[name] = now;
    soundVoices[name] = (soundVoices[name] || 0) + 1;
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    const len = Math.min(buffer.duration, maxLen);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.setValueAtTime(vol, now + len * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + len);
    src.buffer = buffer;
    // A little different every time, so a volley does not sound like one sample
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    src.connect(gain).connect(outFor(x));
    src.onended = () => { soundVoices[name]--; };
    src.start(now);
    src.stop(now + len + 0.02);
}

// Interface and game event sounds, synthesised so they need no files.
// Each note: [start s, frequency Hz, length s, wave, volume, end frequency, options].
// Options: d (detune in cents: a second voice for a fuller sound), lp (low-pass
// cutoff Hz), a (attack s), echo (send to the soft echo, 0-1).
const sfxNotes = {
    click: [[0, 880, 0.045, 'triangle', 0.05, 0, { lp: 3000 }]],
    build: [[0, 392, 0.08, 'triangle', 0.16, 0, { d: 6 }], [0.06, 587, 0.12, 'triangle', 0.16, 0, { d: 6 }], [0, 98, 0.12, 'sine', 0.22, 60]],
    upgrade: [[0, 440, 0.08, 'triangle', 0.14, 0, { d: 5 }], [0.07, 554, 0.08, 'triangle', 0.14, 0, { d: 5 }],
        [0.14, 659, 0.22, 'triangle', 0.16, 0, { d: 5, echo: 0.3 }], [0.14, 1319, 0.3, 'sine', 0.05, 0, { echo: 0.4 }]],
    sell: [[0, 988, 0.07, 'sine', 0.13, 0, { echo: 0.2 }], [0.06, 740, 0.14, 'sine', 0.13, 0, { echo: 0.2 }]],
    error: [[0, 196, 0.12, 'square', 0.05, 160, { lp: 900 }], [0.1, 165, 0.16, 'square', 0.05, 130, { lp: 900 }]],
    // A new wave: a low drum and a two-note horn call
    wave: [[0, 130, 0.35, 'sine', 0.32, 45], [0.02, 196, 0.26, 'sawtooth', 0.05, 0, { d: 8, lp: 1100, a: 0.04 }],
        [0.24, 294, 0.5, 'sawtooth', 0.055, 0, { d: 8, lp: 1300, a: 0.05, echo: 0.35 }]],
    // A cleared wave: a bright chime that rings out
    cleared: [[0, 784, 0.5, 'sine', 0.11, 0, { echo: 0.45 }], [0.09, 988, 0.5, 'sine', 0.1, 0, { echo: 0.45 }],
        [0.18, 1175, 0.7, 'sine', 0.1, 0, { echo: 0.5 }], [0.18, 2350, 0.4, 'sine', 0.025, 0, { echo: 0.5 }]],
    leak: [[0, 180, 0.2, 'sine', 0.28, 60], [0, 90, 0.25, 'triangle', 0.12, 50, { lp: 600 }]],
    victory: [[0, 523, 0.16, 'triangle', 0.13, 0, { d: 6 }], [0.15, 659, 0.16, 'triangle', 0.13, 0, { d: 6 }],
        [0.3, 784, 0.16, 'triangle', 0.13, 0, { d: 6 }], [0.45, 1047, 0.9, 'triangle', 0.16, 0, { d: 6, echo: 0.5 }],
        [0.45, 523, 0.9, 'sine', 0.1, 0, { echo: 0.4 }]],
    defeat: [[0, 392, 0.26, 'triangle', 0.15, 0, { lp: 1400 }], [0.24, 330, 0.26, 'triangle', 0.15, 0, { lp: 1400 }],
        [0.48, 262, 0.26, 'triangle', 0.15, 0, { lp: 1400 }], [0.72, 196, 0.9, 'triangle', 0.17, 150, { lp: 1000, echo: 0.4 }]]
};

// ---------- Tower shots without a sound file, synthesised ----------
// Gun: a short filtered crack. Laser: a soft rising hum while it burns. Mortar: a
// deep thump. Slow and Poison: a quiet low chime with each pulse. Quiet next to the
// file sounds, with gaps and voice caps so a battle never piles up.

let noiseBuf = null;
function whiteNoise() {
    if (noiseBuf) return noiseBuf;
    const n = Math.floor(audioCtx.sampleRate * 0.4);
    noiseBuf = audioCtx.createBuffer(1, n, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
}

const SHOTS = {
    gun: { gap: 0.07, vol: 0.05 },
    machineGun: { gap: 0.06, vol: 0.04 },
    laser: { gap: 0.32, vol: 0.025 },
    beamEmitter: { gap: 0.32, vol: 0.03 },
    bomb: { gap: 0.18, vol: 0.2 },
    clusterBomb: { gap: 0.18, vol: 0.2 },
    slow: { gap: 1.0, vol: 0.05 },
    poison: { gap: 1.0, vol: 0.05 }
};

function shotSound(t) {
    if (muteSounds || !audioCtx || audioCtx.state !== 'running' || !t || t.sound) return;
    const k = SHOTS[t.name];
    if (!k) return;
    const now = audioCtx.currentTime;
    const key = 'shot-' + t.name;
    if (now - (soundLastPlayed[key] || -1) < k.gap) return;
    soundLastPlayed[key] = now;
    const out = outFor(t.pos && t.pos.x);
    const env = (node, vol, len, attack = 0.003) => {
        const g = audioCtx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(vol, now + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, now + len);
        node.connect(g).connect(out);
        return g;
    };
    const tone = (type, f0, f1, len, vol, attack) => {
        const o = audioCtx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, now);
        if (f1) o.frequency.exponentialRampToValueAtTime(f1, now + len);
        env(o, vol, len, attack);
        o.start(now);
        o.stop(now + len + 0.02);
    };
    const hiss = (freq, q, len, vol) => {
        const src = audioCtx.createBufferSource();
        src.buffer = whiteNoise();
        src.playbackRate.value = 0.9 + Math.random() * 0.2;
        const f = audioCtx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = q;
        src.connect(f);
        env(f, vol, len);
        src.start(now, Math.random() * 0.2);
        src.stop(now + len + 0.02);
    };
    const v = k.vol;
    switch (t.name) {
        case 'gun':
        case 'machineGun':
            hiss(2400 + Math.random() * 600, 0.9, 0.06, v * 1.6);
            tone('square', 190, 90, 0.05, v * 0.5);
            break;
        case 'laser':
        case 'beamEmitter':
            tone('sawtooth', t.name === 'laser' ? 520 : 440, t.name === 'laser' ? 760 : 620, 0.28, v, 0.05);
            tone('sine', 1040, 1180, 0.28, v * 0.6, 0.05);
            break;
        case 'bomb':
        case 'clusterBomb':
            tone('sine', 150, 42, 0.32, v);
            hiss(500, 0.7, 0.18, v * 0.5);
            break;
        case 'slow':
        case 'poison':
            tone('sine', t.name === 'slow' ? 523 : 392, 0, 0.6, v, 0.01);
            tone('sine', t.name === 'slow' ? 784 : 587, 0, 0.45, v * 0.5, 0.01);
            break;
    }
}

// A soft echo for chimes and calls (made with the first sound that needs it)
let echoIn = null;
function echoBus() {
    if (echoIn) return echoIn;
    echoIn = audioCtx.createGain();
    const delay = audioCtx.createDelay(1);
    delay.delayTime.value = 0.19;
    const feedback = audioCtx.createGain();
    feedback.gain.value = 0.32;
    const tone = audioCtx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    const out = audioCtx.createGain();
    out.gain.value = 0.5;
    echoIn.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(out).connect(masterGain);
    return echoIn;
}

// The new-wave call waits for the cleared chime when waves run back to back
let sfxBusyUntil = 0;

function sfx(name) {
    if (muteSounds || !audioCtx || audioCtx.state !== 'running') return;
    const notes = sfxNotes[name];
    if (!notes) return;
    let now = audioCtx.currentTime;
    if (now - (soundLastPlayed['sfx-' + name] || -1) < 0.06) return;
    soundLastPlayed['sfx-' + name] = now;
    if (name === 'wave' && sfxBusyUntil > now) now = sfxBusyUntil;
    if (name === 'cleared') sfxBusyUntil = now + 0.55;
    notes.forEach(([at, freq, len, type, vol, endFreq, o = {}]) => {
        const t0 = now + at;
        const attack = o.a || 0.008;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        let node = gain;
        if (o.lp) {
            const f = audioCtx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = o.lp;
            f.Q.value = 0.7;
            gain.connect(f);
            node = f;
        }
        node.connect(masterGain);
        if (o.echo) {
            const send = audioCtx.createGain();
            send.gain.value = o.echo;
            node.connect(send).connect(echoBus());
        }
        const voices = o.d ? [-o.d, o.d] : [0];
        voices.forEach(cents => {
            const osc = audioCtx.createOscillator();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, t0);
            if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + len);
            osc.detune.value = cents;
            const v = audioCtx.createGain();
            v.gain.value = 1 / voices.length;
            osc.connect(v).connect(gain);
            osc.start(t0);
            osc.stop(t0 + len + 0.03);
        });
    });
}

['pointerdown', 'keydown'].forEach(type => {
    window.addEventListener(type, startAudio, { capture: true });
});
