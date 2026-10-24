/**
 * TouchControls lets the game be played without a mouse or keyboard: a floating
 * stick on the left half of the screen moves, a stick on the right half aims your
 * line of sight, and on-screen buttons pause and use terminals. Menus, intros and
 * the death screen respond to taps. Touch mode turns on with the first touch and
 * off again as soon as a mouse is used.
 */
class TouchControls {
    constructor(game) {
        this.game = game;
        this.active = false;
        this.move = undefined;  // { id, ox, oy, x, y } in view coordinates
        this.look = undefined;

        this.deadZone = 10;     // stick travel (view px) before anything happens
        this.stickRadius = 56;  // drawn size and maximum knob travel
        this.aimDistance = 150; // how far ahead of the player the crosshair sits

        const canvas = game.canvas;
        canvas.addEventListener('pointerdown', e => this.onDown(e));
        canvas.addEventListener('pointermove', e => this.onMove(e));
        canvas.addEventListener('pointerup', e => this.onUp(e));
        canvas.addEventListener('pointercancel', e => this.onUp(e));
        document.addEventListener('pointerdown', e => {
            if (e.pointerType === 'mouse' && this.active) {
                this.active = false;
                this.release();
            }
        }, true);
    }

    // Sizes in view pixels, which shrink with the zoomed-out view on phones:
    // keep the buttons about 46 CSS pixels and the stick ring about 40.
    get buttonSize() {
        return Math.max(48, 46 / this.game.zoom);
    }

    get ringRadius() {
        return Math.max(this.stickRadius, 40 / this.game.zoom);
    }

    toView(e) {
        const b = this.game.canvasBounds;
        return { x: (e.clientX - b.left) / this.game.zoom, y: (e.clientY - b.top) / this.game.zoom };
    }

    // On-screen buttons, in view coordinates
    pauseButton() {
        const s = this.buttonSize;
        return { x: this.game.viewW - s - 12, y: 12, w: s, h: s };
    }

    useButton() {
        const s = this.buttonSize * 1.6;
        return { x: this.game.viewW - s - 24, y: this.game.viewH - s - 24, w: s, h: s };
    }

    inside(p, r) {
        return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    }

    onDown(e) {
        if (e.pointerType === 'mouse') return;
        e.preventDefault();
        this.active = true;
        const game = this.game;
        const p = this.toView(e);

        if (game.menu) {
            game.menu.onMouseMove(p.x, p.y);
            if (game.menu.entryAt(p.x, p.y) >= 0) game.menu.select();
            return;
        }
        if (game.intro) {
            game.intro.toggle();
            return;
        }
        if (!game.level || !game.player) return;
        if (game.player.dead) {
            game._pendingLevelIndex = game.levelIndex;
            return;
        }
        if (this.inside(p, this.pauseButton())) {
            this.release();
            game.pause();
            return;
        }
        if (game._activeTerminal && this.inside(p, this.useButton())) {
            game._activeTerminal.toggle();
            return;
        }

        try {
            e.target.setPointerCapture(e.pointerId);
        } catch (err) {
            // The pointer was already released (very short taps): nothing to capture.
        }
        const stick = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
        if (p.x < game.viewW / 2) {
            if (!this.move) this.move = stick;
        } else if (!this.look) {
            this.look = stick;
        }
    }

    onMove(e) {
        if (e.pointerType === 'mouse') return;
        const p = this.toView(e);
        if (this.move && e.pointerId === this.move.id) {
            this.move.x = p.x;
            this.move.y = p.y;
            this.applyMove();
        } else if (this.look && e.pointerId === this.look.id) {
            this.look.x = p.x;
            this.look.y = p.y;
            this.applyLook();
        }
    }

    onUp(e) {
        if (this.move && e.pointerId === this.move.id) {
            this.move = undefined;
            this.applyMove();
        }
        if (this.look && e.pointerId === this.look.id) this.look = undefined;
    }

    release() {
        this.move = this.look = undefined;
        this.applyMove();
    }

    // Eight-way movement through the same flags the keyboard sets
    applyMove() {
        const input = this.game.input;
        input.up = input.down = input.left = input.right = undefined;
        if (!this.move) return;
        const dx = this.move.x - this.move.ox;
        const dy = this.move.y - this.move.oy;
        const len = Math.hypot(dx, dy);
        if (len < this.deadZone) return;
        // 0.38 ~ sin(22.5 deg): diagonals cover the 45 degree sectors between the axes
        if (dy / len < -0.38) input.up = true;
        if (dy / len > 0.38) input.down = true;
        if (dx / len < -0.38) input.left = true;
        if (dx / len > 0.38) input.right = true;
    }

    // Point the line of sight where the right stick points
    applyLook() {
        const game = this.game;
        const dx = this.look.x - this.look.ox;
        const dy = this.look.y - this.look.oy;
        const len = Math.hypot(dx, dy);
        if (len < this.deadZone || !game.player) return;
        game.crosshair.x = game.player.x + dx / len * this.aimDistance;
        game.crosshair.y = game.player.y + dy / len * this.aimDistance;
    }

    render() {
        const game = this.game;
        if (!this.active || !game.level || game.intro || !game.player || game.player.dead) return;
        const ctx = game.ctx;
        ctx.save();

        [this.move, this.look].forEach(stick => {
            if (!stick) return;
            const dx = stick.x - stick.ox, dy = stick.y - stick.oy;
            const len = Math.hypot(dx, dy) || 1;
            const ring = this.ringRadius;
            const reach = Math.min(len, ring);
            ctx.strokeStyle = 'rgba(204, 204, 204, 0.35)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(stick.ox, stick.oy, ring, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fillStyle = 'rgba(204, 204, 204, 0.3)';
            ctx.beginPath();
            ctx.arc(stick.ox + dx / len * reach, stick.oy + dy / len * reach, ring * 0.4, 0, 2 * Math.PI);
            ctx.fill();
        });

        // Pause button: two bars
        const pb = this.pauseButton();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(pb.x, pb.y, pb.w, pb.h);
        ctx.strokeStyle = 'rgba(204, 204, 204, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
        ctx.fillStyle = 'rgba(204, 204, 204, 0.8)';
        ctx.fillRect(pb.x + pb.w * 0.33, pb.y + pb.h * 0.28, pb.w * 0.11, pb.h * 0.44);
        ctx.fillRect(pb.x + pb.w * 0.56, pb.y + pb.h * 0.28, pb.w * 0.11, pb.h * 0.44);

        // Use button, only next to a terminal
        if (game._activeTerminal) {
            const ub = this.useButton();
            ctx.fillStyle = 'rgba(36, 204, 36, 0.25)';
            ctx.beginPath();
            ctx.arc(ub.x + ub.w / 2, ub.y + ub.h / 2, ub.w / 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = 'rgba(204, 255, 204, 0.8)';
            ctx.stroke();
            ctx.font = Asset.getFontString(16 * game.textScale);
            ctx.fillStyle = 'rgba(204, 255, 204, 0.9)';
            const w = ctx.measureText('USE').width;
            ctx.fillText('USE', ub.x + ub.w / 2 - w / 2, ub.y + ub.h / 2 + 5);
        }

        ctx.restore();
    }
}
