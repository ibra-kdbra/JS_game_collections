import * as THREE from 'three';
import { TILE_TYPES, ENTITY_TYPES } from './levels.js';

// Small canvas-drawn textures stand in for image assets, so the game ships no texture files.
function canvasTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
}

function seededRandom(seed) {
    return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    };
}

function makeTextures() {
    const grass = canvasTexture(128, (ctx, s) => {
        const rand = seededRandom(7);
        ctx.fillStyle = '#4f9d3a';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 900; i++) {
            const shade = 70 + Math.floor(rand() * 60);
            ctx.fillStyle = `rgba(${shade - 30}, ${shade + 70}, ${shade - 40}, 0.55)`;
            ctx.fillRect(rand() * s, rand() * s, 2, 3 + rand() * 4);
        }
        ctx.strokeStyle = 'rgba(20, 50, 15, 0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(0, 0, s, s);
    });
    const stone = canvasTexture(128, (ctx, s) => {
        const rand = seededRandom(11);
        ctx.fillStyle = '#5b6474';
        ctx.fillRect(0, 0, s, s);
        const rows = 4;
        const h = s / rows;
        for (let r = 0; r < rows; r++) {
            const offset = r % 2 ? h : 0;
            for (let x = -offset; x < s; x += h * 2) {
                const tone = 95 + Math.floor(rand() * 40);
                ctx.fillStyle = `rgb(${tone}, ${tone + 6}, ${tone + 18})`;
                ctx.fillRect(x + 3, r * h + 3, h * 2 - 6, h - 6);
            }
        }
    });
    const water = canvasTexture(128, (ctx, s) => {
        const rand = seededRandom(3);
        ctx.fillStyle = '#0c5f8f';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(160, 225, 255, 0.35)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 26; i++) {
            const x = rand() * s;
            const y = rand() * s;
            ctx.beginPath();
            ctx.arc(x, y, 6 + rand() * 6, Math.PI * 1.15, Math.PI * 1.85);
            ctx.stroke();
        }
    });
    return { grass, stone, water };
}

function makeHero() {
    const hero = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.25 });
    const tunic = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.45, 16), tunic);
    body.position.y = 0.22;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), steel);
    head.position.y = 0.6;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
    visor.position.set(0, 0.62, 0.18);
    const plume = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.25, 10), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    plume.position.y = 0.88;
    [body, head, visor, plume].forEach((m) => { m.castShadow = true; hero.add(m); });
    return hero;
}

function makeEnemy(strong) {
    const group = new THREE.Group();
    const slime = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 24, 16),
        new THREE.MeshStandardMaterial({ color: strong ? 0xb91c1c : 0x84cc16, roughness: 0.35 }),
    );
    slime.scale.set(1, 0.8, 1);
    slime.position.y = 0.26;
    slime.castShadow = true;
    group.add(slime);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111827 });
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), eyeMat);
        eye.position.set(0.11 * side, 0.34, 0.27);
        group.add(eye);
    }
    if (strong) {
        slime.scale.set(1.15, 0.9, 1.15);
        const armour = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.8, roughness: 0.3 });
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 28), armour);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.24;
        group.add(band);
        for (const side of [-1, 1]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 10), armour);
            horn.position.set(0.18 * side, 0.6, 0);
            horn.rotation.z = -0.5 * side;
            horn.castShadow = true;
            group.add(horn);
        }
    }
    return group;
}

function makeSword() {
    const group = new THREE.Group();
    const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.5, 0.04),
        new THREE.MeshStandardMaterial({ color: 0xe5e7eb, metalness: 0.9, roughness: 0.15, emissive: 0x334155 }),
    );
    blade.position.y = 0.3;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6 }));
    guard.position.y = 0.04;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0x78350f }));
    grip.position.y = -0.06;
    [blade, guard, grip].forEach((m) => { m.castShadow = true; group.add(m); });
    group.rotation.set(0.5, 0, Math.PI + 0.5);
    group.scale.setScalar(1.6);
    group.position.y = 0.75;
    const glow = new THREE.Mesh(
        new THREE.CircleGeometry(0.4, 24),
        new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.6 }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.02;
    const holder = new THREE.Group();
    holder.add(group, glow);
    return holder;
}

export function makeWizardMesh() {
    const group = new THREE.Group();
    const robe = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.6, 18),
        new THREE.MeshStandardMaterial({ color: 0x7c3aed, emissive: 0x2e1065, emissiveIntensity: 0.6 }),
    );
    robe.position.y = 0.3;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfcd7b6 }));
    head.position.y = 0.66;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.4, 16), robe.material);
    hat.position.y = 0.95;
    [robe, head, hat].forEach((m) => { m.castShadow = true; group.add(m); });
    return group;
}

export class LevelRenderer {
    constructor(scene) {
        this.scene = scene;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.textures = makeTextures();
        this.entityMeshes = new Map();
        this.hero = makeHero();
        this.time = 0;
    }

