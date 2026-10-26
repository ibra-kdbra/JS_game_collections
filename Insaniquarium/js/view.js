/**
 * Draws a tank: the aquarium, fish, food, coins, pets, aliens, missiles,
 * effects and the brass shop bar, all with the original art.
 */
import { TANK, FISH, ALIENS, COINS, FOOD, BAR } from './data.js';
import { createPolish } from './polish.js';

// Sheet layouts: name -> [file, cols, rows].
const SHEETS = {
  swim: ['smallswim', 10, 5],
  turn: ['smallturn', 10, 5],
  eat: ['smalleat', 10, 5],
  die: ['smalldie', 10, 5],
  hswim: ['hungryswim', 10, 5],
  hturn: ['hungryturn', 10, 5],
  heat: ['hungryeat', 10, 5],
  breeder: ['breeder', 10, 9],
  hbreeder: ['hungrybreeder', 10, 12],
  ultravore: ['ultravore', 10, 4],
  grubber: ['grubgrubber', 10, 5],
  gekko: ['gekko', 10, 7],
  starcatcher: ['starcatcher', 10, 3],
  money: ['money', 10, 6],
  food: ['food', 10, 5],
  misc: ['miscitems', 3, 1],
  sylv: ['sylv', 10, 2],
  balrog: ['balrog', 10, 2],
  smallsylv: ['smallsylv', 10, 2],
  gus: ['gus', 10, 3],
  destructor: ['destructor', 10, 2],
  ulysses: ['ulysses', 10, 3],
  psychosquid: ['psychosquid', 10, 5],
  boss: ['boss', 10, 2],
  missile: ['missile', 16, 1],
  warphole: ['warphole', 17, 1],
  warpglow: ['warpglow', 17, 1],
  explosion: ['explosion', 10, 1],
  explosionsmall: ['explosionsmall', 10, 1],
  lasers: ['lasers', 10, 6],
  chomp: ['chomp', 5, 1],
  bubbles: ['bubbles', 5, 1],
  sparkle: ['sparkle', 14, 1],
  guns: ['lazergunz', 10, 1],
  eggpieces: ['eggpieces', 3, 1],
  ampcharge: ['ampcharge', 10, 2],
  gumbolight: ['gumbolight', 10, 2],
  halo: ['halo', 10, 2],
  stinky: ['stinky', 10, 3],
  niko: ['niko', 10, 3],
  itchy: ['itchy', 10, 4],
  prego: ['prego', 10, 4],
  zorf: ['zorf', 10, 3],
  clyde: ['clyde', 10, 1],
  vert: ['vert', 10, 2],
  rufus: ['rufus', 10, 2],
  meryl: ['meryl', 10, 4],
  wadsworth: ['wadsworth', 10, 3],
  seymour: ['seymour', 10, 2],
  shrapnel: ['shrapnel', 10, 2],
  gumbo: ['gumbo', 10, 2],
  blip: ['blip', 10, 2],
  rhubarb: ['rhubarb', 10, 2],
  nimbus: ['nimbus', 10, 2],
  amp: ['amp', 10, 2],
  gash: ['gash', 10, 3],
  angie: ['angie', 10, 2],
  presto: ['presto', 10, 3],
  brinkley: ['brink', 10, 2],
  nostradamus: ['nostradamus', 10, 2],
  stanley: ['stanley', 10, 6],
  walter: ['walter', 10, 3],
  balls: ['balls', 10, 4],
  bilaterus: ['bilaterus', 10, 8],
};
for (const id of ['stinky', 'niko', 'itchy', 'prego', 'zorf', 'clyde', 'vert', 'rufus', 'meryl', 'wadsworth', 'seymour', 'shrapnel', 'gumbo', 'blip', 'rhubarb', 'nimbus', 'amp', 'gash', 'angie', 'presto', 'breeder', 'starcatcher', 'grubber', 'gekko', 'ultra']) {
  SHEETS[`scl_${id}`] = [`scl_${id}`, 10, 1];
}
for (const [id, file] of [['brinkley', 'brink'], ['nostradamus', 'nostradamus'], ['stanley', 'stanley'], ['walter', 'walter']]) SHEETS[`scl_${id}`] = [`scl_${file}`, 10, 1];

