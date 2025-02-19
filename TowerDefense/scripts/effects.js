function createEffect(duration, template = {}) {
    const e = new Effect(duration);
    Object.keys(template).forEach(key => {
        e[key] = template[key];
    });
    return e;
}

const effects = {};

effects.slow = {
    // Display
    color: [68, 108, 179],
    // Misc
    name: 'slow',
    // Methods
    onEnd(e) {
        e.speed = this.oldSpeed;
    },
    onStart(e) {
        this.oldSpeed = e.speed;
        this.speed = e.speed / 2;
        e.speed = this.speed;
    }
};

effects.poison = {
    // Display
    color: [102, 204, 26],
    // Misc
    name: 'poison',
    // Methods
    onTick(e) {
        e.dealDamage(1, 'poison');
    }
};

effects.regen = {
    // Display
    color: [210, 82, 127],
    // Misc
    name: 'regen',
    // Methods
    onTick(e) {
        if (e.health < e.maxHealth && random() < 0.2) e.health++;
    }
};
