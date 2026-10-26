import { loadAll, assets } from './assets.js';
import { createGfx, W, H } from './gfx.js';
import { createSound } from './sound.js';
import { createTank } from './tank.js';
import { createView, slotRect, MENU_BTN, MONEY_BOX } from './view.js';
import { uiFont } from './polish.js';
import { createFx } from './fx.js';
import { LEVELS, BOSS, TIME_TRIAL, CHALLENGE, VIRTUAL, PETS, PET_ORDER, BONUS_PETS, BONUS_REWARD, MAX_PETS, ALIENS, FISH, TANK, SHELLS, BAR } from './data.js';
import { HELP as HELP_SECTIONS, say } from './text.js';

// Help sections split into pages of three paragraphs.
const HELP = HELP_SECTIONS.flatMap((sec) => Array.from({ length: Math.ceil(sec.text.length / 3) }, (_, i) => ({ head: sec.head, text: sec.text.slice(i * 3, i * 3 + 3) })));

const canvas = document.getElementById('game');
const gfx = createGfx(canvas);
const sound = createSound();
const fx = createFx();
let view = null;

/* ---------- Save data ---------- */

const KEY = 'insaniquarium-web';
const fresh = () => ({ level: 0, pets: [], choice: [], shells: 0, best: {}, timeTrial: 0, challenge: 0, beaten: false, challengeBeaten: {}, challengeBest: {}, wins: 0, bonusBought: 0, maxPets: MAX_PETS, virtual: null, sfx: 0.8, music: 0.6 });
let save = (() => {
  try {
    const s = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') };
    // Saves from before the Bonus Reward: count what's already owned as bought.
    const owned = BONUS_REWARD.items.filter((id) => (PETS[id] ? s.pets.includes(id) : s.maxPets >= (id === 'pets4' ? 4 : 7))).length;
    s.bonusBought = Math.max(s.bonusBought, owned);
    return s;
  } catch {
    return fresh();
  }
})();
const store = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode: progress lasts this session */
  }
};
sound.setVolume('sfx', save.sfx);
sound.setVolume('music', save.music);

/* ---------- Input ---------- */

const mouse = { x: -100, y: -100, down: false, downT: 0 };
let scene = null;
let t = 0;

function setScene(s, ...args) {
  scene?.leave?.();
  scene = s;
  s.enter?.(...args);
  view?.polish.startFade();
}

function point(e) {
  const p = gfx.toGame(e.clientX, e.clientY);
  mouse.x = p.x;
  mouse.y = p.y;
}
canvas.addEventListener('pointermove', point);
canvas.addEventListener('pointerdown', (e) => {
  point(e);
  sound.unlock();
  mouse.down = true;
  mouse.downT = 0;
  if (e.button === 2) scene?.rightClick?.(mouse.x, mouse.y);
  else scene?.click?.(mouse.x, mouse.y);
});
addEventListener('pointerup', () => (mouse.down = false));
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('keydown', (e) => scene?.key?.(e));
addEventListener('blur', () => scene?.blur?.());

const inside = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

/* ---------- Drawing helpers: panels and buttons built from the original pieces ---------- */

/** The original dialog panel, stretched with fixed corners. */
function panel(x, y, w, h) {
  const p = gfx.info('dialogue-panel');
  if (!p) return;
  const c = 48;
  const src = p.a.img;
  const k = p.k;
  const S = 240;
  const parts = [
    [0, 0, c, c, x, y, c, c],
    [c, 0, S - 2 * c, c, x + c, y, w - 2 * c, c],
    [S - c, 0, c, c, x + w - c, y, c, c],
    [0, c, c, S - 2 * c, x, y + c, c, h - 2 * c],
    [c, c, S - 2 * c, S - 2 * c, x + c, y + c, w - 2 * c, h - 2 * c],
    [S - c, c, c, S - 2 * c, x + w - c, y + c, c, h - 2 * c],
    [0, S - c, c, c, x, y + h - c, c, c],
    [c, S - c, S - 2 * c, c, x + c, y + h - c, w - 2 * c, c],
    [S - c, S - c, c, c, x + w - c, y + h - c, c, c],
  ];
  for (const [sx, sy, sw, sh, dx, dy, dw, dh] of parts) gfx.ctx.drawImage(src, sx * k, sy * k, sw * k, sh * k, dx, dy, dw, dh);
}

/** A button from the original 'dialogbutton2' strip (three states side by side). */
function button(label, x, y, w = 200, { font = 'junglefever12outline' } = {}) {
  const r = { x: x - w / 2, y, w, h: 33 };
  const hover = inside(mouse.x, mouse.y, r);
  const b = gfx.info('dialogbutton2');
  if (b) {
    const k = b.k;
    const sw = 96;
    const state = hover ? (mouse.down ? 2 : 1) : 0;
    const sx = state * sw;
    const cap = 20;
    const g = gfx.ctx;
    g.drawImage(b.a.img, sx * k, 0, cap * k, 33 * k, r.x, y, cap, 33);
    g.drawImage(b.a.img, (sx + cap) * k, 0, (sw - 2 * cap) * k, 33 * k, r.x + cap, y, w - 2 * cap, 33);
    g.drawImage(b.a.img, (sx + sw - cap) * k, 0, cap * k, 33 * k, r.x + w - cap, y, cap, 33);
  }
  gfx.text(font, label, x, y + 4, { align: 'center', color: hover ? '#ffff9a' : null });
  return r;
}

function title(str, y = 30, font = 'junglefever17outline') {
  gfx.text(font, str, W / 2, y, { align: 'center' });
}

/** Body text in the original Liddie font, dark on the light panels. */
function body(str, x, y, width, { color = '#3a2a10', align = 'left', size = 12 } = {}) {
  return gfx.wrap(`liddie${size}`, str, x, y, width, size + 5, { color, align });
}

/** The game's own cursor art as the real system cursor, click point on the tip. */
let cursorNow = '';
function cursor() {
  const spots = assets.manifest?.cursor ?? {};
  const hand = scene?.hand?.() ?? false;
  const name = hand ? 'cursor_hand' : 'cursor_pointer';
  if (name === cursorNow || !spots[name]) return;
  cursorNow = name;
  const [hx, hy] = spots[name];
  canvas.style.cursor = `url("assets/cursor/${name}.png") ${hx} ${hy}, ${hand ? 'pointer' : 'default'}`;
}

/* ---------- Loading ---------- */

let progress = 0;
const loading = {
  ready: false,
  draw() {
    if (assets.img.titlescreen) gfx.image('titlescreen');
    const x = 195;
    const y = 400;
    if (!assets.img.loaderbar) return;
    gfx.image('loaderbar', x, y);
    gfx.ctx.save();
    gfx.ctx.beginPath();
    gfx.ctx.rect(x, y, 250 * (this.ready ? 1 : progress), 31);
    gfx.ctx.clip();
    gfx.image('loaderbarover', x, y);
    gfx.ctx.restore();
    if (this.ready && assets.font.junglefever15outline) gfx.text('junglefever15outline', inside(mouse.x, mouse.y, { x, y, w: 250, h: 31 }) ? 'Click here to play!' : 'Click here to play!', 320, y + 2, { align: 'center', color: inside(mouse.x, mouse.y, { x, y, w: 250, h: 31 }) ? '#ffff9a' : null });
  },
  click() {
    if (!this.ready) return;
    sound.play('buttonclick');
    setScene(menu);
  },
  hand() {
    return this.ready;
  },
};

