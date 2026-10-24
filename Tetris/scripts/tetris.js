'use strict';

/**
 * Playfield.
 */
var cellSize;
var column;

/**
 * Get html elements.
 */
var msg = document.getElementById('msg');
var stats = document.getElementById('stats');
var statsTime = document.getElementById('time');
var statsLines = document.getElementById('line');
var statsPiece = document.getElementById('piece');
var statsScore = document.getElementById('score');
var statsLevel = document.getElementById('level');
var statsLineLabel = document.getElementById('lineLabel');
var h3 = document.getElementsByTagName('h3');
var set = document.getElementById('settings');

// Get canvases and contexts
var holdCanvas = document.getElementById('hold');
var bgStackCanvas = document.getElementById('bgStack');
var stackCanvas = document.getElementById('stack');
var activeCanvas = document.getElementById('active');
var previewCanvas = document.getElementById('preview');
var spriteCanvas = document.getElementById('sprite');

var holdCtx = holdCanvas.getContext('2d');
var bgStackCtx = bgStackCanvas.getContext('2d');
var stackCtx = stackCanvas.getContext('2d');
var activeCtx = activeCanvas.getContext('2d');
var previewCtx = previewCanvas.getContext('2d');
var spriteCtx = spriteCanvas.getContext('2d');

/**
 * Piece data
 */

// NOTE y values are inverted since our matrix counts from top to bottom.
var kickData = [
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]],
  [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
];
var kickDataI = [
  [[0, 0], [-1, 0], [2, 0], [-1, 0], [2, 0]],
  [[-1, 0], [0, 0], [0, 0], [0, -1], [0, 2]],
  [[-1, -1], [1, -1], [-2, -1], [1, 0], [-2, 0]],
  [[0, -1], [0, -1], [0, -1], [0, 1], [0, -2]],
];
// TODO get rid of this lol.
var kickDataO = [[[0, 0]], [[0, 0]], [[0, 0]], [[0, 0]]];

// Define shapes and spawns.
var PieceI = {
  index: 0,
  x: 2,
  y: -1,
  kickData: kickDataI,
  tetro: [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
  ],
};
var PieceJ = {
  index: 1,
  x: 3,
  y: 0,
  kickData: kickData,
  tetro: [[2, 2, 0], [0, 2, 0], [0, 2, 0]],
};
var PieceL = {
  index: 2,
  x: 3,
  y: 0,
  kickData: kickData,
  tetro: [[0, 3, 0], [0, 3, 0], [3, 3, 0]],
};
var PieceO = {
  index: 3,
  x: 4,
  y: 0,
  kickData: kickDataO,
  tetro: [[4, 4], [4, 4]],
};
var PieceS = {
  index: 4,
  x: 3,
  y: 0,
  kickData: kickData,
  tetro: [[0, 5, 0], [5, 5, 0], [5, 0, 0]],
};
var PieceT = {
  index: 5,
  x: 3,
  y: 0,
  kickData: kickData,
  tetro: [[0, 6, 0], [6, 6, 0], [0, 6, 0]],
};
var PieceZ = {
  index: 6,
  x: 3,
  y: 0,
  kickData: kickData,
  tetro: [[7, 0, 0], [7, 7, 0], [0, 7, 0]],
};
var pieces = [PieceI, PieceJ, PieceL, PieceO, PieceS, PieceT, PieceZ];

// Finesse data
// index x orientatio x column = finesse
// finesse[0][0][4] = 1
// TODO double check these.
var finesse = [
  [
    [1, 2, 1, 0, 1, 2, 1],
    [2, 2, 2, 2, 1, 1, 2, 2, 2, 2],
    [1, 2, 1, 0, 1, 2, 1],
    [2, 2, 2, 2, 1, 1, 2, 2, 2, 2],
  ],
  [
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 3, 2, 1, 2, 3, 3, 2],
    [2, 3, 2, 1, 2, 3, 3, 2],
    [2, 3, 2, 1, 2, 3, 3, 2, 2],
  ],
  [
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 3, 2, 1, 2, 3, 3, 2],
    [2, 3, 2, 1, 2, 3, 3, 2],
    [2, 3, 2, 1, 2, 3, 3, 2, 2],
  ],
  [
    [1, 2, 2, 1, 0, 1, 2, 2, 1],
    [1, 2, 2, 1, 0, 1, 2, 2, 1],
    [1, 2, 2, 1, 0, 1, 2, 2, 1],
    [1, 2, 2, 1, 0, 1, 2, 2, 1],
  ],
  [
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 2, 1, 1, 2, 3, 2, 2],
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 2, 1, 1, 2, 3, 2, 2],
  ],
  [
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 3, 2, 1, 2, 3, 3, 2],
    [2, 3, 2, 1, 2, 3, 3, 2],
    [2, 3, 2, 1, 2, 3, 3, 2, 2],
  ],
  [
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 2, 1, 1, 2, 3, 2, 2],
    [1, 2, 1, 0, 1, 2, 2, 1],
    [2, 2, 2, 1, 1, 2, 3, 2, 2],
  ],
];

/**
 * Gameplay specific vars.
 */
