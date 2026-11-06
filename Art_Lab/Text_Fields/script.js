/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

// The canvas backing store matches the size it is shown at, times the
// device pixel ratio, so the text keeps its proportions and stays sharp on
// high-DPI screens. Everything below draws in CSS pixels.
function pixelRatio() {
    if (window.ArtEmbed && window.ArtEmbed.on) return window.ArtEmbed.dpr(1.5);
    // Thousands of stroked lines a frame: 2x is sharp and keeps phones smooth.
    return Math.min(window.devicePixelRatio || 1, 2);
}

function viewSize() {
    return {
        width: Math.max(1, canvas.clientWidth || window.innerWidth),
        height: Math.max(1, canvas.clientHeight || window.innerHeight),
    };
}

let lastTap = 0;

/* =============================
   Debug Toggle
============================= */
window.addEventListener('touchstart', () => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 400 && tapLength > 0) {
        effect.debug = !effect.debug;
    }
    lastTap = currentTime;
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'd') {
        effect.debug = !effect.debug;
    }
});

const cornerButton = document.getElementById('cornerButton');
const optionsPanel = document.getElementById('optionsPanel');
cornerButton.addEventListener('click', () => {
    optionsPanel.style.display = optionsPanel.style.display === 'block' ? 'none' : 'block';
});

const textInput = document.getElementById('textInput');
const applyBtn = document.getElementById('applyBtn');

// Initialize Pickr instances for flow and gradient colors
const flowColorPickers = [];
const gradientColorPickers = [];

const initialFlowColors = ['#4C026B', '#8E0E00', '#9D0208', '#BA1A1A', '#730D9E'];
const initialGradientColors = ['#ff0000', '#00ff00', '#0000ff'];

// Helper function to initialize Pickr
function initPickr(el, defaultColor) {
    const pickr = Pickr.create({
        el: el,
        theme: 'classic',
        default: defaultColor,
        components: {
            preview: true,
            opacity: true,
            hue: true,
            interaction: {
                hex: true,
                input: true,
                save: true
            }
        }
    });

    pickr.on('save', (color) => {
        el.style.background = color.toHEXA().toString();
        pickr.hide();
    });

    return pickr;
}

// Setup flow color Pickrs
document.querySelectorAll('.flow-color').forEach((el, i) => {
    const pickr = initPickr(el, initialFlowColors[i]);
    flowColorPickers.push(pickr);
});

// Setup gradient color Pickrs
document.querySelectorAll('.gradient-color').forEach((el, i) => {
    const pickr = initPickr(el, initialGradientColors[i]);
    gradientColorPickers.push(pickr);
});

applyBtn.addEventListener('click', () => {
    const newText = textInput.value.trim();
    if (newText) {
        effect.setUserText(newText);
    }

    const gradientColors = gradientColorPickers
        .map(pickr => pickr.getColor().toHEXA().toString())
        .filter(Boolean);
    if (gradientColors.length > 0) {
        effect.setUserGradient(gradientColors);
    }

    const flowColors = flowColorPickers
        .map(pickr => pickr.getColor().toHEXA().toString())
        .filter(Boolean);
    if (flowColors.length > 0) {
        effect.setFlowFieldColor(flowColors);
    }

    optionsPanel.style.display = 'none';
});


class Particle {
    constructor(effect) {
        this.effect = effect;
        this.x = Math.floor(Math.random() * this.effect.width);
        this.y = Math.floor(Math.random() * this.effect.height);
        this.speedX = 0;
        this.speedY = 0;
        this.speedModifier = Math.floor(Math.random() * 2 + 1);
        this.history = [{ x: this.x, y: this.y }];
        this.maxLength = Math.floor(Math.random() * 60 + 20);
        this.angle = 0;
        this.newAngle = 0;
        this.angleCorrector = Math.random() * 0.5 + 0.01;
        this.timer = this.maxLength * 2;

        // If user-defined flowFieldColor exists, use it; otherwise pick from default
        if (this.effect.flowFieldColor && this.effect.flowFieldColor.length > 0) {
            this.color = this.effect.flowFieldColor[Math.floor(Math.random() * this.effect.flowFieldColor.length)];
        } else {
            this.colors = ['#4C026B', '#8E0E00', '#9D0208', '#BA1A1A', '#730D9E'];
            this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
        }
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
            let x = Math.floor(this.x / this.effect.cellSize);
            let y = Math.floor(this.y / this.effect.cellSize);
            let index = y * this.effect.cols + x;

            if (this.effect.flowField[index]) {
                this.newAngle = this.effect.flowField[index].colorAngle;
                if (this.angle > this.newAngle) {
                    this.angle -= this.angleCorrector;
                } else if (this.angle < this.newAngle) {
                    this.angle += this.angleCorrector;
                } else {
                    this.angle = this.newAngle;
                }
            }

            this.speedX = Math.cos(this.angle);
            this.speedY = Math.sin(this.angle);
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
        let attempts = 0;
        let resetSuccess = false;

        // Respawn inside a cell covered by the text, so the letters stay readable.
        while (attempts < 10 && !resetSuccess) {
            attempts++;
            let testIndex = Math.floor(Math.random() * this.effect.flowField.length);
            const cell = this.effect.flowField[testIndex];
            if (cell && cell.alpha > 0) {
                this.x = cell.x;
                this.y = cell.y;
                this.history = [{ x: this.x, y: this.y }];
                this.timer = this.maxLength * 2;
                resetSuccess = true;
            }
        }
        if (!resetSuccess) {
            this.x = Math.random() * this.effect.width;
            this.y = Math.random() * this.effect.height;
            this.history = [{ x: this.x, y: this.y }];
            this.timer = this.maxLength * 2;
        }
    }
}