/* ---------- Main menu ---------- */

const MODE_BTNS = [
  { id: 'adventure', label: 'Adventure', cx: 465, cy: 80, w: 210, h: 70 },
  { id: 'timetrial', label: 'Time Trial', cx: 465, cy: 165, w: 210, h: 52 },
  { id: 'challenge', label: 'Challenge', cx: 465, cy: 240, w: 210, h: 52 },
  { id: 'virtual', label: 'Virtual Tank', cx: 465, cy: 318, w: 210, h: 70 },
];
const LOW_BTNS = [
  { id: 'fame', label: 'Hall of Fame', cx: 464, cy: 395, w: 120, h: 24, font: 'continuumbold12outline' },
  { id: 'options', label: 'Options', cx: 370, cy: 425, w: 90, h: 24, font: 'continuumbold12outline' },
  { id: 'help', label: 'Help', cx: 464, cy: 425, w: 90, h: 24, font: 'continuumbold12outline' },
  { id: 'credits', label: 'Credits', cx: 558, cy: 425, w: 90, h: 24, font: 'continuumbold12outline' },
];
const rectOf = (b) => ({ x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h });
const MODE_TIPS = Object.fromEntries(['adventure', 'timetrial', 'challenge', 'virtual'].map((id) => [id, say(`mode.${id}`)]));

const menu = {
  enter() {
    sound.playMusic('insaniq2');
  },
  draw() {
    gfx.image('selectorback');
    for (const b of MODE_BTNS) {
      const hover = inside(mouse.x, mouse.y, rectOf(b));
      // A soft pulsing light behind the hovered button.
      if (hover) view.polish.glow(b.cx, b.cy, 120, 'rgba(150,200,255,A)', 0.28 + 0.08 * Math.sin(t / 8));
      const locked = b.id !== 'adventure' && !hatched() && b.id !== 'virtual';
      gfx.text('junglefever17outline', b.label, b.cx, b.cy - 14, { align: 'center', color: locked ? '#9a90c0' : hover ? '#ffff9a' : null });
    }
    for (const b of LOW_BTNS) {
      const hover = inside(mouse.x, mouse.y, rectOf(b));
      gfx.text(b.font, b.label, b.cx, b.cy - 8, { align: 'center', color: hover ? '#ffff9a' : null });
    }
    const hov = MODE_BTNS.find((b) => inside(mouse.x, mouse.y, rectOf(b)));
    if (hov) {
      gfx.image('gsspeechbubble', 60, 70);
      gfx.wrap('liddie15', hov.id === 'adventure' && save.level > 0 ? `Continue your adventure: ${LEVELS[Math.min(save.level, LEVELS.length - 1)].name}` : MODE_TIPS[hov.id], 76, 86, 220, 19, { color: '#3a2a10' });
    }
    if (save.shells) gfx.text('continuumbold12outline', `${save.shells.toLocaleString('en-US')} Shells`, 20, 450);
  },
  hand() {
    return [...MODE_BTNS, ...LOW_BTNS].some((b) => inside(mouse.x, mouse.y, rectOf(b)));
  },
  click(x, y) {
    const b = [...MODE_BTNS, ...LOW_BTNS].find((o) => inside(x, y, rectOf(o)));
    if (!b) return;
    sound.play('buttonclick');
    if (b.id === 'adventure') startAdventure();
    else if (b.id === 'timetrial') {
      if (!hatched()) return note('Not Yet!', say('note.locked'));
      play(TIME_TRIAL, save.choice.length ? save.choice : save.pets.slice(-3));
    } else if (b.id === 'challenge') {
      if (!save.beaten) return note('Not Yet!', say('note.beatAdventure'));
      setScene(challengePick);
    } else if (b.id === 'virtual') play(VIRTUAL, save.pets.slice(0, petLimit(true)));
    else if (b.id === 'help') setScene(help);
    else if (b.id === 'options') setScene(options);
    else if (b.id === 'fame') setScene(fame);
    else if (b.id === 'credits') setScene(credits);
  },
};

/* A message box over the current scene. */
/** How many pets have hatched in Adventure (bonus pets don't count). */
const hatched = () => save.pets.filter((p) => !PETS[p].bonus).length;

/** How many pets go into a tank: 3, or 4 once bought. Seven only ever counts in the Virtual Tank, as in the original. */
const petLimit = (virtual = false) => (virtual ? save.maxPets : Math.min(4, save.maxPets));

let noteBox = null;
function note(head, text, onClose = null) {
  noteBox = { head, text, onClose };
}
function drawNote() {
  if (!noteBox) return null;
  gfx.ctx.fillStyle = 'rgba(0,0,0,0.4)';
  gfx.ctx.fillRect(0, 0, W, H);
  panel(150, 140, 340, 200);
  gfx.text('junglefever15outline', noteBox.head, 320, 160, { align: 'center' });
  body(noteBox.text, 180, 200, 280, { align: 'center' });
  return button('OK', 320, 290, 140);
}

/* ---------- Adventure ---------- */

function startAdventure() {
  if (save.level >= LEVELS.length) return play(BOSS, save.pets.slice(-petLimit()));
  const def = LEVELS[save.level];
  if (save.pets.length > petLimit()) setScene(petPick, def);
  else play(def, save.pets.slice());
}

/** Choose Your Pets: three to take into the next level. */
const petPick = {
  enter(def) {
    this.def = def;
    this.chosen = save.choice.filter((p) => save.pets.includes(p)).slice(0, petLimit());
  },
  layout() {
    // Six to a row, or eight smaller ones when there are more than 18 pets.
    const cols = save.pets.length > 18 ? 8 : 6;
    const k = cols === 8 ? 0.76 : 1;
    const x0 = (W - cols * 92 * k) / 2;
    return save.pets.map((p, i) => ({ p, k, x: x0 + (i % cols) * 92 * k, y: 86 + Math.floor(i / cols) * (cols === 8 ? 82 : 100), w: 90 * k, h: 83 * k }));
  },
  draw() {
    gfx.image(this.def.aquarium);
    gfx.ctx.fillStyle = 'rgba(0,10,40,0.55)';
    gfx.ctx.fillRect(0, 0, W, H);
    title('Choose Your Pets', 22);
    gfx.text('continuumbold12outline', 'to take to the next level', W / 2, 62, { align: 'center' });
    for (const b of this.layout()) {
      const on = this.chosen.includes(b.p);
      const cx = b.x + 45 * b.k;
      const cy = b.y + 41 * b.k;
      gfx.image('petbuttonring', b.x, b.y, { scale: b.k });
      gfx.frame(`scl_${b.p}`, on ? t / 3 : 0, 0, cx, cy, { scale: b.k });
      if (!on) {
        gfx.ctx.fillStyle = 'rgba(0,0,0,0.35)';
        gfx.ctx.beginPath();
        gfx.ctx.arc(cx, cy, 34 * b.k, 0, Math.PI * 2);
        gfx.ctx.fill();
      }
      gfx.text('continuumbold12outline', PETS[b.p].name, cx, b.y + 80 * b.k, { align: 'center', color: on ? '#ffff9a' : null, maxWidth: 88 * b.k });
    }
    const hov = this.layout().find((b) => inside(mouse.x, mouse.y, b));
    if (hov) {
      panel(110, 335, 420, 76);
      body(say(`pet.${hov.p}`), 140, 352, 360, { align: 'center' });
    }
    const left = petLimit() - this.chosen.length;
    this.go = button(left > 0 ? `Choose ${left} more pet${left > 1 ? 's' : ''}` : 'Play!', 320, 425, 260);
  },
  hand() {
    return this.layout().some((b) => inside(mouse.x, mouse.y, b)) || (this.go && inside(mouse.x, mouse.y, this.go));
  },
  click(x, y) {
    const b = this.layout().find((o) => inside(x, y, o));
    if (b) {
      sound.play('buttonclick');
      if (this.chosen.includes(b.p)) this.chosen = this.chosen.filter((p) => p !== b.p);
      else if (this.chosen.length < petLimit()) this.chosen.push(b.p);
      return;
    }
    if (this.go && inside(x, y, this.go) && this.chosen.length) {
      save.choice = this.chosen.slice();
      store();
      play(this.def, this.chosen.slice());
    }
  },
};

