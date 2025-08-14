const createTower = (x, y, template) => {
    const t = new Tower(x, y);
    t.upgrade(template);
    t.onCreate();
    return t;
};

const tower = {
    gun: {
        // Display
        color: [249, 191, 59],
        length: 0.65,
        radius: 0.9,
        secondary: [149, 165, 166],
        // Misc
        name: 'gun',
        title: 'Gun Tower',
        // Stats
        cooldownMax: 18,
        cooldownMin: 8,
        cost: 25,
        range: 3,
        // Upgrades
        upgrades: [
            {
                // Display
                color: [249, 105, 14],
                // Misc
                name: 'machineGun',
                title: 'Machine Gun',
                // Stats
                cooldownMax: 5,
                cooldownMin: 0,
                cost: 75,
                damageMax: 10,
                damageMin: 0
            }
        ]
    },

    laser: {
        // Display
        color: [25, 181, 254],
        length: 0.55,
        radius: 0.8,
        secondary: [149, 165, 166],
        width: 0.25,
        // Misc
        name: 'laser',
        title: 'Laser Tower',
        // Stats
        cooldownMax: 1,
        cost: 75,
        damageMax: 3,
        range: 2,
        type: 'energy',
        // Upgrades
        upgrades: [
            {
                // Display
                color: [78, 205, 196],
                length: 0.65,
                radius: 0.9,
                secondary: [191, 191, 191],
                weight: 3,
                width: 0.35,
                // Misc
                name: 'beamEmitter',
                title: 'Beam Emitter',
                // Stats
                cooldownMax: 0,
                cost: 200,
                damageMax: 0.1,
                damageMin: 0.001,
                range: 3,
                // Methods
                attack(e) {
                    if (this.lastTarget === e) {
                        this.duration++;
                    } else {
                        this.lastTarget = e;
                        this.duration = 0;
                    }
                    // var damage = this.damageMin * pow(2, this.duration);
                    const d = random(this.damageMin, this.damageMax);
                    const damage = d * sq(this.duration);
                    e.dealDamage(damage, this.type);
                    this.onHit(e);
                },
                onHit(e) {}
            }
        ]
    },

    slow: {
        // Display
        baseOnTop: false,
        color: [75, 119, 190],
        drawLine: false,
        length: 1.1,
        radius: 0.9,
        secondary: [189, 195, 199],
        width: 0.3,
        // Misc
        name: 'slow',
        title: 'Slow Tower',
        // Stats
        cooldownMax: 0,
        cooldownMin: 0,
        cost: 100,
        damageMax: 0,
        damageMin: 0,
        range: 1,
        type: 'slow',
        // Methods
        drawBarrel() {
            stroke(this.border);
            fill(this.secondary);
            const back = -this.length * ts / 2;
            const side = this.width * ts / 2;
            rect(back, -side, this.length * ts, this.width * ts);
        },
        onAim(e) {
            this.attack(e);
        },
        onHit(e) {
            e.applyEffect('slow', 40);
        },
        // Target correct enemy
        target(entities) {
            if (stopFiring) return;
            entities = this.visible(entities);
            if (entities.length === 0) return;
            if (!this.canFire()) return;
            this.resetCooldown();
            noStroke();
            fill(this.color[0], this.color[1], this.color[2], 127);
            const r = this.range * 2 + 1;
            ellipse(this.pos.x, this.pos.y, r * ts, r * ts);
            entities.forEach((entity) => {
                this.onAim(entity);
            });
        },
        update() {
            this.angle += PI / 60;
            if (this.cd > 0) this.cd--;
        },
        // Upgrades
        upgrades: [
            {
                // Display
                color: [102, 204, 26],
                radius: 0.9,
                // Misc
                name: 'poison',
                title: 'Poison Tower',
                // Stats
                cooldownMax: 60,
                cooldownMin: 60,
                cost: 150,
                range: 2,
                type: 'poison',
                // Methods
                onHit(e) {
                    e.applyEffect('poison', 60);
                }
            }
        ]
    },

    sniper: {
        // Display
        color: [207, 0, 15],
        follow: false,
        hasBase: false,
        radius: 0.9,
        weight: 3,
        // Misc
        name: 'sniper',
        sound: 'sniper',
        title: 'Sniper Tower',
        // Stats
        cooldownMax: 100,
        cooldownMin: 60,
        cost: 150,
        damageMax: 100,
        damageMin: 100,
        range: 9,
        // Methods
        drawBarrel() {
            stroke(0);
            fill(this.color);
            const height = this.radius * ts * sqrt(3) / 2;
            const back = -height / 3;
            const front = height * 2 / 3;
            const side = this.radius * ts / 2;
            triangle(back, -side, back, side, front, 0);
        },
        target(entities) {
            if (stopFiring) return;
            entities = this.visible(entities);
            if (entities.length === 0) return;
            const t = getTaunting(entities);
            if (t.length > 0) entities = t;
            const e = getStrongest(entities);
            if (typeof e === 'undefined') return;
            this.onAim(e);
        },
        // Upgrades
        upgrades: [
            {
                // Display
                baseOnTop: false,
                color: [103, 65, 114],
                hasBase: true,
                length: 0.7,
                radius: 1,
                secondary: [103, 128, 159],
                weight: 4,
                width: 0.4,
                // Misc
                name: 'railgun',
                sound: 'railgun',
                title: 'Railgun',
                // Stats
                cooldownMax: 120,
                cooldownMin: 100,
                cost: 300,
                damageMax: 200,
                damageMin: 200,
                range: 11,
                type: 'piercing',
                // Methods
                drawBarrel() {
                    stroke(this.border);
                    fill(this.secondary);
                    const base = -this.length * ts;
                    const side = -this.width * ts / 2;
                    rect(base, side, this.length * ts * 2, this.width * ts);
                    fill(207, 0, 15);
                    ellipse(0, 0, this.radius * ts * 2 / 3, this.radius * ts * 2 / 3);
                },
                onHit(e) {
                    const blastRadius = 1;
                    const inRadius = getInRange(e.pos.x, e.pos.y, blastRadius, enemies);
                    noStroke();
                    fill(this.color[0], this.color[1], this.color[2], 127);
                    ellipse(e.pos.x, e.pos.y, ts * 2.5, ts * 2.5);
                    if (showEffects) {
                        const s = new ShrapnelExplosion(e.pos.x, e.pos.y);
                        for (let i = 0; i < particleAmt; i++) {
                            s.addParticle();
                        }
                        systems.push(s);
                    }
                    inRadius.forEach((h) => {
                        const amt = round(random(this.damageMin, this.damageMax));
                        h.dealDamage(amt, this.type);
                    });
                }
            }
        ]
    }
};


