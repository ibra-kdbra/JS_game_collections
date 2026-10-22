import { Player } from "./player.js";
import { InputHandler } from "./input.js";
import { Background } from "./background.js";
import { ClimbingEnemy, FlyingEnemy, GroundEnemy } from "./enemies.js";
import { UI } from "./UI.js";
import { createLoop } from "../../assets/kit/loop.js";
import { createStore, readBests, recordBest } from "../../assets/kit/storage.js";
import { createTouchControls } from "../../assets/kit/input.js";
import { initShell } from "../../assets/kit/shell.js";

const SLUG = 'shadow-dog';

// Tuning levers for both modes.
const MODES = {
    classic: { label: 'Classic', maxTime: 30000, winningScore: 40, lives: 5 },
    endless: { label: 'Endless', maxTime: Infinity, winningScore: Infinity, lives: 5 },
};
const ENDLESS_MIN_INTERVAL = 400;   // ms between spawns at full difficulty
const ENDLESS_RAMP_TIME = 120000;   // ms until full difficulty

initShell({ slug: SLUG });
const touch = createTouchControls({
    dpad: { up: 'ArrowUp', left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown' },
    buttons: [{ label: 'Roll', key: 'Enter' }, { label: 'Pause', key: 'p', small: true }],
});
const hasTouch = !touch.el.hidden;

window.addEventListener('load', function(){
    const canvas = document.getElementById('canvas1')
    const ctx = canvas.getContext('2d');
    canvas.width = 900;
    canvas.height = 500;
    const store = createStore(SLUG);
    const menu = document.getElementById('menu');
    const pauseScreen = document.getElementById('pause');
    const endScreen = document.getElementById('gameover');
    const input = new InputHandler();

    class Game{
        constructor(width, height, mode){
            this.width = width;
            this.height = height;
            this.mode = mode;
            this.groundMargin = 40;
            this.speed = 0;
            this.maxSpeed = 4;
            this.background = new Background(this);
            this.player = new Player(this);
            this.input = input;
            this.UI = new UI(this);
            this.enemies = [];
            this.particles = [];
            this.collisions = [];
            this.floatingMessages = [];
            this.maxParticles = 50;
            this.enemyTimer = 0;
            this.enemyInterval = 1000;
            this.score = 0;
            this.winningScore = MODES[mode].winningScore;
            this.fontColor = 'black';
            this.time = 0;
            this.maxTime = MODES[mode].maxTime;
            this.gameOver = false;
            this.lives = MODES[mode].lives;
            this.player.currentState = this.player.states[0];
            this.player.currentState.enter();
        }
        get won(){
            return this.score >= this.winningScore;
        }
        draw(context){
            this.background.draw(context);
            this.player.draw(context);
            this.enemies.forEach(enemy =>{
                enemy.draw(context);
            });
            this.particles.forEach(particle =>{
                particle.draw(context);
            });
            this.collisions.forEach(collision =>{
                collision.draw(context);
            })
            this.floatingMessages.forEach(message =>{
                message.draw(context);
            })
            this.UI.draw(context);
        }
        update(deltaTime){
            this.time += deltaTime;
            if(this.time > this.maxTime) this.gameOver = true;
            if(this.mode === 'endless'){
                const ramp = Math.min(1, this.time / ENDLESS_RAMP_TIME);
                this.enemyInterval = 1000 - (1000 - ENDLESS_MIN_INTERVAL) * ramp;
            }
            this.background.update();
            this.player.update(this.input.keys, deltaTime);
            //handle Enemies
            if(this.enemyTimer > this.enemyInterval){
                this.addEnemy();
                this.enemyTimer = 0;
            }else{
                this.enemyTimer += deltaTime;
            }
            this.enemies.forEach(enemy =>{
                enemy.update(deltaTime);
            });
            //handle messages
            this.floatingMessages.forEach(message =>{
                message.update();
            })
            //handle particles
            this.particles.forEach(particle =>{
                particle.update();
            });
            if(this.particles.length > this.maxParticles){
                this.particles.length = this.maxParticles;
            }
            //handle collision sprites
            this.collisions.forEach(collision =>{
                collision.update(deltaTime);
            })
            this.enemies = this.enemies.filter(enemy => !enemy.markedForDeletion);
            this.particles = this.particles.filter(particle => !particle.markedForDeletion);
            this.collisions = this.collisions.filter(collision => !collision.markedForDeletion);
            this.floatingMessages = this.floatingMessages.filter(message => !message.markedForDeletion);
        }
        addEnemy(){
            if(this.speed > 0 && Math.random() < 0.5) this.enemies.push(new GroundEnemy(this));
            if (this.speed > 0) this.enemies.push(new ClimbingEnemy(this));
            this.enemies.push(new FlyingEnemy(this));
        }
    }

    let game = null;
    let state = 'menu'; // menu | playing | paused | over

    const show = (screen) => {
        [menu, pauseScreen, endScreen].forEach(el => el.hidden = el !== screen);
        // The on-screen pad would cover menu buttons; it is only needed while running.
        if(hasTouch){
            if(screen) touch.hide();
            else touch.show();
        }
        const focusTarget = screen?.querySelector('button');
        if (focusTarget) focusTarget.focus({ preventScroll: true });
    };
    const renderBests = () => {
        const bests = readBests(SLUG);
        document.querySelectorAll('[data-best]').forEach(el => {
            el.textContent = bests[el.dataset.best]?.value ?? '-';
        });
    };

    const loop = createLoop({
        autoPause: false,
        update(dt){
            if(state !== 'playing') return;
            game.update(dt * 1000);
            if(game.gameOver) finish();
        },
        render(){
            if(!game) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            game.draw(ctx);
        },
    });

    function start(mode){
        store.set('lastMode', mode);
        input.reset();
        game = new Game(canvas.width, canvas.height, mode);
        state = 'playing';
        show(null);
        canvas.focus({ preventScroll: true });
        loop.resume();
    }
    function finish(){
        state = 'over';
        const { isNew } = recordBest(SLUG, game.score, { mode: game.mode, label: `${game.score} pts (${MODES[game.mode].label})` });
        document.getElementById('result-title').textContent =
            game.mode === 'classic' ? (game.won ? 'Lets Go!' : 'Love at first bite?') : 'The night got you';
        document.getElementById('result-text').textContent =
            game.mode === 'classic'
                ? (game.won ? 'What are the creatures of the night afraid of? YOU!' : `Nope, ${game.winningScore} points needed. Better luck next time.`)
                : `You lasted ${(game.time / 1000).toFixed(1)} seconds.`;
        document.getElementById('result-score').textContent = game.score;
        document.getElementById('result-best').hidden = !isNew;
        renderBests();
        show(endScreen);
    }
    function pause(){
        if(state !== 'playing') return;
        state = 'paused';
        input.reset();
        loop.pause();
        show(pauseScreen);
    }
    function resume(){
        if(state !== 'paused') return;
        state = 'playing';
        show(null);
        canvas.focus({ preventScroll: true });
        loop.resume();
    }
    function toMenu(){
        state = 'menu';
        renderBests();
        show(menu);
    }

    document.querySelectorAll('[data-start]').forEach(button =>
        button.addEventListener('click', () => start(button.dataset.start)));
    document.getElementById('resume').addEventListener('click', resume);
    document.getElementById('again').addEventListener('click', () => start(game.mode));
    document.querySelectorAll('[data-menu]').forEach(button => button.addEventListener('click', toMenu));

    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();
        if(key === 'p' || key === 'escape'){
            if(state === 'playing') pause();
            else if(state === 'paused') resume();
        }else if(key === 'r' && (state === 'over' || state === 'paused')){
            start(game.mode);
        }
    });
    document.addEventListener('visibilitychange', () => {
        if(document.hidden) pause();
    });
    window.addEventListener('blur', pause);

    // The scene keeps drawing behind the menu so the page never looks empty.
    game = new Game(canvas.width, canvas.height, store.get('lastMode', 'classic'));
    renderBests();
    toMenu();
    loop.start();
})
