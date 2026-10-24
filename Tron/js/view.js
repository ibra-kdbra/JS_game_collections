import { WALL, DIRS } from './board.js';

export const COLORS = {
  1: { trail: '#2f6bff', glow: '#8fb4ff' },
  2: { trail: '#ff4500', glow: '#ffa27a' },
  wall: '#123a4d',
  wallEdge: '#5ec4f2',
  grid: 'rgba(94, 196, 242, 0.09)',
  bg: '#000',
};

// Canvas renderer. Trails are painted once into an offscreen layer as bikes
// move, so each frame is a couple of blits plus the two glowing heads.
export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.trails = document.createElement('canvas');
    this.tctx = this.trails.getContext('2d');
    this.round = null;
    this.cell = 1;
    this.flash = [];
  }

  // Size the canvas to fit (availW x availH) CSS pixels with whole device pixels per cell.
  // The backing store is capped at 2 device pixels per CSS pixel: sharper is invisible on
  // a phone and only costs fill rate.
  fit(availW, availH) {
    if (!this.round) return;
    const { w, h } = this.round.board;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cell = Math.max(2, Math.floor(Math.min((availW * dpr) / w, (availH * dpr) / h)));
    if (cell === this.cell && this.canvas.width === cell * w && this.canvas.height === cell * h) return;
    this.cell = cell;
    this.canvas.width = this.trails.width = cell * w;
    this.canvas.height = this.trails.height = cell * h;
    this.canvas.style.width = `${(cell * w) / dpr}px`;
    this.canvas.style.height = `${(cell * h) / dpr}px`;
    this.repaint();
  }

  setRound(round) {
    this.round = round;
    this.flash = [];
    this.cell = 0;
  }

  repaint() {
    const { board } = this.round;
    const { tctx, cell } = this;
    tctx.fillStyle = COLORS.bg;
    tctx.fillRect(0, 0, this.trails.width, this.trails.height);
    tctx.strokeStyle = COLORS.grid;
    tctx.lineWidth = 1;
    tctx.beginPath();
    for (let x = 0; x <= board.w; x += 4) {
      tctx.moveTo(x * cell + 0.5, 0);
      tctx.lineTo(x * cell + 0.5, this.trails.height);
    }
    for (let y = 0; y <= board.h; y += 4) {
      tctx.moveTo(0, y * cell + 0.5);
      tctx.lineTo(this.trails.width, y * cell + 0.5);
    }
    tctx.stroke();
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const v = board.cells[board.index(x, y)];
        if (v) this.paintCell(x, y, v);
      }
    }
  }

  paintCell(x, y, id) {
    const { tctx, cell } = this;
    if (id === WALL) {
      tctx.fillStyle = COLORS.wall;
      tctx.fillRect(x * cell, y * cell, cell, cell);
      tctx.fillStyle = COLORS.wallEdge;
      const inset = Math.max(1, cell >> 2);
      tctx.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
      return;
    }
    tctx.fillStyle = COLORS[id].trail;
    tctx.fillRect(x * cell, y * cell, cell, cell);
  }

  draw(now, overlayText, intro = false) {
    const { ctx, canvas, round, cell } = this;
    if (!round) return;
    for (const m of round.moved) this.paintCell(m.x, m.y, m.id);
    round.moved.length = 0;
    for (const c of round.crashes) this.flash.push({ ...c, t0: now });
    round.crashes.length = 0;

    ctx.drawImage(this.trails, 0, 0);

    for (const bike of [round.blue, round.orange]) {
      const cx = (bike.x + 0.5) * cell;
      const cy = (bike.y + 0.5) * cell;
      const color = COLORS[bike.id];
      if (intro) this.drawIntro(bike, cx, cy, now);
      ctx.save();
      ctx.shadowColor = color.glow;
      ctx.shadowBlur = cell * (bike.boosting ? 5 : 3);
      ctx.fillStyle = bike.alive ? '#fff' : color.trail;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * (bike.boosting ? 1.1 : 0.85), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    this.flash = this.flash.filter((f) => now - f.t0 < 700);
    for (const f of this.flash) {
      const k = (now - f.t0) / 700;
      ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
      ctx.lineWidth = Math.max(1, cell * 0.6);
      ctx.beginPath();
      ctx.arc((f.x + 0.5) * cell, (f.y + 0.5) * cell, cell * (1 + k * 8), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (overlayText) {
      const size = Math.min(canvas.width, canvas.height) * 0.28;
      ctx.save();
      ctx.font = `${Math.round(size)}px Audiowide, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.shadowColor = COLORS.wallEdge;
      ctx.shadowBlur = size * 0.25;
      ctx.fillText(overlayText, canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  }

  // Before the start: a pulsing ring in the player's colour and an arrow showing the heading.
  drawIntro(bike, cx, cy, now) {
    const { ctx, cell } = this;
    const color = COLORS[bike.id].trail;
    const pulse = 0.5 + 0.5 * Math.sin(now / 160);
    const d = DIRS[bike.dir];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = Math.max(2, cell * 0.5);
    ctx.globalAlpha = 0.5 + 0.5 * pulse;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * (3 + pulse), 0, Math.PI * 2);
    ctx.stroke();
    ctx.translate(cx + d.x * cell * 6, cy + d.y * cell * 6);
    ctx.rotate(Math.atan2(d.y, d.x));
    ctx.beginPath();
    ctx.moveTo(cell * 2, 0);
    ctx.lineTo(-cell, -cell * 1.6);
    ctx.lineTo(-cell, cell * 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
