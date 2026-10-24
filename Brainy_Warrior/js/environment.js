// Sea and sky. The sea is one shader: vertex waves, two scrolling normal maps
// (painted at start-up), depth colour from a blurred land mask, breaking foam
// along the shore, sky reflection with Fresnel and a sun glint. The sky is a
// gradient dome with a sun glow; the fog fades the sea into its horizon colour.
import * as THREE from 'three';
import { SEA, tileAt } from './rules.js';

export const PALETTE = {
    zenith: new THREE.Color(0x2d6fb8),
    horizon: new THREE.Color(0xbfdcef),
    sun: new THREE.Color(0xffe2b0),
    deep: new THREE.Color(0x0b4a6e),
    shallow: new THREE.Color(0x27b5c4),
    foam: new THREE.Color(0xf4fbff),
};
export const SUN_DIR = new THREE.Vector3(0.62, 0.7, 0.2).normalize();

const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec2 p = world.xz;
    float t = uTime;
    world.y += sin(p.x * 0.9 + t * 1.1) * 0.035 + sin(p.y * 1.3 - t * 1.3) * 0.03 + sin((p.x + p.y) * 0.5 + t * 0.7) * 0.04;
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform sampler2D uMask;
uniform sampler2D uNormal;
uniform vec4 uRect;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform float uDetail;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
    float t = uTime;
    vec2 p = vWorld.xz;
#if WATER_DETAIL >= 2
    // Two normal maps drifting in different directions.
    vec4 s1 = texture2D(uNormal, p * 0.11 + vec2(t * 0.012, t * 0.007));
    vec4 s2 = texture2D(uNormal, p * 0.23 + vec2(-t * 0.009, t * 0.015));
    vec2 slope = (s1.xy + s2.xy - 1.0) * 2.0 * uDetail;
    float grain = s1.z * 0.6 + s2.z * 0.4;
#elif WATER_DETAIL == 1
    // One normal map.
    vec4 s1 = texture2D(uNormal, p * 0.15 + vec2(t * 0.012, t * 0.009));
    vec2 slope = (s1.xy - 0.5) * 3.0 * uDetail;
    float grain = s1.z;
#else
    // No textures: the slope of a few sine waves.
    vec2 slope = vec2(cos(p.x * 1.7 + p.y * 0.6 + t * 1.3) + cos(p.x * 4.1 - p.y * 2.3 + t * 2.1) * 0.5,
                      cos(p.y * 1.9 - p.x * 0.7 - t * 1.1) + cos(p.y * 3.7 + p.x * 2.9 - t * 1.7) * 0.5) * 0.35 * uDetail;
    float grain = 0.5 + 0.25 * (sin(p.x * 5.3 + t) * sin(p.y * 4.7 - t * 0.8));
