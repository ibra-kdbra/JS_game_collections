// The 3D presentation: island, sea, characters, effects and camera.
// It only draws; js/game.js owns the rules state and tells it what to animate.
import * as THREE from 'three';
import { SEA, WALL, DELTA, tileAt, wizardAt } from './rules.js';
import { createWarrior, createEnemy, createWizard, createRockGeometries, mat } from './models.js';

const TAU = Math.PI * 2;
const ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    outCubic: (t) => 1 - (1 - t) ** 3,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
const lerp = (a, b, t) => a + (b - a) * t;
const ANGLE = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };

// ---------------------------------------------------------------- water --
const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
#include <fog_pars_vertex>
float wave(vec2 p, float t) {
    return sin(p.x * 1.1 + t * 1.1) * 0.045 + sin(p.y * 1.5 - t * 1.4) * 0.035 + sin((p.x + p.y) * 0.6 + t * 0.7) * 0.05;
}
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    world.y += wave(world.xz, uTime);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform sampler2D uMask;
uniform vec4 uRect;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
uniform vec3 uSun;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
    float t = uTime;
    vec2 p = vWorld.xz;
    // Analytic slope of the vertex waves plus finer ripples, for lighting.
    float dx = cos(p.x * 1.1 + t * 1.1) * 0.05 + cos((p.x + p.y) * 0.6 + t * 0.7) * 0.03
             + cos(p.x * 5.3 + p.y * 2.1 + t * 2.3) * 0.05;
    float dz = -sin(p.y * 1.5 - t * 1.4) * 0.0 + cos(p.y * 1.5 - t * 1.4) * 0.052 + cos((p.x + p.y) * 0.6 + t * 0.7) * 0.03
             + cos(p.y * 4.7 - p.x * 1.7 - t * 1.9) * 0.05;
    vec3 n = normalize(vec3(-dx, 1.0, -dz));
    vec2 uv = (p - uRect.xy) / uRect.zw;
    float land = texture2D(uMask, uv).r;
    vec3 col = mix(uDeep, uShallow, smoothstep(0.02, 0.75, land));
    // Foam hugging the shore, breathing with the waves.
    float edge = land + sin(t * 1.8 + (p.x * 2.0 + p.y * 1.3)) * 0.05;
    float foam = smoothstep(0.5, 0.62, edge) * 0.55;
    foam += smoothstep(0.28, 0.31, edge) * (1.0 - smoothstep(0.31, 0.36, edge)) * 0.45;
    col = mix(col, uFoam, clamp(foam, 0.0, 1.0));
    vec3 v = normalize(cameraPosition - vWorld);
    vec3 h = normalize(v + uSun);
    float spec = pow(max(dot(n, h), 0.0), 90.0) * 0.9;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    col += spec * vec3(1.0, 0.92, 0.75) + fres * vec3(0.25, 0.35, 0.45);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
}`;

function createWater() {
    const uniforms = THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
            uTime: { value: 0 },
            uMask: { value: null },
            uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
            uDeep: { value: new THREE.Color(0x0b3b5c) },
            uShallow: { value: new THREE.Color(0x1fa6b8) },
            uFoam: { value: new THREE.Color(0xf1fbff) },
            uSun: { value: new THREE.Vector3(0.4, 0.8, 0.45).normalize() },
        },
    ]);
    const material = new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, fog: true });
    const geo = new THREE.PlaneGeometry(70, 70, 70, 70);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, material);
    water.position.y = -0.32;
    water.receiveShadow = false;
    return water;
}

/** Blurred land mask so the water knows where the shore is. */
function shoreMask(level, pad) {
    const res = 8;
    const w = (level.width + pad * 2) * res;
    const h = (level.height + pad * 2) * res;
    let a = new Float32Array(w * h);
    for (let z = 0; z < level.height; z++) {
        for (let x = 0; x < level.width; x++) {
            if (tileAt(level, x, z) === SEA) continue;
            for (let j = 0; j < res; j++) {
                for (let i = 0; i < res; i++) a[((z + pad) * res + j) * w + (x + pad) * res + i] = 1;
            }
        }
    }
    // Three box-blur passes approximate a gaussian falloff around the island.
    const r = 5;
    let b = new Float32Array(w * h);
    for (let pass = 0; pass < 3; pass++) {
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
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
        const v = Math.min(255, Math.round(Math.min(1, a[i] * 1.6) * 255));
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
        data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

// ------------------------------------------------------------ particles --
function dotTexture() {
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

class Particles {
    constructor(scene, max = 360) {
        this.max = max;
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.vel = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.grav = new Float32Array(max);
        this.base = new Float32Array(max * 3);
        this.next = 0;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
        this.points = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                size: 0.16,
                map: dotTexture(),
                vertexColors: true,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
            }),
        );
        this.points.frustumCulled = false;
        this.pos.fill(-999);
        scene.add(this.points);
    }

    burst(at, { count = 20, colors = [0xffffff], speed = 2, up = 1.5, gravity = 6, life = 0.8, spread = 0.15 } = {}) {
        const c = new THREE.Color();
        for (let n = 0; n < count; n++) {
            const i = this.next;
            this.next = (this.next + 1) % this.max;
            const a = Math.random() * TAU;
            const s = speed * (0.4 + Math.random() * 0.6);
            this.pos[i * 3] = at.x + (Math.random() - 0.5) * spread;
            this.pos[i * 3 + 1] = at.y + Math.random() * spread;
            this.pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread;
            this.vel[i * 3] = Math.cos(a) * s;
            this.vel[i * 3 + 1] = up * (0.5 + Math.random());
            this.vel[i * 3 + 2] = Math.sin(a) * s;
            this.life[i] = this.maxLife[i] = life * (0.6 + Math.random() * 0.6);
            this.grav[i] = gravity;
            c.set(colors[n % colors.length]);
            this.base[i * 3] = c.r;
            this.base[i * 3 + 1] = c.g;
            this.base[i * 3 + 2] = c.b;
        }
    }

    update(dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                this.pos[i * 3 + 1] = -999;
                this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
                continue;
            }
            this.vel[i * 3 + 1] -= this.grav[i] * dt;
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            const k = Math.min(1, (this.life[i] / this.maxLife[i]) * 1.6);
            this.col[i * 3] = this.base[i * 3] * k;
            this.col[i * 3 + 1] = this.base[i * 3 + 1] * k;
            this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
        }
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
    }
}

// ----------------------------------------------------------------- world --
export class World {
    constructor(container, { onFrame } = {}) {
        this.container = container;
        this.onFrame = onFrame;
        const coarse = matchMedia('(pointer: coarse)').matches;
        this.renderer = new THREE.WebGLRenderer({ antialias: !coarse || devicePixelRatio < 2, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        const fog = 0x0a1620;
        this.scene.background = new THREE.Color(fog);
        this.scene.fog = new THREE.Fog(fog, 14, 34);
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);

        this.scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3b2f1e, 0.6));
        this.sun = new THREE.DirectionalLight(0xfff1d6, 0.9);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
        this.sun.shadow.bias = -0.0008;
        this.sun.shadow.normalBias = 0.02;
        this.scene.add(this.sun, this.sun.target);
        const rim = new THREE.DirectionalLight(0x7dd3fc, 0.35);
        rim.position.set(-6, 5, -8);
        this.scene.add(rim);

        this.water = createWater();
        this.scene.add(this.water);
        this.particles = new Particles(this.scene);
        this.rockGeos = createRockGeometries();

        this.board = new THREE.Group();
        this.scene.add(this.board);
        this.hero = createWarrior();
        this.scene.add(this.hero);
        this.wizard = createWizard();
        this.scene.add(this.wizard);
        this.fx = new THREE.Group();
        this.scene.add(this.fx);

        this.tweens = new Set();
        // ?speed=N plays animations N times faster (handy for automated checks).
        this.timeScale = Math.max(0.25, Math.min(8, Number(new URLSearchParams(location.search).get('speed')) || 1));
        this.time = 0;
        this.view = { azimuth: 0, polar: 0.92, zoom: 1, targetAz: 0, targetPolar: 0.92, targetZoom: 1 };
        this.insets = { top: 0, bottom: 0 };
        this.enemies = [];
        this.highlights = [];
        this.heat = null;

        this.clock = new THREE.Clock();
        this.renderer.setAnimationLoop(() => this.frame());
        new ResizeObserver(() => this.resize()).observe(container);
        this.resize();
    }

    // ---- coordinates
    world(x, z, y = 0) {
        return new THREE.Vector3(x - this.cx, y, z - this.cz);
    }

    // ---- level build
    build(level, state) {
        this.level = level;
        this.cx = (level.width - 1) / 2;
        this.cz = (level.height - 1) / 2;
        for (const t of this.tweens) t.cancel?.();
        this.tweens.clear();
        this.board.traverse((o) => {
            if (o.isMesh && o.geometry && !this.rockGeos.includes(o.geometry)) o.geometry.dispose();
            if (o.isInstancedMesh && o.material !== mat(0xffffff)) o.material.dispose();
        });
        this.board.clear();
        this.fx.clear();
        this.highlights = [];
        this.heat = null;

        // Tiles: one instanced mesh for grass, one for stone, each a tall block
        // reaching under the water so the island has cliffs.
        const land = [];
        const rock = [];
        for (let z = 0; z < level.height; z++) {
            for (let x = 0; x < level.width; x++) {
                const t = tileAt(level, x, z);
                if (t === SEA) continue;
                (t === WALL ? rock : land).push({ x, z });
            }
        }
        // Each tile is a solid earth block reaching under the water (the island's
        // cliffs) with a slightly smaller cap on top, so the grid reads clearly.
        const colored = (g, pick) => {
            const colors = [];
            const n = g.attributes.normal;
            const p = g.attributes.position;
            for (let i = 0; i < n.count; i++) {
                const c = pick(n.getY(i), p.getY(i));
                colors.push(c.r, c.g, c.b);
            }
            g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            return g;
        };
        const earthTop = new THREE.Color(0x4a3524);
        const earth = new THREE.Color(0x8a5a35);
        const earthDeep = new THREE.Color(0x3d2a1c);
        const baseGeo = colored(new THREE.BoxGeometry(1, 1.5, 1).translate(0, -0.83, 0), (ny, y) => (ny > 0.5 ? earthTop : y > -0.3 ? earth : earthDeep));
        const capGeo = (top, side) => {
            const a = new THREE.Color(top);
            const b = new THREE.Color(side);
            return colored(new THREE.BoxGeometry(0.93, 0.14, 0.93).translate(0, -0.07, 0), (ny) => (ny > 0.5 ? a : b));
        };
        const instanced = (list, geo, shade) => {
            if (!list.length) return;
            const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }), list.length);
            const o = new THREE.Object3D();
            const c = new THREE.Color();
            list.forEach(({ x, z }, i) => {
                o.position.copy(this.world(x, z));
                o.updateMatrix();
                m.setMatrixAt(i, o.matrix);
                if (shade) {
                    const checker = (x + z) % 2 ? 1.0 : 0.88;
                    const jitter = 0.95 + ((x * 7 + z * 13) % 5) * 0.02;
                    c.setScalar(checker * jitter);
                    m.setColorAt(i, c);
                }
            });
            m.receiveShadow = true;
            this.board.add(m);
        };
        instanced([...land, ...rock], baseGeo, false);
        instanced(land, capGeo(0x4f9636, 0x3c7228), true);
        instanced(rock, capGeo(0x6f7580, 0x555a63), true);

        // Boulders on rock tiles: one instanced mesh per boulder shape.
        const o = new THREE.Object3D();
        const tint = new THREE.Color();
        this.rockGeos.forEach((geo, g) => {
            const mine = rock.filter(({ x, z }) => (x * 3 + z * 5) % this.rockGeos.length === g);
            if (!mine.length) return;
            const m = new THREE.InstancedMesh(geo, mat(0xffffff), mine.length);
            mine.forEach(({ x, z }, i) => {
                o.position.copy(this.world(x, z));
                o.rotation.set(0, ((x * 31 + z * 17) % 12) * 0.5, 0);
                o.updateMatrix();
                m.setMatrixAt(i, o.matrix);
                m.setColorAt(i, tint.set((x + z) % 2 ? 0x7d8590 : 0x737b86));
            });
            m.castShadow = true;
            m.receiveShadow = true;
            this.board.add(m);
        });

        // Tufts of grass and the odd flower, for life (one instanced mesh).
        const tufts = [];
        land.forEach(({ x, z }) => {
            const r = (x * 73 + z * 151) % 11;
            if (r > 3) return;
            for (let k = 0; k < 3; k++) {
                const p = this.world(x, z, 0.06);
                p.x += (((r + k * 5) % 7) / 7 - 0.5) * 0.7;
                p.z += (((r * 3 + k * 2) % 7) / 7 - 0.5) * 0.7;
                tufts.push({ p, flower: k === 2 && r === 0 });
            }
        });
        if (tufts.length) {
            const m = new THREE.InstancedMesh(new THREE.ConeGeometry(0.035, 0.12, 3), mat(0xffffff), tufts.length);
            o.rotation.set(0, 0, 0);
            tufts.forEach(({ p, flower }, i) => {
                o.position.copy(p);
                o.updateMatrix();
                m.setMatrixAt(i, o.matrix);
                m.setColorAt(i, tint.set(flower ? 0xfde047 : 0x3f8a25));
            });
            this.board.add(m);
        }

        // Wizard spots: glowing rune rings.
        this.spotRings = level.wizardSpots.map((s) => {
            const g = new THREE.Group();
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(0.3, 0.4, 24),
                new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
            );
            ring.rotation.x = -Math.PI / 2;
            const inner = new THREE.Mesh(
                new THREE.RingGeometry(0.16, 0.2, 6),
                new THREE.MeshBasicMaterial({ color: 0xc4b5fd, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
            );
            inner.rotation.x = -Math.PI / 2;
            g.add(ring, inner);
            g.position.copy(this.world(s.x, s.z, 0.015));
            this.board.add(g);
            return g;
        });

        // Water knows where the shore is.
        const pad = 4;
        this.water.material.uniforms.uMask.value?.dispose();
        this.water.material.uniforms.uMask.value = shoreMask(level, pad);
        this.water.material.uniforms.uRect.value.set(-this.cx - 0.5 - pad, -this.cz - 0.5 - pad, level.width + pad * 2, level.height + pad * 2);

        // Characters.
        for (const e of this.enemies) this.scene.remove(e);
        this.enemies = level.enemies.map((e, i) => {
            const m = createEnemy(i);
            m.position.copy(this.world(e.x, e.z));
            m.userData.phase = i * 1.7;
            this.scene.add(m);
            return m;
        });
        this.wizard.visible = level.wizardSpots.length > 0;

        // Sun and shadows sized to the board.
        const span = Math.max(level.width, level.height) / 2 + 1.5;
        this.sun.position.set(5, 11, 7);
        this.sun.target.position.set(0, 0, 0);
        Object.assign(this.sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 30 });
        this.sun.shadow.camera.updateProjectionMatrix();

        this.view.targetAz = this.view.azimuth = 0;
        this.view.targetPolar = this.view.polar = this.defaultPolar();
        this.view.targetZoom = this.view.zoom = 1;
        this.fitCamera();
        this.sync(state);
        this.introduce();
    }

    /** Place everything to match `state` instantly. */
    sync(state, { facing } = {}) {
        const level = this.level;
        this.hero.position.copy(this.world(state.x, state.z));
        this.hero.visible = true;
        this.hero.rotation.set(0, facing !== undefined ? ANGLE[facing] : this.hero.rotation.y, 0);
        this.hero.scale.setScalar(1);
        this.hero.userData.parts.body.rotation.set(0, 0, 0);
        this.hero.userData.parts.body.position.set(0, 0, 0);
        this.enemies.forEach((m, i) => {
            const alive = (state.alive >>> i) & 1;
            m.visible = !!alive;
            m.position.copy(this.world(level.enemies[i].x, level.enemies[i].z));
            m.rotation.set(0, m.rotation.y, 0);
            m.scale.setScalar(1);
        });
        const w = wizardAt(level, state);
        if (w) {
            this.wizard.position.copy(this.world(w.x, w.z));
            this.wizard.scale.setScalar(1);
        }
        this.wizIdx = state.wiz;
    }

    /** A little drop-in when a level appears. */
    introduce() {
        const all = [this.hero, ...this.enemies, ...(this.wizard.visible ? [this.wizard] : [])];
        all.forEach((m, i) => {
            const y = m.position.y;
            m.position.y = y + 3;
            this.tween(0.45, (t) => (m.position.y = y + 3 * (1 - ease.outCubic(t))), { delay: 0.05 * i });
        });
        this.board.position.y = -0.6;
        this.tween(0.5, (t) => (this.board.position.y = -0.6 * (1 - ease.outBack(t))));
    }

    // ---- tweens
    tween(duration, fn, { delay = 0 } = {}) {
        return new Promise((resolve) => {
            const tw = { start: this.time + delay, duration, fn, resolve };
            tw.cancel = () => resolve();
            this.tweens.add(tw);
        });
    }

    wait(seconds) {
        return this.tween(seconds, () => {});
    }

    // ---- animations
    face(dir) {
        const target = ANGLE[dir];
        const from = this.hero.rotation.y;
        let d = target - from;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        return this.tween(0.08, (t) => (this.hero.rotation.y = from + d * ease.outQuad(t)));
    }

    /**
     * Animate a slide result from rules.slide(). `cb.onDefeat(enemy)` and
     * `cb.onStop()` / `cb.onFall()` fire at the right moments for sound.
     */
    async slide(from, dir, result, cb = {}, speed = 1) {
        await this.face(dir);
        const parts = this.hero.userData.parts;
        const start = this.world(from.x, from.z);
        const end = result.path[result.path.length - 1];
        const endPos = this.world(end.x, end.z);
        const n = result.path.length;
        const dur = (0.1 + 0.07 * n) / speed;
        const { dx, dz } = DELTA[dir];
        let dustT = 0;
        await this.tween(dur, (t) => {
            const k = result.event === 'fall' ? ease.inQuad(t) : ease.inOutCubic(t);
            this.hero.position.lerpVectors(start, endPos, k);
            parts.body.rotation.x = Math.sin(t * Math.PI) * 0.35;
            if (t - dustT > 0.12) {
                dustT = t;
                this.particles.burst(this.hero.position.clone().add(new THREE.Vector3(0, 0.05, 0)), {
                    count: 2,
                    colors: [0xd6c3a1, 0xb59f7a],
                    speed: 0.3,
                    up: 0.6,
                    gravity: 2,
                    life: 0.45,
                });
            }
        });
        parts.body.rotation.x = 0;

        if (result.event === 'defeat') {
            cb.onDefeat?.(result.enemy);
            this.defeat(result.enemy, dx, dz);
            await this.tween(0.16, (t) => {
                parts.swordArm.rotation.x = -Math.sin(t * Math.PI) * 1.6;
            });
            parts.swordArm.rotation.x = 0;
        } else if (result.event === 'stop') {
            cb.onStop?.();
            this.particles.burst(endPos.clone().add(new THREE.Vector3(dx * 0.35, 0.1, dz * 0.35)), {
                count: 8,
                colors: [0xd6c3a1, 0xffffff],
                speed: 0.8,
                up: 0.8,
                gravity: 4,
                life: 0.4,
            });
            await this.tween(0.16, (t) => {
                const s = Math.sin(t * Math.PI);
                this.hero.scale.set(1 + s * 0.12, 1 - s * 0.15, 1 + s * 0.12);
            });
            this.hero.scale.setScalar(1);
        } else if (result.event === 'fall') {
            await this.fall(dx, dz, cb);
        }
    }

    async fall(dx, dz, cb) {
        const p0 = this.hero.position.clone();
        await this.tween(0.4, (t) => {
            this.hero.position.set(p0.x + dx * 0.6 * t, p0.y + 0.5 * Math.sin(t * Math.PI * 0.6) - 1.6 * t * t, p0.z + dz * 0.6 * t);
            this.hero.rotation.x = t * 1.2 * (dz || 0);
            this.hero.rotation.z = -t * 1.2 * (dx || 0);
        });
        cb.onFall?.();
        const at = this.hero.position.clone();
        at.y = -0.3;
        this.splash(at);
        this.hero.visible = false;
        this.hero.rotation.x = this.hero.rotation.z = 0;
        await this.wait(0.35);
    }

    splash(at) {
        this.particles.burst(at, { count: 40, colors: [0xffffff, 0xbae6fd, 0x7dd3fc], speed: 1.6, up: 3.2, gravity: 9, life: 0.9, spread: 0.3 });
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.28, 28),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }),
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(at).setY(-0.26);
        this.fx.add(ring);
        this.tween(0.9, (t) => {
            ring.scale.setScalar(1 + t * 4);
            ring.material.opacity = 0.8 * (1 - t);
        }).then(() => {
            this.fx.remove(ring);
            ring.geometry.dispose();
        });
    }

    defeat(i, dx, dz) {
        const m = this.enemies[i];
        const p0 = m.position.clone();
        this.particles.burst(p0.clone().add(new THREE.Vector3(0, 0.45, 0)), {
            count: 36,
            colors: [0xfacc15, 0xfff3b0, 0xf97316, 0xffffff],
            speed: 2.4,
            up: 2.2,
            gravity: 5,
            life: 0.7,
        });
        this.tween(0.55, (t) => {
            m.position.set(p0.x + dx * 1.2 * t, p0.y + Math.sin(t * Math.PI) * 1.1, p0.z + dz * 1.2 * t);
            m.rotation.x = t * 5 * (dz || 1);
            m.rotation.z = -t * 5 * dx;
            m.scale.setScalar(Math.max(0.001, 1 - ease.inQuad(t)));
        }).then(() => {
            m.visible = false;
            m.rotation.set(0, 0, 0);
        });
    }

    async magic(level, from, to, speed = 1) {
        const a = level.wizardSpots[from];
        const b = level.wizardSpots[to];
        const pa = this.world(a.x, a.z);
        const pb = this.world(b.x, b.z);
        const sparkle = { count: 26, colors: [0xc4b5fd, 0xfacc15, 0xffffff], speed: 0.9, up: 2.2, gravity: -0.5, life: 0.8, spread: 0.4 };
        this.particles.burst(pa.clone().add(new THREE.Vector3(0, 0.3, 0)), sparkle);
        await this.tween(0.2 / speed, (t) => {
            this.wizard.scale.set(1 - t, 1 + t * 0.6, 1 - t);
            this.wizard.rotation.y = t * 6;
        });
        this.wizard.position.copy(pb);
        this.wizIdx = to;
        this.particles.burst(pb.clone().add(new THREE.Vector3(0, 0.3, 0)), sparkle);
        await this.tween(0.24 / speed, (t) => {
            const k = ease.outBack(t);
            this.wizard.scale.set(k, 1.6 - 0.6 * k, k);
            this.wizard.rotation.y = 6 + t * 0.28;
        });
        this.wizard.scale.setScalar(1);
    }

    celebrate() {
        const p = this.hero.position.clone();
        for (let k = 0; k < 4; k++) {
            setTimeout(() => {
                this.particles.burst(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.8, (Math.random() - 0.5) * 2)), {
                    count: 40,
                    colors: [0xfacc15, 0xffffff, 0xfde68a, 0x38bdf8],
                    speed: 2.6,
                    up: 3,
                    gravity: 4,
                    life: 1.2,
                });
            }, k * 180);
        }
        const parts = this.hero.userData.parts;
        this.tween(0.9, (t) => {
            this.hero.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.35;
            parts.swordArm.rotation.x = -Math.min(1, t * 3) * 2.6;
        }).then(() => {
            this.hero.position.y = 0;
            parts.swordArm.rotation.x = 0;
        });
    }

    // ---- hint / AI overlays
    clearHighlights() {
        for (const h of this.highlights) {
            this.fx.remove(h);
            h.geometry.dispose();
        }
        this.highlights = [];
    }

    /** Glowing tiles along a planned slide, or on the wizard's next spot. */
    showHint(cells, { color = 0xfacc15, arrowDir = null } = {}) {
        this.clearHighlights();
        cells.forEach((c, i) => {
            const m = new THREE.Mesh(
                new THREE.PlaneGeometry(0.9, 0.9),
                new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
            );
            m.rotation.x = -Math.PI / 2;
            m.position.copy(this.world(c.x, c.z, 0.02));
            m.userData.phase = i * 0.5;
            m.userData.pulse = true;
            this.fx.add(m);
            this.highlights.push(m);
        });
        if (arrowDir) {
            const shape = new THREE.Shape();
            shape.moveTo(0, 0.32);
            shape.lineTo(0.26, 0);
            shape.lineTo(0.1, 0);
            shape.lineTo(0.1, -0.3);
            shape.lineTo(-0.1, -0.3);
            shape.lineTo(-0.1, 0);
            shape.lineTo(-0.26, 0);
            shape.closePath();
            const arrow = new THREE.Mesh(
                new THREE.ShapeGeometry(shape),
                new THREE.MeshBasicMaterial({ color: 0xfff7cc, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
            );
            arrow.rotation.x = -Math.PI / 2;
            arrow.rotation.z = { up: 0, down: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[arrowDir];
            const p = this.hero.position.clone();
            const { dx, dz } = DELTA[arrowDir];
            arrow.position.set(p.x + dx * 0.62, 0.05, p.z + dz * 0.62);
            arrow.userData.pulse = true;
            arrow.userData.phase = 0;
            this.fx.add(arrow);
            this.highlights.push(arrow);
        }
    }

    /**
     * Visualise a search: tiles light up in the order the solver expanded
     * states there, building a heat map of where it "thought".
     */
    async showSearch(trace, seconds = 1.4) {
        this.clearHeat();
        const level = this.level;
        const counts = new Float32Array(level.width * level.height);
        const geo = new THREE.PlaneGeometry(0.94, 0.94);
        const tiles = new Map();
        const tileFor = (idx) => {
            if (!tiles.has(idx)) {
                const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
                m.rotation.x = -Math.PI / 2;
                m.position.copy(this.world(idx % level.width, Math.floor(idx / level.width), 0.025));
                this.fx.add(m);
                tiles.set(idx, m);
            }
            return tiles.get(idx);
        };
        this.heat = { tiles, geo };
        let shown = 0;
        let max = 1;
        await this.tween(seconds, (t) => {
            const upto = Math.floor(trace.length * t);
            for (; shown < upto; shown++) {
                const idx = trace[shown];
                counts[idx]++;
                max = Math.max(max, counts[idx]);
                tileFor(idx).userData.flash = 1;
            }
            for (const [idx, m] of tiles) {
                const f = (m.userData.flash = Math.max(0, (m.userData.flash || 0) - 0.08));
                m.material.opacity = 0.12 + 0.45 * Math.sqrt(counts[idx] / max) + f * 0.35;
            }
        });
    }

    clearHeat() {
        if (!this.heat) return;
        for (const m of this.heat.tiles.values()) {
            this.fx.remove(m);
            m.material.dispose();
        }
        this.heat.geo.dispose();
        this.heat = null;
    }

    fadeHeat() {
        if (!this.heat) return;
        const tiles = [...this.heat.tiles.values()];
        const start = tiles.map((m) => m.material.opacity);
        this.tween(0.6, (t) => tiles.forEach((m, i) => (m.material.opacity = start[i] * (1 - t) * 0.5 + start[i] * 0.15 * (1 - t))));
    }

    // ---- camera
    setInsets(insets) {
        this.insets = insets;
        this.fitCamera();
    }

    orbit(dAz, dPolar) {
        this.view.targetAz = Math.max(-0.7, Math.min(0.7, this.view.targetAz + dAz));
        this.view.targetPolar = Math.max(0.45, Math.min(1.18, this.view.targetPolar + dPolar));
    }

    zoomBy(f) {
        this.view.targetZoom = Math.max(0.6, Math.min(1.5, this.view.targetZoom * f));
    }

    resetView() {
        this.view.targetAz = 0;
        this.view.targetPolar = this.defaultPolar();
        this.view.targetZoom = 1;
    }

    /** Portrait phones get a steeper view so the board uses more of the tall screen. */
    defaultPolar() {
        const aspect = (this.container.clientWidth || 1) / (this.container.clientHeight || 1);
        return aspect < 0.8 ? 0.66 : 0.92;
    }

    resize() {
        const w = this.container.clientWidth || 1;
        const h = this.container.clientHeight || 1;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.fitCamera();
    }

    /** Find the camera distance that fits the board into the free part of the screen. */
    fitCamera() {
        if (!this.level) return;
        const W = this.container.clientWidth || 1;
        const H = this.container.clientHeight || 1;
        const free = Math.max(0.3, (H - this.insets.top - this.insets.bottom) / H);
        const cam = this.camera;
        cam.clearViewOffset();
        cam.aspect = W / H;
        cam.updateProjectionMatrix();
        const hw = this.level.width / 2 + 0.1;
        const hd = this.level.height / 2 + 0.1;
        const corners = [];
        for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-0.3, 0.9]) corners.push(new THREE.Vector3(x, y, z));
        const dir = this.viewDir(this.view.polar, this.view.azimuth);
        let near = 3;
        let far = 80;
        const v = new THREE.Vector3();
        for (let i = 0; i < 22; i++) {
            const mid = (near + far) / 2;
            cam.position.copy(dir).multiplyScalar(mid);
            cam.lookAt(0, 0, 0);
            cam.updateMatrixWorld();
            const ok = corners.every((c) => {
                v.copy(c).project(cam);
                return Math.abs(v.x) < (W < 600 ? 0.97 : 0.92) && Math.abs(v.y) < 0.9 * free;
            });
            if (ok) far = mid;
            else near = mid;
        }
        this.fitDistance = far;
        // Shift the image so the board centres in the free area between the HUD bars.
        const shift = (this.insets.top - this.insets.bottom) / 2;
        cam.setViewOffset(W, H, 0, -shift, W, H);
        this.applyCamera();
    }

    viewDir(polar, az) {
        return new THREE.Vector3(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    }

    applyCamera() {
        const d = (this.fitDistance || 12) / this.view.zoom;
        this.camera.position.copy(this.viewDir(this.view.polar, this.view.azimuth)).multiplyScalar(d);
        this.camera.lookAt(0, 0, 0);
        this.scene.fog.near = d * 0.9;
        this.scene.fog.far = d * 2.6;
    }

    // ---- frame
    frame() {
        const dt = Math.min(0.1, this.clock.getDelta()) * this.timeScale;
        this.time += dt;
        const t = this.time;
        for (const tw of [...this.tweens]) {
            if (t < tw.start) continue;
            const k = Math.min(1, (t - tw.start) / tw.duration);
            tw.fn(k);
            if (k >= 1) {
                this.tweens.delete(tw);
                tw.resolve();
            }
        }
        const v = this.view;
        const prev = `${v.azimuth.toFixed(4)}${v.polar.toFixed(4)}${v.zoom.toFixed(4)}`;
        v.azimuth += (v.targetAz - v.azimuth) * Math.min(1, dt * 8);
        v.polar += (v.targetPolar - v.polar) * Math.min(1, dt * 8);
        v.zoom += (v.targetZoom - v.zoom) * Math.min(1, dt * 8);
        if (prev !== `${v.azimuth.toFixed(4)}${v.polar.toFixed(4)}${v.zoom.toFixed(4)}`) {
            if (Math.abs(v.polar - (this.fittedPolar ?? v.polar)) > 0.02 || Math.abs(v.azimuth - (this.fittedAz ?? v.azimuth)) > 0.02) {
                this.fittedPolar = v.polar;
                this.fittedAz = v.azimuth;
                this.fitCamera();
            } else this.applyCamera();
        }

        // Idle life.
        if (this.level) {
            const hp = this.hero.userData.parts;
            hp.body.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02;
            hp.shieldArm.rotation.x = Math.sin(t * 2.2) * 0.05;
            this.enemies.forEach((m) => {
                if (!m.visible) return;
                const p = m.userData.parts;
                p.body.position.y = Math.abs(Math.sin(t * 3 + m.userData.phase)) * 0.04;
                p.spear.rotation.z = Math.sin(t * 1.5 + m.userData.phase) * 0.12;
                // Turn to watch the warrior.
                const a = Math.atan2(this.hero.position.x - m.position.x, this.hero.position.z - m.position.z);
                let d = a - m.rotation.y;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                m.rotation.y += d * Math.min(1, dt * 4);
            });
            if (this.wizard.visible) {
                const p = this.wizard.userData.parts;
                p.body.position.y = 0.04 + Math.sin(t * 1.8) * 0.04;
                p.crystal.rotation.y = t * 2;
                p.crystal.material.emissiveIntensity = 1.2 + Math.sin(t * 4) * 0.4;
                const a = Math.atan2(this.hero.position.x - this.wizard.position.x, this.hero.position.z - this.wizard.position.z);
                let d = a - this.wizard.rotation.y;
                d = Math.atan2(Math.sin(d), Math.cos(d));
                if (Math.abs(this.wizard.scale.x - 1) < 0.01) this.wizard.rotation.y += d * Math.min(1, dt * 3);
            }
            this.spotRings?.forEach((g, i) => {
                const active = i === this.wizIdx;
                g.rotation.y = t * (active ? 0.8 : 0.3);
                g.children[0].material.opacity = active ? 0.8 : 0.35 + Math.sin(t * 2 + i) * 0.1;
            });
            for (const h of this.highlights) {
                if (h.userData.pulse) h.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 6 - h.userData.phase));
            }
        }
        this.water.material.uniforms.uTime.value = t;
        this.particles.update(dt);
        this.onFrame?.(dt);
        this.renderer.render(this.scene, this.camera);
    }
}
