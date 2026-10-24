// Sound effects through the Web Audio API.
// The context starts on the first user gesture (browsers block audio before that).

const soundFiles = {
    boom: ['sounds/boom.wav', 0.3],         // missile explosion
    missile: ['sounds/missile.wav', 0.3],   // missile launch
    pop: ['sounds/pop.wav', 0.4],           // enemy death
    railgun: ['sounds/railgun.wav', 0.3],
    sniper: ['sounds/sniper.wav', 0.2],
    spark: ['sounds/spark.wav', 0.3],       // tesla coil
    taunt: ['sounds/taunt.wav', 0.3]        // taunt enemy death
};

const soundMinGap = 0.06;   // seconds before the same sound may play again

let audioCtx = null;
let masterGain = null;
const soundBuffers = {};
const soundLastPlayed = {};

function startAudio() {
    if (audioCtx) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    Object.entries(soundFiles).forEach(([name, [url]]) => {
        fetch(url)
            .then(r => r.arrayBuffer())
            .then(data => audioCtx.decodeAudioData(data))
            .then(buffer => { soundBuffers[name] = buffer; })
            .catch(() => {});
    });
}

function playSound(name) {
    if (muteSounds || !audioCtx || audioCtx.state !== 'running') return;
    const buffer = soundBuffers[name];
    if (!buffer) return;
    const now = audioCtx.currentTime;
    if (now - (soundLastPlayed[name] || -1) < soundMinGap) return;
    soundLastPlayed[name] = now;
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    gain.gain.value = soundFiles[name][1];
    src.buffer = buffer;
    src.connect(gain).connect(masterGain);
    src.start();
}

// Interface and game event sounds, synthesised so they need no files.
// Each note: [start s, frequency Hz, length s, wave, volume, end frequency].
const sfxNotes = {
    click: [[0, 660, 0.05, 'square', 0.04]],
    build: [[0, 392, 0.07, 'triangle', 0.18], [0.06, 587, 0.1, 'triangle', 0.18]],
    upgrade: [[0, 440, 0.07, 'triangle', 0.16], [0.07, 554, 0.07, 'triangle', 0.16], [0.14, 659, 0.14, 'triangle', 0.18]],
    sell: [[0, 988, 0.06, 'sine', 0.15], [0.06, 740, 0.12, 'sine', 0.15]],
    error: [[0, 150, 0.14, 'sawtooth', 0.07, 110]],
    wave: [[0, 220, 0.18, 'square', 0.06, 330], [0.18, 330, 0.25, 'square', 0.06]],
    cleared: [[0, 523, 0.1, 'triangle', 0.15], [0.09, 659, 0.1, 'triangle', 0.15], [0.18, 784, 0.22, 'triangle', 0.15]],
    leak: [[0, 180, 0.18, 'sine', 0.3, 60]],
    victory: [[0, 523, 0.14, 'square', 0.07], [0.14, 659, 0.14, 'square', 0.07], [0.28, 784, 0.14, 'square', 0.07], [0.42, 1047, 0.45, 'triangle', 0.18]],
    defeat: [[0, 392, 0.22, 'triangle', 0.18], [0.22, 330, 0.22, 'triangle', 0.18], [0.44, 262, 0.22, 'triangle', 0.18], [0.66, 196, 0.6, 'triangle', 0.2, 150]]
};

function sfx(name) {
    if (muteSounds || !audioCtx || audioCtx.state !== 'running') return;
    const notes = sfxNotes[name];
    if (!notes) return;
    const now = audioCtx.currentTime;
    if (now - (soundLastPlayed['sfx-' + name] || -1) < soundMinGap) return;
    soundLastPlayed['sfx-' + name] = now;
    notes.forEach(([at, freq, len, type, vol, endFreq]) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t0 = now + at;
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + len);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        osc.connect(gain).connect(masterGain);
        osc.start(t0);
        osc.stop(t0 + len + 0.02);
    });
}

['pointerdown', 'keydown'].forEach(type => {
    window.addEventListener(type, startAudio, { capture: true });
});
