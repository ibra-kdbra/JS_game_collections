/**
 * Input handles game input (keyboard presses and mouse movement), allowing the routing
 * of these events to the appropriate place via event handlers.
 */
class Input {
    constructor(handlers) {
        // Map keys to in-game inputs
        this.map = [];
        this.map[87] = 'up';       // W
        this.map[83] = 'down';     // S
        this.map[65] = 'left';     // A
        this.map[68] = 'right';    // D
        this.map[38] = 'up';       // UpArrow
        this.map[40] = 'down';     // DownArrow
        this.map[37] = 'left';     // LeftArrow
        this.map[39] = 'right';    // RightArrow
        this.map[32] = 'toggle';   // Space
        this.map[13] = 'toggle';   // Enter
        this.map[27] = 'escape';   // Escape

        // Key press handlers
        this.handlers = handlers;
    }

    init() {
        document.addEventListener('keydown', event => {
            let k = this.map[event.keyCode];

            if (k) {
                // Some keys are "stateful" (we evaluate each frame whether they are still
                // held down), other keys are more like events (we want to do something
                // specific one time on key press). Provide an API for both.
                //
                // Note: this is not only useful, it's also required in some cases -- for
                // example, the requestPointerLock() API call is ignored unless it is
                // triggered by a user input event.
                this[k] = true;

                if (this.handlers[k] && typeof this.handlers[k] === 'function') {
                    this.handlers[k]();
                } else if (this.handlers[k] && typeof this.handlers[k].down === 'function') {
                    this.handlers[k].down();
                }
            }
        });

        document.addEventListener('keyup', event => {
            let k = this.map[event.keyCode];

            if (k) {
                this[k] = undefined;

                if (this.handlers[k] && typeof this.handlers[k].up === 'function') {
                    this.handlers[k].up();
                }
            }
        });

        document.addEventListener('mousemove', event => {
            this.handlers['mousemove'](event.movementX, event.movementY, event.clientX, event.clientY);
        });

        // A click acts like pressing Space (menus, restarting after death)
        document.addEventListener('click', event => {
            if (event.target.closest('a, button')) return;
            this.handlers['mouseclick']();
        });

        return this;
    }
}
