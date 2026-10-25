/** Bubbles, sparkles and floating text, in tank coordinates. */
export function createFx() {
  const fx = {
    particles: [],
    popups: [],
    bubbles(x, y, n = 5) {
      for (let i = 0; i < n; i++) {
        fx.particles.push({ x: x + (Math.random() - 0.5) * 10, y, vx: (Math.random() - 0.5) * 0.4, vy: -0.6 - Math.random() * 0.8, life: 40 + Math.random() * 30, r: 1.5 + Math.random() * 2.5, color: 'rgba(255,255,255,0.6)', float: true });
      }
    },
    burst(x, y, colors, n = 10, speed = 2) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random());
        fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 22 + Math.random() * 18, r: 1.5 + Math.random() * 2, color: colors[i % colors.length] });
      }
    },
    popup(x, y, text, color = '#ffffff') {
      fx.popups.push({ x, y, text, color, life: 50 });
    },
    step() {
      for (const p of fx.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (!p.float) {
          p.vx *= 0.94;
          p.vy *= 0.94;
        }
        p.life--;
      }
      fx.particles = fx.particles.filter((p) => p.life > 0);
      for (const p of fx.popups) {
        p.y -= 0.6;
        p.life--;
      }
      fx.popups = fx.popups.filter((p) => p.life > 0);
    },
    clear() {
      fx.particles.length = 0;
      fx.popups.length = 0;
    },
  };
  return fx;
}
