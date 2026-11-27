/**
 * LSD's soundtrack, played live with the Web Audio API: no audio file.
 *
 * A slow ambient electronic piece at 84 BPM in D minor: warm detuned chord
 * pads, a soft sub bass, a sparse bell arpeggio through a ping-pong delay, a
 * light syncopated beat and a faint tape hiss, all into one shared reverb.
 * The song is built from 4- and 8-bar sections that bring layers in and out
 * (pads alone, then bass, beat, bells, a breakdown) and the arpeggio is drawn from a
 * seeded random sequence, so it keeps changing instead of looping a short clip.
 *
 * Notes are scheduled a little ahead of time on the audio clock, the usual
 * look-ahead pattern, so timing stays tight even when the page is busy
 * rendering the shader.
 *
 *   LsdSoundtrack.start()   create the audio graph (call from a click or tap)
 *   LsdSoundtrack.pause()   fade out and suspend
 *   LsdSoundtrack.resume()  fade back in
 */
const LsdSoundtrack = (() => {
  const BPM = 84;
  const STEP = 60 / BPM / 4; // one sixteenth note, in seconds
  const LOOKAHEAD = 0.12; // schedule notes this far ahead
  const TICK_MS = 25;

  // Two bars per chord. Each chord: bass root and pad voicing (MIDI notes).
  const CHORDS = [
    { root: 38, pad: [53, 57, 60, 64] }, // Dm9:    F A C E over D
    { root: 34, pad: [53, 57, 62, 65] }, // Bbmaj7: F A D F over Bb
    { root: 41, pad: [52, 57, 60, 64] }, // Fmaj7:  E A C E over F
    { root: 36, pad: [52, 55, 59, 62] }, // Cadd9:  E G B D over C
  ];
  const ARP_SCALE = [62, 64, 65, 67, 69, 72, 74, 76, 77, 81]; // D dorian-ish, upper register

  // Which layers play in each section, and for how many bars; the list repeats.
  const SECTIONS = [
    { bars: 4, pad: 1, bass: 0, beat: 0, arp: 0.0 }, // intro
    { bars: 4, pad: 1, bass: 1, beat: 0, arp: 0.15 },
    { bars: 8, pad: 1, bass: 1, beat: 1, arp: 0.3 },
    { bars: 8, pad: 1, bass: 1, beat: 1, arp: 0.45 },
    { bars: 4, pad: 1, bass: 0, beat: 0, arp: 0.35 }, // breakdown
    { bars: 8, pad: 1, bass: 1, beat: 1, arp: 0.25 },
  ];
  const SONG_BARS = SECTIONS.reduce((n, sec) => n + sec.bars, 0);
  const sectionAt = (bar) => {
    let b = bar % SONG_BARS;
    for (const sec of SECTIONS) {
      if (b < sec.bars) return sec;
      b -= sec.bars;
    }
    return SECTIONS[0];
  };

  let ctx = null;
  let master = null;
  let bus = null; // dry mix, before the master fade
  let reverb = null;
  let delayIn = null;
  let noise = null; // a shared buffer of white noise
  let timer = 0;
  let nextTime = 0;
  let step = 0; // sixteenth notes since the start
  let playing = false;
  let seed = 0x2f6e2b1;

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
  const rand = () => {
    // mulberry32: small, fast and repeatable
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  /* ------------------------------------------------------------ the graph */

  function impulse(seconds, decay) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buffer = ctx.createBuffer(2, length, rate);
    for (let c = 0; c < 2; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
    return buffer;
  }

  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    comp.attack.value = 0.02;
    comp.release.value = 0.3;
    master.connect(comp).connect(ctx.destination);

    bus = ctx.createGain();
    bus.gain.value = 1.2;
    bus.connect(master);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet).connect(bus);

    // Ping-pong delay for the bells: left and right taps feeding each other.
    delayIn = ctx.createGain();
    const left = ctx.createDelay(2);
    const right = ctx.createDelay(2);
    left.delayTime.value = STEP * 3;
    right.delayTime.value = STEP * 3;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    const merge = ctx.createChannelMerger(2);
    delayIn.connect(left);
    left.connect(right);
    right.connect(tone).connect(feedback).connect(left);
    left.connect(merge, 0, 0);
    right.connect(merge, 0, 1);
    const delayOut = ctx.createGain();
    delayOut.gain.value = 0.45;
    merge.connect(delayOut);
    delayOut.connect(bus);
    delayOut.connect(reverb);

    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise = n;

    hiss();
  }

  /** A faint, slowly breathing tape hiss under everything. */
  function hiss() {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 5200;
    band.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const depth = ctx.createGain();
    depth.gain.value = 0.006;
    lfo.connect(depth).connect(g.gain);
    src.connect(band).connect(g).connect(bus);
    src.start();
    lfo.start();
  }

  /* -------------------------------------------------------------- voices */

  /** A chord held for two bars: two detuned saws per note through a slowly moving filter. */
  function pad(notes, t, dur) {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(500, t);
    filter.frequency.linearRampToValueAtTime(1300 + rand() * 500, t + dur * 0.5);
    filter.frequency.linearRampToValueAtTime(600, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 1.4);
    g.gain.setValueAtTime(0.06, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.0);
    filter.connect(g);
    g.connect(bus);
    g.connect(reverb);
    for (const note of notes) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq(note);
        o.detune.value = detune + (rand() - 0.5) * 4;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 1.1);
      }
    }
  }

  function bass(note, t, dur) {
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq(note);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    o.connect(lp).connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** A soft bell: a sine carrier with a quickly decaying FM modulator. */
  function bell(note, t, velocity) {
    const f = freq(note);
    const car = ctx.createOscillator();
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.frequency.value = f * 3.5;
    const index = ctx.createGain();
    index.gain.setValueAtTime(f * 1.2, t);
    index.gain.exponentialRampToValueAtTime(1, t + 0.6);
    mod.connect(index).connect(car.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07 * velocity, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    car.connect(g);
    g.connect(bus);
    g.connect(delayIn);
    g.connect(reverb);
    car.start(t);
    mod.start(t);
    car.stop(t + 1.5);
    mod.stop(t + 1.5);
  }

  function kick(t, velocity) {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * velocity, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.5);
  }

  /** A short hat or, with a longer tail and lower band, a soft snare-like rim. */
  function tick(t, velocity, { cutoff = 7000, length = 0.05, toReverb = false } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = cutoff > 3000 ? 'highpass' : 'bandpass';
    hp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.09 * velocity, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(hp).connect(g);
    g.connect(bus);
    if (toReverb) g.connect(reverb);
    src.start(t, Math.random() * 1.5);
    src.stop(t + length + 0.02);
  }

  /* ----------------------------------------------------------- the score */

  function schedule(s, t) {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const section = sectionAt(bar);
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];

    if (pos === 0 && bar % 2 === 0 && section.pad) pad(chord.pad, t, STEP * 32);

    if (section.bass) {
      if (pos === 0) bass(chord.root, t, STEP * 6);
      if (pos === 10) bass(chord.root + 12, t, STEP * 2);
      if (pos === 12 && bar % 2 === 1) bass(chord.root + 7, t, STEP * 3);
    }

    if (section.beat) {
      if (pos === 0 || pos === 11) kick(t, pos === 0 ? 1 : 0.7);
      if (pos === 8) tick(t, 0.9, { cutoff: 1800, length: 0.18, toReverb: true });
      if (pos % 2 === 0) tick(t, pos % 4 === 2 ? 0.8 : 0.45);
      // Now and then a short stutter of hats, IDM style.
      if (pos === 14 && bar % 4 === 3) {
        for (let k = 0; k < 4; k++) tick(t + k * (STEP / 2), 0.35 + k * 0.1);
      }
    }

    if (section.arp && rand() < section.arp && pos % 2 === 0) {
      const tones = ARP_SCALE.filter((n) => chord.pad.some((p) => (n - p) % 12 === 0) || rand() < 0.2);
      const note = tones[Math.floor(rand() * tones.length)];
      bell(note, t, 0.6 + rand() * 0.4);
    }
  }

  function pump() {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      schedule(step, nextTime);
      step++;
      nextTime += STEP;
    }
  }

  function fadeTo(value, seconds) {
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(value, now + seconds);
  }

  return {
    get playing() {
      return playing;
    },
    start() {
      if (playing) return;
      if (!ctx) {
        build();
        nextTime = ctx.currentTime + 0.1;
      }
      this.resume();
    },
    pause() {
      if (!ctx || !playing) return;
      playing = false;
      clearInterval(timer);
      fadeTo(0, 0.4);
      setTimeout(() => {
        if (!playing) ctx.suspend();
      }, 450);
    },
    resume() {
      if (!ctx) return this.start();
      playing = true;
      ctx.resume().then(() => {
        // Pick up where the score left off, a beat from now.
        if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
        clearInterval(timer);
        timer = setInterval(pump, TICK_MS);
        pump();
        fadeTo(1, 1.5);
      });
    },
  };
})();
