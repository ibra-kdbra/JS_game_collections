function createEnemy(x, y, template = {}) {
    const e = new Enemy(x, y);
    Object.keys(template).forEach(key => {
        e[key] = template[key];
    });
    e.onCreate();
    return e;
}

const enemy = {};

enemy.weak = {
    // Display
    color: [189, 195, 199],
    // Misc
    name: 'weak',
    // Stats
    cash: 1,
    health: 35
};

enemy.strong = {
    // Display
    color: [108, 122, 137],
    radius: 0.6,
    // Misc
    name: 'strong',
    // Stats
    cash: 1,
    health: 75
};

enemy.fast = {
    // Display
    color: [61, 251, 255],
    // Misc
    name: 'fast',
    // Stats
    cash: 2,
    health: 75,
    speed: 2,
    // Methods
};

enemy.strongFast = {
    // Display
    color: [30, 139, 195],
    // Misc
    name: 'strongFast',
    // Stats
    cash: 2,
    health: 135,
    speed: 2,
    // Methods
};

enemy.medic = {
    // Display
    color: [192, 57, 43],
    radius: 0.7,
    // Misc
    name: 'medic',
    // Stats
    cash: 4,
    health: 375,
    immune: ['regen'],
    // Methods
    onTick() {
        // Same circle as getInRange(x, y, 2, enemies), without a new array per tick
        const r2 = (3 * ts) ** 2;
        const affected = [];
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if ((e.pos.x - this.pos.x) ** 2 + (e.pos.y - this.pos.y) ** 2 < r2) affected.push(e);
        }
        for (let i = 0; i < affected.length; i++) affected[i].applyEffect('regen', 1);
    }
};

enemy.stronger = {
    // Display
    color: [52, 73, 94],
    radius: 0.8,
    // Misc
    name: 'stronger',
    // Stats
    cash: 4,
    health: 375
};

enemy.faster = {
    // Display
    color: [249, 105, 14],
    // Misc
    name: 'faster',
    // Stats
    cash: 4,
    health: 375,
    resistant: ['explosion'],
    speed: 3,
    // Methods
};

enemy.tank = {
    // Display
    color: [30, 130, 76],
    radius: 1,
    // Misc
    name: 'tank',
    // Stats
    cash: 4,
    health: 750,
    immune: ['poison', 'slow'],
    resistant: ['energy', 'physical'],
    weak: ['explosion', 'piercing'],
    // Methods
};

enemy.taunt = {
    // Display
    color: [102, 51, 153],
    radius: 0.8,
    // Misc
    name: 'taunt',
    sound: 'taunt',
    // Stats
    cash: 8,
    health: 1500,
    immune: ['poison', 'slow'],
    resistant: ['energy', 'physical'],
    taunt: true,
    // Methods
};

enemy.spawner = {
    // Display
    color: [244, 232, 66],
    radius: 0.7,
    // Misc
    name: 'spawner',
    // Stats
    cash: 10,
    health: 1150,
    // Methods
    onKilled() {
        if (this.alive) {
            cash += this.cash;
            this.kill();
            playSound(this.sound);
            onEnemyKilled(this);

            // Add new temporary spawnpoint
            const c = gridPos(this.pos.x, this.pos.y);
            if (c.equals(exit)) return;
            for (let i = 0; i < tempSpawns.length; i++) {
                if (c.equals(tempSpawns[i][0])) return;
            }
            // Enemies from the new portal set off the way the Hive was walking
            // (on a crossing the tile itself has no direction)
            tempSpawns.push([createVector(c.x, c.y), tempSpawnCount, this.vel.copy()]);
        }
    }
};
