// The island for one level, built as few meshes as possible:
//  * terrain: tile caps, the earth under them, rocky cliffs, a sand skirt at
//    the waterline, boulders and shrubs on rock tiles, and decorative islets
//    off the coast, merged into ONE mesh with one material (the ground atlas);
//  * grass tufts and flowers: two instanced meshes that sway in the wind;
//  * palm trees on the islets: one instanced mesh.
// Everything is generated from the level map with a seeded RNG, so a level
// always looks the same. dispose() frees it all on level change.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { SEA, WALL, tileAt } from './rules.js';
import { ATLAS, atlasRect } from './textures.js';
import { lin } from './color.js';

export const WATER_Y = -0.5;
const CAP_TOP = 0;
const BODY_TOP = -0.13;
const CLIFF_BOTTOM = WATER_Y - 0.5;

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), a | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const hashStr = (s) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** Smooth 3D value noise, about -1..1 (for cliff and boulder shapes). */
function noise3(x, y, z) {
    const h = (i, j, k) => {
        let n = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        return ((n ^ (n >>> 16)) & 0xffff) / 32767.5 - 1;
    };
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const f = (t) => t * t * (3 - 2 * t);
    const u = f(x - xi);
    const v = f(y - yi);
    const w = f(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(
        l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
        l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
        w,
    );
}

/** Accumulates triangles with position, normal, uv and colour. */
class Builder {
    constructor() {
        this.pos = [];
        this.nor = [];
        this.uv = [];
        this.col = [];
        this.idx = [];
    }

    vert(p, n, uv, c) {
        this.pos.push(p[0], p[1], p[2]);
        this.nor.push(n[0], n[1], n[2]);
        this.uv.push(uv[0], uv[1]);
        this.col.push(lin(c[0]), lin(c[1]), lin(c[2]));
        return this.pos.length / 3 - 1;
    }

    /** Add a triangle, wound so its face agrees with the vertex normals. */
    tri(a, b, c) {
        const P = this.pos;
        const N = this.nor;
        const ux = P[b * 3] - P[a * 3];
        const uy = P[b * 3 + 1] - P[a * 3 + 1];
        const uz = P[b * 3 + 2] - P[a * 3 + 2];
        const vx = P[c * 3] - P[a * 3];
        const vy = P[c * 3 + 1] - P[a * 3 + 1];
        const vz = P[c * 3 + 2] - P[a * 3 + 2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const dot = nx * (N[a * 3] + N[b * 3] + N[c * 3]) + ny * (N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1]) + nz * (N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2]);
        if (dot < 0) this.idx.push(a, c, b);
        else this.idx.push(a, b, c);
    }

    /** Add a geometry (indexed or not) transformed by `m`, with a colour function. */
    addGeometry(geo, m, color, uvRect) {
        const p = geo.attributes.position;
        const n = geo.attributes.normal;
        const base = this.pos.length / 3;
        const v = new THREE.Vector3();
        const nm = new THREE.Matrix3().getNormalMatrix(m);
        const nn = new THREE.Vector3();
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i);
            nn.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
            const local = [v.x, v.y, v.z];
            v.applyMatrix4(m);
            const c = color(local, nn, v);
            const u = uvRect[0] + (local[0] * 0.5 + 0.5) * (uvRect[2] - uvRect[0]);
            const w = uvRect[1] + (local[2] * 0.5 + 0.5) * (uvRect[3] - uvRect[1]);
            this.vert([v.x, v.y, v.z], [nn.x, nn.y, nn.z], [u, w], c);
        }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) this.idx.push(base + geo.index.getX(i));
        else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    }

    build() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setIndex(this.pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
        g.computeBoundingSphere();
        return g;
    }
}

// ------------------------------------------------------- shared templates --
let templates = null;

function boulderGeometry(seed, detail) {
    let g = new THREE.IcosahedronGeometry(0.5, detail);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const d = 1 + noise3(v.x * 2.2 + seed * 7, v.y * 2.2, v.z * 2.2 + seed) * 0.22 + noise3(v.x * 6 + seed, v.y * 6, v.z * 6) * 0.06;
        v.multiplyScalar(d);
        if (v.y < -0.12) v.y = -0.12 + (v.y + 0.12) * 0.25; // flat-ish bottom
        p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
}

