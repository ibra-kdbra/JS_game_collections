// Particle Effects Enhancement for Tetris
// Adds spectacular spark effects without breaking existing game

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.particleContainer = this.createContainer();
  }

  createContainer() {
    // Create particle overlay that works on all devices
    const container = document.createElement('div');
    container.id = 'particle-overlay';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      overflow: hidden;
    `;

    document.body.appendChild(container);
    return container;
  }

  createSparks(x, y, color = '#ffffff', count = 8) {
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = Math.random() * 60 + 40;
      const size = Math.random() * 3 + 2;

      spark.style.cssText = `
        position: absolute;
        left: ${x}px;
        top: ${y}px;
        width: ${size}px;
        height: ${size}px;
        background: ${color};
        border-radius: 50%;
        box-shadow: 0 0 ${size * 2}px ${color};
        pointer-events: none;
        opacity: 1;
      `;

      this.particleContainer.appendChild(spark);

      // Animate spark
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const animation = spark.animate([
        { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
        { transform: `translate(${vx * 0.3}px, ${vy * 0.3}px) scale(0.8)`, opacity: 0.8 },
        { transform: `translate(${vx * 0.6}px, ${vy * 0.6}px) scale(0.3)`, opacity: 0.3 },
        { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
      ], {
        duration: 600 + Math.random() * 300,
        easing: 'ease-out',
        fill: 'forwards'
      });

      animation.onfinish = () => {
        if (spark.parentNode) {
          spark.parentNode.removeChild(spark);
        }
      };
    }
  }

  createLineExplosion(linesCount = 1) {
    const canvas = document.querySelector('#b canvas') || document.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Different colors for different line counts
    const colors = ['#ffffff', '#ffff00', '#00ff00', '#ff00ff'];
    const color = colors[linesCount - 1] || '#ffffff';

    // Create explosion at the cleared lines area
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Create main explosion
    for (let i = 0; i < linesCount * 6; i++) {
      setTimeout(() => {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 100 + 50;
        const x = centerX + Math.cos(angle) * distance;
        const y = centerY + Math.sin(angle) * distance;

        this.createSparks(x, y, color, 3);
      }, i * 30);
    }

    // Special Tetris celebration
    if (linesCount === 4) {
      setTimeout(() => this.createTetrisCelebration(rect), 500);
    }
  }

  createTetrisCelebration(rect) {
    // Create golden star shower for Tetris
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const star = document.createElement('div');
        const x = rect.left + Math.random() * rect.width;

        star.innerHTML = '⭐';
        star.style.cssText = `
          position: absolute;
          left: ${x}px;
          top: ${rect.top - 20}px;
          font-size: ${Math.random() * 20 + 15}px;
          pointer-events: none;
          user-select: none;
          z-index: 1001;
          opacity: 1;
        `;

        this.particleContainer.appendChild(star);

        const animation = star.animate([
          { transform: 'translateY(0px) rotate(0deg)', opacity: 1 },
          { transform: `translateY(${rect.height + 100}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
        ], {
          duration: 2000 + Math.random() * 1000,
          easing: 'linear',
          fill: 'forwards'
        });

        animation.onfinish = () => {
          if (star.parentNode) {
            star.parentNode.removeChild(star);
          }
        };

      }, i * 150);
    }

    // Screen flash effect
    this.createScreenFlash();
  }

  createScreenFlash() {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(45deg, #ffff00, #ff0000, #0000ff, #ffff00);
      pointer-events: none;
      z-index: 999;
      opacity: 0.4;
    `;

    document.body.appendChild(flash);

    const animation = flash.animate([
      { opacity: 0.4, transform: 'scale(1)' },
      { opacity: 0.6, transform: 'scale(1.05)' },
      { opacity: 0, transform: 'scale(1)' }
    ], {
      duration: 500,
      easing: 'ease-out'
    });

    animation.onfinish = () => {
      if (flash.parentNode) {
        flash.parentNode.removeChild(flash);
      }
    };
  }

  createPieceEffect(piece) {
    if (!piece) return;

    // Simple sparkles when piece is placed
    const canvas = document.querySelector('#b canvas') || document.querySelector('canvas');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Create small sparkles around piece location
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 * i) / 4;
      const distance = 40;
      const x = centerX + Math.cos(angle) * distance;
      const y = centerY + Math.sin(angle) * distance;

      setTimeout(() => {
        this.createSparks(x, y, piece.color, 2);
      }, i * 50);
    }
  }

  // Cleanup old particles
  update() {
    // Could add particle physics here if needed
  }
}

// Create global particle system
const particleSystem = new ParticleSystem();
