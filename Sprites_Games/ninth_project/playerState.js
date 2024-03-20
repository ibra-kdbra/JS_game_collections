import { Player } from "./player.js";
const states ={
    SITTING: 0,
    RUNNING: 1,
    JUMPING:2,
    FALLING:3,
}

class State{
    constructor(state){
        this.state = state;
    }
}

export class Sitting extends State{
    constructor(player){
        super('SITTING');
        this.player = player;
    }
    enter(){
        this.player.frameX = 0;
        this.player.frameY = 5;
        this.player.maxFrame = 4;
    }
    handeInput(input){
        if(input.includes('ArrowLeft') || input.includes('ArrowRight')){
            this.player.setState(states.RUNNING, 1);
        }
    }
}

export class Running extends State{
    constructor(player){
        super('RUNNING');
        this.player = player;
    }
    enter(){
        this.player.frameX = 0;
        this.player.maxFrame = 8;
        this.player.frameY = 3;

    }
    handeInput(input){
        if(input.includes('ArrowDown')){
            this.player.setState(states.SITTING, 0);
        }else if(input.includes('ArrowUp')){
            this.player.setState(states.JUMPING, 1);
        }
    }
}

export class Jumping extends State{
    constructor(player){
        super('JUMPING');
        this.player = player;
    }
    enter(){
        if(this.player.onGround()) this.player.vy -= 27;
        this.player.frameX = 0;
        this.player.maxFrame = 6;
        this.player.frameY = 1;
    }
    handeInput(input){
        if(this.player.vy > this.player.weight ){
            this.player.setState(states.FALLING, 1);
        }
    }
}

export class Falling extends State{
    constructor(player){
        super('FALLING');
        this.player = player;
    }
    enter(){
        this.player.frameX = 0;
        this.player.maxFrame = 6;
        this.player.frameY = 2;
    }
    handeInput(input){
        if(this.player.onGround()){
            this.player.setState(states.RUNNING, 1);
        }
    }
}