    clear() {
        this.root.remove(this.hero);
        this.root.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.geometry.dispose();
            obj.material.dispose();
        });
        this.root.clear();
        this.entityMeshes.clear();
    }

    build(level) {
        this.clear();
        const { grid } = level;
        const depth = grid.length;
        const width = grid[0].length;
        this.width = width;
        this.depth = depth;

        const sea = new THREE.Mesh(
            new THREE.PlaneGeometry(width + 40, depth + 40),
            new THREE.MeshStandardMaterial({ map: this.textures.water, color: 0x9fdcff, roughness: 0.25, metalness: 0.3 }),
        );
        this.textures.water.repeat.set((width + 40) / 2, (depth + 40) / 2);
        sea.rotation.x = -Math.PI / 2;
        sea.position.set((width - 1) / 2, -0.45, (depth - 1) / 2);
        sea.receiveShadow = true;
        this.root.add(sea);
        this.sea = sea;

        const floorGeo = new THREE.BoxGeometry(1, 0.5, 1);
        const floorMat = new THREE.MeshStandardMaterial({ map: this.textures.grass, roughness: 0.9 });
        const wallGeo = new THREE.BoxGeometry(0.96, 0.9, 0.96);
        const wallMat = new THREE.MeshStandardMaterial({ map: this.textures.stone, roughness: 0.75 });
        const woodMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 });
        const postGeo = new THREE.BoxGeometry(0.12, 0.5, 0.12);
        const railGeo = new THREE.BoxGeometry(0.9, 0.08, 0.06);

        for (let z = 0; z < depth; z++) {
            for (let x = 0; x < width; x++) {
                const type = grid[z][x];
                if (type === TILE_TYPES.WATER) continue;
                const floor = new THREE.Mesh(floorGeo, floorMat);
                floor.position.set(x, -0.25, z);
                floor.receiveShadow = true;
                this.root.add(floor);

                if (type === TILE_TYPES.WALL) {
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(x, 0.45, z);
                    wall.castShadow = wall.receiveShadow = true;
                    this.root.add(wall);
                } else if (type === TILE_TYPES.FENCE) {
                    const fence = new THREE.Group();
                    for (const px of [-0.38, 0, 0.38]) {
                        const post = new THREE.Mesh(postGeo, woodMat);
                        post.position.set(px, 0.25, 0);
                        fence.add(post);
                    }
                    for (const py of [0.18, 0.38]) {
                        const rail = new THREE.Mesh(railGeo, woodMat);
                        rail.position.y = py;
                        fence.add(rail);
                    }
                    for (const px of [-0.38, 0.38]) {
                        const rail = new THREE.Mesh(railGeo, woodMat);
                        rail.rotation.y = Math.PI / 2;
                        rail.position.set(px, 0.28, 0);
                        fence.add(rail);
                    }
                    fence.traverse((m) => { if (m.isMesh) m.castShadow = true; });
                    fence.position.set(x, 0, z);
                    this.root.add(fence);
                }
            }
        }

        if (level.wizard) {
            const pedGeo = new THREE.CylinderGeometry(0.38, 0.42, 0.06, 24);
            const pedMat = new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x4c1d95, emissiveIntensity: 0.5 });
            level.wizard.positions.forEach((pos) => {
                const ped = new THREE.Mesh(pedGeo, pedMat);
                ped.position.set(pos.x, 0.03, pos.z);
                ped.receiveShadow = true;
                this.root.add(ped);
            });
        }

        level.entities.forEach((entity, id) => {
            const mesh =
                entity.type === ENTITY_TYPES.SWORD ? makeSword() : makeEnemy(entity.type === ENTITY_TYPES.STRONG_ENEMY);
            mesh.position.set(entity.x, 0, entity.z);
            mesh.userData = { type: entity.type, phase: id * 1.7, dying: 0 };
            this.root.add(mesh);
            this.entityMeshes.set(id, mesh);
        });

        this.root.add(this.hero);
        this.hero.position.set(level.spawn.x, 0, level.spawn.z);
        this.hero.rotation.set(0, 0, 0);
    }

    /** Show exactly the entities in `alive`, e.g. after undo. */
    syncEntities(alive) {
        const set = new Set(alive);
        this.entityMeshes.forEach((mesh, id) => {
            mesh.visible = set.has(id);
            mesh.userData.dying = 0;
            mesh.scale.setScalar(1);
        });
    }

    defeat(id) {
        const mesh = this.entityMeshes.get(id);
        if (mesh) mesh.userData.dying = 0.0001;
    }

    update(dt) {
        this.time += dt;
        if (this.sea) this.textures.water.offset.set(this.time * 0.03, this.time * 0.02);
        this.entityMeshes.forEach((mesh) => {
            const data = mesh.userData;
            if (data.dying > 0) {
                data.dying += dt;
                const t = Math.min(1, data.dying / 0.25);
                mesh.scale.setScalar(1 + t * 0.4);
                mesh.position.y = t * 0.3;
                if (t >= 1) {
                    mesh.visible = false;
                    data.dying = 0;
                    mesh.scale.setScalar(1);
                    mesh.position.y = 0;
                }
                return;
            }
            if (data.type === ENTITY_TYPES.SWORD) {
                mesh.rotation.y += dt * 2;
                mesh.position.y = Math.sin(this.time * 3 + data.phase) * 0.06;
            } else {
                mesh.scale.y = 1 + Math.sin(this.time * 4 + data.phase) * 0.06;
            }
        });
    }
}
