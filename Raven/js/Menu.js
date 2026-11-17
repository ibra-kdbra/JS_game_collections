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

    // Long lists (Select Level) that can't fit one finger-sized column on a short
    // landscape view are laid out in two columns.
    columns() {
        const n = this._options.length;
        return n > 6 && n * 36 * game.textScale > game.viewH - 60 && game.viewW > game.viewH ? 2 : 1;
    }

    rows() {
        return Math.ceil(this._options.length / this.columns());
    }

    // Row pitch in view pixels: 36 normally, more on zoomed-out phone views so each
    // entry is close to a 44px finger target, as long as the list still fits.
    entryHeight() {
        const k = game.textScale;
        const finger = 44 / game.zoom;
        return Math.max(36 * k, Math.min(finger, (game.viewH - 80) / this.rows()));
    }

    render() {
        let entryHeight = this.entryHeight();
        const cols = this.columns();
        const rows = this.rows();

        game.ctx.fillStyle = 'rgba(0,0,0,0.7)';
        game.ctx.fillRect(0, 0, game.viewW, game.viewH);

        // The list is centred on the view; each entry's baseline sits low in its row
        let menuTop = game.viewH / 2 - rows * entryHeight / 2 + entryHeight * 0.72;

        game.ctx.save();
        game.ctx.translate(game.viewW / 2, game.viewH / 2);
        game.ctx.scale(1 + this.scale, 1 + this.scale);
        game.ctx.translate(-game.viewW / 2, -game.viewH / 2);

        this._options.forEach((entry, idx) => {
            game.ctx.font = Asset.getFontString(18 * game.textScale);

            entry.w = game.ctx.measureText(entry.text).width;
            const col = Math.floor(idx / rows);
            entry.x = game.viewW * (2 * col + 1) / (2 * cols) - entry.w / 2;
            entry.y = menuTop + (idx % rows) * entryHeight;

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
        const h = this.entryHeight();
        return this._options.findIndex(entry =>
            x >= entry.x - 16 && x <= entry.x + entry.w + 16 &&
            y >= entry.y - h * 0.72 && y <= entry.y + h * 0.28);
    }

    select() {
        this._options[this._selected].handler();
        game.audio.playBloop();
    }
}
