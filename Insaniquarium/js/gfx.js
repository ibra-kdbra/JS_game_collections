/**
 * Drawing: sprite frames in original 640 x 480 coordinates (the 2x images
 * are drawn at half scale), and PopCap's bitmap fonts.
 */
import { assets } from './assets.js';

export const W = 640;
export const H = 480;

export function createGfx(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let ox = 0;
  let oy = 0;
  let dpr = 1;
  const sheets = {};

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    scale = Math.min(cw / W, ch / H);
    ox = (cw - W * scale) / 2;
    oy = (ch - H * scale) / 2;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`;
    canvas.style.height = `${ch}px`;
  }

  // The screen around the 4:3 game: a blurred, darkened copy of the scene's
  // backdrop rather than black bars (rebuilt only when it changes).
  let backdropName = '';
  let backdrop = null;
  function setBackdrop(name) {
    if (name === backdropName && backdrop && backdrop.width === canvas.width) return;
    backdropName = name;
    const a = assets.img[name];
    if (!a) return;
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    const g = c.getContext('2d');
    const k = Math.max(c.width / a.w, c.height / a.h) * 1.1;
    g.filter = `blur(${Math.round(18 * dpr)}px) brightness(0.55) saturate(1.2)`;
    g.drawImage(a.img, (c.width - a.w * k) / 2, (c.height - a.h * k) / 2, a.w * k, a.h * k);
    backdrop = c;
  }

  function begin(shake = { x: 0, y: 0 }) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    if (backdrop && backdrop.width === canvas.width && (ox > 1 || oy > 1)) ctx.drawImage(backdrop, 0, 0);
    else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (ox > 1 || oy > 1) {
      // A soft shadow around the game frame.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 30 * dpr;
      ctx.fillStyle = '#000';
      ctx.fillRect(ox * dpr, oy * dpr, W * scale * dpr, H * scale * dpr);
      ctx.restore();
    }
    const s = scale * dpr;
    ctx.setTransform(s, 0, 0, s, (ox + shake.x * scale) * dpr, (oy + shake.y * scale) * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
  }

  function end() {
    ctx.restore();
  }

  /** Screen point -> game point. */
  const toGame = (x, y) => ({ x: (x - ox) / scale, y: (y - oy) / scale });

  /** Register a sheet layout: name -> [file, cols, rows]. */
  function define(name, file, cols = 1, rows = 1) {
    sheets[name] = { file, cols, rows };
  }

  function info(name) {
    const d = sheets[name] ?? { file: name, cols: 1, rows: 1 };
    const a = assets.img[d.file];
    if (!a) return null;
    return { a, cols: d.cols, rows: d.rows, fw: a.w / d.cols, fh: a.h / d.rows, k: a.img.naturalWidth / a.w };
  }

  /**
   * Draw frame (col, row) of `name` with its top-left at (x, y), or centred
   * when `center`. `flip` mirrors it.
   */
  function frame(name, col, row, x, y, { center = true, flip = false, scale: s = 1, alpha = 1, rot = 0, add = false, blend = false, sx = 1 } = {}) {
    const f = info(name);
    if (!f) return false;
    // Blend between neighbouring animation frames for smooth motion.
    if (blend && f.cols > 1) {
      const fr = col - Math.floor(col);
      if (fr > 0.08) {
        frame(name, Math.floor(col), row, x, y, { center, flip, scale: s, alpha, rot, add, sx });
        return frame(name, Math.floor(col) + 1, row, x, y, { center, flip, scale: s, alpha: alpha * fr, rot, add, sx });
      }
    }
    const c = ((Math.floor(col) % f.cols) + f.cols) % f.cols;
    const r = Math.max(0, Math.min(f.rows - 1, Math.floor(row)));
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    if (add) ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.scale((flip ? -s : s) * sx, s);
    const dx = center ? -f.fw / 2 : 0;
    const dy = center ? -f.fh / 2 : 0;
    ctx.drawImage(f.a.img, c * f.fw * f.k, r * f.fh * f.k, f.fw * f.k, f.fh * f.k, dx, dy, f.fw, f.fh);
    ctx.restore();
    return true;
  }

  /** Draw a whole image at (x, y), top-left. */
  function image(name, x = 0, y = 0, opts = {}) {
    return frame(name, 0, 0, x, y, { center: false, ...opts });
  }

  /* ---------- Bitmap fonts ---------- */

  const tinted = new Map();
  function tint(img, color) {
    const key = img.src + color;
    if (tinted.has(key)) return tinted.get(key);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    // Multiply keeps dark outlines dark and turns white into the colour.
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'multiply';
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0);
    tinted.set(key, c);
    return c;
  }

  function measure(fontName, str) {
    const L = assets.font[fontName]?.layers?.Main;
    if (!L) return str.length * 8;
    let w = 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const g = L.chars[ch];
      w += g ? g.w : L.chars[' ']?.w ?? 6;
      if (i + 1 < str.length) w += L.kern[ch + str[i + 1]] ?? 0;
    }
    return w;
  }

  /**
   * Text in an original font. `align`: 'left' | 'center' | 'right'; `y` is the
   * baseline-ish top (the font's ascent is applied). `color` tints white fonts.
   */
  function text(fontName, str, x, y, { align = 'left', color = null, alpha = 1, maxWidth = 0 } = {}) {
    const def = assets.font[fontName];
    if (!def) return;
    str = String(str);
    let w = measure(fontName, str);
    ctx.save();
    if (maxWidth && w > maxWidth) {
      // Squeeze sideways to fit.
      const k = maxWidth / w;
      ctx.translate(x, 0);
      ctx.scale(k, 1);
      ctx.translate(-x, 0);
    }
    let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    if (alpha !== 1) ctx.globalAlpha *= alpha;
    for (const L of Object.values(def.layers)) {
      if (!L.img) continue;
      const k = L.scale ?? 1;
      const src = color ? tint(L.img, color) : L.img;
      let px = cx;
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        const g = L.chars[ch];
        if (g?.r) {
          const [rx, ry, rw, rh] = g.r;
          const [ox2, oy2] = g.o ?? [0, 0];
          ctx.drawImage(src, rx * k, ry * k, rw * k, rh * k, px + ox2, y + oy2, rw, rh);
        }
        px += g ? g.w : L.chars[' ']?.w ?? 6;
        if (i + 1 < str.length) px += L.kern[ch + str[i + 1]] ?? 0;
      }
    }
    ctx.restore();
  }

  /** Word-wrapped text; returns the height used. */
  function wrap(fontName, str, x, y, width, lineH, opts = {}) {
    const lines = [];
    for (const para of String(str).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (measure(fontName, next) > width && line) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
    }
    lines.forEach((l, i) => text(fontName, l, opts.align === 'center' ? x + width / 2 : x, y + i * lineH, opts));
    return lines.length * lineH;
  }

  addEventListener('resize', resize);
  resize();
  return { ctx, canvas, begin, end, toGame, define, info, frame, image, text, measure, wrap, setBackdrop, get scale() { return scale; }, get dpr() { return dpr; } };
}