var gravityUnit = 0.00390625;
var gravity;
var gravityArr = (function() {
  var array = [];
  array.push(0);
  for (var i = 1; i < 64; i++) array.push(i / 64);
  for (var i = 1; i <= 20; i++) array.push(i);
  return array;
})();

var settings = {
  DAS: 10,
  ARR: 1,
  Gravity: 0,
  'Soft Drop': 31,
  'Lock Delay': 30,
  Size: 0,
  Buttons: 0,
  Sound: 0,
  Volume: 100,
  Block: 0,
  Ghost: 0,
  Grid: 0,
  Outline: 0,
  Theme: 0,
};

var setting = {
  Theme: ['Water Drop', 'Cyberpunk', 'Neon', 'Matrix', 'Retro'],
  DAS: range(0, 31),
  ARR: range(0, 11),
  Gravity: (function() {
    var array = [];
    array.push('Auto');
    array.push('0G');
    for (var i = 1; i < 64; i++) array.push(i + '/64G');
    for (var i = 1; i <= 20; i++) array.push(i + 'G');
    return array;
  })(),
  'Soft Drop': (function() {
    var array = [];
    for (var i = 1; i < 64; i++) array.push(i + '/64G');
    for (var i = 1; i <= 20; i++) array.push(i + 'G');
    return array;
  })(),
  'Lock Delay': range(0, 101),
  Size: ['Auto', 'Small', 'Medium', 'Large'],
  Buttons: ['On', 'Off'],
  Sound: ['Off', 'On'],
  Volume: range(0, 101),
  Block: ['Shaded', 'Solid', 'Glossy', 'Arika', 'World'],
  Ghost: ['Normal', 'Colored', 'Off'],
  Grid: ['Off', 'On'],
  Outline: ['Off', 'On'],
};

var frame;

/**
 * Game modes. gametype values are stored in replays and keybinds, so they stay numeric.
 *   0 Sprint: clear 40 lines as fast as possible.
 *   3 Dig Race: clear 10 garbage lines.
 *   4 Marathon: levels 1-15, speeding up every 10 lines, scored.
 *   5 Ultra: score as much as possible in 2 minutes.
 *   6 Zen: no gravity, no game over.
 */
var MODES = {
  0: { key: 'sprint', name: 'Sprint' },
  3: { key: 'dig', name: 'Dig Race' },
  4: { key: 'marathon', name: 'Marathon' },
  5: { key: 'ultra', name: 'Ultra' },
  6: { key: 'zen', name: 'Zen' },
};
var FPS = 60; // Logic steps per second; every frame count below is in these steps.
var ULTRA_FRAMES = 2 * 60 * FPS;
var MARATHON_MAX_LEVEL = 15;
var LINES_PER_LEVEL = 10;
var LINE_SCORES = [0, 100, 300, 500, 800];

// Scoring state (Marathon and Ultra).
var score;
var level;
var backToBack;
var playStartFrame;
var stepper;

/**
 *Pausing variables
 */


/**
 * 0 = Normal
 * 1 = win
 * 2 = countdown
 * 3 = game not played
 * 9 = loss
 */
var gameState = 3;

var paused = false;
var lineLimit;

var replayKeys;
var watchingReplay = false;
var toGreyRow;
var gametype;
var lastX, lastY, lastPos, landed;

// Stats
var lines;
var statsFinesse;
var piecesSet;
var digLines;

// Keys
var keysDown;
var lastKeys;
var released;

var binds = {
  pause: 27,
  moveLeft: 37,
  moveRight: 39,
  moveDown: 40,
  hardDrop: 32,
  holdPiece: 67,
  rotRight: 88,
  rotLeft: 90,
  rot180: 16,
  retry: 82,
};
var flags = {
  hardDrop: 1,
  moveRight: 2,
  moveLeft: 4,
  moveDown: 8,
  holdPiece: 16,
  rotRight: 32,
  rotLeft: 64,
  rot180: 128,
};

/**
 * Lays out the hold panel, playfield and next queue to fit the screen.
 *  Canvases are sized in device pixels (cellSize) and shown at CSS size, so
 *  blocks stay sharp on high-DPI screens; the density is capped at 2, which
 *  looks the same on phones and keeps the canvases small. Touch screens get
 *  their own layout around the on-screen buttons (layoutTouch).
 */
var renderScale = 1;
var MAX_RENDER_SCALE = 2;

