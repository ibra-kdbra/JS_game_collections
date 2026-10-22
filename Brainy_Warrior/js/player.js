/**
 * Animates the hero along the tiles produced by `rules.slide`, reporting each
 * event (pickup, kill, fall) as the hero reaches that tile.
 */
export class Player {
    constructor(mesh, onEvent) {
        this.mesh = mesh;
        this.onEvent = onEvent;
        this.speed = 11; // tiles per second
        this.queue = [];
        this.sinking = 0;
        this.bump = 0;
    }

    get isMoving() {
        return this.queue.length > 0 || this.sinking > 0 || this.bump > 0;
    }

    place(x, z) {
        this.queue = [];
        this.sinking = 0;
        this.bump = 0;
        this.mesh.position.set(x, 0, z);
        this.mesh.rotation.set(0, this.mesh.rotation.y, 0);
    }

    /** Run along `steps`, then call `done()`. */
    follow(steps, done) {
        this.mesh.rotation.y = Math.atan2(steps[0].x - this.mesh.position.x, steps[0].z - this.mesh.position.z);
        this.queue = steps.slice();
        this.done = done;
    }

    /** A short nudge when a slide is blocked straight away. */
    nudge(dx, dz) {
        this.mesh.rotation.y = Math.atan2(dx, dz);
        this.bump = 0.18;
        this.bumpDir = { dx, dz };
        this.bumpOrigin = this.mesh.position.clone();
    }

    update(dt) {
        if (this.bump > 0) {
            this.bump = Math.max(0, this.bump - dt);
            const t = Math.sin((1 - this.bump / 0.18) * Math.PI) * 0.12;
            this.mesh.position.set(this.bumpOrigin.x + this.bumpDir.dx * t, 0, this.bumpOrigin.z + this.bumpDir.dz * t);
            return;
        }
        if (this.sinking > 0) {
            this.sinking = Math.max(0, this.sinking - dt);
            this.mesh.position.y = -1.2 * (1 - this.sinking / 0.5);
            if (this.sinking === 0) this.finish();
            return;
        }
        if (this.queue.length === 0) return;

        let travel = this.speed * dt;
        while (travel > 0 && this.queue.length > 0) {
            const target = this.queue[0];
            const dx = target.x - this.mesh.position.x;
            const dz = target.z - this.mesh.position.z;
            const dist = Math.hypot(dx, dz);
            if (dist > travel) {
                this.mesh.position.x += (dx / dist) * travel;
                this.mesh.position.z += (dz / dist) * travel;
                break;
            }
            travel -= dist;
            this.mesh.position.x = target.x;
            this.mesh.position.z = target.z;
            this.queue.shift();
            if (target.event !== 'move') this.onEvent(target);
            if (target.event === 'fall') {
                this.queue = [];
                this.sinking = 0.5;
                return;
            }
        }
        if (this.queue.length === 0) this.finish();
    }

    finish() {
        const done = this.done;
        this.done = null;
        done?.();
    }
}
