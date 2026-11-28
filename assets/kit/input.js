/**
 * Touch controls that speak keyboard.
 *
 * Most games here already handle keyboard input. Rather than rewriting their
 * input code, the on-screen controls dispatch real KeyboardEvents (with `key` and
 * `code` set, as a US keyboard would), so existing handlers just work.
 *
 *   createTouchControls({
 *     dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
 *     buttons: [{ label: 'Jump', key: ' ' }, { label: 'Pause', key: 'p', small: true }],
 *   });
 *
 * Controls only render on touch-first devices unless `show: 'always'`.
 */

import { ensureKitStyles } from './shell.js';

const KEY_CODES = {
  ' ': 'Space',
  Shift: 'ShiftLeft',
  Control: 'ControlLeft',
};

function codeFor(key) {
  if (KEY_CODES[key]) return KEY_CODES[key];
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return key; // ArrowUp, Enter, Escape, ... have the same `key` and `code`
}

/**
 * Dispatch a synthetic key event, with `code` set to the key's place on a US keyboard.
 * @param {'keydown'|'keyup'} type
 * @param {string} key  A KeyboardEvent.key value, e.g. 'ArrowLeft', ' ', 'z'.
 * @param {EventTarget} [target=document]  Events bubble from document to window.
 */
export function sendKey(type, key, target = document) {
  const event = new KeyboardEvent(type, { key, code: codeFor(key), bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

/** Press and release a key, for one-shot actions. */
export function tapKey(key, target = document) {
  sendKey('keydown', key, target);
  sendKey('keyup', key, target);
}

export const isTouchFirst = () => matchMedia('(pointer: coarse)').matches;

// How many controls hold each key, per event target. Two controls can send the same key
// (a d-pad Up and a Jump button, say): the key is released only when the last one lets go.
const holders = new WeakMap();

function press(key, target) {
  if (!holders.has(target)) holders.set(target, new Map());
  const held = holders.get(target);
  held.set(key, (held.get(key) || 0) + 1);
  sendKey('keydown', key, target);
}

function release(key, target) {
  const held = holders.get(target);
  const n = (held?.get(key) || 1) - 1;
  if (n > 0) {
    held.set(key, n);
    return;
  }
  held?.delete(key);
  sendKey('keyup', key, target);
}

function holdButton(el, key, target, repeatMs, repeatDelayMs = repeatMs) {
  let timer = 0;
  let pointer = null;
  const up = () => {
    if (pointer === null) return;
    pointer = null;
    clearTimeout(timer);
    clearInterval(timer);
    el.removeAttribute('data-pressed');
    release(key, target);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.setAttribute('data-pressed', '');
    press(key, target);
    if (repeatMs) {
      // The first repeat waits repeatDelayMs, so a normal tap never sends two presses.
      timer = setTimeout(() => {
        if (pointer === null) return;
        sendKey('keydown', key, target);
        timer = setInterval(() => sendKey('keydown', key, target), repeatMs);
      }, repeatDelayMs);
    }
    navigator.vibrate?.(8);
  });
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Directions held for each of eight 45-degree sectors around the pad centre
// (sector 0 points right, sector 2 down; screen y grows downwards).
const SECTORS = {
  0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['down', 'left'], 4: ['left'], [-4]: ['left'],
  [-3]: ['left', 'up'], [-2]: ['up'], [-1]: ['up', 'right'],
};

/**
 * A d-pad a thumb can rock across: the whole pad takes the touch, and the direction follows
 * the thumb from the pad's centre (eight ways, a diagonal holds two keys) until it lifts.
 * A small dead zone in the middle holds nothing.
 */
function slidePad(pad, buttons, dpad, target) {
  let pointer = null;
  let current = new Set();
  const hold = (dirs) => {
    for (const dir of current) {
      if (dirs.has(dir)) continue;
      buttons[dir].removeAttribute('data-pressed');
      release(dpad[dir], target);
    }
    for (const dir of dirs) {
      if (current.has(dir)) continue;
      buttons[dir].setAttribute('data-pressed', '');
      press(dpad[dir], target);
    }
    current = dirs;
  };
  const follow = (e) => {
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const dirs = new Set();
    if (Math.hypot(dx, dy) > Math.min(r.width, r.height) * 0.12) {
      for (const dir of SECTORS[Math.round(Math.atan2(dy, dx) / (Math.PI / 4))]) if (dpad[dir]) dirs.add(dir);
    }
    hold(dirs);
  };
  const end = (e) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    hold(new Set());
  };
  pad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    pad.setPointerCapture(e.pointerId);
    follow(e);
    navigator.vibrate?.(8);
  });
  pad.addEventListener('pointermove', (e) => e.pointerId === pointer && follow(e));
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.addEventListener('lostpointercapture', end);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * @param {object} options
 * @param {{up?:string,down?:string,left?:string,right?:string,slide?:boolean}} [options.dpad]
 *   With `slide: true` the pad follows a thumb rocked across it, diagonals included (no repeat).
 * @param {{label:string,key:string,small?:boolean,repeatMs?:number,repeatDelayMs?:number}[]} [options.buttons]
 * @param {'touch'|'always'} [options.show='touch']
 * @param {number} [options.repeatMs=0]  Auto-repeat keydown while held (for menus); 0 = hold only.
 * @param {number} [options.repeatDelayMs=repeatMs]  Wait before the first repeat. Set it longer than
 *   repeatMs (e.g. 300) so a quick tap never counts twice.
 * @param {EventTarget} [options.target=document]
 * @returns {{ el: HTMLElement, show(): void, hide(): void, destroy(): void }}
 */
export function createTouchControls({ dpad, buttons = [], show = 'touch', repeatMs = 0, repeatDelayMs, target = document } = {}) {
  ensureKitStyles();
  const root = document.createElement('div');
  root.className = 'gk-touch';
  root.setAttribute('aria-hidden', 'true'); // Duplicates the keyboard; screen readers use the keys.

  if (dpad) {
    const pad = document.createElement('div');
    pad.className = dpad.slide ? 'gk-dpad gk-dpad--slide' : 'gk-dpad';
    const padButtons = {};
    for (const dir of ['up', 'left', 'right', 'down']) {
      if (!dpad[dir]) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = `gk-dpad-${dir}`;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l7 10H5z"/></svg>';
      if (!dpad.slide) holdButton(b, dpad[dir], target, repeatMs, repeatDelayMs ?? repeatMs);
      padButtons[dir] = b;
      pad.append(b);
    }
    if (dpad.slide) slidePad(pad, padButtons, dpad, target);
    root.append(pad);
  }

  if (buttons.length) {
    const group = document.createElement('div');
    group.className = 'gk-buttons';
    for (const spec of buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = spec.small ? 'gk-btn gk-btn--small' : 'gk-btn';
      b.textContent = spec.label;
      const ms = spec.repeatMs ?? repeatMs;
      holdButton(b, spec.key, target, ms, spec.repeatDelayMs ?? repeatDelayMs ?? ms);
      group.append(b);
    }
    root.append(group);
  }

  const visible = show === 'always' || isTouchFirst();
  root.hidden = !visible;
  document.body.append(root);
  document.documentElement.classList.toggle('gk-has-touch', visible);

  return {
    el: root,
    show() {
      root.hidden = false;
    },
    hide() {
      root.hidden = true;
    },
    destroy() {
      root.remove();
    },
  };
}

/**
 * Report swipes on an element. Returns a function that removes the listeners.
 * @param {Element} el
 * @param {(dir: 'up'|'down'|'left'|'right') => void} onSwipe
 * @param {{ threshold?: number, preventScroll?: boolean }} [options]
 */
export function onSwipe(el, onSwipe, { threshold = 30, preventScroll = true } = {}) {
  let start = null;
  const down = (e) => {
    if (e.pointerType === 'mouse') return;
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const up = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };
  const cancel = () => {
    start = null;
  };
  if (preventScroll) el.style.touchAction = 'none';
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}
