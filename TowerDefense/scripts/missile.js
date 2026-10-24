class Missile {
    constructor(x, y, e) {
        // Physics
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.acc = createVector(0, 0);
        // Display
        this.color = [207, 0, 15];
        this.secondary = [189, 195, 199];
        this.length = 0.6 * ts;
        this.width = 0.2 * ts;
        // Misc
        this.alive = true;
        this.target = e;
        this.source = dmgSource;    // the tower that launched it
        // Stats
        this.accAmt = 0.6;
        this.blastRadius = 1;
        this.damageMax = 60;
        this.damageMin = 40;
        this.lifetime = 60;
        this.range = 7;
        // Speeds are scaled to the tile size (they were tuned for 24 px tiles)
        this.topSpeed = 4 * ts / 24;
    }

    explode() {
        dmgSource = this.source;
        playSound('boom');
        this.kill();
        const { x, y } = this.pos;
        const inRadius = getInRange(x, y, this.blastRadius, enemies);
        FX.blast(x, y, this.blastRadius > 1 ? 'silo' : 'rocket', this.blastRadius);
        inRadius.forEach((e) => {
            const damage = Math.round(random(this.damageMax, this.damageMin));
            e.dealDamage(damage, 'explosion');
        });
        this.kill();
    }

    findTarget() {
        let entities = this.visible(enemies);
        if (entities.length === 0) {
            this.kill();
            return;
        }
        const t = getTaunting(entities);
        if (t.length > 0) entities = t;
        const e = getNearest(entities, this.pos);
        if (!e) {
            this.kill();
            return;
        }
        this.target = e;
    }

    isDead() {
        return !this.alive;
    }

    kill() {
        this.alive = false;
    }

    // Explode on contact with the target (or when the fuse runs out, see update)
    reachedTarget() {
        const t = this.target;
        return insideCircle(this.pos.x, this.pos.y, t.pos.x, t.pos.y, t.radius * ts);
    }

    steer() {
        if (!this.target.alive) return;
        const dist = this.pos.dist(this.target.pos);
        const unit = p5.Vector.sub(this.target.pos, this.pos).normalize();
        this.acc.add(unit.mult(this.accAmt * ts / 24));
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.topSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
        FX.trail(this);
        if (!this.target.alive) this.findTarget();
        if (this.lifetime > 0) {
            this.lifetime--;
        } else {
            this.explode();
        }
    }

    // Returns array of visible entities out of passed array
    visible(entities) {
        return getInRange(this.pos.x, this.pos.y, this.range, entities);
    }
}
