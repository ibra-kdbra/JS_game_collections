// The game's sound effects, made on the spot with the Web Audio API: no audio files.
//
//   correct  two bright notes going up
//   wrong    a short low knock
//   win      a rising major arpeggio with a little sparkle on top
//   lose     a slow falling minor line
//   rotate   the winch: a run of ratchet clicks that slows down
//   pullup   the rope taking the strain: a filtered creak
//   hang     the drop: a heavy thud and the rope snapping tight
//
// playSound(name, volume) and stopSound(name) keep the signatures the game
// already calls; volume is a 0-1 level relative to each sound's own mix.
const HangmanSounds = (() => {
	let ctx = null;
	let master = null;
	let noiseBuffer = null;
	const playing = {};

	const context = () => {
		if (ctx) return ctx;
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		ctx = new AC();
		master = ctx.createDynamicsCompressor();
		master.threshold.value = -14;
		master.ratio.value = 4;
		master.connect(ctx.destination);
		return ctx;
	};

	// Browsers start audio suspended until a tap or key press; wake it on the first one.
	const unlock = () => {
		const c = context();
		if (c && c.state === "suspended") c.resume().catch(() => {});
	};
	["pointerdown", "keydown", "touchend"].forEach((type) =>
		window.addEventListener(type, unlock, { passive: true })
	);

	const noise = () => {
		if (noiseBuffer) return noiseBuffer;
		const len = ctx.sampleRate;
		noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = noiseBuffer.getChannelData(0);
		let seed = 12345;
		for (let i = 0; i < len; i++) {
			seed = (seed * 1103515245 + 12345) & 0x7fffffff;
			data[i] = (seed / 0x3fffffff) - 1;
		}
		return noiseBuffer;
	};

	// One enveloped oscillator note into `out`.
	const tone = (out, t, { freq, to, type = "sine", dur, peak, attack = 0.005 }) => {
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t);
		if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		osc.connect(g).connect(out);
		osc.start(t);
		osc.stop(t + dur + 0.02);
		return osc;
	};

	// A burst of filtered noise into `out`.
	const hiss = (out, t, { dur, peak, filter = "bandpass", freq, to, q = 1, attack = 0.003 }) => {
		const src = ctx.createBufferSource();
		src.buffer = noise();
		src.loop = true;
		const f = ctx.createBiquadFilter();
		f.type = filter;
		f.frequency.setValueAtTime(freq, t);
		if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
		f.Q.value = q;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(peak, t + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(f).connect(g).connect(out);
		src.start(t, Math.random() * 0.5);
		src.stop(t + dur + 0.02);
		return src;
	};

	const SOUNDS = {
		correct(out, t) {
			tone(out, t, { freq: 784, type: "triangle", dur: 0.18, peak: 0.5 });
			tone(out, t + 0.08, { freq: 1175, type: "triangle", dur: 0.32, peak: 0.45 });
			tone(out, t + 0.08, { freq: 2350, dur: 0.2, peak: 0.08 });
			return 0.45;
		},
		wrong(out, t) {
			tone(out, t, { freq: 180, to: 90, type: "square", dur: 0.16, peak: 0.45 });
			hiss(out, t, { dur: 0.06, peak: 0.6, filter: "lowpass", freq: 900 });
			return 0.2;
		},
		win(out, t) {
			[523, 659, 784, 1047].forEach((freq, i) => {
				tone(out, t + i * 0.11, { freq, type: "triangle", dur: 0.5, peak: 0.36 });
				tone(out, t + i * 0.11, { freq: freq * 2, dur: 0.3, peak: 0.06 });
			});
			[1568, 2093, 2637].forEach((freq, i) =>
				tone(out, t + 0.5 + i * 0.07, { freq, dur: 0.35, peak: 0.07 })
			);
			return 1.3;
		},
		lose(out, t) {
			[392, 370, 311, 262].forEach((freq, i) => {
				const last = i === 3;
				tone(out, t + i * 0.32, { freq, to: last ? 247 : null, type: "triangle", dur: last ? 1.3 : 0.4, peak: 0.34, attack: 0.02 });
				tone(out, t + i * 0.32, { freq: freq / 2, type: "sine", dur: last ? 1.3 : 0.4, peak: 0.2, attack: 0.02 });
			});
			return 2.5;
		},
		rotate(out, t) {
			// Ratchet clicks, quick at first and slowing as the winch takes the load.
			let at = 0;
			for (let i = 0; at < 2.4; i++) {
				hiss(out, t + at, { dur: 0.03, peak: 0.5, freq: 2400 + (i % 2) * 700, q: 6, attack: 0.001 });
				tone(out, t + at, { freq: 420, to: 260, type: "square", dur: 0.025, peak: 0.08, attack: 0.001 });
				at += 0.07 + i * 0.004;
			}
			return 2.5;
		},
		pullup(out, t) {
			// A creak: narrow noise with a wobbling pitch, swelling and easing off.
			const src = ctx.createBufferSource();
			src.buffer = noise();
			src.loop = true;
			const f = ctx.createBiquadFilter();
			f.type = "bandpass";
			f.Q.value = 18;
			f.frequency.setValueAtTime(320, t);
			f.frequency.linearRampToValueAtTime(520, t + 1.2);
			f.frequency.linearRampToValueAtTime(380, t + 2.4);
			const wobble = ctx.createOscillator();
			const depth = ctx.createGain();
			wobble.frequency.value = 7;
			depth.gain.value = 60;
			wobble.connect(depth).connect(f.frequency);
			const g = ctx.createGain();
			g.gain.setValueAtTime(0.0001, t);
			g.gain.exponentialRampToValueAtTime(1.6, t + 0.4);
			g.gain.setValueAtTime(1.6, t + 1.8);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
			src.connect(f).connect(g).connect(out);
			src.start(t);
			wobble.start(t);
			src.stop(t + 2.55);
			wobble.stop(t + 2.55);
			return 2.5;
		},
		hang(out, t) {
			// The rope snaps tight, then the weight lands and the wood groans.
			hiss(out, t, { dur: 0.12, peak: 0.55, freq: 1800, to: 500, q: 2, attack: 0.001 });
			tone(out, t + 0.02, { freq: 110, to: 45, dur: 0.6, peak: 0.7, attack: 0.002 });
			hiss(out, t + 0.02, { dur: 0.4, peak: 0.35, filter: "lowpass", freq: 400, to: 120 });
			hiss(out, t + 0.35, { dur: 1.1, peak: 0.12, freq: 260, to: 200, q: 14, attack: 0.15 });
			return 1.5;
		},
	};

	// How loud each sound sits at volume 1, so the game's own volume values
	// (0.1 for the winch, 0.2 for the drop, and so on) still land at sensible levels.
	const LEVEL = { correct: 0.5, wrong: 5, win: 0.6, lose: 2.2, rotate: 4, pullup: 5, hang: 3 };

	// How long each sound runs, in seconds (what it schedules, plus its tail).
	const LENGTH = { correct: 0.45, wrong: 0.2, win: 1.3, lose: 2.5, rotate: 2.5, pullup: 2.55, hang: 1.5 };
	const RATE = 44100;

	// Each sound is rendered once, offline, into a buffer, and then played from it.
	// Building the graphs live costs real audio-thread time: a lost round stacks five
	// winch and rope sounds, a few hundred nodes and filters, which a slow phone (or a
	// busy machine) can't keep up with, and the high-priority audio thread then
	// starves the page. A buffer is one node however busy the round gets.
	const baked = {};
	const pending = {};
	const bake = (name) => {
		if (pending[name]) return pending[name];
		if (typeof OfflineAudioContext === "undefined") return (pending[name] = Promise.resolve(null));
		pending[name] = (async () => {
			const off = new OfflineAudioContext(1, Math.ceil((LENGTH[name] + 0.15) * RATE), RATE);
			const saved = [ctx, noiseBuffer];
			ctx = off;
			noiseBuffer = null;
			try {
				SOUNDS[name](off.destination, 0.01);
			} finally {
				[ctx, noiseBuffer] = saved;
			}
			const buffer = await off.startRendering();
			baked[name] = buffer;
			return buffer;
		})().catch(() => null);
		return pending[name];
	};
	// Render them all once the page has settled, so they are ready by the first guess.
	const bakeAll = () => Object.keys(SOUNDS).forEach(bake);
	if (window.requestIdleCallback) requestIdleCallback(bakeAll, { timeout: 2000 });
	else setTimeout(bakeAll, 500);

	const release = (name, entry) => {
		if (playing[name] === entry) delete playing[name];
		try {
			if (entry.source) entry.source.stop();
		} catch (e) {
			/* already stopped */
		}
		entry.gain.disconnect();
	};

	const stop = (name) => {
		const p = playing[name];
		if (!p) return;
		delete playing[name];
		const now = ctx.currentTime;
		p.gain.gain.cancelScheduledValues(now);
		p.gain.gain.setValueAtTime(p.gain.gain.value, now);
		p.gain.gain.linearRampToValueAtTime(0, now + 0.05);
		setTimeout(() => release(name, p), 120);
	};

	const play = (name, volume = 1) => {
		if (!SOUNDS[name]) return;
		const c = context();
		if (!c) return;
		if (c.state === "suspended") c.resume().catch(() => {});
		stop(name);
		const gain = c.createGain();
		gain.gain.value = Math.min(1, LEVEL[name] * volume);
		gain.connect(master);
		const entry = { gain, source: null };
		playing[name] = entry;
		const start = (buffer) => {
			if (playing[name] !== entry) return; // stopped before it was ready
			if (buffer) {
				const source = c.createBufferSource();
				source.buffer = buffer;
				source.connect(gain);
				source.onended = () => release(name, entry);
				source.start();
				entry.source = source;
			} else {
				// No offline rendering in this browser: build the sound live.
				SOUNDS[name](gain, c.currentTime + 0.01);
				setTimeout(() => release(name, entry), (LENGTH[name] + 0.3) * 1000);
			}
		};
		if (baked[name]) start(baked[name]);
		else bake(name).then(start);
	};

	const stopAll = () => Object.keys(playing).forEach(stop);

	// Plays one sound offline (no speakers) through the same level and compressor
	// as the game, and resolves to its samples, for checks.
	const render = async (name, volume = 1) => {
		const buffer = await bake(name);
		const off = new OfflineAudioContext(1, RATE * 3, RATE);
		const comp = off.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 4;
		comp.connect(off.destination);
		const gain = off.createGain();
		gain.gain.value = Math.min(1, LEVEL[name] * volume);
		gain.connect(comp);
		const source = off.createBufferSource();
		source.buffer = buffer;
		source.connect(gain);
		source.start(0);
		const out = await off.startRendering();
		return { length: LENGTH[name], samples: out.getChannelData(0) };
	};

	return { play, stop, stopAll, render, ready: () => Object.keys(baked).length, names: Object.keys(SOUNDS) };
})();