/** Rows each fish uses per pose: [sheet, row]. */
function fishArt(f) {
  switch (f.kind) {
    case 'guppy':
    case 'carnivore': {
      const r = f.kind === 'carnivore' ? 4 : Math.min(3, f.stage);
      return { swim: ['swim', r], turn: ['turn', r], eat: ['eat', r], hswim: ['hswim', r], hturn: ['hturn', r], heat: ['heat', r], die: ['die', r] };
    }
    case 'breeder':
      return { swim: ['breeder', 3], turn: ['breeder', 4], eat: ['breeder', 5], hswim: ['hbreeder', 3], hturn: ['hbreeder', 4], heat: ['hbreeder', 5], die: ['hbreeder', 10] };
    case 'ultravore':
      return { swim: ['ultravore', 0], eat: ['ultravore', 1], turn: ['ultravore', 2], die: ['ultravore', 3] };
    case 'guppycruncher':
      return { swim: ['grubber', 0], turn: ['grubber', 1], hswim: ['grubber', 2], die: ['grubber', 3], hturn: ['grubber', 4], dy: -16 };
    case 'beetlemuncher':
      return { swim: ['gekko', 0], turn: ['gekko', 1], eat: ['gekko', 2], hswim: ['gekko', 3], hturn: ['gekko', 4], die: ['gekko', 5], heat: ['gekko', 6] };
    case 'starcatcher':
      return { swim: ['starcatcher', 0], hswim: ['starcatcher', 1], die: ['starcatcher', 2], still: true, dy: -16 };
  }
  return null;
}

// Pets: rows for swimming, turning and their special move; `dy` lifts floor pets.
const PET_ART = {
  stinky: { swim: 0, turn: 1, dy: -22 },
  niko: { still: true, dy: -22 },
  itchy: { swim: 0, turn: 1, act: 2, actTurn: 3 },
  prego: { swim: 0, turn: 1 },
  zorf: { swim: 0, turn: 1, act: 2 },
  clyde: { still: true },
  vert: { swim: 0, turn: 1 },
  rufus: { swim: 0, turn: 1, act: 1, dy: -22 },
  meryl: { swim: 0, turn: 1, act: 2 },
  wadsworth: { swim: 0, turn: 1, act: 2 },
  seymour: { swim: 0, turn: 1 },
  shrapnel: { swim: 0, turn: 1 },
  gumbo: { swim: 0, turn: 1 },
  blip: { swim: 0, turn: 1 },
  rhubarb: { swim: 0, turn: 1, act: 1, dy: -22 },
  nimbus: { swim: 0, turn: 1 },
  amp: { swim: 0, turn: 1 },
  gash: { swim: 0, turn: 1, act: 2 },
  angie: { swim: 0, turn: 1 },
  presto: { swim: 0, turn: 1 },
  brinkley: { swim: 0, turn: 1 },
  nostradamus: { swim: 0, turn: 1 },
  stanley: { swim: 0, turn: 1 },
  walter: { swim: 0, turn: 1 },
};

const ALIEN_ROWS = { psychosquid: { swim: 0, turn: 1, shieldSwim: 2, shieldTurn: 3 }, gus: { eat: 2 }, ulysses: { act: 2 } };

// Bar slots: the original seven, or eight rebuilt from the same pieces.
const SEVEN = [47, 116, 173, 246, 319, 392, 465];
const EIGHT = Array.from({ length: 8 }, (_, i) => 22 + i * 59.7);
export const MENU_BTN = { x: 528, y: 6, w: 100, h: 28 };
export const MONEY_BOX = { x: 545, y: 39, w: 78, h: 21 };
export function slotRect(i, n) {
  if (n > 7) return { x: EIGHT[i], y: 1, w: 50, h: 63, glass: 23, label: 51 };
  return { x: SEVEN[i] - 27, y: 2, w: 54, h: 62, glass: 25, label: 54 };
}