#endif
    vec3 n = normalize(vec3(slope.x, 3.2, slope.y));
    vec2 uv = (p - uRect.xy) / uRect.zw;
    vec2 mask = texture2D(uMask, uv + n.xz * 0.004).rg;
    float land = mask.r;
    float shallow = smoothstep(0.0, 0.8, land);
    vec3 water = mix(uDeep, uShallow, shallow);
    // Sky reflection and Fresnel.
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uHorizon, uZenith, clamp(r.y * 1.4, 0.0, 1.0));
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 col = mix(water, sky, clamp(fres * 0.9, 0.0, 1.0));
    // Sun glint: a sharp spark and a broad sheen.
    vec3 h = normalize(v + uSunDir);
    float nh = max(dot(n, h), 0.0);
    col += uSunColor * (pow(nh, 220.0) * 1.6 + pow(nh, 24.0) * 0.12);
    // Foam: a steady band at the cliffs and waves rolling in towards them.
    float edge = mask.g + (grain - 0.5) * 0.25;
    float foam = smoothstep(0.12, 0.3, edge);
    float roll = sin(land * 22.0 - t * 1.8);
    foam += smoothstep(0.75, 1.0, roll) * smoothstep(0.15, 0.4, land) * (1.0 - smoothstep(0.6, 0.78, land)) * smoothstep(0.3, 0.7, grain) * 0.45;
    col = mix(col, uFoam, clamp(foam, 0.0, 0.9));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
    #include <fog_fragment>
}`;

/** A tileable normal map from layered noise, painted once on a canvas. */
function waterNormalTexture(size = 128) {
    const h = new Float32Array(size * size);
    const rand = (() => {
        let a = 7;
        return () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = Math.imul(a ^ (a >>> 15), a | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    })();
    let amp = 1;
    for (let o = 0; o < 4; o++) {
        const n = 4 << o;
        const g = Float32Array.from({ length: n * n }, rand);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const fx = (x / size) * n;
                const fy = (y / size) * n;
                const x0 = Math.floor(fx);
                const y0 = Math.floor(fy);
                const sx = (fx - x0) ** 2 * (3 - 2 * (fx - x0));
                const sy = (fy - y0) ** 2 * (3 - 2 * (fy - y0));
                const at = (i, j) => g[(j % n) * n + (i % n)];
                const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
                const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
                h[y * size + x] += (a + (b - a) * sy) * amp;
            }
        }
        amp *= 0.5;
    }
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
            const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
            const i = (y * size + x) * 4;
            data[i] = Math.max(0, Math.min(255, 128 + hx * 180));
            data[i + 1] = Math.max(0, Math.min(255, 128 + hy * 180));
            data[i + 2] = Math.max(0, Math.min(255, (h[y * size + x] / 1.875) * 255));
            data[i + 3] = 255;
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapNearestFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
}

/** `detail`: 2 = two normal maps, 1 = one, 0 = analytic waves (cheapest). */
export function createWater(detail = 2) {
    const uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
            uTime: { value: 0 },
            uMask: { value: null },
            uNormal: { value: null },
            uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
            uDeep: { value: PALETTE.deep.clone() },
            uShallow: { value: PALETTE.shallow.clone() },
            uFoam: { value: PALETTE.foam.clone() },
            uSunDir: { value: SUN_DIR.clone() },
            uSunColor: { value: PALETTE.sun.clone() },
            uZenith: { value: PALETTE.zenith.clone() },
            uHorizon: { value: PALETTE.horizon.clone() },
            uDetail: { value: 1 },
        },
    ]);
    uniforms.uNormal.value = waterNormalTexture();
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true, defines: { WATER_DETAIL: detail } });
    // Dense rings near the island for the vertex waves, sparse far away.
    const geo = new THREE.RingGeometry(0.001, 90, 64, 40);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const d = Math.hypot(x, y);
        const k = d > 0 ? (90 * Math.pow(d / 90, 1.8)) / d : 0;
        p.setXY(i, x * k, y * k);
    }
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, material);
    water.name = 'water';
    water.frustumCulled = false;
    // After the island and characters, so the hidden water under them is
    // rejected by the depth test instead of shaded.
    water.renderOrder = 5;
    return water;
}

/** Blurred land mask so the water knows how far it is from the shore. */
export function shoreMask(level, pad) {
    const res = 8;
    const w = (level.width + pad * 2) * res;
    const h = (level.height + pad * 2) * res;
    const land = new Float32Array(w * h);
    for (let z = 0; z < level.height; z++) {
        for (let x = 0; x < level.width; x++) {
            if (tileAt(level, x, z) === SEA) continue;
            for (let j = 0; j < res; j++) {
                for (let i = 0; i < res; i++) land[((z + pad) * res + j) * w + (x + pad) * res + i] = 1;
            }
        }
    }
    // Box blur passes approximate a gaussian falloff around the island: a wide
    // one (red) for the water's depth colour, a narrow one (green) for foam.
    const blur = (src, r, passes) => {
        const a = Float32Array.from(src);
        const b = new Float32Array(w * h);
        for (let pass = 0; pass < passes; pass++) {
            for (let y = 0; y < h; y++) {
                let acc = 0;
                for (let x = -r; x <= r; x++) acc += a[y * w + Math.min(w - 1, Math.max(0, x))];
                for (let x = 0; x < w; x++) {
                    b[y * w + x] = acc / (2 * r + 1);
                    acc += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
                }
            }
            for (let x = 0; x < w; x++) {
                let acc = 0;
                for (let y = -r; y <= r; y++) acc += b[Math.min(h - 1, Math.max(0, y)) * w + x];
                for (let y = 0; y < h; y++) {
                    a[y * w + x] = acc / (2 * r + 1);
                    acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
                }
            }
        }
        return a;
    };
    const wide = blur(land, 6, 3);
    const near = blur(land, 2, 2);
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        data[i * 4] = Math.min(255, Math.round(Math.min(1, wide[i] * 1.6) * 255));
        data[i * 4 + 1] = Math.min(255, Math.round(near[i] * 255));
        data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
}`;
const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
varying vec3 vDir;
void main() {
    vec3 d = normalize(vDir);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.25);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
}`;

export function createSky() {
    const material = new THREE.ShaderMaterial({
        uniforms: {
            uZenith: { value: PALETTE.zenith.clone() },
            uHorizon: { value: PALETTE.horizon.clone() },
            uSunColor: { value: PALETTE.sun.clone() },
            uSunDir: { value: SUN_DIR.clone() },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), material);
    sky.name = 'sky';
    sky.frustumCulled = false;
    // Drawn after everything opaque: at the far plane it only shades the
    // pixels nothing else covered (early depth test rejects the rest).
    sky.renderOrder = 10;
    return sky;
}
