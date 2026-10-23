// Visual effects: pooled particles, beams, tracers, shock rings and screen
// shake. Game logic calls the FX.* hooks; nothing here changes the game.
// Effects advance with game ticks (FX.tick), so they freeze while paused and
// run faster at 2x and 3x like everything else.

const FX = (() => {
    const TAU = Math.PI * 2;
    const rnd = Math.random;

    // Quality: 0 low, 1 medium, 2 high. Scales particle counts and caps.
    const LIMITS = [
        { particles: 160, mult: 0.3, beams: 40, rings: 24 },
        { particles: 380, mult: 0.6, beams: 80, rings: 48 },
        { particles: 800, mult: 1, beams: 140, rings: 80 }
    ];
    let quality = 2;
    let enabled = true;     // the "Explosion particles" setting

    // ---------- Pools ----------
    // Each pool keeps live items packed at the front: [0, n) are alive.

    function pool(make) {
        return { items: [], n: 0, make };
    }

    function take(p, cap) {
        if (p.n >= cap) return null;
        if (p.n === p.items.length) p.items.push(p.make());
        return p.items[p.n++];
    }

    function release(p, i) {
        const last = p.items[--p.n];
        p.items[p.n] = p.items[i];
        p.items[i] = last;
    }

    const particles = pool(() => ({ x: 0, y: 0, vx: 0, vy: 0, grav: 0, drag: 1, life: 0, max: 1, s0: 1, s1: 1, sprite: '', a0: 1, add: false, rot: 0, vr: 0, color: null, w: 0, h: 0 }));
    const beams = pool(() => ({ kind: '', x1: 0, y1: 0, x2: 0, y2: 0, tower: null, target: null, life: 0, max: 1, w: 1, pts: null, seed: 0 }));
    const rings = pool(() => ({ x: 0, y: 0, r0: 0, r1: 1, life: 0, max: 1, sprite: '', a0: 1 }));

    let shakeMag = 0;
    let shakeOn = true;
    let gateHit = 0;        // ticks left of the exit gate flash
    let ticks = 0;          // ticks since start, drives cheap animation

    function setQuality(q) {
        quality = Math.max(0, Math.min(2, q));
        const cap = LIMITS[quality].particles;
        while (particles.n > cap) release(particles, particles.n - 1);
    }

    // Tile size in pixels (logic units), read from the game
    const T = () => ts;
    const count = (n) => Math.max(1, Math.round(n * LIMITS[quality].mult));

    function spawnParticle(x, y, o) {
        const p = take(particles, LIMITS[quality].particles);
        if (!p) return null;
        p.x = x;
        p.y = y;
        p.vx = o.vx || 0;
        p.vy = o.vy || 0;
        p.grav = o.grav || 0;
        p.drag = o.drag === undefined ? 0.92 : o.drag;
        p.max = p.life = Math.max(1, o.life || 20);
        p.s0 = o.s0 === undefined ? 1 : o.s0;
        p.s1 = o.s1 === undefined ? p.s0 : o.s1;
        p.sprite = o.sprite || 'glow_white';
        p.a0 = o.a === undefined ? 1 : o.a;
        p.add = !!o.add;
        p.rot = o.rot || 0;
        p.vr = o.vr || 0;
        p.color = o.color || null;
        p.w = o.w || 0;
        p.h = o.h || 0;
        return p;
    }

    // Burst of glowing sparks
    function sparks(x, y, n, sprite, speed, size, life, add = true) {
        if (!enabled) return;
        const t = T();
        for (let i = 0; i < n; i++) {
            const a = rnd() * TAU;
            const v = (0.3 + rnd() * 0.7) * speed * t;
            spawnParticle(x, y, {
                vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.88,
                life: life * (0.6 + rnd() * 0.6), s0: size * (0.6 + rnd() * 0.6), s1: 0,
                sprite, add
            });
        }
    }

    // Square chips that tumble out and fade (debris)
    function debris(x, y, n, colors, speed, size) {
        if (!enabled) return;
        const t = T();
        for (let i = 0; i < n; i++) {
            const a = rnd() * TAU;
            const v = (0.4 + rnd() * 0.6) * speed * t;
            spawnParticle(x, y, {
                vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 0.86,
                life: 22 + rnd() * 18, rot: rnd() * TAU, vr: (rnd() - 0.5) * 0.5,
                color: colors[i % colors.length], w: size * t * (0.5 + rnd() * 0.7), h: size * t * (0.4 + rnd() * 0.5)
            });
        }
    }

    function smoke(x, y, n, size, life, spread = 0.03) {
        if (!enabled) return;
        const t = T();
        for (let i = 0; i < n; i++) {
            const a = rnd() * TAU;
            const v = rnd() * spread * t;
            spawnParticle(x, y, {
                vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.01 * t, drag: 0.94,
                life: life * (0.7 + rnd() * 0.6), s0: size * 0.6, s1: size * (1.2 + rnd() * 0.6),
                sprite: 'smoke', a: 0.55
            });
        }
    }

    function ring(x, y, r0, r1, life, sprite, a = 1) {
        const r = take(rings, LIMITS[quality].rings);
        if (!r) return;
        r.x = x;
        r.y = y;
        r.r0 = r0;
        r.r1 = r1;
        r.life = r.max = life;
        r.sprite = sprite;
        r.a0 = a;
    }

    function beam(kind, o) {
        const b = take(beams, LIMITS[quality].beams);
        if (!b) return null;
        b.kind = kind;
        b.x1 = o.x1 || 0;
        b.y1 = o.y1 || 0;
        b.x2 = o.x2 || 0;
        b.y2 = o.y2 || 0;
        b.tower = o.tower || null;
        b.target = o.target || null;
        b.life = b.max = o.life || 4;
        b.w = o.w || 1;
        b.pts = o.pts || null;
        b.seed = rnd();
        return b;
    }

    // Muzzle position of a tower in world pixels (barrel index i)
    function muzzle(t, i = 0) {
        const art = Art.TOWER_ART[t.name];
        const m = art && art.muzzle.length ? art.muzzle[i % art.muzzle.length] : [0.4, 0];
        const k = Art.TURRET_SCALE * T();
        const c = Math.cos(t.angle);
        const s = Math.sin(t.angle);
        const rx = m[0] * k - (t._recoil || 0) * 0.1 * T();
        return { x: t.pos.x + c * rx - s * m[1] * k, y: t.pos.y + s * rx + c * m[1] * k };
    }

    // Jagged lightning between two points, offsets stored relative to the line
    function bolt(n, jitter) {
        const pts = new Float32Array(n + 1);
        for (let i = 1; i < n; i++) pts[i] = (rnd() - 0.5) * jitter;
        return pts;
    }

    // ---------- Hooks called by the game ----------

    // A tower fired at enemy e
    function fire(t, e) {
        t._recoil = 1;
        const barrel = t._barrel = ((t._barrel || 0) + 1) % 4;
        const m = muzzle(t, barrel);
        const ts_ = T();
        switch (t.name) {
            case 'gun':
            case 'machineGun': {
                t._flash = 3;
                beam('tracer', { x1: m.x, y1: m.y, x2: e.pos.x, y2: e.pos.y, life: 4, w: t.name === 'gun' ? 1 : 0.8 });
                if (rnd() < 0.5) sparks(e.pos.x, e.pos.y, count(2), 'glow_yellow', 0.05, 0.25, 8);
                break;
            }
            case 'laser':
            case 'beamEmitter': {
                // Continuous beam: refresh the one this tower already has
                if (!t._beam || t._beam.tower !== t || t._beam.life <= 0) {
                    t._beam = beam(t.name === 'laser' ? 'laser' : 'emitter', { tower: t, target: e, life: 3 });
                } else {
                    t._beam.target = e;
                    t._beam.life = t._beam.max;
                }
                if (t.name === 'beamEmitter' && t._beam) t._beam.w = Math.min(3, 1 + (t.duration || 0) / 40);
                if ((ticks & 7) === 0) sparks(e.pos.x, e.pos.y, count(1), t.name === 'laser' ? 'glow_blue' : 'glow_cyan', 0.04, 0.3, 8);
                break;
            }
            case 'sniper':
                t._flash = 5;
                beam('snipe', { x1: m.x, y1: m.y, x2: e.pos.x, y2: e.pos.y, life: 10, w: 1 });
                sparks(e.pos.x, e.pos.y, count(5), 'glow_red', 0.08, 0.3, 12);
                break;
            case 'railgun':
                t._flash = 6;
                beam('rail', { x1: m.x, y1: m.y, x2: e.pos.x, y2: e.pos.y, life: 14, w: 1 });
                shake(0.12);
                break;
            case 'bomb':
            case 'clusterBomb':
                t._flash = 4;
                smoke(m.x, m.y, count(2), 0.35, 18);
                beam('shell', { x1: m.x, y1: m.y, x2: e.pos.x, y2: e.pos.y, life: 6, w: 1 });
                break;
            case 'tesla':
            case 'lightningStrike': {
                const n = 9;
                const top = { x: t.pos.x, y: t.pos.y - ts_ * 0.12 };
                beam('bolt', { x1: top.x, y1: top.y, x2: e.pos.x, y2: e.pos.y, life: 9, w: t.name === 'tesla' ? 1 : 1.5, pts: bolt(n, ts_ * 0.35) });
                beam('bolt', { x1: top.x, y1: top.y, x2: e.pos.x, y2: e.pos.y, life: 6, w: 0.6, pts: bolt(n, ts_ * 0.5) });
                sparks(e.pos.x, e.pos.y, count(6), t.name === 'tesla' ? 'glow_yellow' : 'glow_cyan', 0.1, 0.35, 12);
                ring(e.pos.x, e.pos.y, ts_ * 0.1, ts_ * 0.5, 10, t.name === 'tesla' ? 'ring_yellow' : 'ring_cyan', 0.9);
                t._flash = 6;
                break;
            }
        }
    }

    // A rocket tower launched a missile
    function launch(t) {
        t._recoil = 1;
        const m = muzzle(t, t._barrel = ((t._barrel || 0) + 1) % 4);
        smoke(m.x, m.y, count(3), 0.35, 20, 0.05);
        sparks(m.x, m.y, count(3), 'glow_orange', 0.05, 0.3, 8);
    }

    // Smoke trail behind a flying missile (called every tick)
    function trail(p) {
        if (!enabled || (ticks + (p._id || 0)) % (quality === 2 ? 1 : quality === 1 ? 2 : 3)) return;
        const a = Math.atan2(p.vel.y, p.vel.x);
        const x = p.pos.x - Math.cos(a) * T() * 0.2;
        const y = p.pos.y - Math.sin(a) * T() * 0.2;
        spawnParticle(x, y, { life: 22, s0: 0.18, s1: 0.45, sprite: 'smoke', a: 0.45, drag: 0.9, vx: (rnd() - 0.5) * 0.02 * T(), vy: (rnd() - 0.5) * 0.02 * T() });
        spawnParticle(x, y, { life: 5, s0: 0.28, s1: 0.05, sprite: p.blastRadius > 1 ? 'glow_cyan' : 'glow_orange', add: true });
    }

    // Slow and poison towers: an expanding ring now and then while active
    function pulse(t) {
        const poison = t.name === 'poison';
        if (!poison) {
            if ((t._pulse = (t._pulse || 0) - 1) > 0) return;
            t._pulse = 36;
        }
        const r = (t.range + 1) * T();
        ring(t.pos.x, t.pos.y, T() * 0.3, r, poison ? 30 : 26, poison ? 'ring_green' : 'ring_ice', poison ? 0.9 : 0.7);
        if (!enabled) return;
        const n = count(poison ? 14 : 6);
        for (let i = 0; i < n; i++) {
            const a = rnd() * TAU;
            const d = (0.3 + rnd() * 0.7) * r;
            spawnParticle(t.pos.x + Math.cos(a) * d, t.pos.y + Math.sin(a) * d, poison
                ? { sprite: 'bubble', life: 26 + rnd() * 14, s0: 0.8, s1: 1.2, vy: -0.012 * T(), drag: 0.98, a: 0.9 }
                : { sprite: 'snow', life: 24 + rnd() * 10, s0: 1, s1: 0.4, vx: Math.cos(a) * 0.01 * T(), vy: Math.sin(a) * 0.01 * T(), drag: 0.97, rot: rnd() * TAU, vr: 0.05 });
        }
    }

    // Explosions: rocket, silo, bomb, cluster, rail
    function blast(x, y, kind, radiusTiles = 1) {
        const t = T();
        const r = (radiusTiles + 0.5) * t;
        const big = kind === 'silo' || kind === 'cluster';
        const glow = { rocket: 'glow_orange', silo: 'glow_cyan', bomb: 'glow_purple', cluster: 'glow_orange', sub: 'glow_orange', rail: 'glow_purple' }[kind] || 'glow_orange';
        const ringS = { rocket: 'ring_orange', silo: 'ring_cyan', bomb: 'ring_purple', cluster: 'ring_orange', sub: 'ring_orange', rail: 'ring_purple' }[kind] || 'ring_orange';
        ring(x, y, t * 0.2, r, 14, ringS, 0.9);
        spawnParticle(x, y, { life: 10, s0: r / t * 1.4, s1: r / t * 0.6, sprite: glow, add: true, a: 0.9, drag: 1 });
        spawnParticle(x, y, { life: 6, s0: r / t * 0.8, s1: 0.2, sprite: 'glow_white', add: true, drag: 1 });
        if (enabled) {
            sparks(x, y, count(big ? 16 : 10), glow, 0.14, 0.35, 16);
            smoke(x, y, count(big ? 6 : 4), Math.min(1.6, r / t * 0.7), 30, 0.05);
            if (kind !== 'rail') debris(x, y, count(5), ['#3b3430', '#5a4d44', '#2a2523'], 0.09, 0.08);
        }
        shake(kind === 'sub' ? 0.08 : big ? 0.3 : 0.18);
    }

    // An enemy died
    function death(e) {
        const t = T();
        const art = Art.ENEMY_ART[e.name];
        const boss = art && art.boss;
        const col = art ? art.color : '#cccccc';
        ring(e.pos.x, e.pos.y, t * 0.1, t * (boss ? 1.6 : 0.6), boss ? 22 : 12, 'ring_white', boss ? 1 : 0.6);
        if (enabled) {
            debris(e.pos.x, e.pos.y, count(boss ? 16 : 6), [col, '#14161c', col], boss ? 0.14 : 0.08, boss ? 0.14 : 0.09);
            sparks(e.pos.x, e.pos.y, count(boss ? 14 : 4), 'glow_white', 0.08, 0.3, 12);
        }
        if (boss) {
            spawnParticle(e.pos.x, e.pos.y, { life: 16, s0: 3, s1: 1, sprite: e.name === 'taunt' ? 'glow_purple' : 'glow_yellow', add: true, drag: 1 });
            shake(0.5);
            buzz([30, 40, 60]);
        }
    }

    // Healing sparkles from a medic, status bubbles and snow on enemies
    function status(e) {
        if (!enabled || quality === 0) return;
        if ((ticks + (e._id || 0)) % (quality === 2 ? 12 : 24)) return;
        const t = T();
        const efx = e.effects;
        for (let i = 0; i < efx.length; i++) {
            const name = efx[i].name;
            const ox = (rnd() - 0.5) * t * 0.4;
            if (name === 'poison') spawnParticle(e.pos.x + ox, e.pos.y, { sprite: 'bubble', life: 20, s0: 0.6, s1: 1, vy: -0.02 * t, drag: 0.97 });
            else if (name === 'slow') spawnParticle(e.pos.x + ox, e.pos.y, { sprite: 'snow', life: 18, s0: 0.8, s1: 0.3, vy: 0.008 * t, rot: rnd() * TAU, vr: 0.08, drag: 0.98 });
            else if (name === 'regen' && rnd() < 0.35) spawnParticle(e.pos.x + ox, e.pos.y - t * 0.2, { sprite: 'plus', life: 22, s0: 0.9, s1: 0.5, vy: -0.015 * t, drag: 0.98 });
        }
    }

    function leak() {
        gateHit = 24;
        shake(0.35);
        buzz(60);
    }

    function shake(m) {
        if (!shakeOn) return;
        shakeMag = Math.min(1, shakeMag + m);
    }

    function buzz(pattern) {
        if (typeof haptics !== 'undefined' && !haptics) return;
        if (typeof lastPointer !== 'undefined' && lastPointer === 'mouse') return;
        if (navigator.vibrate) {
            try { navigator.vibrate(pattern); } catch (err) { /* not allowed */ }
        }
    }

    // ---------- Simulation ----------

    function tick() {
        ticks++;
        if (gateHit > 0) gateHit--;
        for (let i = particles.n - 1; i >= 0; i--) {
            const p = particles.items[i];
            if (--p.life <= 0) {
                release(particles, i);
                continue;
            }
            p.vx *= p.drag;
            p.vy = p.vy * p.drag + p.grav;
            p.x += p.vx;
            p.y += p.vy;
            p.rot += p.vr;
        }
        for (let i = beams.n - 1; i >= 0; i--) {
            const b = beams.items[i];
            if (--b.life <= 0) {
                if (b.tower && b.tower._beam === b) b.tower._beam = null;
                b.tower = b.target = null;
                release(beams, i);
            }
        }
        for (let i = rings.n - 1; i >= 0; i--) {
            if (--rings.items[i].life <= 0) release(rings, i);
        }
    }

    // Per frame: tower recoil and flash timers, shake decay (real time)
    function frame(stepped) {
        shakeMag *= 0.88;
        if (shakeMag < 0.01) shakeMag = 0;
        if (!stepped) return;
        for (let i = 0; i < towers.length; i++) {
            const t = towers[i];
            if (t._recoil) t._recoil = Math.max(0, t._recoil - 0.18 * stepped);
            if (t._flash) t._flash = Math.max(0, t._flash - stepped);
        }
    }

    function clear() {
        while (particles.n) release(particles, particles.n - 1);
        while (beams.n) {
            const b = beams.items[beams.n - 1];
            b.tower = b.target = null;
            release(beams, beams.n - 1);
        }
        while (rings.n) release(rings, rings.n - 1);
        shakeMag = 0;
        gateHit = 0;
    }

    return {
        fire, launch, trail, pulse, blast, death, status, leak, shake, buzz, tick, frame, clear, setQuality,
        muzzle,
        get quality() { return quality; },
        get enabled() { return enabled; },
        set enabled(v) { enabled = v; if (!v) while (particles.n) release(particles, particles.n - 1); },
        set shakeOn(v) { shakeOn = v; if (!v) shakeMag = 0; },
        get shakeMag() { return shakeMag; },
        get gateHit() { return gateHit; },
        get ticks() { return ticks; },
        particles, beams, rings, LIMITS
    };
})();
