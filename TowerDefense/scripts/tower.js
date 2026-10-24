class Tower {
    constructor(col, row) {
        // Display
        this.baseOnTop = true;      // render base over barrel
        this.border = [0, 0, 0];    // border color
        this.color = [0, 0, 0];     // main color
        this.drawLine = true;       // draw line to enemy on attack
        this.follow = true;         // follow target even when not firing
        this.hasBarrel = true;
        this.hasBase = true;
        this.length = 0.7;          // barrel length in tiles
        this.radius = 1;            // radius in tiles
        this.secondary = [0, 0, 0]; // secondary color
        this.weight = 2;            // laser stroke weight
        this.width = 0.3;           // barrel width in tiles

        // Misc
        this.alive = true;
        this.name = 'tower';
        this.sound = null;          // sound to play on fire
        this.title = 'Tower';

        // Position
        this.angle = 0;
        this.gridPos = createVector(col, row);
        this.pos = createVector(col * ts + ts / 2, row * ts + ts / 2);
        
        // Stats
        this.cooldownMax = 0;
        this.cooldownMin = 0;
        this.cost = 0;
        this.damageMax = 20;
        this.damageMin = 1;
        this.range = 3;
        this.totalCost = 0;
        this.type = 'physical';     // damage type
        this.targetMode = 'first';  // which enemy in range to shoot (see pickTarget)
        this.upgrades = [];
    }

    // Adjust angle to point towards pixel position
    aim(x, y) {
        this.angle = Math.atan2(y - this.pos.y, x - this.pos.x);
    }

    // Deal damage to enemy
    attack(e) {
        const damage = Math.round(Math.random() * (this.damageMax - this.damageMin) + this.damageMin);
        e.dealDamage(damage, this.type);
        playSound(this.sound);
        this.onHit(e);
    }

    // Check if cooldown is completed
    canFire() {
        return this.cd === 0;
    }

    // Returns damage range
    getDamage() {
        return rangeText(this.damageMin, this.damageMax);
    }

    // Returns average cooldown in seconds
    getCooldown() {
        return (this.cooldownMin + this.cooldownMax) / 120;
    }

    kill() {
        this.alive = false;
    }

    isDead() {
        return !this.alive;
    }

    // Functionality once entity has been targeted
    onAim(e) {
        if (this.canFire() || this.follow) this.aim(e.pos.x, e.pos.y);
        if (stopFiring) return;
        if (!this.canFire()) return;
        this.resetCooldown();
        this.attack(e);
        // Shot, beam or bolt (fx.js); the look depends on the tower
        FX.fire(this, e);
    }

    onCreate() {
        this.cd = 0;                // current cooldown left
    }

    onHit(e) {}

    resetCooldown() {
        this.cd = Math.round(Math.random() * (this.cooldownMax - this.cooldownMin) + this.cooldownMin);
    }

    // Sell price
    sellPrice() {
        return Math.floor(this.totalCost * sellConst);
    }

    // Target correct enemy
    target(entities) {
        const e = this.pickInRange(entities);
        if (typeof e === 'undefined') return;
        this.onAim(e);
    }

    // The enemy this tower would shoot: the same choice as visible(), then
    // getTaunting() and pickTarget() (utils.js), done in one pass without
    // building arrays, since every tower runs it every tick.
    pickInRange(entities) {
        const r = (this.range + 1) * ts;
        const r2 = r * r;
        const px = this.pos.x;
        const py = this.pos.y;
        let any = false;
        let taunt = false;
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if ((e.pos.x - px) ** 2 + (e.pos.y - py) ** 2 < r2) {
                any = true;
                if (e.taunt) {
                    taunt = true;
                    break;
                }
            }
        }
        if (!any) return undefined;
        const mode = this.targetMode;
        let chosen;
        let best = mode === 'last' ? -1 : 10000;
        for (let i = 0; i < entities.length; i++) {
            const e = entities[i];
            if ((e.pos.x - px) ** 2 + (e.pos.y - py) ** 2 >= r2) continue;
            if (taunt && !e.taunt) continue;
            if (chosen === undefined) chosen = e;
            if (mode === 'strong') {
                if (e.health > chosen.health) chosen = e;
            } else if (mode === 'close') {
                const d = Math.hypot(e.pos.x - px, e.pos.y - py);
                if (d < best) {
                    best = d;
                    chosen = e;
                }
            } else {
                const gx = Math.floor(e.pos.x / ts);
                const gy = Math.floor(e.pos.y / ts);
                if (mode === 'last') {
                    const d = dists[gx]?.[gy] ?? 0;
                    if (d > best) {
                        best = d;
                        chosen = e;
                    }
                } else {
                    const d = dists[gx][gy];
                    if (d < best) {
                        best = d;
                        chosen = e;
                    }
                }
            }
        }
        return chosen;
    }

    update() {
        if (this.cd > 0) this.cd--;
    }

    // Use template to set attributes
    upgrade(template = {}) {
        Object.keys(template).forEach(key => {
            this[key] = template[key];
        });
        if (template.cost) this.totalCost += template.cost;
    }

    // Returns array of visible entities out of passed array
    visible(entities) {
        return getInRange(this.pos.x, this.pos.y, this.range, entities);
    }
}
