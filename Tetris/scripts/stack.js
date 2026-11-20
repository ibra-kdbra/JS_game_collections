function Stack() {
  this.grid = [];
}
/**
 * Creates a matrix for the playfield.
 */
Stack.prototype.new = function(x, y) {
  var cells = new Array(x);
  for (var i = 0; i < x; i++) {
    cells[i] = new Array(y);
  }
  this.grid = cells;
};
/**
 * Adds tetro to the stack, and clears lines if they fill up.
 */
Stack.prototype.addPiece = function(tetro) {
  var once = false;
  var tspin = this.tSpin(tetro);

  // Add the piece to the stack.
  var range = [];
  var valid = false;
  for (var x = 0; x < tetro.length; x++) {
    for (var y = 0; y < tetro[x].length; y++) {
      if (tetro[x][y]) {
        this.grid[x + piece.x][y + piece.y] = tetro[x][y];
        // Get column for finesse
        if (!once || x + piece.x < column) {
          column = x + piece.x;
          once = true;
        }
        // Check which lines get modified
        if (range.indexOf(y + piece.y) === -1) {
          range.push(y + piece.y);
          // This checks if any cell is in the play field. If there
          //  isn't any this is called a lock out and the game ends.
          if (y + piece.y > 1) valid = true;
        }
      }
    }
  }

  // Lock out. Zen never ends: the board is cleared instead.
  if (!valid) {
    if (gametype === 6) {
      this.new(10, 22);
      this.draw();
      showAction('FRESH START');
    } else {
      endGame(9, 'LOCK OUT!');
    }
    return;
  }

  // Check modified lines for full lines.
  range = range.sort(function(a, b) {
    return a - b;
  });
  var totalLinesCleared = 0;
  var clearedRows = [];
  for (var row = range[0], len = row + range.length; row < len; row++) {
    var count = 0;
    for (var x = 0; x < 10; x++) {
      if (this.grid[x][row]) count++;
    }
    // Clear the line. This basically just moves down the stack.
    // TODO Ponder during the day and see if there is a more elegant solution.
    if (count === 10) {
      lines++; // NOTE stats
      totalLinesCleared++; // Track for effects
      clearedRows.push(row);

      if (gametype === 3) {
        if (digLines.indexOf(row) !== -1) {
          digLines.splice(digLines.indexOf(row), 1);
        }
      }
      for (var y = row; y >= -1; y--) {
        for (var x = 0; x < 10; x++) {
          this.grid[x][y] = this.grid[x][y - 1];
        }
      }
    }
  }

  // Spectacular effects for line clears!
  if (totalLinesCleared > 0) {
    // Audio effects
    if (typeof audioManager !== 'undefined') {
      const audioMap = ['', 'single', 'double', 'triple', 'tetris'];
      if (totalLinesCleared <= 4) {
        audioManager.playSound(`line-${audioMap[totalLinesCleared]}`);
        setTimeout(() => {
          audioManager.playSound(`voice-${audioMap[totalLinesCleared]}`);
        }, 300);
      }

    }

    // Particle effects
    if (typeof particleSystem !== 'undefined') {
      particleSystem.createLineExplosion(totalLinesCleared);
    }
  }

  if (clearedRows.length) Fx.rows(clearedRows, totalLinesCleared === 4 || Boolean(tspin));
  onLinesCleared(totalLinesCleared, { tspin: tspin, perfect: totalLinesCleared > 0 && this.empty() });

  statsFinesse += piece.finesse - finesse[piece.index][piece.pos][column];
  piecesSet++; // NOTE Stats
  // TODO Might not need this (same for in init)
  column = 0;

  statsPiece.innerHTML = piecesSet;
  updateLineStat();

  this.draw();
  this.checkDanger();
};

/**
 * T-spin check for the piece about to lock: a T whose last move was a
 *  rotation, with three of the four corners around its centre filled. It is a
 *  full T-spin when both corners beside its nose are filled (or the last
 *  rotation used the far kick), otherwise a mini. Returns '', 'mini' or 'full'.
 */
