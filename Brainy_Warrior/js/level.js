import * as THREE from 'three';
import { TILE_TYPES, ENTITY_TYPES } from './levels.js';

export class LevelRenderer {
    constructor(scene) {
        this.scene = scene;
        this.meshes = [];
        this.loader = new THREE.TextureLoader();
        this.textures = {
            grass: this.loader.load('assets/textures/grass.png'),
            stone: this.loader.load('assets/textures/stone.png'),
            fence: this.loader.load('assets/textures/fence.png')
        };
        
        // Settings for pixelated/clean look
        for (let key in this.textures) {
            this.textures[key].wrapS = THREE.RepeatWrapping;
            this.textures[key].wrapT = THREE.RepeatWrapping;
            this.textures[key].anisotropy = 4;
        }
    }

    clear() {
        this.meshes.forEach(m => this.scene.remove(m));
        this.meshes = [];
    }

    render(levelData) {
        this.clear();
        const grid = levelData.grid;
        
        const floorGeo = new THREE.BoxGeometry(1, 0.4, 1);
        const wallGeo = new THREE.BoxGeometry(1, 1.4, 1);
        const fenceGeo = new THREE.BoxGeometry(1, 0.6, 0.2);

        for (let z = 0; z < grid.length; z++) {
            for (let x = 0; x < grid[z].length; x++) {
                const type = grid[z][x];
                
                // Always render water underneath if it's 0, but usually we just skip
                if (type === TILE_TYPES.WATER) {
                    this.addWater(x, z);
                    continue;
                }

                // Render Floor
                const floorMat = new THREE.MeshStandardMaterial({ 
                    map: this.textures.grass,
                    roughness: 0.8
                });
                const floor = new THREE.Mesh(floorGeo, floorMat);
                floor.position.set(x, -0.2, z);
                floor.receiveShadow = true;
                this.scene.add(floor);
                this.meshes.push(floor);

                if (type === TILE_TYPES.WALL) {
                    const wallMat = new THREE.MeshStandardMaterial({ 
                        map: this.textures.stone,
                        roughness: 0.6
                    });
                    const wall = new THREE.Mesh(wallGeo, wallMat);
                    wall.position.set(x, 0.7, z);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    this.scene.add(wall);
                    this.meshes.push(wall);
                } else if (type === TILE_TYPES.FENCE) {
                    const fenceMat = new THREE.MeshStandardMaterial({ 
                        map: this.textures.fence,
                        transparent: true,
                        alphaTest: 0.5
                    });
                    // Fence can be oriented or just centered
                    const fence = new THREE.Mesh(fenceGeo, fenceMat);
                    fence.position.set(x, 0.3, z);
                    fence.castShadow = true;
                    this.scene.add(fence);
                    this.meshes.push(fence);
                }
            }
        }

        // Add Pedestals for Wizard positions if any
        if (levelData.wizard && levelData.wizard.positions) {
            const pedGeo = new THREE.CylinderGeometry(0.4, 0.45, 0.1, 16);
            const pedMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5, roughness: 0.2 });
            levelData.wizard.positions.forEach(pos => {
                const ped = new THREE.Mesh(pedGeo, pedMat);
                ped.position.set(pos.x, 0.05, pos.z);
                this.scene.add(ped);
                this.meshes.push(ped);
            });
        }
    }

    addWater(x, z) {
        const waterGeo = new THREE.PlaneGeometry(1, 1);
        const waterMat = new THREE.MeshStandardMaterial({ 
            color: 0x0ea5e9, 
            transparent: true, 
            opacity: 0.6,
            metalness: 0.9,
            roughness: 0.1
        });
        const water = new THREE.Mesh(waterGeo, waterMat);
        water.rotation.x = -Math.PI / 2;
        water.position.set(x, -0.4, z);
        this.scene.add(water);
        this.meshes.push(water);
    }
}
