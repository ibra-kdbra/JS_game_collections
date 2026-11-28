const version = '0.1.0';
let store;
let setLoop;
let arrowReleased = true;
let arrowDelay = 0;

/**
 * Keys. The controls are saved as key ids: KeyboardEvent.code, the physical
 *  key, with the left and right Shift, Control, Alt and Meta keys counted as
 *  one (so either Shift spins 180, as before).
 */
const SIDED_KEYS = /^(Shift|Control|Alt|Meta)(Left|Right)$/;

/**
 * KeyboardEvent.keyCode to code, for the keys that could be bound. Older
 *  versions saved the controls as keyCodes; they are moved over on load.
 *  59, 61 and 173 are what Firefox gave for ; = and -.
 */
const KEYCODE_TO_CODE = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Control', 18: 'Alt', 19: 'Pause',
  20: 'CapsLock', 27: 'Escape', 32: 'Space', 33: 'PageUp', 34: 'PageDown', 35: 'End', 36: 'Home',
  37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 45: 'Insert', 46: 'Delete',
  59: 'Semicolon', 61: 'Equal', 106: 'NumpadMultiply', 107: 'NumpadAdd', 109: 'NumpadSubtract',
  110: 'NumpadDecimal', 111: 'NumpadDivide', 173: 'Minus', 186: 'Semicolon', 187: 'Equal',
  188: 'Comma', 189: 'Minus', 190: 'Period', 191: 'Slash', 192: 'Backquote', 219: 'BracketLeft',
  220: 'Backslash', 221: 'BracketRight', 222: 'Quote',
};
for (let i = 0; i < 10; i++) {
  KEYCODE_TO_CODE[48 + i] = 'Digit' + i;
  KEYCODE_TO_CODE[96 + i] = 'Numpad' + i;
}
for (let i = 0; i < 26; i++) KEYCODE_TO_CODE[65 + i] = 'Key' + String.fromCharCode(65 + i);
for (let i = 1; i <= 12; i++) KEYCODE_TO_CODE[111 + i] = 'F' + i;

/**
 * The key id of a keyboard event, '' if there is none. Some on-screen
 *  keyboards give no code; only then the legacy keyCode is looked up.
 */
function keyId(e) {
  const code = e.code || KEYCODE_TO_CODE[e.keyCode] || '';
  return code.replace(SIDED_KEYS, '$1');
}

// Names shown in the Controls menu for keys that don't read well as codes.
const KEY_NAMES = {
  ArrowLeft: '←', ArrowUp: '↑', ArrowRight: '→', ArrowDown: '↓', Escape: 'Esc', Control: 'Ctrl',
  CapsLock: 'Caps Lock', PageUp: 'PgUp', PageDown: 'PgDn', Backquote: '`', Minus: '-',
  Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'",
  Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\', NumpadMultiply: 'Num *', NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -', NumpadDecimal: 'Num .', NumpadDivide: 'Num /', NumpadEnter: 'Num Enter',
  ContextMenu: 'Menu',
};

/** A readable name for a key id: 'KeyC' is C, 'Digit1' is 1, 'Numpad1' is Num 1. */
function keyName(id) {
  if (!id) return '';
  if (KEY_NAMES[id]) return KEY_NAMES[id];
  const m = /^(Key|Digit)(.)$/.exec(id) || /^(Numpad)(\d)$/.exec(id);
  if (m) return m[1] === 'Numpad' ? 'Num ' + m[2] : m[2];
  return id;
}

/**
 * Show and hide menus.
 */
let menus = document.getElementsByClassName('menu');
function menu(menuIndex) {
  for (let i = 0, len = menus.length; i < len; i++) {
    menus[i].classList.remove('on');
  }
  if (menuIndex !== void 0) menus[menuIndex].classList.add('on');
}

/**
 * Controls Menu. Click a control, then press the key for it.
 */
let DEFAULT_BINDS;
let currCell,
  controls = document.getElementById('controls'),
  controlCells = controls.getElementsByTagName('td');

function showBind(action) {
  // Looked up in the table: the pause menu is also called "pause".
  controls.querySelector('td#' + action).textContent = keyName(binds[action]);
}
function showBinds() {
  for (let i = 0, len = controlCells.length; i < len; i++) showBind(controlCells[i].id);
}
// Stops waiting for a key; the control keeps the key it had.
function cancelRebind() {
  if (!currCell) return;
  showBind(currCell.id);
  currCell = null;
}
for (let i = 0, len = controlCells.length; i < len; i++) {
  controlCells[i].onclick = function() {
    cancelRebind();
    this.textContent = 'Press key';
    currCell = this;
  };
}
// Listen for key input if a control has been clicked on.
addEventListener(
  'keyup',
  function(e) {
    if (!currCell) return;
    const id = keyId(e);
    if (!id) return;
    // A key does one thing: whatever had it before is left unbound.
    for (let i in binds) {
      if (id === binds[i]) {
        binds[i] = void 0;
        showBind(i);
      }
    }
    binds[currCell.id] = id;
    showBind(currCell.id);
    saveBinds();
    currCell = null;
  },
  false,
);

