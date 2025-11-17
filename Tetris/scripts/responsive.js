// Responsive Design and Touch Controls System
// Added to Tetris game for mobile/tablet compatibility

'use strict';

/**
 * Device Detection and Responsive Management
 */
const Responsive = {
  isMobile: false,
  isTablet: false,
  isTouchDevice: false,
  screenWidth: window.innerWidth,
  screenHeight: window.innerHeight,
  orientation: window.orientation || 0,

  // Touch control mappings to keyboard flags
  touchMappings: {
    'moveLeft': flags.moveLeft,
    'moveRight': flags.moveRight,
    'softDrop': flags.moveDown,
    'hardDrop': flags.hardDrop,
    'hold': flags.holdPiece,
    'rotCW': flags.rotRight,
    'rotCCW': flags.rotLeft
  },

  // Initialize responsive system
  init() {
    this.detectDevice();
    this.setupTouchControls();
    this.setupOrientationChange();
    this.resize();
  },

  // Detect device type
  detectDevice() {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);

    // Touch capability detection
    this.isTouchDevice = ('ontouchstart' in window) ||
                        (navigator.maxTouchPoints > 0) ||
                        (navigator.msMaxTouchPoints > 0);

    // Screen size detection
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;

    // Device classification
    if (isIOS || isAndroid) {
      this.isMobile = this.screenWidth < 768;
      this.isTablet = !this.isMobile;
    } else {
      // Desktop detection
      this.isMobile = false;
      this.isTablet = false;
    }

    // Show/hide mobile controls based on device type
    this.updateMobileControlsVisibility();
  },

  // Show/hide mobile touch controls
  updateMobileControlsVisibility() {
    const mobileControls = document.getElementById('mobile-controls');

    if (this.isMobile && this.screenWidth <= 480) {
      mobileControls.classList.add('show');
    } else {
      mobileControls.classList.remove('show');
    }
  },

  // Setup touch event handlers
  setupTouchControls() {
    const mobileControls = document.getElementById('mobile-controls');

    // Handle D-pad and rotate button
    const dPadElements = mobileControls.querySelectorAll('.d-pad-up, .d-pad-down, .d-pad-left, .d-pad-right, .rotate-btn');

    dPadElements.forEach(element => {
      // Touch start - press action
      element.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleTouchStart(element.dataset.action || element.parentElement.dataset.action);
        element.classList.add('active');
      }, { passive: false });

      // Touch end - release action
      element.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.handleTouchEnd(element.dataset.action || element.parentElement.dataset.action);
        element.classList.remove('active');
      }, { passive: false });

      // Mouse events for desktop testing
      element.addEventListener('mousedown', (e) => {
        this.handleTouchStart(element.dataset.action || element.parentElement.dataset.action);
        element.classList.add('active');
      });

      element.addEventListener('mouseup', (e) => {
        this.handleTouchEnd(element.dataset.action || element.parentElement.dataset.action);
        element.classList.remove('active');
      });
    });

    // Handle hold button
    const holdBtn = mobileControls.querySelector('.hold-btn');
    if (holdBtn) {
      holdBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleTouchStart(holdBtn.dataset.action);
        holdBtn.classList.add('active');
      }, { passive: false });

      holdBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.handleTouchEnd(holdBtn.dataset.action);
        holdBtn.classList.remove('active');
      }, { passive: false });

      // Mouse events for hold button
      holdBtn.addEventListener('mousedown', (e) => {
        this.handleTouchStart(holdBtn.dataset.action);
        holdBtn.classList.add('active');
      });

      holdBtn.addEventListener('mouseup', (e) => {
        this.handleTouchEnd(holdBtn.dataset.action);
        holdBtn.classList.remove('active');
      });
    }

    // Prevent default touch behaviors on game area
    const gameArea = document.getElementById('b');
    gameArea.addEventListener('touchstart', (e) => {
      e.preventDefault();
    }, { passive: false });
  },

  // Handle touch start (button press)
  handleTouchStart(action) {
    if (this.touchMappings[action] !== undefined) {
      keysDown |= this.touchMappings[action];
    }

    // Special handling for continuous actions
    switch (action) {
      case 'softDrop':
        // Soft drop needs to be held
        break;
    }
  },

  // Handle touch end (button release)
  handleTouchEnd(action) {
    if (this.touchMappings[action] !== undefined) {
      keysDown &= ~this.touchMappings[action];
    }
  },

  // Setup orientation change detection
  setupOrientationChange() {
    window.addEventListener('orientationchange', () => {
      // Wait for orientation change to complete
      setTimeout(() => {
        this.screenWidth = window.innerWidth;
        this.screenHeight = window.innerHeight;
        this.orientation = window.orientation || 0;
        this.detectDevice();
        resize(); // Call existing resize function
      }, 300);
    });

    // Fallback for browsers that don't support orientationchange
    window.addEventListener('resize', () => {
      // Only resize if it's not an orientation change
      setTimeout(() => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;

        if (newWidth !== this.screenWidth || newHeight !== this.screenHeight) {
          this.screenWidth = newWidth;
          this.screenHeight = newHeight;
          this.detectDevice();
          resize(); // Call existing resize function
        }
      }, 300);
    });
  },

  // Enhanced resize function that considers device type
  resize() {
    const a = document.getElementById('a');
    const b = document.getElementById('b');
    const c = document.getElementById('c');
    const content = document.getElementById('content');
    const stats = document.getElementById('stats');
    const h3s = document.getElementsByTagName('h3');

    const screenHeight = window.innerHeight - 34;
    let screenWidth = window.innerWidth;

    // Responsive cellSize calculation based on device type
    if (this.isMobile && screenWidth <= 480) {
      // Mobile: prioritize width for touch controls
      const availableHeight = this.screenHeight - 250; // Leave room for touch controls
      const maxWidth = this.screenWidth - 20; // Padding
      const aspectRatio = 10/20; // Standard tetris ratio (10 wide, 20 tall)

      cellSize = Math.min(
        Math.floor(maxWidth / 10), // Fit 10 columns in width
        Math.floor(availableHeight / 20), // Fit 20 rows in available height
        25 // Don't let pieces get too big on mobile
      );
    } else if (this.isTablet || screenWidth <= 1023) {
      // Tablet: balance width and height
      const maxWidth = Math.min(this.screenWidth * 0.6, 360); // 60% of width or 360px max
      cellSize = Math.min(
        Math.floor(maxWidth / 10),
        Math.floor(screenHeight / 20),
        30
      );
    } else {
      // Desktop: original calculation
      cellSize = Math.max(Math.floor((screenHeight) / 20), 10);
    }

    // Ensure minimum cellSize for gameplay
    cellSize = Math.max(cellSize, this.isMobile ? 12 : 10);

    // Calculate padding based on device type
    let verticalPadding;
    if (this.isMobile && screenWidth <= 480) {
      verticalPadding = '10px';
      content.style.padding = `10px 5px`;
      content.style.minHeight = 'calc(100vh - 250px)'; // Account for touch controls
    } else {
      verticalPadding = `0 ${(this.screenHeight - (cellSize * 20 + 2)) / 2}px`;
      content.style.padding = verticalPadding;
      content.style.minHeight = 'auto';
    }

    // Size canvases
    stackCanvas.width = activeCanvas.width = bgStackCanvas.width = cellSize * 10;
    stackCanvas.height = activeCanvas.height = bgStackCanvas.height = cellSize * 20;

    holdCanvas.width = cellSize * 4;
    holdCanvas.height = cellSize * 2;

    previewCanvas.width = cellSize * 4;
    previewCanvas.height = stackCanvas.height;

    // Size containers
    b.style.width = stackCanvas.width + 'px';
    b.style.height = stackCanvas.height + 'px';

    a.style.width = holdCanvas.width + 'px';
    a.style.height = holdCanvas.height + 'px';

    c.style.width = previewCanvas.width + 'px';
    c.style.height = b.style.height;

    // Scale text
    if (this.isMobile) {
      msg.style.lineHeight = (stackCanvas.height * 0.8) + 'px';
      msg.style.fontSize = Math.floor(stackCanvas.width / 8) + 'px';
      stats.style.fontSize = Math.floor(stackCanvas.width / 14) + 'px';

      for (let i = 0; i < h3s.length; i++) {
        h3s[i].style.lineHeight = (a.offsetHeight * 0.8) + 'px';
        h3s[i].style.fontSize = Math.max(stats.style.fontSize, '10px');
      }
    } else {
      msg.style.lineHeight = b.style.height;
      msg.style.fontSize = Math.floor(stackCanvas.width / 6) + 'px';
      stats.style.fontSize = Math.floor(stackCanvas.width / 11) + 'px';
      document.documentElement.style.fontSize = Math.floor(stackCanvas.width / 16) + 'px';

      for (let i = 0; i < h3s.length; i++) {
        h3s[i].style.lineHeight = a.style.height;
        h3s[i].style.fontSize = stats.style.fontSize;
      }
    }

    // Position stats
    if (this.isMobile) {
      stats.style.position = 'static';
      stats.style.margin = '10px auto';
      stats.style.width = Math.min(stackCanvas.width * 0.8, 300) + 'px';
    }

    // Redraw game elements
    makeSprite();

    if (settings.Grid === 1) bg(bgStackCtx);

    if (gameState === 0) {
      piece.drawGhost();
      piece.draw();
      stack.draw();
      preview.draw();
      if (hold.piece !== void 0) {
        hold.draw();
      }
    }
  }
};

// Initialize responsive system when page loads
document.addEventListener('DOMContentLoaded', () => {
  Responsive.init();
});

// Make Responsive available globally
window.Responsive = Responsive;
