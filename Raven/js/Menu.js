/**
 * Menu represents a generic "menu" interface, customized by providing a number of text
 * options and handlers that contorl the behavior when clicked. Menus can be standalone
 * (like the start menu) or overlay an active level.
 */
class Menu {
    constructor(options, escapeHandler) {
        this._options = options.slice(0);
        this._escapeHandler = escapeHandler;
        this._selected = 0;
    }

    open() {
        this.scale = 5;
    }

    update() {
        if (this.scale > 0) this.scale -= 1;
    }

    render() {
        let entryHeight = 36;

        game.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        game.ctx.fillRect(0, 0, game.viewW, game.viewH);

        let menuTop = game.viewH / 2 - this._options.length * (entryHeight * 0.75);

        game.ctx.save();
        game.ctx.translate(game.viewW / 2, game.viewH / 2);
        game.ctx.scale(1 + this.scale, 1 + this.scale);
        game.ctx.translate(-game.viewW / 2, -game.viewH / 2);

        this._options.forEach((entry, idx) => {
            game.ctx.font = Asset.getFontString(18);

            entry.w = game.ctx.measureText(entry.text).width;
            entry.x = game.viewW / 2 - entry.w / 2;
            entry.y = menuTop + idx * entryHeight;

            if (idx === this._selected && this.scale === 0) {
                game.ctx.fillStyle = 'rgba(255,255,255,1)';
            } else {
                game.ctx.fillStyle = 'rgba(204,204,204,1)';
            }
            game.ctx.fillText(entry.text, entry.x, entry.y);
        });

        game.ctx.restore();
    }

    onUp() {
        this._selected = (this._selected - 1 + this._options.length) % this._options.length;
        game.audio.playClick();
    }

    onDown() {
        this._selected = (this._selected + 1) % this._options.length;
        game.audio.playClick();
    }

    onEscape() {
        this._escapeHandler();
    }

    onMouseMove(x, y) {
        let oldSelected = this._selected;
        let idx = this.entryAt(x, y);
        if (idx >= 0) this._selected = idx;

        if (oldSelected !== this._selected) {
            game.audio.playClick();
        }
    }

    // Index of the entry under a point (generous enough for a fingertip), or -1
    entryAt(x, y) {
        return this._options.findIndex(entry =>
            x >= entry.x - 16 && x <= entry.x + entry.w + 16 &&
            y >= entry.y - 26 && y <= entry.y + 10);
    }

    select() {
        this._options[this._selected].handler();
        game.audio.playBloop();
    }
}
