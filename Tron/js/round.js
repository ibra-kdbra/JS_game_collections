import { Board } from './board.js';
import { Bike } from './bike.js';

// Difficulty also sets the pace of the whole round.
const PACE = { 1: 1, 2: 1.12, 3: 1.25 };

export class Round {
  /**
   * @param {{ arena: string, layout: string, portrait: boolean, players: number, difficulty: number }} options
   */
  constructor({ arena, layout, portrait, players, difficulty }) {
    this.board = new Board({ arena, layout, portrait });
    this.players = players;
    this.difficulty = difficulty;
    this.speed = this.board.speed * (players === 1 ? PACE[difficulty] : 1);
    this.blue = new Bike(this.board, 1, this.board.start(1));
    this.orange = new Bike(this.board, 2, this.board.start(2));
    this.result = null; // 'blue' | 'orange' | 'draw'
    this.crashes = [];
    this.moved = []; // Cells painted this step, for the renderer.
  }

  get over() {
    return this.result !== null;
  }

  update(dt) {
    if (this.over) return;
    const bikes = [this.blue, this.orange];
    const steps = bikes.map((bike) => {
      bike.updateBoost(dt);
      bike.progress += bike.speed(this.speed) * dt;
      const n = Math.floor(bike.progress);
      bike.progress -= n;
      return n;
    });

    // Bikes move one cell at a time in lockstep, so a boosted bike can't
    // tunnel through a trail and two bikes entering the same cell both crash.
    for (let s = 0; s < Math.max(...steps); s++) {
      const movers = bikes.filter((bike, i) => steps[i] > s);
      if (this.players === 1 && movers.includes(this.orange)) {
        this.orange.think(this.blue, this.difficulty);
      }
      const targets = movers.map((bike) => bike.nextCell());
      const blocked = targets.map((t) => !this.board.isFree(t.x, t.y));
      if (targets.length === 2 && targets[0].x === targets[1].x && targets[0].y === targets[1].y) {
        blocked[0] = blocked[1] = true;
      }
      movers.forEach((bike, i) => {
        const t = targets[i];
        if (blocked[i]) {
          bike.alive = false;
          this.crashes.push({ x: t.x, y: t.y, id: bike.id });
          // Ramming the head of a cycle that isn't moving away this step is a
          // head-on collision: both go down.
          const other = bike === this.blue ? this.orange : this.blue;
          if (!movers.includes(other) && other.x === t.x && other.y === t.y) {
            other.alive = false;
            this.crashes.push({ x: t.x, y: t.y, id: other.id });
          }
          return;
        }
        bike.x = t.x;
        bike.y = t.y;
        this.board.set(t.x, t.y, bike.id);
        this.moved.push({ x: t.x, y: t.y, id: bike.id });
      });
      if (!this.blue.alive || !this.orange.alive) break;
    }

    if (!this.blue.alive && !this.orange.alive) this.result = 'draw';
    else if (!this.blue.alive) this.result = 'orange';
    else if (!this.orange.alive) this.result = 'blue';
  }
}
