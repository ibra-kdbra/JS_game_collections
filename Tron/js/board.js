import { Bike } from './bike.js';

export class Board {
  constructor(dimX, dimY) {
    this.dimX = dimX;
    this.dimY = dimY;

    const player1StartPos = [Math.floor(dimY / 2), Math.floor((7 * dimX) / 8)];
    this.player1 = new Bike(this, player1StartPos, "W");

    const player2StartPos = [Math.floor(dimY / 2), Math.floor(dimX / 8)];
    this.player2 = new Bike(this, player2StartPos, "E");

    this.player1.opponent = this.player2;
    this.player2.opponent = this.player1;

    this.difficulty = window.difficulty ? window.difficulty : 1;
  }

  validPosition(coord) {
    return (
      coord.i >= 0 &&
      coord.i < this.dimY &&
      coord.j >= 0 &&
      coord.j < this.dimX
    );
  }
}
