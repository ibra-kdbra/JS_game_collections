/**
 * One game of Minesweeper: rules, clock, hint and undo. No DOM, so it can be
 * driven by the UI, by keyboard, or by a test.
 */

import { RULES } from './config.js';
import { generate } from './generator.js';
import { deduce, floodOpen, neighbours } from './solver.js';

export const HIDDEN = 0;
export const FLAG = 1;
export const QUESTION = 2;

export class Game {
  /**
   * @param {object} o
   * @param {number} o.w
   * @param {number} o.h
   * @param {number} o.mines
   * @param {boolean} [o.noGuess=true]
   * @param {() => number} [o.rng=Math.random]
   * @param {number} [o.start]       fixed first cell (daily, puzzles): the board is built now and opened there
   * @param {number} [o.minPair=0]
   * @param {number} [o.maxOpen=1]
   */
  constructor({ w, h, mines, noGuess = true, rng = Math.random, start, minPair = 0, maxOpen = 1 }) {
    Object.assign(this, { w, h, total: mines, noGuess, rng, minPair, maxOpen });
    this.n = w * h;
    this.nb = neighbours(w, h);
    this.open = new Uint8Array(this.n);
    this.mark = new Uint8Array(this.n); // HIDDEN, FLAG or QUESTION
    this.mines = null;
    this.counts = null;
    this.state = 'ready'; // ready | playing | won | lost
    this.opened = 0;
    this.boom = -1;
    this.penalty = 0;
    this.hints = 0;
    this.undosLeft = RULES.undosPerGame;
    this.snapshot = null;
    this.genInfo = null;
    this.fixedStart = start ?? -1;
    this.clock = { acc: 0, since: 0, running: false };
    if (start !== undefined) {
      this.build(start);
      this.preopened = floodOpen(w, h, this.counts, this.open, start);
      this.opened = this.preopened.length;
    }
  }

  build(start) {
    const g = generate({ w: this.w, h: this.h, mines: this.total, start, rng: this.rng, noGuess: this.noGuess, minPair: this.minPair, maxOpen: this.maxOpen });
    this.mines = g.mines;
    this.counts = g.counts;
    this.genInfo = g;
  }

  /* ---------- clock ---------- */

  now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
  startClock() {
    if (this.clock.running) return;
    this.clock.since = this.now();
    this.clock.running = true;
  }
  stopClock() {
    if (!this.clock.running) return;
    this.clock.acc += this.now() - this.clock.since;
    this.clock.running = false;
  }
  /** Seconds on the clock including penalties. */
  seconds() {
    const live = this.clock.running ? this.now() - this.clock.since : 0;
    return (this.clock.acc + live) / 1000 + this.penalty;
  }
  get flags() {
    let f = 0;
    for (let i = 0; i < this.n; i++) if (this.mark[i] === FLAG) f++;
    return f;
  }
  get over() {
    return this.state === 'won' || this.state === 'lost';
  }

  /* ---------- moves ---------- */

  begin(i) {
    if (!this.mines) this.build(i);
    this.state = 'playing';
    this.startClock();
  }

  save() {
    this.snapshot = { open: this.open.slice(), mark: this.mark.slice(), opened: this.opened };
  }

  /**
   * Reveal a cell. Returns { opened: number[] } in cascade order, or { boom } on a mine.
   * Clicking an open number chords instead.
   */
  reveal(i) {
    if (this.over || this.mark[i] === FLAG) return { opened: [] };
    if (this.open[i]) return this.chord(i);
    if (this.state === 'ready') this.begin(i);
    this.save();
    if (this.mines[i]) return this.lose(i);
    const opened = floodOpen(this.w, this.h, this.counts, this.open, i, this.flagMask());
    this.afterOpen(opened);
    return { opened };
  }