/** A tuft of grass blades (tapered, bent), coloured dark at the root. */
function tuftGeometry() {
    const pos = [];
    const col = [];
    const r = rng(42);
    for (let k = 0; k < 6; k++) {
        const a = r() * Math.PI * 2;
        const h = 0.1 + r() * 0.09;
        const lean = 0.03 + r() * 0.04;
        const ox = Math.cos(a) * 0.03;
        const oz = Math.sin(a) * 0.03;
        const w = 0.016;
        const px = -Math.sin(a) * w;
        const pz = Math.cos(a) * w;
        const tip = [ox + Math.cos(a) * lean, h, oz + Math.sin(a) * lean];
        pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, ...tip);
        col.push(0.2, 0.42, 0.12, 0.2, 0.42, 0.12, 0.62, 0.86, 0.36);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col.map(lin), 3));
    g.computeVertexNormals();
    // Grass is lit as if it faced up, so blades don't flicker dark/light.
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
}

/** A flower: stem plus a five-petal head. White petals, tinted per instance. */
function flowerGeometry() {
    const pos = [];
    const col = [];
    const h = 0.13;
    pos.push(-0.005, 0, 0, 0.005, 0, 0, 0, h, 0);
    col.push(0.25, 0.5, 0.15, 0.25, 0.5, 0.15, 0.3, 0.6, 0.2);
    for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const b = a + 0.9;
        pos.push(0, h + 0.005, 0, Math.cos(a) * 0.035, h, Math.sin(a) * 0.035, Math.cos(b) * 0.035, h, Math.sin(b) * 0.035);
        col.push(1, 0.95, 0.6, 1, 1, 1, 1, 1, 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col.map(lin), 3));
    const n = new Float32Array(pos.length);
    for (let i = 1; i < n.length; i += 3) n[i] = 1;
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    return g;
}

/** A palm tree: a curved trunk of rings and drooping fronds, vertex coloured. */
function palmGeometry() {
    const b = new Builder();
    const segs = 7;
    const sides = 6;
    const ring = [];
    const H = 1.5;
    const spine = (t) => [Math.sin(t * 1.3) * 0.32, t * H, 0];
    for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const [cx, cy, cz] = spine(t);
        const r = 0.07 * (1 - t * 0.45);
        const row = [];
        for (let k = 0; k < sides; k++) {
            const a = (k / sides) * Math.PI * 2;
            const nx = Math.cos(a);
            const nz = Math.sin(a);
            const shade = s % 2 ? 0.42 : 0.5;
            row.push(b.vert([cx + nx * r, cy, cz + nz * r], [nx, 0.2, nz], [0, 0], [shade, shade * 0.72, shade * 0.48]));
        }
        ring.push(row);
    }
    for (let s = 0; s < segs; s++) {
        for (let k = 0; k < sides; k++) {
            const k2 = (k + 1) % sides;
            b.tri(ring[s][k], ring[s + 1][k], ring[s][k2]);
            b.tri(ring[s][k2], ring[s + 1][k], ring[s + 1][k2]);
        }
    }
    // Fronds: each a strip that arcs out and droops, with a centre fold.
    const top = spine(1);
    const fronds = 8;
    for (let f = 0; f < fronds; f++) {
        const a = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
        const dx = Math.cos(a);
        const dz = Math.sin(a);
        const px = -dz;
        const pz = dx;
        const L = 0.75 + (f % 3) * 0.1;
        const steps = 5;
        let prev = null;
        for (let s = 0; s <= steps; s++) {
            const t = s / steps;
            const d = t * L;
            const y = top[1] + 0.12 * Math.sin(t * Math.PI * 0.8) - t * t * 0.45;
            const w = 0.16 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
            const c = [0.18 + t * 0.12, 0.45 + t * 0.12, 0.14];
            const mid = [top[0] + dx * d, y + 0.03, top[2] + dz * d];
            const l = [mid[0] + px * w, y - 0.04, mid[2] + pz * w];
            const r = [mid[0] - px * w, y - 0.04, mid[2] - pz * w];
            const cur = [b.vert(l, [0, 1, 0], [0, 0], c), b.vert(mid, [0, 1, 0], [0, 0], [c[0] * 1.2, c[1] * 1.15, c[2]]), b.vert(r, [0, 1, 0], [0, 0], c)];
            if (prev) {
                b.tri(prev[0], cur[0], prev[1]);
                b.tri(prev[1], cur[0], cur[1]);
                b.tri(prev[1], cur[1], prev[2]);
                b.tri(prev[2], cur[1], cur[2]);
            }
            prev = cur;
        }
    }
    // Coconuts.
    const nut = new THREE.IcosahedronGeometry(0.055, 0);
    for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        const m = new THREE.Matrix4().makeTranslation(top[0] + Math.cos(a) * 0.07, top[1] - 0.07, top[2] + Math.sin(a) * 0.07);
        b.addGeometry(nut, m, () => [0.35, 0.24, 0.12], [0, 0, 0, 0]);
    }
    const g = b.build();
    g.computeVertexNormals();
    return g;
}

