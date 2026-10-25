/**
 * Drawing with the original Insaniquarium art, when the player has loaded
 * their own copy (see original.js). Every function returns false when a sheet
 * is missing, and the renderer then draws its own art instead.
 *
 * The original sheets face left; turning plays the sheet's turn row, from
 * facing left (first frame) to facing right (last frame).
 */

import { original } from './original.js';

// The tank for each world, and the shop bar's slots.
const TANKS = ['aquarium1', 'aquarium4', 'aquarium2', 'aquarium5', 'aquarium6'];
const SEVEN = [47, 116, 173, 246, 319, 392, 465];
const EIGHT = Array.from({ length: 8 }, (_, i) => 22 + i * 59.7);
export const ART_MENU = { x: 528, y: 6, w: 100, h: 28 };
export const ART_MONEY = { x: 545, y: 39, w: 78, h: 21 };

/** Slot `i` of `n` on the original bar (seven slots, or eight on the rebuilt one). */
export function artSlotRect(i, n) {
  if (n > 7) return { x: EIGHT[i], y: 1, w: 50, h: 63, glass: 23, label: 51 };
  return { x: SEVEN[i] - 27, y: 2, w: 54, h: 62, glass: 25, label: 54 };
}

/** Which rows each fish uses: [sheet, row] per pose. */
function fishArt(f) {
  switch (f.kind) {
    case 'guppy':
    case 'carnivore': {
      const r = f.kind === 'carnivore' ? 4 : Math.min(3, f.stage);
      return { swim: ['swim', r], turn: ['turn', r], eat: ['eat', r], hswim: ['hswim', r], hturn: ['hturn', r], heat: ['heat', r], die: ['die', r] };
    }
    case 'breeder':
      return { swim: ['breeder', 3], turn: ['breeder', 4], eat: ['breeder', 5], hswim: ['hbreeder', 3], hturn: ['hbreeder', 4], heat: ['hbreeder', 5], die: ['hbreeder', 10] };
    case 'leviathan':
      return { swim: ['ultra', 0], eat: ['ultra', 1], turn: ['ultra', 2], die: ['ultra', 3] };
    case 'grubber':
      return { swim: ['grubber', 0], turn: ['grubber', 1], hswim: ['grubber', 2], die: ['grubber', 3], hturn: ['grubber', 4], dy: -18 };
    case 'muncher':
      return { swim: ['gekko', 0], turn: ['gekko', 1], eat: ['gekko', 2], hswim: ['gekko', 3], hturn: ['gekko', 4], die: ['gekko', 5], heat: ['gekko', 6] };
    case 'starcatcher':
      return { swim: ['starcatcher', 0], hswim: ['starcatcher', 1], die: ['starcatcher', 2], still: true, dy: -18 };
    default:
      return null;
  }
}

// Pets: the original pet that looks most like ours.
const PET_ART = {
  snail: { sheet: 'stinky', icon: 'scl_stinky', dy: -26 },
  clam: { sheet: 'niko', icon: 'scl_niko', still: true, dy: -24 },
  puffer: { sheet: 'zorf', icon: 'scl_zorf' },
  seahorse: { sheet: 'clyde', icon: 'scl_clyde', still: true },
  turtle: { sheet: 'seymour', icon: 'scl_seymour' },
  octopus: { sheet: 'itchy', icon: 'scl_itchy' },
  angel: { sheet: 'angie', icon: 'scl_angie' },
  eel: { sheet: 'amp', icon: 'scl_amp' },
  jelly: { sheet: 'meryl', icon: 'scl_meryl' },
  crab: { sheet: 'rufus', icon: 'scl_rufus', dy: -26 },
};

const ALIEN_ART = {
  gobbler: { sheet: 'sylv' },
  grinder: { sheet: 'balrog' },
  twins: { sheet: 'smallsylv' },
  glutton: { sheet: 'gus', eat: 2 },
  bomber: { sheet: 'destructor', dy: -20 },
  mirror: { sheet: 'psychosquid' },
};