function resize() {
  resizeQueued = false;
  var a = document.getElementById('a');
  var b = document.getElementById('b');
  var c = document.getElementById('c');
  var d = document.getElementById('d');

  var dpr = Math.min(window.devicePixelRatio || 1, MAX_RENDER_SCALE);
  renderScale = dpr;
  var px = function(n) {
    return n + 'px';
  };

  if (document.documentElement.classList.contains('tt-touch')) {
    layoutTouch(a, b, c, d, dpr, px);
  } else {
    var narrow = window.innerWidth < 700;
    var top = 12;
    var bottom = 12;
    var availW = window.innerWidth - 16;
    var availH = window.innerHeight - top - bottom;

    // Side panels are 4 cells wide, scaled down on narrow screens.
    var sideScale = narrow ? 0.6 : 1;
    var cssCell = Math.min(availH / 20, availW / (10 + 8 * sideScale + 0.5));
    cssCell = Math.max(Math.floor(capCellSize(cssCell)), 8);
    cellSize = Math.round(cssCell * dpr);

    var boardW = cssCell * 10;
    var boardH = cssCell * 20;
    var sideW = Math.round(cssCell * 4 * sideScale);
    sizeBoard(b, boardW, boardH, px);

    holdCanvas.width = cellSize * 4;
    holdCanvas.height = cellSize * 2;
    holdCanvas.style.width = px(sideW);
    holdCanvas.style.height = px(sideW / 2);
    a.style.width = px(sideW);
    a.style.height = px(sideW / 2);
    d.style.width = px(sideW);
    d.style.height = px(boardH);

    previewCanvas.width = cellSize * 4;
    previewCanvas.height = cellSize * 20;
    previewCanvas.style.width = px(sideW);
    previewCanvas.style.height = px(Math.round(boardH * sideScale));
    c.style.width = px(sideW);
    c.style.height = px(boardH);

    var content = document.getElementById('content');
    content.style.marginTop = px(top);
    content.style.marginBottom = px(bottom);

    // Scale the text with the playfield.
    stats.style.fontSize = Math.max(~~((sideW / 4) * (narrow ? 0.9 : 0.68)), 9) + 'px';
    stats.style.width = px(sideW);
    document.documentElement.style.fontSize = Math.max(~~(boardW / 16), 12) + 'px';
    for (var i = 0, len = h3.length; i < len; i++) {
      h3[i].style.fontSize = Math.max(~~(sideW / 5), 10) + 'px';
    }
  }

  // Redraw graphics
  makeSprite();

  if (settings.Grid === 1) bg(bgStackCtx);
  else clear(bgStackCtx);

  if (gameState === 0 || gameState === 1 || gameState === 9) {
    stack.draw();
    preview.draw();
    if (hold.piece !== void 0) hold.draw();
  }
  if (gameState === 0) {
    clear(activeCtx);
    piece.drawGhost();
    piece.draw();
  }
}

/** Applies the Size setting (Auto, Small, Medium, Large) to a cell size. */
function capCellSize(cssCell) {
  if (settings.Size === 1) return Math.min(cssCell, 15);
  if (settings.Size === 2) return Math.min(cssCell, 30);
  if (settings.Size === 3) return Math.min(cssCell, 45);
  return cssCell;
}

function sizeBoard(b, boardW, boardH, px) {
  stackCanvas.width = activeCanvas.width = bgStackCanvas.width = cellSize * 10;
  stackCanvas.height = activeCanvas.height = bgStackCanvas.height = cellSize * 20;
  [stackCanvas, activeCanvas, bgStackCanvas].forEach(function(canvas) {
    canvas.style.width = px(boardW);
    canvas.style.height = px(boardH);
  });
  b.style.width = px(boardW);
  b.style.height = px(boardH);
  msg.style.lineHeight = px(boardH);
  msg.style.fontSize = ~~(boardW / 6) + 'px';
}

/** Safe-area insets (notches, home indicator) in CSS pixels. */
var safeProbe;
function safeInsets() {
  if (!safeProbe) {
    safeProbe = document.createElement('div');
    safeProbe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;top:0;left:0;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(safeProbe);
  }
  var cs = getComputedStyle(safeProbe);
  return {
    t: parseFloat(cs.paddingTop) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
    l: parseFloat(cs.paddingLeft) || 0,
  };
}

/**
 * Touch layout. Portrait: the board as large as fits, with hold and stats
 *  either in a column on the left or, on tall phones, in a strip above, the
 *  queue on the right and the buttons below. Landscape: hold, board and queue
 *  in the middle with a button cluster on each side.
 */