/* ---------- Playing ---------- */

const MSG = Object.fromEntries(['welcome', 'hungry', 'starving', 'coins', 'egg', 'grow', 'onePellet', 'carnivoreDied', 'starcatcherDied', 'shield', 'gus', 'danger', 'autofeed'].map((k) => [k, say(`msg.${k}`)]));
const ITEM_INFO = {
  guppy: ['Guppy', 'Grows as it eats. Medium guppies drop silver, large ones gold.'],
  breeder: ['Breeder', 'Has a baby guppy every so often while she is fed.'],
  quality: ['Food Quality', 'Better food feeds fish for longer and makes them grow faster.'],
  count: ['Food Quantity', 'Drop one more food pellet at a time.'],
  carnivore: ['Carnivore', 'Eats baby guppies and drops diamonds.'],
  potion: ['Star Potion', 'Feed it to a large guppy to make it drop stars.'],
  starcatcher: ['Starcatcher', 'Lives on the sand, eats falling stars, drops diamonds.'],
  guppycruncher: ['Guppycruncher', 'Crawls on the sand, snaps up baby guppies, makes beetles.'],
  beetlemuncher: ['Beetlemuncher', 'Eats beetles and makes pearls.'],
  ultravore: ['Ultravore', 'Eats carnivores and drops treasure chests.'],
  weapon: ['Laser Upgrade', 'More powerful lasers kill aliens in fewer clicks.'],
  egg: ['Egg Piece', 'Buy all three pieces to finish the level and hatch a new pet.'],
};
const SIGNATURE = { ...Object.fromEntries(['gus', 'destructor', 'ulysses', 'psychosquid', 'bilaterus'].map((k) => [k, say(`sig.${k}`)])), cyrax: 'FINAL BOSS' };

