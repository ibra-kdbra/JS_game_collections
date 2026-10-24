// Theme music engine (WebAudio). Plays the score in js/music-score.js with
// synthesised voices: an FM kalimba, marimba and bell, a breathy flute, a
// soft pad, a round bass, shaker, wood tok, hand drum, a low pulse drum and a
// distant sea wash, through a generated reverb and a dotted-eighth echo.
//
// A look-ahead scheduler places every note on the AudioContext clock, a few
// hundred milliseconds ahead, so timer jitter never reaches the beat. It works
// the same in an OfflineAudioContext (tools/render-music.mjs renders previews
// with it): call `pump(until)` instead of `run()`.
//
// No DOM, no globals: createMusic(ctx, destination) returns a player.
import {
    ARRANGEMENTS,
    ARP_REST,
    EXPERT_STINGERS,
    LAYERS,
    LOOKAHEAD,
    PAD_CUTOFF,
    PATTERNS,
    SECTIONS,
    STINGERS,
    SWING,
    TEMPO,
    WAKE_MS,
} from './music-score.js';

// ------------------------------------------------------------ notation --
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pitchClass(name) {
    const m = /^([A-G])(#|b)?/.exec(name);
    return (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
}
export function noteMidi(name) {
    const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
    if (!m) throw new Error(`bad note ${name}`);
    return pitchClass(m[1]) + 12 * (Number(m[2]) + 1);
}
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

const QUALITY = {
    '': [0, 4, 7],
    m: [0, 3, 7],
    7: [0, 4, 7, 10],
    m7: [0, 3, 7, 10],
    maj7: [0, 4, 7, 11],
    sus4: [0, 5, 7],
    sus2: [0, 2, 7],
    '7sus4': [0, 5, 7, 10],
    add9: [0, 4, 7, 2],
    m9: [0, 3, 7, 10, 2],
    6: [0, 4, 7, 9],
};
function parseChord(name) {
    const [main, slash] = name.split('/');
    const m = /^([A-G](?:#|b)?)(.*)$/.exec(main);
    const root = pitchClass(m[1]);
    const iv = QUALITY[m[2]];
    if (!iv) throw new Error(`unknown chord ${name}`);
    const pcs = iv.map((i) => (root + i) % 12);
    return { name, root, pcs, bass: slash ? pitchClass(slash) : root, third: pcs[1], fifth: (root + 7) % 12 };
}

/** "D | Bm7 | Asus4 A" -> per bar, [{ step, chord }]. */
function parseChords(text) {
    return text.split('|').map((bar) => {
        const names = bar.trim().split(/\s+/);
        return names.map((n, i) => ({ step: (i * 16) / names.length, chord: parseChord(n) }));
    });
}

/** "A4:2 D5:2 -:4 | ..." -> Map(absolute step -> [{ midi, len }]). */
export function parseMelody(text) {
    const events = new Map();
    text.split('|').forEach((bar, b) => {
        let step = 0;
        for (const tok of bar.trim().split(/\s+/)) {
            const [note, len] = tok.split(':');
            const n = Number(len);
            if (note !== '-') {
                const notes = note.split('+').map(noteMidi);
                const at = b * 16 + step;
                if (!events.has(at)) events.set(at, []);
                for (const midi of notes) events.get(at).push({ midi, len: n });
            }
            step += n;
        }
        if (step !== 16) throw new Error(`bar ${b + 1} of "${text.slice(0, 30)}..." has ${step} sixteenths`);
    });
    return events;
}

function compileSection(name, def) {
    const bars = parseChords(def.chords);
    return {
        name,
        def,
        bars,
        length: bars.length,
        lead: def.lead ? parseMelody(def.lead) : null,
        counter: def.counter ? parseMelody(def.counter) : null,
    };
}
const SECTION_DATA = Object.fromEntries(Object.entries(SECTIONS).map(([k, v]) => [k, compileSection(k, v)]));
const pick = (v, pass) => (Array.isArray(v) ? v[pass % v.length] : v);

function mulberry32(a) {
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Chord tones from `lo` up to (not including) `hi`, as MIDI notes. */
function tonesIn(chord, lo, hi) {
    const out = [];
    for (let m = lo; m < hi; m++) if (chord.pcs.includes(m % 12)) out.push(m);
    return out;
}

// --------------------------------------------------------------- player --
// `only` (for tools/render-music.mjs) keeps just the named layers audible.
export function createMusic(ctx, destination, { seed = (Math.random() * 2 ** 32) >>> 0, only = null } = {}) {
    const rand = mulberry32(seed);
    const s16 = 60 / TEMPO / 4;
    const gainNode = (v = 1) => {
        const g = ctx.createGain();
        g.gain.value = v;
        return g;
    };
    // One value per 128-sample block is plenty for slow sweeps, and much
    // cheaper than per-sample filter coefficients or detune.
    const kRate = (param) => {
        try {
            param.automationRate = 'k-rate';
        } catch {}
        return param;
    };
    const filter = (type, freq, q = 0.7) => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        kRate(f.frequency).value = freq;
        kRate(f.Q).value = q;
        return f;
    };
    // setTargetAtTime never quite arrives, which keeps a parameter on the slow
    // per-sample path for good; every approach ends on a plain value instead.
    const approach = (param, value, t, tc, settle = tc * 6) => {
        param.cancelScheduledValues(t);
        param.setTargetAtTime(value, t, tc);
        param.setValueAtTime(value, t + settle);
    };
    const panner = (p) => {
        if (!ctx.createStereoPanner || !p) return gainNode(1);
        const n = ctx.createStereoPanner();
        n.pan.value = p;
        return n;
    };

    // Shared noise, two seconds, for the shaker, breath and sea.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    {
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = rand() * 2 - 1;
    }

    // ---- bus: layers -> duck (sfx) -> duck (stingers) -> fade -> 40 Hz high-pass -> out ----
    // The output is only connected while the music plays, so a stopped player
    // (its reverb and echo included) costs the audio thread nothing.
    const fade = gainNode(0);
    let connected = false;
    // Nothing useful lives below 40 Hz (and phone speakers cannot play it).
    const rumble = filter('highpass', 40, 0.6);
    fade.connect(rumble);
    const stingDuck = gainNode(1);
    stingDuck.connect(fade);
    const sfxDuck = gainNode(1);
    sfxDuck.connect(stingDuck);

    // Reverb: a generated 2.4 s impulse that darkens as it decays. It runs in
    // mono (half the work of stereo) and is spread by sending the right side
    // a few milliseconds late.
    const reverb = ctx.createConvolver();
    reverb.channelCount = 1;
    reverb.channelCountMode = 'explicit';
    reverb.buffer = makeImpulse(ctx, 2.4, rand);
    const revIn = gainNode(1);
    const revOut = gainNode(0.7);
    revIn.connect(reverb).connect(revOut);
    const revSpread = ctx.createDelay(0.05);
    revSpread.delayTime.value = 0.017;
    revOut.connect(panner(-0.8)).connect(fade);
    revOut.connect(revSpread).connect(panner(0.8)).connect(fade);

    // Echo: dotted eighth, filtered feedback, a little reverb on the repeats.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = s16 * 3;
    const delayIn = gainNode(1);
    const feedback = gainNode(0.3);
    const delayTone = filter('lowpass', 2400);
    const delayOut = gainNode(0.55);
    delayIn.connect(delay).connect(delayTone).connect(feedback).connect(delay);
    delayTone.connect(delayOut).connect(fade);
    delayOut.connect(gainNode(0.3)).connect(revIn);

    // Event voices (stingers, magic shimmer) skip the ducks.
    const fx = makeLayer('fx', { levels: [1, 1, 1, 1], rev: 0.5, delay: 0.3, pan: 0.3 }, fade);
    fx.gain.gain.value = only && !only.includes('fx') ? 0 : 1;

    const layers = {};
    for (const [name, def] of Object.entries(LAYERS)) layers[name] = makeLayer(name, def, sfxDuck);
    // Layer colour that stays put: bass and pulse are rounded off, the shaker is airy.
    insertFilter(layers.bass, filter('lowpass', 900));
    insertFilter(layers.pulse, filter('lowpass', 700));
    const shakerIn = filter('highpass', 6500);
    shakerIn.connect(layers.perc.inputs[2]);

    function makeLayer(name, def, out) {
        const gain = gainNode(0);
        gain.connect(out);
        if (def.rev) gain.connect(gainNode(def.rev)).connect(revIn);
        if (def.delay) gain.connect(gainNode(def.delay)).connect(delayIn);
        const head = gainNode(10 ** ((def.trim || 0) / 20));
        head.connect(gain);
        const p = def.pan || 0;
        const inputs = [panner(-p), head, panner(p)];
        inputs[0].connect(head);
        inputs[2].connect(head);
        return { name, def, gain, head, inputs, target: 0, liveUntil: 0 };
    }
    function insertFilter(layer, f) {
        layer.head.disconnect();
        layer.head.connect(f).connect(layer.gain);
    }

    // Envelope gains are created at 0: the default of 1 would let a source that
    // starts between two samples through at full level for one frame.

    // Disconnect a finished voice's nodes once its last source has ended.
    function retire(source, nodes) {
        source.onended = () => {
            for (const n of nodes) n.disconnect();
        };
    }

    // ---------------------------------------------------------- voices --
    // FM pluck: a sine carrier whose brightness falls away fast.
    // kalimba: ratio 5 tine ping; marimba: ratio 4, woody and short; bell: inharmonic, long.
    const PLUCK = {
        kalimba: { ratio: 5, index: 2.2, bite: 0.025, decay: 1.4, vol: 0.22 },
        marimba: { ratio: 4, index: 1.4, bite: 0.04, decay: 0.7, vol: 0.24 },
        bell: { ratio: 3.5, index: 1.1, bite: 0.5, decay: 2.6, vol: 0.09 },
        tick: { ratio: 4, index: 0.9, bite: 0.02, decay: 0.22, vol: 0.12 },
        glock: { ratio: 3, index: 0.8, bite: 0.15, decay: 1.1, vol: 0.07 },
        mute: { ratio: 1, index: 0.8, bite: 0.03, decay: 0.28, vol: 0.3 },
    };
    function pluck(dest, t, midi, kind, vel = 1, len = 0) {
        const p = PLUCK[kind];
        const f = hz(midi);
        const decay = len ? Math.min(p.decay, Math.max(0.25, len * 1.6)) : p.decay;
        const car = ctx.createOscillator();
        const mod = ctx.createOscillator();
        const depth = gainNode(0);
        const amp = gainNode(0);
        car.frequency.value = f;
        mod.frequency.value = f * p.ratio;
        depth.gain.setValueAtTime(f * p.index, t);
        depth.gain.setTargetAtTime(f * p.index * 0.05, t, p.bite);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(p.vol * vel, t + 0.004);
        amp.gain.setTargetAtTime(0, t + 0.004, decay / 6);
        mod.connect(depth).connect(car.frequency);
        car.connect(amp).connect(dest);
        const end = t + decay * 1.1 + 0.05;
        car.start(t);
        mod.start(t);
        car.stop(end);
        mod.stop(end);
        retire(car, [car, mod, depth, amp]);
    }

    // Flute: sine with a little octave, delayed vibrato and a breath at the start.
    function flute(dest, t, midi, len, vel = 1) {
        const f = hz(midi);
        const end = t + len;
        const o = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o2g = gainNode(0.12);
        const lfo = ctx.createOscillator();
        const lfoDepth = gainNode(0);
        const tone = filter('lowpass', Math.min(5000, f * 4));
        const amp = gainNode(0);
        const breath = ctx.createBufferSource();
        const breathTone = filter('bandpass', Math.min(6000, f * 2), 1.2);
        const breathAmp = gainNode(0);
        o.frequency.value = f;
        o2.type = 'triangle';
        o2.frequency.value = f * 2;
        lfo.frequency.value = 4.8 + rand() * 0.6;
        lfoDepth.gain.setValueAtTime(0, t);
        lfoDepth.gain.linearRampToValueAtTime(0, t + Math.min(0.3, len * 0.5));
        lfoDepth.gain.linearRampToValueAtTime(len > 0.5 ? 9 : 3, t + Math.min(0.9, len));
        lfo.connect(lfoDepth);
        lfoDepth.connect(kRate(o.detune));
        lfoDepth.connect(kRate(o2.detune));
        const v = 0.13 * vel;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(v, t + 0.06);
        amp.gain.setTargetAtTime(v * 0.82, t + 0.06, 0.4);
        amp.gain.setTargetAtTime(0, end, 0.09);
        o.connect(tone);
        o2.connect(o2g).connect(tone);
        tone.connect(amp).connect(dest);
        breath.buffer = noise;
        breathAmp.gain.setValueAtTime(0, t);
        breathAmp.gain.linearRampToValueAtTime(v * 0.35, t + 0.03);
        breathAmp.gain.setTargetAtTime(v * 0.04, t + 0.03, 0.08);
        breathAmp.gain.setTargetAtTime(0, end, 0.06);
        breath.connect(breathTone).connect(breathAmp).connect(dest);
        const stop = end + 0.6;
        for (const s of [o, o2, lfo]) {
            s.start(t);
            s.stop(stop);
        }
        breath.start(t, rand() * 1.5);
        breath.stop(stop);
        retire(o, [o, o2, o2g, lfo, lfoDepth, tone, amp, breath, breathTone, breathAmp]);
    }

    // Bass: sine plus a quiet triangle, a soft pluck that settles.
    function bass(dest, t, midi, len, vel = 1) {
        const f = hz(midi);
        const o = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const o2g = gainNode(0.45);
        const amp = gainNode(0);
        o.frequency.value = f;
        o2.type = 'triangle';
        o2.frequency.value = f;
        const v = 0.3 * vel;
        const end = t + len;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(v, t + 0.015);
        amp.gain.setTargetAtTime(v * 0.55, t + 0.015, 0.18);
        amp.gain.setTargetAtTime(0, end - 0.03, 0.05);
        o.connect(amp);
        o2.connect(o2g).connect(amp);
        amp.connect(dest);
        const stop = end + 0.35;
        o.start(t);
        o2.start(t);
        o.stop(stop);
        o2.stop(stop);
        retire(o, [o, o2, o2g, amp]);
    }

    // Swell: a short pad chord for the stingers.
    const padWave = makePadWave(ctx);
    function swell(dest, t, midis, len, vel = 1) {
        const tone = filter('lowpass', 1400);
        const amp = gainNode(0);
        const v = (0.05 * vel) / Math.sqrt(midis.length);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(v, t + 0.35);
        amp.gain.setTargetAtTime(0, t + len * 0.5, len / 5);
        tone.connect(amp).connect(dest);
        const stop = t + len + 0.4;
        const nodes = [tone, amp];
        let first = null;
        for (const m of midis) {
            for (const d of [-7, 7]) {
                const o = ctx.createOscillator();
                o.setPeriodicWave(padWave);
                o.frequency.value = hz(m);
                o.detune.value = d;
                o.connect(tone);
                o.start(t);
                o.stop(stop);
                nodes.push(o);
                first ||= o;
            }
        }
        retire(first, nodes);
    }

    // Percussion.
    function shaker(t, vel) {
        const s = ctx.createBufferSource();
        const amp = gainNode(0);
        s.buffer = noise;
        const v = 0.05 * vel;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(v, t + 0.012);
        amp.gain.setTargetAtTime(0, t + 0.012, 0.025);
        s.connect(amp).connect(shakerIn);
        s.start(t, rand() * 1.8);
        s.stop(t + 0.15);
        retire(s, [s, amp]);
    }
    function wood(t, vel, midi) {
        const o = ctx.createOscillator();
        const amp = gainNode(0);
        o.type = 'triangle';
        o.frequency.setValueAtTime(hz(midi) * 1.02, t);
        o.frequency.exponentialRampToValueAtTime(hz(midi), t + 0.02);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(0.012 * vel, t + 0.002);
        amp.gain.setTargetAtTime(0, t + 0.002, 0.018);
        o.connect(amp).connect(layers.perc.inputs[0]);
        o.start(t);
        o.stop(t + 0.15);
        retire(o, [o, amp]);
    }
    function drum(dest, t, vel, low = false) {
        const o = ctx.createOscillator();
        const amp = gainNode(0);
        const [from, to, decay, v] = low ? [86, 46, 0.22, 0.42] : [170, 92, 0.1, 0.3];
        o.frequency.setValueAtTime(from, t);
        o.frequency.exponentialRampToValueAtTime(to, t + decay * 0.8);
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(v * vel, t + 0.006);
        amp.gain.setTargetAtTime(0, t + 0.006, decay);
        o.connect(amp).connect(dest);
        const stop = t + decay * 7;
        o.start(t);
        o.stop(stop);
        // A soft skin slap on top.
        const s = ctx.createBufferSource();
        const st = filter('lowpass', low ? 500 : 1400);
        const sa = gainNode(0);
        s.buffer = noise;
        sa.gain.setValueAtTime(0, t);
        sa.gain.linearRampToValueAtTime(v * vel * 0.18, t + 0.003);
        sa.gain.setTargetAtTime(0, t + 0.003, 0.02);
        s.connect(st).connect(sa).connect(dest);
        s.start(t, rand());
        s.stop(t + 0.2);
        retire(o, [o, amp, s, st, sa]);
    }
    function seaWash(t, len) {
        const s = ctx.createBufferSource();
        const tone = filter('lowpass', 380 + rand() * 120, 0.4);
        const amp = gainNode(0);
        s.buffer = noise;
        s.loop = true;
        amp.gain.setValueAtTime(0, t);
        amp.gain.linearRampToValueAtTime(0.09, t + len * 0.42);
        amp.gain.linearRampToValueAtTime(0, t + len);
        tone.frequency.setValueAtTime(tone.frequency.value, t);
        tone.frequency.linearRampToValueAtTime(tone.frequency.value + 260, t + len * 0.42);
        tone.frequency.linearRampToValueAtTime(260, t + len);
        s.connect(tone).connect(amp).connect(layers.sea.inputs[rand() < 0.5 ? 0 : 2]);
        s.start(t, rand() * 1.5);
        s.stop(t + len + 0.05);
        retire(s, [s, tone, amp]);
    }

    function play(voice, dest, t, notes, len, vel) {
        const list = (Array.isArray(notes) ? notes : [notes]).map((n) => (typeof n === 'string' ? noteMidi(n) : n));
        if (voice === 'swell') return swell(dest, t, list, len, vel);
        for (const m of list) {
            if (voice === 'flute') flute(dest, t, m, len, vel);
            else if (voice === 'bass') bass(dest, t, m, len, vel);
            else pluck(dest, t, m, voice, vel, voice === 'bell' ? 0 : len);
        }
    }

    // ------------------------------------------------------------- pad --
    // Four persistent voices that glide to the nearest note of each new chord.
    let pad = null;
    function startPad(t) {
        // Two filtered halves, panned apart: voices 0 and 2 left, 1 and 3 right.
        const lfo = ctx.createOscillator();
        const lfoDepth = gainNode(260);
        lfo.frequency.value = 0.05;
        lfo.connect(lfoDepth);
        const tones = [0, 2].map((input) => {
            const f = filter('lowpass', PAD_CUTOFF[state.band], 0.5);
            lfoDepth.connect(f.frequency);
            f.connect(layers.pad.inputs[input]);
            return f;
        });
        const voices = [0, 1, 2, 3].map((i) => {
            const g = gainNode(0);
            g.connect(tones[i % 2]);
            const oscs = [-6, 6].map((d) => {
                const o = ctx.createOscillator();
                o.setPeriodicWave(padWave);
                o.detune.value = d + (i - 1.5) * 1.5;
                o.frequency.value = hz(57 + i * 4);
                o.connect(g);
                o.start(t);
                return o;
            });
            return { g, oscs, midi: 57 + i * 4 };
        });
        lfo.start(t);
        pad = { tones, lfo, lfoDepth, voices };
    }
    function stopPad(t) {
        if (!pad) return;
        const p = pad;
        pad = null;
        for (const v of p.voices) v.g.gain.setTargetAtTime(0, t, 0.3);
        const end = t + 2;
        for (const v of p.voices) for (const o of v.oscs) o.stop(end);
        p.lfo.stop(end);
        retire(p.lfo, [...p.tones, p.lfo, p.lfoDepth, ...p.voices.flatMap((v) => [v.g, ...v.oscs])]);
    }
    // Voice leading: try every way of giving the four voices the chord's notes
    // and keep the one that moves least, within D3..E5.
    function padChord(t, chord) {
        if (!pad) return;
        const pcs = chord.pcs.length > 4 ? chord.pcs.filter((pc) => pc !== chord.fifth) : chord.pcs.slice();
        while (pcs.length < 4) pcs.push(pcs[pcs.length === 3 ? 0 : 1]);
        const cur = pad.voices.map((v) => v.midi);
        let best = null;
        let bestCost = Infinity;
        for (const perm of PERMS) {
            const target = perm.map((k, i) => nearest(pcs[k], cur[i], 50, 76));
            const sorted = [...target].sort((a, b) => a - b);
            let cost = 0;
            for (let i = 0; i < 4; i++) cost += Math.abs(target[i] - cur[i]);
            // Avoid unisons and seconds crowding at the bottom of the voicing.
            for (let i = 1; i < 4; i++) if (sorted[i] - sorted[i - 1] < 2) cost += 6;
            if (sorted[0] - 50 < 0 || sorted[3] > 76) cost += 20;
            if (cost < bestCost) {
                bestCost = cost;
                best = target;
            }
        }
        pad.voices.forEach((v, i) => {
            v.midi = best[i];
            for (const o of v.oscs) approach(o.frequency, hz(best[i]), t, 0.05, 0.4);
            v.g.gain.cancelScheduledValues(t);
            v.g.gain.setTargetAtTime(0.03, t, 0.04);
            v.g.gain.setTargetAtTime(0.055, t + 0.12, 0.7);
            v.g.gain.setValueAtTime(0.055, t + 2.6);
        });
    }

    // -------------------------------------------------------- the score --
    const state = { band: 1, ai: false, nearEnd: false };
    let running = false;
    let arrangement = 'calm';
    let pendingArrangement = null;
    let order = [];
    let secIdx = 0;
    let section = null;
    let bar = 0;
    let step = 0;
    let pass = 0;
    let nextTime = 0;
    let stopAt = 0;
    let timer = 0;
    const chordLog = []; // [{ t, chord }] so cues know the harmony at any moment

    function enter(arr, t, { intro = false } = {}) {
        arrangement = arr;
        const a = ARRANGEMENTS[arr];
        order = intro && a.intro ? [a.intro, ...a.loop] : a.loop.slice();
        secIdx = 0;
        section = SECTION_DATA[order[0]];
        bar = 0;
        step = 0;
        applyLayers(t);
    }

    function chordAt(t) {
        for (let i = chordLog.length - 1; i >= 0; i--) if (chordLog[i].t <= t) return chordLog[i].chord;
        return chordLog[0]?.chord || parseChord('D');
    }

    const live = (layer, t) => layer.target > 0.001 || t < layer.liveUntil;

    function scheduleStep(t) {
        if (step === 0 && pendingArrangement) {
            const arr = pendingArrangement;
            pendingArrangement = null;
            enter(arr, t);
        }
        const def = section.def;
        const abs = bar * 16 + step;
        const swing = step % 2 ? SWING * s16 : 0;
        const tt = t + swing;
        const halves = section.bars[bar];
        const slot = halves.length > 1 && step >= 8 ? halves[1] : halves[0];
        const chord = slot.chord;
        if (step === slot.step) {
            padChord(t, chord);
            chordLog.push({ t, chord });
            if (chordLog.length > 16) chordLog.shift();
        }
        const human = () => (rand() - 0.5) * 0.008;
        const vary = (v) => v * (0.85 + rand() * 0.3);

        // Melody and countermelody.
        if (section.lead && live(layers.lead, t)) {
            const voice = pick(def.leadVoice, pass);
            for (const ev of section.lead.get(abs) || []) {
                const len = ev.len * s16;
                play(voice, layers.lead.inputs[1], tt + human(), ev.midi, len, vary(voice === 'bell' ? 1 : 0.9));
            }
        }
        if (section.counter && live(layers.counter, t)) {
            for (const ev of section.counter.get(abs) || []) {
                play('marimba', layers.counter.inputs[2], tt + human(), ev.midi, ev.len * s16, vary(0.6));
            }
        }

        // Arpeggio.
        const arp = PATTERNS.arp[pick(def.arp, pass)];
        if (arp[step] !== null && live(layers.arp, t) && rand() > ARP_REST[state.band]) {
            const tones = tonesIn(chord, 55, 79);
            const i = Math.min(arp[step], tones.length - 1);
            const accent = step % 4 === 0 ? 1 : 0.75;
            play(step % 8 < 4 ? 'kalimba' : 'marimba', layers.arp.inputs[(abs >> 1) % 2 ? 2 : 0], tt + human(), tones[i], 0, vary(accent * 0.6));
        }

        // Bass.
        if (live(layers.bass, t)) {
            for (const [s, which, len] of PATTERNS.bass[def.bass]) {
                if (s !== step) continue;
                const root = 36 + chord.bass;
                const lowRoot = root < 38 ? root + 12 : root;
                const m = which === 'r' ? lowRoot : which === '5' ? lowRoot + 7 : which === 'o' ? lowRoot + 12 : lowRoot + ((chord.third - chord.root + 12) % 12);
                bass(layers.bass.inputs[1], t, m, len * s16, vary(step === 0 ? 0.95 : 0.75));
            }
        }

        // Percussion.
        if (live(layers.perc, t)) {
            const sh = PATTERNS.shaker[def.shaker][step];
            if (sh !== '-') shaker(tt + human(), sh === 'X' ? 1 : 0.55);
            const wd = PATTERNS.wood[def.wood][step];
            if (wd !== '-') wood(tt, wd === 'X' ? 1 : 0.7, step % 8 === 4 ? 86 : 81);
        }
        if (live(layers.drum, t)) {
            const d = PATTERNS.drum[def.drum][step];
            if (d !== '-') drum(layers.drum.inputs[1], t, d === 'O' ? 1 : 0.45);
        }
        if (def.pulse && live(layers.pulse, t)) {
            const p = PATTERNS.pulse[def.pulse][step];
            if (p !== '-') drum(layers.pulse.inputs[1], t, p === 'O' ? 1 : 0.5, true);
            if (step % 2 === 0) {
                const root = 48 + chord.root;
                pluck(layers.pulse.inputs[1], t, root, 'mute', step % 8 === 0 ? 0.9 : 0.55);
            }
        }

        // Event layers.
        if (live(layers.tick, t)) {
            const tones = tonesIn(chord, 76, 92);
            const n = tones[(abs * 3) % tones.length];
            const acc = step % 4 === 0 ? 1 : step % 2 ? 0.45 : 0.7;
            pluck(layers.tick.inputs[step % 4 < 2 ? 0 : 2], tt, n, 'tick', acc);
        }
        if (live(layers.sparkle, t) && step % 4 === 2) {
            const tones = tonesIn(chord, 81, 98);
            const n = tones[(bar * 4 + (step >> 2)) % tones.length];
            pluck(layers.sparkle.inputs[step % 8 === 2 ? 0 : 2], tt, n, 'glock', vary(0.8));
        }
        if (def.sea && step === 0 && bar % 2 === 0 && live(layers.sea, t)) seaWash(t + rand() * 0.5, s16 * 16 * 1.9);

        // Advance.
        step++;
        if (step === 16) {
            step = 0;
            bar++;
            if (bar >= section.length) {
                bar = 0;
                secIdx++;
                if (secIdx >= order.length) {
                    // Loop (without the intro).
                    order = ARRANGEMENTS[arrangement].loop.slice();
                    secIdx = 0;
                    pass++;
                }
                section = SECTION_DATA[order[secIdx]];
            }
        }
    }

    // Layer gains follow the band and the game's events, with slow fades.
    function applyLayers(t) {
        for (const layer of Object.values(layers)) {
            let target = layer.def.levels[state.band];
            if (layer.def.event) target = state[layer.def.event] ? target : 0;
            if (only && !only.includes(layer.name)) target = 0;
            // While the AI plays, the melody steps back so its work comes first.
            if (layer.name === 'lead' && state.ai) target *= 0.6;
            if (target === layer.target) continue;
            const rising = target > layer.target;
            approach(layer.gain.gain, target, t, rising ? 0.8 : 1.2);
            if (!rising && target <= 0.001) layer.liveUntil = t + 6;
            layer.target = target;
        }
        if (pad) for (const f of pad.tones) approach(f.frequency, PAD_CUTOFF[state.band], t, 1.5);
    }

    /** Schedule every step that starts before `until` (seconds, context time). */
    function pump(until) {
        if (!running) return;
        const now = ctx.currentTime;
        // After a long stall (a frozen tab), skip ahead rather than burst.
        if (nextTime < now - 0.05) nextTime = now + 0.05;
        while (nextTime < until) {
            if (stopAt && nextTime >= stopAt) break;
            scheduleStep(nextTime);
            nextTime += s16;
        }
        if (stopAt && now >= stopAt) finishStop();
    }

    function finishStop() {
        running = false;
        stopAt = 0;
        clearTimeout(timer);
        timer = 0;
        stopPad(ctx.currentTime);
        if (connected) rumble.disconnect();
        connected = false;
    }

    function hold(param, t, depth, holdFor, release) {
        if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t);
        else param.cancelScheduledValues(t);
        param.setTargetAtTime(depth, t, 0.03);
        param.setTargetAtTime(1, t + holdFor, release);
        param.setValueAtTime(1, t + holdFor + release * 6);
    }

    const api = {
        get running() {
            return running && !stopAt;
        },
        get state() {
            return { ...state, arrangement, section: section?.name, bar, pass };
        },
        /** Start playing at `when`, fading in over a few seconds. */
        start(when = ctx.currentTime) {
            if (running && !stopAt) return;
            const t = Math.max(when, ctx.currentTime);
            if (!connected) rumble.connect(destination);
            connected = true;
            if (running && stopAt) {
                // Restarted while fading out: keep going.
                stopAt = 0;
            } else {
                running = true;
                chordLog.length = 0;
                for (const l of Object.values(layers)) {
                    l.gain.gain.cancelScheduledValues(t);
                    l.gain.gain.setValueAtTime(0, t);
                    l.target = 0;
                }
                // The intro plays once; after a stop the music picks up at the
                // section after the one it stopped in.
                const arr = state.band === 3 ? 'expert' : 'calm';
                const loop = ARRANGEMENTS[arr].loop;
                const prev = section && arr === arrangement ? loop.indexOf(section.name) : -1;
                enter(arr, t, { intro: !section });
                if (prev >= 0) {
                    secIdx = (prev + 1) % loop.length;
                    section = SECTION_DATA[order[secIdx]];
                }
                startPad(t);
                nextTime = t + 0.05;
            }
            fade.gain.cancelScheduledValues(t);
            fade.gain.setValueAtTime(fade.gain.value, t);
            fade.gain.setTargetAtTime(1, t, 1.4);
            fade.gain.setValueAtTime(1, t + 9);
        },
        /** Fade out and stop scheduling. */
        stop(when = ctx.currentTime) {
            if (!running || stopAt) return;
            const t = Math.max(when, ctx.currentTime);
            fade.gain.cancelScheduledValues(t);
            fade.gain.setValueAtTime(fade.gain.value, t);
            fade.gain.setTargetAtTime(0, t, 0.35);
            stopAt = t + 2.4;
        },
        pump,
        /** Real-time mode: wake every WAKE_MS and schedule LOOKAHEAD ahead. */
        run() {
            if (timer || !running) return;
            const tick = () => {
                timer = 0;
                pump(ctx.currentTime + LOOKAHEAD);
                if (running) timer = setTimeout(tick, WAKE_MS);
            };
            tick();
        },
        halt() {
            clearTimeout(timer);
            timer = 0;
        },
        /** 0 easy, 1 medium, 2 hard, 3 expert. */
        setBand(band, when = ctx.currentTime) {
            band = Math.max(0, Math.min(3, band | 0));
            if (band === state.band) return;
            const wantExpert = band === 3;
            state.band = band;
            if (running && wantExpert !== (arrangement === 'expert')) pendingArrangement = wantExpert ? 'expert' : 'calm';
            else if (!running) arrangement = wantExpert ? 'expert' : 'calm';
            if (running) applyLayers(when);
        },
        setAi(on, when = ctx.currentTime) {
            if (state.ai === !!on) return;
            state.ai = !!on;
            if (running) applyLayers(when);
        },
        setNearEnd(on, when = ctx.currentTime) {
            if (state.nearEnd === !!on) return;
            state.nearEnd = !!on;
            if (running) applyLayers(when);
        },
        /** Lower the music for a moment (under a sound effect). */
        duck(amount = 0.35, when = ctx.currentTime) {
            if (!running) return;
            hold(sfxDuck.gain, when, 1 - amount, 0.12, 0.25);
        },
        /** A falling run of bell notes in the current harmony (wizard magic). */
        shimmer(when = ctx.currentTime) {
            if (!running) return;
            const t = when + 0.2;
            const tones = tonesIn(chordAt(t), 84, 100).reverse();
            tones.slice(0, 6).forEach((m, i) => pluck(fx.inputs[i % 2 ? 2 : 0], t + i * s16 * 0.5, m, 'bell', 0.32 - i * 0.04));
        },
        /** "win", "fall" or "stuck". */
        stinger(kind, when = ctx.currentTime) {
            if (!running) return;
            const s = (arrangement === 'expert' && EXPERT_STINGERS[kind]) || STINGERS[kind];
            if (!s) return;
            hold(stingDuck.gain, when, s.depth, s.duck, 0.8);
            for (const [dt, voice, notes, len, vel] of s.notes) play(voice, fx.inputs[1], when + dt, notes, len, vel);
            if (kind === 'win') api.setNearEnd(false, when);
        },
        dispose() {
            finishStop();
            rumble.disconnect();
        },
    };
    return api;
}

const PERMS = (() => {
    const out = [];
    const rec = (arr, rest) => {
        if (!rest.length) return out.push(arr);
        rest.forEach((v, i) => rec([...arr, v], rest.filter((_, j) => j !== i)));
    };
    rec([], [0, 1, 2, 3]);
    return out;
})();

function nearest(pc, from, lo, hi) {
    let best = null;
    for (let m = lo; m <= hi; m++) {
        if (m % 12 !== pc) continue;
        if (best === null || Math.abs(m - from) < Math.abs(best - from)) best = m;
    }
    return best;
}

/** Soft, slightly hollow pad wave: odd harmonics a little stronger. */
function makePadWave(ctx) {
    const n = 16;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (k % 2 ? 1 : 0.55) / k ** 1.7;
    return ctx.createPeriodicWave(real, imag);
}

function makeImpulse(ctx, seconds, rand) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(1, len, rate);
    const pre = Math.floor(rate * 0.012);
    for (let ch = 0; ch < 1; ch++) {
        const d = buf.getChannelData(ch);
        let lp = 0;
        for (let i = pre; i < len; i++) {
            const x = (i - pre) / (len - pre);
            // One-pole low-pass that closes as the tail decays: bright start, dark end.
            const k = 0.55 - 0.47 * x;
            lp += k * (rand() * 2 - 1 - lp);
            d[i] = lp * Math.exp(-x * 6.5) * (1 - x) * 0.6;
        }
    }
    return buf;
}