function layoutTouch(a, b, c, d, dpr, px) {
  var ins = safeInsets();
  var vw = window.innerWidth - ins.l - ins.r;
  var vh = window.innerHeight - ins.t - ins.b;
  var portrait = vh >= vw;
  var buttons = settings.Buttons !== 1;
  var pad = 6;
  var gap = 8;
  var strip = false;
  var stripH = 60;
  var cell, side, row, availW, availH;
  var sideFor = function(cell) {
    return Math.min(Math.max(Math.round(cell * 2.6), 56), 84);
  };
  var fit = function(w, h) {
    var c = h / 20;
    for (var i = 0; i < 4; i++) c = Math.min(h / 20, (w - 2 * sideFor(c)) / 10);
    return c;
  };

  if (portrait) {
    row = vh >= 700 ? 60 : 52;
    availW = vw - pad * 2;
    availH = vh - pad * 2 - (buttons ? row * 2 + gap * 2 : 0);
    cell = fit(availW, availH);
    var cellStrip = Math.min((availH - stripH) / 20, (availW - 56) / 10);
    if (cellStrip > cell * 1.06) {
      strip = true;
      cell = cellStrip;
    }
  } else {
    row = 56;
    availH = vh - pad * 2;
    availW = vw - pad * 2 - (buttons ? (row * 2 + gap * 3) * 2 : 0);
    cell = fit(availW, availH);
  }
  cell = Math.max(Math.floor(capCellSize(cell)), 8);
  side = strip ? 56 : sideFor(cell);
  cellSize = Math.round(cell * dpr);

  var boardW = cell * 10;
  var boardH = cell * 20;
  sizeBoard(b, boardW, boardH, px);

  // Spare height in portrait makes the buttons bigger.
  if (portrait && buttons) {
    var spare = vh - pad * 2 - boardH - (strip ? stripH : 0) - gap * 2;
    row = Math.max(row, Math.min(68, Math.floor(spare / 2) - 4));
  }

  var holdW = strip ? 64 : side;
  holdCanvas.width = cellSize * 4;
  holdCanvas.height = cellSize * 2;
  holdCanvas.style.width = px(holdW);
  holdCanvas.style.height = px(holdW / 2);
  a.style.width = px(holdW);
  a.style.height = px(holdW / 2);
  d.style.width = strip ? px(boardW + side) : px(side);
  d.style.height = strip ? px(stripH) : px(boardH);

  previewCanvas.width = cellSize * 4;
  previewCanvas.height = cellSize * 20;
  previewCanvas.style.width = px(side);
  previewCanvas.style.height = px(Math.min(side * 5, boardH - 30));
  c.style.width = px(side);
  c.style.height = px(boardH);

  var content = document.getElementById('content');
  content.classList.toggle('tt-strip', strip);
  content.style.marginTop = px(ins.t + pad);
  content.style.marginBottom = px(ins.b + pad + (portrait && buttons ? row * 2 + gap * 2 : 0));
  stats.style.width = strip ? '' : px(side);
  stats.style.fontSize = Math.round(Math.min(26, Math.max(17, side / 3.2))) + 'px';

  var root = document.documentElement;
  root.classList.toggle('tt-landscape', !portrait);
  root.classList.toggle('tt-nobuttons', !buttons);
  root.style.setProperty('--pad-row', px(row));
  root.style.setProperty('--board-w', px(boardW + side * 2));
  root.style.fontSize = Math.min(Math.max(Math.round(Math.min(vw, vh) / 24), 14), 18) + 'px';
}

// Resizing waits for the next frame, so a burst of resize events (rotating
// the phone, the address bar sliding) lays out once.
var resizeQueued = false;
function queueResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(resize);
}
addEventListener('resize', queueResize, false);
addEventListener('orientationchange', queueResize, false);

/**
 * ========================== Model ===========================================
 */

/**
 * Resets all the settings and starts the game.
 */
function init(gt) {
  if (gt === 'replay') {
    watchingReplay = true;
  } else {
    watchingReplay = false;
    replayKeys = {};
    // TODO Make new seed and rng method.
    replayKeys.seed = ~~(Math.random() * 2147483645) + 1;
    gametype = gt;
  }

  lineLimit = gametype === 0 ? 40 : Infinity;
  score = 0;
  level = 1;
  backToBack = false;

  //Reset
  column = 0;
  keysDown = 0;
  Touch.reset();
  lastKeys = 0;
  released = 255;
  //TODO Check if needed.
  piece.shiftDir = 0;
  piece.shiftReleased = true;

  paused = false;

  // Start music. init() always runs from a click or key press, so audio may start.
  if (typeof audioManager !== 'undefined') {
    audioManager.unlock();
    audioManager.startMusic();
  }

  rng.seed = replayKeys.seed;
  toGreyRow = 21;
  frame = 0;
  lastPos = 'reset';
  stack.new(10, 22);
  hold.piece = void 0;
  if (settings.Gravity === 0) gravity = gravityUnit * 4;
  playStartFrame = 100;

  preview.init();

  statsFinesse = 0;
  lines = 0;
  piecesSet = 0;

  statsPiece.innerHTML = piecesSet;
  updateLineStat();
  setupStatsForMode();
  statistics();
  clear(stackCtx);
  clear(activeCtx);
  clear(holdCtx);

  if (gametype === 3) {
    // Dig Race
    // make ten random numbers, make sure next isn't the same as last?
    //TODO make into function or own file.

    digLines = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

    statsLines.innerHTML = 10;
    var randomNums = [];
    for (var i = 0; i < 10; i++) {
      var random = ~~(rng.next() * 10);
      if (random !== randomNums[i - 1]) randomNums.push(random);
      else i--;
    }
    for (var y = 21; y > 11; y--) {
      for (var x = 0; x < 10; x++) {
        if (randomNums[y - 12] !== x) stack.grid[x][y] = 8;
      }
    }
    stack.draw();
  }

  menu();

  // Only start a loop if one is not running already.
  if (gameState === 3) {
    gameState = 2;
    stepper = GameKit.createStepper(FPS);
    requestAnimationFrame(gameLoop);
  } else {
    gameState = 2;
    stepper.reset();
  }
}

function range(start, end, inc) {
  inc = inc || 1;
  var array = [];
  for (var i = start; i < end; i += inc) {
    array.push(i);
  }
  return array;
}

/**
 * Modulo that is always positive, for clock arithmetic on piece orientation.
 */
function mod(value, n) {
  return ((value % n) + n) % n;
}

