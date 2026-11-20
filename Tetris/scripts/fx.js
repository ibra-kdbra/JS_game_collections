/**
 * Board effects drawn in plain DOM over the playfield: a flash across cleared
 * rows, a streak behind hard drops, a pulse when the level goes up or garbage
 * rises, and the Survival rise meter. Positions are percentages of the board,
 * so they follow every layout and screen density. Purely visual: the game
 * logic and replays never read them.
 */
var Fx = (function() {
  var layer = document.getElementById('fx');
  var board = document.getElementById('b');
  var meter = document.querySelector('#rise i');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  // Piece colours by index (I J L O S T Z), close to every block style.
  var COLORS = ['#22d3ee', '#3b82f6', '#f97316', '#facc15', '#4ade80', '#c084fc', '#f87171'];
  var shownRise = -1;

  function add(cls, style) {
    if (!layer) return null;
    var el = document.createElement('i');
    el.className = cls;
    for (var k in style) el.style[k] = style[k];
    el.addEventListener('animationend', function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
    layer.appendChild(el);
    // Nothing should outlive a second, even if an animation never ends.
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1200);
    return el;
  }

  /** Visible row (0 at the top of the board) as a percentage. */
  var rowTop = function(row) {
    return ((row - 2) / 20) * 100 + '%';
  };

  return {
    /** A bright band across each cleared row; brighter for a Tetris or a T-spin. */
    rows: function(rows, big) {
      for (var i = 0; i < rows.length; i++) {
        add('fx-row' + (big ? ' fx-big' : ''), { top: rowTop(rows[i]), height: '5%' });
      }
      if (big && !reduced.matches) this.pulse('big');
    },

    /** A streak in each column the piece fell through on a hard drop. */
    trail: function(tetro, x, y, rows, index) {
      if (reduced.matches || rows < 2) return;
      var color = COLORS[index] || '#ffffff';
      for (var cx = 0; cx < tetro.length; cx++) {
        var top = -1;
        for (var cy = 0; cy < tetro[cx].length; cy++) {
          if (tetro[cx][cy]) {
            top = cy;
            break;
          }
        }
        if (top < 0) continue;
        var from = Math.max(2, y + top);
        var to = y + top + rows;
        if (to <= from || !layer) continue;
        add('fx-trail', {
          left: (x + cx) * 10 + '%',
          width: '10%',
          top: rowTop(from),
          height: ((to - from) / 20) * 100 + '%',
        }).style.setProperty('--fx-color', color);
      }
    },

    /** A short pulse of the board edge: 'level', 'rise' or 'big'. */
    pulse: function(kind) {
      if (!board || reduced.matches) return;
      var cls = 'fx-pulse-' + kind;
      board.classList.remove(cls);
      void board.offsetWidth; // restart the animation
      board.classList.add(cls);
      setTimeout(function() {
        board.classList.remove(cls);
      }, 700);
    },

    /** Survival: how close the next garbage row is, 0 to 1. */
    rise: function(k) {
      if (!meter) return;
      var v = Math.round(Math.min(1, Math.max(0, k)) * 100);
      if (v === shownRise) return;
      shownRise = v;
      meter.style.width = v + '%';
      meter.parentNode.classList.toggle('near', v > 80);
    },

    reset: function() {
      if (layer) layer.innerHTML = '';
      this.rise(0);
      if (board) board.classList.remove('tt-danger');
    },
  };
})();
