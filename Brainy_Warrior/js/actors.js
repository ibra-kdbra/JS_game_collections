// Animated characters. The models are Quaternius' CC0 characters, packed by
// tools/pack-models.py into one skinned mesh, one material and one small
// texture each (one draw call per character), simplified and compressed with
// meshoptimizer's gltfpack (about 380 KB for all five). They load lazily after the page
// is up; if they can't load, the procedural models in models.js stand in.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { mergeBufferGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptDecoder } from '../vendor/meshoptimizer/meshopt_decoder.mjs';
import { createWarrior, createEnemy, createWizard } from './models.js';

export const MODEL_FILES = {
    warrior: 'warrior.glb',
    wizard: 'wizard.glb',
    orc: 'orc.glb',
    'orc-skull': 'orc-skull.glb',
    tribal: 'tribal.glb',
};
export const ENEMY_KINDS = ['orc', 'tribal', 'orc-skull'];
// Height in tiles of each character on the board.
const HEIGHT = { warrior: 1.3, wizard: 1.32, orc: 1.1, 'orc-skull': 1.12, tribal: 1.06 };

let templates = null;

/**
 * Load every character once. Resolves to true when the glTF models are in,
 * false when the procedural fallback is in use. `onProgress(0..1)`.
 */
export function loadActors(onProgress = () => {}) {
    if (templates) return Promise.resolve(templates.gltf);
    // ?models=simple tries the procedural fallback on purpose.
    if (new URLSearchParams(location.search).get('models') === 'simple') {
        templates = { gltf: false, map: new Map() };
        return Promise.resolve(false);
    }
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const names = Object.keys(MODEL_FILES);
    const done = new Map();
    const report = () => onProgress([...done.values()].reduce((a, b) => a + b, 0) / names.length);
    return Promise.all(
        names.map(
            (name) =>
                new Promise((resolve, reject) => {
                    const url = new URL(`../models/${MODEL_FILES[name]}`, import.meta.url).href;
                    loader.load(
                        url,
                        (gltf) => {
                            done.set(name, 1);
                            report();
                            resolve([name, gltf]);
                        },
                        (e) => {
                            if (e.total) {
                                done.set(name, (e.loaded / e.total) * 0.95);
                                report();
                            }
                        },
                        reject,
                    );
                }),
        ),
    )
        .then((list) => {
            templates = { gltf: true, map: new Map() };
            const monsterClips = list.find(([n]) => n === 'orc')[1].animations;
            for (const [name, gltf] of list) {
                gltf.scene.traverse((o) => {
                    if (o.isMesh) {
                        o.castShadow = true;
                        o.receiveShadow = false;
                        o.frustumCulled = false; // bind-pose bounds don't follow the animation
                        // Lambert shading: the models are matte anyway, and it is
                        // much cheaper per pixel than the PBR material on phones.
                        const old = o.material;
                        o.material = new THREE.MeshLambertMaterial({ map: old.map, name: old.name });
                        old.dispose();
                    }
                });
                // Measure once, so every clone gets the same scale.
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const scale = HEIGHT[name] / Math.max(0.01, box.max.y - box.min.y);
                const clips = gltf.animations.length ? gltf.animations : monsterClips;
                templates.map.set(name, { scene: gltf.scene, clips, scale, foot: -box.min.y * scale });
            }
            return true;
        })
        .catch((err) => {
            console.warn('Brainy Warrior: character models unavailable, using the simple ones.', err);
            templates = { gltf: false, map: new Map() };
            return false;
        });
}

/**
 * One character: `root` is placed on the board by the scene, `body` takes
 * procedural offsets (bob, lean, squash) and holds the skinned model.
 */