Stack.prototype.tSpin = function(tetro) {
  if (piece.index !== 5 || !piece.lastRotate) return '';
  var px = piece.x;
  var py = Math.floor(piece.y);
  var grid = this.grid;
  var filled = function(cx, cy) {
    var x = px + cx;
    var y = py + cy;
    return x < 0 || x > 9 || y > 21 || (y >= 0 && Boolean(grid[x][y]));
  };
  // The nose: the cell beside the centre whose opposite side is empty.
  var nx = 0;
  var ny = 0;
  var dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (var i = 0; i < 4; i++) {
    var d = dirs[i];
    if (tetro[1 + d[0]][1 + d[1]] && !tetro[1 - d[0]][1 - d[1]]) {
      nx = d[0];
      ny = d[1];
    }
  }
  var corners = 0;
  var front = 0;
  var cs = [[0, 0], [2, 0], [0, 2], [2, 2]];
  for (var k = 0; k < 4; k++) {
    if (!filled(cs[k][0], cs[k][1])) continue;
    corners++;
    if (nx !== 0 ? cs[k][0] === 1 + nx : cs[k][1] === 1 + ny) front++;
  }
  if (corners < 3) return '';
  return front === 2 || piece.lastKick === 4 ? 'full' : 'mini';
};

/** True if the playfield is completely empty (an all clear). */
Stack.prototype.empty = function() {
  for (var x = 0; x < 10; x++) {
    for (var y = 0; y < 22; y++) if (this.grid[x][y]) return false;
  }
  return true;
};

/** The board glows red while the stack reaches into the top rows. */
Stack.prototype.checkDanger = function() {
  var top = 22;
  for (var x = 0; x < 10 && top > 0; x++) {
    for (var y = 0; y < top; y++) {
      if (this.grid[x][y]) {
        top = y;
        break;
      }
    }
  }
  document.getElementById('b').classList.toggle('tt-danger', gameState === 0 && top < 7);
};

/**
 * Pushes the stack up one row and fills the floor with garbage, open at the
 *  hole column. Returns false if that tops the stack out.
 */
Stack.prototype.rise = function(hole) {
  for (var x = 0; x < 10; x++) {
    if (this.grid[x][0]) return false;
  }
  for (var y = 0; y < 21; y++) {
    for (var x = 0; x < 10; x++) this.grid[x][y] = this.grid[x][y + 1];
  }
  for (var x = 0; x < 10; x++) this.grid[x][21] = x === hole ? void 0 : 8;
  // Lift the falling piece with the stack if it is now inside it.
  if (!piece.moveValid(0, 0, piece.tetro)) {
    piece.y -= 1;
    if (!piece.moveValid(0, 0, piece.tetro)) return false;
  }
  piece.dirty = true;
  this.draw();
  this.checkDanger();
  Fx.pulse('rise');
  if (typeof audioManager !== 'undefined') audioManager.playSound('place');
  return true;
};
/**
 * Draws the stack.
 */
