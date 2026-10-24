// The opening: tear a sealed booster pack, the cards burst out into a fan and
// you flip each one to reveal it. When the set is complete the cards gather
// into a pile and hand over to the deck (stack.js).
import { pieces, N, RARITY, makeCard, preload, anim, flip, wait, motion, sound } from './cards.js';

const $ = (id) => document.getElementById(id);

/**
 * @param {object} o
 * @param {(index: number) => void} o.onComplete  every card is revealed (or one
 *   revealed card was picked): hand over to the deck with `index` on top.
 */
export function createPack({ onComplete }) {
  const stage = $('opening');
  const pack = $('pack');
  const packTop = pack.querySelector('.pack-top');
  const packBody = pack.querySelector('.pack-body');
  const shadow = pack.querySelector('.pack-shadow');
  const hit = $('pack-hit');
  const tearBar = $('tear-progress');
  const cardsEl = $('fan');
  const hint = $('pack-hint');
  const revealAllBtn = $('reveal-all');
  const stamp = $('stamp');

  let state = 'sealed'; // sealed | opening | fanned | done
  let slots = [];
  let geo = null;
  let revealed = 0;
  let doneTimer = 0;
  let run = 0; // bumps on every reset so stale async steps stop

  const HINT_SEALED = 'Drag along the top edge to tear it open, or tap';

  // ---------- Pack outline: zigzag crimps and a ragged tear line ----------
  function zig(teeth, yA, yB, reverse = false) {
    const pts = [];
    for (let k = 0; k <= teeth * 2; k++) pts.push(`${((k / (teeth * 2)) * 100).toFixed(2)}% ${k % 2 ? yB : yA}`);
    return reverse ? pts.reverse() : pts;
  }

  function shapePack() {
    const teeth = 14;
    const steps = 22;
    const seam = [];
    for (let k = 0; k <= steps; k++) seam.push([((k / steps) * 100).toFixed(2), (Math.random() * 5).toFixed(1)]);
    const top = zig(teeth, '6px', '0px');
    const bottom = zig(teeth, 'calc(100% - 6px)', '100%', true);
    packTop.style.clipPath = `polygon(${[...top, ...seam.slice().reverse().map(([x, j]) => `${x}% calc(100% - ${j}px)`)].join(',')})`;
    packBody.style.clipPath = `polygon(${[...seam.map(([x, j]) => `${x}% calc(17% - ${j}px)`), ...bottom].join(',')})`;
    shadow.style.clipPath = `polygon(${[...top, ...bottom].join(',')})`;
  }

  // The window on the pack: a strip of real pieces peeking through.
  $('pack-strip').innerHTML = ['lsd', 'blossoming-flowers', 'text-fields', 'adaptive-fields']
    .map((s) => pieces.find((p) => p.slug === s))
    .filter(Boolean)
    .map((p) => `<img src="${p.thumb}" width="480" height="300" alt="" decoding="async">`)
    .join('');

  // ---------- Layout: one row, or 4 + 3 on an upright phone ----------
  function layout() {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const portrait = W < 700 && H > W * 1.15;
    const rows = portrait ? [4, 3] : [N];
    const hudH = H < 480 ? 70 : 118;
    const availH = H - hudH - 24;
    const availW = W * (portrait ? 0.86 : 0.94);
    const maxPer = Math.max(...rows);
    const rowStep = 1.03;
    let cw = Math.min(212, availH / (1.4 * (1 + (rows.length - 1) * rowStep) + 0.14));
    cw = Math.floor(Math.min(cw, availW / (1 + (maxPer - 1) * 0.46)));
    const dx = Math.min(cw * 0.7, (availW - cw) / (maxPer - 1));
    const blockH = cw * 1.4 * (1 + (rows.length - 1) * rowStep);
    const top = 14 + (availH - blockH) / 2;
    const pos = [];
    rows.forEach((count, r) => {
      const rowY = top + cw * 0.7 + r * cw * 1.4 * rowStep;
      for (let j = 0; j < count; j++) {
        const t = j - (count - 1) / 2;
        pos.push({ x: t * dx, y: rowY + t * t * cw * 0.03, r: t * (rows.length > 1 ? 5 : 4) });
      }
    });
    return { W, H, cw, pos, packCy: H / 2 - 26 };
  }

  const at = (p, extra = '') => `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px) rotate(${p.r.toFixed(2)}deg)${extra}`;

  // ---------- Cards ----------
  function buildCards() {
    cardsEl.innerHTML = '';
    cardsEl.className = 'fan';
    geo = layout();
    cardsEl.style.setProperty('--cw', geo.cw + 'px');
    slots = pieces.map((p, i) => {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.setAttribute('role', 'listitem');
      slot.style.zIndex = String(i + 1);
      const card = makeCard(p, { down: true, sizes: Math.round(geo.cw * 2) + 'px', eager: true });
      const flash = document.createElement('div');
      flash.className = 'flash';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.disabled = true;
      btn.addEventListener('click', () => onCard(i));
      slot.append(card, flash, btn);
      cardsEl.append(slot);
      return { slot, card, btn, flash, p, up: false };
    });
    label();
    // The cards already sit inside the sealed pack (hidden behind it), so they
    // are painted before the tear rather than in the middle of the burst.
    if (!motion.reduced) {
      const { start, s0 } = inPack();
      slots.forEach((s) => {
        s.slot.style.transform = at(start, ` scale(${s0})`);
      });
      cardsEl.classList.add('is-live');
    }
  }

  /** Where the cards sit inside the pack. */
  function inPack() {
    const pr = pack.getBoundingClientRect();
    return { pr, s0: (pr.width * 0.84) / geo.cw, start: { x: 0, y: geo.packCy + pr.height * 0.08, r: 0 } };
  }

  function label() {
    slots.forEach((s, i) => {
      s.btn.setAttribute(
        'aria-label',
        s.up
          ? `${s.p.title}, card ${i + 1} of ${N}, ${RARITY[s.p.rarity]}. Browse the deck from here`
          : `Card ${i + 1} of ${N}, face down. Reveal`,
      );
    });
    const next = slots.findIndex((s) => !s.up);
    slots.forEach((s, i) => s.slot.classList.toggle('is-next', state === 'fanned' && i === next));
  }

  function placeFan() {
    geo = layout();
    cardsEl.style.setProperty('--cw', geo.cw + 'px');
    slots.forEach((s, i) => {
      s.slot.style.transform = at(geo.pos[i]);
    });
  }

  // ---------- Tearing ----------
  let drag = null;
  let dragged = false;
  let pointerUsed = false; // the pack was handled by mouse or touch, not the keyboard

  function setTear(p) {
    tearBar.style.transform = `scaleX(${p})`;
    packTop.style.transform = p ? `translateY(${(-p * 4).toFixed(1)}px) rotate(${(-p * 7).toFixed(2)}deg)` : '';
  }

  hit.addEventListener('pointerdown', (e) => {
    if (state !== 'sealed') return;
    pointerUsed = true;
    drag = { x: e.clientX, y: e.clientY, p: 0, lastTick: 0 };
    dragged = false;
    hit.setPointerCapture(e.pointerId);
  });

  hit.addEventListener('pointermove', (e) => {
    if (state !== 'sealed') return;
    const r = pack.getBoundingClientRect();
    // the foil follows a mouse; the pack leans toward it
    if (e.pointerType === 'mouse' && !motion.reduced) {
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      pack.classList.remove('is-idle');
      pack.style.setProperty('--sx', `${(px * 60).toFixed(1)}%`);
      pack.style.transform = `perspective(900px) rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 10).toFixed(2)}deg)`;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - drag.y) > 8) dragged = true;
    const p = Math.max(0, Math.min(1, dx / (r.width * 0.8)));
    drag.p = p;
    setTear(p);
    if (p - drag.lastTick > 0.12) {
      drag.lastTick = p;
      sound.tick();
    }
    if (p >= 1) {
      drag = null;
      open();
    }
  });

  const endDrag = () => {
    if (!drag) return;
    const { p } = drag;
    drag = null;
    if (!dragged) return; // a tap: the click handler opens it
    if (p > 0.55) open();
    else springBack(p);
  };
  hit.addEventListener('pointerup', endDrag);
  hit.addEventListener('pointercancel', endDrag);
  hit.addEventListener('pointerleave', () => {
    if (state !== 'sealed' || drag) return;
    pack.classList.add('is-idle');
    pack.style.transform = '';
  });
  hit.addEventListener('click', () => {
    if (state !== 'sealed') return;
    if (dragged) {
      dragged = false;
      return;
    }
    autoTear();
  });

  async function springBack(p) {
    await Promise.all([
      anim(tearBar, [{ transform: `scaleX(${p})` }, { transform: 'scaleX(0)' }], { duration: 220, easing: 'ease-out' }),
      anim(packTop, [{ transform: packTop.style.transform || 'none' }, { transform: 'none' }], {
        duration: 260,
        easing: 'cubic-bezier(.3,1.6,.5,1)',
      }),
    ]);
    setTear(0);
  }

  async function autoTear() {
    if (state !== 'sealed') return;
    state = 'opening';
    if (!motion.reduced) {
      sound.tear();
      const ease = { duration: 360, easing: 'cubic-bezier(.5,0,.3,1)' };
      await Promise.all([
        anim(tearBar, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], ease),
        anim(packTop, [{ transform: 'none' }, { transform: 'translateY(-4px) rotate(-7deg)' }], ease),
      ]);
    }
    state = 'sealed';
    open();
  }

  // ---------- Opening sequence ----------
  async function open() {
    if (state !== 'sealed') return;
    const my = run;
    state = 'opening';
    // Opened from the keyboard: carry focus on to the first card.
    const hadFocus = document.activeElement === hit && !pointerUsed;
    hit.disabled = true;
    pack.classList.add('is-torn');
    pack.classList.remove('is-idle');
    shadow.style.clipPath = packBody.style.clipPath; // the torn strip takes its shadow with it
    hint.textContent = 'Opening…';
    await preload();
    if (my !== run) return;
    geo = layout();
    const { pr, s0, start } = inPack();

    if (motion.reduced) {
      await anim(pack, [{ opacity: 1 }, { opacity: 0 }], { duration: 220 });
      pack.classList.add('is-gone');
      placeFan();
      cardsEl.classList.add('is-live');
      await anim(cardsEl, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
      if (my === run) fanned(hadFocus);
      return;
    }

    sound.tear();
    // 1. the strip flies off
    const flyTop = anim(
      packTop,
      [
        { transform: packTop.style.transform || 'none', opacity: 1 },
        { transform: `translate(${pr.width * 0.5}px, ${-pr.height * 0.45}px) rotate(28deg)`, opacity: 0 },
      ],
      { duration: 520, easing: 'cubic-bezier(.2,.6,.3,1)' },
    );
    pack.style.transform = '';
    anim(
      pack,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-5px) rotate(-1deg)' },
        { transform: 'translateX(4px) rotate(.8deg)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 220 },
    );

    // 2. the cards rise out of the pack, still face down
    slots.forEach((s) => {
      s.slot.style.transform = at(start, ` scale(${s0})`);
    });
    cardsEl.classList.add('is-live');
    await wait(140);
    await Promise.all(
      slots.map((s, i) => {
        const up = { x: (i - 3) * pr.width * 0.012, y: geo.packCy - pr.height * 0.5 - i * 2, r: (i - 3) * 1.6 };
        return wait(i * 28).then(() => {
          sound.tick();
          return anim(s.slot, [{ transform: at(start, ` scale(${s0})`) }, { transform: at(up, ` scale(${s0})`) }], {
            duration: 420,
            easing: 'cubic-bezier(.15,.8,.25,1)',
          });
        });
      }),
    );
    await flyTop;
    if (my !== run) return;

    // 3. the empty pack drops away; the cards come to the front
    cardsEl.style.zIndex = '4';
    anim(
      pack,
      [
        { transform: 'none', opacity: 1 },
        { transform: `translateY(${geo.H * 0.55}px) rotate(9deg)`, opacity: 0 },
      ],
      { duration: 520, easing: 'cubic-bezier(.5,0,.8,.4)' },
    ).then(() => pack.classList.add('is-gone'));

    // 4. burst into the fan
    await Promise.all(
      slots.map((s, i) =>
        wait(60 + i * 46).then(() => {
          sound.tick();
          return anim(s.slot, [{ transform: s.slot.style.transform }, { transform: at(geo.pos[i]) }], {
            duration: 560,
            easing: 'cubic-bezier(.2,1.25,.35,1)',
          });
        }),
      ),
    );
    if (my === run) fanned(hadFocus);
  }

  function fanned(focusFirst) {
    state = 'fanned';
    cardsEl.classList.add('is-fanned');
    slots.forEach((s) => {
      s.btn.disabled = false;
    });
    revealAllBtn.hidden = false;
    updateHint();
    label();
    if (focusFirst) slots[0].btn.focus({ preventScroll: true });
  }

  function updateHint() {
    hint.innerHTML =
      revealed < N ? `Tap a card to turn it over · <b>${revealed}/${N}</b>` : 'Into your deck…';
  }

  // ---------- Reveal ----------
  async function reveal(i, fast = false) {
    const s = slots[i];
    if (s.up) return;
    s.up = true;
    revealed++;
    label();
    updateHint();
    sound.flip();
    await flip(s.card, true, { duration: fast ? 420 : 560 });
    if (!motion.reduced) {
      if (s.p.rarity >= 2) {
        anim(s.flash, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.08)' }], {
          duration: 520,
          easing: 'ease-out',
        });
      }
      if (s.p.rarity === 3) {
        sound.holo();
        const sheen = s.card.querySelector('.card-sheen');
        anim(
          sheen,
          [
            { transform: 'translateX(-45%)', opacity: 1 },
            { transform: 'translateX(45%)', opacity: 1 },
          ],
          { duration: 760, easing: 'cubic-bezier(.4,0,.2,1)' },
        ).then(() => {
          sheen.style.transform = '';
          sheen.style.opacity = '';
        });
      }
    }
    if (revealed === N) complete();
  }

  function complete() {
    if (!stamp.hidden || state !== 'fanned') return;
    revealAllBtn.hidden = true;
    stamp.hidden = false;
    if (!motion.reduced) {
      anim(
        stamp,
        [
          { transform: 'rotate(-4deg) scale(1.8)', opacity: 0 },
          { transform: 'rotate(-4deg) scale(1)', opacity: 1 },
        ],
        { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' },
      ).then(() => {
        stamp.style.transform = '';
      });
    }
    // let the full set sit for a moment, then hand over to the deck
    clearTimeout(doneTimer);
    doneTimer = setTimeout(() => finish(0), motion.reduced ? 700 : 1300);
  }

  function finish(index) {
    if (state !== 'fanned') return;
    clearTimeout(doneTimer);
    state = 'done';
    onComplete(index);
  }

  revealAllBtn.addEventListener('click', async () => {
    const my = run;
    revealAllBtn.hidden = true;
    for (let i = 0; i < N; i++) {
      if (my !== run || state !== 'fanned') return;
      if (slots[i].up) continue;
      reveal(i, true);
      await wait(motion.reduced ? 60 : 150);
    }
  });

  function onCard(i) {
    if (state !== 'fanned') return;
    if (!slots[i].up) reveal(i);
    else finish(i); // a revealed card: browse the deck from this one
  }

  // Arrow keys move along the fan.
  cardsEl.addEventListener('keydown', (e) => {
    if (state !== 'fanned') return;
    const i = slots.findIndex((s) => s.btn === document.activeElement);
    if (i < 0) return;
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    slots[(i + d + N) % N].btn.focus();
  });

  /**
   * Gather the fan into a pile over `target` (the deck's top card, viewport
   * coordinates), card `top` uppermost, so the deck can take over seamlessly.
   */
  async function gather(target, top = 0) {
    if (!slots.length) return;
    const origin = cardsEl.getBoundingClientRect();
    const cx = target.left + target.width / 2 - origin.left;
    const cy = target.top + target.height / 2 - origin.top;
    const s = target.width / geo.cw;
    const ROT = [0, -2.2, 2.6, -3.4, 3.8, -4.6, 5];
    if (motion.reduced) return;
    cardsEl.classList.remove('is-fanned');
    await Promise.all(
      slots.map((sl, i) => {
        const d = (i - top + N) % N;
        sl.slot.style.zIndex = String(20 - d);
        const k = Math.min(d, 6);
        const to = `translate(${(cx + k * target.width * 0.012).toFixed(1)}px, ${(cy + k * target.width * 0.018).toFixed(1)}px) rotate(${ROT[k]}deg) scale(${(s * (1 - k * 0.02)).toFixed(3)})`;
        return wait(d * 26).then(() =>
          anim(sl.slot, [{ transform: sl.slot.style.transform }, { transform: to }], {
            duration: 520,
            easing: 'cubic-bezier(.3,.8,.25,1)',
          }),
        );
      }),
    );
    sound.thump();
  }

  // ---------- Reset / resize ----------
  function reset() {
    run++;
    clearTimeout(doneTimer);
    state = 'sealed';
    revealed = 0;
    pointerUsed = false;
    stamp.hidden = true;
    revealAllBtn.hidden = true;
    hit.disabled = false;
    pack.className = 'pack is-idle';
    for (const el of [pack, packTop, packBody, tearBar, cardsEl]) {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = '';
      el.style.opacity = '';
    }
    cardsEl.style.zIndex = '';
    shapePack();
    setTear(0);
    buildCards();
    hint.textContent = HINT_SEALED;
  }

  /** Show a fresh, sealed pack. */
  function start() {
    reset();
    if (!motion.reduced) {
      anim(pack, [{ transform: 'translateY(30%)', opacity: 0 }, { transform: 'none', opacity: 1 }], {
        duration: 420,
        easing: 'cubic-bezier(.2,.9,.3,1)',
      }).then(() => {
        pack.style.transform = '';
        pack.style.opacity = '';
      });
    }
    // warm the art while the visitor looks at the sealed pack
    (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => preload());
  }

  let rz = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      if (state === 'fanned') placeFan();
    });
  });

  return {
    start,
    gather,
    /** Stop everything (a skip or leaving the opening). */
    stop() {
      run++;
      clearTimeout(doneTimer);
      state = 'done';
    },
    get state() {
      return state;
    },
    focusStart() {
      hit.focus({ preventScroll: true });
    },
  };
}