tower.rocket = {
    // Display
    baseOnTop: false,
    color: [30, 130, 76],
    drawLine: false,
    length: 0.6,
    radius: 0.75,
    secondary: [189, 195, 199],
    width: 0.2,
    
    // Misc
    name: 'rocket',
    sound: 'missile',
    title: 'Rocket Tower',
    
    // Stats
    cooldownMax: 80,
    cooldownMin: 60,
    cost: 250,
    range: 7,
    damageMax: 60,
    damageMin: 40,
    type: 'explosion',
    
    // Methods
    drawBarrel() {
        stroke(this.border);
        fill(this.secondary);
        rect(0, -this.width * ts, this.length * ts, this.width * ts);
        rect(0, 0, this.length * ts, this.width * ts);
        fill(207, 0, 15);
        const mid = this.width * ts / 2;
        const base = this.length * ts;
        const tip = this.length * ts + this.width * ts * 2;
        const side = this.width * ts;
        triangle(base, -side, tip, -mid, base, 0);
        triangle(base, side, tip, mid, base, 0);
        fill(this.color);
        const edge = this.width * ts * 4;
        const fEdge = this.width * ts * 1.5;
        const back = -this.width * ts * 0.75;
        const front = this.width * ts * 1.25;
        quad(back, -edge, back, edge, front, fEdge, front, -fEdge);
    },
    drawBase() {
        stroke(this.border);
        fill(this.secondary);
        ellipse(this.pos.x, this.pos.y, this.radius * ts, this.radius * ts);
    },
    onAim(e) {
        if (this.canFire() || this.follow) this.aim(e.pos.x, e.pos.y);
        if (stopFiring) return;
        if (!this.canFire()) return;
        this.resetCooldown();
        projectiles.push(new Missile(this.pos.x, this.pos.y, e));
        if (!muteSounds && sounds.hasOwnProperty(this.sound)) {
            sounds[this.sound].play();
        }
    },
    
    // Upgrades
    upgrades: [
        {
            // Display
            color: [65, 131, 215],
            secondary: [108, 122, 137],
            
            // Misc
            name: 'missileSilo',
            sound: 'missile',
            title: 'Missile Silo',
            
            // Stats
            cooldownMax: 80,
            cooldownMin: 40,
            cost: 250,
            damageMax: 120,
            damageMin: 100,
            range: 9,
            
            // Methods
            drawBarrel() {
                stroke(this.border);
                fill(this.secondary);
                rect(0, -this.width * ts, this.length * ts, this.width * ts);
                rect(0, 0, this.length * ts, this.width * ts);
                fill(this.color);
                const mid = this.width * ts / 2;
                const base = this.length * ts;
                const tip = this.length * ts + this.width * ts * 2;
                const side = this.width * ts;
                triangle(base, -side, tip, -mid, base, 0);
                triangle(base, side, tip, mid, base, 0);
                fill(31, 58, 147);
                const edge = this.width * ts * 4;
                const fEdge = this.width * ts * 1.5;
                const back = -this.width * ts * 0.75;
                const front = this.width * ts * 1.25;
                quad(back, -edge, back, edge, front, fEdge, front, -fEdge);
            },
            onAim(e) {
                if (this.canFire() || this.follow) this.aim(e.pos.x, e.pos.y);
                if (stopFiring) return;
                if (!this.canFire()) return;
                this.resetCooldown();
                const m = new Missile(this.pos.x, this.pos.y, e);
                m.color = [65, 131, 215];
                m.secondary = this.secondary;
                m.blastRadius = 2;
                m.damageMax = this.damageMax;
                m.damageMin = this.damageMin;
                m.accAmt = 0.7;
                m.topSpeed = (6 * 24) / ts;
                projectiles.push(m);
                if (!muteSounds && sounds.hasOwnProperty(this.sound)) {
                    sounds[this.sound].play();
                }
            }
        }
    ]
};

