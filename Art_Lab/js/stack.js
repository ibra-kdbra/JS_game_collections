// The deck: a living stack of cards with a big top card. Swipe, scroll, use
// the arrow keys or the numbered tabs to move through it; the details panel
// beside it has the Enter link and an optional live preview of the real piece.
import { pieces, N, RARITY, pad, pips, esc, makeCard, anim, motion, sound } from './cards.js';

const $ = (id) => document.getElementById(id);

// Settings that are easy to change.
const LIVE_FOLLOWS = false; // true: live preview stays on and moves to the next card
const LIVE_DELAY = 350; // ms after a card settles before its preview loads
const LIVE_TIMEOUT = 4000; // show the preview even if it never says it is ready

// Depth pose: a loose, slightly fanned pile under the top card.
const ROT = [0, -2.2, 2.6, -3.4, 3.8, -4.6, 5];

const coarse = matchMedia('(pointer: coarse)');

export function createStack() {
  const browser = $('deck');
  const area = $('card-area');
  const stack = $('stack');
  const info = $('info');
  const pipRow = $('pip-row');
  const toast = $('deck-toast');

  let state = 'idle'; // idle | browse | moving
  let cw = 300;
  let cards = [];
  let order = pieces.map((_, i) => i); // order[0] is on top
  let live = false;
  let liveTimer = 0;
  let readyTimer = 0;
  let queue = 0;
  let toastTimer = 0;

  // ---------- Size ----------
  function measure() {
    const r = area.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const landscapePhone = innerHeight <= 500 && innerWidth > innerHeight;
    const byH = (r.height - 28) / 1.4;
    cw = Math.max(120, Math.floor(landscapePhone ? Math.min(byH, 260) : Math.min(380, r.width * 0.8, byH)));
    browser.style.setProperty('--cw', cw + 'px');
  }

  function pose(d) {
    if (d === 0) return 'translate(0px, 0px) rotate(0deg)';
    const k = Math.min(d, 6);
    return `translate(${(k * cw * 0.012).toFixed(1)}px, ${(k * cw * 0.018).toFixed(1)}px) rotate(${ROT[k]}deg) scale(${(1 - k * 0.02).toFixed(3)})`;
  }

  function build() {
    stack.querySelectorAll('.scard').forEach((el) => el.remove());
    cards = pieces.map((p) => {
      const el = document.createElement('div');
      el.className = 'scard';
      el.append(makeCard(p, { flat: true, sizes: '340px', eager: true }));
      stack.prepend(el);
      return {
        el,
        p,
        card: el.firstElementChild,
        img: el.querySelector('.card-art img'),
        art: el.querySelector('.card-art'),
        sheen: el.querySelector('.card-sheen'),
        lift: el.querySelector('.card-lift'),
      };
    });
  }

  function restack() {
    order.forEach((ci, d) => {
      const c = cards[ci];
      c.el.style.zIndex = String(10 - d);
      c.el.style.transform = pose(d);
      c.el.classList.toggle('is-top', d === 0);
    });
    const p = pieces[order[0]];
    stack.setAttribute('aria-label', `${p.title}, card ${p.n} of ${N}. Arrow keys move through the deck, Enter opens the piece`);
  }

  // ---------- Details panel ----------
  function renderInfo(animate = true) {
    const p = pieces[order[0]];
    const engineTag = p.tags.some((t) => t.toLowerCase() === p.engine.toLowerCase()) ? '' : `<span class="chip">${esc(p.engine)}</span>`;
    info.innerHTML = `<p class="info-no">No. ${pad(p.n)} / ${pad(p.total)} · ${RARITY[p.rarity]} <span aria-hidden="true" class="info-pips">${pips(p.rarity)}</span></p>
<h2 class="info-title" id="info-title">${esc(p.title)}</h2>
<div class="info-tags">${engineTag}${p.tags.map((t) => `<span class="chip">${esc(t)}</span>`).join('')}</div>
<p class="info-desc">${esc(p.blurb)}</p>
${p.controls ? `<p class="info-ctrl"><b>How to play with it</b>${esc(p.controls)}</p>` : ''}
<div class="info-actions">
  <a class="btn btn-primary" id="enter-link" href="${p.url}" target="_blank" rel="noopener" aria-label="Enter ${esc(p.title)} (opens in a new tab)">Enter <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
  <button class="btn" type="button" id="live-btn" aria-pressed="${live}" aria-describedby="live-desc"><span class="live-dot" aria-hidden="true"></span>Live preview</button>
</div>
<p class="sr-only" id="live-desc">Runs the real piece inside the card, muted. Uses more battery.</p>
<p class="info-hint" aria-hidden="true">Swipe the card, scroll, or use <kbd>&larr;</kbd> <kbd>&rarr;</kbd> and <kbd>1</kbd>–<kbd>${N}</kbd></p>`;
    $('live-btn').addEventListener('click', toggleLive);
    if (animate && !motion.reduced) {
      anim(info, [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], {
        duration: 200,
        easing: 'ease-out',
      });
    }
  }

  function renderPips() {
    if (!pipRow.children.length) {
      pipRow.innerHTML = pieces
        .map((p, i) => `<button class="pip" type="button" data-i="${i}" aria-label="${esc(p.title)}, card ${p.n} of ${N}">${pad(p.n)}</button>`)
        .join('');
      pipRow.addEventListener('click', (e) => {
        const b = e.target.closest('.pip');
        if (b) goTo(+b.dataset.i);
      });
    }
    [...pipRow.children].forEach((b, i) => b.setAttribute('aria-current', String(i === order[0])));
  }

  // ---------- Moving through the deck ----------
  async function next(dir = -1, fast = false, fromDrag = null) {
    if (state === 'moving') {
      queue = 1;
      return;
    }
    if (state !== 'browse') return;
    state = 'moving';
    leaveCard();
    const top = cards[order[0]];
    calm(top);
    order.push(order.shift());
    renderPips();
    renderInfo();
    sound.flip();
    const t = fast ? 0.55 : 1;
    if (motion.reduced) {
      await anim(top.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 120 });
      restack();
      await anim(top.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 120 });
    } else {
      const out = `translate(${dir * cw * 1.08}px, ${-cw * 0.06}px) rotate(${dir * 16}deg)`;
      order.slice(0, -1).forEach((ci, d) => {
        const c = cards[ci];
        c.el.style.zIndex = String(10 - d);
        anim(c.el, [{ transform: c.el.style.transform }, { transform: pose(d) }], {
          duration: 300 * t,
          delay: 60 * t,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      });
      await anim(top.el, [{ transform: fromDrag || top.el.style.transform }, { transform: out }], {
        duration: 210 * t,
        easing: 'cubic-bezier(.4,0,1,1)',
      });
      top.el.style.zIndex = '1';
      await anim(top.el, [{ transform: out }, { transform: pose(N - 1) }], { duration: 300 * t, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    settle();
  }

  async function prev(fast = false) {
    if (state === 'moving') {
      queue = -1;
      return;
    }
    if (state !== 'browse') return;
    state = 'moving';
    leaveCard();
    calm(cards[order[0]]);
    const ci = order.pop();
    order.unshift(ci);
    const c = cards[ci];
    renderPips();
    renderInfo();
    sound.flip();
    const t = fast ? 0.55 : 1;
    if (motion.reduced) {
      restack();
      await anim(c.el, [{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
    } else {
      const out = `translate(${cw * 1.08}px, ${-cw * 0.06}px) rotate(16deg)`;
      await anim(c.el, [{ transform: c.el.style.transform }, { transform: out }], { duration: 220 * t, easing: 'cubic-bezier(.3,0,.6,1)' });
      c.el.style.zIndex = '20';
      order.slice(1).forEach((cj, d) => {
        const o = cards[cj];
        o.el.style.zIndex = String(9 - d);
        anim(o.el, [{ transform: o.el.style.transform }, { transform: pose(d + 1) }], {
          duration: 280 * t,
          easing: 'cubic-bezier(.2,.8,.2,1)',
        });
      });
      await anim(c.el, [{ transform: out }, { transform: pose(0) }], { duration: 300 * t, easing: 'cubic-bezier(.2,.9,.25,1)' });
    }
    settle();
  }

  function settle() {
    restack();
    state = 'browse';
    if (queue) {
      const q = queue;
      queue = 0;
      return q > 0 ? next(-1, true) : prev(true);
    }
    scheduleLive();
  }

  const waitIdle = () =>
    new Promise((r) => {
      const f = () => (state !== 'moving' ? r() : requestAnimationFrame(f));
      f();
    });

  async function goTo(i) {
    if (state === 'moving') await waitIdle();
    const k = order.indexOf(i);
    if (k <= 0 || state !== 'browse') return;
    if (k <= N / 2) {
      for (let s = 0; s < k; s++) {
        await next(-1, true);
        await waitIdle();
      }
    } else {
      for (let s = 0; s < N - k; s++) {
        await prev(true);
        await waitIdle();
      }
    }
  }

  // Drag the top card; let go past the threshold to flick it under the deck.
  let drag = null;
  stack.addEventListener('pointerdown', (e) => {
    if (state !== 'browse' || e.button > 0) return;
    const top = cards[order[0]];
    if (!top.el.contains(e.target)) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), dx: 0, dy: 0, el: top.el };
    stack.setPointerCapture(e.pointerId);
  });
  stack.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dx = e.clientX - drag.x;
    drag.dy = e.clientY - drag.y;
    if (!motion.reduced) drag.el.style.transform = `translate(${drag.dx}px, ${drag.dy * 0.25}px) rotate(${drag.dx * 0.06}deg)`;
  });
  const endDrag = () => {
    if (!drag) return;
    const { dx, dy, t, el } = drag;
    drag = null;
    const v = Math.abs(dx) / Math.max(1, performance.now() - t);
    if (Math.abs(dx) > cw * 0.25 || (v > 0.5 && Math.abs(dx) > 30)) return next(dx < 0 ? -1 : 1, false, el.style.transform);
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return next(-1); // a tap turns to the next card
    anim(el, [{ transform: el.style.transform }, { transform: pose(0) }], { duration: 260, easing: 'cubic-bezier(.3,1.4,.5,1)' });
  };
  stack.addEventListener('pointerup', endDrag);
  stack.addEventListener('pointercancel', endDrag);

  let wheelAcc = 0;
  let wheelLock = 0;
  area.addEventListener(
    'wheel',
    (e) => {
      if (state === 'idle') return;
      e.preventDefault();
      const now = performance.now();
      if (now < wheelLock) return;
      wheelAcc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(wheelAcc) > 50) {
        if (wheelAcc > 0) next(-1);
        else prev();
        wheelAcc = 0;
        wheelLock = now + 340;
      }
    },
    { passive: false },
  );

  /** Keys for the deck view; returns true when handled. */
  function onKey(e) {
    if (state === 'idle') return false;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown') next(-1);
    else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp') prev();
    else if (k === 'Home') goTo(0);
    else if (k === 'End') goTo(N - 1);
    else if (/^[1-9]$/.test(k) && +k <= N) goTo(+k - 1);
    else if (k === 'Escape' && live) toggleLive();
    else if (k === 'Enter' && e.target === stack) $('enter-link').click();
    else return false;
    return true;
  }

  $('next-btn').addEventListener('click', () => next(-1));
  $('prev-btn').addEventListener('click', () => prev());

  // ---------- Alive: with a mouse over it, the top card tilts and its art
  // follows the pointer; otherwise the art drifts on its own (CSS). ----------
  let raf = 0;
  let pointer = { x: 0, y: 0 };
  let lastPointer = 0;
  const cur = { x: 0, y: 0 };
  area.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || motion.reduced || state !== 'browse' || live) return;
    const r = stack.getBoundingClientRect();
    pointer = {
      x: Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width - 0.5)),
      y: Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height - 0.5)),
    };
    lastPointer = performance.now();
    if (!raf) {
      stack.classList.add('is-steer');
      cards[order[0]].card.classList.add('is-lit');
      raf = requestAnimationFrame(frame);
    }
  });

  function frame(now) {
    const top = cards[order[0]];
    if (state !== 'browse' || drag || live || now - lastPointer > 1800) {
      raf = 0;
      calm(top);
      stack.classList.remove('is-steer');
      return;
    }
    raf = requestAnimationFrame(frame);
    cur.x += (pointer.x - cur.x) * 0.12;
    cur.y += (pointer.y - cur.y) * 0.12;
    top.img.style.transform = `translate(${(-cur.x * 7).toFixed(2)}%, ${(-cur.y * 7).toFixed(2)}%) scale(1.14)`;
    top.lift.style.transform = `perspective(1000px) rotateX(${(-cur.y * 7).toFixed(2)}deg) rotateY(${(cur.x * 9).toFixed(2)}deg)`;
    top.sheen.style.transform = `translateX(${(-40 + (cur.x + 0.5) * 55).toFixed(1)}%)`;
  }

  function calm(c) {
    c.img.style.transform = '';
    c.sheen.style.transform = '';
    c.lift.style.transform = '';
    c.card.classList.remove('is-lit');
  }

  function stopAlive() {
    cancelAnimationFrame(raf);
    raf = 0;
    stack.classList.remove('is-steer');
    cards.forEach(calm);
  }

  // ---------- Live preview: the real piece (?embed=1) inside the art window ----------
  function setLiveButton() {
    const b = $('live-btn');
    if (b) b.setAttribute('aria-pressed', String(live));
    stack.classList.toggle('is-live', live);
  }

  function toggleLive() {
    live = !live;
    setLiveButton();
    if (live) {
      scheduleLive(0);
      if (coarse.matches) say('Live preview on. It runs the real piece, so it uses more battery.');
    } else unmountLive();
  }

  function leaveCard() {
    unmountLive();
    if (!LIVE_FOLLOWS && live) {
      live = false;
      setLiveButton();
    }
  }

  function scheduleLive(delay = LIVE_DELAY) {
    clearTimeout(liveTimer);
    if (!live || state !== 'browse') return;
    liveTimer = setTimeout(mountLive, delay);
  }

  function unmountLive() {
    clearTimeout(liveTimer);
    clearTimeout(readyTimer);
    stack.querySelectorAll('.live-frame, .live-tag').forEach((f) => f.remove());
  }

  function mountLive() {
    unmountLive();
    const top = cards[order[0]];
    const f = document.createElement('iframe');
    f.className = 'live-frame';
    f.title = `${top.p.title}, live preview`;
    f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    const url = new URL(top.p.url);
    url.searchParams.set('embed', '1');
    f.src = url.href;
    const show = () => {
      clearTimeout(readyTimer);
      f.classList.add('is-on');
    };
    f.addEventListener('load', () => {
      clearTimeout(readyTimer);
      readyTimer = setTimeout(show, LIVE_TIMEOUT);
    });
    f.onready = show;
    const tag = document.createElement('span');
    tag.className = 'live-tag';
    tag.textContent = 'Live';
    top.art.append(f, tag);
  }

  // A piece in embed mode says when its first frame is drawn.
  addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.artlab !== 'ready') return;
    const f = [...stack.querySelectorAll('.live-frame')].find((x) => x.contentWindow === e.source);
    if (f && f.onready) f.onready();
  });

  // ---------- Announcements ----------
  function say(text) {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  let rz = 0;
  addEventListener('resize', () => {
    cancelAnimationFrame(rz);
    rz = requestAnimationFrame(() => {
      if (state === 'idle') return;
      measure();
      restack();
    });
  });

  build();
  // Decode the art ahead of time, so the first look at each card never stalls.
  (window.requestIdleCallback || ((f) => setTimeout(f, 300)))(() => cards.forEach((c) => c.img.decode().catch(() => {})));
  renderPips();

  return {
    /** Show the deck with card `top` uppermost. */
    show(top = order[0]) {
      measure();
      if (top !== order[0]) order = [...order.slice(order.indexOf(top)), ...order.slice(0, order.indexOf(top))];
      restack();
      renderPips();
      renderInfo(false);
      state = 'browse';
      stopAlive();
    },
    hide() {
      state = 'idle';
      queue = 0;
      unmountLive();
      if (live) {
        live = false;
        setLiveButton();
      }
      stopAlive();
      toast.hidden = true;
    },
    /** Where the top card sits, for the opening's hand-over. */
    topRect() {
      measure();
      const r = stack.getBoundingClientRect();
      return { left: r.left, top: r.top, width: cw, height: cw * 1.4 };
    },
    focus() {
      stack.focus({ preventScroll: true });
    },
    onKey,
    get top() {
      return order[0];
    },
  };
}
