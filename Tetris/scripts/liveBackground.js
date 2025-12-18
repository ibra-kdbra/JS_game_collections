/**
 * Professional Live Background System
 * Interactive particle effects that respond to gameplay
 * Multiple themes with smooth transitions
 */

'use strict';

const LiveBackground = {
  canvas: null,
  ctx: null,
  particles: [],
  theme: 'cyberpunk',
  animationId: null,
  isRunning: false,
  lastFrameTime: 0,
  fps: 60,
  
  // Theme configurations
  themes: {
    cyberpunk: {
      particles: {
        count: 80,
        speed: { min: 0.2, max: 0.8 },
        size: { min: 1, max: 3 },
        colors: ['#00ffff', '#ff00ff', '#ffff00', '#00ff00', '#ff0080'],
        connections: true,
        connectionColor: 'rgba(0, 255, 255, 0.1)',
        glow: true
      },
      background: {
        gradient: ['#0a0a0a', '#1a0033', '#330019'],
        animation: true
      }
    },
    neon: {
      particles: {
        count: 60,
        speed: { min: 0.3, max: 1.0 },
        size: { min: 2, max: 4 },
        colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec', '#3a86ff'],
        connections: false,
        connectionColor: '',
        glow: true
      },
      background: {
        gradient: ['#0d0221', '#1a0033', '#240046'],
        animation: true
      }
    },
    matrix: {
      particles: {
        count: 100,
        speed: { min: 0.5, max: 1.5 },
        size: { min: 1, max: 2 },
        colors: ['#00ff00', '#00cc00', '#009900'],
        connections: false,
        connectionColor: '',
        glow: true
      },
      background: {
        gradient: ['#000000', '#0d1117', '#161b22'],
        animation: true
      }
    },
    retro: {
      particles: {
        count: 40,
        speed: { min: 0.1, max: 0.4 },
        size: { min: 2, max: 5 },
        colors: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7'],
        connections: true,
        connectionColor: 'rgba(255, 255, 255, 0.05)',
        glow: false
      },
      background: {
        gradient: ['#2c3e50', '#34495e', '#2c3e50'],
        animation: false
      }
    }
  },

  // Game state reactive properties
  gameState: {
    level: 1,
    lines: 0,
    score: 0,
    isPlaying: false,
    speed: 1
  },

  // Initialize the background system
  init() {
    this.createCanvas();
    this.setupEventListeners();
    this.setTheme('cyberpunk');
    this.start();
  },

  // Create and setup the canvas
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'liveBackground';
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '-1';
    this.canvas.style.opacity = '0.8';
    
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    
    // Insert before the existing content
    document.body.insertBefore(this.canvas, document.body.firstChild);
  },

  // Setup event listeners
  setupEventListeners() {
    window.addEventListener('resize', () => this.resize());
    
    // Listen for game events if available
    if (typeof piece !== 'undefined') {
      // We'll update game state from the main game loop
      this.setupGameStateListener();
    }
  },

  // Setup game state monitoring
  setupGameStateListener() {
    // Override the original gameLoop to capture state changes
    if (typeof gameLoop === 'function') {
      const originalGameLoop = gameLoop;
      window.gameLoop = () => {
        originalGameLoop();
        this.updateGameState();
      };
    }
  },

  // Update game state for reactive effects
  updateGameState() {
    if (typeof lines !== 'undefined') {
      const newLines = lines;
      if (newLines !== this.gameState.lines) {
        this.onLinesCleared(newLines - this.gameState.lines);
        this.gameState.lines = newLines;
      }
    }

    if (typeof gameState !== 'undefined') {
      this.gameState.isPlaying = (gameState === 0);
    }
  },

  // React to line clears
  onLinesCleared(count) {
    if (count > 0) {
      this.createBurstEffect(count);
      this.triggerHaptic('success');
    }
  },

  // Create burst effect for line clears
  createBurstEffect(intensity = 1) {
    const theme = this.themes[this.theme];
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 10 * intensity; i++) {
      const angle = (Math.PI * 2 * i) / (10 * intensity);
      const speed = 2 + Math.random() * 3;
      
      this.particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: theme.particles.colors[Math.floor(Math.random() * theme.particles.colors.length)],
        life: 1,
        decay: 0.01 + Math.random() * 0.02,
        type: 'burst'
      });
    }
  },

  // Resize canvas to window size
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  // Set theme
  setTheme(themeName) {
    if (!this.themes[themeName]) {
      console.warn(`Theme "${themeName}" not found, using cyberpunk`);
      themeName = 'cyberpunk';
    }
    
    this.theme = themeName;
    this.initParticles();
  },

  // Initialize particles based on current theme
  initParticles() {
    this.particles = [];
    const theme = this.themes[this.theme];
    const config = theme.particles;
    
    for (let i = 0; i < config.count; i++) {
      this.particles.push(this.createParticle());
    }
  },

  // Create a single particle
  createParticle(type = 'normal') {
    const theme = this.themes[this.theme];
    const config = theme.particles;
    const colorIndex = Math.floor(Math.random() * config.colors.length);
    
    return {
      x: Math.random() * this.canvas.width,
      y: Math.random() * this.canvas.height,
      vx: (Math.random() - 0.5) * (config.speed.max - config.speed.min) + config.speed.min,
      vy: (Math.random() - 0.5) * (config.speed.max - config.speed.min) + config.speed.min,
      size: Math.random() * (config.size.max - config.size.min) + config.size.min,
      color: config.colors[colorIndex],
      life: 1,
      decay: type === 'burst' ? 0.02 : 0,
      type: type,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.02 + Math.random() * 0.03
    };
  },

  // Start animation
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.animate();
  },

  // Stop animation
  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  },

  // Main animation loop
  animate() {
    if (!this.isRunning) return;
    
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    // Throttle to target FPS
    if (deltaTime >= 1000 / this.fps) {
      this.update();
      this.draw();
      this.lastFrameTime = currentTime;
    }
    
    this.animationId = requestAnimationFrame(() => this.animate());
  },

  // Update particle positions and states
  update() {
    const theme = this.themes[this.theme];
    
    // Update existing particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      
      // Update position
      particle.x += particle.vx;
      particle.y += particle.vy;
      
      // Update pulse
      particle.pulse += particle.pulseSpeed;
      
      // Update life for burst particles
      if (particle.type === 'burst') {
        particle.life -= particle.decay;
        if (particle.life <= 0) {
          this.particles.splice(i, 1);
          continue;
        }
      }
      
      // Wrap around screen edges
      if (particle.x < -50) particle.x = this.canvas.width + 50;
      if (particle.x > this.canvas.width + 50) particle.x = -50;
      if (particle.y < -50) particle.y = this.canvas.height + 50;
      if (particle.y > this.canvas.height + 50) particle.y = -50;
      
      // Apply slight randomness to movement
      particle.vx += (Math.random() - 0.5) * 0.01;
      particle.vy += (Math.random() - 0.5) * 0.01;
      
      // Limit speed
      const maxSpeed = theme.particles.speed.max;
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (speed > maxSpeed) {
        particle.vx = (particle.vx / speed) * maxSpeed;
        particle.vy = (particle.vy / speed) * maxSpeed;
      }
    }
    
    // Maintain particle count
    const normalParticles = this.particles.filter(p => p.type === 'normal');
    while (normalParticles.length < theme.particles.count) {
      this.particles.push(this.createParticle());
    }
  },

  // Draw the background and particles
  draw() {
    const theme = this.themes[this.theme];
    
    // Clear canvas
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background gradient
    if (theme.background.animation) {
      this.drawAnimatedBackground();
    } else {
      this.drawStaticBackground();
    }
    
    // Draw particle connections
    if (theme.particles.connections) {
      this.drawConnections();
    }
    
    // Draw particles
    this.drawParticles();
  },

  // Draw animated gradient background
  drawAnimatedBackground() {
    const theme = this.themes[this.theme];
    const time = Date.now() * 0.0001;
    
    const gradient = this.ctx.createLinearGradient(
      0, 0, 
      this.canvas.width, this.canvas.height
    );
    
    theme.background.gradient.forEach((color, index) => {
      const position = (index / (theme.background.gradient.length - 1)) + 
                     Math.sin(time + index) * 0.1;
      gradient.addColorStop(Math.max(0, Math.min(1, position)), color);
    });
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

  // Draw static gradient background
  drawStaticBackground() {
    const theme = this.themes[this.theme];
    
    const gradient = this.ctx.createLinearGradient(
      0, 0, 
      this.canvas.width, this.canvas.height
    );
    
    theme.background.gradient.forEach((color, index) => {
      gradient.addColorStop(index / (theme.background.gradient.length - 1), color);
    });
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  },

  // Draw connections between nearby particles
  drawConnections() {
    const theme = this.themes[this.theme];
    const normalParticles = this.particles.filter(p => p.type === 'normal');
    const connectionDistance = 150;
    
    this.ctx.strokeStyle = theme.particles.connectionColor;
    this.ctx.lineWidth = 1;
    
    for (let i = 0; i < normalParticles.length; i++) {
      for (let j = i + 1; j < normalParticles.length; j++) {
        const p1 = normalParticles[i];
        const p2 = normalParticles[j];
        const distance = Math.sqrt(
          Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)
        );
        
        if (distance < connectionDistance) {
          const opacity = 1 - (distance / connectionDistance);
          this.ctx.globalAlpha = opacity * 0.5;
          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.stroke();
        }
      }
    }
    
    this.ctx.globalAlpha = 1;
  },

  // Draw all particles
  drawParticles() {
    const theme = this.themes[this.theme];
    
    this.particles.forEach(particle => {
      this.ctx.save();
      
      // Apply glow effect
      if (theme.particles.glow) {
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = particle.color;
      }
      
      // Calculate size with pulse effect
      let size = particle.size;
      if (particle.type === 'normal') {
        size *= 1 + Math.sin(particle.pulse) * 0.2;
      }
      
      // Apply life to burst particles
      if (particle.type === 'burst') {
        size *= particle.life;
        this.ctx.globalAlpha = particle.life;
      }
      
      // Draw particle
      this.ctx.fillStyle = particle.color;
      this.ctx.beginPath();
      this.ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    });
  },

  // Trigger haptic feedback (if available)
  triggerHaptic(type = 'light') {
    if (typeof Responsive !== 'undefined' && Responsive.triggerHaptic) {
      Responsive.triggerHaptic(type);
    }
  },

  // Cycle through themes
  nextTheme() {
    const themes = Object.keys(this.themes);
    const currentIndex = themes.indexOf(this.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    this.setTheme(themes[nextIndex]);
  },

  // Get current theme
  getTheme() {
    return this.theme;
  },

  // Performance monitoring
  getPerformanceStats() {
    return {
      particleCount: this.particles.length,
      fps: this.fps,
      theme: this.theme,
      isRunning: this.isRunning
    };
  }
};

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Initialize with a small delay to ensure all other scripts are loaded
  setTimeout(() => {
    LiveBackground.init();
  }, 100);
});

// Make available globally
window.LiveBackground = LiveBackground;
