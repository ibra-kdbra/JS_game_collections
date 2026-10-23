// The 3D presentation: island, sea, sky, characters, effects and camera.
// It only draws; js/game.js owns the rules state and tells it what to animate.
//
// Performance notes (see README, "Performance"):
//  * the island is one merged mesh plus three instanced meshes per level, and
//    each character is one skinned mesh, so a level costs a few dozen draw calls;
//  * nothing in frame() allocates: tweens, particles, camera and idle life all
//    reuse objects;
//  * quality adapts to the frame rate (pixel ratio, shadow map, grass), and
//    everything a level creates is disposed when the next one is built.
import './color.js';
import * as THREE from 'three';
import { DELTA, wizardAt } from './rules.js';
import { Actor, ENEMY_KINDS, loadActors } from './actors.js';
import { buildIsland, WATER_Y } from './island.js';
import { createGroundAtlas, dotTexture, runeTexture } from './textures.js';
import { createSky, createWater, shoreMask, PALETTE, SUN_DIR } from './environment.js';
import { PerfOverlay, Quality } from './perf.js';

const TAU = Math.PI * 2;
const ease = {
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    outCubic: (t) => 1 - (1 - t) ** 3,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
    outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
const ANGLE = { up: Math.PI, down: 0, left: -Math.PI / 2, right: Math.PI / 2 };
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
// Is a character over the island (not falling into the sea)?
const p0 = (a) => a.root.position.y > -0.3;

// Scratch objects, so animation code never allocates per frame.
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _c = new THREE.Color();

// ------------------------------------------------------------ particles --
class Particles {
    constructor(scene, max = 400) {
        this.max = max;
        this.pos = new Float32Array(max * 3);
        this.col = new Float32Array(max * 3);
        this.vel = new Float32Array(max * 3);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.grav = new Float32Array(max);
        this.base = new Float32Array(max * 3);
        this.next = 0;
        this.live = 0;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
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
            _c.set(colors[n % colors.length]);
            this.base[i * 3] = _c.r;
            this.base[i * 3 + 1] = _c.g;
            this.base[i * 3 + 2] = _c.b;
        }
        this.live = this.max;
    }

    update(dt) {
        if (!this.live) return;
        let alive = 0;
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt;
            if (this.life[i] <= 0) {
                this.pos[i * 3 + 1] = -999;
                this.col[i * 3] = this.col[i * 3 + 1] = this.col[i * 3 + 2] = 0;
                continue;
            }
            alive++;
            this.vel[i * 3 + 1] -= this.grav[i] * dt;
            this.pos[i * 3] += this.vel[i * 3] * dt;
            this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
            this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
            const k = Math.min(1, (this.life[i] / this.maxLife[i]) * 1.6);
            this.col[i * 3] = this.base[i * 3] * k;
            this.col[i * 3 + 1] = this.base[i * 3 + 1] * k;
            this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
        }
        this.live = alive;
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;
    }
}

// ----------------------------------------------------------------- world --
export class World {
    constructor(container) {
        this.container = container;
        const coarse = matchMedia('(pointer: coarse)').matches;
        this.quality = new Quality({ coarse, onChange: (s) => this.applyQuality(s) });
        this.renderer = new THREE.WebGLRenderer({ antialias: !coarse || devicePixelRatio < 2, powerPreference: 'high-performance' });
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        // Count the shadow pass too: reset the stats once per frame ourselves.
        this.renderer.info.autoReset = false;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(this.renderer.domElement);

        this.scene = new THREE.Scene();
        this.scene.background = PALETTE.horizon.clone();
        this.scene.fog = new THREE.Fog(PALETTE.horizon.clone(), 14, 34);
        this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 150);

        this.hemi = new THREE.HemisphereLight(0xdcefff, 0x5b4a32, 0.7);
        this.scene.add(this.hemi);
        this.sun = new THREE.DirectionalLight(0xfff0d8, 1.35);
        this.sun.castShadow = true;
        this.sun.shadow.bias = -0.0006;
        this.sun.shadow.normalBias = 0.025;
        this.sun.shadow.radius = 3;
        this.scene.add(this.sun, this.sun.target);
        const rim = new THREE.DirectionalLight(0x9fd8ff, 0.45);
        rim.position.set(-6, 4, -8);
        this.scene.add(rim);