const COIN_ROW = { silver: 0, gold: 1, star: 2, diamond: 3, chest: 4, grub: 5 };

export function createOriginalArt(getCtx) {
  const turns = new WeakMap(); // alien -> { face, t }
  let bar8 = null;

  const ready = () => original.ready;

  /** One frame of a sheet, centred at (x, y). */
  function frame(name, row, col, x, y, { flip = false, scale = 1 } = {}) {
    const s = original.sheet(name);
    if (!s) return false;
    const ctx = getCtx();
    const c = ((Math.floor(col) % s.cols) + s.cols) % s.cols;
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(x, y);
    ctx.scale(flip ? -scale : scale, scale);
    ctx.drawImage(s.canvas, c * s.fw, Math.min(row, s.rows - 1) * s.fh, s.fw, s.fh, -s.fw / 2, -s.fh / 2, s.fw, s.fh);
    ctx.restore();
    return true;
  }

  /* ---------- Tank ---------- */

  function background(g, worldIndex) {
    const s = original.sheet(TANKS[worldIndex % TANKS.length]) ?? original.sheet('aquarium1');
    if (!s) return false;
    g.drawImage(s.canvas, 0, 0, 640, 480);
    return true;
  }

  /* ---------- Fish ---------- */

  function fish(f, t, world) {
    const art = fishArt(f);
    if (!art) return false;
    const ctx = getCtx();
    const hungry = !f.dead && world.isHungry(f);
    const pose = (k) => (hungry && art[`h${k}`]) || art[k];
    const anim = t / 3 + f.phase * 10;
    const y = f.y + (art.dy ?? 0);
    let x = f.x;
    if (hungry && f.starveAt - world.time < 600) x += Math.sin(t * 1.3) * 1.2;
    ctx.save();
    if (f.bornT < 40) {
      const k = 0.6 + 0.4 * (f.bornT / 40);
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.translate(-x, -y);
    }
    let ok;
    if (f.dead) {
      const [s, r] = art.die;
      ok = frame(s, r, Math.min(9, f.deadT / 5), x, y, { flip: f.face > 0 });
    } else if (art.still) {
      const [s, r] = pose('swim');
      ok = frame(s, r, anim, x, y);
    } else if (Math.abs(f.turn) < 0.9 && pose('turn')) {
      const [s, r] = pose('turn');
      ok = frame(s, r, Math.round(((f.turn + 1) / 2) * 9), x, y);
    } else if (f.eatT > 0 && pose('eat')) {
      const [s, r] = pose('eat');
      ok = frame(s, r, Math.min(9, ((16 - f.eatT) / 16) * 10), x, y, { flip: f.turn > 0 });
    } else {
      const [s, r] = pose('swim');
      ok = frame(s, r, anim, x, y, { flip: f.turn > 0 });
    }
    ctx.restore();
    return ok;
  }

  /* ---------- Coins and food ---------- */

  function coin(type, x, y, spin = 0, scale = 1) {
    if (type === 'pearl') return frame('pearl', 0, 0, x, y, { scale: 0.55 * scale });
    const row = COIN_ROW[type];
    if (row === undefined) return false;
    return frame('money', row, spin, x, y, { scale });
  }

  function food(p, t) {
    if (p.kind === 'grub') return frame('money', COIN_ROW.grub, t / 4 + p.id, p.x, p.y, { scale: 0.8 });
    const row = p.kind === 'potion' ? 3 : Math.min(2, p.level ?? 0);
    return frame('food', row, t / 4 + p.id, p.x, p.y);
  }

  /* ---------- Pets ---------- */

  function pet(p, t) {
    const art = PET_ART[p.kind];
    if (!art) return false;
    const y = p.y + (art.dy ?? 0);
    const anim = t / 3;
    if (p.kind === 'clam') return p.open ? frame('niko', 1, Math.min(9, anim % 30), p.x, y) : frame('niko', 0, 0, p.x, y);
    if (p.kind === 'snail' && !p.walking) return frame('stinky', 0, 0, p.x, y, { flip: p.face > 0 });
    if (p.kind === 'eel') {
      // Amp's charge is drawn on top, glowing.
      const ok = frame('amp', 0, anim, p.x, y, { flip: p.face > 0 });
      const ctx = getCtx();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      frame('ampcharge', 0, anim, p.x, y, { flip: p.face > 0 });
      ctx.restore();
      return ok;
    }
    return frame(art.sheet, 0, anim, p.x, y, { flip: !art.still && p.face > 0 });
  }

  /* ---------- Aliens ---------- */

  function alien(a, t) {
    const art = ALIEN_ART[a.kind];
    if (!art || !original.sheet(art.sheet)) return false;
    const ctx = getCtx();
    let st = turns.get(a);
    if (!st) turns.set(a, (st = { face: a.face, t: 99 }));
    if (st.face !== a.face) {
      st.face = a.face;
      st.t = 0;
    }
    st.t++;
    const y = a.y + (art.dy ?? 0);
    // Psychosquid's blue rows are its shield; turning uses the row after each swim row.
    const base = a.kind === 'mirror' && a.shield ? 2 : 0;
    const draw = () => {
      if (st.t < 20) return frame(art.sheet, base + 1, a.face > 0 ? st.t / 2 : 9 - st.t / 2, a.x, y);
      if (art.eat && a.chomp > 0) return frame(art.sheet, art.eat, (20 - a.chomp) / 2, a.x, y, { flip: a.face > 0 });
      return frame(art.sheet, base, t / 3, a.x, y, { flip: a.face > 0 });
    };
    draw();
    if (a.hitT > 0 && a.hitT % 4 < 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      draw();
      ctx.restore();
    }
    return true;
  }

  /** Where an alien's health bar goes: just above its sprite. */
  function alienTop(a) {
    const art = ALIEN_ART[a.kind];
    const s = art && original.sheet(art.sheet);
    return s ? a.y + (art.dy ?? 0) - s.fh * 0.42 : null;
  }

  /** The original health tube over an alien. */
  function healthBar(x, top, frac, color) {
    const tube = original.sheet('healthtube');
    const fill = original.sheet('healthbar');
    if (!tube || !fill) return false;
    const ctx = getCtx();
    const w = tube.fw;
    const left = x - w / 2;
    ctx.drawImage(tube.canvas, left, top);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w * Math.max(0, Math.min(1, frac)), tube.fh);
    ctx.clip();
    if (color) {
      ctx.drawImage(fill.canvas, left, top);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(left, top, w, tube.fh);
    } else ctx.drawImage(fill.canvas, left, top);
    ctx.restore();
    return true;
  }

  function bomb(b) {
    const s = original.sheet('missile');
    if (!s) return false;
    // Sixteen directions: the first points right, then turning anticlockwise.
    const k = Math.round((-Math.atan2(b.vy, b.vx) / (Math.PI * 2)) * 16);
    return frame('missile', 0, k, b.x, b.y);
  }

  /* ---------- Shop bar ---------- */

  /** The bar rebuilt with eight slots, from the original's own pieces. */
  function eightSlotBar() {
    if (bar8) return bar8;
    const mb = original.sheet('menubar').canvas;
    const c = document.createElement('canvas');
    c.width = mb.width;
    c.height = mb.height;
    const g = c.getContext('2d');
    g.drawImage(mb, 0, 0);
    for (let x = 22; x < 492; x += 10) g.drawImage(mb, 78, 0, 10, 75, x, 0, 10, 75);
    for (const x of EIGHT) g.drawImage(mb, 22, 0, 54, 68, Math.round(x), 1, 50, 63);
    return (bar8 = c);
  }
  original.onChange(() => {
    bar8 = null;
  });

  // Shop icons: [sheet, row, col, scale].
  function iconArt(id, level) {
    switch (id) {
      case 'guppy':
        return ['swim', 1, 0, 0.8];
      case 'carnivore':
        return ['swim', 4, 0, 0.62];
      case 'breeder':
        return ['scl_breeder', 0, 0, 1];
      case 'starcatcher':
        return ['scl_starcatcher', 0, 0, 1];
      case 'grubber':
        return ['scl_grubber', 0, 0, 1];
      case 'muncher':
        return ['scl_gekko', 0, 0, 1];
      case 'leviathan':
        return ['scl_ultra', 0, 0, 1];
      case 'potion':
        return ['food', 3, 0, 1];
      case 'quality':
        return ['food', Math.min(2, (level ?? 0) + 1), 0, 1.15];
      case 'count':
        return ['food', 0, 0, 1.15];
      case 'weapon':
        return ['guns', 0, Math.min(9, (level ?? 0) + 1), 0.95];
      case 'egg':
        return ['eggpieces', 0, Math.min(2, level ?? 0), 0.95];
      default:
        if (PET_ART[id]) return [PET_ART[id].icon, 0, 0, id === 'eel' ? 0.75 : 0.75];
        if (ALIEN_ART[id]) return [ALIEN_ART[id].sheet, 0, 0, id === 'twins' ? 0.6 : 0.33];
        return null;
    }
  }

  function icon(id, cx, cy, s = 1, level = 0) {
    const a = iconArt(id, level);
    if (!a) return false;
    return frame(a[0], a[1], a[2], cx, cy, { scale: a[3] * s });
  }

  function bar(ui, t, text) {
    const mb = original.sheet('menubar');
    if (!mb) return false;
    const ctx = getCtx();
    const n = ui.shop.length;
    ctx.drawImage(n > 7 ? eightSlotBar() : mb.canvas, 0, 0);
    ui.shop.forEach((item, i) => {
      const r = artSlotRect(i, n);
      const cx = r.x + r.w / 2;
      const dy = ui.pressed === i ? 1 : 0;
      if (ui.hover === i && !item.maxed) {
        const g = ctx.createRadialGradient(cx, r.glass, 4, cx, r.glass, 24);
        g.addColorStop(0, 'rgba(255,255,220,0.75)');
        g.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 26, r.glass - 24, 52, 48);
      }
      ctx.globalAlpha = item.maxed ? 0.45 : item.affordable ? 1 : 0.6;
      const bob = ui.hover === i ? Math.sin(t / 8) * 1.5 : 0;
      if (item.id === 'more') text('MORE', cx, r.glass + dy, 15, '#ffffff', { lw: 3.5 });
      else icon(item.id, cx, r.glass + dy + bob, 1, item.level ?? 0);
      ctx.globalAlpha = 1;
      if (item.id === 'more') return;
      const price = item.maxed ? 'MAX' : `$${item.cost.toLocaleString('en-US')}`;
      text(price, cx, r.label + dy, item.cost >= 1000 ? 12 : 14, item.maxed ? '#c9c2e8' : item.affordable ? '#ffe14d' : '#ff9a8a', { lw: 3 });
      if (item.id === 'count') text(`${item.level}`, cx + 15, r.glass + 12 + dy, 13, '#ffffff', { lw: 3 });
      if (item.id === 'egg') text(`${item.level}/3`, cx + 14, r.glass + 13 + dy, 12, '#ffffff', { lw: 3 });
      if (ui.flashSlot === i) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(cx, r.glass, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (ui.hover === 'menu') {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(ART_MENU.x + 8, ART_MENU.y + 4, ART_MENU.w - 16, ART_MENU.h - 8);
    }
    const flash = ui.moneyFlash > 0 && Math.floor(ui.moneyFlash / 4) % 2;
    const money = `${Math.round(ui.money).toLocaleString('en-US')}`;
    text(money, ART_MONEY.x + ART_MONEY.w - 6, ART_MONEY.y + ART_MONEY.h / 2 + 1, money.length > 7 ? 14 : 17, flash ? '#ff6b6b' : '#c6ff7a', { align: 'right', lw: 3.5 });
    return true;
  }

  return { ready, background, fish, coin, food, pet, alien, alienTop, healthBar, bomb, bar, icon };
}
