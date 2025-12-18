// Responsive Design and Gesture Controls
// Replaces button-based controls with direct touch gestures
// Implements specific mobile layout requested

'use strict';

const Responsive = {
  isMobile: false,
  lastTapTime: 0,
  touchStartX: 0,
  touchStartY: 0,
  isDragging: false,
  dragThreshold: 10,
  softDropThreshold: 30,
  
  // Track accumulated movement for discrete steps
  accumulatedX: 0,
  
  init() {
    this.detectDevice();
    this.setupGestures();
    window.addEventListener('resize', () => {
      this.detectDevice();
      this.resize();
    });
    this.resize();
  },

  detectDevice() {
    this.isMobile = window.innerWidth < 768 || ('ontouchstart' in window);
    if (this.isMobile) {
      document.body.classList.add('touch-device');
    } else {
      document.body.classList.remove('touch-device');
    }
  },

  setupGestures() {
    const target = document.body; // Capture all touches

    target.addEventListener('touchstart', (e) => {
      if (!this.isMobile) return;
      // e.preventDefault(); // Prevent default only if necessary, might block other interactions if global
      
      const touch = e.changedTouches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.isDragging = false;
      this.accumulatedX = 0;
    }, { passive: false });

    target.addEventListener('touchmove', (e) => {
      if (!this.isMobile) return;
      e.preventDefault(); // Prevent scrolling

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;

      // Vertical Swipe (Soft Drop)
      if (deltaY > this.softDropThreshold) {
        keysDown |= flags.moveDown;
        this.isDragging = true;
      } else {
        keysDown &= ~flags.moveDown;
      }

      // Horizontal Drag
      // We want to trigger moveLeft/Right based on distance moved
      // Reset keys first
      // keysDown &= ~(flags.moveLeft | flags.moveRight);
      
      // Calculate how many cells we should have moved
      // cellSize is global from tetris.js
      if (typeof cellSize !== 'undefined' && cellSize > 0) {
        // Use a sensitivity factor, e.g., move 1 cell for every cellSize pixels dragged
        const dist = deltaX - this.accumulatedX;
        
        if (Math.abs(dist) > cellSize) {
          this.isDragging = true;
          if (dist > 0) {
             // Move Right
             keysDown |= flags.moveRight;
             keysDown &= ~flags.moveLeft;
             // We need to pulse the key for the game loop to register a shift if DAS is active
             // But tetris.js logic handles continuous hold for DAS.
             // If we want 1-to-1 movement, we might need to manually call piece.move
             // For now, let's emulate holding the key.
          } else {
             // Move Left
             keysDown |= flags.moveLeft;
             keysDown &= ~flags.moveRight;
          }
          this.accumulatedX += (dist > 0 ? cellSize : -cellSize);
        } else if (Math.abs(dist) < cellSize * 0.5) {
          // If stopped dragging, release keys
           keysDown &= ~(flags.moveLeft | flags.moveRight);
        }
      }

    }, { passive: false });

    target.addEventListener('touchend', (e) => {
      if (!this.isMobile) return;
      
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      const totalDist = Math.sqrt(deltaX*deltaX + deltaY*deltaY);

      // Release movement keys
      keysDown &= ~(flags.moveLeft | flags.moveRight | flags.moveDown);

      if (!this.isDragging && totalDist < 10) {
        // It was a tap
        const currentTime = new Date().getTime();
        const tapLength = currentTime - this.lastTapTime;
        
        if (tapLength < 300 && tapLength > 0) {
          // Double Tap -> Hold
          keysDown |= flags.holdPiece;
          setTimeout(() => keysDown &= ~flags.holdPiece, 100);
        } else {
          // Single Tap -> Rotate
          keysDown |= flags.rotRight;
          setTimeout(() => keysDown &= ~flags.rotRight, 100);
        }
        this.lastTapTime = currentTime;
      }
    });
  },

  resize() {
    // Standard resize logic for PC (defer to original if not mobile)
    // But since we are overriding, we must handle both or call original for PC.
    // The original resize() in tetris.js is good for PC, but we want to change mobile.
    
    if (!this.isMobile) {
      // Restore PC styles if needed, or just let the original resize function handle it if we can call it?
      // tetris.js calls Responsive.resize() if it exists.
      // So we must implement PC resize here too or copy it.
      // Let's copy/adapt the PC logic and add Mobile logic.
      
      // PC Logic (Centered)
      const content = document.getElementById('content');
      const b = document.getElementById('b');
      const a = document.getElementById('a');
      const c = document.getElementById('c');
      const stats = document.getElementById('stats');
      
      // Reset specific mobile styles
      content.style.padding = '';
      content.style.height = '';
      content.style.width = '';
      
      b.style.position = '';
      b.style.bottom = '';
      b.style.left = '';
      b.style.transform = '';
      
      a.style.position = '';
      a.style.top = '';
      a.style.left = '';
      
      c.style.position = '';
      c.style.top = '';
      c.style.right = '';
      
      stats.style.position = 'absolute';
      stats.style.top = '';
      stats.style.left = '';
      stats.style.bottom = ''; // Will be set by PC logic
      
      // Calculate PC dimensions (Center logic is now handled by CSS Flexbox on body)
      var screenHeight = window.innerHeight - 34;
      var screenWidth = ~~(screenHeight * 1.024);
      if (screenWidth > window.innerWidth)
        screenHeight = ~~(window.innerWidth / 1.024);

      if (settings.Size === 1 && screenHeight > 602) cellSize = 15;
      else if (settings.Size === 2 && screenHeight > 602) cellSize = 30;
      else if (settings.Size === 3 && screenHeight > 902) cellSize = 45;
      else cellSize = Math.max(~~(screenHeight / 20), 10);

      // We don't need padding for centering anymore due to flexbox, 
      // but we need to set canvas sizes.
      
      // Set sizes
      stackCanvas.width = activeCanvas.width = bgStackCanvas.width = cellSize * 10;
      stackCanvas.height = activeCanvas.height = bgStackCanvas.height = cellSize * 20;
      b.style.width = stackCanvas.width + 'px';
      b.style.height = stackCanvas.height + 'px';

      holdCanvas.width = cellSize * 4;
      holdCanvas.height = cellSize * 2;
      a.style.width = holdCanvas.width + 'px';
      a.style.height = holdCanvas.height + 'px';

      previewCanvas.width = cellSize * 4;
      previewCanvas.height = stackCanvas.height;
      c.style.width = previewCanvas.width + 'px';
      c.style.height = b.style.height;
      
      // Font sizes
      msg.style.lineHeight = b.style.height;
      msg.style.fontSize = ~~(stackCanvas.width / 6) + 'px';
      stats.style.fontSize = ~~(stackCanvas.width / 11) + 'px';
      document.documentElement.style.fontSize = ~~(stackCanvas.width / 16) + 'px';
      
      stats.style.width = a.style.width;
      // Position stats at bottom left of content if standard layout
      // Original logic used padding to position stats. 
      // Let's stick to standard flow: Left col, Center col, Right col.
      // CSS floats handle this.
      
    } else {
      // MOBILE LOGIC
      const content = document.getElementById('content');
      const b = document.getElementById('b'); // Game
      const a = document.getElementById('a'); // Hold
      const c = document.getElementById('c'); // Next
      const stats = document.getElementById('stats');
      
      // Maximize game area at bottom
      // Available height
      const h = window.innerHeight;
      const w = window.innerWidth;
      
      // Calculate cellSize to fit height (leaving space for top panels) or width
      // We want panels at top. Let's say top 20% or fixed pixels.
      // Hold panel is cellSize*4 wide, cellSize*2 high.
      // Game is cellSize*10 wide, cellSize*20 high.
      
      // Try to fit game in bottom 75% of screen
      const gameHeightTarget = h * 0.75;
      const gameWidthTarget = w * 0.95;
      
      cellSize = Math.min(
        Math.floor(gameHeightTarget / 20),
        Math.floor(gameWidthTarget / 10)
      );
      
      // Update Canvases
      stackCanvas.width = activeCanvas.width = bgStackCanvas.width = cellSize * 10;
      stackCanvas.height = activeCanvas.height = bgStackCanvas.height = cellSize * 20;
      
      holdCanvas.width = cellSize * 4;
      holdCanvas.height = cellSize * 2;
      
      previewCanvas.width = cellSize * 4;
      previewCanvas.height = cellSize * 4; // Show fewer next pieces to save space? Or full? 
      // User said "minified on the right". Let's keep width but maybe shorter height if needed?
      // Original preview height is stackCanvas.height.
      // Let's make it smaller for mobile top bar.
      previewCanvas.height = cellSize * 10; // 3-4 pieces
      
      // Style Game Box (Bottom Center)
      b.style.width = stackCanvas.width + 'px';
      b.style.height = stackCanvas.height + 'px';
      b.style.position = 'fixed';
      b.style.bottom = '10px';
      b.style.left = '50%';
      b.style.transform = 'translateX(-50%)';
      b.style.float = 'none';
      b.style.border = '1px solid rgba(255,255,255,0.5)';
      
      // Style Hold Panel (Top Left)
      a.style.width = holdCanvas.width + 'px';
      a.style.height = holdCanvas.height + 'px';
      a.style.position = 'fixed';
      a.style.top = '10px';
      a.style.left = '10px';
      a.style.float = 'none';
      
      // Style Next Panel (Top Right)
      c.style.width = previewCanvas.width + 'px';
      c.style.height = previewCanvas.height + 'px';
      c.style.position = 'fixed';
      c.style.top = '10px';
      c.style.right = '10px';
      c.style.float = 'none';
      
      // Style Stats (Below Hold)
      stats.style.position = 'fixed';
      stats.style.top = (10 + holdCanvas.height + 10) + 'px'; // 10px padding + hold height + gap
      stats.style.left = '10px';
      stats.style.width = holdCanvas.width + 'px';
      stats.style.fontSize = (cellSize * 0.8) + 'px';
      stats.style.display = 'block';
      
      // Content container adjustment
      content.style.width = '100%';
      content.style.height = '100%';
      content.style.padding = '0';
      content.style.background = 'transparent'; // Remove background on mobile to see wallpaper
      content.style.display = 'block';
      
      // Adjust font sizes
      msg.style.lineHeight = b.style.height;
      msg.style.fontSize = (cellSize * 2) + 'px';
    }
    
    // Redraw
    makeSprite();
    if (settings.Grid === 1) bg(bgStackCtx);
    if (gameState === 0) {
      piece.drawGhost();
      piece.draw();
      stack.draw();
      preview.draw();
      if (hold.piece !== void 0) hold.draw();
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Responsive.init();
});

window.Responsive = Responsive;
