/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

function setCanvasSize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
setCanvasSize();

ctx.fillStyle = 'white';
ctx.strokeStyle = 'white';
ctx.lineWidth = 1;

const flowColorPickers = [];
const defaultColors = ['#4C026B', '#8E0E00', '#9D0208', '#BA1A1A', '#730D9E'];

for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`flowColor${i}`);
    const pickr = Pickr.create({
        el,
        theme: 'classic',
        default: defaultColors[i - 1],
        components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
                hex: true,
                rgba: true,
                input: true,
                clear: true,
                save: true
            }
        }
    });

    pickr.on('save', (color) => {
        el.style.background = color.toHEXA().toString();
        el.setAttribute('data-color', color.toHEXA().toString());
    });

    pickr.on('init', instance => {
        el.setAttribute('data-color', defaultColors[i - 1]);
        el.style.background = defaultColors[i - 1];
    });

    flowColorPickers.push(pickr);
}

class Particle {
    constructor(effect) {
        this.effect = effect;
        this.reset();
        this.history = [{ x: this.x, y: this.y }];
        this.maxLength = Math.floor(Math.random() * 200 + 10);
        this.timer = this.maxLength * 2;
        this.colors = ['#4C026B', '#8E0E00', '#9D0208', '#BA1A1A', '#730D9E'];
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    }

    draw(context) {
        context.beginPath();
        context.moveTo(this.history[0].x, this.history[0].y);
        for (let i = 1; i < this.history.length; i++) {
            context.lineTo(this.history[i].x, this.history[i].y);
        }
        context.strokeStyle = this.color;
        context.stroke();
    }

    update() {
        this.timer--;
        if (this.timer >= 1) {
            const x = Math.floor(this.x / this.effect.cellSize);
            const y = Math.floor(this.y / this.effect.cellSize);
            const index = y * this.effect.cols + x;
            const angle = this.effect.flowField[index];

            this.speedX = Math.cos(angle);
            this.speedY = Math.sin(angle);
            this.x += this.speedX * this.speedModifier;
            this.y += this.speedY * this.speedModifier;

            this.history.push({ x: this.x, y: this.y });
            if (this.history.length > this.maxLength) {
                this.history.shift();
            }
        } else if (this.history.length > 1) {
            this.history.shift();
        } else {
            this.reset();
        }
    }

    reset() {
        this.x = Math.random() * this.effect.width;
        this.y = Math.random() * this.effect.height;
        this.speedModifier = Math.random() * 5 + 1;
        this.history = [{ x: this.x, y: this.y }];
        this.timer = this.maxLength * 2;
    }
}

class Effect {
    constructor(canvas) {
        this.canvas = canvas;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.particles = [];
        this.numberOfParticles = 3000;
        this.cellSize = 20;
        this.curve = 5;
        this.zoom = 0.12;
        this.debug = true;
        this.lastTouchTime = 0;
        this.init();

        window.addEventListener('keydown', (e) => {
            if (e.key === 'd') this.debug = !this.debug;
        });

        window.addEventListener('touchstart', () => {
            const now = Date.now();
            if (now - this.lastTouchTime < 300) {
                this.debug = !this.debug;
            }
            this.lastTouchTime = now;
        });
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.width = this.canvas.width;
            this.height = this.canvas.height;
            this.init();
        });
    }

    init() {
        this.calculateFlowField();
        this.createParticles();
    }

    calculateFlowField() {
        this.rows = Math.floor(this.height / this.cellSize);
        this.cols = Math.floor(this.width / this.cellSize);
        this.flowField = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const angle = (Math.cos(x * this.zoom) + Math.sin(y * this.zoom)) * this.curve;
                this.flowField.push(angle);
            }
        }
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.numberOfParticles; i++) {
            this.particles.push(new Particle(this));
        }
    }

    drawGrid(context) {
        context.save();
        context.strokeStyle = 'white';
        context.lineWidth = 0.3;

        for (let c = 0; c < this.cols; c++) {
            context.beginPath();
            context.moveTo(c * this.cellSize, 0);
            context.lineTo(c * this.cellSize, this.height);
            context.stroke();
        }

        for (let r = 0; r < this.rows; r++) {
            context.beginPath();
            context.moveTo(0, r * this.cellSize);
            context.lineTo(this.width, r * this.cellSize);
            context.stroke();
        }

        context.restore();
    }

    render(context) {
        if (this.debug) this.drawGrid(context);
        this.particles.forEach((particle) => {
            particle.draw(context);
            particle.update();
        });
    }
}

const effect = new Effect(canvas);

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    effect.render(ctx);
    requestAnimationFrame(animate);
}
animate();

/* =============================
   Options Panel / UI Logic
============================= */
const cornerButton = document.getElementById('cornerButton');
const optionsPanel = document.getElementById('optionsPanel');
const colorInput = document.getElementById('colorInput');
const applyColorsBtn = document.getElementById('applyColorsBtn');
const screenshotBtn = document.getElementById('screenshotBtn');

cornerButton.addEventListener('click', () => {
    if (optionsPanel.style.display === 'block') {
        optionsPanel.style.display = 'none';
    } else {
        optionsPanel.style.display = 'block';
    }
});

applyColorsBtn.addEventListener('click', () => {
    const pickedColors = flowColorPickers.map(p => p.getColor()?.toHEXA().toString());
    if (pickedColors.some(c => !c)) {
        alert("Please make sure all 5 colors are selected.");
        return;
    }

    effect.particles.forEach(p => {
        p.colors = pickedColors;
        p.color = pickedColors[Math.floor(Math.random() * pickedColors.length)];
    });

    optionsPanel.style.display = 'none';
});

/* Take a screenshot of the canvas */
screenshotBtn.addEventListener('click', () => {
    const dataURL = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'flow_field_screenshot.png';
    link.href = dataURL;
    link.click();
});
