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
    if (!this.board.validPosition(coord)) return false;
    // Check if bike runs into itself (excluding the head, as is typical)
    for (let i = 0; i < this.segments.length - 1; i++) {
      if (this.segments[i].equals(coord)) return false;
    }
    // Check collision with opponent
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

  countFreeArea(startCoord) {
    if (!this.isValid(startCoord)) return 0;
    const visited = new Set();
    const queue = [startCoord];
    let count = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      const key = `${current.i},${current.j}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (!this.isValid(current)) continue;
      count++;

      // Explore neighbors
      for (let diffKey in Bike.DIFFS) {
        const neighbor = current.plus(Bike.DIFFS[diffKey]);
        const neighborKey = `${neighbor.i},${neighbor.j}`;
        if (!visited.has(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }
    return count;
  }

  // Decide direction based on largest free area among possible turns.
  // This method looks in all directions: straight, left, right.
  // You can tweak which directions to compare.
  computerAdvancedAI() {
    const possibleDirections = [];
    // Straight
    possibleDirections.push(this.dir);
    // Left / Right relative to current
    if (this.dir === "N" || this.dir === "S") {
      possibleDirections.push("W");
      possibleDirections.push("E");
    } else {
      possibleDirections.push("N");
      possibleDirections.push("S");
    }

    let bestDir = this.dir;
    let bestArea = -1;
    for (const d of possibleDirections) {
      const nextCoord = this.head().plus(Bike.DIFFS[d]);
      const area = this.countFreeArea(nextCoord);
      if (area > bestArea) {
        bestArea = area;
        bestDir = d;
      }
    }
    this.dir = bestDir;
  }
  
  // Computer move with advanced AI plus a small random factor
  computerMove() {
    let nextCoord = this.head().plus(Bike.DIFFS[this.dir]);

    // Occasionally do a quick logic check to see if we should pick a new direction
    if (Math.random() > this.computerTurnFrequency()) {
      this.computerAdvancedAI();
    }

    nextCoord = this.head().plus(Bike.DIFFS[this.dir]);

    if (this.isValid(nextCoord)) {
      this.segments.push(nextCoord);
    } else {
      // If that direction is no longer valid, try to choose again:
      this.computerAdvancedAI();
      nextCoord = this.head().plus(Bike.DIFFS[this.dir]);
      if (this.isValid(nextCoord)) {
        this.segments.push(nextCoord);
      } else {
        this.alive = false;
      }
    }
  }

  computerTurnFrequency() {
    switch (this.board.difficulty) {
      case 1:
        return 0.95;
      case 2:
        return 0.98;
      default:
        return 1.0; 
    }
  }
}
