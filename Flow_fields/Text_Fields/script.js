/** @type{HTMLCanvasElement} **/

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
canvas.width = 1500;
canvas.height = 500;

console.log(ctx)

ctx.fillStyle = 'white';
ctx.strokeStyle = 'white';
ctx.lineWidth = 1;

class Particle {
    constructor(effect) {
        this.effect = effect;
        this.x = Math.floor(Math.random() * this.effect.width);
        this.y = Math.floor(Math.random() * this.effect.height);
        this.speedX;
        this.speedY;
        this.speedModifier = Math.floor(Math.random() * 2 + 1);
        this.history = [{
            x: this.x,
            y: this.y
        }];
        this.maxLength = Math.floor(Math.random() * 60 + 20);
        this.angle = 0;
        this.newAngle = 0;
        this.angleCorrector = Math.random() * 0.5 +0.01;
        this.timer = this.maxLength * 2;
        this.colors = ['#4C026B', '#8E0E00', '#9D0208', '#BA1A1A', '#730D9E'];
        this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    }
    draw(context){
        // context.fillRect(this.x, this.y, 10, 10);
        context.beginPath();
        context.moveTo(this.history[0].x, this.history[0].y);
        for(let i = 1; i < this.history.length; i++){
            context.lineTo(this.history[i].x, this.history[i].y);
        }
        context.strokeStyle = this.color;
        context.stroke();
    }
    update(){
        this.timer--;
        if(this.timer >= 1){
            let x = Math.floor(this.x / this.effect.cellSize);
            let y = Math.floor(this.y / this.effect.cellSize);
            let index = y * this.effect.cols + x;
            if(this.effect.flowField[index]){
                this.newAngle = this.effect.flowField[index].colorAngle;

                if(this.angle > this.newAngle){
                    this.angle -= this.angleCorrector;
                }else if(this.angle < this.newAngle){
                    this.angle += this.angleCorrector;
                }else{
                    this.angle = this.newAngle;
                }
            }
            
            this.speedX = Math.cos(this.angle);
            this.speedY = Math.sin(this.angle);
            this.x += this.speedX * this.speedModifier;
            this.y += this.speedY * this.speedModifier;
            
            this.history.push({x: this.x, y: this.y});
            if(this.history.length > this.maxLength){
                this.history.shift();
            }
        }else if(this.history.length > 1){
            this.history.shift();
        }else{
            this.reset();
        }
    }
    reset(){
        let attempts = 0;
        let resetSuccess = false;
        
        while(attempts < 10 && !resetSuccess){
            attempts++;
            let testIndex = Math.floor(Math.random() * this.effect.flowField.length);
            if(this.effect.flowField[testIndex].alpha > 0){
                this.x = Math.floor(Math.random() * this.effect.width);
                this.y = Math.floor(Math.random() * this.effect.height);
                this.history = [{
                    x: this.x,
                    y: this.y
                }]
                this.timer = this.maxLength * 2;
                resetSuccess = true;
            }
        }
        if(!resetSuccess){
            this.x = Math.random() * this.effect.width;
            this.y = Math.random() * this.effect.height;
            this.history = [{
                x: this.x,
                y: this.y
            }]
            this.timer = this.maxLength * 2;
        }
    }
}