function pause() {
  if (gameState === 0 && !paused) {
    paused = true;
    keysDown = 0;
    Touch.reset();
    msg.innerHTML = 'Paused';
    menu(4);
    if (typeof audioManager !== 'undefined') {
      audioManager.stopMusic();
    }
  }
}

function unpause() {
  paused = false;
  msg.innerHTML = '';
  menu();
  if (typeof audioManager !== 'undefined') {
    audioManager.startMusic();
  }
}

/**
 * Park Miller "Minimal Standard" PRNG.
 */
//TODO put random seed method in here.
var rng = new function() {
  this.seed = 1;
  this.next = function() {
    // Returns a float between 0.0, and 1.0
    return this.gen() / 2147483647;
  };
  this.gen = function() {
    return (this.seed = (this.seed * 16807) % 2147483647);
  };
}();

/**
 * Draws the stats next to the tetrion.
 */
/**
 * Draws the stats next to the tetrion. Time is counted in logic steps, so it
 *  stops while paused and replays show the same time.
 */
function statistics() {
  var time = elapsedMs();
  if (gametype === 5) time = Math.max(0, ULTRA_FRAMES * (1000 / FPS) - time);
  statsTime.innerHTML = formatTime(time);
}

function elapsedMs() {
  return Math.max(0, frame - playStartFrame) * (1000 / FPS);
}

function formatTime(time) {
  var seconds = ((time / 1000) % 60).toFixed(2);
  var minutes = ~~(time / 60000);
  return (minutes < 10 ? '0' : '') + minutes + (seconds < 10 ? ':0' : ':') + seconds;
}

/**
 * Lines left (Sprint, Dig Race) or lines cleared (other modes).
 */
function updateLineStat() {
  if (gametype === 0) statsLines.innerHTML = lineLimit - lines;
  else if (gametype === 3) statsLines.innerHTML = digLines ? digLines.length : 10;
  else statsLines.innerHTML = lines;
}

function setupStatsForMode() {
  var scored = gametype === 4 || gametype === 5;
  document.getElementById('scoreRow').style.display = scored ? '' : 'none';
  document.getElementById('levelRow').style.display = gametype === 4 ? '' : 'none';
  statsLineLabel.innerHTML = gametype === 0 || gametype === 3 ? 'Left' : 'Lines';
  statsScore.innerHTML = score;
  statsLevel.innerHTML = level;
}

/**
 * Gravity for the current mode in G (rows per step), or null to use the
 *  Gravity setting. Marathon follows the guideline speed curve.
 */
function modeGravity() {
  if (gametype === 6) return 0;
  if (gametype === 4) {
    var secondsPerRow = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
    return 1 / (secondsPerRow * FPS);
  }
  return null;
}

/**
 * Called by the stack after a piece locks. Scores line clears in the scored
 *  modes, tracks back-to-back Tetrises and levels, and drives the effects.
 */
function onLinesCleared(count) {
  if (count > 0) {
    if (gametype === 4 || gametype === 5) {
      var points = LINE_SCORES[count] * level;
      if (count === 4 && backToBack) points = Math.floor(points * 1.5);
      score += points;
      if (count === 4 && backToBack) showAction('BACK-TO-BACK');
      backToBack = count === 4;
    }
    if (gametype === 4) {
      var newLevel = Math.min(MARATHON_MAX_LEVEL, 1 + Math.floor(lines / LINES_PER_LEVEL));
      if (newLevel > level) {
        level = newLevel;
        showAction('LEVEL ' + level);
        if (typeof audioManager !== 'undefined') audioManager.playSound('level-up');
      }
    }
    if (typeof LiveBackground !== 'undefined') LiveBackground.onLinesCleared(count);
    if (count === 4) showAction('TETRIS');
  }
  statsScore.innerHTML = score;
  statsLevel.innerHTML = level;
}

/**
 * Points for dropping: 1 per row soft dropped, 2 per row hard dropped.
 */
function addDropScore(rows) {
  if ((gametype === 4 || gametype === 5) && rows > 0) {
    score += rows;
    statsScore.innerHTML = score;
  }
}

/**
 * Briefly shows a callout over the playfield.
 */
var actionTimer;
function showAction(text) {
  if (gameState !== 0) return;
  msg.innerHTML = '<span class="action">' + text + '</span>';
  clearTimeout(actionTimer);
  actionTimer = setTimeout(function() {
    if (gameState === 0 && !paused) msg.innerHTML = '';
  }, 900);
}

/**
 * Ends the game. Wins and timed finishes record a personal best.
 */
function endGame(state, text) {
  gameState = state;
  msg.innerHTML = text;
  if (typeof audioManager !== 'undefined') audioManager.stopMusic();
  if (!watchingReplay) saveBest(state);
  menu(3);
}

function saveBest(state) {
  var mode = MODES[gametype];
  if (!mode || typeof GameKit === 'undefined') return;
  var result;
  if ((gametype === 0 || gametype === 3) && state === 1) {
    var time = elapsedMs();
    result = GameKit.recordBest('tetris', Math.round(time), {
      lowerIsBetter: true,
      mode: mode.key,
      label: mode.name + ' ' + formatTime(time),
    });
  } else if (gametype === 4 || gametype === 5) {
    result = GameKit.recordBest('tetris', score, {
      mode: mode.key,
      label: mode.name + ' ' + score + ' pts',
    });
  }
  var note = document.getElementById('goNote');
  note.innerHTML = result ? (result.isNew ? 'New personal best!' : 'Best: ' + bestLabel(gametype)) : '';
  renderBests();
}

