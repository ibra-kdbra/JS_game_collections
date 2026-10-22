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

['pointerdown', 'keydown'].forEach(type => {
    window.addEventListener(type, startAudio, { capture: true });
});
