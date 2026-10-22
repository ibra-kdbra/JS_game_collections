import { makeWizardMesh } from './level.js';

const TELEPORT_TIME = 0.3;

/** The wizard's mesh: hovers in place and shrinks/grows when it teleports. */
export class Wizard {
    constructor(parent, positions) {
        this.positions = positions;
        this.mesh = makeWizardMesh();
        this.time = 0;
        this.teleport = 0;
        this.index = 0;
        parent.add(this.mesh);
        this.place(0);
    }

    place(index) {
        this.index = index;
        const pos = this.positions[index];
        this.mesh.position.set(pos.x, 0.06, pos.z);
        this.mesh.scale.setScalar(1);
        this.teleport = 0;
    }

    moveTo(index) {
        if (index === this.index) return;
        this.target = index;
        this.teleport = TELEPORT_TIME;
    }

    update(dt) {
        this.time += dt;
        this.mesh.rotation.y = Math.sin(this.time * 1.5) * 0.4;
        if (this.teleport <= 0) return;
        this.teleport -= dt;
        const half = TELEPORT_TIME / 2;
        if (this.teleport > half) {
            this.mesh.scale.setScalar((this.teleport - half) / half);
        } else {
            if (this.index !== this.target) {
                this.index = this.target;
                const pos = this.positions[this.index];
                this.mesh.position.set(pos.x, 0.06, pos.z);
            }
            this.mesh.scale.setScalar(this.teleport > 0 ? 1 - this.teleport / half : 1);
        }
    }
}