tower.bomb = {
    // Display
    baseOnTop: false,
    color: [102, 51, 153],
    drawLine: false,
    length: 0.6,
    width: 0.35,
    secondary: [103, 128, 159],
    
    // Misc
    name: 'bomb',
    title: 'Bomb Tower',
    
    // Stats
    cooldownMax: 60,
    cooldownMin: 40,
    cost: 250,
    damageMax: 60,
    damageMin: 20,
    range: 2,
    type: 'explosion',
    
    // Methods
    drawBarrel() {
        stroke(this.border);
        fill(this.secondary);
        rect(0, -this.width * ts / 2, this.length * ts, this.width * ts);
        fill(191, 85, 236);
        ellipse(0, 0, this.radius * ts * 2 / 3, this.radius * ts * 2 / 3);
    },
    onHit(e) {
        const blastRadius = 1;
        const inRadius = getInRange(e.pos.x, e.pos.y, blastRadius, enemies);
        noStroke();
        fill(191, 85, 236, 127);
        ellipse(e.pos.x, e.pos.y, ts * 2.5, ts * 2.5);
        if (showEffects) {
            const s = new BombExplosion(e.pos.x, e.pos.y);
            for (let i = 0; i < particleAmt; i++) {
                s.addParticle();
            }
            systems.push(s);
        }
        for (let i = 0; i < inRadius.length; i++) {
            const h = inRadius[i];
            const amt = round(random(this.damageMin, this.damageMax));
            h.dealDamage(amt, this.type);
        }
    },
    
    upgrades: [
        {
            // Display
            radius: 1.1,
            
            // Misc
            name: 'clusterBomb',
            title: 'Cluster Bomb',
            
            // Stats
            cooldownMax: 80,
            cooldownMin: 40,
            cost: 250,
            damageMax: 140,
            damageMin: 100,
            
            // Methods
            drawBarrel() {
                stroke(this.border);
                fill(this.secondary);
                rect(0, -this.width * ts / 2, this.length * ts, this.width * ts);
                fill(249, 105, 14);
                ellipse(0, 0, this.radius * ts * 2 / 3, this.radius * ts * 2 / 3);
            },
            onHit(e) {
                const blastRadius = 1;
                const inRadius = getInRange(e.pos.x, e.pos.y, blastRadius, enemies);
                noStroke();
                fill(191, 85, 236, 127);
                ellipse(e.pos.x, e.pos.y, ts * 2.5, ts * 2.5);
                if (showEffects) {
                    const s = new BombExplosion(e.pos.x, e.pos.y);
                    for (let i = 0; i < particleAmt / 2; i++) {
                        s.addParticle();
                    }
                    systems.push(s);
                }
                const segs = 3;
                const a0 = random(0, TWO_PI);
                for (let i = 0; i < segs; i++) {
                    const a = (TWO_PI / segs) * i + a0;
                    const d = 2 * ts;
                    const x = e.pos.x + cos(a) * d;
                    const y = e.pos.y + sin(a) * d;
                    const inRadius = getInRange(x, y, blastRadius, enemies);
                    if (showEffects) {
                        const s = new BombExplosion(x, y);
                        for (let j = 0; j < particleAmt / 2; j++) {
                            s.addParticle();
                        }
                        systems.push(s);
                    }
                    for (let j = 0; j < inRadius.length; j++) {
                        const h = inRadius[j];
                        const amt = round(random(this.damageMin, this.damageMax));
                        h.dealDamage(amt, this.type);
                    }
                }
            }
        }
    ]
};

