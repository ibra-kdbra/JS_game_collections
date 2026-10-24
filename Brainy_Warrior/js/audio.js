// Synthesised sound effects and theme music (WebAudio). No audio files.
//
//   sound effects --> sfx bus (0.5) ---\
//                                       +--> soft clipper --> speakers
//   music (js/music.js) --> music bus --/
//
// The context is created on the first user gesture (browsers, iOS Safari in
// particular, only allow sound after one). The music then fades in. It is
// suspended while the tab is hidden and while nothing is audible.
import { createMusic } from './music.js';
import { DEFAULT_VOLUME, MUSIC_LEVEL } from './music-score.js';

const SFX_LEVEL = 0.5;

let ctx = null;
let sfxBus = null;
let musicBus = null;
let music = null;
let noiseBuf = null;
let unlocked = false;
let idleTimer = 0;

const settings = { muted: false, sfx: true, music: true, volume: DEFAULT_VOLUME };
const cues = { band: 0, ai: false, nearEnd: false };

const sfxGain = () => (settings.muted || !settings.sfx ? 0 : SFX_LEVEL);
const musicGain = () => MUSIC_LEVEL * settings.volume ** 2;
const musicWanted = () => unlocked && !settings.muted && settings.music && settings.volume > 0;
const sfxOn = () => !settings.muted && settings.sfx;

function ac() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            ctx = new AC();
        } catch {
            return null;
        }
        // Transparent below 0.8, rounds off anything above so the sum never clips.
        const clip = ctx.createWaveShaper();
        const curve = new Float32Array(1025);
        for (let i = 0; i < curve.length; i++) {
            const x = (i / 512) - 1;
            const a = Math.abs(x);
            curve[i] = a < 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2));
        }
        clip.curve = curve;
        clip.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = sfxGain();
        sfxBus.connect(clip);
        musicBus = ctx.createGain();
        musicBus.gain.value = musicGain();
        musicBus.connect(clip);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
    return ctx;
}

/** Start or stop the music and set the bus levels to match the settings. */
function refresh() {
    if (!ctx) return;
    const t = ctx.currentTime;
    sfxBus.gain.setTargetAtTime(sfxGain(), t, 0.02);
    musicBus.gain.setTargetAtTime(musicGain(), t, 0.08);
    clearTimeout(idleTimer);
    if (musicWanted()) {
        if (!music) {
            music = createMusic(ctx, musicBus);
            music.setBand(cues.band);
            music.setAi(cues.ai);
            music.setNearEnd(cues.nearEnd);
        }
        if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
        music.start();
        if (!document.hidden) music.run();
    } else {
        music?.stop();
        // Nothing to hear: let the audio thread rest once the fade is done.
        if (!sfxOn()) {
            idleTimer = setTimeout(() => {
                if (!musicWanted() && !sfxOn() && ctx.state === 'running') {
                    music?.halt();
                    ctx.suspend().catch(() => {});
                }
            }, 2500);
        } else if (ctx.state !== 'running' && !document.hidden) ctx.resume().catch(() => {});
    }
}

/** Update any of { muted, sfx, music, volume (0..1) }. */
export function configure(next) {
    for (const k of ['muted', 'sfx', 'music']) if (k in next) settings[k] = !!next[k];
    if ('volume' in next) settings.volume = Math.max(0, Math.min(1, Number(next.volume) || 0));
    refresh();
}
export const getSettings = () => ({ ...settings });
export const setMuted = (m) => configure({ muted: m });
export const isMuted = () => settings.muted;

/** Call from a user gesture so mobile browsers allow sound. */
export function unlock() {
    const c = ac();
    if (!c || unlocked) return;
    unlocked = true;
    // iOS: a silent buffer started inside the gesture opens the output.
    const s = c.createBufferSource();
    s.buffer = c.createBuffer(1, 1, c.sampleRate);
    s.connect(c.destination);
    s.start(0);
    // Mix with other apps' audio and respect the silent switch, like a game should.
    try {
        if (navigator.audioSession) navigator.audioSession.type = 'ambient';
    } catch {}
    refresh();
}
for (const type of ['pointerdown', 'touchend', 'keydown']) addEventListener(type, unlock, { capture: true, passive: true });

document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
        music?.halt();
        ctx.suspend().catch(() => {});
    } else if (unlocked && (musicWanted() || sfxOn())) {
        ctx.resume().catch(() => {});
        if (music?.running) music.run();
    }
});

// ------------------------------------------------------------- music cues --
export const musicCue = {
    /** 0 easy, 1 medium, 2 hard, 3 expert. */
    band(b) {
        cues.band = b;
        music?.setBand(b);
    },
    ai(on) {
        cues.ai = !!on;
        music?.setAi(on);
    },
    nearEnd(on) {
        cues.nearEnd = !!on;
        music?.setNearEnd(on);
    },
    magic() {
        if (music?.running) music.shimmer();
    },
};

/** Level won, fell in the sea, or stuck: a stinger when the music plays, else the sound effect. */
export function jingle(kind) {
    if (music?.running && !document.hidden) music.stinger(kind);
    else if (kind === 'win') sfx.win();
    else if (kind === 'fall') sfx.lose();
}

/** For automated checks. */
export function audioInfo() {
    return { context: ctx?.state || 'none', unlocked, settings: getSettings(), music: music ? { running: music.running, ...music.state } : null };
}

// ----------------------------------------------------------- sound effects --
let lastDuck = 0;
function duck(vol) {
    if (!music?.running || vol < 0.1) return;
    if (ctx.currentTime - lastDuck < 0.05) return;
    lastDuck = ctx.currentTime;
    music.duck(Math.min(0.45, vol * 1.3));
}

function tone({ type = 'sine', from, to = from, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005 }) {
    if (!sfxOn()) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0; // the default of 1 would leak for a frame before the envelope starts
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
    duck(vol);
}

function noise({ dur = 0.2, vol = 0.3, type = 'lowpass', from = 2000, to = 400, q = 1, delay = 0 }) {
    if (!sfxOn()) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, to), t + dur);
    const g = c.createGain();
    g.gain.value = 0; // the default of 1 would leak for a frame before the envelope starts
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
    duck(vol);
}

// Notes of D major pentatonic between 400 Hz and 1 kHz, for the AI's thinking blips.
const THINK = [440, 493.9, 587.3, 659.3, 740, 880, 987.8];

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
        tone({ type: 'sine', from: THINK[(Math.random() * THINK.length) | 0], dur: 0.05, vol: 0.04 });
    },
    click() {
        tone({ type: 'triangle', from: 1200, to: 900, dur: 0.05, vol: 0.08 });
    },
    // Win and lose are in D, the key of the music.
    win() {
        [587.3, 740, 880, 1174.7].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.25, vol: 0.2, delay: i * 0.11 }));
        tone({ type: 'sine', from: 1760, dur: 0.6, vol: 0.12, delay: 0.46 });
    },
    lose() {
        [440, 370, 293.7].forEach((f, i) => tone({ type: 'triangle', from: f, to: f * 0.97, dur: 0.24, vol: 0.16, delay: i * 0.14 }));
    },
};