        this.sky = createSky();
        this.scene.add(this.sky);
        this.water = createWater();
        this.water.position.y = WATER_Y;
        this.scene.add(this.water);
        this.particles = new Particles(this.scene);

        this.groundMaterial = new THREE.MeshLambertMaterial({ map: createGroundAtlas(), vertexColors: true });
        this.blobs = this.createBlobs();
        this.windUniforms = { uTime: { value: 0 } };
        this.runeTex = runeTexture();
        this.hintGeo = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
        this.fx = new THREE.Group();
        this.scene.add(this.fx);

        this.tweens = new Set();
        // ?speed=N plays animations N times faster (handy for automated checks).
        this.timeScale = Math.max(0.25, Math.min(8, Number(new URLSearchParams(location.search).get('speed')) || 1));
        this.time = 0;
        this.view = { azimuth: 0, polar: 0.92, zoom: 1, targetAz: 0, targetPolar: 0.92, targetZoom: 1 };
        this.fitted = { az: NaN, polar: NaN };
        this.insets = { top: 0, bottom: 0 };
        this.enemies = [];
        this.pool = new Map(); // enemy actors kept for reuse between levels
        this.highlights = [];
        this.heat = null;
        this.island = null;

        this.perf = PerfOverlay.enabled() ? new PerfOverlay(this.renderer, this.quality) : null;
        this.applyQuality(this.quality.settings);

        // Characters load lazily; the game waits on `ready` with a loading screen.
        this.ready = loadActors((p) => this.onProgress?.(p)).then((gltf) => {
            this.gltf = gltf;
            this.hero = new Actor('warrior');
            this.wizard = new Actor('wizard');
            this.scene.add(this.hero.root, this.wizard.root);
            this.hero.play('idle', { fade: 0 });
            this.wizard.play('idle', { fade: 0 });
            this.setCharacterShadows();
            return gltf;
        });

