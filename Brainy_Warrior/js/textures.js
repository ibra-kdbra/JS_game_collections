// Procedural textures, painted once on a canvas at start-up: nothing to
// download. One 512x512 atlas holds the four ground materials, so the whole
// island (tiles, cliffs, boulders and islets) is one material and one draw call.
import * as THREE from 'three';

export const ATLAS = { grass: 0, stone: 1, cliff: 2, sand: 3 };
const TILE = 256;
// Inset (in UV) that keeps mipmaps from bleeding between atlas tiles.
const INSET = 10 / 512;

/** UV rectangle [u0, v0, u1, v1] for an atlas tile (flipY is off: v0 is the top row). */
export function atlasRect(tile) {
    const x = (tile % 2) * 0.5;
    const y = Math.floor(tile / 2) * 0.5;
    return [x + INSET, y + INSET, x + 0.5 - INSET, y + 0.5 - INSET];
}

function rand(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Tileable value noise on a size x size grid, `oct` octaves, 0..1. */
function noiseField(size, cells, oct, seed) {
    const r = rand(seed);
    const out = new Float32Array(size * size);
    let amp = 1;
    let total = 0;
    for (let o = 0; o < oct; o++) {
        const n = cells << o;
        const g = new Float32Array(n * n).map(() => r());
        for (let y = 0; y < size; y++) {
            const fy = (y / size) * n;
            const y0 = Math.floor(fy);
            const ty = fy - y0;
            const sy = ty * ty * (3 - 2 * ty);
            for (let x = 0; x < size; x++) {
                const fx = (x / size) * n;
                const x0 = Math.floor(fx);
                const tx = fx - x0;
                const sx = tx * tx * (3 - 2 * tx);
                const a = g[(y0 % n) * n + (x0 % n)];
                const b = g[(y0 % n) * n + ((x0 + 1) % n)];
                const c = g[((y0 + 1) % n) * n + (x0 % n)];
                const d = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
                out[y * size + x] += amp * (a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy);
            }
        }
        total += amp;
        amp *= 0.5;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
}

function paint(ctx, ox, oy, fn) {
    const img = ctx.createImageData(TILE, TILE);
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const [r, g, b] = fn(x, y);
            const i = (y * TILE + x) * 4;
            img.data[i] = r;
            img.data[i + 1] = g;
            img.data[i + 2] = b;
            img.data[i + 3] = 255;
        }
    }
    ctx.putImageData(img, ox, oy);
}

const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

export function createGroundAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = TILE * 2;
    const ctx = canvas.getContext('2d');

    // Grass: two greens in soft patches, fine speckle, a few darker blades.
    const gn = noiseField(TILE, 4, 4, 1);
    const gs = noiseField(TILE, 32, 2, 2);
    paint(ctx, 0, 0, (x, y) => {
        const i = y * TILE + x;
        const base = mix3([70, 132, 50], [102, 156, 62], gn[i]);
        const s = (gs[i] - 0.5) * 34;
        return [base[0] + s * 0.6, base[1] + s, base[2] + s * 0.4];
    });
    const r = rand(3);
    ctx.lineCap = 'round';
    for (let k = 0; k < 900; k++) {
        const x = r() * TILE;
        const y = r() * TILE;
        const len = 3 + r() * 6;
        const a = -Math.PI / 2 + (r() - 0.5) * 1.2;
        ctx.strokeStyle = r() < 0.5 ? 'rgba(48,110,36,0.55)' : 'rgba(160,214,96,0.45)';
        ctx.lineWidth = 1 + r();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
    }

    // Stone flags: irregular slabs with dark mortar, for rock tiles.
    const sn = noiseField(TILE, 8, 4, 4);
    paint(ctx, TILE, 0, (x, y) => {
        const i = y * TILE + x;
        const v = 104 + (sn[i] - 0.5) * 64;
        return [v, v * 1.02, v * 1.06];
    });
    ctx.strokeStyle = 'rgba(40,42,48,0.75)';
    ctx.lineWidth = 3;
    const rs = rand(5);
    for (let row = 0; row < 4; row++) {
        const y = row * 64;
        ctx.beginPath();
        ctx.moveTo(TILE, y + rs() * 6);
        ctx.lineTo(TILE * 2, y + rs() * 6);
        ctx.stroke();
        for (let c = 0; c < 3; c++) {
            const x = TILE + ((c + (row % 2) * 0.5) * 256) / 3 + rs() * 12;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (rs() - 0.5) * 10, y + 64);
            ctx.stroke();
        }
    }

    // Cliff: layered earth and rock, horizontal strata with cracks.
    const cn = noiseField(TILE, 8, 5, 6);
    const cb = noiseField(TILE, 2, 3, 7);
    paint(ctx, 0, TILE, (x, y) => {
        const i = y * TILE + x;
        const band = Math.sin((y / TILE) * Math.PI * 10 + cb[i] * 6) * 0.5 + 0.5;
        const rock = mix3([112, 86, 62], [138, 124, 108], band);
        const d = (cn[i] - 0.5) * 60;
        return [rock[0] + d, rock[1] + d, rock[2] + d * 0.9];
    });
    ctx.strokeStyle = 'rgba(30,22,16,0.5)';
    ctx.lineWidth = 1.5;
    const rc = rand(8);
    for (let k = 0; k < 40; k++) {
        let x = rc() * TILE;
        let y = TILE + rc() * TILE;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 4; s++) {
            x += (rc() - 0.5) * 16;
            y += rc() * 14;
            ctx.lineTo(x, Math.min(TILE * 2, y));
        }
        ctx.stroke();
    }

    // Sand: warm, fine grain with soft ripples.
    const an = noiseField(TILE, 16, 3, 9);
    paint(ctx, TILE, TILE, (x, y) => {
        const i = y * TILE + x;
        const ripple = Math.sin(y * 0.35 + an[i] * 8) * 6;
        const d = (an[i] - 0.5) * 30 + ripple;
        return [228 + d, 204 + d, 150 + d * 0.8];
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = false;
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

/** Soft round dot for particles. */
export function dotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,0.85)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
}

/** Rune circle for the wizard's spots: rings, ticks and glyphs. */
export function runeTexture() {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    g.strokeStyle = 'white';
    g.fillStyle = 'white';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(0, 0, 118, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(0, 0, 96, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 52, 0, Math.PI * 2);
    g.stroke();
    // Glyphs between the outer rings.
    const r = rand(11);
    for (let k = 0; k < 12; k++) {
        g.save();
        g.rotate((k / 12) * Math.PI * 2);
        g.translate(0, -107);
        g.lineWidth = 3;
        g.beginPath();
        const n = 2 + Math.floor(r() * 3);
        for (let s = 0; s < n; s++) {
            g.moveTo((r() - 0.5) * 14, (r() - 0.5) * 12);
            g.lineTo((r() - 0.5) * 14, (r() - 0.5) * 12);
        }
        g.stroke();
        g.restore();
    }
    // A six-pointed star in the middle.
    g.lineWidth = 4;
    for (const off of [0, Math.PI / 3]) {
        g.beginPath();
        for (let k = 0; k <= 3; k++) {
            const a = off + (k / 3) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(a) * 88;
            const y = Math.sin(a) * 88;
            if (k) g.lineTo(x, y);
            else g.moveTo(x, y);
        }
        g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
}
