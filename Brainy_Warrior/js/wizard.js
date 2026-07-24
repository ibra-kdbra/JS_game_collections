import * as THREE from 'three';

export class Wizard {
    constructor(scene, positions) {
        this.scene = scene;
        this.positions = positions || [];
        this.currentIndex = 0;

        const geo = new THREE.CapsuleGeometry(0.3, 0.4, 4, 8);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x8b5cf6, 
            emissive: 0x4c1d95,
            emissiveIntensity: 0.5
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.castShadow = true;
        
        if (this.positions.length > 0) {
            this.scene.add(this.mesh);
            this.updatePosition();
        }
    }

    toggle() {
        if (this.positions.length < 2) return;
        this.currentIndex = (this.currentIndex + 1) % this.positions.length;
        this.updatePosition();
    }

    updatePosition() {
        const pos = this.positions[this.currentIndex];
        this.mesh.position.set(pos.x, 0.5, pos.z);
    }

    getPosition() {
        return this.positions[this.currentIndex];
    }

    destroy() {
        this.scene.remove(this.mesh);
    }
}