function bestLabel(type) {
  if (typeof GameKit === 'undefined') return '';
  var best = GameKit.readBests('tetris')[MODES[type].key];
  if (!best) return '';
  return type === 0 || type === 3 ? formatTime(best.value) : best.value + ' pts';
}

/**
 * Shows each mode's personal best in the main menu.
 */
function renderBests() {
  var items = document.querySelectorAll('[data-best]');
  for (var i = 0; i < items.length; i++) {
    var label = bestLabel(+items[i].getAttribute('data-best'));
    items[i].innerHTML = label ? 'Best ' + label : '';
  }
}

// ========================== View ============================================

/**
 * Draws grid in background.
 */
function bg(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#1c1c1c';
  for (var x = -1; x < ctx.canvas.width + 1; x += cellSize) {
    ctx.fillRect(x, 0, 2, ctx.canvas.height);
  }
  for (var y = -1; y < ctx.canvas.height + 1; y += cellSize) {
    ctx.fillRect(0, y, ctx.canvas.width, 2);
  }
}

/**
 * Draws a pre-rendered mino.
 */
function drawCell(x, y, color, ctx) {
  x = x * cellSize;
  x = ~~x;
  y = ~~y * cellSize - 2 * cellSize;
  ctx.drawImage(
    spriteCanvas,
    color * cellSize,
    0,
    cellSize,
    cellSize,
    x,
    y,
    cellSize,
    cellSize,
  );
}

/**
 * Pre-renders all mino types in all colors.
 */
