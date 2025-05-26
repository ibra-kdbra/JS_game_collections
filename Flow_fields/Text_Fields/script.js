/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');

// Hard-coded dimensions
canvas.width = 1500;
canvas.height = 720;

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
const color1Input = document.getElementById('gradientColor1');
const color2Input = document.getElementById('gradientColor2');
const color3Input = document.getElementById('gradientColor3');
const flowColorInput = document.getElementById('flowColor');
const applyBtn = document.getElementById('applyBtn');

applyBtn.addEventListener('click', () => {
    const newText = textInput.value.trim();
    if (newText) {
        effect.setUserText(newText);
    }

    const gradientColors = [
        color1Input.value.trim(),
        color2Input.value.trim(),
        color3Input.value.trim()
    ].filter(c => c);

    if (gradientColors.length > 0) {
        effect.setUserGradient(gradientColors);
    }

    const flowColor = flowColorInput.value.trim();
    if (flowColor) {
        effect.setFlowFieldColor(flowColor);
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
        if (this.effect.flowFieldColor) {
            this.color = this.effect.flowFieldColor;
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

        while (attempts < 10 && !resetSuccess) {
            attempts++;
            let testIndex = Math.floor(Math.random() * this.effect.flowField.length);
            if (this.effect.flowField[testIndex].alpha > 0) {
                this.x = Math.floor(Math.random() * this.effect.width);
                this.y = Math.floor(Math.random() * this.effect.height);
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
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        this.particles = [];
        this.numberOfParticles = 4000;
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

        this.init();
    }

    setUserText(text) {
        this.userText = text;
        this.init();
    }

    setUserGradient(colors) {
        this.userGradient = colors;
        this.init();
    }

    setFlowFieldColor(color) {
        this.flowFieldColor = color;
        this.init();
    }

    drawText() {
        this.context.save();
        this.context.font = '400px Helvetica';
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
        this.context.fillText(this.userText, this.width * 0.5, this.height * 0.5, this.width);
        this.context.restore();
    }

    init() {
        this.rows = Math.floor(this.height / this.cellSize);
        this.cols = Math.floor(this.width / this.cellSize);
        this.flowField = [];

        this.context.clearRect(0, 0, this.width, this.height);
        this.drawText();

        const pixels = this.context.getImageData(0, 0, this.width, this.height);
        for (let y = 0; y < this.height; y += this.cellSize) {
            for (let x = 0; x < this.width; x += this.cellSize) {
                const index = (y * this.width + x) * 4;
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

    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.init();
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

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    effect.render();
    requestAnimationFrame(animate);
}
animate();
