const version = '0.1.0';
let store;
let touchControls;
let setLoop;
let arrowReleased = true;
let arrowDelay = 0;

const key = {
  8: 'Backspace',
  9: 'Tab',
  13: 'Enter',
  16: 'Shift',
  17: 'Ctrl',
  18: 'Alt',
  19: 'Pause',
  20: 'Caps Lock',
  27: 'Esc',
  32: 'Space',
  33: 'PgUp',
  34: 'PgDn',
  35: 'End',
  36: 'Home',
  37: '←',
  38: '↑',
  39: '→',
  40: '↓',
  45: 'Insert',
  46: 'Delete',
  48: '0',
  49: '1',
  50: '2',
  51: '3',
  52: '4',
  53: '5',
  54: '6',
  55: '7',
  56: '8',
  57: '9',
  59: ';',
  61: '=',
  65: 'A',
  66: 'B',
  67: 'C',
  68: 'D',
  69: 'E',
  70: 'F',
  71: 'G',
  72: 'H',
  73: 'I',
  74: 'J',
  75: 'K',
  76: 'L',
  77: 'M',
  78: 'N',
  79: 'O',
  80: 'P',
  81: 'Q',
  82: 'R',
  83: 'S',
  84: 'T',
  85: 'U',
  86: 'V',
  87: 'W',
  88: 'X',
  89: 'Y',
  90: 'Z',
  96: '0kpad',
  97: '1kpad',
  98: '2kpad',
  99: '3kpad',
  100: '4kpad',
  101: '5kpad',
  102: '6kpad',
  103: '7kpad',
  104: '8kpad',
  105: '9kpad',
  106: '*',
  107: '+',
  109: '-',
  110: '.',
  111: '/',
  112: 'F1',
  113: 'F2',
  114: 'F3',
  115: 'F4',
  116: 'F5',
  117: 'F6',
  118: 'F7',
  119: 'F8',
  120: 'F9',
  121: 'F10',
  122: 'F11',
  123: 'F12',
  173: '-',
  187: '=',
  188: ',',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: "'",
};

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
 * Controls Menu
 */
let newKey,
  currCell,
  tempKey,
  controls = document.getElementById('controls'),
  controlCells = controls.getElementsByTagName('td');
// Give controls an event listener.
for (let i = 0, len = controlCells.length; i < len; i++) {
  controlCells[i].onclick = function() {
    // First check if we're already waiting for an input.
    if (currCell) {
      // TODO DRY
      // Make this into a function and call it when we press Esc.
      binds[currCell.id] = tempKey;
      currCell.innerHTML = key[tempKey];
    }
    tempKey = binds[this.id];
    this.innerHTML = 'Press key';
    currCell = this;
  };
}
// Listen for key input if a control has been clicked on.
addEventListener(
  'keyup',
  function(e) {
    // if click outside of cell or press esc clear currCell
    // reset binds button.
    if (currCell) {
      // Checks if key already in use, and unbinds it.
      for (let i in binds) {
        if (e.keyCode === binds[i]) {
          binds[i] = void 0;
          document.getElementById(i).innerHTML = binds[i];
        }
      }
      // Binds the key and saves the data.
      binds[currCell.id] = e.keyCode;
      currCell.innerHTML = key[e.keyCode];
      store.set('binds', binds);
      currCell = 0;
      buildTouchControls();
    }
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
// TODO DRY this.
function arrowRelease() {
  resize();
  arrowReleased = true;
  arrowDelay = 0;
  clearTimeout(setLoop);
}
function left() {
  settingsArrow = 1;
  s = this.parentNode.id;
  this.onmouseup = arrowRelease;
  this.onmouseout = arrowRelease;
  settingsLoop();
}
function right() {
  settingsArrow = 0;
  s = this.parentNode.id;
  this.onmouseup = arrowRelease;
  this.onmouseout = arrowRelease;
  settingsLoop();
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
    binds = savedBinds;
    for (let i = 0, len = controlCells.length; i < len; i++) {
      controlCells[i].innerHTML = key[binds[controlCells[i].id]];
    }
  }
  // Settings added since the save keep their defaults.
  settings = Object.assign({}, settings, store.get('settings', {}));
}

/**
 * KeyboardEvent.key values for the bound key codes, so the on-screen
 *  controls press whatever keys the player has bound.
 */
const keyNames = { 8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Control', 27: 'Escape', 32: ' ', 37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown' };
function keyForCode(code) {
  if (keyNames[code]) return keyNames[code];
  if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) return String.fromCharCode(code).toLowerCase();
  return null;
}

/**
 * On-screen controls for touch screens: move, soft drop and hard drop on the
 *  pad, rotate both ways, hold and pause on the buttons.
 */
function buildTouchControls() {
  if (touchControls) touchControls.destroy();
  const k = function(name) {
    return keyForCode(binds[name]);
  };
  const buttons = [
    { label: '↺', key: k('rotLeft') },
    { label: '↻', key: k('rotRight') },
    { label: 'Hold', key: k('holdPiece'), small: true },
    { label: 'Pause', key: k('pause'), small: true },
  ].filter(function(b) {
    return b.key;
  });
  touchControls = GameKit.createTouchControls({
    dpad: { left: k('moveLeft'), right: k('moveRight'), down: k('moveDown'), up: k('hardDrop') },
    buttons: buttons,
  });
}

/**
 * Runs once the page and the Game Lab kit have loaded.
 */
function bootTetris() {
  store = GameKit.createStore('tetris');
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
    iLeft.onmousedown = left;
    iRight.onmousedown = right;

    set.appendChild(div);
    div.appendChild(b);
    div.appendChild(iLeft);
    div.appendChild(span);
    div.appendChild(iRight);
  }
  GameKit.initShell({ slug: 'tetris' });
  buildTouchControls();
  resize();
  renderBests();
}
document.addEventListener('DOMContentLoaded', bootTetris);