const game = {
  enter(def, pets) {
    this.def = def;
    this.pets = pets;
    this.tank = createTank({ def, pets, seed: (Date.now() & 0xffff) || 1, saved: def.id === 'virtual' ? save.virtual : null });
    if (def.id === 'virtual' && save.virtual) this.tank.money = save.virtual.money;
    this.ui = { shop: [], hover: null, pressed: null, pressedT: 0, flash: null, flashT: 0, money: this.tank.money, moneyFlash: 0 };
    this.paused = false;
    this.msg = null;
    this.said = new Set();
    this.intro = 150;
    this.warnKind = null;
    this.endT = 0;
    this.holdT = 0;
    fx.clear();
    sound.playMusic(def.id === 'virtual' ? 'lullaby' : 'insaniq2');
    const welcome = def.index === 0 ? MSG.welcome : say(`welcome.${def.boss ? 'boss' : def.index === 5 ? 'tank2' : def.index >= 0 ? 'next' : def.id}`);
    this.say(welcome, 240);
  },
  leave() {
    if (this.def.id === 'virtual') saveVirtual(this.tank);
  },
  say(text, dur = 180, once = null) {
    if (once) {
      if (this.said.has(once)) return;
      this.said.add(once);
    }
    this.msg = { text, t: dur };
  },
  update() {
    const tank = this.tank;
    const ui = this.ui;
    if (this.paused || noteBox) return;
    if (ui.pressedT > 0 && --ui.pressedT === 0) ui.pressed = null;
    if (ui.flashT > 0 && --ui.flashT === 0) ui.flash = null;
    if (ui.moneyFlash > 0) ui.moneyFlash--;
    if (this.intro > 0) this.intro--;
    if (this.msg && --this.msg.t <= 0) this.msg = null;
    // Holding the mouse button keeps feeding or firing.
    if (mouse.down && mouse.y > BAR && !tank.outcome) {
      if (++this.holdT > 18 && this.holdT % 8 === 0) {
        tank.click(mouse.x, mouse.y);
        this.events(tank.events.slice());
      }
    } else this.holdT = 0;
    for (const list of [tank.fish, tank.coins, tank.food, tank.pets, tank.aliens, tank.missiles, tank.balls, tank.aliens.flatMap((o) => o.body ?? [])]) for (const o of list) {
      o.px = o.x;
      o.py = o.y;
    }
    tank.step();
    this.events(tank.events.slice());
    fx.step();
    ui.shop = arrange(tank.shop());
    ui.money += (tank.money - ui.money) * 0.25;
    if (Math.abs(tank.money - ui.money) < 0.5) ui.money = tank.money;
    // Hints like the original's.
    if (tank.fish.some((f) => !f.dead && tank.isHungry(f))) this.say(MSG.hungry, 180, 'hungry');
    if (tank.coins.length) this.say(MSG.coins, 180, 'coins');
    if (tank.outcome && ++this.endT === 90) this.finish();
  },
  events(list) {
    const tank = this.tank;
    for (const e of list) {
      switch (e.type) {
        case 'food':
          sound.play('dropfood');
          break;
        case 'full':
          sound.play('buzzer', { volume: 0.4 });
          if (tank.maxFood() === 1) this.say(MSG.onePellet, 150, 'one');
          break;
        case 'broke':
        case 'cantBuy':
          sound.play('buzzer', { volume: 0.5 });
          this.ui.moneyFlash = 24;
          break;
        case 'eat':
          sound.play(['slurp', 'slurp2', 'slurp3'][Math.floor(Math.random() * 3)], { volume: 0.6 });
          break;
        case 'grow':
          sound.play('grow');
          fx.sparkle(e.x, e.y);
          this.say(MSG.grow, 150, 'grow');
          break;
        case 'star':
          sound.play('crowned1');
          fx.sparkle(e.x, e.y);
          break;
        case 'birth':
          sound.play('baby');
          fx.sparkle(e.x, e.y);
          break;
        case 'coin':
          fx.sparkle(e.x, e.y);
          if (e.shell) {
            sound.play('bonuscollect');
            view.polish.floatText(`+${e.value} Shells`, e.x, e.y - 14, '#a8ecff', 20);
            break;
          }
          sound.play({ silver: 'points', gold: 'points2', star: 'points3', diamond: 'diamond', chest: 'treasure', beetle: 'points4', pearl: 'pearl', bomb: 'points4' }[e.coin] ?? 'points');
          // The coin flies to the money counter, and its value pops up.
          view.polish.coinFly(e.coin, e.x, e.y, MONEY_BOX.x + 40, MONEY_BOX.y + 10, (type, x, y, k, tt) => view.coin({ type, x, y, id: 0, spin: 0, floorT: 0 }, tt, k));
          view.polish.floatText(`+$${e.value}`, e.x, e.y - 14, e.value >= 200 ? '#8ff0ff' : '#ffe45c', e.value >= 200 ? 22 : 18);
          break;
        case 'starve':
          sound.play('die');
          fx.bubbles(e.x, e.y, 4);
          if (e.kind === 'carnivore') this.say(MSG.carnivoreDied, 200);
          if (e.kind === 'starcatcher') this.say(MSG.starcatcherDied, 200);
          break;
        case 'gulp':
          sound.play(e.by === 'missile' || e.by === 'bomb' ? 'explosion1' : ['chomp', 'chomp2'][Math.floor(Math.random() * 2)]);
          fx.chomp(e.x, e.y);
          break;
        case 'warning': {
          sound.play('awooga');
          const kind = tank.incoming[0];
          this.warnKind = kind;
          this.warnT = 240;
          if (kind === 'gus' && !save.seenGus) {
            save.seenGus = true;
            this.say(MSG.gus, 300);
          } else if (!save.seenAlien) {
            save.seenAlien = true;
            this.say(MSG.danger, 300);
          }
          break;
        }
        case 'portal':
          fx.portal(e.x, e.y);
          break;
        case 'alien':
          view.polish.shake(5, 24);
          sound.play(['roar', 'roar2', 'roar3'][Math.floor(Math.random() * 3)]);
          sound.playMusic('alien');
          break;
        case 'shot':
          sound.play('zap', { volume: 0.5 });
          fx.shot(e.x, e.y, e.level, e.miss);
          if (!e.miss) sound.play('hit', { volume: 0.5 });
          break;
        case 'healshot':
          sound.play('heal');
          fx.shot(e.x, e.y, 0);
          this.say(MSG.shield, 120);
          break;
        case 'heal':
          break;
        case 'defeat':
          view.polish.shake(7, 26);
          view.polish.floatText('DEFEATED!', e.x, e.y - 40, '#ff8a5c', 24);
          sound.play('explode');
          fx.boom(e.x, e.y);
          if (!tank.aliens.length) sound.playMusic(tank.def.id === 'virtual' ? 'lullaby' : 'insaniq2');
          break;
        case 'missile':
          sound.play('missle');
          break;
        case 'deflect':
          sound.play('ricochet');
          break;
        case 'pop':
          sound.play('punch');
          view.polish.shake(2, 8);
          fx.boom(e.x, e.y, true);
          break;
        case 'boom':
          view.polish.shake(3, 12);
          sound.play('explosion4');
          fx.boom(e.x, e.y);
          break;
        case 'gorge':
          sound.play('chomp2');
          break;
        case 'laugh':
          sound.play('evillaff');
          break;
        case 'sing':
          sound.play('sing');
          break;
        case 'nikoOpen':
          sound.play('nikoopen', { volume: 0.6 });
          break;
        case 'amp':
          sound.play('eel1');
          break;
        case 'punch':
          sound.play('punch');
          view.polish.shake(2, 8);
          fx.shot(e.x, e.y, 2);
          break;
        case 'slurp':
          sound.play(['slurp', 'slurp2', 'slurp3'][Math.floor(Math.random() * 3)], { volume: 0.6 });
          break;
        case 'sneeze':
          sound.play('sneeze', { volume: 0.6 });
          break;
        case 'bonk':
          sound.play('ricochet', { volume: 0.5 });
          fx.sparkle(e.x, e.y);
          break;
        case 'stab':
        case 'pinch':
          sound.play('hit', { volume: 0.5 });
          fx.shot(e.x, e.y, 2);
          break;
        case 'spit':
          sound.play('dropfood', { volume: 0.5 });
          break;
        case 'revive':
          sound.play('heal');
          fx.sparkle(e.x, e.y);
          break;
        case 'morph':
          sound.play('sfx');
          break;
        case 'toss':
          sound.play('bubbles', { volume: 0.4 });
          fx.bubbles(e.x, e.y, 3);
          break;
        case 'buy':
          sound.play('buy');
          this.flash(e.id);
          if (e.x !== undefined) sound.play(['splash', 'splash2', 'splash3'][Math.floor(Math.random() * 3)]);
          if (e.id === 'egg' && tank.eggs < 3) this.say(`Collect ${3 - tank.eggs} more egg piece${3 - tank.eggs > 1 ? 's' : ''} to finish level!`, 150);
          break;
        case 'pricesReset':
          this.say(say('msg.pricesReset'), 180);
          break;
        case 'clear':
          sound.play('zzam');
          break;
        case 'timeUp':
          sound.play('zzam');
          break;
        case 'lost':
          sound.play('die');
          break;
      }
    }
  },
  /** A modern card describing the shop item under the mouse. */
  tooltip() {
    const i = this.ui.hover;
    const item = typeof i === 'number' ? this.ui.shop[i] : null;
    if (!item || this.paused) return;
    const [name, what] = ITEM_INFO[item.id] ?? [item.id, ''];
    const r = slotRect(i, this.ui.shop.length);
    const g = gfx.ctx;
    g.save();
    g.font = uiFont(12, 500);
    const lines = [];
    let line = '';
    for (const w of what.split(' ')) {
      const next = line ? `${line} ${w}` : w;
      if (g.measureText(next).width > 200 && line) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    const w = 224;
    const h = 46 + lines.length * 15;
    const x = Math.max(6, Math.min(W - w - 6, r.x + r.w / 2 - w / 2));
    const y = BAR + 6;
    g.shadowColor = 'rgba(0,0,0,0.45)';
    g.shadowBlur = 14;
    g.fillStyle = 'rgba(12,24,48,0.92)';
    g.beginPath();
    g.roundRect(x, y, w, h, 10);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = 'rgba(255,214,110,0.55)';
    g.lineWidth = 1.2;
    g.stroke();
    g.fillStyle = '#ffe9a8';
    g.font = uiFont(14, 800);
    g.textBaseline = 'top';
    g.fillText(name, x + 12, y + 9);
    g.textAlign = 'right';
    g.fillStyle = item.maxed ? '#9fb0c8' : item.affordable ? '#7dff9a' : '#ff8f8f';
    g.fillText(item.maxed ? 'MAX' : `$${item.cost.toLocaleString('en-US')}`, x + w - 12, y + 9);
    g.textAlign = 'left';
    g.fillStyle = '#d6e4ff';
    g.font = uiFont(12, 500);
    lines.forEach((l, k) => g.fillText(l, x + 12, y + 30 + k * 15));
    if (!item.maxed && !item.affordable) {
      g.fillStyle = '#ff9f9f';
      g.fillText(`Need $${(item.cost - this.tank.money).toLocaleString('en-US')} more`, x + 12, y + 30 + lines.length * 15);
    }
    g.restore();
  },
  flash(id) {
    const i = this.ui.shop.findIndex((s) => s?.id === id);
    if (i >= 0) {
      this.ui.flash = i;
      this.ui.flashT = 10;
    }
  },
  draw(alpha = 1) {
    this.alpha = alpha;
    const tank = this.tank;
    // Draw where things are between game steps, for smooth motion on any screen.
    const a = Math.max(0, Math.min(1, this.alpha ?? 1));
    const moved = [];
    for (const list of [tank.fish, tank.coins, tank.food, tank.pets, tank.aliens, tank.missiles, tank.balls, tank.aliens.flatMap((o) => o.body ?? [])]) for (const o of list) {
      if (o.px === undefined || Math.abs(o.px - o.x) > 40 || Math.abs(o.py - o.y) > 40) continue;
      moved.push([o, o.x, o.y]);
      o.x = o.px + (o.x - o.px) * a;
      o.y = o.py + (o.y - o.py) * a;
    }
    view.draw(tank, this.ui, fx, t + a);
    for (const [o, x, y] of moved) {
      o.x = x;
      o.y = y;
    }
    view.polish.drawJuice(t);
    this.tooltip();
    // The alien warning.
    if (tank.warning > 0) {
      const head = SIGNATURE[this.warnKind] ?? say(tank.incoming.length > 1 ? 'sig.multiple' : 'sig.one');
      if (Math.floor(t / 15) % 2) gfx.text('junglefever17outline', 'WARNING!', 320, 140, { align: 'center', color: '#ff5050' });
      gfx.text('junglefever12outline', head, 320, 178, { align: 'center' });
    }
    if (this.msg) {
      const a = Math.min(1, this.msg.t / 20);
      gfx.ctx.save();
      gfx.ctx.globalAlpha = a;
      gfx.wrap('junglefever12outline', this.msg.text, 60, 432, 520, 20, { align: 'center' });
      gfx.ctx.restore();
    }
    if (this.intro > 0 && !this.def.virtual) {
      const a = Math.min(1, this.intro / 30);
      gfx.ctx.save();
      gfx.ctx.globalAlpha = a;
      gfx.text('junglefever17outline', this.def.name, 320, 210, { align: 'center' });
      if (this.def.egg) gfx.text('continuumbold12outline', `Egg pieces: $${this.def.egg.toLocaleString('en-US')} each`, 320, 250, { align: 'center' });
      gfx.ctx.restore();
    }
    if (tank.timeLeft !== null) {
      const s = Math.ceil(tank.timeLeft / 60);
      gfx.text('continuumbold14', `Time Remaining: ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 320, 82, { align: 'center', color: s < 30 && Math.floor(t / 15) % 2 ? '#ff6060' : '#ffffff' });
    }
    if (this.paused) {
      gfx.ctx.fillStyle = 'rgba(0,0,0,0.45)';
      gfx.ctx.fillRect(0, 0, W, H);
      panel(170, 110, 300, 280);
      gfx.text('junglefever15outline', 'GAME PAUSED', 320, 130, { align: 'center' });
      this.btns = {
        resume: button('Resume Game', 320, 180, 220),
        restart: button(this.def.id === 'virtual' ? 'Visit Store' : 'Restart Level', 320, 222, 220),
        sound: button(`Sound Fx: ${save.sfx ? 'On' : 'Off'}`, 320, 264, 220),
        music: button(`Music: ${save.music ? 'On' : 'Off'}`, 320, 306, 220),
        quit: button('Back to Main Menu', 320, 348, 220),
      };
    }
    this.okBtn = drawNote();
  },
  hand() {
    if (this.paused) return Object.values(this.btns ?? {}).some((r) => inside(mouse.x, mouse.y, r));
    return mouse.y < BAR || this.tank.coins.some((c) => Math.hypot(c.x - mouse.x, c.y - mouse.y) < 24);
  },
  hover() {
    const ui = this.ui;
    ui.hover = null;
    if (this.paused || mouse.y > BAR) return;
    if (inside(mouse.x, mouse.y, MENU_BTN)) ui.hover = 'menu';
    ui.shop.forEach((it, i) => {
      if (it && inside(mouse.x, mouse.y, slotRect(i, ui.shop.length))) ui.hover = i;
    });
  },
  click(x, y) {
    if (noteBox) {
      if (this.okBtn && inside(x, y, this.okBtn)) {
        const cb = noteBox.onClose;
        noteBox = null;
        cb?.();
      }
      return;
    }
    if (this.paused) {
      const b = this.btns ?? {};
      if (inside(x, y, b.resume ?? {})) this.paused = false;
      else if (inside(x, y, b.restart ?? {})) {
        if (this.def.id === 'virtual') setScene(storeScene, this);
        else setScene(game, this.def, this.pets);
      } else if (inside(x, y, b.sound ?? {})) {
        save.sfx = save.sfx ? 0 : 0.8;
        sound.setVolume('sfx', save.sfx);
        store();
      } else if (inside(x, y, b.music ?? {})) {
        save.music = save.music ? 0 : 0.6;
        sound.setVolume('music', save.music);
        store();
      } else if (inside(x, y, b.quit ?? {})) setScene(menu);
      if (inside(x, y, Object.values(b).find((r) => inside(x, y, r)) ?? { x: -1, y: -1, w: 0, h: 0 })) sound.play('buttonclick');
      return;
    }
    const tank = this.tank;
    if (y < BAR) {
      if (inside(x, y, MENU_BTN)) {
        sound.play('buttonclick');
        this.paused = true;
        return;
      }
      const shop = this.ui.shop;
      for (let i = 0; i < shop.length; i++) {
        if (shop[i] && inside(x, y, slotRect(i, shop.length))) {
          this.ui.pressed = i;
          this.ui.pressedT = 6;
          tank.buy(shop[i].id);
          this.events(tank.events.slice());
          if (tank.money < 100 && !tank.fish.some((f) => !f.dead) && this.def.index === 0) this.loan();
          return;
        }
      }
      return;
    }
    if (this.intro > 60) this.intro = 60;
    tank.click(x, y);
    this.events(tank.events.slice());
  },
  /** The original's one-time loan when a new player runs dry. */
  loan() {
    if (save.loan) return;
    save.loan = true;
    store();
    note('OUT OF MONEY!', say('note.loan'), () => (this.tank.money += 200));
  },
  key(e) {
    if (e.key === 'Escape' || e.key === 'p' || e.key === ' ') this.paused = !this.paused;
    if (/^[1-8]$/.test(e.key) && !this.paused) {
      const item = this.ui.shop[+e.key - 1];
      if (item) {
        this.tank.buy(item.id);
        this.events(this.tank.events.slice());
      }
    }
  },
  blur() {
    this.paused = true;
  },
  finish() {
    const tank = this.tank;
    const def = this.def;
    if (def.id === 'timetrial') {
      // The original's award: 5% of the money earned, in Shells.
      const shells = Math.floor((tank.stats.earned * SHELLS.timeTrialPercent) / 100) + tank.shells;
      save.shells += shells;
      const best = tank.stats.earned > save.timeTrial;
      if (best) save.timeTrial = tank.stats.earned;
      store();
      return setScene(results, { head: say('results.timetrial'), lines: [`Your Score: $${tank.stats.earned.toLocaleString('en-US')}`, `Your Best Score: $${save.timeTrial.toLocaleString('en-US')}${best ? '  (new!)' : ''}`, `${say('award').replace('%d%%', `${SHELLS.timeTrialPercent}%`)}: ${shells.toLocaleString('en-US')} Shells`], bonus: true, again: () => play(TIME_TRIAL, this.pets) });
    }
    if (tank.outcome === 'lost') {
      return setScene(results, { head: 'GAME OVER', lines: [say('end.died')], again: () => setScene(game, def, this.pets) });
    }
    if (def.challenge) {
      const n = def.challenge;
      const min = tank.time / 3600;
      const prev = save.challengeBest[n];
      const best = !prev || min < prev;
      if (best) save.challengeBest[n] = min;
      save.challengeBeaten[n] = true;
      const shells = SHELLS.challenge[n - 1] + tank.shells;
      save.shells += shells;
      store();
      return setScene(results, { head: say('results.challenge'), lines: [`${def.name} complete!`, `Level Time: ${min.toFixed(1)} min${best ? '  (new best!)' : ''}`, `${shells.toLocaleString('en-US')} Shells`], bonus: true, again: () => play(def, this.pets) });
    }
    if (def.boss) {
      save.beaten = true;
      save.wins++;
      const ending = () => setScene(results, { head: say('results.bonus'), lines: [say('end.boss1'), say('end.boss2'), save.wins === 1 ? say('end.boss3') : `${SHELLS.boss(save.wins).toLocaleString('en-US')} Shells`], bonus: true });
      if (!save.pets.includes(def.pet)) {
        // The first win hatches Presto and pays 5,000 Shells.
        save.pets.push(def.pet);
        save.shells += SHELLS.presto + tank.shells;
        store();
        return setScene(hatch, { pet: def.pet, def, time: tank.time / 3600, next: ending });
      }
      save.shells += SHELLS.boss(save.wins) + tank.shells;
      store();
      return ending();
    }
    // A level: record the time, hatch the egg's pet.
    const min = tank.time / 3600;
    const prev = save.best[def.id];
    save.best[def.id] = prev ? Math.min(prev, min) : min;
    save.shells += tank.shells;
    const newPet = def.pet && !save.pets.includes(def.pet) ? def.pet : null;
    if (newPet) save.pets.push(newPet);
    save.level = Math.max(save.level, def.index + 1);
    store();
    setScene(hatch, { pet: newPet ?? def.pet, def, time: min, extra: tank.shells ? `${tank.shells.toLocaleString('en-US')} Shells` : null });
  },
};

/**
 * Place shop items in the bar like the original: guppy, food quality and
 * quantity first, the weapon and egg in the last two slots, other fish between.
 */
function arrange(items) {
  const n = items.length > 7 ? 8 : 7;
  const out = Array(n).fill(null);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  ['guppy', 'quality', 'count'].forEach((id, k) => (out[k] = byId[id] ?? null));
  if (byId.egg) out[n - 1] = byId.egg;
  if (byId.weapon) out[byId.egg ? n - 2 : n - 1] = byId.weapon;
  let k = 3;
  for (const it of items) {
    if (['guppy', 'quality', 'count', 'weapon', 'egg'].includes(it.id)) continue;
    while (k < n && out[k]) k++;
    if (k < n) out[k++] = it;
  }
  return out;
}

function play(def, pets) {
  setScene(game, def, pets.slice(0, petLimit(def.id === 'virtual')));
}

/* ---------- Egg hatching ---------- */

const hatch = {
  enter(info) {
    this.info = info;
    this.t = 0;
    sound.playMusic('insaniq2');
  },
  draw() {
    this.t++;
    gfx.image('hatchscreen');
    const crack = this.t < 60 ? null : this.t < 60 + 39 ? 'eggcrack1' : this.t < 60 + 39 + 30 ? 'eggcrack2' : 'done';
    if (this.t === 60) sound.play('hatch');
    const cx = 320;
    const cy = 150;
    if (!this.info.pet) {
      // 4-5 has no egg of its own: on to the final battle.
      gfx.text('junglefever15outline', 'On to the alien homeworld!', cx, cy, { align: 'center' });
      this.t = Math.max(this.t, 140);
    } else if (!crack) {
      gfx.define('eggcrack1s', 'eggcrack1', 13, 1);
      gfx.frame('eggcrack1s', 0, 0, cx, cy);
    } else if (crack === 'eggcrack1') {
      gfx.define('eggcrack1s', 'eggcrack1', 13, 1);
      gfx.frame('eggcrack1s', (this.t - 60) / 3, 0, cx, cy);
    } else if (crack === 'eggcrack2') {
      gfx.define('eggcrack2s', 'eggcrack2', 10, 1);
      gfx.frame('eggcrack2s', (this.t - 99) / 3, 0, cx, cy);
    } else {
      gfx.define(`big_${this.info.pet}`, this.info.pet, 10, { stinky: 3, niko: 3, itchy: 4, prego: 4, zorf: 3, clyde: 1, vert: 2, rufus: 2, meryl: 4, wadsworth: 3, seymour: 2, shrapnel: 2, gumbo: 2, blip: 2, rhubarb: 2, nimbus: 2, amp: 2, gash: 3, angie: 2, presto: 3 }[this.info.pet] ?? 1);
      gfx.frame(`big_${this.info.pet}`, this.t / 3, 0, cx, cy, { scale: 1.3 });
      gfx.text('junglefever15outline', `This is ${PETS[this.info.pet].name}!`, cx, 222, { align: 'center' });
      body(say(`pet.${this.info.pet}`), 190, 262, 260, { align: 'center', color: '#ffffff' });
    }
    if (this.info.extra) gfx.text('continuumbold12outline', this.info.extra, cx, 372, { align: 'center', color: '#a8ecff' });
    gfx.text('continuumbold12outline', `${this.info.def.name} complete!  Level Time: ${this.info.time.toFixed(1)} min`, cx, 395, { align: 'center' });
    this.btn = this.t > 140 ? button('Click Here to Continue', 320, 430, 260) : null;
  },
  hand() {
    return this.btn && inside(mouse.x, mouse.y, this.btn);
  },
  click(x, y) {
    if (this.t < 140) {
      this.t = 140;
      return;
    }
    if (this.btn && inside(x, y, this.btn)) {
      sound.play('buttonclick');
      (this.info.next ?? startAdventure)();
    }
  },
};

/* ---------- Results ---------- */

const results = {
  enter(info) {
    this.info = info;
  },
  draw() {
    gfx.image('selectorback');
    gfx.ctx.fillStyle = 'rgba(0,0,30,0.35)';
    gfx.ctx.fillRect(0, 0, W, H);
    const reward = this.info.bonus ? nextReward() : null;
    const top = reward ? 20 : 100;
    panel(120, top, 400, reward ? 440 : 280);
    gfx.text('junglefever17outline', this.info.head, 320, top + 18, { align: 'center' });
    let y = top + 64;
    for (const l of this.info.lines) y += body(l, 150, y, 340, { align: 'center' }) + 4;
    this.buy = null;
    if (reward) {
      // The Bonus Reward: the next item, for Shells.
      y += 6;
      gfx.text('continuumbold14', say('bonus.reward'), 320, y, { align: 'center', color: '#3a2a10' });
      gfx.frame(reward.art, PETS[reward.id] ? 0 : t / 3, 0, 250, y + 62, { scale: PETS[reward.id] ? 0.6 : 0.8 });
      gfx.text('continuumbold12', reward.name, 380, y + 34, { align: 'center', color: '#3a2a10', maxWidth: 220 });
      gfx.text('continuumbold12', `${reward.price.toLocaleString('en-US')} Shells`, 380, y + 54, { align: 'center', color: '#3a2a10' });
      gfx.text('continuumbold12', `You have ${save.shells.toLocaleString('en-US')}`, 380, y + 72, { align: 'center', color: save.shells >= reward.price ? '#2a7a2a' : '#8a2a2a' });
      this.buy = save.shells >= reward.price ? button('Buy', 380, y + 100, 120) : null;
    }
    const by = reward ? 395 : 290;
    this.again = this.info.again ? button('Play Again', 320, by, 220) : null;
    this.back = button('Back to Main Menu', 320, by + 40, 220);
  },
  hand() {
    return [this.again, this.back, this.buy].some((r) => r && inside(mouse.x, mouse.y, r));
  },
  click(x, y) {
    if (this.buy && inside(x, y, this.buy)) {
      buyReward();
      return;
    }
    if (this.again && inside(x, y, this.again)) {
      sound.play('buttonclick');
      this.info.again();
    } else if (this.back && inside(x, y, this.back)) {
      sound.play('buttonclick');
      setScene(menu);
    }
  },
};


/** The next Bonus Reward on offer, or null once everything is bought. */
const EGG_ART = { brinkley: 'eggbrink', nostradamus: 'eggnostradamus', stanley: 'eggstanley', walter: 'eggwalter' };
function nextReward() {
  const id = BONUS_REWARD.items[save.bonusBought];
  if (!id) return null;
  const pet = PETS[id];
  return { id, price: BONUS_REWARD.price(save.bonusBought), art: pet ? EGG_ART[id] : 'petlimitegg', name: pet ? PETS[id].name : `${say('limit.now')} ${say(id === 'pets4' ? 'limit.four' : 'limit.seven')} ${say('limit.pets')}` };
}

function buyReward() {
  const r = nextReward();
  if (!r || save.shells < r.price) return;
  save.shells -= r.price;
  save.bonusBought++;
  if (PETS[r.id]) {
    if (!save.pets.includes(r.id)) save.pets.push(r.id);
    note(say('store.bought'), `${say(`title.${r.id}`)}  ${say(`bought.${r.id}`)}`);
  } else {
    save.maxPets = r.id === 'pets4' ? 4 : 7;
    note(say('limit.congrats'), `${r.name}  ${say(r.id === 'pets4' ? 'limit.insane' : 'limit.void')}`);
  }
  store();
  sound.play('hatch');
}

/* ---------- Challenge ---------- */

/** Pick a Challenge tank: tank 1, then each one after the last you've beaten. */
const challengePick = {
  layout() {
    return CHALLENGE.map((def, i) => ({ def, x: 125 + (i % 2) * 210, y: 88 + Math.floor(i / 2) * 170, w: 180, h: 135, open: i === 0 || save.challengeBeaten[i] }));
  },
  draw() {
    gfx.image('selectorback');
    gfx.ctx.fillStyle = 'rgba(0,0,30,0.35)';
    gfx.ctx.fillRect(0, 0, W, H);
    title('Challenge', 40);
    for (const b of this.layout()) {
      const hover = b.open && inside(mouse.x, mouse.y, b);
      gfx.ctx.save();
      gfx.ctx.globalAlpha = b.open ? 1 : 0.35;
      gfx.image(b.def.aquarium, b.x, b.y, { scale: b.w / 640 });
      gfx.ctx.restore();
      gfx.ctx.strokeStyle = hover ? '#ffff9a' : 'rgba(255,214,110,0.7)';
      gfx.ctx.lineWidth = hover ? 3 : 2;
      gfx.ctx.strokeRect(b.x, b.y, b.w, b.h);
      gfx.text('junglefever12outline', `Tank ${b.def.challenge}`, b.x + b.w / 2, b.y + b.h + 2, { align: 'center', color: hover ? '#ffff9a' : null });
      const best = save.challengeBest[b.def.challenge];
      const note = !b.open ? 'Locked' : best ? `Best: ${best.toFixed(1)} min` : `Egg pieces: $${b.def.egg.toLocaleString('en-US')}`;
      gfx.text('continuumbold12outline', note, b.x + b.w / 2, b.y + 58, { align: 'center' });
    }
    this.back = button('Back to Main Menu', 320, 448, 220);
  },
  hand() {
    return this.layout().some((b) => b.open && inside(mouse.x, mouse.y, b)) || (this.back && inside(mouse.x, mouse.y, this.back));
  },
  click(x, y) {
    const b = this.layout().find((o) => o.open && inside(x, y, o));
    if (b) {
      sound.play('buttonclick');
      if (save.pets.length > petLimit()) setScene(petPick, b.def);
      else play(b.def, save.pets.slice());
    } else if (this.back && inside(x, y, this.back)) {
      sound.play('buttonclick');
      setScene(menu);
    }
  },
};

/* ---------- Virtual Tank ---------- */

function saveVirtual(tank) {
  save.virtual = { money: tank.money, up: tank.up, fish: tank.fish.filter((f) => !f.dead).map((f) => ({ kind: f.kind, stage: f.stage, x: f.x, y: f.y })) };
  store();
}

/** The Fish Emporium: turn Shells into money for the Virtual Tank. */
const storeScene = {
  enter(from) {
    this.from = from;
  },
  draw() {
    gfx.image('store');
    gfx.text('junglefever15outline', say('store.thanks'), 320, 20, { align: 'center' });
    panel(170, 312, 300, 150);
    gfx.text('continuumbold14', `${save.shells.toLocaleString('en-US')} Shells`, 320, 328, { align: 'center', color: '#3a2a10' });
    this.buy = button('Trade 100 Shells for $1,000', 320, 362, 260);
    this.back = button('Back to Tank', 320, 407, 260);
  },
  hand() {
    return inside(mouse.x, mouse.y, this.buy ?? {}) || inside(mouse.x, mouse.y, this.back ?? {});
  },
  click(x, y) {
    if (this.buy && inside(x, y, this.buy)) {
      if (save.shells >= 100) {
        save.shells -= 100;
        save.virtual = save.virtual ?? { money: 0, up: {}, fish: [] };
        save.virtual.money = (save.virtual.money ?? 0) + 1000;
        store();
        sound.play('buy');
      } else {
        sound.play('buzzer');
        note('Not Enough Shells', say('note.shells'));
      }
    } else if (this.back && inside(x, y, this.back)) {
      sound.play('buttonclick');
      play(VIRTUAL, save.pets.slice(0, petLimit(true)));
    }
  },
};
storeScene.drawOver = drawNote;

/* ---------- Help, options, hall of fame, credits ---------- */

const help = {
  enter() {
    this.page = 0;
  },
  draw() {
    gfx.image('selectorback');
    gfx.ctx.fillStyle = 'rgba(0,0,30,0.35)';
    gfx.ctx.fillRect(0, 0, W, H);
    panel(60, 40, 520, 400);
    const p = HELP[this.page];
    gfx.text('junglefever15outline', 'Insaniquarium Help', 320, 56, { align: 'center' });
    gfx.text('continuumbold14', p.head, 320, 92, { align: 'center', color: '#3a2a10' });
    let y = 120;
    for (const para of p.text) y += body(para, 90, y, 460) + 7;
    gfx.text('continuumbold12', `Page ${this.page + 1} of ${HELP.length}`, 320, 370, { align: 'center', color: '#3a2a10' });
    this.prev = this.page > 0 ? button('Previous', 200, 390, 140) : null;
    this.next = this.page < HELP.length - 1 ? button('Next', 440, 390, 140) : null;
    this.back = button('Back', 320, 390, 90);
  },
  hand() {
    return [this.prev, this.next, this.back].some((r) => r && inside(mouse.x, mouse.y, r));
  },
  click(x, y) {
    if (this.prev && inside(x, y, this.prev)) this.page--;
    else if (this.next && inside(x, y, this.next)) this.page++;
    else if (inside(x, y, this.back)) setScene(menu);
    else return;
    sound.play('buttonclick');
  },
};

const options = {
  draw() {
    gfx.image('selectorback');
    gfx.ctx.fillStyle = 'rgba(0,0,30,0.35)';
    gfx.ctx.fillRect(0, 0, W, H);
    panel(170, 100, 300, 280);
    gfx.text('junglefever15outline', 'Options', 320, 118, { align: 'center' });
    this.b = {
      sfx: button(`Sound Fx: ${save.sfx ? 'On' : 'Off'}`, 320, 170, 220),
      music: button(`Music: ${save.music ? 'On' : 'Off'}`, 320, 212, 220),
      full: button(document.fullscreenElement ? 'Windowed' : 'Fullscreen', 320, 254, 220),
      reset: button('New Game', 320, 296, 220),
      back: button('Back to Main Menu', 320, 338, 220),
    };
  },
  hand() {
    return Object.values(this.b ?? {}).some((r) => inside(mouse.x, mouse.y, r));
  },
  click(x, y) {
    const b = this.b ?? {};
    if (inside(x, y, b.sfx ?? {})) {
      save.sfx = save.sfx ? 0 : 0.8;
      sound.setVolume('sfx', save.sfx);
    } else if (inside(x, y, b.music ?? {})) {
      save.music = save.music ? 0 : 0.6;
      sound.setVolume('music', save.music);
    } else if (inside(x, y, b.full ?? {})) {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    } else if (inside(x, y, b.reset ?? {})) {
      note('Are You Sure?', `${say('note.newGame')}  All your pets and progress will be deleted.`, () => {
        save = { ...fresh(), sfx: save.sfx, music: save.music };
        store();
      });
    } else if (inside(x, y, b.back ?? {})) setScene(menu);
    else return;
    sound.play('buttonclick');
    store();
  },
};
options.drawOver = drawNote;

const fame = {
  draw() {
    gfx.image('selectorback');
    gfx.ctx.fillStyle = 'rgba(0,0,30,0.35)';
    gfx.ctx.fillRect(0, 0, W, H);
    panel(110, 40, 420, 400);
    gfx.text('junglefever15outline', 'Hall of Fame', 320, 56, { align: 'center' });
    gfx.text('continuumbold14', 'Personal Records', 320, 92, { align: 'center', color: '#3a2a10' });
    const rows = [
      ['Pets', `${save.pets.length} / ${PET_ORDER.length + BONUS_PETS.length}`],
      ['Adventure', save.beaten ? 'Final Boss beaten!' : save.level ? LEVELS[Math.min(save.level, LEVELS.length - 1)].name : 'Not started'],
      ['Time Trial', save.timeTrial ? `$${save.timeTrial.toLocaleString('en-US')}` : '-'],
      ['Challenge', `${Object.keys(save.challengeBeaten).length} / ${CHALLENGE.length} tanks`],
      ['Shells', save.shells.toLocaleString('en-US')],
    ];
    rows.forEach(([k, v], i) => {
      gfx.text('liddie15', k, 150, 130 + i * 26, { color: '#3a2a10' });
      gfx.text('liddie15', v, 490, 130 + i * 26, { align: 'right', color: '#3a2a10' });
    });
    [...PET_ORDER, ...BONUS_PETS].forEach((id, i) => {
      const got = save.pets.includes(id);
      gfx.ctx.save();
      gfx.ctx.globalAlpha = got ? 1 : 0.25;
      gfx.frame(`scl_${id}`, 0, 0, 155 + (i % 12) * 30, 290 + Math.floor(i / 12) * 44, { scale: 0.48 });
      gfx.ctx.restore();
    });
    this.back = button('Back To Main Menu', 320, 390, 220);
  },
  hand() {
    return this.back && inside(mouse.x, mouse.y, this.back);
  },
  click(x, y) {
    if (this.back && inside(x, y, this.back)) {
      sound.play('buttonclick');
      setScene(menu);
    }
  },
};

const credits = {
  draw() {
    gfx.image('selectorback');
    gfx.ctx.fillStyle = 'rgba(0,0,30,0.35)';
    gfx.ctx.fillRect(0, 0, W, H);
    panel(110, 40, 420, 400);
    gfx.text('junglefever15outline', 'Credits', 320, 56, { align: 'center' });
    const lines = ['Insaniquarium Deluxe', 'by Flying Bear Entertainment, published by PopCap Games', '', 'Game Design: George Fan', 'Programming: George Fan, Thien Tran, Brian Rothstein', 'Character Design: Jonne Valtonen, George Fan', 'Producer: Jason Kapalka, Sukhbir Sidhu', '', 'This web version runs the original art and sound', 'from your own copy of the game.'];
    lines.forEach((l, i) => gfx.text('liddie15', l, 320, 100 + i * 24, { align: 'center', color: '#3a2a10' }));
    this.back = button('Back To Main Menu', 320, 390, 220);
  },
  hand() {
    return this.back && inside(mouse.x, mouse.y, this.back);
  },
  click(x, y) {
    if (this.back && inside(x, y, this.back)) {
      sound.play('buttonclick');
      setScene(menu);
    }
  },
};

/* Menus that can show a message box. */
for (const s of [menu, petPick, results, help, fame, credits, challengePick]) {
  const d = s.draw;
  s.draw = function () {
    d.call(this);
    this.okBtn = drawNote();
  };
  const c = s.click;
  s.click = function (x, y) {
    if (noteBox) {
      if (this.okBtn && inside(x, y, this.okBtn)) {
        const cb = noteBox.onClose;
        noteBox = null;
        cb?.();
      }
      return;
    }
    c.call(this, x, y);
  };
}
for (const s of [options, storeScene]) {
  const d = s.draw;
  s.draw = function () {
    d.call(this);
    this.okBtn = drawNote();
  };
  const c = s.click;
  s.click = function (x, y) {
    if (noteBox) {
      if (this.okBtn && inside(x, y, this.okBtn)) {
        const cb = noteBox.onClose;
        noteBox = null;
        cb?.();
      }
      return;
    }
    c.call(this, x, y);
  };
}

/* ---------- Loop ---------- */

let last = performance.now();
let acc = 0;
const STEP_MS = 1000 / 60;
function backdropFor(s) {
  if (s === game) return game.def.aquarium;
  if (s === loading) return 'titlescreen';
  if (s === hatch) return 'hatchscreen';
  if (s === petPick) return petPick.def?.aquarium ?? 'selectorback';
  if (s === storeScene) return 'store';
  return 'selectorback';
}
function frame(now) {
  acc += Math.min(250, now - last);
  last = now;
  while (acc >= STEP_MS) {
    acc -= STEP_MS;
    t++;
    scene.update?.();
    scene.hover?.();
    view?.polish.step();
  }
  gfx.setBackdrop(backdropFor(scene));
  gfx.begin(view?.polish.shakeOffset());
  scene.draw(acc / STEP_MS);
  view?.polish.drawFade();
  cursor();
  gfx.end();
  requestAnimationFrame(frame);
}

setScene(loading);
requestAnimationFrame(frame);
loadAll({ hd: true, first: ['titlescreen', 'loaderbar', 'loaderbarover', 'loaderplay', 'cursor_pointer'], onProgress: (k) => (progress = k) }).then(() => {
  view = createView(gfx);
  loading.ready = true;
  sound.preload(['buttonclick', 'dropfood', 'slurp', 'slurp2', 'slurp3', 'points', 'points2', 'points3', 'points4', 'diamond', 'treasure', 'buy', 'splash', 'splash2', 'splash3', 'buzzer', 'zap', 'hit', 'awooga', 'roar', 'roar2', 'roar3', 'chomp', 'chomp2', 'explode', 'die', 'grow']);
});

// For testing from the console.
window.__game = { get scene() { return scene; }, game, setScene, play, LEVELS, CHALLENGE, save: () => save, scenes: { challengePick, hatch, petPick, results, help, fame, options, menu, storeScene, credits } };
