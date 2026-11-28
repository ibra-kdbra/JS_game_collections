'use strict';

/**
 * Playfield.
 */
var cellSize;

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
  // An O turns in place: the first test of every kick table is no offset,
  //  and it always fits, since the O covers the same cells in every orientation.
  kickData: kickData,
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

/**
 * Finesse: the fewest key presses that place a piece, from its spawn, in a
 *  given orientation and column on an empty board. finesse[piece][orientation][column],
 *  where column is the piece's leftmost cell, and moving to a wall with DAS,
 *  each rotation (180 included) and each tap all count as one press. For the
 *  I, S, Z and O, orientations that give the same shape count as one (an O is
 *  never worth rotating). Checked against a search over the game's own moves.
 */
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
  Block: 5,
  Ghost: 0,
  Grid: 0,
  Outline: 0,
  Theme: 0,
};

var setting = {
  Theme: ['Rain', 'Obsidian', 'Aurora', 'Synthwave', 'Code Rain'],
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
  Block: ['Shaded', 'Solid', 'Glossy', 'Arika', 'World', 'Modern'],
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
 *   7 Survival: garbage rises from the floor faster and faster; last as long as you can.
 *   8 Master: pieces fall instantly (20G) and lock sooner every level; 150 lines to finish.
 */
var MODES = {
  0: { key: 'sprint', name: 'Sprint' },
  3: { key: 'dig', name: 'Dig Race' },
  4: { key: 'marathon', name: 'Marathon' },
  5: { key: 'ultra', name: 'Ultra' },
  6: { key: 'zen', name: 'Zen' },
  7: { key: 'survival', name: 'Survival' },
  8: { key: 'master', name: 'Master' },
};
var FPS = 60; // Logic steps per second; every frame count below is in these steps.
var ULTRA_FRAMES = 2 * 60 * FPS;
var MARATHON_MAX_LEVEL = 15;
var LINES_PER_LEVEL = 10;
var LINE_SCORES = [0, 100, 300, 500, 800];
var TSPIN_SCORES = [400, 800, 1200, 1600];
var TSPIN_MINI_SCORES = [100, 200, 400];
var ALL_CLEAR_SCORES = [0, 800, 1200, 1800, 2000];
var MASTER_MAX_LEVEL = 15;
// Survival: a garbage row rises every SURVIVAL_RISE seconds at the start,
//  down to SURVIVAL_RISE_MIN; the level (and gravity) goes up every SURVIVAL_LEVEL seconds.
var SURVIVAL_RISE = 9;
var SURVIVAL_RISE_MIN = 2.2;
var SURVIVAL_LEVEL = 20;

/** Modes that keep a score. */
function scoredMode(type) {
  return type === 4 || type === 5 || type === 8;
}

// Run stats for the results card.
var combo;
var maxCombo;
var tetrises;
var tspins;
var allClears;
// Survival
var riseFrames;
var garbageHole;
var garbageRows;

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

/**
 * Replays. A game is a seed plus its input: replayKeys[frame] holds keysDown
 *  for every step where it changed, replayKeys.t[frame] the touch gestures
 *  applied that step (see Touch.apply), replayKeys.seed the rng seed and
 *  replayKeys.handling the handling settings the game was played with.
 */
var replayKeys;
var replayHeld; // keysDown as last recorded (live) or played back (replay)
var watchingReplay = false;
// The settings that change how the game plays. A game reads them from
//  `handling`, a copy taken at the start, so a replay plays with the
//  settings of its game whatever they are set to now.
var HANDLING = ['DAS', 'ARR', 'Gravity', 'Soft Drop', 'Lock Delay'];
var handling = {};
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

// Controls, as key ids (see keyId in menu.js). Saved under "tetris.binds".
var binds = {
  pause: 'Escape',
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  moveDown: 'ArrowDown',
  hardDrop: 'Space',
  holdPiece: 'KeyC',
  rotRight: 'KeyX',
  rotLeft: 'KeyZ',
  rot180: 'Shift',
  retry: 'KeyR',
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
    layoutDesktop(a, b, c, d, dpr, px);
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

/**
 * Keyboard and mouse layout: the board in the middle, a column of cards on each
 * side (Hold and the stats on the left, Next on the right). The cards are sized
 * in cells, with room around the pieces so the I piece never touches an edge.
 */
function layoutDesktop(a, b, c, d, dpr, px) {
  var narrow = window.innerWidth < 760;
  var margin = Math.max(10, Math.min(28, Math.round(window.innerHeight * 0.025)));
  var availW = window.innerWidth - margin * 2;
  var availH = window.innerHeight - margin * 2;
  var sideCells = narrow ? 3.4 : 4.8;
  var gapCells = narrow ? 0.3 : 0.5;
  var cssCell = Math.min(availH / 20, availW / (10 + sideCells * 2 + gapCells * 2));
  cssCell = Math.max(Math.floor(capCellSize(cssCell)), 8);
  cellSize = Math.round(cssCell * dpr);

  var boardW = cssCell * 10;
  var boardH = cssCell * 20;
  var sideW = Math.round(cssCell * sideCells);
  var gap = Math.round(cssCell * gapCells);
  var pad = Math.max(8, Math.round(cssCell * 0.4));
  var inner = sideW - pad * 2;
  sizeBoard(b, boardW, boardH, px);

  var root = document.documentElement;
  root.style.setProperty('--card-pad', px(pad));
  root.style.setProperty('--gap', px(gap));
  root.style.setProperty('--side-w', px(sideW));
  root.style.setProperty('--board-h', px(boardH));

  holdCanvas.width = cellSize * 4;
  holdCanvas.height = cellSize * 2;
  holdCanvas.style.width = px(inner);
  holdCanvas.style.height = px(inner / 2);
  a.style.width = px(inner);
  a.style.height = px(inner / 2);
  d.style.width = px(sideW);
  d.style.height = px(boardH);

  // The queue keeps its 1:5 shape; it shrinks if the card is too short for it
  var headH = Math.round(Math.max(18, sideW / 4.5) * 1.6);
  var qH = Math.min(inner * 5, boardH - headH - pad * 2);
  previewCanvas.width = cellSize * 4;
  previewCanvas.height = cellSize * 20;
  previewCanvas.style.width = px(qH / 5);
  previewCanvas.style.height = px(qH);
  c.style.width = px(sideW);
  c.style.height = px(boardH);

  var content = document.getElementById('content');
  content.style.marginTop = '';
  content.style.marginBottom = '';

  // Text follows the board size
  root.style.fontSize = Math.min(Math.max(Math.round(boardH / 38), 13), 22) + 'px';
  stats.style.fontSize = '';
  stats.style.width = '';
  for (var i = 0, len = h3.length; i < len; i++) h3[i].style.fontSize = '';
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
  // Side panels grow with the board (tablets get room for a readable queue)
  var sideFor = function(cell) {
    return Math.min(Math.max(Math.round(cell * 2.8), 56), 128);
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
    // Tall phones: the queue gets a column wide enough to read (up to 84 px)
    var stripSide = Math.min(84, Math.max(64, Math.round(vw * 0.18)));
    var cellStrip = Math.min((availH - stripH) / 20, (availW - stripSide) / 10);
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
  side = strip ? Math.min(84, Math.max(64, Math.round(vw * 0.18))) : sideFor(cell);
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
  // A little margin so the I piece does not touch the panel edges
  var qH = Math.min((side - 12) * 5, boardH - 36);
  previewCanvas.style.width = px(qH / 5);
  previewCanvas.style.height = px(qH);
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
    replayKeys = { seed: rng.newSeed(), handling: {} };
    for (var i = 0; i < HANDLING.length; i++) replayKeys.handling[HANDLING[i]] = settings[HANDLING[i]];
    gametype = gt;
  }
  handling = replayKeys.handling;

  lineLimit = gametype === 0 ? 40 : Infinity;
  score = 0;
  level = 1;
  backToBack = false;
  combo = -1;
  maxCombo = 0;
  tetrises = 0;
  tspins = 0;
  allClears = 0;
  riseFrames = 0;
  garbageRows = 0;
  Fx.reset();

  // Input and handling state. The piece object outlives games, so its DAS
  //  state is reset too, or a game (and its replay) would start with what the
  //  last one left.
  keysDown = 0;
  lastKeys = 0;
  replayHeld = 0;
  pendingRelease = 0;
  Touch.reset();
  piece.shiftDir = 0;
  piece.shiftReleased = true;
  piece.shiftDelay = 0;
  piece.arrDelay = 0;
  piece.lockDelay = 0;

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
  if (handling.Gravity === 0) gravity = gravityUnit * 4;
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

  if (gametype === 7) garbageHole = ~~(rng.next() * 10);
  if (gametype === 3) setupDigRace();

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

/**
 * Dig Race: ten rows of garbage at the bottom, each with one hole, never in
 *  the same column in two rows next to each other.
 */
function setupDigRace() {
  digLines = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
  statsLines.innerHTML = 10;
  var holes = [];
  while (holes.length < 10) {
    var hole = ~~(rng.next() * 10);
    if (hole !== holes[holes.length - 1]) holes.push(hole);
  }
  for (var y = 21; y > 11; y--) {
    for (var x = 0; x < 10; x++) {
      if (holes[y - 12] !== x) stack.grid[x][y] = 8;
    }
  }
  stack.draw();
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
 * Park Miller "Minimal Standard" PRNG. Every random choice in a game (the
 *  piece bags, Dig Race and Survival garbage) comes from it, so a game is
 *  replayed from its seed. init() seeds it with newSeed(), or with the seed of
 *  the game being replayed.
 */
var rng = new function() {
  this.seed = 1;
  // A fresh seed, between 1 and 2147483645.
  this.newSeed = function() {
    return ~~(Math.random() * 2147483645) + 1;
  };
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
  var scored = scoredMode(gametype);
  document.getElementById('scoreRow').style.display = scored ? '' : 'none';
  document.getElementById('levelRow').style.display = gametype === 4 || gametype === 7 || gametype === 8 ? '' : 'none';
  document.getElementById('b').classList.toggle('tt-survival', gametype === 7);
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
  if (gametype === 8) return 20;
  if (gametype === 4 || gametype === 7) {
    var secondsPerRow = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
    return 1 / (secondsPerRow * FPS);
  }
  return null;
}

/**
 * Lock delay in steps: the Lock Delay setting, except in Master, where it
 *  starts at half a second and shrinks every level.
 */
function lockLimit() {
  if (gametype === 8) return Math.max(10, Math.round(30 - (level - 1) * 1.5));
  return handling['Lock Delay'];
}

/**
 * Survival: every few seconds a row of garbage with one hole rises from the
 *  floor. The hole usually stays in the same column, so the rows can be dug
 *  out with one well. Runs once per logic step.
 */
function survivalStep() {
  var seconds = elapsedMs() / 1000;
  var newLevel = Math.min(MARATHON_MAX_LEVEL, 1 + Math.floor(seconds / SURVIVAL_LEVEL));
  if (newLevel > level) {
    level = newLevel;
    statsLevel.innerHTML = level;
    showAction('LEVEL ' + level);
    Fx.pulse('level');
    if (typeof audioManager !== 'undefined') audioManager.playSound('level-up');
  }
  var every = Math.max(SURVIVAL_RISE_MIN, SURVIVAL_RISE - seconds / 25) * FPS;
  riseFrames++;
  Fx.rise(riseFrames / every);
  if (riseFrames < every) return;
  riseFrames = 0;
  if (rng.next() > 0.7) garbageHole = (garbageHole + 1 + ~~(rng.next() * 9)) % 10;
  garbageRows++;
  if (!stack.rise(garbageHole)) endGame(9, 'TOPPED OUT');
}

/**
 * Called by the stack after a piece locks. Scores line clears in the scored
 *  modes, tracks back-to-back Tetrises and levels, and drives the effects.
 */
function onLinesCleared(count, info) {
  info = info || {};
  var calls = [];
  var difficult = count === 4 || (info.tspin && count > 0);
  var points = 0; // times the level
  var bonus = 0; // already scaled
  if (info.tspin) {
    tspins++;
    points = (info.tspin === 'mini' ? TSPIN_MINI_SCORES : TSPIN_SCORES)[Math.min(count, 3)];
    calls.push((info.tspin === 'mini' ? 'T-SPIN MINI' : 'T-SPIN') + ['', ' SINGLE', ' DOUBLE', ' TRIPLE'][count]);
  } else if (count > 0) {
    points = LINE_SCORES[count];
    if (count === 4) {
      tetrises++;
      calls.push('TETRIS');
    }
  }
  if (count > 0) {
    if (difficult && backToBack) {
      points = Math.floor(points * 1.5);
      calls.push('BACK-TO-BACK');
    }
    backToBack = difficult;
    combo++;
    if (combo > maxCombo) maxCombo = combo;
    if (combo > 0) {
      bonus = 50 * combo * level;
      calls.push('COMBO ' + combo);
    }
    if (info.perfect) {
      allClears++;
      points += ALL_CLEAR_SCORES[count];
      calls.push('ALL CLEAR');
    }
  } else {
    combo = -1;
  }
  if (scoredMode(gametype)) score += points * level + bonus;
  if (count > 0) {
    if (gametype === 4 || gametype === 8) {
      var top = gametype === 8 ? MASTER_MAX_LEVEL : MARATHON_MAX_LEVEL;
      var newLevel = Math.min(top, 1 + Math.floor(lines / LINES_PER_LEVEL));
      if (newLevel > level) {
        level = newLevel;
        calls.push('LEVEL ' + level);
        Fx.pulse('level');
        if (typeof audioManager !== 'undefined') audioManager.playSound('level-up');
      }
    }
    if (typeof LiveBackground !== 'undefined') LiveBackground.onLinesCleared(count);
  }
  if (calls.length) showAction(calls.join('<br>'));
  statsScore.innerHTML = score;
  statsLevel.innerHTML = level;
}

/**
 * Points for dropping: 1 per row soft dropped, 2 per row hard dropped.
 */
function addDropScore(rows) {
  if (scoredMode(gametype) && rows > 0) {
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
  }, text.indexOf('<br>') !== -1 ? 1300 : 900);
}

/**
 * Ends the game. Wins and timed finishes record a personal best.
 */
function endGame(state, text) {
  gameState = state;
  msg.innerHTML = text;
  Fx.rise(0);
  document.getElementById('b').classList.remove('tt-danger');
  if (typeof audioManager !== 'undefined') audioManager.stopMusic();
  if (!watchingReplay) saveBest(state);
  else document.getElementById('goNote').innerHTML = '';
  renderRunStats();
  menu(3);
}

/** The results card on the game over screen. */
function renderRunStats() {
  var ms = elapsedMs();
  var secs = Math.max(1, ms / 1000);
  var rows = [['Time', formatTime(gametype === 5 ? Math.min(ms, ULTRA_FRAMES * (1000 / FPS)) : ms)]];
  if (scoredMode(gametype)) rows.push(['Score', score.toLocaleString('en-US')]);
  if (gametype === 4 || gametype === 7 || gametype === 8) rows.push(['Level', level]);
  rows.push(['Lines', lines]);
  rows.push(['Pieces', piecesSet]);
  rows.push(['Per second', (piecesSet / secs).toFixed(2)]);
  if (gametype === 7) rows.push(['Garbage', garbageRows]);
  rows.push(['Tetrises', tetrises]);
  rows.push(['T-spins', tspins]);
  rows.push(['Best combo', Math.max(0, maxCombo)]);
  if (allClears) rows.push(['All clears', allClears]);
  var html = '';
  for (var i = 0; i < rows.length; i++) html += '<div><dt>' + rows[i][0] + '</dt><dd>' + rows[i][1] + '</dd></div>';
  document.getElementById('goStats').innerHTML = html;
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
  } else if (gametype === 7) {
    var lasted = elapsedMs();
    result = GameKit.recordBest('tetris', Math.round(lasted), {
      mode: mode.key,
      label: mode.name + ' ' + formatTime(lasted),
    });
  } else if (scoredMode(gametype)) {
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
  if (type === 7) return formatTime(best.value);
  return type === 0 || type === 3 ? formatTime(best.value) : best.value.toLocaleString('en-US') + ' pts';
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
  // Hairline grid in the theme's colour (see liveBackground.js)
  ctx.fillStyle = window.TT_GRID || 'rgba(255, 255, 255, 0.06)';
  var t = Math.max(1, Math.round(renderScale));
  for (var x = cellSize; x < ctx.canvas.width; x += cellSize) {
    ctx.fillRect(x, 0, t, ctx.canvas.height);
  }
  for (var y = cellSize; y < ctx.canvas.height; y += cellSize) {
    ctx.fillRect(0, y, ctx.canvas.width, t);
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
    } else if (settings.Block === 5) {
      // Modern: a rounded tile with a gap, lit from above, a soft edge below
      var gp = Math.max(1, Math.round(cellSize * 0.06));
      var r = Math.max(2, Math.round(cellSize * 0.18));
      var bx = x + gp;
      var by = gp;
      var bw = cellSize - gp * 2;
      spriteCtx.beginPath();
      if (spriteCtx.roundRect) spriteCtx.roundRect(bx, by, bw, bw, r);
      else spriteCtx.rect(bx, by, bw, bw);
      var grad = spriteCtx.createLinearGradient(0, by, 0, by + bw);
      grad.addColorStop(0, shaded[i][1]);
      grad.addColorStop(0.55, shaded[i][0]);
      grad.addColorStop(1, shaded[i][2]);
      spriteCtx.fillStyle = grad;
      spriteCtx.fill();
      // shadow edge along the bottom
      spriteCtx.save();
      spriteCtx.clip();
      spriteCtx.fillStyle = shaded[i][3];
      spriteCtx.fillRect(bx, by + bw - Math.max(2, Math.round(bw * 0.12)), bw, bw);
      // top light
      var hl = spriteCtx.createLinearGradient(0, by, 0, by + bw * 0.5);
      hl.addColorStop(0, 'rgba(255, 255, 255, 0.45)');
      hl.addColorStop(1, 'rgba(255, 255, 255, 0)');
      spriteCtx.fillStyle = hl;
      spriteCtx.fillRect(bx + gp, by + gp, bw - gp * 2, bw * 0.45);
      spriteCtx.restore();
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

/**
 * Keys are matched by KeyboardEvent.code, the physical key, so the controls
 *  stay in the same place on any keyboard layout. keyId() (menu.js) also
 *  treats the left and right Shift, Control, Alt and Meta keys as one key.
 */
var SCROLL_KEYS = ['Space', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];

addEventListener(
  'keydown',
  function(e) {
    var id = keyId(e);
    if (SCROLL_KEYS.indexOf(id) !== -1) e.preventDefault();
    if (id === binds.pause) {
      if (paused) {
        unpause();
      } else {
        pause();
      }
    }
    if (id === binds.retry && gametype !== void 0 && !document.querySelector('.menu.on:not(#go):not(#pause)')) {
      init(gametype);
    }
    if (!watchingReplay) {
      for (var name in flags) {
        if (id === binds[name]) {
          keysDown |= flags[name];
          break;
        }
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
  if (watchingReplay || !(keysDown & flag)) return;
  if (seenKeys & flag) keysDown &= ~flag;
  else pendingRelease |= flag;
}

addEventListener(
  'keyup',
  function(e) {
    if (watchingReplay) return;
    var id = keyId(e);
    for (var name in flags) {
      if (id === binds[name]) releaseKey(flags[name]);
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

/**
 * Reads the keys for this step, at the start of every countdown and play step.
 *  Live, keysDown is recorded whenever it differs from what was recorded last.
 *  In a replay keysDown is set from the recording on every step, so nothing
 *  else that touches it (pausing, an on-screen button let go) changes the game.
 */
function readKeys() {
  if (watchingReplay) {
    if (frame in replayKeys) replayHeld = replayKeys[frame];
    keysDown = replayHeld;
  } else if (keysDown !== replayHeld) {
    replayKeys[frame] = replayHeld = keysDown;
  }
}

/**
 * One step of play.
 */
function update() {
  readKeys();
  Touch.apply();
  applyKeys();
  piece.update();
  if (gametype === 7 && gameState === 0) survivalStep();
  checkFinish();
  statistics();
  lastKeys = keysDown;
}

/**
 * Hold, rotations, shifting and drops. Hold, rotations and hard drop act when
 *  their key goes down; shifting and soft drop while their key is held.
 */
function applyKeys() {
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
}

/** Win and finish conditions. */
function checkFinish() {
  if (gameState !== 0) return;
  if (gametype === 0 && lines >= lineLimit) {
    endGame(1, 'GREAT!');
  } else if (gametype === 3 && digLines.length === 0) {
    endGame(1, 'GREAT!');
  } else if (gametype === 4 && lines >= MARATHON_MAX_LEVEL * LINES_PER_LEVEL) {
    endGame(1, 'GREAT!');
  } else if (gametype === 8 && lines >= MASTER_MAX_LEVEL * LINES_PER_LEVEL) {
    endGame(1, 'MASTER!');
  } else if (gametype === 5 && elapsedMs() >= ULTRA_FRAMES * (1000 / FPS)) {
    endGame(1, 'TIME!');
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
    if (!paused) {
      frame++;
      update();
    }
  } else if (gameState === 2) {
    frame++;
    countdownStep();
  } else if (toGreyRow >= 2) {
    frame++;
    fadeStep();
  }
}

/**
 * READY, GO!, then the first piece. Keys are read (and recorded) during the
 *  countdown too. An arrow held at the end of it starts the game with the DAS
 *  already charged (DAS preload). lastKeys only follows the keys while an
 *  arrow is held, so a rotation or hold held through GO acts on the first piece.
 */
function countdownStep() {
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
  readKeys();
  if (keysDown & flags.moveLeft) {
    lastKeys = keysDown;
    piece.shiftDelay = handling.DAS;
    piece.shiftReleased = false;
    piece.shiftDir = -1;
  } else if (keysDown & flags.moveRight) {
    lastKeys = keysDown;
    piece.shiftDelay = handling.DAS;
    piece.shiftReleased = false;
    piece.shiftDir = 1;
  }
}

/**
 * Fade to grey, a row every other step, played when the game ends.
 */
function fadeStep() {
  if (toGreyRow === 21) clear(activeCtx);
  if (frame % 2) {
    for (var x = 0; x < 10; x++) {
      if (stack.grid[x][toGreyRow]) stack.grid[x][toGreyRow] = gameState - 1;
    }
    stack.draw();
    toGreyRow--;
  }
}
