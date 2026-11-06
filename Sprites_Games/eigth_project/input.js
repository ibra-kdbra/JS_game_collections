const NAMES = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowUp: 'up',
};

export default class InputHandler{
    constructor(){
        this.lastKey = '';
        window.addEventListener('keydown',(e)=>{
            if(NAMES[e.key]) this.lastKey = 'PRESS ' + NAMES[e.key];
        });
        window.addEventListener('keyup',(e)=>{
            if(NAMES[e.key]) this.lastKey = 'Release ' + NAMES[e.key];
        });
        // The on-screen pad sends the same presses and releases (touch, pen or mouse).
        document.querySelectorAll('.pad [data-key]').forEach((button)=>{
            const name = NAMES[button.dataset.key];
            const release = (e)=>{
                if(!button.classList.contains('is-down')) return;
                button.classList.remove('is-down');
                this.lastKey = 'Release ' + name;
                if(e && e.pointerId !== undefined && button.hasPointerCapture(e.pointerId)){
                    button.releasePointerCapture(e.pointerId);
                }
            };
            button.addEventListener('pointerdown',(e)=>{
                e.preventDefault();
                button.setPointerCapture(e.pointerId);
                button.classList.add('is-down');
                this.lastKey = 'PRESS ' + name;
            });
            button.addEventListener('pointerup', release);
            button.addEventListener('pointercancel', release);
            button.addEventListener('lostpointercapture', release);
            button.addEventListener('contextmenu',(e)=> e.preventDefault());
        });
    }
}
