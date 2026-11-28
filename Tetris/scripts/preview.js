function Preview() {
  this.grabBag = this.gen();
}
Preview.prototype.init = function() {
  // The first piece is never an O, S or Z.
  while (1) {
    this.grabBag = this.gen();
    if ([3, 4, 6].indexOf(this.grabBag[0]) === -1) break;
  }
  this.grabBag.push.apply(this.grabBag, this.gen());
  this.draw();
};
Preview.prototype.next = function() {
  var next;
  next = this.grabBag.shift();
  if (this.grabBag.length === 7) {
    this.grabBag.push.apply(this.grabBag, this.gen());
  }
  this.draw();
  return next;
};
/**
 * Creates a "grab bag" of the 7 tetrominos, shuffled with the game's rng
 *  (Fisher-Yates). Not with sort() and a random comparator: how many times
 *  sort() calls the comparator is up to the browser, and can change while the
 *  page runs, so the same seed would not always give the same pieces and
 *  replays would get other pieces than their game.
 */
Preview.prototype.gen = function() {
  var pieceList = [0, 1, 2, 3, 4, 5, 6];
  for (var i = pieceList.length - 1; i > 0; i--) {
    var j = ~~(rng.next() * (i + 1));
    var temp = pieceList[i];
    pieceList[i] = pieceList[j];
    pieceList[j] = temp;
  }
  return pieceList;
};
/**
 * Draws the piece preview.
 */
Preview.prototype.draw = function() {
  clear(previewCtx);
  for (var i = 0; i < 6; i++) {
    if (this.grabBag[i] === 0 || this.grabBag[i] === 3) {
      draw(
        pieces[this.grabBag[i]].tetro,
        pieces[this.grabBag[i]].x - 3,
        pieces[this.grabBag[i]].y + 2 + i * 3,
        previewCtx,
      );
    } else {
      draw(
        pieces[this.grabBag[i]].tetro,
        pieces[this.grabBag[i]].x - 2.5,
        pieces[this.grabBag[i]].y + 2 + i * 3,
        previewCtx,
      );
    }
  }
};
var preview = new Preview();