function getTemplates() {
    if (!templates) {
        templates = {
            boulders: [0, 1, 2, 3].map((s) => boulderGeometry(s + 1, 2)),
            pebbles: [0, 1].map((s) => boulderGeometry(s + 11, 1)),
            bush: new THREE.IcosahedronGeometry(0.5, 1),
            tuft: tuftGeometry(),
            flower: flowerGeometry(),
            palm: palmGeometry(),
        };
    }
    return templates;
}

// -------------------------------------------------------------- shaders --
/** Adds a wind sway to an instanced, vertex-coloured material (grass, flowers, palms). */
export function windMaterial(uniforms, { strength = 1, side = THREE.DoubleSide } = {}) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side });
    m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
                float sway = sin(uTime * 1.7 + ip.x * 1.3 + ip.z * 0.9) * 0.6 + sin(uTime * 3.1 + ip.x * 2.7) * 0.25;
                transformed.x += sway * ${(0.08 * strength).toFixed(3)} * position.y * position.y * 4.0;
                transformed.z += sway * ${(0.04 * strength).toFixed(3)} * position.y * position.y * 4.0;`,
            );
    };
    m.customProgramCacheKey = () => `wind${strength}`;
    return m;
}

// ---------------------------------------------------------------- build --
/**
 * Build the island for `level`. `world(x, z, y)` maps tile coordinates to
 * scene coordinates. Returns { group, dispose, stats }.
 */
export function buildIsland(level, world, { groundMaterial, windUniforms, quality = 1 }) {
    const T = getTemplates();
    const r = rng(hashStr(level.id || level.name));
    const group = new THREE.Group();
    const b = new Builder();
    const land = (x, z) => tileAt(level, x, z) !== SEA;
    const grassR = atlasRect(ATLAS.grass);
    const stoneR = atlasRect(ATLAS.stone);
    // Boulders sample a patch of the stone texture between the mortar lines.
    const boulderR = [0.5 + 12 / 512, 10 / 512, 0.5 + 70 / 512, 56 / 512];
    const cliffR = atlasRect(ATLAS.cliff);
    const sandR = atlasRect(ATLAS.sand);
    const lerpUV = (R, u, v) => [R[0] + (R[2] - R[0]) * u, R[1] + (R[3] - R[1]) * v];
    const tiles = [];
    for (let z = 0; z < level.height; z++) for (let x = 0; x < level.width; x++) if (land(x, z)) tiles.push({ x, z, rock: tileAt(level, x, z) === WALL });

    // Tile caps: bevelled slabs, grass or stone, each with its own tint and a
    // random quarter-turn of the texture so the grid doesn't repeat.
    for (const { x, z, rock } of tiles) {
        const c = world(x, z);
        const R = rock ? stoneR : grassR;
        const checker = (x + z) % 2 ? 1.0 : 0.9;
        const tint = checker * (0.94 + r() * 0.1);
        const base = rock ? [0.92 * tint, 0.92 * tint, 0.95 * tint] : [tint, tint * 1.02, tint * 0.95];
        const rot = Math.floor(r() * 4);
        const uvOf = (lx, lz) => {
            let u = lx + 0.5;
            let v = lz + 0.5;
            for (let k = 0; k < rot; k++) [u, v] = [v, 1 - u];
            return lerpUV(R, u, v);
        };
        const a = 0.43;
        const o = 0.485;
        const yb = CAP_TOP - 0.05;
        const ys = CAP_TOP - 0.17;
        const top = [
            [-a, -a],
            [a, -a],
            [a, a],
            [-a, a],
        ];
        const ti = top.map(([lx, lz]) => b.vert([c.x + lx, CAP_TOP, c.z + lz], [0, 1, 0], uvOf(lx, lz), base));
        b.tri(ti[0], ti[3], ti[2]);
        b.tri(ti[0], ti[2], ti[1]);
        // Bevel ring and short sides, per edge (flat normals per face).
        const edges = [
            [0, 1, [0, -1]],
            [1, 2, [1, 0]],
            [2, 3, [0, 1]],
            [3, 0, [-1, 0]],
        ];
        const dark = base.map((v) => v * 0.78);
        const side = base.map((v) => v * 0.55);
        for (const [i, j, [nx, nz]] of edges) {
            const [ax, az] = top[i];
            const [bx, bz] = top[j];
            const ox = (v) => (v > 0 ? o : -o);
            const n = new THREE.Vector3(nx, 1.1, nz).normalize();
            const p0 = [c.x + ax, CAP_TOP, c.z + az];
            const p1 = [c.x + bx, CAP_TOP, c.z + bz];
            const p2 = [c.x + ox(bx), yb, c.z + ox(bz)];
            const p3 = [c.x + ox(ax), yb, c.z + ox(az)];
            const q = [p0, p1, p2, p3].map((p) => b.vert(p, [n.x, n.y, n.z], uvOf(p[0] - c.x, p[2] - c.z), dark));
            b.tri(q[0], q[2], q[1]);
            b.tri(q[0], q[3], q[2]);
            const s0 = [p3[0], ys, p3[2]];
            const s1 = [p2[0], ys, p2[2]];
            const sq = [p3, p2, s1, s0].map((p, k) => b.vert(p, [nx, 0, nz], lerpUV(cliffR, k === 1 || k === 2 ? 0.2 : 0, k >= 2 ? 0.1 : 0), side));
            b.tri(sq[0], sq[2], sq[1]);
            b.tri(sq[0], sq[3], sq[2]);
        }
    }

    // The earth under the caps (seen in the grooves between tiles).
    for (const { x, z } of tiles) {
        const c = world(x, z);
        const col = [0.45, 0.34, 0.22];
        const q = [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
        ].map(([lx, lz]) => b.vert([c.x + lx, BODY_TOP, c.z + lz], [0, 1, 0], lerpUV(cliffR, 0.5 + lx * 0.2, 0.05), col));
        b.tri(q[0], q[3], q[2]);
        b.tri(q[0], q[2], q[1]);
    }

    // Cliffs on every side that faces the sea: a rocky wall pushed in and out
    // by noise (zero at the tile corners so neighbours meet), green at the lip,
    // dark and wet at the waterline; then a sand skirt sloping under the water.
    const NU = 4;
    const NV = 5;
    const sides = [
        { dx: 0, dz: -1, a: [-0.5, -0.5], b: [0.5, -0.5] },
        { dx: 1, dz: 0, a: [0.5, -0.5], b: [0.5, 0.5] },
        { dx: 0, dz: 1, a: [0.5, 0.5], b: [-0.5, 0.5] },
        { dx: -1, dz: 0, a: [-0.5, 0.5], b: [-0.5, -0.5] },
    ];
    for (const { x, z } of tiles) {
        const c = world(x, z);
        for (const s of sides) {
            if (land(x + s.dx, z + s.dz)) continue;
            const grid = [];
            for (let j = 0; j <= NV; j++) {
                const t = j / NV;
                const y = BODY_TOP + (CLIFF_BOTTOM - BODY_TOP) * t;
                const row = [];
                for (let i = 0; i <= NU; i++) {
                    const u = i / NU;
                    const px = c.x + s.a[0] + (s.b[0] - s.a[0]) * u;
                    const pz = c.z + s.a[1] + (s.b[1] - s.a[1]) * u;
                    const fall = Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.min(1, t * 3));
                    const d = (noise3(px * 2.3, y * 3.1, pz * 2.3) * 0.11 + noise3(px * 6, y * 7, pz * 6) * 0.035) * fall + 0.02 * fall;
                    const lip = t < 0.12;
                    const wet = Math.max(0, (t - 0.55) / 0.45);
                    const shade = (0.95 - wet * 0.45) * (0.9 + noise3(px * 9, y * 9, pz * 9) * 0.1);
                    const col = lip ? [0.45, 0.62, 0.3] : [shade, shade * 0.97, shade * 0.93];
                    row.push({ p: [px + s.dx * d, y, pz + s.dz * d], uv: lerpUV(cliffR, u, Math.min(1, t * 1.1)), col });
                }
                grid.push(row);
            }
            // Indices with normals from the displaced grid.
            const ids = grid.map((row, j) =>
                row.map((v, i) => {
                    const l = row[Math.max(0, i - 1)].p;
                    const rr = row[Math.min(NU, i + 1)].p;
                    const up = grid[Math.max(0, j - 1)][i].p;
                    const dn = grid[Math.min(NV, j + 1)][i].p;
                    const tu = new THREE.Vector3(rr[0] - l[0], rr[1] - l[1], rr[2] - l[2]);
                    const tv = new THREE.Vector3(dn[0] - up[0], dn[1] - up[1], dn[2] - up[2]);
                    const n = tv.cross(tu).normalize();
                    if (n.x * s.dx + n.z * s.dz < 0) n.negate();
                    return b.vert(v.p, [n.x, n.y, n.z], v.uv, v.col);
                }),
            );
            for (let j = 0; j < NV; j++) {
                for (let i = 0; i < NU; i++) {
                    b.tri(ids[j][i], ids[j + 1][i], ids[j][i + 1]);
                    b.tri(ids[j][i + 1], ids[j + 1][i], ids[j + 1][i + 1]);
                }
            }
            // Sand skirt from just above the waterline down under the water.
            const y0 = WATER_Y + 0.1;
            const y1 = WATER_Y - 0.25;
            const out = 0.42;
            const skirt = [];
            for (let i = 0; i <= NU; i++) {
                const u = i / NU;
                const px = c.x + s.a[0] + (s.b[0] - s.a[0]) * u;
                const pz = c.z + s.a[1] + (s.b[1] - s.a[1]) * u;
                const w = out * (0.8 + 0.4 * (noise3(px * 3, 0, pz * 3) * 0.5 + 0.5));
                const n = new THREE.Vector3(s.dx * 0.5, 1, s.dz * 0.5).normalize();
                skirt.push([
                    b.vert([px, y0, pz], [n.x, n.y, n.z], lerpUV(sandR, u, 0), [0.95, 0.92, 0.85]),
                    b.vert([px + s.dx * w, y1, pz + s.dz * w], [n.x, n.y, n.z], lerpUV(sandR, u, 0.6), [0.8, 0.78, 0.72]),
                ]);
            }
            for (let i = 0; i < NU; i++) {
                b.tri(skirt[i][0], skirt[i][1], skirt[i + 1][0]);
                b.tri(skirt[i + 1][0], skirt[i][1], skirt[i + 1][1]);
            }
        }
        // Rounded sand at convex corners, where two sea sides meet.
        for (let k = 0; k < 4; k++) {
            const s1 = sides[k];
            const s2 = sides[(k + 1) % 4];
            if (land(x + s1.dx, z + s1.dz) || land(x + s2.dx, z + s2.dz)) continue;
            const corner = [c.x + s1.b[0], WATER_Y + 0.1, c.z + s1.b[1]];
            const cc = b.vert(corner, [0, 1, 0], lerpUV(sandR, 0.5, 0), [0.95, 0.92, 0.85]);
            let prev = null;
            for (let m = 0; m <= 4; m++) {
                const a = m / 4;
                const dx = s1.dx * Math.cos((a * Math.PI) / 2) + s2.dx * Math.sin((a * Math.PI) / 2);
                const dz = s1.dz * Math.cos((a * Math.PI) / 2) + s2.dz * Math.sin((a * Math.PI) / 2);
                const v = b.vert([corner[0] + dx * 0.42, WATER_Y - 0.25, corner[2] + dz * 0.42], [dx * 0.5, 1, dz * 0.5], lerpUV(sandR, a, 0.6), [0.8, 0.78, 0.72]);
                if (prev !== null) b.tri(cc, prev, v);
                prev = v;
            }
        }
    }

    // Boulders (and a shrub now and then) on rock tiles.
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    const at = new THREE.Vector3();
    const rockColor = (tone) => (local, n) => {
        const moss = n.y > 0.55 && noise3(local[0] * 5 + tone * 9, local[1] * 5, local[2] * 5) > -0.1;
        const g = (0.74 + tone * 0.18) * (0.85 + noise3(local[0] * 8, local[1] * 8, local[2] * 8) * 0.15);
        return moss ? [g * 0.55, g * 0.8, g * 0.42] : [g, g * 0.98, g * 0.95];
    };
    for (const { x, z, rock } of tiles) {
        if (!rock) continue;
        const c = world(x, z);
        const big = T.boulders[Math.floor(r() * T.boulders.length)];
        e.set((r() - 0.5) * 0.3, r() * Math.PI * 2, (r() - 0.5) * 0.3);
        q.setFromEuler(e);
        sc.set(0.86 + r() * 0.14, 0.72 + r() * 0.3, 0.86 + r() * 0.14);
        at.set(c.x + (r() - 0.5) * 0.08, CAP_TOP + 0.2 * sc.y + 0.02, c.z + (r() - 0.5) * 0.08);
        m4.compose(at, q, sc);
        b.addGeometry(big, m4, rockColor(r()), boulderR);
        const extra = 1 + Math.floor(r() * 2);
        for (let k = 0; k < extra; k++) {
            const a = r() * Math.PI * 2;
            const peb = T.pebbles[k % 2];
            const s = 0.22 + r() * 0.14;
            e.set(r(), r() * 6, r());
            q.setFromEuler(e);
            sc.set(s, s * 0.8, s);
            at.set(c.x + Math.cos(a) * 0.36, CAP_TOP + 0.04, c.z + Math.sin(a) * 0.36);
            m4.compose(at, q, sc);
            b.addGeometry(peb, m4, rockColor(r()), boulderR);
        }
        if (r() < 0.35) {
            const a = r() * Math.PI * 2;
            for (let k = 0; k < 3; k++) {
                const s = 0.16 + r() * 0.08;
                sc.set(s, s * 0.85, s);
                at.set(c.x + Math.cos(a) * 0.33 + (r() - 0.5) * 0.12, CAP_TOP + s * 0.32, c.z + Math.sin(a) * 0.33 + (r() - 0.5) * 0.12);
                m4.compose(at, q.identity(), sc);
                const tone = r();
                b.addGeometry(T.bush, m4, (l, n) => [0.22 + tone * 0.1 + n.y * 0.1, 0.5 + tone * 0.1 + n.y * 0.12, 0.18], grassR);
            }
        }
    }

    // Islets off the coast, out of reach of the board, with palm trees.
    const palms = [];
    const islets = 3 + Math.floor(r() * 3);
    const halfW = level.width / 2;
    const halfD = level.height / 2;
    const placed = [];
    for (let k = 0, tries = 0; k < islets && tries < 60; tries++) {
        const a = r() * Math.PI * 2;
        const dist = 2.4 + r() * 2.6;
        const px = Math.cos(a) * (halfW + dist);
        const pz = Math.sin(a) * (halfD + dist);
        if (placed.some(([qx, qz]) => Math.hypot(qx - px, qz - pz) < 2.4)) continue;
        // Keep islets well clear of the board, so nobody mistakes one for a
        // place to land: at least three tiles of open water from any tile.
        let nearest = Infinity;
        for (const t of tiles) {
            const c = world(t.x, t.z);
            nearest = Math.min(nearest, Math.hypot(c.x - px, c.z - pz));
        }
        if (nearest < 4.2) continue;
        placed.push([px, pz]);
        k++;
        const rad = 0.7 + r() * 0.6;
        const sand = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
        m4.compose(new THREE.Vector3(px, WATER_Y - 0.2, pz), q.identity(), sc.set(rad, 0.42, rad * (0.8 + r() * 0.3)));
        b.addGeometry(sand, m4, (l, n) => (n.y > 0.5 ? [0.98, 0.95, 0.86] : [0.85, 0.82, 0.74]), sandR);
        sand.dispose();
        for (let s = 0; s < 2; s++) {
            const ra = r() * Math.PI * 2;
            m4.compose(new THREE.Vector3(px + Math.cos(ra) * rad * 0.6, WATER_Y + 0.12, pz + Math.sin(ra) * rad * 0.6), q.identity(), sc.setScalar(0.18 + r() * 0.12));
            b.addGeometry(T.pebbles[s], m4, rockColor(r()), boulderR);
        }
        const n = 1 + Math.floor(r() * 2);
        for (let p = 0; p < n; p++) {
            palms.push({ x: px + (r() - 0.5) * rad * 0.6, z: pz + (r() - 0.5) * rad * 0.6, ry: r() * Math.PI * 2, s: 0.75 + r() * 0.35 });
        }
    }

    const terrainGeo = b.build();
    const terrain = new THREE.Mesh(terrainGeo, groundMaterial);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    group.add(terrain);

    // Grass tufts and flowers on grass tiles (fewer at low quality).
    const tufts = [];
    const flowers = [];
    for (const { x, z, rock } of tiles) {
        if (rock) continue;
        const c = world(x, z);
        const n = Math.round((2 + Math.floor(r() * 3)) * quality);
        for (let k = 0; k < n; k++) {
            // Keep the tile centre clear, where the characters stand.
            const a = r() * Math.PI * 2;
            const d = 0.24 + r() * 0.16;
            tufts.push({ x: c.x + Math.cos(a) * d, z: c.z + Math.sin(a) * d, ry: r() * 6.28, s: 0.8 + r() * 0.5 });
        }
        if (r() < 0.22 * quality) {
            const a = r() * Math.PI * 2;
            const hue = [0xfacc15, 0xf472b6, 0xffffff, 0xa78bfa, 0xfb923c][Math.floor(r() * 5)];
            for (let k = 0; k < 2; k++) {
                flowers.push({ x: c.x + Math.cos(a + k * 0.5) * 0.36, z: c.z + Math.sin(a + k * 0.5) * 0.36, ry: r() * 6.28, s: 0.8 + r() * 0.4, color: hue });
            }
        }
    }
    const instanced = (geo, material, list, { color, y = CAP_TOP, shadow = false } = {}) => {
        if (!list.length) return null;
        const m = new THREE.InstancedMesh(geo, material, list.length);
        const o = new THREE.Object3D();
        const col = new THREE.Color();
        list.forEach((it, i) => {
            o.position.set(it.x, y, it.z);
            o.rotation.set(0, it.ry, 0);
            o.scale.setScalar(it.s);
            o.updateMatrix();
            m.setMatrixAt(i, o.matrix);
            if (color) m.setColorAt(i, col.set(it.color));
        });
        m.castShadow = shadow;
        m.receiveShadow = false;
        m.computeBoundingSphere?.();
        group.add(m);
        return m;
    };
    const mats = (templates.mats ||= {
        grass: windMaterial(windUniforms, { strength: 1 }),
        flower: windMaterial(windUniforms, { strength: 0.8 }),
        palm: windMaterial(windUniforms, { strength: 0.12, side: THREE.FrontSide }),
    });
    instanced(T.tuft, mats.grass, tufts);
    instanced(T.flower, mats.flower, flowers, { color: true });
    instanced(T.palm, mats.palm, palms, { y: WATER_Y + 0.1, shadow: true });

    let triangles = 0;
    group.traverse((o) => {
        if (o.isMesh) triangles += ((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3) * (o.count || 1);
    });
    return {
        group,
        stats: { triangles, tufts: tufts.length, palms: palms.length },
        dispose() {
            terrainGeo.dispose();
            group.traverse((o) => o.isInstancedMesh && o.dispose());
            group.removeFromParent();
        },
    };
}
