export class UI{
    constructor(game){
        this.game = game;
        this.fontSize = 30;
        this.fontFamily = 'Creepster';
        this.livesImage = document.getElementById('heart');
    }
    draw(context){
        context.save();
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        context.shadowColor = 'white';
        context.shadowBlur = 0;
        context.font = this.fontSize + 'px ' + this.fontFamily;
        context.textAlign = 'left';
        context.fillStyle =  this.game.fontColor;
        const classic = this.game.mode === 'classic';
        //score
        context.fillText('Score: ' + this.game.score + (classic ? ' / ' + this.game.winningScore : ''), 20, 50);
        //timer
        context.font = this.fontSize * 0.8 + 'px ' + this.fontFamily;
        const seconds = classic ? (this.game.maxTime - this.game.time) * 0.001 : this.game.time * 0.001;
        context.fillText((classic ? 'Time left: ' : 'Time: ') + Math.max(0, seconds).toFixed(1), 20, 80);
        //lives
        for(let i = 0; i< this.game.lives; i++) context.drawImage(this.livesImage, 25 * i + 20
            , 95, 25, 25);
        context.restore();
    }
}