tower.tesla = {
    // Display
    color: [255, 255, 0],
    hasBase: false,
    radius: 1,
    secondary: [30, 139, 195],
    weight: 10,
    
    // Misc
    name: 'tesla',
    sound: 'spark',
    title: 'Tesla Tower',
    
    // Stats
    cooldownMax: 60,
    cooldownMin: 40,
    cost: 300,
    damageMax: 50,
    damageMin: 30,
    range: 4,
    
    // Methods
    drawBase() {
        stroke(255);
        fill(this.secondary);
        ellipse(this.pos.x, this.pos.y, this.radius * ts, this.radius * ts);
        fill(60);
        ellipse(this.pos.x, this.pos.y, this.radius * ts - 3, this.radius * ts - 3);
    },
    onHit(e) {
        const amt = round(random(this.damageMin, this.damageMax));
        e.dealDamage(amt, this.type);
        if (!muteSounds && sounds.hasOwnProperty(this.sound)) {
            sounds[this.sound].play();
        }
    },
    
    upgrades: [
        {
            // Display
            color: [80, 235, 255],
            secondary: [0, 164, 255],
            
            // Misc
            name: 'lightningStrike',
            sound: 'spark',
            title: 'Lightning Strike',
            
            // Stats
            cooldownMax: 40,
            cooldownMin: 30,
            cost: 350,
            damageMax: 120,
            damageMin: 90,
            range: 6,
            
            // Methods
            drawBase() {
                stroke(255);
                fill(this.secondary);
                ellipse(this.pos.x, this.pos.y, this.radius * ts, this.radius * ts);
                fill(60);
                ellipse(this.pos.x, this.pos.y, this.radius * ts - 3, this.radius * ts - 3);
                fill(80, 235, 255);
                const spike = this.radius * ts * 0.6;
                triangle(this.pos.x, this.pos.y - spike, this.pos.x - spike, this.pos.y + spike, this.pos.x + spike, this.pos.y + spike);
            },
            onHit(e) {
                const amt = round(random(this.damageMin, this.damageMax));
                e.dealDamage(amt, this.type);
                if (!muteSounds && sounds.hasOwnProperty(this.sound)) {
                    sounds[this.sound].play();
                }
            }
        }
    ]
};