Stack.prototype.draw = function() {
  clear(stackCtx);
  draw(this.grid, 0, 0, stackCtx);

  // Darken Stack
  // TODO wrap this with an option.
  stackCtx.globalCompositeOperation = 'source-atop';
  stackCtx.fillStyle = 'rgba(0,0,0,0.3)';
  stackCtx.fillRect(0, 0, stackCanvas.width, stackCanvas.height);
  stackCtx.globalCompositeOperation = 'source-over';

  if (settings.Outline) {
    var b = ~~(cellSize / 8);
    var c = cellSize;
    var lineCanvas = document.createElement('canvas');
    lineCanvas.width = stackCanvas.width;
    lineCanvas.height = stackCanvas.height;
    var lineCtx = lineCanvas.getContext('2d');
    lineCtx.fillStyle = 'rgba(255,255,255,0.5)';
    lineCtx.beginPath();
    for (var x = 0, len = this.grid.length; x < len; x++) {
      for (var y = 0, wid = this.grid[x].length; y < wid; y++) {
        if (this.grid[x][y]) {
          if (x < 9 && !this.grid[x + 1][y]) {
            lineCtx.fillRect(x * c + c - b, y * c - 2 * c, b, c);
          }
          if (x > 0 && !this.grid[x - 1][y]) {
            lineCtx.fillRect(x * c, y * c - 2 * c, b, c);
          }
          if (y < 21 && !this.grid[x][y + 1]) {
            lineCtx.fillRect(x * c, y * c - 2 * c + c - b, c, b);
          }
          if (!this.grid[x][y - 1]) {
            lineCtx.fillRect(x * c, y * c - 2 * c, c, b);
          }
          // Diags
          if (x < 9 && y < 21) {
            if (!this.grid[x + 1][y] && !this.grid[x][y + 1]) {
              lineCtx.clearRect(x * c + c - b, y * c - 2 * c + c - b, b, b);
              lineCtx.fillRect(x * c + c - b, y * c - 2 * c + c - b, b, b);
            } else if (
              !this.grid[x + 1][y + 1] &&
              this.grid[x + 1][y] &&
              this.grid[x][y + 1]
            ) {
              lineCtx.moveTo(x * c + c, y * c - 2 * c + c - b);
              lineCtx.lineTo(x * c + c, y * c - 2 * c + c);
              lineCtx.lineTo(x * c + c - b, y * c - 2 * c + c);
              lineCtx.arc(
                x * c + c,
                y * c - 2 * c + c,
                b,
                (3 * Math.PI) / 2,
                Math.PI,
                true,
              );
            }
          }
          if (x < 9) {
            if (!this.grid[x + 1][y] && !this.grid[x][y - 1]) {
              lineCtx.clearRect(x * c + c - b, y * c - 2 * c, b, b);
              lineCtx.fillRect(x * c + c - b, y * c - 2 * c, b, b);
            } else if (
              !this.grid[x + 1][y - 1] &&
              this.grid[x + 1][y] &&
              this.grid[x][y - 1]
            ) {
              lineCtx.moveTo(x * c + c - b, y * c - 2 * c);
              lineCtx.lineTo(x * c + c, y * c - 2 * c);
              lineCtx.lineTo(x * c + c, y * c - 2 * c + b);
              lineCtx.arc(
                x * c + c,
                y * c - 2 * c,
                b,
                Math.PI / 2,
                Math.PI,
                false,
              );
            }
          }
          if (x > 0 && y < 21) {
            if (!this.grid[x - 1][y] && !this.grid[x][y + 1]) {
              lineCtx.clearRect(x * c, y * c - 2 * c + c - b, b, b);
              lineCtx.fillRect(x * c, y * c - 2 * c + c - b, b, b);
            } else if (
              !this.grid[x - 1][y + 1] &&
              this.grid[x - 1][y] &&
              this.grid[x][y + 1]
            ) {
              lineCtx.moveTo(x * c, y * c - 2 * c + c - b);
              lineCtx.lineTo(x * c, y * c - 2 * c + c);
              lineCtx.lineTo(x * c + b, y * c - 2 * c + c);
              lineCtx.arc(
                x * c,
                y * c - 2 * c + c,
                b,
                Math.PI * 2,
                (3 * Math.PI) / 2,
                true,
              );
            }
          }
          if (x > 0) {
            if (!this.grid[x - 1][y] && !this.grid[x][y - 1]) {
              lineCtx.clearRect(x * c, y * c - 2 * c, b, b);
              lineCtx.fillRect(x * c, y * c - 2 * c, b, b);
            } else if (
              !this.grid[x - 1][y - 1] &&
              this.grid[x - 1][y] &&
              this.grid[x][y - 1]
            ) {
              lineCtx.moveTo(x * c + b, y * c - 2 * c);
              lineCtx.lineTo(x * c, y * c - 2 * c);
              lineCtx.lineTo(x * c, y * c - 2 * c + b);
              lineCtx.arc(
                x * c,
                y * c - 2 * c,
                b,
                Math.PI / 2,
                Math.PI * 2,
                true,
              );
            }
          }
        }
      }
    }
    lineCtx.fill();
    stackCtx.drawImage(lineCanvas, 0, 0);
  }
};
var stack = new Stack();
