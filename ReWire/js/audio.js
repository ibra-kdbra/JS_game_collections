// ZzFX - ZzFX Micro - Tiny Sound Effect Generator - MIT License - Copyright 2019 Frank Force
const zzfxV = .3;
let zzfxCtx;
const playSound = (params) => {
    try {
        if (!zzfxCtx) zzfxCtx = new (window.AudioContext || window.webkitAudioContext);
        if (zzfxCtx.state === 'suspended') zzfxCtx.resume();
    } catch (e) {
        return;
    }
    if (!zzfxCtx) return;
    
    // ...
    const [
        volume = 1, randomness = .05, frequency = 220, attack = 0, sustain = 0, 
        release = .1, shape = 0, shapeCurve = 1, slide = 0, deltaSlide = 0, 
        pitchJump = 0, pitchJumpTime = 0, repeatTime = 0, noise = 0, modulation = 0, 
        bitCrush = 0, delay = 0, sustainVolume = 1, decay = 0, tremolo = 0
    ] = params;

    const sampleRate = 44100;
    const playTime = attack + decay + sustain + release + delay;
    const numSamples = Math.ceil(sampleRate * playTime);
    const buffer = zzfxCtx.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
        let t = i / sampleRate;
        if (t < delay) { data[i] = 0; continue; }
        
        let volumeFactor = 1;
        if (t < delay + attack) volumeFactor = (t - delay) / attack;
        else if (t < delay + attack + decay) volumeFactor = 1 - (t - delay - attack) / decay * (1 - sustainVolume);
        else if (t < delay + attack + decay + sustain) volumeFactor = sustainVolume;
        else volumeFactor = sustainVolume * (1 - (t - delay - attack - decay - sustain) / release);

        let f = frequency;
        f += slide * t + deltaSlide * t * t;
        if (pitchJumpTime && t > pitchJumpTime) f += pitchJump;
        
        let s = 0;
        if (shape === 0) s = Math.sin(2 * Math.PI * f * t + modulation * Math.sin(2 * Math.PI * f * t)); // Sin
        else if (shape === 1) s = (2 * (f * t % 1) - 1); // Saw
        else if (shape === 2) s = (f * t % 1 < 0.5 ? 1 : -1); // Square
        else s = Math.random() * 2 - 1; // Noise

        data[i] = s * volumeFactor * volume * zzfxV;
    }

    const source = zzfxCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(zzfxCtx.destination);
    source.start();
};

const Sounds = {
    click: [1, .05, 400, 0, 0, .05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    connect: [.5, .05, 150, .05, .1, .2, 0, 1, 5, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
    error: [1, .05, 100, 0, 0, .3, 3, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
    complete: [1, .05, 200, .1, .2, .5, 0, 1, 10, 0, 100, .1, 0, 0, 0, 0, 0, 1, 0, 0],
    ambient: (level) => {
        // Generate a low ambient drone based on level
        const freq = 40 + (level * 5);
        return [0.1, 0, freq, 2, 5, 2, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0];
    }
};

// Ambient Music System
let ambientLoopTimeout;
const playAmbient = (level) => {
    if (ambientLoopTimeout) clearTimeout(ambientLoopTimeout);
    
    const params = Sounds.ambient(level);
    const loop = () => {
        playSound(params);
        ambientLoopTimeout = setTimeout(loop, 8000);
    };
    
    // Start loop. playSound will handle zzfxCtx initialization
    loop();
};