/**
 * Settings Menu
 */
function settingsLoop() {
  if (arrowReleased || arrowDelay >= 6) {
    if (settingsArrow)
      settings[s] = settings[s] === 0 ? setting[s].length - 1 : settings[s] - 1;
    else
      settings[s] = settings[s] === setting[s].length - 1 ? 0 : settings[s] + 1;
    saveSetting(s);
    arrowReleased = false;
  } else {
    arrowDelay++;
  }
  setLoop = setTimeout(settingsLoop, 50);
}
let s;
let settingsArrow;
// Stops the repeat of a held settings arrow, ready for the next press.
function stopArrowRepeat() {
  arrowReleased = true;
  arrowDelay = 0;
  clearTimeout(setLoop);
}
function arrowRelease() {
  if (this && this.onpointerup) this.onpointerup = this.onpointerleave = this.onpointercancel = null;
  resize();
  stopArrowRepeat();
}
// Pointer events, so holding an arrow repeats with a mouse, a pen or a finger.
function arrowPress(el, dir, e) {
  if (e.button > 0) return;
  e.preventDefault();
  stopArrowRepeat();
  settingsArrow = dir;
  s = el.parentNode.id;
  el.onpointerup = el.onpointerleave = el.onpointercancel = arrowRelease;
  settingsLoop();
}
function left(e) {
  arrowPress(this, 1, e);
}
function right(e) {
  arrowPress(this, 0, e);
}

/**
 * Saved data lives in the Game Lab store under "tetris.*".
 */
function saveSetting(s) {
  store.set('version', version);

  document.getElementById(s).getElementsByTagName('span')[0].innerHTML =
    setting[s][settings[s]];

  store.set('settings', settings);

  // Apply theme if changed
  if (s === 'Theme' && typeof LiveBackground !== 'undefined') {
    var themeName = setting[s][settings[s]].toLowerCase();
    LiveBackground.setTheme(themeName);
  }
}
// The saved data is only kept for a matching version (see loadLocalData).
function saveBinds() {
  store.set('version', version);
  store.set('binds', binds);
}

/**
 * Controls saved by older versions are keyCodes (numbers); they become key
 *  ids. A keyCode with no id here falls back to the control's default key,
 *  unless another control already has that key.
 */
function migrateBinds(saved) {
  const out = {};
  let changed = false;
  for (const action in saved) {
    let id = saved[action];
    if (typeof id === 'number') {
      id = KEYCODE_TO_CODE[id];
      changed = true;
    }
    if (typeof id === 'string' && id) out[action] = id.replace(SIDED_KEYS, '$1');
  }
  for (const action in saved) {
    if (out[action] || typeof saved[action] !== 'number') continue;
    const fallback = DEFAULT_BINDS[action];
    if (fallback && !Object.values(out).includes(fallback)) out[action] = fallback;
  }
  return { binds: out, changed };
}

function loadLocalData() {
  // Move data saved by older versions under the old, un-namespaced keys.
  if (localStorage.getItem('version') === version) {
    GameKit.migrateKey(store, 'version', 'version');
    GameKit.migrateKey(store, 'settings', 'settings', { parse: JSON.parse });
    GameKit.migrateKey(store, 'binds', 'binds', { parse: JSON.parse });
  }

  if (store.get('version') !== version) {
    store.remove('settings');
    store.remove('binds');
  }
  const savedBinds = store.get('binds');
  if (savedBinds) {
    const migrated = migrateBinds(savedBinds);
    binds = migrated.binds;
    if (migrated.changed) saveBinds();
  }
  showBinds();
  // Settings added since the save keep their defaults.
  settings = Object.assign({}, settings, store.get('settings', {}));
}

/**
 * Runs once the page and the Game Lab kit have loaded.
 */
function bootTetris() {
  store = GameKit.createStore('tetris');
  DEFAULT_BINDS = Object.assign({}, binds);
  loadLocalData();
  for (let s in settings) {
    let div = document.createElement('div');
    let b = document.createElement('b');
    let iLeft = document.createElement('i');
    let span = document.createElement('span');
    let iRight = document.createElement('i');

    div.id = s;
    b.innerHTML = s + ':';
    span.innerHTML = setting[s][settings[s]];
    iLeft.className = 'left';
    iRight.className = 'right';
    iLeft.onpointerdown = left;
    iRight.onpointerdown = right;

    set.appendChild(div);
    div.appendChild(b);
    div.appendChild(iLeft);
    div.appendChild(span);
    div.appendChild(iRight);
  }
  GameKit.initShell({ slug: 'tetris' });
  Touch.init();
  resize();
  renderBests();
}
document.addEventListener('DOMContentLoaded', bootTetris);
