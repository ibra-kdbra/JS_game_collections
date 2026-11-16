/**
 * The 3D view's towers and enemies, built from simple solids to match the flat
 * view's art: the same shapes, colours and parts, seen from the side as well.
 *
 * Everything shares one material. Each vertex carries its colour, how metallic and
 * how rough it is, how much it glows, and how it moves; the GPU moves the parts
 * (legs, rotors, treads, flames, spinning rings), so a whole crowd of one kind is a
 * single instanced draw. Each instance carries its walk phase, a hit or status glow
 * and how far it has dissolved (killed enemies burn away from the edges).
 *
 * Units: towers in tiles (a tile is 1 across, the ground at y = 0, forward is +X).
 * Enemies in their own radius (the flat art's r), scaled per instance.
 */
const Units3D = (() => {
    const TAU = Math.PI * 2;
    let T3 = null;

    // Surfaces: [metalness, roughness, glow]
    const SF = {
        paint: [0.3, 0.42, 0],
        gloss: [0.12, 0.26, 0],
        metal: [0.82, 0.36, 0],
        dark: [0.65, 0.5, 0],
        steel: [0.95, 0.22, 0],
        stone: [0.0, 0.86, 0],
        rubber: [0.0, 0.92, 0],
        glass: [0.4, 0.05, 0],
        copper: [1.0, 0.3, 0],
        gold: [1.0, 0.26, 0],
        glow: [0.0, 0.4, 1.7],
        dim: [0.0, 0.4, 1.1]
    };
    // How a part moves: [type, phase, amount, axis]
    //   1 leg swing (axis 0: about the upright, 1: forward and back), with the walk
    //   2 spin about the upright      3 track tread      4 flame flicker
    //   5 turret sway                 6 pulse
    const STILL = [0, 0, 0, 0];

    const metalBase = '#3b414c';
    const metalHi = '#59616e';
    const metalLo = '#262a32';
    const STEEL = '#a9b2bd';
    const OUT = '#1b1e24';

    // ---------- Building geometry ----------

    let parts = [];
    let mtx = null;
    function begin() {
        parts = [];
    }
    // Add a solid: geometry, colour, surface, placement matrix, motion, pivot
    function add(geo, color, surf, m, anim, pivot) {
        parts.push({ geo, color, surf: SF[surf] || surf, m, anim: anim || STILL, pivot: pivot || [0, 0, 0] });
        return geo;
    }
    function finish() {
        let n = 0;
        const list = parts.map(p => {
            let g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
            if (p.m) g.applyMatrix4(p.m);
            if (!g.attributes.normal) g.computeVertexNormals();
            n += g.attributes.position.count;
            return { g, p };
        });
        const pos = new Float32Array(n * 3);
        const nrm = new Float32Array(n * 3);
        const uv = new Float32Array(n * 2);
        const col = new Float32Array(n * 3);
        const surf = new Float32Array(n * 3);
        const anim = new Float32Array(n * 4);
        const piv = new Float32Array(n * 3);
        const c = new T3.Color();
        let o = 0;
        list.forEach(({ g, p }) => {
            const k = g.attributes.position.count;
            pos.set(g.attributes.position.array, o * 3);
            nrm.set(g.attributes.normal.array, o * 3);
            if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
            c.set(p.color);
            for (let i = 0; i < k; i++) {
                const j = o + i;
                col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b;
                surf[j * 3] = p.surf[0]; surf[j * 3 + 1] = p.surf[1]; surf[j * 3 + 2] = p.surf[2];
                anim[j * 4] = p.anim[0]; anim[j * 4 + 1] = p.anim[1]; anim[j * 4 + 2] = p.anim[2]; anim[j * 4 + 3] = p.anim[3];
                piv[j * 3] = p.pivot[0]; piv[j * 3 + 1] = p.pivot[1]; piv[j * 3 + 2] = p.pivot[2];
            }
            o += k;
            g.dispose();
        });
        const out = new T3.BufferGeometry();
        out.setAttribute('position', new T3.BufferAttribute(pos, 3));
        out.setAttribute('normal', new T3.BufferAttribute(nrm, 3));
        out.setAttribute('uv', new T3.BufferAttribute(uv, 2));
        out.setAttribute('color', new T3.BufferAttribute(col, 3));
        out.setAttribute('aSurf', new T3.BufferAttribute(surf, 3));
        out.setAttribute('aAnim', new T3.BufferAttribute(anim, 4));
        out.setAttribute('aPivot', new T3.BufferAttribute(piv, 3));
        out.computeBoundingBox();
        out.computeBoundingSphere();
        parts = [];
        return out;
    }

    // Placement: position, rotation (x, y, z), scale
    function X(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
        return new T3.Matrix4().compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(rx, ry, rz, 'YXZ')), new T3.Vector3(sx, sy, sz));
    }

    // Solids. Prisms and slabs have chamfered edges that catch the light.
    function shapeOf(pts) {
        const s = new T3.Shape();
        pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
        s.closePath();
        return s;
    }
    // A flat outline (x, z points) raised by h with a bevel b, standing on y = 0
    function slab(pts, h, b = 0.012) {
        b = Math.min(b, h * 0.45);
        const g = new T3.ExtrudeGeometry(shapeOf(pts), { depth: Math.max(0.001, h - 2 * b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 8 });
        g.rotateX(-Math.PI / 2);
        g.translate(0, b, 0);
        return g;
    }
    function ngonPts(n, r, rot = 0) {
        const pts = [];
        for (let i = 0; i < n; i++) pts.push([Math.cos(rot + i * TAU / n) * r, Math.sin(rot + i * TAU / n) * r]);
        return pts;
    }
    // Rounded rectangle outline (x, z), w by d, corner radius cr
    function rrPts(w, d, cr) {
        cr = Math.min(cr, w / 2 - 0.001, d / 2 - 0.001);
        const pts = [];
        const cs = [[w / 2 - cr, d / 2 - cr, 0], [-w / 2 + cr, d / 2 - cr, 1], [-w / 2 + cr, -d / 2 + cr, 2], [w / 2 - cr, -d / 2 + cr, 3]];
        cs.forEach(([cx, cz, q]) => {
            for (let i = 0; i <= 4; i++) {
                const a = q * Math.PI / 2 + i / 4 * Math.PI / 2;
                pts.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]);
            }
        });
        return pts;
    }
    const prism = (n, r, h, b, rot = 0) => slab(ngonPts(n, r, rot), h, b);
    // A chamfered box w (x) by h (y) by d (z), centred on x and z, standing on y = 0
    const rbox = (w, h, d, b = 0.015, cr = 0) => slab(cr > 0 ? rrPts(w, d, cr) : [[w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]], h, b);
    const box = (w, h, d) => new T3.BoxGeometry(w, h, d);
    const cyl = (r1, r2, h, seg = 20, open = false) => new T3.CylinderGeometry(r1, r2, h, seg, 1, open);
    const sph = (r, ws = 20, hs = 14) => new T3.SphereGeometry(r, ws, hs);
    const dome = (r, ws = 22, hs = 8) => new T3.SphereGeometry(r, ws, hs, 0, TAU, 0, Math.PI / 2);
    const cone = (r, h, seg = 16) => new T3.ConeGeometry(r, h, seg);
    const torus = (R, r, seg = 28, ts = 8) => new T3.TorusGeometry(R, r, ts, seg).rotateX(Math.PI / 2);
    const lathe = (pts, seg = 22) => new T3.LatheGeometry(pts.map(([r, y]) => new T3.Vector2(r, y)), seg);
    // A rod from point a to point b
    function rod(a, b, r1, r2 = r1, seg = 8) {
        const A = new T3.Vector3(...a);
        const B = new T3.Vector3(...b);
        const len = A.distanceTo(B);
        const g = cyl(r2, r1, len, seg);
        const q = new T3.Quaternion().setFromUnitVectors(new T3.Vector3(0, 1, 0), B.clone().sub(A).normalize());
        g.applyMatrix4(new T3.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new T3.Vector3(1, 1, 1)));
        return g;
    }
    // Along the forward axis: a cylinder from x0 to x1 at height y, side z
    function barrel(x0, x1, y, z, r, seg = 14, r2 = r) {
        return rod([x0, y, z], [x1, y, z], r, r2, seg);
    }

    // Colour helpers
    const mix = (a, b, k) => '#' + new T3.Color(a).lerp(new T3.Color(b), k).getHexString();
    // A touch less saturated than the flat art, for painted metal
    const paint = (hex, k = 0.18) => {
        const c = new T3.Color(hex);
        const hsl = {};
        c.getHSL(hsl);
        c.setHSL(hsl.h, hsl.s * (1 - k), hsl.l * 0.94);
        return '#' + c.getHexString();
    };

    // ---------- The material ----------

    const uTime = { value: 0 };
    const NOISE = `
        float u3h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float u3n(vec3 x) {
            vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(u3h(i), u3h(i + vec3(1, 0, 0)), f.x), mix(u3h(i + vec3(0, 1, 0)), u3h(i + vec3(1, 1, 0)), f.x), f.y),
                       mix(mix(u3h(i + vec3(0, 0, 1)), u3h(i + vec3(1, 0, 1)), f.x), mix(u3h(i + vec3(0, 1, 1)), u3h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`;
    function patch(m) {
        m.onBeforeCompile = (sh) => {
            sh.uniforms.uTime = uTime;
            sh.vertexShader = `
                attribute vec3 aSurf; attribute vec4 aAnim; attribute vec3 aPivot;
                #ifdef UNIT_INST
                attribute vec4 aFx; attribute vec4 aMove;
                #endif
                uniform float uTime;
                varying vec3 vSurf; varying vec4 vFx; varying vec3 vObj; varying vec2 vTread;
                mat3 u3rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
                mat3 u3rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
            ` + sh.vertexShader
                .replace('#include <beginnormal_vertex>', `
                vec3 objectNormal = vec3(normal);
                vec4 mv = vec4(0.0, 0.0, 0.0, 1.0);
                #ifdef UNIT_INST
                mv = aMove; vFx = aFx;
                #else
                vFx = vec4(0.0);
                #endif
                vSurf = aSurf; vObj = position; vTread = vec2(0.0);
                mat3 R = mat3(1.0); vec3 Sc = vec3(1.0); vec3 off = vec3(0.0);
                float ty = aAnim.x;
                if (ty > 0.5) {
                    float ph = aAnim.y; float amp = aAnim.z;
                    if (ty < 1.5) {
                        float a = sin(mv.x + ph) * amp;
                        R = aAnim.w < 0.5 ? u3rY(a) : u3rZ(a);
                        off.y = max(0.0, cos(mv.x + ph)) * amp * 0.16;
                    } else if (ty < 2.5) {
                        R = u3rY(uTime * amp + ph + mv.y);
                    } else if (ty < 3.5) {
                        vTread = vec2(1.0, (position.x - mv.x) * amp);
                    } else if (ty < 4.5) {
                        float f = 0.82 + 0.2 * sin(uTime * 37.0 + mv.y * 13.0 + ph) + 0.1 * sin(uTime * 23.0 + ph);
                        Sc = vec3(f * (0.85 + mv.z * 0.5), 1.0, 1.0);
                    } else if (ty < 5.5) {
                        R = u3rY(sin(uTime * amp + mv.y * 3.0 + ph) * 0.45);
                    } else {
                        Sc = vec3(1.0 + 0.16 * sin(uTime * amp + ph + mv.y * 5.0));
                    }
                }
                objectNormal = R * objectNormal;`)
                .replace('#include <begin_vertex>', `
                vec3 transformed = R * ((position - aPivot) * Sc) + aPivot + off;`);
            sh.fragmentShader = `
                varying vec3 vSurf; varying vec4 vFx; varying vec3 vObj; varying vec2 vTread;
                ${NOISE}
            ` + sh.fragmentShader
                .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
                float edgeGlow = 0.0;
                if (vFx.a > 0.001) {
                    float dn = u3n(vObj * 6.0) * 0.62 + u3n(vObj * 17.0) * 0.38;
                    float cut = vFx.a * 1.2 - 0.1;
                    if (dn < cut) discard;
                    edgeGlow = 1.0 - smoothstep(0.0, 0.07, dn - cut);
                }`)
                .replace('#include <color_fragment>', `#include <color_fragment>
                float grime = u3n(vObj * 5.0) * 0.55 + u3n(vObj * 19.0) * 0.3 + u3n(vObj * 61.0) * 0.15;
                diffuseColor.rgb *= 0.8 + 0.32 * grime;
                if (vTread.x > 0.5) diffuseColor.rgb *= 0.5 + 0.6 * step(0.45, fract(vTread.y));`)
                .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(vSurf.y + (grime - 0.5) * 0.22, 0.04, 1.0);')
                .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurf.x;')
                .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                totalEmissiveRadiance += vColor.rgb * vSurf.z + vFx.rgb + edgeGlow * vec3(3.2, 1.35, 0.4);`);
        };
        m.customProgramCacheKey = () => 'units3d-' + (m.transparent ? 't' : 'o') + (m.defines && m.defines.UNIT_INST ? 'i' : '');
        return m;
    }
    let mats = null;
    function materials() {
        if (mats) return mats;
        const solid = patch(new T3.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 }));
        const ghost = patch(new T3.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1, transparent: true, opacity: 0.6, depthWrite: false }));
        // Enemy crowds: per-instance walk, glow and dissolve
        const crowd = patch(new T3.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 1 }));
        crowd.defines = { UNIT_INST: 1 };
        mats = { solid, ghost, crowd };
        return mats;
    }

    // ---------- Towers ----------
    //
    // A stone footing, a metal plate in the tower's base shape with its colour inlaid,
    // and the turret (the part that turns, or spins for towers that pulse).

    const PY = 0.175;           // top of the plate, where the turret sits
    const BASE_SHAPE = {
        gun: 'square', machineGun: 'square', laser: 'hex', beamEmitter: 'hex', slow: 'round', poison: 'round',
        sniper: 'diamond', railgun: 'oct', rocket: 'square', missileSilo: 'square', bomb: 'round', clusterBomb: 'oct',
        tesla: 'round', lightningStrike: 'hex'
    };
    function shapePts(shape, r) {
        if (shape === 'square') return rrPts(r * 2, r * 2, r * 0.3);
        if (shape === 'hex') return ngonPts(6, r * 1.06, Math.PI / 6);
        if (shape === 'oct') return ngonPts(8, r * 1.05, Math.PI / 8);
        if (shape === 'diamond') return ngonPts(4, r * 1.22, 0);
        return ngonPts(36, r);
    }
    function towerBase(name, a) {
        const shape = BASE_SHAPE[name] || 'round';
        add(slab(shapePts(shape, 0.445), 0.07, 0.018), '#77746d', 'stone');
        add(slab(shapePts(shape, 0.395), 0.1, 0.016), metalBase, 'metal', X(0, 0.065));
        add(slab(shapePts(shape, 0.345), 0.014, 0.004), paint(a.main), 'paint', X(0, 0.162));
        add(slab(shapePts(shape, 0.31), 0.018, 0.004), metalHi, 'metal', X(0, 0.161));
        if ((a.level || 1) > 1) {
            // gold chevrons on the front edge
            for (let i = 0; i < 2; i++) {
                add(slab([[-0.05, 0], [0, 0.045], [0.05, 0], [0.05, 0.03], [0, 0.075], [-0.05, 0.03]], 0.014, 0.003), '#e8b923', 'gold', X(-0.06 + i * 0.11, 0.163, 0.3, 0, 0, 0));
            }
        }
    }
    function bolts(pts, r = 0.022) {
        pts.forEach(([x, z]) => add(cyl(r, r, 0.02, 8), metalLo, 'steel', X(x, PY + 0.008, z)));
    }
    // The turret's swivel: a short drum on the plate
    function swivel(r, color) {
        add(cyl(r, r * 1.08, 0.04, 28), metalLo, 'dark', X(0, PY + 0.02));
        if (color) add(torus(r * 1.02, 0.008, 32, 6), color, 'paint', X(0, PY + 0.035));
    }

    const TOWERS = {
        gun(a) {
            bolts([[-0.29, -0.29], [0.29, -0.29], [0.29, 0.29], [-0.29, 0.29]]);
            const gun = [];
            swivel(0.2);
            const y = PY + 0.12;
            gun.push(add(lathe([[0, 0], [0.21, 0], [0.22, 0.03], [0.19, 0.11], [0.13, 0.15], [0, 0.155]], 28), paint(a.main), 'paint', X(0, PY + 0.035)));
            gun.push(add(cyl(0.12, 0.13, 0.02, 24), paint(a.dark), 'paint', X(0, PY + 0.185)));
            gun.push(add(rbox(0.14, 0.09, 0.12, 0.012), metalBase, 'metal', X(0.16, y - 0.045)));
            gun.push(add(barrel(0.15, 0.46, y, 0, 0.032, 14), STEEL, 'steel'));
            gun.push(add(barrel(0.42, 0.52, y, 0, 0.045, 14), metalLo, 'dark'));
            return { gun, tips: [[0.53, y, 0]] };
        },
        machineGun(a) {
            // sandbags round the plate
            for (let i = 0; i < 12; i++) {
                const t = i / 12 * TAU;
                add(sph(0.075, 10, 6), i % 2 ? '#a99472' : '#968260', 'stone', X(Math.cos(t) * 0.405, 0.2, Math.sin(t) * 0.405, 0, -t + Math.PI / 2, 0, 1.25, 0.6, 0.75));
            }
            swivel(0.2);
            const gun = [];
            const y = PY + 0.12;
            gun.push(add(rbox(0.36, 0.15, 0.4, 0.025, 0.08), paint(a.main), 'paint', X(-0.04, PY + 0.035)));
            gun.push(add(rbox(0.2, 0.03, 0.24, 0.01, 0.04), paint(a.dark), 'paint', X(-0.06, PY + 0.185)));
            gun.push(add(rbox(0.2, 0.1, 0.13, 0.012), '#5f5530', 'paint', X(-0.06, PY + 0.07, 0.25)));
            [-0.075, 0.075].forEach(z => {
                gun.push(add(barrel(0.12, 0.5, y, z, 0.03, 12), STEEL, 'steel'));
                gun.push(add(barrel(0.44, 0.53, y, z, 0.042, 12), metalLo, 'dark'));
                gun.push(add(barrel(0.2, 0.3, y, z, 0.04, 12), metalBase, 'metal'));
            });
            return { gun, tips: [[0.54, y, -0.075], [0.54, y, 0.075]] };
        },
        laser(a) {
            bolts([0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * TAU / 6 + Math.PI / 6) * 0.3, Math.sin(i * TAU / 6 + Math.PI / 6) * 0.3]));
            swivel(0.18, paint(a.main));
            const gun = [];
            const y = PY + 0.13;
            gun.push(add(rbox(0.34, 0.15, 0.32, 0.03, 0.11), paint(a.main), 'paint', X(-0.03, PY + 0.04)));
            gun.push(add(dome(0.085), '#7fd8ff', 'dim', X(0.0, PY + 0.19)));
            [-0.07, 0.07].forEach(z => gun.push(add(rbox(0.3, 0.05, 0.05, 0.01), STEEL, 'steel', X(0.24, y - 0.025, z))));
            gun.push(add(barrel(0.3, 0.37, y, 0, 0.05, 16), metalLo, 'dark'));
            gun.push(add(sph(0.05, 16, 10), '#c9fbff', 'glow', X(0.385, y, 0)));
            return { gun, tips: [[0.41, y, 0]], glowAt: [0, PY + 0.22, 0] };
        },
        beamEmitter(a) {
            [0, 2, 4].forEach(i => {
                const t = i * TAU / 6 + Math.PI / 6;
                add(cyl(0.06, 0.07, 0.04, 12), '#2a3038', 'metal', X(Math.cos(t) * 0.35, PY, Math.sin(t) * 0.35));
                add(sph(0.045, 12, 8), '#bff8ff', 'glow', X(Math.cos(t) * 0.35, PY + 0.04, Math.sin(t) * 0.35));
            });
            swivel(0.21, paint(a.main));
            const gun = [];
            const y = PY + 0.13;
            gun.push(add(rbox(0.42, 0.16, 0.4, 0.03, 0.13), paint(a.main), 'paint', X(-0.04, PY + 0.04)));
            gun.push(add(cone(0.1, 0.18, 6), '#e9fffd', 'glow', X(-0.04, PY + 0.28)));
            gun.push(add(cone(0.1, 0.08, 6), '#e9fffd', 'glow', X(-0.04, PY + 0.16, 0, Math.PI)));
            [-0.12, 0, 0.12].forEach((z, i) => gun.push(add(rbox(i === 1 ? 0.34 : 0.26, 0.05, 0.05, 0.01), STEEL, 'steel', X(i === 1 ? 0.27 : 0.23, y - 0.025, z))));
            gun.push(add(sph(0.075, 16, 10), '#e9fffd', 'glow', X(0.45, y, 0)));
            return { gun, tips: [[0.48, y, 0]], glowAt: [-0.04, PY + 0.27, 0] };
        },
        slow(a) {
            for (let i = 0; i < 6; i++) {
                const t = i * TAU / 6;
                add(rbox(0.08, 0.025, 0.02, 0.004), '#cfe6ff', 'dim', X(Math.cos(t) * 0.28, PY, Math.sin(t) * 0.28, 0, -t, 0));
            }
            swivel(0.15, paint(a.main));
            const gun = [];
            gun.push(add(cyl(0.05, 0.07, 0.16, 16), metalBase, 'metal', X(0, PY + 0.11)));
            for (let i = 0; i < 3; i++) {
                const t = i * TAU / 3;
                gun.push(add(sph(0.1, 16, 8), '#a9c3da', 'paint', X(Math.cos(t) * 0.2, PY + 0.2, Math.sin(t) * 0.2, 0.35, -t, 0, 1.8, 0.25, 0.8)));
            }
            gun.push(add(cyl(0.13, 0.13, 0.06, 24), paint(a.main), 'paint', X(0, PY + 0.2)));
            gun.push(add(sph(0.06, 16, 10), '#e8f6ff', 'glow', X(0, PY + 0.24)));
            return { gun, tips: [[0, PY + 0.25, 0]], glowAt: [0, PY + 0.25, 0] };
        },
        poison(a) {
            [0, 1, 2].forEach(i => {
                const t = i * TAU / 3 + Math.PI / 6;
                const x = Math.cos(t) * 0.33;
                const z = Math.sin(t) * 0.33;
                add(cyl(0.07, 0.08, 0.05, 14), '#2f4a1a', 'metal', X(x, PY, z));
                add(sph(0.065, 14, 10), '#a8f25a', 'glow', X(x, PY + 0.07, z, 0, 0, 0, 1, 1.2, 1));
            });
            swivel(0.17, paint(a.main));
            const gun = [];
            for (let i = 0; i < 3; i++) {
                const t = i * TAU / 3;
                gun.push(add(rod([Math.cos(t) * 0.08, PY + 0.12, Math.sin(t) * 0.08], [Math.cos(t) * 0.3, PY + 0.09, Math.sin(t) * 0.3], 0.025), STEEL, 'steel'));
                gun.push(add(sph(0.045, 12, 8), '#3e6a1a', 'metal', X(Math.cos(t) * 0.31, PY + 0.09, Math.sin(t) * 0.31)));
            }
            gun.push(add(cyl(0.17, 0.18, 0.08, 24), paint(a.main), 'paint', X(0, PY + 0.08)));
            gun.push(add(sph(0.12, 20, 14), '#9fe05a', 'dim', X(0, PY + 0.16)));
            return { gun, tips: [[0, PY + 0.26, 0]], glowAt: [0, PY + 0.18, 0] };
        },
        sniper(a) {
            bolts([[0, -0.33], [0.33, 0], [0, 0.33], [-0.33, 0]]);
            swivel(0.16);
            const gun = [];
            const y = PY + 0.11;
            gun.push(add(rbox(0.32, 0.12, 0.24, 0.025, 0.07), paint(a.main), 'paint', X(-0.05, PY + 0.035)));
            gun.push(add(barrel(0.05, 0.62, y, 0, 0.024, 12), '#2a2e36', 'dark'));
            gun.push(add(rbox(0.09, 0.05, 0.08, 0.008), metalLo, 'dark', X(0.6, y - 0.025)));
            gun.push(add(barrel(0.0, 0.24, y + 0.035, -0.11, 0.025, 12), '#1d2026', 'dark'));
            gun.push(add(rod([0.08, y, -0.06], [0.08, y + 0.03, -0.1], 0.012), '#1d2026', 'dark'));
            gun.push(add(sph(0.024, 10, 8), '#ff6a6a', 'glow', X(0.245, y + 0.035, -0.11)));
            return { gun, tips: [[0.65, y, 0]] };
        },
        railgun(a) {
            for (let i = 0; i < 4; i++) {
                const t = i * TAU / 4 + Math.PI / 4;
                add(rbox(0.08, 0.06, 0.14, 0.01), '#d04ae0', 'dim', X(Math.cos(t) * 0.33, PY - 0.01, Math.sin(t) * 0.33, 0, -t, 0));
            }
            swivel(0.17, paint(a.main));
            const gun = [];
            const y = PY + 0.12;
            [-0.08, 0.08].forEach(z => gun.push(add(rbox(0.92, 0.06, 0.06, 0.012), '#c8cfd8', 'steel', X(0.16, y - 0.03, z))));
            gun.push(add(rbox(0.7, 0.025, 0.04, 0.006), '#f08cff', 'glow', X(0.25, y - 0.012, 0)));
            [0.12, 0.26, 0.4].forEach(x => gun.push(add(rbox(0.05, 0.12, 0.28, 0.01), paint('#c040d8'), 'paint', X(x, y - 0.06))));
            gun.push(add(sph(0.16, 22, 14), paint(a.main), 'paint', X(-0.1, PY + 0.09, 0, 0, 0, 0, 1, 0.75, 1)));
            gun.push(add(sph(0.07, 16, 10), '#f6d0ff', 'glow', X(-0.1, PY + 0.19)));
            return { gun, tips: [[0.64, y, 0]] };
        },
        rocket(a) {
            hazardFrame('#c9a227');
            swivel(0.2);
            const gun = [];
            const y = PY + 0.13;
            gun.push(add(rbox(0.4, 0.17, 0.42, 0.02, 0.05), paint(a.main), 'paint', X(-0.01, PY + 0.04)));
            gun.push(add(rbox(0.16, 0.025, 0.3, 0.006), paint(a.dark), 'paint', X(-0.08, PY + 0.21)));
            [-0.1, 0.1].forEach(z => {
                gun.push(add(barrel(0.12, 0.23, y, z, 0.07, 16), '#1a1d22', 'dark'));
                gun.push(add(barrel(0.2, 0.25, y, z, 0.055, 14), '#d8dde3', 'steel'));
                gun.push(add(cone(0.055, 0.1, 14), paint('#e0313b', 0.1), 'gloss', X(0.3, y, z, 0, 0, -Math.PI / 2)));
            });
            return { gun, tips: [[0.36, y, -0.1], [0.36, y, 0.1]] };
        },
        missileSilo(a) {
            hazardFrame('#f6c445');
            bolts([[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]]);
            swivel(0.21);
            const gun = [];
            const y = PY + 0.13;
            gun.push(add(rbox(0.44, 0.18, 0.5, 0.02, 0.06), paint(a.main), 'paint', X(-0.01, PY + 0.04)));
            gun.push(add(rbox(0.18, 0.025, 0.34, 0.006), paint(a.dark), 'paint', X(-0.08, PY + 0.22)));
            [-0.14, -0.045, 0.045, 0.14].forEach(z => {
                gun.push(add(barrel(0.15, 0.24, y, z, 0.04, 12), '#1a1d22', 'dark'));
                gun.push(add(cone(0.035, 0.1, 12), '#e8b923', 'gloss', X(0.28, y, z, 0, 0, -Math.PI / 2)));
            });
            return { gun, tips: [[0.33, y, -0.14], [0.33, y, -0.045], [0.33, y, 0.045], [0.33, y, 0.14]] };
        },
        bomb(a) {
            bolts([0, 1, 2, 3, 4, 5, 6, 7].map(i => [Math.cos(i * TAU / 8) * 0.36, Math.sin(i * TAU / 8) * 0.36]), 0.018);
            swivel(0.2);
            const gun = [];
            gun.push(add(dome(0.2, 26, 10), paint(a.main), 'paint', X(-0.04, PY + 0.035)));
            gun.push(add(cyl(0.1, 0.1, 0.02, 20), paint(a.dark), 'paint', X(-0.04, PY + 0.2)));
            // A short fat mortar tube, raised
            const tilt = 0.55;
            const by = PY + 0.13;
            const tip = [0.04 + Math.cos(tilt) * 0.33, by + Math.sin(tilt) * 0.33, 0];
            gun.push(add(rod([0.04, by, 0], tip, 0.085, 0.075, 18), '#2b2f37', 'dark'));
            gun.push(add(rod([tip[0] - Math.cos(tilt) * 0.06, tip[1] - Math.sin(tilt) * 0.06, 0], tip, 0.095, 0.095, 18), paint(a.main), 'paint'));
            gun.push(add(cyl(0.065, 0.065, 0.002, 18), '#0c0d10', 'rubber', X(tip[0] + 0.001, tip[1] + 0.001, 0, 0, 0, -(Math.PI / 2 - tilt))));
            return { gun, tips: [[tip[0] + 0.02, tip[1] + 0.015, 0]] };
        },
        clusterBomb(a) {
            const ring = 0.375;
            for (let i = 0; i < 16; i++) {
                const t = i / 16 * TAU;
                add(rbox(0.07, 0.012, 0.025, 0.003), '#f6c445', 'paint', X(Math.cos(t) * ring, PY - 0.002, Math.sin(t) * ring, 0, -t + Math.PI / 2, 0));
            }
            swivel(0.21);
            const gun = [];
            gun.push(add(dome(0.21, 26, 10), paint(a.main), 'paint', X(-0.05, PY + 0.035)));
            gun.push(add(sph(0.09, 16, 10), '#ffd36a', 'glow', X(-0.05, PY + 0.2, 0, 0, 0, 0, 1, 0.5, 1)));
            const tips = [];
            const tilt = 0.5;
            [-0.42, 0, 0.42].forEach(t => {
                const dx = Math.cos(t);
                const dz = Math.sin(t);
                const by = PY + 0.12;
                const L = 0.3;
                const a0 = [0.04 * dx, by, 0.04 * dz];
                const tip = [a0[0] + dx * Math.cos(tilt) * L, by + Math.sin(tilt) * L, a0[2] + dz * Math.cos(tilt) * L];
                gun.push(add(rod(a0, tip, 0.065, 0.055, 14), '#2b2f37', 'dark'));
                const back = [tip[0] - dx * Math.cos(tilt) * 0.05, tip[1] - Math.sin(tilt) * 0.05, tip[2] - dz * Math.cos(tilt) * 0.05];
                gun.push(add(rod(back, tip, 0.072, 0.072, 14), paint(a.main), 'paint'));
                tips.push([tip[0] + dx * 0.015, tip[1] + 0.01, tip[2] + dz * 0.015]);
            });
            return { gun, tips };
        },
        tesla(a) {
            [0, 1, 2].forEach(i => {
                const t = i * TAU / 3 - Math.PI / 2;
                add(cyl(0.035, 0.045, 0.12, 10), '#c87533', 'copper', X(Math.cos(t) * 0.32, PY + 0.04, Math.sin(t) * 0.32));
                add(sph(0.035, 10, 8), '#ffe9a0', 'dim', X(Math.cos(t) * 0.32, PY + 0.11, Math.sin(t) * 0.32));
            });
            swivel(0.16, paint(a.main));
            const gun = [];
            gun.push(add(cyl(0.05, 0.08, 0.36, 16), '#2b2f37', 'dark', X(0, PY + 0.2)));
            [[0.19, 0.09, '#c87533'], [0.155, 0.17, '#e0954f'], [0.12, 0.25, '#c87533'], [0.09, 0.32, '#e0954f']].forEach(([r, h, c]) => {
                gun.push(add(torus(r, 0.022, 32, 8), c, 'copper', X(0, PY + h)));
            });
            gun.push(add(sph(0.095, 22, 16), '#fff6a0', 'glow', X(0, PY + 0.44)));
            return { gun, tips: [[0, PY + 0.44, 0]], glowAt: [0, PY + 0.44, 0] };
        },
        lightningStrike(a) {
            for (let i = 0; i < 6; i++) {
                const t = i * TAU / 6;
                add(cone(0.035, 0.12, 6), '#bff8ff', 'dim', X(Math.cos(t) * 0.35, PY + 0.02, Math.sin(t) * 0.35, 0, -t, -Math.PI / 2 + 0.5));
            }
            swivel(0.2, paint(a.main));
            const gun = [];
            [[0.22, 0.06, '#2a6f86'], [0.18, 0.15, '#3f97b3'], [0.14, 0.24, '#2a6f86'], [0.1, 0.32, '#3f97b3']].forEach(([r, h, c]) => {
                gun.push(add(cyl(r, r * 1.06, 0.06, 24), c, 'paint', X(0, PY + h)));
            });
            for (let i = 0; i < 4; i++) {
                const t = i * Math.PI / 2 + Math.PI / 4;
                gun.push(add(cone(0.03, 0.22, 6), '#bff8ff', 'glow', X(Math.cos(t) * 0.12, PY + 0.38, Math.sin(t) * 0.12, 0, -t, -Math.PI / 2 + 0.9)));
            }
            gun.push(add(sph(0.1, 22, 16), '#e6feff', 'glow', X(0, PY + 0.46)));
            return { gun, tips: [[0, PY + 0.46, 0]], glowAt: [0, PY + 0.46, 0] };
        }
    };
    // Yellow and black hazard stripes round the plate
    function hazardFrame(c1) {
        const n = 20;
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            // walk the square's edge
            const side = Math.floor(t * 4);
            const u = (t * 4 - side) * 0.6 - 0.3;
            const [x, z, r] = [[u, -0.3, 0], [0.3, u, Math.PI / 2], [-u, 0.3, 0], [-0.3, -u, Math.PI / 2]][side];
            add(rbox(0.06, 0.008, 0.05, 0.002), i % 2 ? c1 : '#1d2320', i % 2 ? 'paint' : 'rubber', X(x, PY - 0.003, z, 0, r, 0));
        }
    }

    const towerCache = new Map();
    // { fixed: geometry, gun: geometry, tips: [Vector3], top, glowAt } per tower kind
    function tower(name) {
        if (towerCache.has(name)) return towerCache.get(name);
        const a = Art.TOWER_ART[name];
        begin();
        towerBase(name, a);
        const make = TOWERS[name] || TOWERS.gun;
        const fixedStart = parts.length;
        // Build everything; then split the gun's parts out
        const res = make(a);
        const gunSet = new Set(res.gun);
        const all = parts.slice();
        parts = all.filter(p => !gunSet.has(p.geo));
        const fixed = finish();
        parts = all.filter(p => gunSet.has(p.geo));
        const gun = parts.length ? finish() : null;
        void fixedStart;
        // The turret is drawn larger than its plate, like the flat art (1.2x about the swivel)
        const TS = 1.2;
        const scaleUp = new T3.Matrix4().makeTranslation(0, PY, 0).multiply(new T3.Matrix4().makeScale(TS, TS, TS)).multiply(new T3.Matrix4().makeTranslation(0, -PY, 0));
        if (gun) {
            gun.applyMatrix4(scaleUp);
            gun.computeBoundingBox();
            gun.computeBoundingSphere();
        }
        let top = fixed.boundingBox.max.y;
        if (gun) top = Math.max(top, gun.boundingBox.max.y);
        const out = {
            fixed, gun, top,
            tips: res.tips.map(t => new T3.Vector3(...t).applyMatrix4(scaleUp)),
            glowAt: res.glowAt ? new T3.Vector3(...res.glowAt).applyMatrix4(scaleUp) : null
        };
        towerCache.set(name, out);
        return out;
    }

    // ---------- Enemies ----------
    //
    // Built at radius 1 (the flat art's r), forward +X, standing on y = 0.
    // stride: how far one walk cycle carries the model, in its own radii.
    // fly: hover height in radii.

    const ENEMIES = {
        // A glossy blob with big eyes, creeping
        weak(c) {
            add(sph(1, 30, 20), c, 'gloss', X(0, 0.7, 0, 0, 0, 0, 0.98, 0.72, 0.84));
            add(sph(1, 30, 12), mix(c, '#5a6470', 0.35), 'gloss', X(-0.05, 0.42, 0, 0, 0, 0, 1.0, 0.36, 0.88));
            add(sph(1, 20, 12), mix(c, '#ffffff', 0.25), 'gloss', X(-0.25, 1.15, -0.15, 0, 0, 0, 0.45, 0.25, 0.35));
            [-0.3, 0.3].forEach(z => {
                add(sph(0.22, 18, 12), '#f4f6f8', 'gloss', X(0.6, 1.0, z));
                add(sph(0.11, 14, 10), '#101216', 'glass', X(0.79, 1.03, z * 1.05));
            });
            return { stride: 2.2, hop: true };
        },
        // An armoured beetle on six legs
        strong(c) {
            const dk = '#3c4652';
            add(sph(1, 28, 18), c, 'paint', X(-0.1, 0.55, 0, 0, 0, 0, 0.85, 0.5, 0.78));
            add(rbox(1.5, 0.05, 0.07, 0.01), dk, 'dark', X(-0.12, 1.02, 0, 0, 0, -0.03));
            add(sph(1, 20, 12), mix(c, '#ffffff', 0.18), 'paint', X(-0.4, 0.92, -0.3, 0, 0, 0, 0.3, 0.12, 0.2));
            add(sph(0.36, 20, 14), dk, 'dark', X(0.68, 0.45, 0));
            [-0.16, 0.16].forEach(z => add(sph(0.09, 12, 8), '#fff0c0', 'glow', X(0.95, 0.56, z)));
            // mandibles
            [-1, 1].forEach(s => add(rod([0.9, 0.32, s * 0.12], [1.18, 0.3, s * 0.04], 0.04, 0.02, 6), '#20252c', 'dark'));
            for (let i = -1; i <= 1; i++) {
                [-1, 1].forEach(s => {
                    const x = i * 0.4;
                    const hip = [x, 0.42, s * 0.48];
                    const knee = [x + 0.12, 0.62, s * 0.9];
                    const foot = [x + 0.22, 0.02, s * 1.12];
                    const ph = ((i + 1 + (s > 0 ? 1 : 0)) % 2) * Math.PI;
                    const an = [1, ph, 0.38, 0];
                    add(rod(hip, knee, 0.075, 0.06, 7), '#2e353f', 'dark', null, an, hip);
                    add(rod(knee, foot, 0.06, 0.03, 7), '#252b33', 'dark', null, an, hip);
                });
            }
            return { stride: 1.4 };
        },
        // A cyan dart that skims along
        fast(c) {
            add(slab([[1.0, 0], [-0.8, 0.85], [-0.42, 0], [-0.8, -0.85]], 0.2, 0.05), paint(c, 0.25), 'paint', X(0, 0));
            add(slab([[0.75, 0], [-0.35, 0.22], [-0.35, -0.22]], 0.12, 0.03), '#0e7f92', 'glass', X(0, 0.17));
            add(sph(0.08, 12, 8), '#b8fbff', 'glow', X(0.3, 0.28, 0));
            [-1, 1].forEach(s => add(rbox(0.3, 0.06, 0.06, 0.01), '#1f2c33', 'dark', X(-0.6, 0.06, s * 0.55, 0, s * 0.75, 0)));
            add(cone(0.12, 0.55, 10), '#9ff8ff', 'glow', X(-0.7, 0.1, 0, 0, 0, Math.PI / 2), [4, 0, 0, 0], [-0.42, 0.1, 0]);
            return { fly: 0.9, stride: 0 };
        },
        // A blue interceptor with a canopy and twin engines
        strongFast(c) {
            add(slab([[1.0, 0], [-0.55, 0.95], [-0.85, 0.7], [-0.5, 0], [-0.85, -0.7], [-0.55, -0.95]], 0.22, 0.05), paint(c), 'paint');
            add(slab([[0.8, 0], [-0.1, 0.42], [-0.4, 0.3], [-0.4, -0.3], [-0.1, -0.42]], 0.12, 0.03), '#7fc6f0', 'glass', X(0, 0.2));
            add(sph(0.28, 18, 10), '#1c4f73', 'glass', X(0.25, 0.3, 0, 0, 0, 0, 1.4, 0.55, 0.8));
            add(sph(0.08, 12, 8), '#ffffff', 'glow', X(0.33, 0.42, 0));
            [-1, 1].forEach(s => {
                add(barrel(-0.75, -0.4, 0.12, s * 0.42, 0.1, 12), '#253a4c', 'metal');
                add(cone(0.09, 0.5, 10), '#8fd6ff', 'glow', X(-0.98, 0.12, s * 0.42, 0, 0, Math.PI / 2), [4, s, 0, 0], [-0.75, 0.12, s * 0.42]);
            });
            return { fly: 0.85, stride: 0 };
        },
        // A hovering red disc with a white cross, an antenna and a green beacon
        medic(c) {
            add(prism(36, 0.92, 0.3, 0.06), paint(c, 0.1), 'paint', X(0, 0.1));
            add(prism(36, 0.7, 0.06, 0.02), mix(c, '#000000', 0.45), 'dark', X(0, 0.06));
            add(torus(0.62, 0.05, 36, 6), '#7dff9a', 'dim', X(0, 0.07));
            add(prism(36, 0.56, 0.08, 0.02), '#f2f2f2', 'gloss', X(-0.05, 0.38));
            add(rbox(0.3, 0.05, 0.74, 0.01), paint(c, 0.1), 'gloss', X(-0.05, 0.44));
            add(rbox(0.74, 0.05, 0.3, 0.01), paint(c, 0.1), 'gloss', X(-0.05, 0.44));
            add(rod([0.62, 0.38, -0.2], [0.95, 0.75, -0.45], 0.035, 0.025, 6), '#20232a', 'dark');
            add(sph(0.1, 12, 8), '#7dff9a', 'glow', X(0.95, 0.78, -0.45), [6, 0, 7, 0], [0.95, 0.78, -0.45]);
            return { fly: 0.55, stride: 0, spin: true };
        },
        // A heavy two-legged walker with big shoulder plates and yellow eyes
        stronger(c) {
            const pad = '#5d7895';
            add(rbox(1.6, 0.85, 1.4, 0.08, 0.35), paint(c), 'paint', X(-0.05, 0.6));
            add(rbox(0.85, 0.08, 0.92, 0.03, 0.18), '#2b3b4d', 'metal', X(-0.12, 1.43));
            add(rbox(0.3, 0.32, 0.9, 0.04, 0.1), '#2b3b4d', 'metal', X(0.72, 0.8));
            [-0.24, 0.24].forEach(z => add(sph(0.1, 12, 8), '#ffd34d', 'glow', X(0.87, 1.0, z)));
            [-1, 1].forEach(s => {
                const hip = [-0.27, 0.9, s * 0.8];
                const an = [1, s > 0 ? 0 : Math.PI, 0.42, 1];
                add(rbox(0.36, 0.72, 0.3, 0.04), '#2a3644', 'metal', X(-0.27, 0.18, s * 0.82), an, hip);
                add(rbox(0.72, 0.2, 0.44, 0.05, 0.12), pad, 'paint', X(-0.2, 0.0, s * 0.82), an, hip);
                add(rbox(0.72, 0.36, 0.44, 0.06, 0.14), pad, 'paint', X(-0.27, 1.1, s * 0.84));
            });
            return { stride: 2.0, bob: 0.05 };
        },
        // An orange rocket racer trailing flame
        faster(c) {
            const y = 0.4;
            // a long hull with a pointed nose, flattened a little
            add(lathe([[0, -0.62], [0.3, -0.62], [0.4, -0.5], [0.44, -0.1], [0.42, 0.3], [0.33, 0.6], [0.18, 0.84], [0.05, 0.98], [0, 1.0]], 24), paint(c, 0.1), 'paint', X(0, y, 0, 0, 0, -Math.PI / 2, 0.82, 1, 1));
            add(cyl(0.3, 0.34, 0.1, 20), '#2a2d33', 'metal', X(-0.62, y, 0, 0, 0, Math.PI / 2));
            // black racing stripes and a cyan canopy
            [-0.09, 0.09].forEach(z => add(rbox(1.15, 0.03, 0.06, 0.008), '#1d2026', 'dark', X(0.05, y + 0.34, z, 0, 0, -0.04)));
            add(sph(0.16, 16, 10), '#2a8fa8', 'glass', X(0.42, y + 0.25, 0, 0, 0, -0.25, 1.6, 0.6, 0.9));
            add(sph(0.06, 10, 8), '#c8fbff', 'glow', X(0.5, y + 0.3, 0));
            // fins: two swept side fins and a tail fin, yellow
            [-1, 1].forEach(s => add(slab([[-0.15, 0], [-0.62, 0.48], [-0.66, 0.4], [-0.5, 0.0]], 0.05, 0.015), '#e8b923', 'paint', X(0, y - 0.04, s * 0.32, 0, 0, 0, 1, 1, s)));
            add(slab([[-0.2, 0], [-0.64, 0.38], [-0.66, 0.3], [-0.52, 0]], 0.04, 0.012), '#e8b923', 'paint', X(0, y + 0.3, 0.02, Math.PI / 2, 0, 0));
            // the flame
            add(cone(0.24, 0.75, 12), '#ffc860', 'glow', X(-1.02, y, 0, 0, 0, Math.PI / 2), [4, 0, 0, 0], [-0.65, y, 0]);
            add(cone(0.13, 0.48, 10), '#fffbe8', 'glow', X(-0.88, y, 0, 0, 0, Math.PI / 2), [4, 1.3, 0, 0], [-0.65, y, 0]);
            return { fly: 0.2, stride: 0 };
        },
        // A tank: tracks, hull, a turret that looks about
        tank(c) {
            const tr = [3, 0, 7, 0];
            [-1, 1].forEach(s => {
                add(rbox(1.92, 0.42, 0.46, 0.08, 0.2), '#24272d', 'rubber', X(0, 0.02, s * 0.64), tr);
                for (let i = 0; i < 5; i++) add(barrel(0, 0.06, 0, 0, 0.13, 14), '#3a3f46', 'metal', X(-0.7 + i * 0.35, 0.22, s * 0.88, 0, s * Math.PI / 2, 0));
                add(rbox(1.8, 0.05, 0.5, 0.015), paint(c), 'paint', X(0, 0.44, s * 0.64));
            });
            add(rbox(1.55, 0.36, 0.86, 0.05, 0.1), paint(c), 'paint', X(-0.02, 0.24));
            add(slab([[0.78, 0.43], [0.55, 0.43], [0.55, -0.43], [0.78, -0.43]], 0.05, 0.01), mix(c, '#000', 0.25), 'paint', X(0, 0.6));
            const piv = [-0.05, 0, 0];
            const sw = [5, 0, 0.7, 0];
            add(cyl(0.38, 0.42, 0.22, 28), mix(c, '#ffffff', 0.12), 'paint', X(-0.05, 0.71), sw, piv);
            add(dome(0.36, 24, 8), mix(c, '#ffffff', 0.12), 'paint', X(-0.05, 0.8, 0, 0, 0, 0, 1, 0.35, 1), sw, piv);
            add(cyl(0.12, 0.12, 0.06, 16), '#1f5f38', 'metal', X(-0.15, 0.93, 0.1), sw, piv);
            add(barrel(0.25, 1.08, 0.74, 0, 0.065, 14), '#8c969c', 'steel', null, sw, piv);
            add(barrel(0.98, 1.12, 0.74, 0, 0.09, 14), '#4a4f58', 'metal', null, sw, piv);
            return { stride: 6.28 };
        },
        // Boss: a purple octagonal fortress, its ring of spikes turning
        taunt(c) {
            add(prism(8, 0.92, 0.18, 0.04, Math.PI / 8), '#2b2236', 'metal', X(0, 0.0));
            add(prism(8, 0.86, 0.42, 0.06, Math.PI / 8), paint(c), 'paint', X(0, 0.16));
            add(prism(4, 0.74, 0.12, 0.03, Math.PI / 4), '#c8741f', 'gold', X(0, 0.56));
            add(prism(4, 0.6, 0.12, 0.03, Math.PI / 4), mix(c, '#000', 0.3), 'paint', X(0, 0.62));
            add(prism(4, 0.44, 0.1, 0.03, Math.PI / 4), '#c8741f', 'gold', X(0, 0.7));
            add(prism(4, 0.3, 0.1, 0.03, Math.PI / 4), mix(c, '#000', 0.4), 'paint', X(0, 0.74));
            add(sph(0.18, 18, 12), '#ffd34d', 'glow', X(0, 0.86), [6, 0, 4, 0], [0, 0.86, 0]);
            for (let i = 0; i < 8; i++) {
                const t = i * TAU / 8 + Math.PI / 8;
                add(cone(0.12, 0.42, 8), '#e8862a', 'gloss', X(Math.cos(t) * 0.98, 0.36, Math.sin(t) * 0.98, 0, -t, -Math.PI / 2), [2, 0, 0.6, 0]);
            }
            return { stride: 1.6, bob: 0.02 };
        },
        // Boss: a yellow hive on short legs, its pods glowing
        spawner(c) {
            add(sph(1, 30, 20), paint(c, 0.15), 'gloss', X(0, 0.66, 0, 0, 0, 0, 0.92, 0.66, 0.92));
            add(torus(0.88, 0.07, 36, 8), '#8a7614', 'paint', X(0, 0.5));
            [[0.3, -0.35, 0.18], [-0.35, 0.25, 0.22], [0.15, 0.4, 0.14], [-0.4, -0.3, 0.12], [0.5, 0.15, 0.1]].forEach(([x, z, r], i) => {
                const y = 0.66 + 0.6 * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / 0.85));
                add(sph(r * 1.25, 14, 10), '#9a8414', 'paint', X(x, y - 0.03, z, 0, 0, 0, 1, 0.5, 1));
                add(sph(r * 0.7, 12, 8), '#fff6b0', 'glow', X(x, y + 0.02, z), [6, i * 1.3, 5, 0], [x, y, z]);
            });
            add(sph(0.2, 16, 12), '#ff8a2a', 'glow', X(0, 1.08, 0, 0, 0, 0, 1, 0.6, 1));
            for (let i = 0; i < 6; i++) {
                const t = i * TAU / 6 + 0.3;
                const hip = [Math.cos(t) * 0.7, 0.4, Math.sin(t) * 0.7];
                const foot = [Math.cos(t) * 1.05, 0.0, Math.sin(t) * 1.05];
                add(rod(hip, foot, 0.08, 0.05, 7), OUT, 'dark', null, [1, (i % 2) * Math.PI, 0.3, 0], hip);
            }
            return { stride: 1.5, bob: 0.03 };
        }
    };

    const enemyCache = new Map();
    // { geo, fly, stride, hop, bob, spin } per enemy kind
    function enemy(name) {
        if (enemyCache.has(name)) return enemyCache.get(name);
        const art = Art.ENEMY_ART[name];
        begin();
        const info = (ENEMIES[name] || ENEMIES.weak)(art.color);
        const geo = finish();
        const out = Object.assign({ geo, fly: 0, stride: 0, hop: false, bob: 0, spin: false }, info);
        enemyCache.set(name, out);
        return out;
    }

    // ---------- Trees ----------
    // Pines: a bark trunk and stacked, uneven boughs in deep greens (snow-capped on
    // Frost). About a tile tall at the map's tree scale.
    function bough(r, h, seed, seg = 10) {
        const g = new T3.ConeGeometry(r, h, seg, 3);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
            const a = Math.atan2(z, x);
            const k = 1 + 0.16 * Math.sin(a * 3 + seed) + 0.1 * Math.sin(a * 7 + seed * 2.3) + (y < -h * 0.4 ? 0.06 * Math.sin(a * 11 + seed) : 0);
            p.setXYZ(i, x * k, y + (y < -h * 0.4 ? -0.02 * Math.sin(a * 5 + seed) : 0), z * k);
        }
        g.computeVertexNormals();
        return g;
    }
    const treeCache = new Map();
    function tree(kind) {
        if (treeCache.has(kind)) return treeCache.get(kind);
        const large = /Large/.test(kind);
        const snow = /snow/.test(kind);
        const H = large ? 0.78 : 0.6;
        begin();
        add(cyl(0.022 * (large ? 1.3 : 1), 0.035 * (large ? 1.3 : 1), H * 0.36, 7), '#4b3a2b', 'stone', X(0, H * 0.18));
        const layers = large ? 4 : 3;
        const greens = ['#2c4a2b', '#33532f', '#2a4429', '#375a33'];
        for (let i = 0; i < layers; i++) {
            const f = i / layers;
            const r = (large ? 0.27 : 0.23) * (1 - f * 0.62);
            const h = H * (0.42 - f * 0.06);
            const y = H * (0.2 + f * 0.72 / layers * 2.6) + h / 2;
            add(bough(r, h, i * 1.7 + (large ? 3 : 0)), greens[i % greens.length], [0, 0.82, 0], X(0, Math.min(y, H - h / 2 + 0.02), 0, 0, i * 0.7, 0));
            if (snow) add(bough(r * 0.8, h * 0.45, i * 1.7 + 5), '#eef3f6', [0, 0.6, 0], X(0, Math.min(y, H - h / 2 + 0.02) + h * 0.3, 0, 0, i * 0.7 + 0.3, 0));
        }
        const g = finish();
        treeCache.set(kind, g);
        return g;
    }

    function init(three) {
        T3 = three;
        mtx = new T3.Matrix4();
        void mtx;
    }

    return {
        init, tower, enemy, tree, materials, uTime, PY,
        // used by the tests and the portrait tool
        get towerNames() { return Object.keys(TOWERS); },
        get enemyNames() { return Object.keys(ENEMIES); }
    };
})();