class Effect {
    constructor(canvas) {
        this.canvas = canvas;
        this.context = ctx;
        this.width = 0;
        this.height = 0;
        this.dpr = 1;

        this.particles = [];
        // A live preview in the Art Lab (?embed=1) is a small frame: fewer lines.
        this.maxParticles = window.ArtEmbed && window.ArtEmbed.on ? 1500 : 4000;
        this.numberOfParticles = this.maxParticles;
        this.cellSize = 20;
        this.rows = 0;
        this.cols = 0;
        this.flowField = [];
        this.curve = 5;
        this.zoom = 0.12;
        this.debug = true;

        this.userText = 'FLOW';
        this.userGradient = [
            'rgb(255,255,0)',
            'rgb(200,5,50)',
            'rgb(150,255,255)',
            'rgb(255,255,150)',
        ];
        this.flowFieldColor = null;

        this.fit();
    }

    // Match the canvas to its on-screen size and rebuild the field.
    fit() {
        const { width, height } = viewSize();
        this.dpr = pixelRatio();
        this.width = width;
        this.height = height;
        this.canvas.width = Math.round(width * this.dpr);
        this.canvas.height = Math.round(height * this.dpr);
        this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        // Cells and line count follow the screen: the original 20px cells and
        // 4000 lines were made for a 1500x720 canvas.
        const short = Math.min(width, height);
        this.cellSize = Math.max(8, Math.min(20, Math.round(short / 32)));
        const area = (width * height) / (1500 * 720);
        this.numberOfParticles = Math.round(Math.max(600, Math.min(this.maxParticles, this.maxParticles * area)));
        this.init();
    }

    // The largest font size at which the text fits the screen with a margin,
    // drawn at its natural proportions (never squeezed to fit).
    fontSize() {
        const base = 100;
        this.context.font = `${base}px Helvetica, Arial, sans-serif`;
        const textWidth = Math.max(1, this.context.measureText(this.userText).width);
        const byWidth = (base * this.width * 0.88) / textWidth;
        const byHeight = this.height * 0.55;
        return Math.max(12, Math.floor(Math.min(byWidth, byHeight, 400)));
    }

    setUserText(text) {
        this.userText = text;
        this.init();
    }

    setUserGradient(colors) {
        this.userGradient = colors;
        this.init();
    }

    setFlowFieldColor(colors) {
        this.flowFieldColor = colors;
        this.init();
    }

    drawText() {
        this.context.save();
        this.context.font = `${this.fontSize()}px Helvetica, Arial, sans-serif`;
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle';

        const gradient = this.context.createLinearGradient(0, 0, this.width, this.height);
        if (this.userGradient.length > 1) {
            this.userGradient.forEach((color, i) => {
                gradient.addColorStop(i / (this.userGradient.length - 1), color);
            });
        } else {
            gradient.addColorStop(0, this.userGradient[0] || '#fff');
            gradient.addColorStop(1, this.userGradient[0] || '#fff');
        }

        this.context.fillStyle = gradient;
        this.context.fillText(this.userText, this.width * 0.5, this.height * 0.5);
        this.context.restore();
    }

    init() {
        this.rows = Math.floor(this.height / this.cellSize);
        this.cols = Math.floor(this.width / this.cellSize);
        this.flowField = [];

        this.context.clearRect(0, 0, this.width, this.height);
        this.drawText();

        // Sample the text in device pixels; the field itself is in CSS pixels.
        const pw = this.canvas.width;
        const ph = this.canvas.height;
        const pixels = this.context.getImageData(0, 0, pw, ph);
        for (let y = 0; y < this.rows * this.cellSize; y += this.cellSize) {
            for (let x = 0; x < this.cols * this.cellSize; x += this.cellSize) {
                const px = Math.min(pw - 1, Math.round(x * this.dpr));
                const py = Math.min(ph - 1, Math.round(y * this.dpr));
                const index = (py * pw + px) * 4;
                const r = pixels.data[index];
                const g = pixels.data[index + 1];
                const b = pixels.data[index + 2];
                const alpha = pixels.data[index + 3];
                const grayscale = (r + g + b) / 3;
                const colorAngle = ((grayscale / 255) * Math.PI * 2).toFixed(2);

                this.flowField.push({
                    x,
                    y,
                    alpha,
                    colorAngle: parseFloat(colorAngle),
                });
            }
        }
        this.particles = [];
        for (let i = 0; i < this.numberOfParticles; i++) {
            const p = new Particle(this);
            this.particles.push(p);
        }
    }

    drawGrid() {
        this.context.save();
        this.context.strokeStyle = 'white';
        this.context.lineWidth = 0.3;
        for (let c = 0; c < this.cols; c++) {
            this.context.beginPath();
            this.context.moveTo(c * this.cellSize, 0);
            this.context.lineTo(c * this.cellSize, this.height);
            this.context.stroke();
        }
        for (let r = 0; r < this.rows; r++) {
            this.context.beginPath();
            this.context.moveTo(0, r * this.cellSize);
            this.context.lineTo(this.width, r * this.cellSize);
            this.context.stroke();
        }
        this.context.restore();
    }

    resize() {
        const { width, height } = viewSize();
        if (width === this.width && height === this.height && pixelRatio() === this.dpr) return;
        this.fit();
    }

    render() {
        if (this.debug) {
            this.drawGrid();
            this.drawText();
        }
        this.particles.forEach((particle) => {
            particle.draw(this.context);
            particle.update();
        });
    }
}

const effect = new Effect(canvas);

// Rotating a phone or resizing the window: rebuild at the new size once it
// settles (a rotation fires several resize events in a row).
let resizeTimer = 0;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => effect.resize(), 150);
});

function animate() {
    ctx.clearRect(0, 0, effect.width, effect.height);
    effect.render();
    requestAnimationFrame(animate);
}
animate();
