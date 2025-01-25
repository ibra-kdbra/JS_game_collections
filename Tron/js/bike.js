import { Coord } from './coord.js';

export class Bike {
  static DIFFS = {
    "N": new Coord(-1, 0),
    "E": new Coord(0, 1),
    "S": new Coord(1, 0),
    "W": new Coord(0, -1)
  };

  constructor(board, startPos, dir) {
    this.dir = dir;
    this.turning = false;
    this.board = board;
    this.alive = true;
    this.opponent = null;

    const start = new Coord(startPos[0], startPos[1]);
    this.segments = [start];
  }

  isOccupying(coord) {
    return this.segments.some(segment => segment.equals(coord));
  }

  head() {
    return this.segments[this.segments.length - 1];
  }

  isValid(coord) {
    // Check boundaries on board
    if (!this.board.validPosition(coord)) {
      return false;
    }
    // Check if bike runs into itself
    for (let i = 0; i < this.segments.length - 1; i++) {
      if (this.segments[i].equals(coord)) {
        return false;
      }
    }
    // Check if bike runs into opponent
    if (this.opponent && this.opponent.isOccupying(coord)) {
      return false;
    }
    return true;
  }

  move() {
    const nextCoord = this.head().plus(Bike.DIFFS[this.dir]);
    this.segments.push(nextCoord);

    this.turning = false;
    if (!this.isValid(nextCoord)) {
      this.alive = false;
    }
  }

  turn(dir) {
    if (Bike.DIFFS[dir].isOpposite(Bike.DIFFS[this.dir]) || this.turning) {
      return;
    } else {
      this.turning = true;
      this.dir = dir;
    }
  }

  // Computer AI
  computerChangeDir() {
    let turningDirs;
    if (this.dir === "N" || this.dir === "S") {
      turningDirs = ["W", "E"];
    } else {
      turningDirs = ["N", "S"];
    }

    // Decide the turn to make based on the length of the open path
    const [firstDir, secondDir] = turningDirs;
    let firstDirPathCount = 0;
    let firstDirCoord = this.head().plus(Bike.DIFFS[firstDir]);

    while (this.isValid(firstDirCoord)) {
      firstDirPathCount++;
      firstDirCoord = firstDirCoord.plus(Bike.DIFFS[firstDir]);
    }

    let secondDirPathCount = 0;
    let secondDirCoord = this.head().plus(Bike.DIFFS[secondDir]);

    while (this.isValid(secondDirCoord)) {
      secondDirPathCount++;
      secondDirCoord = secondDirCoord.plus(Bike.DIFFS[secondDir]);
    }

    // Go with the direction that has the clearest path
    if (firstDirPathCount > secondDirPathCount) {
      this.dir = firstDir;
    } else {
      this.dir = secondDir;
    }
  }

  computerMove() {
    let nextCoord = this.head().plus(Bike.DIFFS[this.dir]);

    // Make a random turn once in a while to avoid wall hugging
    if (Math.random() > this.computerTurnFrequency()) {
      this.computerChangeDir();
    }

    nextCoord = this.head().plus(Bike.DIFFS[this.dir]);

    if (this.isValid(nextCoord)) {
      this.segments.push(nextCoord);
    } else {
      this.computerChangeDir();
      nextCoord = this.head().plus(Bike.DIFFS[this.dir]);
      if (this.isValid(nextCoord)) {
        this.segments.push(nextCoord);
      } else {
        this.alive = false;
      }
    }
  }

  computerTurnFrequency() {
    // Make the easy difficulty turn more frequently
    switch (this.board.difficulty) {
      case 1:
        return 0.95;
      case 2:
        return 0.98;
      default:
        return 1.0; // hardest will make no turns and just hug the wall
    }
  }
}
