export class InputHandler {
    constructor() {
      this.keys = [];
      this.touchY = '';
      this.touchThreshold = 30;
      window.addEventListener("keydown", (e) => {
        if (
          (e.key === "ArrowDown" ||
            e.key === "ArrowUp" ||
            e.key === "ArrowLeft" ||
            e.key === "ArrowRight" ||
            e.key === "Enter") &&
          this.keys.indexOf(e.key) === -1
        ) {
          this.keys.push(e.key);
        }else if(e.key === "Enter" && gameOver) restartGame();
        console.log(e.key, this.keys);

      });
      window.addEventListener("keyup", (e) => {
        if (
          e.key === "ArrowDown" ||
          e.key === "ArrowUp" ||
          e.key === "ArrowLeft" ||
          e.key === "ArrowRight" ||
          e.key === "Enter"
        ) {
          this.keys.splice(this.keys.indexOf(e.key), 1);
        }
        console.log(e.key, this.keys);
      });
      window.addEventListener('touchstart', e=>{
        this.touchY = e.changedTouches[0].pageY;
      });
      window.addEventListener('touchmove', e=>{
        const swipeDistance = e.changedTouches[0].pageY - this.touchY;
        if(swipeDistance < -this.touchThreshold &&
          this.keys.indexOf('swipe up') === -1) this.keys.push('swipe up');
        else if(swipeDistance > this.touchThreshold &&
          this.keys.indexOf('swipe down') === -1){
            this.keys.push('swipe down');
            if(gameOver) restartGame();
          } 
      });
      window.addEventListener('touchend', e=>{
        this.keys.splice(this.keys.indexOf('swipe up'), 1);
        this.keys.splice(this.keys.indexOf('swipe down'), 1);

      });


    }
  }