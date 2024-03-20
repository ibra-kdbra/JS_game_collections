/** @type{HTMLCanvasElement} **/  
const canvas = document.getElementById('canvas1');
const ctx =  canvas.getContext('2d')
canvas.width = 500;
canvas.height = 700;
const explosions = [];
let canvasPositions = canvas.getBoundingClientRect();

class Explosion {
    /**
     * The constructor function for the Explosion class
     * @param {number} x - The x coordinate of the explosion
     * @param {number} y - The y coordinate of the explosion
     */
    constructor(x,y){
        /**
         * The width of the sprite
         * @type {number}
         */
        this.spriteWidth = 200;
        /**
         * The height of the sprite
         * @type {number}
         */
        this.spirteHeight = 179;
        /**
         * The width of the explosion
         * @type {number}
         */
        this.width = this.spriteWidth * 0.7;
        /**
         * The height of the explosion
         * @type {number}
         */
        this.height = this.spirteHeight * 0.7;
        /**
         * The x coordinate of the explosion
         * @type {number}
         */
        this.x = x ;
        /**
         * The y coordinate of the explosion
         * @type {number}
         */
        this.y = y ;
        /**
         * The image of the explosion
         * @type {Image}
         */
        this.image = new Image();
        /**
         * The source of the image of the explosion
         * @type {string}
         */
        this.image.src = './images/boom.png';
        /**
         * The current frame of the explosion
         * @type {number}
         */
        this.frame = 0;
        /**
         * The timer used to track the animation
         * @type {number}
         */
        this.timer = 0;
        /**
         * The angle of rotation of the explosion
         * @type {number}
         */
        this.angle = Math.random() * 6.2;
        /**
         * The sound of the explosion
         * @type {Audio}
         */
        this.sound = new Audio();
        /**
         * The source of the sound of the explosion
         * @type {string}
         */
        this.sound.src = './audio/boom.wav';
    }
    /**
     * The function to update the explosion
     * @return {void}
     */
    update(){
        /**
         * If the frame is currently 0, play the sound
         */
        if(this.frame === 0) this.sound.play();
        /**
         * Increment the timer
         */
        this.timer++;
        /**
         * If the timer is divisible by 10, increment the frame
         */
        if(this.timer % 10 === 0){
            this.frame++;
        };
    }
    /**
     * The function to draw the explosion
     * @return {void}
     */
    draw(){
        /**
         * Save the current state of the canvas
         */
        ctx.save();
        /**
         * Translate the origin to the explosion's position
         */
        ctx.translate(this.x, this.y);
        /**
         * Rotate the canvas by the explosion's angle
         */
        ctx.rotate(this.angle);
        /**
         * Draw the image of the explosion
         */
        ctx.drawImage(this.image, this.spriteWidth * this.frame , 0, this.spriteWidth, this.spirteHeight, 0 - this.width/2, 0 - this.height/2, this.width, this.height);
        /**
         * Restore the canvas to its previous state
         */
        ctx.restore();
}
}

window.addEventListener('click', function(e){
    createAnimation(e);
})

function createAnimation(e){
    let positionX = e.x - canvasPositions.left;
    let positionY = e.y - canvasPositions.top;
    explosions.push(new Explosion(positionX, positionY));
}

function animate(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for(let i =0 ; i< explosions.length; i++){
        explosions[i].update();
        explosions[i].draw();
        if(explosions[i].frame > 5){
            explosions.splice(i, 1);
            i--;
        }
    }
    requestAnimationFrame(animate);
}
animate();