class Effect {
    constructor(canvas) {
        this.canvas = canvas;
        this.context= ctx;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.particles = [];
        this.numberOfParticles = 4000;
        this.cellSize = 20;
        this.rows;
        this.cols;
        this.flowField = [];
        this.curve = 5;
        this.zoom = 0.12;
        this.debug = true;
        this.init();

        window.addEventListener('keydown', e =>{
            if(e.key === 'd') this.debug = !this.debug;
        });

        window.addEventListener('resize', e =>{
            // this.resize(e.target.innerHeight, e.target.innerHeight);
        })
    }
    drawText(context){
        this.context.font = '400px Helvetica';
        this.context.textAlign = 'center';
        this.context.textBaseline = 'middle'

        const gradient1 = this.context.createLinearGradient(0, 0, this.width, this.height);
        gradient1.addColorStop(0.2, 'rgb(255,0,0)');
        gradient1.addColorStop(0.4, 'rgb(0,255,0)');
        gradient1.addColorStop(0.6, 'rgb(150,100,100)');
        gradient1.addColorStop(0.8, 'rgb(0,255,255)');

        const gradient2 = this.context.createLinearGradient(0, 0, this.width, this.height);
        gradient2.addColorStop(0.2, 'rgb(255,255,0)');
        gradient2.addColorStop(0.4, 'rgb(200,5,50)');
        gradient2.addColorStop(0.6, 'rgb(150,255,255)');
        gradient2.addColorStop(0.8, 'rgb(255,255,150)');


        const gradient3 = this.context.createRadialGradient(this.width * 0.5, this.height * 0.5, 10, this.width * 0.5,
             this.height * 0.5, this.width);
        gradient3.addColorStop(0.2, 'rgb(0,0,255)');
        gradient3.addColorStop(0.4, 'rgb(200,255,0)');
        gradient3.addColorStop(0.6, 'rgb(0,0,255)');
        gradient3.addColorStop(0.8, 'rgb(0,0,0)');

        this.context.fillStyle =gradient2;
        this.context.fillText('FLOW', this.width *0.5, this.height * 0.5, this.width);


    }
    init(){
        //create flow fields
        this.rows = Math.floor(this.height / this.cellSize);
        this.cols = Math.floor(this.width / this.cellSize);
        this.flowField = [];

        // draw text
        this.drawText();

        //scan pixel data
        const pixels = this.context.getImageData(0, 0, this.width, this.height);
        console.log(pixels)

        for(let y = 0; y < this.height; y+= this.cellSize){
            for(let x = 0; x < this.width; x+= this.cellSize){
                const index = (y * this.width + x) * 4;
                const r = pixels.data[index];
                const g = pixels.data[index + 1];
                const b = pixels.data[index + 2];
                const alpha = pixels.data[index + 3];
                const grayscale = (r + g + b) / 3;
                const colorAngle = ((grayscale/255) * 6.28).toFixed(2);
                /*
                Convert scale 0 - 255(color) to
                angle value 0 - 6.28 (radians)
                */
                this.flowField.push({
                    x: x,
                    y: y,
                    alpha: alpha,
                    colorAngle: colorAngle
                });
            }
        }

        // for(let y = 0; y < this.rows; y++){
        //     for(let x = 0; x < this.cols; x++){
        //         let angle = (Math.cos(x * this.zoom) + Math.sin(y * this.zoom)) * this.curve;
        //         this.flowField.push(angle);
        //     }
        //     console.log(this.flowField);
        // }
        //create particles
        this.particles = [];
        for(let i = 0; i < this.numberOfParticles; i++){
            this.particles.push(new Particle(this));
        }
        this.particles.push(new Particle(this));
    }
    drawGrid(){
        this.context.save();
        this.context.strokeStyle = 'white';
        this.context.lineWidth = 0.3;
        for(let c = 0; c < this.cols; c++){
             this.context.beginPath();
             this.context.moveTo(c * this.cellSize, 0);
             this.context.lineTo(c * this.cellSize, this.height);
             this.context.stroke();
        }
        for(let r = 0; r < this.rows; r++){
            this.context.beginPath();
             this.context.moveTo(0, r * this.cellSize);
             this.context.lineTo(this.width ,r * this.cellSize);
             this.context.stroke();
        }
        this.context.restore();
    }
    resize(width, height){
        this.canvas = canvas;
        this.canvas.height = height;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
    }
    render(){
        if(this.debug) 
        {
        this.drawGrid();
        this.drawText();
        }
        this.particles.forEach(particle => {
            particle.draw(this.context);
            particle.update();
        })
    }
}

const effect = new Effect(canvas,ctx);

function animate(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    effect.render();
    requestAnimationFrame(animate);
}
animate();