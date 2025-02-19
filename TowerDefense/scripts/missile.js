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
        // Stats
        this.accAmt = 0.6;
        this.blastRadius = 1;
        this.damageMax = 60;
        this.damageMin = 40;
        this.lifetime = 60;
        this.range = 7;
        this.topSpeed = (4 * 24) / ts;
    }

    draw() {
        push();
        translate(this.pos.x, this.pos.y);
        rotate(this.vel.heading());

        stroke(0);
        fill(this.secondary);
        const base = this.length / 2;
        const side = this.width / 2;
        const tip = base + this.width * 2;
        const back = -base - (base * 2) / 3;
        const fin = side * 4;
        rect(-base, -side, base * 2, side * 2);
        fill(this.color);
        triangle(base, -side, tip, 0, base, side);
        triangle(-base, side, back, fin, 0, side);
        triangle(-base, -side, back, -fin, 0, -side);

        pop();
    }

    explode() {
        if (!muteSounds) sounds.boom.play();
        this.kill();
        const { x, y } = this.pos;
        const inRadius = getInRange(x, y, this.blastRadius, enemies);
        noStroke();
        fill(...this.color, 127);
        const r = (this.blastRadius + 0.5) * ts * 2;
        if (showEffects) {
            const s = new RocketExplosion(x, y);
            for (let i = 0; i < particleAmt; i++) {
                s.addParticle();
            }
            systems.push(s);
        }
        ellipse(x, y, r, r);
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

    reachedTarget() {
        const { x: pX, y: pY } = this.pos;
        const { x: tX, y: tY, radius } = this.target;
        return insideCircle(pX, pY, tX, tY, radius * ts);
    }

    steer() {
        if (!this.target.alive) return;
        const dist = this.pos.dist(this.target.pos);
        const unit = p5.Vector.sub(this.target.pos, this.pos).normalize();
        this.acc.add(unit.mult(this.accAmt));
    }

    update() {
        this.vel.add(this.acc);
        this.vel.limit(this.topSpeed);
        this.pos.add(this.vel);
        this.acc.mult(0);
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
