/** Particles, score pop-ups and screen shake, in field pixels. */
export function createFx({ reducedMotion = false } = {}) {
  const fx = {
    particles: [],
    popups: [],
    shakeT: 0,
    shakeAmp: 0,
    drumLit: 0,
    burst(x, y, colors, n = 10, speed = 1.4) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random());
        fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, life: 24 + Math.random() * 20, color: colors[i % colors.length], size: Math.random() < 0.3 ? 2 : 1 });
      }
    },
    popup(x, y, points) {
      fx.popups.push({ x, y, points, life: 50 });
    },
    shake(amp, t = 12) {
      if (reducedMotion) return;
      fx.shakeAmp = Math.max(fx.shakeAmp, amp);
      fx.shakeT = Math.max(fx.shakeT, t);
    },
    step() {
      for (const p of fx.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08;
        p.life--;
      }
      fx.particles = fx.particles.filter((p) => p.life > 0);
      for (const p of fx.popups) {
        p.y -= 0.35;
        p.life--;
      }
      fx.popups = fx.popups.filter((p) => p.life > 0);
      if (fx.shakeT > 0) fx.shakeT--;
      else fx.shakeAmp = 0;
      if (fx.drumLit > 0) fx.drumLit--;
    },
    offset() {
      if (!fx.shakeT) return { x: 0, y: 0 };
      const a = fx.shakeAmp * (fx.shakeT / 12);
      return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
    },
    clear() {
      fx.particles.length = 0;
      fx.popups.length = 0;
      fx.shakeT = 0;
      fx.drumLit = 0;
    },
  };
  return fx;
}
