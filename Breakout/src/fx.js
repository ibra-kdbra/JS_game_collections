/**
 * Cosmetic effects: particles, floating score text, shockwaves and screen
 * shake. Nothing here affects the simulation.
 */
import { CONFIG } from './config.js';
import { brickColor } from './render.js';

export function createFx({ reducedMotion = false } = {}) {
  const FX = CONFIG.fx;
  const fx = {
    particles: [],
    texts: [],
    rings: [],
    shake: 0,
    shakeScale: reducedMotion ? FX.shake.low * 0.5 : FX.shake.full,
    flash: 0,
    reduced: reducedMotion,
    seed: 0,
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  function particles(x, y, color, count, power = 1) {
    const n = Math.round(count * (fx.reduced ? 0.5 : 1));
    for (let i = 0; i < n; i++) {
      if (fx.particles.length >= FX.particleCap) fx.particles.shift();
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 190) * power;
      fx.particles.push({
        x: x + rand(-14, 14),
        y: y + rand(-6, 6),
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40 * power,
        life: rand(0.35, 0.8),
        max: 0.8,
        size: rand(2, 4.5),
        spin: rand(-8, 8),
        rot: rand(0, Math.PI),
        color,
      });
    }
  }

  fx.addShake = (amount) => {
    fx.shake = Math.min(14, fx.shake + amount * fx.shakeScale);
  };

  fx.onEvent = (e) => {
    switch (e.type) {
      case 'break': {
        const color = brickColor({ kind: e.kind, color: e.color });
        particles(e.x, e.y, color, FX.particlesPerBrick, e.cause === 'blast' ? 1.4 : 1);
        if (e.pts) fx.texts.push({ x: e.x, y: e.y, text: `+${e.pts}`, life: 0.8, hot: e.pts >= 40 });
        fx.addShake(FX.shakeBrick);
        break;
      }
      case 'hit':
        particles(e.x, e.y, '#d4d4d8', 4, 0.6);
        break;
      case 'steel':
        particles(e.x, e.y, '#a1a1aa', 3, 0.5);
        break;
      case 'explode':
        fx.rings.push({ x: e.x, y: e.y, r: 6, life: 0.4 });
        particles(e.x, e.y, '#facc15', 14, 1.8);
        particles(e.x, e.y, '#ef4444', 8, 1.4);
        fx.addShake(FX.shakeBomb);
        if (!fx.reduced) fx.flash = Math.min(0.35, fx.flash + 0.18);
        break;
      case 'lifeLost':
        fx.addShake(FX.shakeLife);
        if (!fx.reduced) fx.flash = 0.25;
        break;
      case 'powerup':
        fx.rings.push({ x: e.x, y: e.y, r: 10, life: 0.35, color: '#fafafa' });
        break;
      case 'paddle':
        particles(e.x, e.y + 4, '#facc15', 3, 0.4);
        break;
    }
  };

  fx.update = (dt) => {
    for (const p of fx.particles) {
      p.life -= dt;
      p.vy += 420 * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    fx.particles = fx.particles.filter((p) => p.life > 0);
    for (const t of fx.texts) {
      t.life -= dt;
      t.y -= 34 * dt;
    }
    fx.texts = fx.texts.filter((t) => t.life > 0);
    for (const r of fx.rings) {
      r.life -= dt;
      r.r += 260 * dt;
    }
    fx.rings = fx.rings.filter((r) => r.life > 0);
    fx.shake *= Math.exp(-FX.shakeDecay * dt);
    if (fx.shake < 0.05) fx.shake = 0;
    fx.flash = Math.max(0, fx.flash - dt * 1.6);
    fx.seed += dt;
  };

  fx.offset = () => {
    if (!fx.shake) return [0, 0];
    return [(Math.random() * 2 - 1) * fx.shake, (Math.random() * 2 - 1) * fx.shake];
  };

  fx.clear = () => {
    fx.particles.length = 0;
    fx.texts.length = 0;
    fx.rings.length = 0;
    fx.shake = 0;
    fx.flash = 0;
  };

  return fx;
}
