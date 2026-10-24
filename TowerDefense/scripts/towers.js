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
        onAim(e) {
            this.attack(e);
        },
        onHit(e) {
            e.applyEffect('slow', 40);
        },
        // Target correct enemy
        target(entities) {
            if (stopFiring) return;
            // Everything in range is hit; checked in place to avoid a new array every tick
            const r = (this.range + 1) * ts;
            const r2 = r * r;
            const px = this.pos.x;
            const py = this.pos.y;
            const inside = (e) => (e.pos.x - px) ** 2 + (e.pos.y - py) ** 2 < r2;
            if (!entities.some(inside)) return;
            if (!this.canFire()) return;
            this.resetCooldown();
            FX.pulse(this);
            for (let i = 0; i < entities.length; i++) {
                if (inside(entities[i])) this.onAim(entities[i]);
            }
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
        targetMode: 'strong',
        // Methods
        target(entities) {
            if (stopFiring) return;
            const e = this.pickInRange(entities);
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
                onHit(e) {
                    const blastRadius = 1;
                    const inRadius = getInRange(e.pos.x, e.pos.y, blastRadius, enemies);
                    FX.blast(e.pos.x, e.pos.y, 'rail', blastRadius);
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
    onAim(e) {
        if (this.canFire() || this.follow) this.aim(e.pos.x, e.pos.y);
        if (stopFiring) return;
        if (!this.canFire()) return;
        this.resetCooldown();
        projectiles.push(new Missile(this.pos.x, this.pos.y, e));
        playSound(this.sound);
        FX.launch(this);
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
                m.topSpeed = 6 * ts / 24;
                projectiles.push(m);
                playSound(this.sound);
                FX.launch(this);
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
    onHit(e) {
        const blastRadius = 1;
        const inRadius = getInRange(e.pos.x, e.pos.y, blastRadius, enemies);
        FX.blast(e.pos.x, e.pos.y, 'bomb', blastRadius);
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
            onHit(e) {
                const blastRadius = 1;
                const inRadius = getInRange(e.pos.x, e.pos.y, blastRadius, enemies);
                FX.blast(e.pos.x, e.pos.y, 'cluster', blastRadius);
                const segs = 3;
                const a0 = random(0, TWO_PI);
                for (let i = 0; i < segs; i++) {
                    const a = (TWO_PI / segs) * i + a0;
                    const d = 2 * ts;
                    const x = e.pos.x + cos(a) * d;
                    const y = e.pos.y + sin(a) * d;
                    const inRadius = getInRange(x, y, blastRadius, enemies);
                    FX.blast(x, y, 'sub', 0.6);
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
    hasBarrel: false,       // drawn as a coil (drawBase); it was hidden behind a stray barrel
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
    type: 'energy',     // zaps (tanks and taunts resist energy as much as physical)
    
    // Methods
    onHit(e) {
        const amt = round(random(this.damageMin, this.damageMax));
        e.dealDamage(amt, this.type);
        playSound(this.sound);
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
            onHit(e) {
                const amt = round(random(this.damageMin, this.damageMax));
                e.dealDamage(amt, this.type);
                playSound(this.sound);
            }
        }
    ]
};
