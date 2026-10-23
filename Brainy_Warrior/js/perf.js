// Adaptive quality and the developer perf overlay (?perf=1).
//
// Quality tiers trade sharpness for speed. The game starts at tier 0 on
// desktop and tier 1 on touch devices, watches the frame interval, and steps
// down a tier when frames stay slow; after a long run of smooth frames it
// tries one step back up (never above where it started). ?quality=0..3 pins a
// tier and turns adaptation off.
const params = new URLSearchParams(location.search);

export const TIERS = [
    // dynamicShadows: characters cast real shadows and the shadow map is redrawn
    // every frame. Otherwise only the island casts (boulders, palms), the map is
    // drawn once per level, and characters stand on soft blob shadows.
    { name: 'high', dpr: 2, shadow: 2048, soft: true, dynamicShadows: true, shadows: true, grass: 1, waterDetail: 1, water: 2 },
    { name: 'medium', dpr: 1.5, shadow: 1024, soft: false, dynamicShadows: false, shadows: true, grass: 1, waterDetail: 1, water: 1 },
    { name: 'low', dpr: 1, shadow: 1024, soft: false, dynamicShadows: false, shadows: true, grass: 0.6, waterDetail: 0.8, water: 0 },
    { name: 'lowest', dpr: 0.8, shadow: 512, soft: false, dynamicShadows: false, shadows: false, grass: 0.4, waterDetail: 0.6, water: 0 },
];

export class Quality {
    constructor({ coarse, onChange }) {
        this.onChange = onChange;
        const forced = params.get('quality');
        this.locked = forced !== null && forced !== '';
        this.start = this.locked ? Math.max(0, Math.min(3, Number(forced) | 0)) : coarse ? 1 : 0;
        this.tier = this.start;
        this.ema = 16.7;
        this.slowFor = 0;
        this.fastFor = 0;
        this.failedUp = 0;
        this.grace = 1.5; // seconds to ignore after a change or a level build
    }

    get settings() {
        return TIERS[this.tier];
    }

    /** Ignore the next moments (level builds and shader compiles stall a frame or two). */
    pause(seconds = 1.5) {
        this.grace = Math.max(this.grace, seconds);
    }

    /** Feed the real (unscaled) interval between frames, in ms. */
    sample(ms) {
        if (this.locked || document.hidden) return;
        const dt = ms / 1000;
        if (this.grace > 0) {
            this.grace -= dt;
            return;
        }
        if (ms > 250) return; // a tab switch or breakpoint, not a slow frame
        this.ema += (ms - this.ema) * 0.05;
        if (this.ema > 22) {
            this.slowFor += dt;
            this.fastFor = 0;
        } else if (this.ema < 17.8) {
            this.fastFor += dt;
            this.slowFor = 0;
        } else {
            this.slowFor = Math.max(0, this.slowFor - dt);
        }
        if (this.slowFor > 1.5 && this.tier < TIERS.length - 1) {
            if (this.justRaised) this.failedUp++;
            this.set(this.tier + 1);
        } else if (this.fastFor > 25 + this.failedUp * 30 && this.tier > this.start && this.failedUp < 3) {
            this.set(this.tier - 1);
            this.justRaised = true;
            return;
        }
        if (this.fastFor > 5) this.justRaised = false;
    }

    set(tier) {
        if (tier === this.tier) return;
        this.tier = tier;
        this.slowFor = this.fastFor = 0;
        this.ema = 16.7;
        this.pause(2);
        this.onChange?.(TIERS[tier], tier);
    }
}

/** A small fixed panel with live numbers, only when the URL has ?perf=1. */
export class PerfOverlay {
    static enabled() {
        return params.get('perf') === '1';
    }

    constructor(renderer, quality) {
        this.renderer = renderer;
        this.quality = quality;
        this.el = document.createElement('pre');
        this.el.className = 'perf-overlay';
        this.el.setAttribute('aria-hidden', 'true');
        document.body.append(this.el);
        this.frames = 0;
        this.intervals = 0;
        this.cpu = 0;
        this.worst = 0;
        this.last = performance.now();
        this.stats = {};
    }

    /** Call once per frame after rendering. */
    frame(intervalMs, cpuMs) {
        this.frames++;
        this.intervals += intervalMs;
        this.cpu += cpuMs;
        this.worst = Math.max(this.worst, intervalMs);
        const now = performance.now();
        if (now - this.last < 500) return;
        const info = this.renderer.info;
        const mem = performance.memory;
        const q = this.quality;
        const s = (this.stats = {
            fps: Math.round((this.frames * 1000) / (now - this.last)),
            frameMs: +(this.intervals / this.frames).toFixed(1),
            worstMs: +this.worst.toFixed(1),
            cpuMs: +(this.cpu / this.frames).toFixed(2),
            calls: info.render.calls,
            triangles: info.render.triangles,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length ?? 0,
            heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null,
            tier: q.settings.name,
            dpr: +this.renderer.getPixelRatio().toFixed(2),
        });
        this.el.textContent =
            `${s.fps} fps  ${s.frameMs} ms (worst ${s.worstMs})\n` +
            `cpu ${s.cpuMs} ms/frame\n` +
            `draw calls ${s.calls}  tris ${(s.triangles / 1000).toFixed(1)}k\n` +
            `geometries ${s.geometries}  textures ${s.textures}  programs ${s.programs}\n` +
            `heap ${s.heapMB ?? '-'} MB\n` +
            `quality ${s.tier}${q.locked ? ' (pinned)' : ''}  dpr ${s.dpr}`;
        this.frames = this.intervals = this.cpu = this.worst = 0;
        this.last = now;
    }
}