export class Actor {
    constructor(kind, seed = 0) {
        this.kind = kind;
        this.root = new THREE.Group();
        this.body = new THREE.Group();
        this.root.add(this.body);
        this.actions = new Map();
        this.current = null;
        const t = templates?.map.get(kind);
        if (t) {
            this.model = cloneSkinned(t.scene);
            this.model.scale.setScalar(t.scale * (1 + ((seed * 37) % 7) * 0.012));
            this.model.position.y = t.foot;
            this.body.add(this.model);
            this.mixer = new THREE.AnimationMixer(this.model);
            for (const clip of t.clips) this.actions.set(clip.name, this.mixer.clipAction(clip));
            this.mixer.timeScale = 1;
            this.skinned = [];
            this.model.traverse((o) => o.isSkinnedMesh && this.skinned.push(o));
            if (kind === 'wizard') this.addHat();
        } else {
            // Procedural fallback (models.js); faces +z like the glTF models.
            const make = kind === 'warrior' ? createWarrior : kind === 'wizard' ? createWizard : () => createEnemy(seed);
            this.model = make();
            this.body.add(this.model);
            this.parts = this.model.userData.parts;
            this.mixer = null;
        }
    }

    /**
     * The Quaternius wizard has no hat, and a wizard needs one: a tall,
     * slightly bent cone with a brim, a gold band and a star, riding on the
     * head bone so it follows every animation. One mesh, vertex coloured.
     */
    addHat() {
        let head = null;
        this.model.traverse((o) => o.isBone && /^Head$/.test(o.name) && (head = o));
        if (!head) return;
        const part = (geo, color, m) => {
            geo = geo.index ? geo.toNonIndexed() : geo;
            geo.applyMatrix4(m);
            geo.deleteAttribute('uv');
            const c = new THREE.Color(color);
            const n = geo.attributes.position.count;
            geo.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, i) => [c.r, c.g, c.b][i % 3]), 3));
            return geo;
        };
        const M = (x, y, z, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1));
        const purple = 0x4c1d95;
        const parts = [
            part(new THREE.CylinderGeometry(0.2, 0.21, 0.025, 20), purple, M(0, 0.012, 0)),
            part(new THREE.CylinderGeometry(0.095, 0.13, 0.16, 16, 1, true), purple, M(0, 0.1, 0)),
            part(new THREE.CylinderGeometry(0.05, 0.095, 0.14, 14, 1, true), purple, M(0.01, 0.245, -0.01, -0.12, -0.1)),
            part(new THREE.ConeGeometry(0.05, 0.16, 12), purple, M(0.035, 0.38, -0.035, -0.35, -0.3)),
            part(new THREE.CylinderGeometry(0.133, 0.137, 0.035, 18, 1, true), 0xfacc15, M(0, 0.04, 0)),
            part(new THREE.OctahedronGeometry(0.035, 0), 0xfde047, M(0, 0.13, 0.11)),
        ];
        const hat = new THREE.Mesh(mergeBufferGeometries(parts), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
        parts.forEach((g) => g.dispose());
        hat.castShadow = true;
        // Place it on top of the head in model space, then hand it to the bone.
        this.root.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(this.model);
        const top = new THREE.Vector3();
        head.getWorldPosition(top);
        top.y = box.max.y - (box.max.y - box.min.y) * 0.07;
        const worldScale = new THREE.Vector3();
        head.getWorldScale(worldScale);
        const size = (box.max.y - box.min.y) * 0.72;
        hat.scale.setScalar(size / worldScale.x);
        hat.position.copy(head.worldToLocal(top));
        const q = new THREE.Quaternion();
        head.getWorldQuaternion(q);
        hat.quaternion.copy(q.invert());
        head.add(hat);
        this.hat = hat;
    }

    /** Cross-fade to a clip. `once` plays it a single time and holds the last frame. */
    play(name, { fade = 0.18, once = false, speed = 1, from = 0 } = {}) {
        const next = this.actions.get(name);
        if (!next) return 0;
        if (this.current === next && !once) return next.getClip().duration;
        next.reset();
        next.enabled = true;
        next.setEffectiveTimeScale(speed);
        next.setEffectiveWeight(1);
        next.time = from * next.getClip().duration;
        next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
        next.clampWhenFinished = once;
        if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
        next.play();
        this.current = next;
        return next.getClip().duration / speed;
    }

    has(name) {
        return this.actions.has(name);
    }

    update(dt) {
        this.mixer?.update(dt);
    }

    /** Return the actor's bone textures etc. Geometry and materials are shared and stay. */
    dispose() {
        this.mixer?.stopAllAction();
        if (this.mixer) this.mixer.uncacheRoot(this.model);
        for (const m of this.skinned || []) m.skeleton.dispose();
        this.root.removeFromParent();
    }
}
