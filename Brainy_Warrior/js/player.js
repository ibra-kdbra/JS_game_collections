import * as THREE from 'three';
import { TILE_TYPES, ENTITY_TYPES } from './levels.js';

export class Player {
    constructor(scene, onStateChange) {
        this.scene = scene;
        this.onStateChange = onStateChange;
        
        // Visuals
        const geo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xf1f5f9,
            metalness: 0.8,
            roughness: 0.1
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);

        this.reset();
    }

    reset() {
        this.isMoving = false;
        this.hasSword = false;
        this.moveQueue = [];
        this.speed = 12;
        this.x = 0;
        this.z = 0;
    }

    spawn(x, z) {
        this.x = x;
        this.z = z;
        this.mesh.position.set(x, 0.5, z);
    }

    slide(dx, dz, levelData, enemies, wizard) {
        if (this.isMoving) return;

        let tx = this.x;
        let tz = this.z;
        let path = [];

        while (true) {
            let nx = tx + dx;
            let nz = tz + dz;

            // Check OOB / Water
            if (nz < 0 || nz >= levelData.grid.length || nx < 0 || nx >= levelData.grid[0].length || levelData.grid[nz][nx] === TILE_TYPES.WATER) {
                tx = nx;
                tz = nz;
                path.push({ x: tx, z: tz, type: 'death' });
                break;
            }

            // Check Wall/Fence
            const tile = levelData.grid[nz][nx];
            if (tile === TILE_TYPES.WALL || tile === TILE_TYPES.FENCE) {
                break; // Stop before it
            }

            // Check Wizard
            if (wizard) {
                const wPos = wizard.getPosition();
                if (nx === wPos.x && nz === wPos.z) {
                    break; // Wizard stops player
                }
            }

            // Check Entities
            const entityIdx = enemies.findIndex(e => e.x === nx && e.z === nz);
            if (entityIdx !== -1) {
                const ent = enemies[entityIdx];
                if (ent.type === ENTITY_TYPES.ENEMY) {
                    tx = nx;
                    tz = nz;
                    path.push({ x: tx, z: tz, type: 'kill', index: entityIdx });
                    break; 
                } else if (ent.type === ENTITY_TYPES.STRONG_ENEMY) {
                    if (this.hasSword) {
                        tx = nx;
                        tz = nz;
                        path.push({ x: tx, z: tz, type: 'kill', index: entityIdx });
                        break;
                    } else {
                        break; // Acts as wall if no sword
                    }
                } else if (ent.type === ENTITY_TYPES.SWORD) {
                    // Pick up sword and continue? Real game usually keeps sliding or stops?
                    // "To defeat these stronger foes, you must first collect one or more swords... plan your path to pick up sword first, then align yourself to hit strong enemy."
                    // This implies picking up sword DOES NOT stop movement unless it's the end of slide.
                    // Wait, usually items are on tiles you pass through.
                    tx = nx;
                    tz = nz;
                    path.push({ x: tx, z: tz, type: 'pickup', index: entityIdx });
                    // Keep going? Let's check. 
                    // Actually, let's make it continue sliding unless it hits something else.
                }
            } else {
                tx = nx;
                tz = nz;
                path.push({ x: tx, z: tz, type: 'move' });
            }
        }

        if (path.length > 0) {
            this.moveQueue = path;
            this.isMoving = true;
            this.onStateChange('START_MOVE');
        }
    }

    update(dt) {
        if (!this.isMoving || this.moveQueue.length === 0) return;

        const target = this.moveQueue[0];
        const dx = target.x - this.mesh.position.x;
        const dz = target.z - this.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const moveStep = this.speed * dt;

        if (dist <= moveStep) {
            this.mesh.position.x = target.x;
            this.mesh.position.z = target.z;
            this.x = target.x;
            this.z = target.z;

            // Handle event
            if (target.type === 'kill') {
                this.onStateChange('ENEMY_KILLED', target.index);
                this.isMoving = false; // Kill stops movement
                this.moveQueue = [];
            } else if (target.type === 'pickup') {
                this.hasSword = true;
                this.onStateChange('ITEM_PICKED', target.index);
                // Keep moving if there's more in queue
            } else if (target.type === 'death') {
                this.onStateChange('DIED');
                this.isMoving = false;
                this.moveQueue = [];
            }
            
            this.moveQueue.shift();
            if (this.moveQueue.length === 0) {
                this.isMoving = false;
                this.onStateChange('IDLE');
            }
        } else {
            this.mesh.position.x += (dx / dist) * moveStep;
            this.mesh.position.z += (dz / dist) * moveStep;
        }
    }
}