  /** Open every unflagged neighbour of a number whose flags match it. */
  chord(i) {
    if (this.over || !this.open[i] || this.counts[i] === 0) return { opened: [] };
    let flags = 0;
    const targets = [];
    for (const j of this.nb[i]) {
      if (this.open[j]) continue;
      if (this.mark[j] === FLAG) flags++;
      else targets.push(j);
    }
    if (flags !== this.counts[i] || !targets.length) return { opened: [], refused: flags !== this.counts[i] };
    this.save();
    const hit = targets.find((j) => this.mines[j]);
    if (hit !== undefined) return this.lose(hit);
    const opened = [];
    const mask = this.flagMask();
    for (const j of targets) opened.push(...floodOpen(this.w, this.h, this.counts, this.open, j, mask));
    this.afterOpen(opened);
    return { opened, chord: true };
  }

  flagMask() {
    const m = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++) if (this.mark[i] === FLAG) m[i] = 1;
    return m;
  }

  afterOpen(list) {
    this.opened += list.length;
    for (const j of list) this.mark[j] = HIDDEN;
    if (this.hintCell !== undefined && this.open[this.hintCell]) this.hintCell = undefined;
    if (this.opened === this.n - this.total) {
      this.state = 'won';
      this.stopClock();
      for (let j = 0; j < this.n; j++) if (this.mines[j]) this.mark[j] = FLAG;
    }
  }

  lose(i) {
    this.state = 'lost';
    this.boom = i;
    this.stopClock();
    return { boom: i, opened: [] };
  }

  /** Cycle hidden → flag → (question) → hidden. */
  toggleMark(i, questions = false) {
    if (this.over || this.open[i]) return null;
    const next = this.mark[i] === HIDDEN ? FLAG : this.mark[i] === FLAG && questions ? QUESTION : HIDDEN;
    this.mark[i] = next;
    if (this.state === 'ready' && this.fixedStart >= 0) {
      this.state = 'playing';
      this.startClock();
    }
    return next;
  }

  canUndo() {
    return this.state === 'lost' && this.undosLeft > 0 && !!this.snapshot;
  }

  /** Take back the losing click, once per game, for a time penalty. */
  undo() {
    if (!this.canUndo()) return false;
    const s = this.snapshot;
    this.open = s.open;
    this.mark = s.mark;
    this.opened = s.opened;
    this.undosLeft--;
    this.penalty += RULES.undoPenalty;
    this.boom = -1;
    this.state = 'playing';
    this.startClock();
    return true;
  }

  /**
   * A cell that logic proves safe, or a fallback safe cell when the position
   * needs a guess. Player flags are ignored: the solver works from the numbers.
   * @returns {{ cell: number, logical: boolean, rule?: string, src?: number[] } | null}
   */
  findSafe() {
    if (this.state !== 'playing') return null;
    const known = new Uint8Array(this.n);
    const s = { w: this.w, h: this.h, counts: this.counts, open: this.open, known, total: this.total };
    for (let guard = 0; guard < this.n; guard++) {
      const d = deduce(s);
      if (!d.rule) break;
      const safe = d.safe.filter((j) => !this.open[j]);
      if (safe.length) {
        safe.sort((a, b) => this.mark[a] - this.mark[b]);
        return { cell: safe[0], logical: true, rule: d.rule, src: d.reason?.src ?? [] };
      }
      let added = 0;
      for (const j of d.mines) if (!known[j]) { known[j] = 1; added++; }
      if (!added) break;
    }
    const pool = [];
    for (let j = 0; j < this.n; j++) if (!this.open[j] && !this.mines[j]) pool.push(j);
    return pool.length ? { cell: pool[Math.floor(Math.random() * pool.length)], logical: false } : null;
  }

  hint() {
    if (this.hintCell !== undefined && !this.open[this.hintCell]) return { cell: this.hintCell, repeat: true, logical: true };
    const found = this.findSafe();
    if (!found) return null;
    this.hintCell = found.cell;
    this.hints++;
    this.penalty += RULES.hintPenalty;
    return found;
  }
}