function makeSprite() {
  var shaded = [
    // 0         +10        -10        -20
    ['#c1c1c1', '#dddddd', '#a6a6a6', '#8b8b8b'],
    ['#25bb9b', '#4cd7b6', '#009f81', '#008568'],
    ['#3397d9', '#57b1f6', '#007dbd', '#0064a2'],
    ['#e67e23', '#ff993f', '#c86400', '#a94b00'],
    ['#efc30f', '#ffdf3a', '#d1a800', '#b38e00'],
    ['#9ccd38', '#b9e955', '#81b214', '#659700'],
    ['#9c5ab8', '#b873d4', '#81409d', '#672782'],
    ['#e64b3c', '#ff6853', '#c62c25', '#a70010'],
    ['#898989', '#a3a3a3', '#6f6f6f', '#575757'],
  ];
  var glossy = [
    //25         37         52         -21        -45
    ['#ffffff', '#ffffff', '#ffffff', '#888888', '#4d4d4d'],
    ['#7bffdf', '#9fffff', '#ccffff', '#008165', '#00442e'],
    ['#6cdcff', '#93feff', '#c2ffff', '#00629f', '#002c60'],
    ['#ffc166', '#ffe386', '#ffffb0', '#aa4800', '#650500'],
    ['#ffff6a', '#ffff8c', '#ffffb8', '#b68a00', '#714f00'],
    ['#efff81', '#ffffa2', '#ffffcd', '#6b9200', '#2c5600'],
    ['#dc9dfe', '#ffbeff', '#ffe9ff', '#5d287e', '#210043'],
    ['#ff9277', '#ffb497', '#ffe0bf', '#a7000a', '#600000'],
    ['#cbcbcb', '#ededed', '#ffffff', '#545454', '#1f1f1f'],
  ];
  var tgm = [
    ['#7b7b7b', '#303030', '#6b6b6b', '#363636'],
    ['#f08000', '#a00000', '#e86008', '#b00000'],
    ['#00a8f8', '#0000b0', '#0090e8', '#0020c0'],
    ['#f8a800', '#b84000', '#e89800', '#c85800'],
    ['#e8e000', '#886800', '#d8c800', '#907800'],
    ['#f828f8', '#780078', '#e020e0', '#880088'],
    ['#00e8f0', '#0070a0', '#00d0e0', '#0080a8'],
    ['#78f800', '#007800', '#58e000', '#008800'],
    ['#7b7b7b', '#303030', '#6b6b6b', '#363636'],
  ];
  var world = [];
  world[0] = tgm[0];
  world[1] = tgm[6];
  world[2] = tgm[2];
  world[3] = tgm[3];
  world[4] = tgm[4];
  world[5] = tgm[7];
  world[6] = tgm[5];
  world[7] = tgm[1];
  world[8] = tgm[8];

  spriteCanvas.width = cellSize * 9;
  spriteCanvas.height = cellSize;
  for (var i = 0; i < 9; i++) {
    var x = i * cellSize;
    if (settings.Block === 0) {
      // Shaded
      spriteCtx.fillStyle = shaded[i][1];
      spriteCtx.fillRect(x, 0, cellSize, cellSize);

      spriteCtx.fillStyle = shaded[i][3];
      spriteCtx.fillRect(x, cellSize / 2, cellSize, cellSize / 2);

      spriteCtx.fillStyle = shaded[i][0];
      spriteCtx.beginPath();
      spriteCtx.moveTo(x, 0);
      spriteCtx.lineTo(x + cellSize / 2, cellSize / 2);
      spriteCtx.lineTo(x, cellSize);
      spriteCtx.fill();

      spriteCtx.fillStyle = shaded[i][2];
      spriteCtx.beginPath();
      spriteCtx.moveTo(x + cellSize, 0);
      spriteCtx.lineTo(x + cellSize / 2, cellSize / 2);
      spriteCtx.lineTo(x + cellSize, cellSize);
      spriteCtx.fill();
    } else if (settings.Block === 1) {
      // Flat
      spriteCtx.fillStyle = shaded[i][0];
      spriteCtx.fillRect(x, 0, cellSize, cellSize);
    } else if (settings.Block === 2) {
      // Glossy
      var k = Math.max(~~(cellSize * 0.083), 1);

      var grad = spriteCtx.createLinearGradient(x, 0, x + cellSize, cellSize);
      grad.addColorStop(0.5, glossy[i][3]);
      grad.addColorStop(1, glossy[i][4]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fillRect(x, 0, cellSize, cellSize);

      var grad = spriteCtx.createLinearGradient(x, 0, x + cellSize, cellSize);
      grad.addColorStop(0, glossy[i][2]);
      grad.addColorStop(0.5, glossy[i][1]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fillRect(x, 0, cellSize - k, cellSize - k);

      var grad = spriteCtx.createLinearGradient(
        x + k,
        k,
        x + cellSize - k,
        cellSize - k,
      );
      grad.addColorStop(0, shaded[i][0]);
      grad.addColorStop(0.5, glossy[i][0]);
      grad.addColorStop(0.5, shaded[i][0]);
      grad.addColorStop(1, glossy[i][0]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fillRect(x + k, k, cellSize - k * 2, cellSize - k * 2);
    } else if (settings.Block === 3 || settings.Block === 4) {
      // Arika
      if (settings.Block === 4) tgm = world;
      var k = Math.max(~~(cellSize * 0.125), 1);

      spriteCtx.fillStyle = tgm[i][1];
      spriteCtx.fillRect(x, 0, cellSize, cellSize);
      spriteCtx.fillStyle = tgm[i][0];
      spriteCtx.fillRect(x, 0, cellSize, ~~(cellSize / 2));

      var grad = spriteCtx.createLinearGradient(x, k, x, cellSize - k);
      grad.addColorStop(0, tgm[i][2]);
      grad.addColorStop(1, tgm[i][3]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fillRect(x + k, k, cellSize - k * 2, cellSize - k * 2);

      var grad = spriteCtx.createLinearGradient(x, k, x, cellSize);
      grad.addColorStop(0, tgm[i][0]);
      grad.addColorStop(1, tgm[i][3]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fillRect(x, k, k, cellSize - k);

      var grad = spriteCtx.createLinearGradient(x, 0, x, cellSize - k);
      grad.addColorStop(0, tgm[i][2]);
      grad.addColorStop(1, tgm[i][1]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fillRect(x + cellSize - k, 0, k, cellSize - k);
    }
  }
}

/**
 * Clear canvas.
 */
function clear(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/**
 * Draws a 2d array of minos.
 */
function draw(tetro, cx, cy, ctx, color) {
  for (var x = 0, len = tetro.length; x < len; x++) {
    for (var y = 0, wid = tetro[x].length; y < wid; y++) {
      if (tetro[x][y])
        drawCell(x + cx, y + cy, color !== void 0 ? color : tetro[x][y], ctx);
    }
  }
}

// ========================== Controller ======================================

addEventListener(
  'keydown',
  function(e) {
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) !== -1) e.preventDefault();
    if (e.keyCode === binds.pause) {
      if (paused) {
        unpause();
      } else {
        pause();
      }
    }
    if (e.keyCode === binds.retry && gametype !== void 0 && !document.querySelector('.menu.on:not(#go):not(#pause)')) {
      init(gametype);
    }
    if (!watchingReplay) {
      if (e.keyCode === binds.moveLeft) {
        keysDown |= flags.moveLeft;
        //piece.finesse++
      } else if (e.keyCode === binds.moveRight) {
        keysDown |= flags.moveRight;
      } else if (e.keyCode === binds.moveDown) {
        keysDown |= flags.moveDown;
      } else if (e.keyCode === binds.hardDrop) {
        keysDown |= flags.hardDrop;
      } else if (e.keyCode === binds.rotRight) {
        keysDown |= flags.rotRight;
      } else if (e.keyCode === binds.rotLeft) {
        keysDown |= flags.rotLeft;
      } else if (e.keyCode === binds.rot180) {
        keysDown |= flags.rot180;
      } else if (e.keyCode === binds.holdPiece) {
        keysDown |= flags.holdPiece;
      }
    }
  },
  false,
);
/**
 * A key released before the game has stepped since it was pressed still
 *  counts for one step, so quick taps (and on-screen buttons) never get lost.
 */
var seenKeys = 0;
var pendingRelease = 0;
function releaseKey(flag) {
  if (!(keysDown & flag)) return;
  if (seenKeys & flag) keysDown &= ~flag;
  else pendingRelease |= flag;
}

addEventListener(
  'keyup',
  function(e) {
    if (watchingReplay) return;
    for (var name in flags) {
      if (e.keyCode === binds[name]) releaseKey(flags[name]);
    }
  },
  false,
);

// Leaving the tab pauses the game, so the clock and the stack wait for you.
document.addEventListener('visibilitychange', function() {
  if (document.hidden) pause();
});
addEventListener('blur', function() {
  if (!watchingReplay) keysDown = 0;
});

// ========================== Loop ============================================

//TODO Cleanup gameloop and update.
/**
 * Runs every frame.
 */
function update() {
  //TODO Das preservation broken.
  if (lastKeys !== keysDown && !watchingReplay) {
    replayKeys[frame] = keysDown;
  } else if (frame in replayKeys) {
    keysDown = replayKeys[frame];
  }

  Touch.apply();

  if (!(lastKeys & flags.holdPiece) && flags.holdPiece & keysDown) {
    piece.hold();
  }

  if (flags.rotLeft & keysDown && !(lastKeys & flags.rotLeft)) {
    piece.rotate(-1);
    piece.finesse++;
  } else if (flags.rotRight & keysDown && !(lastKeys & flags.rotRight)) {
    piece.rotate(1);
    piece.finesse++;
  } else if (flags.rot180 & keysDown && !(lastKeys & flags.rot180)) {
    piece.rotate(1);
    piece.rotate(1);
    piece.finesse++;
  }

  piece.checkShift();

  if (flags.moveDown & keysDown) {
    piece.shiftDown();
  }
  if (!(lastKeys & flags.hardDrop) && flags.hardDrop & keysDown) {
    piece.hardDrop();
  }

  piece.update();

  // Win and finish conditions.
  if (gameState === 0) {
    if (gametype === 0 && lines >= lineLimit) {
      endGame(1, 'GREAT!');
    } else if (gametype === 3 && digLines.length === 0) {
      endGame(1, 'GREAT!');
    } else if (gametype === 4 && lines >= MARATHON_MAX_LEVEL * LINES_PER_LEVEL) {
      endGame(1, 'GREAT!');
    } else if (gametype === 5 && elapsedMs() >= ULTRA_FRAMES * (1000 / FPS)) {
      endGame(1, 'TIME!');
    }
  }

  statistics();

  if (lastKeys !== keysDown) {
    lastKeys = keysDown;
  }
}

/**
 * Runs every animation frame. Game logic advances in fixed 60 Hz steps, so
 *  speed, DAS and gravity are the same on 60 Hz and 120 Hz screens.
 */
var playingClass = false;
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  stepper.advance(now, step);

  // The on-screen buttons show only while a game is being played.
  var playing = (gameState === 0 || gameState === 2) && !paused && !watchingReplay;
  if (playing !== playingClass) {
    playingClass = playing;
    document.documentElement.classList.toggle('tt-playing', playing);
  }

  if (gameState === 0) {
    if (
      piece.x !== lastX ||
      Math.floor(piece.y) !== lastY ||
      piece.pos !== lastPos ||
      piece.dirty
    ) {
      clear(activeCtx);
      piece.drawGhost();
      piece.draw();
    }
    lastX = piece.x;
    lastY = Math.floor(piece.y);
    lastPos = piece.pos;
    piece.dirty = false;
  }
}

/**
 * One logic step. The frame counter only advances while the game runs, so
 *  pausing never shifts replays or the clock.
 */
function step() {
  seenKeys = keysDown;
  stepGame();
  if (pendingRelease) {
    keysDown &= ~pendingRelease;
    pendingRelease = 0;
  }
}

function stepGame() {
  if (gameState === 0) {
    // Playing
    if (!paused) {
      frame++;
      update();
    }
  } else if (gameState === 2) {
    // Count Down
    frame++;
    if (frame < 50) {
      if (msg.innerHTML !== 'READY') msg.innerHTML = 'READY';
    } else if (frame < 100) {
      if (msg.innerHTML !== 'GO!') msg.innerHTML = 'GO!';
    } else {
      msg.innerHTML = '';
      gameState = 0;
      playStartFrame = frame;
      piece.new(preview.next());
    }
    // DAS Preload
    if (lastKeys !== keysDown && !watchingReplay) {
      replayKeys[frame] = keysDown;
    } else if (frame in replayKeys) {
      keysDown = replayKeys[frame];
    }
    if (keysDown & flags.moveLeft) {
      lastKeys = keysDown;
      piece.shiftDelay = settings.DAS;
      piece.shiftReleased = false;
      piece.shiftDir = -1;
    } else if (keysDown & flags.moveRight) {
      lastKeys = keysDown;
      piece.shiftDelay = settings.DAS;
      piece.shiftReleased = false;
      piece.shiftDir = 1;
    }
  } else if (toGreyRow >= 2) {
    /**
     * Fade to grey animation played when the game ends.
     */
    frame++;
    if (toGreyRow === 21) clear(activeCtx);
    if (frame % 2) {
      for (var x = 0; x < 10; x++) {
        if (stack.grid[x][toGreyRow]) stack.grid[x][toGreyRow] = gameState - 1;
      }
      stack.draw();
      toGreyRow--;
    }
  }
}