export function createView(gfx) {
  for (const [name, [file, c, r]] of Object.entries(SHEETS)) gfx.define(name, file, c, r);
  const { ctx } = gfx;
  const polish = createPolish(gfx);
  const turners = new WeakMap();
  let bar8 = null;

  /** Turn animation: when facing changes, play the turn row through. */
  function turning(o, face) {
    let st = turners.get(o);
    if (!st) turners.set(o, (st = { face, t: 99 }));
    if (st.face !== face) {
      st.face = face;
      st.t = 0;
    }
    st.t++;
    return st.t < 20 ? (face > 0 ? st.t / 2 : 9 - st.t / 2) : null;
  }

  /* ---------- Fish ---------- */

  function fish(f, t, tank) {
    const art = fishArt(f);
    if (!art) return;
    if (f.hidden) return;
    const hungry = !f.dead && tank.isHungry(f);
    const pose = (k) => (hungry && art[`h${k}`]) || art[k];
    const anim = (t / 3 + f.phase * 10) % 10;
    let x = f.x;
    const y = f.y + (art.dy ?? 0);
    if (hungry && f.starveAt - tank.time < 300) x += Math.sin(t * 1.3) * 1.2;
    ctx.save();
    if (f.bornT < 40) {
      const k = 0.5 + 0.5 * (f.bornT / 40);
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.translate(-x, -y);
    }
    if (f.dead) {
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, f.deadT - 150) / 90);
      const [s, r] = art.die;
      gfx.frame(s, Math.min(9, f.deadT / 5), r, x, y, { flip: f.face > 0, blend: f.deadT < 45 });
      ctx.restore();
      return;
    }
    if (art.still) {
      const [s, r] = pose('swim');
      gfx.frame(s, anim, r, x, y, { blend: true });
    } else if (Math.abs(f.turn) < 0.9 && pose('turn')) {
      const [s, r] = pose('turn');
      gfx.frame(s, Math.min(9, ((f.turn + 1) / 2) * 9), r, x, y, { blend: true });
    } else {
      // Tilt with the climb or dive, and breathe a little.
      const tilt = Math.max(-0.32, Math.min(0.32, (f.vy ?? 0) * 0.22)) * (f.turn > 0 ? 1 : -1);
      const breathe = 1 + Math.sin(t / 9 + f.phase) * 0.012;
      if (f.eatT > 0 && pose('eat')) {
        const [s, r] = pose('eat');
        gfx.frame(s, Math.min(9, ((20 - f.eatT) / 20) * 10), r, x, y, { flip: f.turn > 0, rot: tilt, blend: true });
      } else {
        const [s, r] = pose('swim');
        gfx.frame(s, anim, r, x, y, { flip: f.turn > 0, rot: tilt, blend: true, scale: breathe });
      }
    }
    ctx.restore();
  }

  /* ---------- Coins, food ---------- */

  const GLOW = { diamond: 'rgba(120,230,255,A)', star: 'rgba(255,240,120,A)', chest: 'rgba(255,200,90,A)', pearl: 'rgba(255,230,255,A)', gold: 'rgba(255,210,80,A)' };
  function coin(c, t, scale = 1) {
    if (GLOW[c.type]) polish.glow(c.x, c.y, (c.type === 'gold' ? 18 : 30) * scale, GLOW[c.type], (c.type === 'gold' ? 0.22 : 0.4) + 0.12 * Math.sin(t / 8 + c.id));
    if (c.type === 'pearl') return gfx.frame('pearl', 0, 0, c.x, c.y, { scale: 0.5 * scale });
    if (c.type === 'bomb') return gfx.frame('misc', 0, 0, c.x, c.y, { scale });
    const row = COINS[c.type].row;
    const spin = c.type === 'beetle' ? t / 3 + c.id : c.floorT > 0 && c.type !== 'chest' && c.type !== 'diamond' ? (t / 3 + c.spin) : t / 3 + c.spin;
    const fading = c.type !== 'chest' && c.type !== 'beetle' && c.floorT > 300 && Math.floor(t / 4) % 2;
    gfx.frame('money', spin % 10, row, c.x, c.y, { scale, alpha: fading ? 0.4 : 1, blend: true });
  }

  function food(p, t) {
    const row = p.kind === 'potion' ? 3 : Math.min(2, p.quality ?? 0);
    gfx.frame('food', t / 4 + p.id, row, p.x, p.y);
  }

  /* ---------- Pets ---------- */

  function pet(p, t, tank) {
    const kind = p.as ?? p.kind;
    const art = PET_ART[kind];
    if (!art) return;
    const y = p.y + (art.dy ?? 0);
    const anim = t / 3;
    if (kind === 'niko') {
      if (p.pearl) gfx.frame('niko', Math.min(9, ((t % 600) / 60) * 10 + 9), 1, p.x, y);
      else gfx.frame('niko', 0, 0, p.x, y);
      return;
    }
    if (art.still) return gfx.frame(kind, anim, 0, p.x, y);
    if (kind === 'stanley' && p.state > 0 && p.state < 10) return gfx.frame('stanley', p.state, 5, p.x, y, { flip: p.face > 0 });
    if (kind === 'walter' && p.punch > 0) return walterPunch(p, y);
    if (kind === 'stinky' && !p.walking) return gfx.frame('stinky', 0, 0, p.x, y, { flip: p.face > 0 });
    const k = turning(p, p.face);
    // Stanley's fierce form uses the lower rows.
    const fierce = kind === 'stanley' && p.state >= 10 ? 2 : 0;
    if (k !== null && art.turn !== undefined) gfx.frame(kind, k, art.turn + fierce, p.x, y);
    else {
      let row = art.swim + fierce;
      if (art.act !== undefined && ((kind === 'itchy' || kind === 'gash') && p.state)) row = art.act;
      if (kind === 'zorf' && p.state > 0) row = art.act;
      if (kind === 'meryl' && tank.singing > 0) row = art.act;
      if (kind === 'wadsworth' && p.state) row = art.act;
      gfx.frame(kind, anim, row, p.x, y, { flip: p.face > 0 });
    }
    if (kind === 'gumbo' && tank.aliens.length) gfx.frame('gumbolight', anim, 0, p.x, y, { flip: p.face > 0, add: true });
    if (kind === 'amp' && p.charged) gfx.frame('ampcharge', anim, 0, p.x, y, { flip: p.face > 0, add: true });
    if (kind === 'meryl' && tank.singing > 0) {
      const k2 = (t % 60) / 60;
      gfx.frame('misc', 1, 0, p.x + 20 + k2 * 20, y - 20 - k2 * 30, { alpha: 1 - k2 });
    }
    if (kind === 'presto' && p.morphT > 0) gfx.frame('presto', 9 - p.morphT / 3, 2, p.x, y);
  }

  /** Walter's punch: the wind-up, then the glove out on its spring and back. */
  function walterPunch(p, y) {
    const k = 1 - p.punch / 18;
    const flip = p.face > 0;
    gfx.frame('walter', Math.min(4, k * 8), 2, p.x, y, { flip });
    const ext = Math.max(0, Math.sin(Math.min(1, k * 1.3) * Math.PI)) * 60;
    if (ext < 4) return;
    gfx.frame('walter', 6 + Math.min(3, Math.floor(ext / 16)), 2, p.x + p.face * (20 + ext * 0.45), y + 4, { flip });
    gfx.frame('walter', 5, 2, p.x + p.face * (30 + ext), y + 4, { flip });
  }

  function ball(b, t) {
    gfx.frame('balls', t / 2 + b.id, b.kind, b.x, b.y, { scale: 0.5 });
  }

  /* ---------- Aliens ---------- */

  /** Bilaterus: bones from tail to head, a pointy head at one end and a round one at the other. */
  function bilaterus(a, t) {
    const body = a.body;
    const n = body.length;
    const half = a.maxHp / 2;
    for (let i = 1; i < n - 1; i++) {
      const dx = body[i - 1].x - body[i + 1].x;
      const l = Math.hypot(dx, body[i - 1].y - body[i + 1].y) || 1;
      gfx.frame('bilaterus', Math.round(((dx / l + 1) / 2) * 9), 6 + (i % 2), body[i].x, body[i].y, { scale: 0.8 });
    }
    [0, n - 1].forEach((at, head) => {
      const e = body[at];
      const next = body[head === 0 ? 1 : n - 2];
      const alive = a.heads[head].hp > 0;
      const base = head === 0 ? 0 : 3;
      const flip = e.x > next.x;
      const leading = head === a.lead;
      if (!alive) return gfx.frame('bilaterus', 0, 6, e.x, e.y, { alpha: 0.6 });
      const row = leading && a.chomp > 0 ? base + 2 : base;
      gfx.frame('bilaterus', t / 3 + head * 5, row, e.x, e.y, { flip });
      if (a.hitT > 0 && a.hitT % 4 < 2) {
        ctx.save();
        ctx.globalAlpha = 0.6;
        gfx.frame('bilaterus', t / 3 + head * 5, row, e.x, e.y, { flip, add: true });
        ctx.restore();
      }
      healthBar(e.x, e.y - 60, a.heads[head].hp / half);
    });
  }

  function alien(a, t) {
    const spec = ALIENS[a.kind];
    if (spec.heads) return bilaterus(a, t);
    const sheet = spec.sheet;
    const rows = ALIEN_ROWS[a.kind] ?? {};
    const base = a.kind === 'psychosquid' && a.shield ? 2 : 0;
    const k = turning(a, a.face);
    const y = a.y + (spec.floor ? -20 : 0);
    const draw = (add = false) => {
      if (k !== null) gfx.frame(sheet, k, base + 1, a.x, y, { add });
      else if (rows.eat && a.chomp > 0) gfx.frame(sheet, (16 - a.chomp) / 1.6, rows.eat, a.x, y, { flip: a.face > 0, add });
      else if (rows.act && a.chomp > 0) gfx.frame(sheet, (20 - a.chomp) / 2, rows.act, a.x, y, { flip: a.face > 0, add });
      else gfx.frame(sheet, t / 3, base, a.x, y, { flip: a.face > 0, add });
    };
    draw();
    if (a.hitT > 0 && a.hitT % 4 < 2) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      draw(true);
      ctx.restore();
    }
    // Health bar.
    const top = y - (spec.boss ? 90 : a.kind === 'minisylvester' ? 40 : 75);
    const frac = Math.max(0, a.hp / a.maxHp);
    healthBar(a.x, top, spec.eatsFood ? 1 - frac : frac, a.shield ? '#78dcff' : spec.eatsFood ? '#ffb02e' : null);
  }

  function healthBar(x, top, frac, tint) {
    const tube = gfx.info('healthbartube');
    if (!tube) return;
    const w = tube.fw;
    const left = x - w / 2;
    gfx.image('healthbartube', left, top);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, w * Math.max(0, Math.min(1, frac)), tube.fh);
    ctx.clip();
    gfx.image('healthbar', left, top);
    if (tint) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = tint;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(left, top, w, tube.fh);
    }
    ctx.restore();
  }

  function missile(m) {
    const k = Math.round((-Math.atan2(m.vy, m.vx) / (Math.PI * 2)) * 16);
    gfx.frame('missile', k, 0, m.x, m.y);
  }

  /* ---------- Shop bar ---------- */

  function eightSlotBar() {
    if (bar8) return bar8;
    const mb = gfx.info('menubar');
    const src = mb.a.img;
    const k = mb.k;
    const c = document.createElement('canvas');
    c.width = 640 * k;
    c.height = 75 * k;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0);
    for (let x = 22; x < 492; x += 10) g.drawImage(src, 78 * k, 0, 10 * k, 75 * k, x * k, 0, 10 * k, 75 * k);
    for (const x of EIGHT) g.drawImage(src, 22 * k, 0, 54 * k, 68 * k, Math.round(x) * k, 1 * k, 50 * k, 63 * k);
    bar8 = c;
    return c;
  }

  // Shop icons: [sheet, col, row, scale].
  function iconArt(id, level) {
    switch (id) {
      case 'guppy':
        return ['swim', 0, 1, 0.8];
      case 'carnivore':
        return ['swim', 0, 4, 0.62];
      case 'breeder':
        return ['scl_breeder', 0, 0, 1];
      case 'starcatcher':
        return ['scl_starcatcher', 0, 0, 1];
      case 'guppycruncher':
        return ['scl_grubber', 0, 0, 1];
      case 'beetlemuncher':
        return ['scl_gekko', 0, 0, 1];
      case 'ultravore':
        return ['scl_ultra', 0, 0, 1];
      case 'potion':
        return ['food', 0, 3, 1];
      case 'quality':
        return ['food', 0, Math.min(2, (level ?? 0) + 1), 1.15];
      case 'count':
        return ['food', 0, 0, 1.15];
      case 'weapon':
        return ['guns', Math.min(9, (level ?? 0) + 1), 0, 0.95];
      case 'egg':
        return ['eggpieces', Math.min(2, level ?? 0), 0, 0.95];
    }
    return null;
  }

  function icon(id, x, y, level, s = 1) {
    const a = iconArt(id, level);
    if (a) gfx.frame(a[0], a[1], a[2], x, y, { scale: a[3] * s });
  }

  function bar(tank, ui, t) {
    const shop = ui.shop;
    const n = shop.length;
    if (n > 7) ctx.drawImage(eightSlotBar(), 0, 0, 640, 75);
    else gfx.image('menubar');
    shop.forEach((item, i) => {
      if (!item) return;
      const r = slotRect(i, n);
      const cx = r.x + r.w / 2;
      const dy = ui.pressed === i ? 1 : 0;
      if (ui.hover === i && !item.maxed) {
        const g = ctx.createRadialGradient(cx, r.glass, 4, cx, r.glass, 24);
        g.addColorStop(0, 'rgba(255,255,220,0.8)');
        g.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - 26, r.glass - 24, 52, 48);
      }
      ctx.save();
      ctx.globalAlpha = item.maxed ? 0.4 : item.affordable ? 1 : 0.55;
      const bob = ui.hover === i ? Math.sin(t / 8) * 1.5 : 0;
      icon(item.id, cx, r.glass + dy + bob, item.level);
      ctx.restore();
      const price = item.maxed ? 'MAX' : `$${item.cost}`;
      gfx.text('continuumbold12', price, cx, r.label - 8 + dy, { align: 'center', maxWidth: r.w - 12, color: item.maxed ? '#c9c2e8' : item.affordable ? '#fff36b' : '#ff9a8a' });
      if (item.id === 'count') gfx.text('continuumbold12outline', `${item.level}`, cx + 18, r.glass + 2, { align: 'center' });
      if (ui.flash === i) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(cx, r.glass, 22, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    if (ui.hover === 'menu') {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(MENU_BTN.x + 8, MENU_BTN.y + 4, MENU_BTN.w - 16, MENU_BTN.h - 8);
    }
    const flash = ui.moneyFlash > 0 && Math.floor(ui.moneyFlash / 4) % 2;
    gfx.text('continuumbold14', `${Math.round(ui.money).toLocaleString('en-US')}`, MONEY_BOX.x + MONEY_BOX.w - 5, MONEY_BOX.y + 1, { align: 'right', color: flash ? '#ff6b6b' : '#ffffff' });
  }

  /* ---------- The whole tank ---------- */

  function draw(tank, ui, fx, t) {
    gfx.image(tank.def.aquarium);
    polish.rays(t);
    // Soft shadows on the sand.
    for (const f of tank.fish) if (!f.dead && !f.hidden) polish.shadow(f.x, f.y, (tank.sizeOf(f) || 20) * 1.1);
    for (const a of tank.aliens) for (const e of a.body ?? [a]) polish.shadow(e.x, e.y, a.body ? 26 : 50);
    for (const p of tank.pets) polish.shadow(p.x, p.y, 26);
    for (const p of tank.pets) if (['stinky', 'niko', 'rufus', 'rhubarb'].includes(p.as ?? p.kind)) pet(p, t, tank);
    for (const p of tank.food) {
      if (p.kind === 'potion') polish.glow(p.x, p.y, 26, 'rgba(120,255,160,A)', 0.4);
      food(p, t);
    }
    for (const f of tank.fish) if (FISH[f.kind].bottom) fish(f, t, tank);
    for (const f of tank.fish) if (!FISH[f.kind].bottom) fish(f, t, tank);
    for (const p of tank.pets) if (!['stinky', 'niko', 'rufus', 'rhubarb'].includes(p.as ?? p.kind)) pet(p, t, tank);
    for (const c of tank.coins) coin(c, t);
    for (const a of tank.aliens) alien(a, t);
    for (const m of tank.missiles) missile(m);
    for (const b of tank.balls) ball(b, t);
    polish.ambient(t);
    fx.draw(gfx, t);
    polish.vignette();
    bar(tank, ui, t);
  }

  return { draw, icon, coin, fish, pet, alien, bar, polish };
}
