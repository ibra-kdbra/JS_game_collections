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

function playSound(name) {
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
    src.connect(gain).connect(masterGain);
    src.onended = () => { soundVoices[name]--; };
    src.start(now);
    src.stop(now + len + 0.02);
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
    if (now - (soundLastPlayed['sfx-' + name] || -1) < 0.06) return;
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
