/** Click ripples, bubbles, stars, floating text, coins flying to the money box, shake. */
export function createFx({ reducedMotion = false } = {}) {
  const fx = {
    particles: [],
    popups: [],
    rings: [],
    flying: [],
    shakeT: 0,
    shakeAmp: 0,
    ring(x, y, color = 'rgba(255,255,255,0.9)', max = 18) {
      fx.rings.push({ x, y, r: 4, color, life: max, max });
    },
    bubbles(x, y, n = 5) {
      for (let i = 0; i < n; i++) {
        fx.particles.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 8, vx: (Math.random() - 0.5) * 0.4, vy: -0.7 - Math.random() * 0.9, life: 40 + Math.random() * 30, r: 2 + Math.random() * 3, bubble: true });
      }
    },
    stars(x, y, colors, n = 8, speed = 2.4) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
        const v = speed * (0.6 + Math.random() * 0.6);
        fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 22 + Math.random() * 12, r: 3 + Math.random() * 3, color: colors[i % colors.length], star: true, drag: 0.9 });
      }
    },
    burst(x, y, colors, n = 12, speed = 2) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = speed * (0.4 + Math.random());
        fx.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.5, life: 20 + Math.random() * 20, r: 1.5 + Math.random() * 2.5, color: colors[i % colors.length], drag: 0.93, gravity: 0.05 });
      }
    },
    popup(x, y, text, color = '#ffffff', size = 20) {
      fx.popups.push({ x, y, text, color, size, life: 50 });
    },
    fly(type, x, y) {
      fx.flying.push({ type, x, y, t: 0, dur: 32 });
    },
    shake(amp, t = 10) {
      if (reducedMotion) return;
      fx.shakeAmp = Math.max(fx.shakeAmp, amp);
      fx.shakeT = Math.max(fx.shakeT, t);
    },
    shakeOffset() {
      if (!fx.shakeT) return { x: 0, y: 0 };
      const a = fx.shakeAmp * (fx.shakeT / 10);
      return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
    },
    step() {
      for (const p of fx.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.drag) {
          p.vx *= p.drag;
          p.vy *= p.drag;
        }
        if (p.gravity) p.vy += p.gravity;
        if (p.bubble) p.x += Math.sin(p.life / 5) * 0.2;
        p.life--;
      }
      fx.particles = fx.particles.filter((p) => p.life > 0);
      for (const p of fx.popups) {
        p.y -= 0.7;
        p.life--;
      }
      fx.popups = fx.popups.filter((p) => p.life > 0);
      for (const r of fx.rings) {
        r.r += 1.6;
        r.life--;
      }
      fx.rings = fx.rings.filter((r) => r.life > 0);
      const landed = [];
      for (const c of fx.flying) if (++c.t >= c.dur) landed.push(c);
      fx.flying = fx.flying.filter((c) => c.t < c.dur);
      if (fx.shakeT > 0) fx.shakeT--;
      return landed;
    },
    clear() {
      fx.particles.length = 0;
      fx.popups.length = 0;
      fx.rings.length = 0;
      fx.flying.length = 0;
      fx.shakeT = 0;
    },
  };
  return fx;
}
