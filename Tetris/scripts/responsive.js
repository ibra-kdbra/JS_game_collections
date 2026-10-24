// Touch play: gestures anywhere on the game and the on-screen buttons.
//
// Gestures (on the board and the panels beside it):
//   tap            rotate clockwise (two-finger tap: counter-clockwise)
//   drag sideways  move one cell for every cell dragged, as far as you like
//   drag down      soft drop, one row for every cell dragged
//   flick down     hard drop
//   flick up       hold (tapping the Hold box holds too)
//
// Gestures queue actions that the game applies on its next logic step, so they
// are never lost between frames and replays record them. The on-screen buttons
// press the game's own keys (flags), so DAS/ARR and soft drop speed apply.

'use strict';

const Touch = {
  enabled: false,
  queue: '',
  pointers: new Map(),
  lastMultiTap: 0,

  init() {
    this.enabled = typeof GameKit !== 'undefined' && GameKit.isTouchFirst();
    document.documentElement.classList.toggle('tt-touch', this.enabled);
    this.setupGestures(document.body);
    this.setupPad();
    const hold = document.getElementById('a');
    hold.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !this.playing()) return;
      e.stopPropagation();
      this.push('O');
    });
    document.getElementById('touchPause').addEventListener('click', () => pause());
  },

  playing() {
    return gameState === 0 && !paused && !watchingReplay;
  },

  push(action) {
    this.queue += action;
  },

  /** Cell size in CSS pixels, the distance a drag needs per move. */
  stepPx() {
    return Math.max(cellSize / renderScale, 14);
  },

  setupGestures(target) {
    const down = (e) => {
      if (e.pointerType === 'mouse' || !this.playing()) return;
      if (e.target.closest('button, a, .menu')) return;
      e.preventDefault();
      target.setPointerCapture?.(e.pointerId);
      const now = performance.now();
      this.pointers.set(e.pointerId, {
        x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY, t: now,
        moved: false, axis: '', samples: [[now, e.clientY]],
      });
      // A second finger down turns the gesture into a two-finger tap.
      if (this.pointers.size === 2) this.lastMultiTap = now;
    };

    const move = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p || !this.playing()) return;
      e.preventDefault();
      if (this.pointers.size > 1) return;
      const step = this.stepPx();
      const now = performance.now();
      p.samples.push([now, e.clientY]);
      if (p.samples.length > 8) p.samples.shift();
      const tx = e.clientX - p.ox;
      const ty = e.clientY - p.oy;
      if (!p.axis && Math.hypot(tx, ty) > 10) p.axis = Math.abs(tx) >= Math.abs(ty) ? 'x' : 'y';
      // Sideways: one cell per cell width dragged, in either axis.
      let dx = e.clientX - p.x;
      while (Math.abs(dx) >= step) {
        this.push(dx > 0 ? 'R' : 'L');
        p.x += dx > 0 ? step : -step;
        dx = e.clientX - p.x;
        p.moved = true;
      }
      // Down: soft drop row by row, only once the drag is mostly vertical.
      let dy = e.clientY - p.y;
      if (p.axis === 'y' || Math.abs(ty) > Math.abs(tx) * 1.5) {
        while (dy >= step) {
          this.push('D');
          p.y += step;
          dy = e.clientY - p.y;
          p.moved = true;
        }
      }
      if (dy < 0) p.y = e.clientY;
      if (Math.hypot(tx, ty) > 12) p.moved = true;
    };

    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      if (!this.playing() || e.type === 'pointercancel') return;
      const now = performance.now();
      const tx = e.clientX - p.ox;
      const ty = e.clientY - p.oy;
      // Speed over the last ~100 ms decides flicks, so drag-then-flick works.
      let i = p.samples.length - 1;
      while (i > 0 && now - p.samples[i][0] < 100) i--;
      const dt = Math.max(now - p.samples[i][0], 16);
      const vy = (e.clientY - p.samples[i][1]) / dt;
      const short = now - p.t < 300;
      if (now - this.lastMultiTap < 350) {
        // Two-finger tap: rotate counter-clockwise once, on the last finger up.
        if (this.pointers.size === 0 && Math.hypot(tx, ty) < 24) {
          this.push('W');
          this.lastMultiTap = 0;
        }
        return;
      }
      const quickDown = now - p.t < 250 && ty > Math.max(48, this.stepPx() * 2.5) && ty > Math.abs(tx) * 2;
      if (quickDown || (vy > 0.9 && ty > 30 && Math.abs(ty) > Math.abs(tx))) {
        this.push('H');
      } else if ((vy < -0.7 || short) && ty < -40 && Math.abs(ty) > Math.abs(tx) * 1.5) {
        this.push('O');
      } else if (!p.moved && short && Math.hypot(tx, ty) < 12) {
        this.push('C');
      }
    };

    target.addEventListener('pointerdown', down);
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
    // Long presses must not open the context menu or select text.
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  /** Hold-to-repeat buttons that press the game's key flags directly. */
  setupPad() {
    const buttons = document.querySelectorAll('#pad button');
    for (const b of buttons) {
      const flag = flags[b.dataset.act];
      let id = null;
      const release = () => {
        if (id === null) return;
        id = null;
        b.removeAttribute('data-pressed');
        releaseKey(flag);
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (id !== null || !this.playing()) return;
        id = e.pointerId;
        b.setPointerCapture(e.pointerId);
        b.setAttribute('data-pressed', '');
        keysDown |= flag;
        if (navigator.vibrate) navigator.vibrate(6);
      });
      b.addEventListener('pointerup', release);
      b.addEventListener('pointercancel', release);
      b.addEventListener('lostpointercapture', release);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  },

  /**
   * Applies the queued gestures (or a replay's) to the active piece. Called
   * once per logic step from update().
   */
  apply() {
    let acts;
    if (watchingReplay) {
      acts = replayKeys.t && replayKeys.t[frame];
    } else if (this.queue) {
      acts = this.queue;
      this.queue = '';
      (replayKeys.t || (replayKeys.t = {}))[frame] = acts;
    }
    if (!acts) return;
    for (let i = 0; i < acts.length; i++) {
      const a = acts[i];
      if (a === 'L' || a === 'R') {
        const dir = a === 'L' ? -1 : 1;
        if (piece.moveValid(dir, 0, piece.tetro)) piece.x += dir;
      } else if (a === 'D') {
        if (piece.moveValid(0, 1, piece.tetro)) {
          piece.y = Math.floor(piece.y) + 1;
          addDropScore(1);
        }
      } else if (a === 'C' || a === 'W') {
        piece.rotate(a === 'C' ? 1 : -1);
      } else if (a === 'O') {
        piece.hold();
      } else if (a === 'H') {
        piece.hardDrop();
        return; // The piece locks this step; later moves belong to no piece.
      }
    }
  },

  reset() {
    this.queue = '';
    this.pointers.clear();
  },
};

window.Touch = Touch;
