// Unified Audio System
let audioCtx;
let musicGain;
let fxGain;
let isFxMuted = false;
let isMusicMuted = false;
let oscillators = [];

const initAudio = () => {
    if (audioCtx) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
        
        musicGain = audioCtx.createGain();
        musicGain.connect(audioCtx.destination);
        musicGain.gain.setValueAtTime(0, audioCtx.currentTime);
        
        fxGain = audioCtx.createGain();
        fxGain.connect(audioCtx.destination);
        fxGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        
        console.log("Audio Context Initialized");
    } catch (e) {
        console.error("Web Audio API not supported", e);
    }
};

const playSound = (params) => {
    if (isFxMuted) return;
    initAudio();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const [
        volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0, 
        release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0, 
        pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, 
        bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0
    ] = params;

    const sampleRate = 44100;
    const playTime = attack + decay + sustain + release + delay;
    const numSamples = Math.ceil(sampleRate * playTime);
    const buffer = audioCtx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        let t = i / sampleRate;
        if (t < delay) { data[i] = 0; continue; }
        
        let v = 1;
        if (t < delay + attack) v = (t - delay) / attack;
        else if (t < delay + attack + decay) v = 1 - (t - delay - attack) / decay * (1 - sustainVolume);
        else if (t < delay + attack + decay + sustain) v = sustainVolume;
        else v = sustainVolume * (1 - (t - delay - attack - decay - sustain) / release);

        let f = frequency;
        f += slide * t + deltaSlide * t * t;
        if (pitchJumpTime && t > pitchJumpTime) f += pitchJump;
        
        let s = 0;
        if (shape === 0) s = Math.sin(2 * Math.PI * f * t);
        else if (shape === 1) s = (2 * (f * t % 1) - 1);
        else if (shape === 2) s = (f * t % 1 < 0.5 ? 1 : -1);
        else s = Math.random() * 2 - 1;

        data[i] = s * v * volume * 0.5;
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(fxGain);
    source.start();
};

const Sounds = {
    click: [1, .05, 400, 0, 0, .05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    connect: [.5, .05, 150, .05, .1, .2, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    error: [1, .05, 100, 0, 0, .3, 3, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    complete: [1, .05, 200, .1, .2, .5, 0, 1, 10, 0, 100, .1, 0, 0, 0, 0, 0, 1, 0, 0],
    ambient: (level) => {
        const freq = 60 + (level * 10);
        return [0.1, 0, freq, 2, 5, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0];
    }
};

let ambientLoopTimeout;
const playAmbient = (level) => {
    if (ambientLoopTimeout) clearTimeout(ambientLoopTimeout);
    const params = Sounds.ambient(level);
    const loop = () => {
        if (!isFxMuted) playSound(params);
        ambientLoopTimeout = setTimeout(loop, 8000);
    };
    loop();
};

const playMusic = () => {
    initAudio();
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => startMusicInternal());
    } else {
        startMusicInternal();
    }
};

const startMusicInternal = () => {
    if (oscillators.length > 0) return;
    
    console.log("Starting procedural music...");
    
    const addOsc = (freq, type, vol) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        g.gain.setValueAtTime(vol, audioCtx.currentTime);
        osc.connect(g);
        g.connect(musicGain);
        osc.start();
        oscillators.push({osc, g});
    };

    // Use higher, more audible frequencies for the base
    addOsc(110, 'sine', 0.2);  // A2
    addOsc(164.81, 'sine', 0.1); // E3
    addOsc(220, 'triangle', 0.05); // A3

    const playBlip = () => {
        if (isMusicMuted || !audioCtx) return;
        const notes = [440, 523.25, 659.25, 880]; 
        const f = notes[Math.floor(Math.random() * notes.length)];
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(0, audioCtx.currentTime);
        g.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
        osc.connect(g);
        g.connect(musicGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 2);
        setTimeout(playBlip, 4000 + Math.random() * 4000);
    };
    playBlip();

    if (!isMusicMuted) {
        musicGain.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 2);
    }
};

const toggleMusic = () => {
    isMusicMuted = !isMusicMuted;
    initAudio();
    audioCtx.resume().then(() => {
        if (oscillators.length === 0 && !isMusicMuted) {
            playMusic();
        } else if (musicGain) {
            musicGain.gain.setTargetAtTime(isMusicMuted ? 0 : 0.4, audioCtx.currentTime, 0.2);
        }
    });
    return isMusicMuted;
};

const toggleFx = () => {
    isFxMuted = !isFxMuted;
    if (fxGain) {
        fxGain.gain.setTargetAtTime(isFxMuted ? 0 : 0.5, audioCtx.currentTime, 0.1);
    }
    return isFxMuted;
};