        this.clock = new THREE.Clock();
        this.lastFrame = performance.now();
        this.renderer.setAnimationLoop(() => this.frame());
        new ResizeObserver(() => this.resize()).observe(container);
        this.resize();
    }

    applyQuality(s) {
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, s.dpr));
        const type = s.soft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
        const recompile = this.sun.castShadow !== s.shadows || this.renderer.shadowMap.type !== type;
        this.sun.castShadow = s.shadows;
        this.renderer.shadowMap.type = type;
        if (this.sun.shadow.mapSize.x !== s.shadow) {
            this.sun.shadow.mapSize.set(s.shadow, s.shadow);
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }
        this.dynamicShadows = s.dynamicShadows;
        this.renderer.shadowMap.autoUpdate = s.dynamicShadows;
        this.renderer.shadowMap.needsUpdate = true;
        this.setCharacterShadows();
        this.blobs.material.opacity = s.dynamicShadows ? 0.3 : 0.5;
        this.water.material.uniforms.uDetail.value = s.waterDetail;
        if (this.water.material.defines.WATER_DETAIL !== s.water) {
            this.water.material.defines.WATER_DETAIL = s.water;
            this.water.material.needsUpdate = true;
        }
        if (recompile) this.scene.traverse((o) => o.material && (o.material.needsUpdate = true));
        this.resize();
    }

    /** Characters cast real shadows only when the shadow map is redrawn every frame. */
    setCharacterShadows() {
        const on = !!this.dynamicShadows;
        const set = (a) => a?.model.traverse((o) => o.isMesh && (o.castShadow = on));
        set(this.hero);
        set(this.wizard);
        for (const list of this.pool.values()) list.forEach(set);
        this.enemies.forEach(set);
    }

    /** Soft round contact shadows under the characters: one instanced mesh. */
    createBlobs() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(0,0,0,1)');
        grd.addColorStop(0.5, 'rgba(0,0,0,0.6)');
        grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        const tex = new THREE.CanvasTexture(c);
        const geo = new THREE.PlaneGeometry(0.8, 0.8).rotateX(-Math.PI / 2);
        const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, color: 0x0b1a10 }), 12);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        this.scene.add(mesh);
        this._blob = new THREE.Object3D();
        return mesh;
    }

    updateBlobs() {
        const o = this._blob;
        let n = 0;
        const put = (a, s) => {
            if (!a.root.visible) return;
            const p = a.root.position;
            const lift = Math.max(0, p.y);
            o.position.set(p.x, 0.015, p.z);
            o.scale.setScalar(s * a.root.scale.x * Math.max(0.3, 1 - lift * 0.5));
            o.updateMatrix();
            this.blobs.setMatrixAt(n++, o.matrix);
        };
        if (this.hero && p0(this.hero)) put(this.hero, 1);
        if (this.wizard?.root.visible && p0(this.wizard)) put(this.wizard, 1.05);
        for (const e of this.enemies) if (p0(e)) put(e, 1);
        this.blobs.count = n;
        this.blobs.instanceMatrix.needsUpdate = true;
    }

    // ---- coordinates
    world(x, z, y = 0, out = new THREE.Vector3()) {
        return out.set(x - this.cx, y, z - this.cz);
    }

    // ---- level build
    build(level, state) {
        this.level = level;
        this.cx = (level.width - 1) / 2;
        this.cz = (level.height - 1) / 2;
        for (const t of this.tweens) t.resolve();
        this.tweens.clear();
        this.clearHighlights();
        this.clearHeat();
        this.island?.dispose();
        for (const g of this.spotRings || []) {
            g.removeFromParent();
            g.material.dispose();
        }
        this.quality.pause(1.5);

        this.island = buildIsland(level, (x, z, y) => this.world(x, z, y), {
            groundMaterial: this.groundMaterial,
            windUniforms: this.windUniforms,
            quality: this.quality.settings.grass,
        });
        this.scene.add(this.island.group);
        this.shadowY = NaN;

        // Wizard spots: glowing rune circles.
        this.spotRings = level.wizardSpots.map((s) => {
            const m = new THREE.Mesh(
                this.hintGeo,
                new THREE.MeshBasicMaterial({ map: this.runeTex, color: 0xfacc15, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }),
            );
            m.scale.setScalar(0.95);
            this.world(s.x, s.z, 0.012, m.position);
            this.scene.add(m);
            return m;
        });

        // Water knows where the shore is.
        const pad = 4;
        this.water.material.uniforms.uMask.value?.dispose();
        this.water.material.uniforms.uMask.value = shoreMask(level, pad);
        this.water.material.uniforms.uRect.value.set(-this.cx - 0.5 - pad, -this.cz - 0.5 - pad, level.width + pad * 2, level.height + pad * 2);

        // Enemies: reuse pooled actors, cycling through the three kinds.
        for (const e of this.enemies) {
            e.root.removeFromParent();
            this.pool.get(e.kind).push(e);
        }
        const used = new Map();
        this.enemies = level.enemies.map((e, i) => {
            const kind = ENEMY_KINDS[(i + (level.id?.length || 0)) % ENEMY_KINDS.length];
            if (!this.pool.has(kind)) this.pool.set(kind, []);
            const list = this.pool.get(kind);
            const n = used.get(kind) || 0;
            used.set(kind, n + 1);
            let a = list.pop();
            if (!a) {
                a = new Actor(kind, i);
                a.model.traverse((o) => o.isMesh && (o.castShadow = !!this.dynamicShadows));
            }
            a.phase = i * 1.7;
            a.nextTaunt = 3 + Math.random() * 8;
            a.dying = false;
            this.scene.add(a.root);
            a.play('idle', { fade: 0, speed: 0.9 + (i % 3) * 0.08 });
            if (a.current) a.current.time = Math.random() * a.current.getClip().duration;
            return a;
        });
        this.wizard.root.visible = level.wizardSpots.length > 0;

        // Sun and shadows sized to the board.
        const span = Math.max(level.width, level.height) / 2 + 1.2;
        this.sun.position.copy(SUN_DIR).multiplyScalar(14);
        this.sun.target.position.set(0, 0, 0);
        Object.assign(this.sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 2, far: 30 });
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
        const hero = this.hero;
        this.world(state.x, state.z, 0, hero.root.position);
        hero.root.visible = true;
        hero.root.rotation.set(0, facing !== undefined ? ANGLE[facing] : hero.root.rotation.y, 0);
        hero.root.scale.setScalar(1);
        hero.body.rotation.set(0, 0, 0);
        hero.body.position.set(0, 0, 0);
        hero.body.scale.setScalar(1);
        hero.play('idle', { fade: 0.1 });
        this.enemies.forEach((a, i) => {
            const alive = (state.alive >>> i) & 1;
            a.root.visible = !!alive;
            a.dying = false;
            this.world(level.enemies[i].x, level.enemies[i].z, 0, a.root.position);
            a.root.rotation.x = a.root.rotation.z = 0;
            a.root.scale.setScalar(1);
            a.body.position.set(0, 0, 0);
            if (alive) a.play('idle', { fade: 0.1 });
        });
        const w = wizardAt(level, state);
        if (w) {
            this.world(w.x, w.z, 0, this.wizard.root.position);
            this.wizard.root.scale.setScalar(1);
        }
        this.wizIdx = state.wiz;
    }

    /** A little drop-in when a level appears. */
    introduce() {
        const all = [this.hero, ...this.enemies, ...(this.wizard.root.visible ? [this.wizard] : [])];
        all.forEach((a, i) => {
            const p = a.root.position;
            p.y = 3;
            this.tween(0.45, (t) => (p.y = 3 * (1 - ease.outCubic(t))), { delay: 0.05 * i });
        });
        const g = this.island.group;
        g.position.y = -0.6;
        this.tween(0.5, (t) => (g.position.y = -0.6 * (1 - ease.outBack(t))));
    }

    // ---- tweens
    tween(duration, fn, { delay = 0 } = {}) {
        return new Promise((resolve) => {
            this.tweens.add({ start: this.time + delay, duration, fn, resolve });
        });
    }

    wait(seconds) {
        return this.tween(seconds, () => {});
    }

    // ---- animations
    face(dir) {
        const root = this.hero.root;
        const from = root.rotation.y;
        const d = angleTo(from, ANGLE[dir]);
        if (Math.abs(d) < 0.01) return Promise.resolve();
        return this.tween(0.08, (t) => (root.rotation.y = from + d * ease.outQuad(t)));
    }

    /**
     * Animate a slide result from rules.slide(). `cb.onDefeat(enemy)` and
     * `cb.onStop()` / `cb.onFall()` fire at the right moments for sound.
     */
    async slide(from, dir, result, cb = {}, speed = 1) {
        await this.face(dir);
        const hero = this.hero;
        const start = this.world(from.x, from.z, 0, new THREE.Vector3());
        const end = result.path[result.path.length - 1];
        const endPos = this.world(end.x, end.z, 0, new THREE.Vector3());
        const n = result.path.length;
        const dur = (0.12 + 0.075 * n) / speed;
        const { dx, dz } = DELTA[dir];
        hero.play('run', { fade: 0.08, speed: 1.25 * speed });
        let dustT = 0;
        let swung = false;
        await this.tween(dur, (t) => {
            const k = result.event === 'fall' ? ease.inQuad(t) : ease.inOutCubic(t);
            hero.root.position.lerpVectors(start, endPos, k);
            hero.body.rotation.x = Math.sin(t * Math.PI) * 0.18;
            if (result.event === 'defeat' && !swung && t > 1 - Math.min(0.5, 0.18 / dur)) {
                swung = true;
                hero.play('attack', { fade: 0.06, once: true, speed: 1.5 });
                if (!hero.mixer) this.swing();
            }
            if (t - dustT > 0.1) {
                dustT = t;
                this.particles.burst(_v.copy(hero.root.position).setY(0.05), {
                    count: 2,
                    colors: [0xd6c3a1, 0xb59f7a],
                    speed: 0.3,
                    up: 0.6,
                    gravity: 2,
                    life: 0.45,
                });
            }
        });
        hero.body.rotation.x = 0;

        if (result.event === 'defeat') {
            cb.onDefeat?.(result.enemy);
            this.defeat(result.enemy, dx, dz);
            await this.wait(0.22 / speed);
            hero.play('idle', { fade: 0.3 });
        } else if (result.event === 'stop') {
            cb.onStop?.();
            hero.play('idle', { fade: 0.15 });
            this.particles.burst(_v.copy(endPos).add(_v2.set(dx * 0.35, 0.1, dz * 0.35)), {
                count: 8,
                colors: [0xd6c3a1, 0xffffff],
                speed: 0.8,
                up: 0.8,
                gravity: 4,
                life: 0.4,
            });
            await this.tween(0.16, (t) => {
                const s = Math.sin(t * Math.PI);
                hero.body.scale.set(1 + s * 0.1, 1 - s * 0.12, 1 + s * 0.1);
            });
            hero.body.scale.setScalar(1);
        } else if (result.event === 'fall') {
            await this.fall(dx, dz, cb);
        }
    }

    /** Fallback sword swing for the procedural warrior. */
    swing() {
        const arm = this.hero.parts?.swordArm;
        if (!arm) return;
        this.tween(0.16, (t) => (arm.rotation.x = -Math.sin(t * Math.PI) * 1.6)).then(() => (arm.rotation.x = 0));
    }

    async fall(dx, dz, cb) {
        const hero = this.hero;
        const p0 = hero.root.position.clone();
        hero.play('fall', { fade: 0.08, once: true, speed: 1.6 });
        await this.tween(0.45, (t) => {
            hero.root.position.set(p0.x + dx * 0.7 * t, p0.y + 0.45 * Math.sin(t * Math.PI * 0.6) - 1.4 * t * t, p0.z + dz * 0.7 * t);
        });
        cb.onFall?.();
        this.splash(_v.copy(hero.root.position).setY(WATER_Y + 0.02));
        hero.root.visible = false;
        // The enemies enjoy that.
        for (const e of this.enemies) if (e.root.visible && !e.dying && e.has('cheer')) e.play('cheer', { once: true, fade: 0.2 });
        await this.wait(0.35);
    }

    splash(at) {
        this.particles.burst(at, { count: 44, colors: [0xffffff, 0xbae6fd, 0x7dd3fc], speed: 1.6, up: 3.2, gravity: 9, life: 0.9, spread: 0.3 });
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.2, 0.28, 28).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }),
        );
        ring.position.copy(at).setY(WATER_Y + 0.06);
        this.fx.add(ring);
        this.tween(0.9, (t) => {
            ring.scale.setScalar(1 + t * 4);
            ring.material.opacity = 0.8 * (1 - t);
        }).then(() => {
            ring.removeFromParent();
            ring.geometry.dispose();
            ring.material.dispose();
        });
    }

    defeat(i, dx, dz) {
        const a = this.enemies[i];
        const p0 = a.root.position.clone();
        a.dying = true;
        this.particles.burst(_v.copy(p0).setY(0.45), {
            count: 36,
            colors: [0xfacc15, 0xfff3b0, 0xf97316, 0xffffff],
            speed: 2.4,
            up: 2.2,
            gravity: 5,
            life: 0.7,
        });
        // Face the hit, fall over backwards while knocked a little way back,
        // then shrink away with a puff.
        a.root.rotation.y = Math.atan2(-dx, -dz);
        if (a.mixer) a.play('death', { fade: 0.05, once: true, speed: 1.3 });
        const animated = !!a.mixer;
        this.tween(0.85, (t) => {
            const k = ease.outCubic(Math.min(1, t * 1.6));
            a.root.position.set(p0.x + dx * 0.55 * k, p0.y + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.25, p0.z + dz * 0.55 * k);
            if (!animated) a.root.rotation.x = -t * 1.5;
            if (t > 0.6) a.root.scale.setScalar(Math.max(0.001, 1 - ease.inQuad((t - 0.6) / 0.4)));
        }).then(() => {
            if (!a.dying) return;
            a.root.visible = false;
            this.particles.burst(_v.copy(a.root.position).setY(0.2), { count: 14, colors: [0xffffff, 0xe5e7eb], speed: 0.7, up: 1, gravity: 1, life: 0.6, spread: 0.3 });
        });
    }

    async magic(level, from, to, speed = 1) {
        const wiz = this.wizard;
        const a = level.wizardSpots[from];
        const b = level.wizardSpots[to];
        const pa = this.world(a.x, a.z);
        const pb = this.world(b.x, b.z);
        const sparkle = { count: 26, colors: [0xc4b5fd, 0xfacc15, 0xffffff], speed: 0.9, up: 2.2, gravity: -0.5, life: 0.8, spread: 0.4 };
        wiz.play('cast', { fade: 0.08, once: true, speed: 1.8 * speed });
        await this.wait(0.16 / speed);
        this.particles.burst(_v.copy(pa).setY(0.5), sparkle);
        const root = wiz.root;
        await this.tween(0.2 / speed, (t) => {
            root.scale.set(1 - t, 1 + t * 0.6, 1 - t);
            root.rotation.y += 0.25;
        });
        root.position.copy(pb);
        this.wizIdx = to;
        this.particles.burst(_v.copy(pb).setY(0.5), sparkle);
        await this.tween(0.24 / speed, (t) => {
            const k = ease.outBack(t);
            root.scale.set(Math.max(0.001, k), 1.6 - 0.6 * k, Math.max(0.001, k));
        });
        root.scale.setScalar(1);
        wiz.play('idle', { fade: 0.3 });
    }

    celebrate() {
        const p = this.hero.root.position.clone();
        for (let k = 0; k < 4; k++) {
            setTimeout(() => {
                this.particles.burst(_v.set(p.x + (Math.random() - 0.5) * 2, 0.8, p.z + (Math.random() - 0.5) * 2), {
                    count: 40,
                    colors: [0xfacc15, 0xffffff, 0xfde68a, 0x38bdf8],
                    speed: 2.6,
                    up: 3,
                    gravity: 4,
                    life: 1.2,
                });
            }, k * 180);
        }
        const hero = this.hero;
        // Turn to the camera, raise the sword and hop.
        const face = hero.root.rotation.y;
        const d = angleTo(face, Math.atan2(this.camera.position.x - hero.root.position.x, this.camera.position.z - hero.root.position.z));
        hero.play('attack2', { fade: 0.1, once: true, speed: 0.9 });
        if (!hero.mixer) this.swing();
        if (this.wizard.root.visible) this.wizard.play('cast', { fade: 0.2, once: true });
        this.tween(1.1, (t) => {
            hero.root.rotation.y = face + d * ease.outCubic(Math.min(1, t * 3));
            hero.root.position.y = Math.abs(Math.sin(t * Math.PI * 2)) * 0.3;
        }).then(() => {
            hero.root.position.y = 0;
            hero.play('idle', { fade: 0.4 });
            if (this.wizard.root.visible) this.wizard.play('idle', { fade: 0.4 });
        });
    }

    // ---- hint / AI overlays
    clearHighlights() {
        for (const h of this.highlights) {
            h.removeFromParent();
            h.material.dispose();
            if (h.geometry !== this.hintGeo) h.geometry.dispose();
        }
        this.highlights.length = 0;
    }

    /** Glowing tiles along a planned slide, or on the wizard's next spot. */
    showHint(cells, { color = 0xfacc15, arrowDir = null } = {}) {
        this.clearHighlights();
        cells.forEach((c, i) => {
            const m = new THREE.Mesh(this.hintGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
            this.world(c.x, c.z, 0.02, m.position);
            m.userData.phase = i * 0.5;
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
            const p = this.hero.root.position;
            const { dx, dz } = DELTA[arrowDir];
            arrow.position.set(p.x + dx * 0.62, 0.05, p.z + dz * 0.62);
            arrow.userData.phase = 0;
            this.fx.add(arrow);
            this.highlights.push(arrow);
        }
    }

    /**
     * Visualise a search: tiles light up in the order the solver expanded
     * states there, building a heat map of where it "thought". One instanced
     * mesh (additive, brightness = heat), so it costs a single draw call.
     */
    async showSearch(trace, seconds = 1.4) {
        this.clearHeat();
        const level = this.level;
        const cells = level.width * level.height;
        const counts = new Float32Array(cells);
        const flash = new Float32Array(cells);
        const mesh = new THREE.InstancedMesh(
            this.hintGeo,
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
            cells,
        );
        const o = new THREE.Object3D();
        for (let i = 0; i < cells; i++) {
            this.world(i % level.width, Math.floor(i / level.width), 0.025, o.position);
            o.scale.setScalar(1.04);
            o.updateMatrix();
            mesh.setMatrixAt(i, o.matrix);
            mesh.setColorAt(i, _c.setRGB(0, 0, 0));
        }
        mesh.frustumCulled = false;
        this.fx.add(mesh);
        this.heat = { mesh, counts, cells };
        const base = new THREE.Color(0x22d3ee);
        let shown = 0;
        let max = 1;
        const paint = (fade = 1) => {
            for (let i = 0; i < cells; i++) {
                if (!counts[i] && !flash[i]) continue;
                const k = (0.12 + 0.45 * Math.sqrt(counts[i] / max) + flash[i] * 0.35) * fade;
                mesh.setColorAt(i, _c.copy(base).multiplyScalar(k));
            }
            mesh.instanceColor.needsUpdate = true;
        };
        this.heat.paint = paint;
        await this.tween(seconds, (t) => {
            const upto = Math.floor(trace.length * t);
            for (; shown < upto; shown++) {
                const idx = trace[shown];
                counts[idx]++;
                if (counts[idx] > max) max = counts[idx];
                flash[idx] = 1;
            }
            for (let i = 0; i < cells; i++) if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - 0.08);
            paint();
        });
    }

    clearHeat() {
        if (!this.heat) return;
        this.heat.mesh.removeFromParent();
        this.heat.mesh.material.dispose();
        this.heat.mesh.dispose();
        this.heat = null;
    }

    fadeHeat() {
        const heat = this.heat;
        if (!heat) return;
        this.tween(0.6, (t) => heat === this.heat && heat.paint(1 - t * 0.7));
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
        const dir = this.viewDir(this.view.polar, this.view.azimuth, _v2);
        let near = 3;
        let far = 80;
        for (let i = 0; i < 22; i++) {
            const mid = (near + far) / 2;
            cam.position.copy(dir).multiplyScalar(mid);
            cam.lookAt(0, 0, 0);
            cam.updateMatrixWorld();
            let ok = true;
            for (let k = 0; k < 8 && ok; k++) {
                _v.set(k & 1 ? hw : -hw, k & 2 ? 0.9 : -0.3, k & 4 ? hd : -hd).project(cam);
                ok = Math.abs(_v.x) < (W < 600 ? 0.97 : 0.92) && Math.abs(_v.y) < 0.9 * free;
            }
            if (ok) far = mid;
            else near = mid;
        }
        this.fitDistance = far;
        this.fitted.az = this.view.azimuth;
        this.fitted.polar = this.view.polar;
        // Shift the image so the board centres in the free area between the HUD bars.
        const shift = (this.insets.top - this.insets.bottom) / 2;
        cam.setViewOffset(W, H, 0, -shift, W, H);
        this.applyCamera();
    }

    viewDir(polar, az, out = new THREE.Vector3()) {
        return out.set(Math.sin(polar) * Math.sin(az), Math.cos(polar), Math.sin(polar) * Math.cos(az));
    }

    applyCamera() {
        const d = (this.fitDistance || 12) / this.view.zoom;
        this.camera.position.copy(this.viewDir(this.view.polar, this.view.azimuth, _v2)).multiplyScalar(d);
        this.camera.lookAt(0, 0, 0);
        this.scene.fog.near = d * 1.1;
        this.scene.fog.far = d * 3.2;
    }

    // ---- frame
    frame() {
        const now = performance.now();
        const interval = now - this.lastFrame;
        this.lastFrame = now;
        this.quality.sample(interval);
        const dt = Math.min(0.1, this.clock.getDelta()) * this.timeScale;
        this.time += dt;
        const t = this.time;
        for (const tw of this.tweens) {
            if (t < tw.start) continue;
            const k = Math.min(1, (t - tw.start) / tw.duration);
            tw.fn(k);
            if (k >= 1) {
                this.tweens.delete(tw);
                tw.resolve();
            }
        }
        const v = this.view;
        const az = v.azimuth;
        const po = v.polar;
        const zo = v.zoom;
        const f = Math.min(1, dt * 8);
        v.azimuth += (v.targetAz - v.azimuth) * f;
        v.polar += (v.targetPolar - v.polar) * f;
        v.zoom += (v.targetZoom - v.zoom) * f;
        if (Math.abs(az - v.azimuth) + Math.abs(po - v.polar) + Math.abs(zo - v.zoom) > 1e-5) {
            if (Math.abs(v.polar - this.fitted.polar) > 0.02 || Math.abs(v.azimuth - this.fitted.az) > 0.02) this.fitCamera();
            else this.applyCamera();
        }

        if (this.level && this.hero) {
            const hero = this.hero;
            hero.update(dt);
            if (!hero.mixer) hero.body.position.y = Math.abs(Math.sin(t * 2.2)) * 0.02;
            for (const e of this.enemies) {
                if (!e.root.visible) continue;
                e.update(dt);
                if (e.dying) continue;
                if (!e.mixer) e.body.position.y = Math.abs(Math.sin(t * 3 + e.phase)) * 0.04;
                // Turn to watch the warrior; now and then, taunt him.
                const a = Math.atan2(hero.root.position.x - e.root.position.x, hero.root.position.z - e.root.position.z);
                e.root.rotation.y += angleTo(e.root.rotation.y, a) * Math.min(1, dt * 4);
                e.nextTaunt -= dt;
                if (e.nextTaunt < 0 && e.mixer) {
                    e.nextTaunt = 6 + Math.random() * 10;
                    if (e.current === e.actions.get('idle')) {
                        e.play('taunt', { once: true, fade: 0.25 });
                        e.backToIdle = t + e.actions.get('taunt').getClip().duration - 0.25;
                    }
                }
                if (e.backToIdle && t > e.backToIdle) {
                    e.backToIdle = 0;
                    if (e.current === e.actions.get('taunt')) e.play('idle', { fade: 0.3 });
                }
            }
            const wiz = this.wizard;
            if (wiz.root.visible) {
                wiz.update(dt);
                if (Math.abs(wiz.root.scale.x - 1) < 0.01) {
                    const a = Math.atan2(hero.root.position.x - wiz.root.position.x, hero.root.position.z - wiz.root.position.z);
                    wiz.root.rotation.y += angleTo(wiz.root.rotation.y, a) * Math.min(1, dt * 3);
                }
                if (!wiz.mixer) wiz.body.position.y = 0.04 + Math.sin(t * 1.8) * 0.04;
            }
            const rings = this.spotRings;
            for (let i = 0; i < rings.length; i++) {
                const active = i === this.wizIdx;
                rings[i].rotation.y = t * (active ? 0.8 : 0.3);
                rings[i].material.opacity = active ? 0.85 : 0.4 + Math.sin(t * 2 + i) * 0.12;
            }
            for (const h of this.highlights) h.material.opacity = 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 6 - h.userData.phase));
        }
        this.updateBlobs();
        if (!this.dynamicShadows && this.island && this.island.group.position.y !== this.shadowY) {
            this.shadowY = this.island.group.position.y;
            this.renderer.shadowMap.needsUpdate = true;
        }
        this.sky.position.copy(this.camera.position);
        this.water.material.uniforms.uTime.value = t;
        this.windUniforms.uTime.value = t;
        this.particles.update(dt);
        this.renderer.info.reset();
        this.renderer.render(this.scene, this.camera);
        this.perf?.frame(interval, performance.now() - now);
    }
}
