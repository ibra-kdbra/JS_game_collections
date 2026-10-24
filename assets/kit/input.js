/**
 * Touch controls that speak keyboard.
 *
 * Most games here already handle keyboard input. Rather than rewriting their
 * input code, the on-screen controls dispatch real KeyboardEvents (with `key`,
 * `code`, `keyCode` and `which` set), so existing handlers just work.
 *
 *   createTouchControls({
 *     dpad: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
 *     buttons: [{ label: 'Jump', key: ' ' }, { label: 'Pause', key: 'p', small: true }],
 *   });
 *
 * Controls only render on touch-first devices unless `show: 'always'`.
 */

import { ensureKitStyles } from './shell.js';

const KEY_INFO = {
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  ' ': { code: 'Space', keyCode: 32 },
  Enter: { code: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', keyCode: 27 },
  Shift: { code: 'ShiftLeft', keyCode: 16 },
  Control: { code: 'ControlLeft', keyCode: 17 },
};

function keyInfo(key) {
  if (KEY_INFO[key]) return { key, ...KEY_INFO[key] };
  if (/^[a-z]$/i.test(key)) {
    const upper = key.toUpperCase();
    return { key, code: `Key${upper}`, keyCode: upper.charCodeAt(0) };
  }
  if (/^[0-9]$/.test(key)) return { key, code: `Digit${key}`, keyCode: key.charCodeAt(0) };
  return { key, code: key, keyCode: 0 };
}

/**
 * Dispatch a synthetic key event that legacy `keyCode` handlers understand.
 * @param {'keydown'|'keyup'} type
 * @param {string} key  A KeyboardEvent.key value, e.g. 'ArrowLeft', ' ', 'z'.
 * @param {EventTarget} [target=document]  Events bubble from document to window.
 */
export function sendKey(type, key, target = document) {
  const info = keyInfo(key);
  const event = new KeyboardEvent(type, { key: info.key, code: info.code, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'keyCode', { get: () => info.keyCode });
  Object.defineProperty(event, 'which', { get: () => info.keyCode });
  target.dispatchEvent(event);
}

/** Press and release a key, for one-shot actions. */
export function tapKey(key, target = document) {
  sendKey('keydown', key, target);
  sendKey('keyup', key, target);
}

export const isTouchFirst = () => matchMedia('(pointer: coarse)').matches;

function holdButton(el, key, target, repeatMs, repeatDelayMs = repeatMs) {
  let timer = 0;
  let pointer = null;
  const release = () => {
    if (pointer === null) return;
    pointer = null;
    clearTimeout(timer);
    clearInterval(timer);
    el.removeAttribute('data-pressed');
    sendKey('keyup', key, target);
  };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (pointer !== null) return;
    pointer = e.pointerId;
    el.setPointerCapture(e.pointerId);
    el.setAttribute('data-pressed', '');
    sendKey('keydown', key, target);
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
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('lostpointercapture', release);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * @param {object} options
 * @param {{up?:string,down?:string,left?:string,right?:string}} [options.dpad]
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
    pad.className = 'gk-dpad';
    for (const dir of ['up', 'left', 'right', 'down']) {
      if (!dpad[dir]) continue;
      const b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = `gk-dpad-${dir}`;
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6l7 10H5z"/></svg>';
      holdButton(b, dpad[dir], target, repeatMs, repeatDelayMs ?? repeatMs);
      pad.append(b);
    }
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
