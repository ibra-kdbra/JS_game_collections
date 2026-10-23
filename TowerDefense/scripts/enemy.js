class Enemy {
    constructor(x, y) {
        this.color = [0, 0, 0];
        this.radius = 0.5;
        this.alive = true;
        this.effects = [];
        this.name = 'enemy';
        this.sound = 'pop';
        this.pos = createVector(x, y);
        this.vel = createVector(0, 0);
        this.cash = 0;
        this.damage = 1;
        this.health = 1;
        this.immune = [];
        this.resistant = [];
        this.weak = [];
        this.speed = 1;
        this.taunt = false;
        this.hit = 0;           // ticks left of the hit flash
    }

    applyEffect(name, duration) {
        if (this.immune.includes(name)) return;
        if (getByName(this.effects, name).length > 0) return;
        var e = createEffect(duration, effects[name]);
        e.onStart(this);
        this.effects.push(e);
    }

    draw() {
        stroke(0);
        fill(this.getColor());
        ellipse(this.pos.x, this.pos.y, this.radius * ts, this.radius * ts);
    }

    dealDamage(amt, type) {
        var mult;
        if (this.immune.includes(type)) {
            mult = 0;
        } else if (this.resistant.includes(type)) {
            mult = 1 - resistance;
        } else if (this.weak.includes(type)) {
            mult = 1 + weakness;
        } else {
            mult = 1;
        }

        const dealt = this.health > 0 ? amt * mult : 0;
        if (this.health > 0) this.health -= dealt;
        if (dealt >= 2) this.hit = 6;
        if (dealt > 0) onEnemyHit(this, dealt, type);
        if (this.health <= 0) this.onKilled();
    }

    // Short white ring after a hit
    drawHit() {
        if (this.hit <= 0) return;
        noFill();
        stroke(255, 255, 255, 40 * this.hit);
        strokeWeight(Math.max(1.5, ts / 12));
        const d = (this.radius + 0.25) * ts;
        ellipse(this.pos.x, this.pos.y, d, d);
        strokeWeight(1);
    }

    // Health bar above the enemy once it has taken damage
    drawHealth() {
        const left = Math.max(0, this.health / this.maxHealth);
        if (left >= 1) return;
        const w = Math.max(10, 0.8 * ts);
        const h = Math.max(3, 0.14 * ts);
        const x = this.pos.x - w / 2;
        const y = this.pos.y - Math.max(this.radius, 0.6) * ts / 2 - h - 2;
        noStroke();
        fill(9, 9, 11, 220);
        rect(x - 1, y - 1, w + 2, h + 2);
        if (left > 0.6) fill(74, 222, 128);
        else if (left > 0.3) fill(250, 204, 21);
        else fill(248, 113, 113);
        rect(x, y, w * left, h);
    }

    getColor() {
        var l = this.effects.length;
        if (l > 0) return this.effects[l - 1].color;
        return this.color;
    }

    isDead() {
        return !this.alive;
    }

    kill() {
        this.alive = false;
    }

    onCreate() {
        this.maxHealth = this.health;
    }

    onExit() {
        if (!godMode) health -= this.damage;
        this.kill();
        onEnemyLeaked(this);
    }

    onKilled() {
        if (this.alive) {
            cash += this.cash;
            this.kill();
            playSound(this.sound);
            onEnemyKilled(this);
        }
    }

    onTick() {}

    pxSpeed() {
        return this.speed * ts / 24;
    }

    steer() {
        var t = gridPos(this.pos.x, this.pos.y);
        if (outsideRect(t.x, t.y, 0, 0, cols, rows)) return;
        var dir = paths[t.x][t.y];
        if (atTileCenter(this.pos.x, this.pos.y, t.x, t.y)) {
            if (dir === null) return;
            var speed = this.pxSpeed();
            if (dir === 1) this.vel = createVector(-speed, 0);
            if (dir === 2) this.vel = createVector(0, -speed);
            if (dir === 3) this.vel = createVector(speed, 0);
            if (dir === 4) this.vel = createVector(0, speed);
        }
    }

    update() {
        if (this.hit > 0) this.hit--;
        for (let i = this.effects.length - 1; i >= 0; i--) {
            let e = this.effects[i];
            e.update(this);
            if (e.isDead()) this.effects.splice(i, 1);
        }
        this.vel.limit(96 / ts);
        this.vel.limit(this.pxSpeed());

        // Stop exactly on the tile center instead of stepping past it, so
        // steering never misses a turn whatever the tile size or speed.
        const t = gridPos(this.pos.x, this.pos.y);
        const c = center(t.x, t.y);
        const dx = c.x - this.pos.x;
        const dy = c.y - this.pos.y;
        const ahead = dx * this.vel.x + dy * this.vel.y > 0;
        if (ahead && dx * dx + dy * dy <= this.vel.magSq()) {
            this.pos.set(c.x, c.y);
        } else {
            this.pos.add(this.vel);
        }
    }
}

