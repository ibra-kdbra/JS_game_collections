/**
 * The modern layer over the original art: light rays, caustics, drifting
 * particles, soft shadows, glows, a vignette, coins flying to the counter,
 * floating money text, screen shake and scene fades.
 */
import { TANK, BAR, W, H } from './data.js';

const UI_FONT = '700 {size}px "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';
export const uiFont = (size, weight = 700) => UI_FONT.replace('700', String(weight)).replace('{size}', size);

export function createPolish(gfx) {
  const { ctx } = gfx;
  const motes = Array.from({ length: 46 }, (_, i) => ({ x: Math.random() * W, y: BAR + Math.random() * (H - BAR), s: 0.6 + Math.random() * 1.6, v: 0.08 + Math.random() * 0.22, p: Math.random() * 6.28, i }));
  const streams = [{ x: 70, t: 0 }, { x: 590, t: 30 }, { x: 300, t: 60 }];
  let bubbles = [];
  let flying = [];
  let floats = [];
  let shakeT = 0;
  let shakeMag = 0;
  let fade = 0;

  /* ---------- Water ---------- */

  function rays(t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = 40 + i * 140 + Math.sin(t / 240 + i * 1.9) * 40;
      const w = 50 + 25 * Math.sin(t / 180 + i);
      const a = 0.05 + 0.03 * Math.sin(t / 90 + i * 2.3);
      const g = ctx.createLinearGradient(0, TANK.surface, 0, TANK.floor);
      g.addColorStop(0, `rgba(210,240,255,${a * 1.6})`);
      g.addColorStop(1, 'rgba(210,240,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, TANK.surface - 10);
      ctx.lineTo(x + w, TANK.surface - 10);
      ctx.lineTo(x + w * 2.6 + 70, TANK.floor);
      ctx.lineTo(x + 70, TANK.floor);
      ctx.closePath();
      ctx.fill();
    }
    // Caustic shimmer near the surface.
    for (let i = 0; i < 18; i++) {
      const x = ((i * 53 + t * 0.35) % (W + 60)) - 30;
      const y = TANK.surface + 8 + Math.sin(t / 30 + i) * 4 + (i % 3) * 7;
      ctx.fillStyle = `rgba(255,255,255,${0.05 + 0.04 * Math.sin(t / 20 + i * 1.3)})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 18 + (i % 4) * 6, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function ambient(t) {
    // Drifting particles.
    ctx.save();
    for (const m of motes) {
      m.y -= m.v;
      m.x += Math.sin(t / 70 + m.p) * 0.15;
      if (m.y < TANK.surface) {
        m.y = TANK.floor;
        m.x = Math.random() * W;
      }
      ctx.fillStyle = `rgba(230,250,255,${0.18 + 0.12 * Math.sin(t / 40 + m.p)})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Bubble streams.
    for (const st of streams) {
      if (--st.t <= 0) {
        st.t = 14 + Math.random() * 30;
        bubbles.push({ x: st.x + (Math.random() - 0.5) * 10, y: TANK.floor - 10, r: Math.floor(Math.random() * 3), p: Math.random() * 6, v: 0.7 + Math.random() * 0.6 });
      }
    }
    for (const b of bubbles) {
      b.y -= b.v;
      b.x += Math.sin((b.y + b.p * 40) / 18) * 0.35;
      const k = Math.max(0, Math.min(1, (b.y - TANK.surface) / 40));
      gfx.frame('bubbles', b.r, 0, b.x, b.y, { add: true, alpha: 0.75 * k });
    }
    bubbles = bubbles.filter((b) => b.y > TANK.surface);
  }

  /** Soft shadow on the sand under something at (x, y) of a given size. */
  function shadow(x, y, size) {
    const h = Math.max(0, TANK.floor - y);
    const k = Math.max(0, 1 - h / 360);
    if (k <= 0.02) return;
    const w = size * (0.9 + 0.6 * (1 - k));
    const g = ctx.createRadialGradient(x, TANK.floor - 4, 0, x, TANK.floor - 4, w);
    g.addColorStop(0, `rgba(0,10,30,${0.28 * k})`);
    g.addColorStop(1, 'rgba(0,10,30,0)');
    ctx.fillStyle = g;
    ctx.save();
    ctx.translate(x, TANK.floor - 4);
    ctx.scale(1, 0.28);
    ctx.translate(-x, -(TANK.floor - 4));
    ctx.beginPath();
    ctx.arc(x, TANK.floor - 4, w, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A soft additive glow. */
  function glow(x, y, r, color, a = 0.5) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', a));
    g.addColorStop(1, color.replace('A', 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function vignette() {
    const g = ctx.createRadialGradient(W / 2, H / 2 + 20, H * 0.35, W / 2, H / 2 + 20, H * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,8,25,0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, BAR, W, H - BAR);
  }

  /* ---------- Juice ---------- */

  function coinFly(type, x, y, tx, ty, drawCoin) {
    flying.push({ type, x, y, tx, ty, t: 0, dur: 34, drawCoin });
  }

  function floatText(str, x, y, color = '#ffe45c', size = 18) {
    floats.push({ str, x, y, color, size, t: 0, dur: 60 });
  }

  function shake(mag, dur) {
    shakeMag = Math.max(shakeMag, mag);
    shakeT = Math.max(shakeT, dur);
  }

  function shakeOffset() {
    if (shakeT <= 0) return { x: 0, y: 0 };
    const k = shakeT / 20;
    return { x: (Math.random() - 0.5) * shakeMag * Math.min(1, k) * 2, y: (Math.random() - 0.5) * shakeMag * Math.min(1, k) * 2 };
  }

  function step() {
    if (shakeT > 0 && --shakeT === 0) shakeMag = 0;
    for (const f of flying) f.t++;
    flying = flying.filter((f) => f.t < f.dur);
    for (const f of floats) f.t++;
    floats = floats.filter((f) => f.t < f.dur);
    if (fade > 0) fade = Math.max(0, fade - 0.07);
  }

  function drawJuice(t) {
    for (const f of flying) {
      const k = f.t / f.dur;
      const e = 1 - (1 - k) ** 3;
      const x = f.x + (f.tx - f.x) * e;
      const y = f.y + (f.ty - f.y) * e - Math.sin(k * Math.PI) * 50;
      for (let i = 1; i <= 3; i++) {
        const kk = Math.max(0, k - i * 0.04);
        const ee = 1 - (1 - kk) ** 3;
        ctx.save();
        ctx.globalAlpha = 0.18 / i;
        f.drawCoin(f.type, f.x + (f.tx - f.x) * ee, f.y + (f.ty - f.y) * ee - Math.sin(kk * Math.PI) * 50, 1 - 0.5 * kk, t);
        ctx.restore();
      }
      f.drawCoin(f.type, x, y, 1 - 0.5 * k, t);
    }
    for (const f of floats) {
      const k = f.t / f.dur;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.55 : 1.15 - Math.min(0.15, (k - 0.15) * 0.6);
      ctx.save();
      ctx.globalAlpha = k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1;
      ctx.translate(f.x, f.y - k * 34);
      ctx.scale(pop, pop);
      ctx.font = uiFont(f.size, 800);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,20,40,0.85)';
      ctx.strokeText(f.str, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.str, 0, 0);
      ctx.restore();
    }
  }

  /* ---------- Scene fades ---------- */

  function startFade() {
    fade = 1;
  }

  function drawFade() {
    if (fade <= 0) return;
    ctx.fillStyle = `rgba(0,6,20,${fade})`;
    ctx.fillRect(0, 0, W, H);
  }

  return { rays, ambient, shadow, glow, vignette, coinFly, floatText, shake, shakeOffset, step, drawJuice, startFade, drawFade };
}
