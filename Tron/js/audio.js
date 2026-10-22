// Procedural synthwave loop and sound effects, generated with WebAudio.
// The AudioContext is created on the first user gesture (browsers block it before).

const BPM = 124;
const STEP = 60 / BPM / 4; // One sixteenth note.
// A minor bass line, one note per sixteenth (MIDI numbers, 0 = rest), four bars.
const BASS = [
  [45, 45, 57, 45, 45, 57, 45, 55, 45, 45, 57, 45, 52, 45, 55, 57],
  [41, 41, 53, 41, 41, 53, 41, 52, 41, 41, 53, 41, 48, 41, 52, 53],
  [43, 43, 55, 43, 43, 55, 43, 53, 43, 43, 55, 43, 50, 43, 53, 55],
  [40, 40, 52, 40, 40, 52, 40, 50, 44, 44, 56, 44, 47, 44, 52, 56],
];
const ARP = [69, 72, 76, 72, 69, 72, 76, 79];

const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

export class Synth {
  constructor(muted) {
    this.ctx = null;
    this.muted = muted;
    this.playing = false;
    this.timer = 0;
    this.step = 0;
    this.nextTime = 0;
  }

  // Must be called from a user gesture.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.5, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    this.playing = false;
    clearInterval(this.timer);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  schedule() {
    if (this.ctx.state !== 'running') return;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const s = this.step % 16;
      const bar = Math.floor(this.step / 16) % BASS.length;
      const t = this.nextTime;
      this.bass(freq(BASS[bar][s]), t);
      if (s % 4 === 0) this.kick(t);
      if (s % 4 === 2) this.hat(t, 0.08);
      if (s === 4 || s === 12) this.hat(t, 0.16, 0.12);
      if (this.step >= 32 && s % 2 === 0) this.lead(freq(ARP[(s / 2 + bar) % ARP.length]), t);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 128;
    }
  }

  voice(type, f, t, dur, gain, cutoff) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.2), t + dur);
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter).connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    return osc;
  }

  bass(f, t) {
    this.voice('sawtooth', f, t, STEP * 0.9, 0.22, 1400);
  }

  lead(f, t) {
    this.voice('square', f, t, STEP * 1.6, 0.05, 3200);
  }

  kick(t) {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.14);
    amp.gain.setValueAtTime(0.6, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(amp).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  hat(t, gain, dur = 0.04) {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = this.noise;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  beep(high) {
    if (!this.ctx) return;
    this.voice('square', high ? 880 : 440, this.ctx.currentTime, high ? 0.4 : 0.15, 0.15, 4000);
  }

  crash() {
    if (!this.ctx) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    src.buffer = this.noise;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    amp.gain.setValueAtTime(0.7, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(filter).connect(amp).connect(this.master);
    src.start(t);
    src.stop(t + 0.5);
  }

  boost() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.voice('sawtooth', 110, t, 0.35, 0.12, 2500);
    osc.frequency.exponentialRampToValueAtTime(330, t + 0.3);
  }
}
