// Touch gestures on the playfield, alongside the on-screen buttons:
// drag sideways to move, drag down to soft drop, flick up to hard drop,
// tap to rotate and double tap to hold.

'use strict';

const Responsive = {
  lastTapTime: 0,
  touchStartX: 0,
  touchStartY: 0,
  touchStartTime: 0,
  isDragging: false,
  softDropThreshold: 30,
  flickThreshold: 60,

  // Track accumulated movement for discrete steps
  accumulatedX: 0,

  init() {
    this.setupGestures(document.getElementById('b'));
  },

  // Pulse a key flag for a few frames, as if the key was tapped.
  tap(flag) {
    keysDown |= flag;
    setTimeout(() => (keysDown &= ~flag), 100);
  },

  setupGestures(target) {
    const playing = () => gameState === 0 && !paused;

    target.addEventListener('touchstart', (e) => {
      if (!playing()) return;
      const touch = e.changedTouches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.touchStartTime = performance.now();
      this.isDragging = false;
      this.accumulatedX = 0;
    }, { passive: true });

    target.addEventListener('touchmove', (e) => {
      if (!playing()) return;
      e.preventDefault(); // Prevent scrolling

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;

      // Vertical drag (soft drop)
      if (deltaY > this.softDropThreshold) {
        keysDown |= flags.moveDown;
        this.isDragging = true;
      } else {
        keysDown &= ~flags.moveDown;
      }

      // Horizontal drag: one cell per cell width dragged.
      const cssCell = cellSize / (window.devicePixelRatio || 1);
      const dist = deltaX - this.accumulatedX;
      if (Math.abs(dist) > cssCell) {
        this.isDragging = true;
        if (dist > 0) {
          keysDown |= flags.moveRight;
          keysDown &= ~flags.moveLeft;
        } else {
          keysDown |= flags.moveLeft;
          keysDown &= ~flags.moveRight;
        }
        this.accumulatedX += dist > 0 ? cssCell : -cssCell;
      } else if (Math.abs(dist) < cssCell * 0.5) {
        keysDown &= ~(flags.moveLeft | flags.moveRight);
      }
    }, { passive: false });

    target.addEventListener('touchend', (e) => {
      if (!playing()) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const totalDist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const quick = performance.now() - this.touchStartTime < 300;

      // Release movement keys
      keysDown &= ~(flags.moveLeft | flags.moveRight | flags.moveDown);

      if (quick && -deltaY > this.flickThreshold && Math.abs(deltaX) < -deltaY) {
        // Flick up -> Hard drop
        this.tap(flags.hardDrop);
      } else if (!this.isDragging && totalDist < 10) {
        const now = performance.now();
        if (now - this.lastTapTime < 300) {
          // Double Tap -> Hold
          this.tap(flags.holdPiece);
        } else {
          // Single Tap -> Rotate
          this.tap(flags.rotRight);
        }
        this.lastTapTime = now;
      }
    });
  },

  triggerHaptic(type) {
    if (!navigator.vibrate) return;
    navigator.vibrate(type === 'heavy' ? 40 : type === 'medium' ? 20 : 10);
  },
};

document.addEventListener('DOMContentLoaded', () => {
  Responsive.init();
});

window.Responsive = Responsive;
