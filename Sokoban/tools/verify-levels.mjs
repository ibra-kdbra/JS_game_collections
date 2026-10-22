#!/usr/bin/env node
/**
 * Crate Lab level verifier.
 *
 *   node Sokoban/tools/verify-levels.mjs            verify every level
 *   node Sokoban/tools/verify-levels.mjs --solutions print a LURD solution per level
 *   node Sokoban/tools/verify-levels.mjs --json      machine-readable solutions
 *   node Sokoban/tools/verify-levels.mjs --cross     re-solve small levels with pruning off
 *
 * The solver is a breadth-first search over box positions, where each edge is
 * one push and the player position is reduced to "the area the player can
 * reach". BFS by pushes gives the optimal push count, which must equal the
 * level's Par. Two prunings keep the search small and are both sound:
 *   - dead squares: cells from which a lone box can never be pushed to a goal;
 *   - freeze deadlocks: a box off-goal that can move along neither axis.
 *
 * Exits with code 1 when any level is unsolvable, has a wrong par or is malformed.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const LEVEL_FILE = join(HERE, '..', 'levels', 'crate-lab.xsb');

/* ---------------------------------------------------------------- parsing */

/** Split an XSB collection into { rows, meta } records. Metadata follows the map as `Key: value`. */
export function parseCollection(text) {
  const levels = [];
  let rows = [];
  let meta = {};
  const flush = () => {
    if (rows.length) levels.push({ rows, meta });
    rows = [];
    meta = {};
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*[#@+$*.\-_ ]*#[#@+$*.\-_ ]*$/.test(line) && line.trim()) {
      if (Object.keys(meta).length) flush();
      rows.push(line);
    } else if (/^[A-Za-z]+:/.test(line)) {
      const i = line.indexOf(':');
      meta[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim();
    } else if (!line.trim() || line.startsWith(';')) {
      if (!line.trim() && Object.keys(meta).length) flush();
    }
  }
  flush();
  return levels;
}

export const DIRS = [
  { key: 'u', dx: 0, dy: -1 },
  { key: 'd', dx: 0, dy: 1 },
  { key: 'l', dx: -1, dy: 0 },
  { key: 'r', dx: 1, dy: 0 },
];

/** Build a board from XSB rows. Cells outside the walls become void. */
export function buildBoard(rows) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const n = w * h;
  const wall = new Uint8Array(n);
  const goal = new Uint8Array(n);
  const boxes = [];
  let player = -1;
  let players = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rows[y][x] ?? ' ';
      const i = y * w + x;
      if (c === '#') wall[i] = 1;
      if (c === '.' || c === '*' || c === '+') goal[i] = 1;
      if (c === '$' || c === '*') boxes.push(i);
      if (c === '@' || c === '+') {
        player = i;
        players++;
      }
    }
  }
  if (players !== 1) throw new Error(`expected exactly one player, found ${players}`);
  // Flood from the player through non-wall cells: that is the playable floor.
  const floor = new Uint8Array(n);
  const stack = [player];
  floor[player] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    for (const d of DIRS) {
      const nx = x + d.dx;
      const ny = y + d.dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) throw new Error('floor leaks outside the map (missing wall)');
      const j = ny * w + nx;
      if (!wall[j] && !floor[j]) {
        floor[j] = 1;
        stack.push(j);
      }
    }
  }
  for (const b of boxes) if (!floor[b]) throw new Error('box outside the playable area');
  for (let i = 0; i < n; i++) if (goal[i] && !floor[i]) throw new Error('goal outside the playable area');
  const goals = [];
  for (let i = 0; i < n; i++) if (goal[i]) goals.push(i);
  if (goals.length !== boxes.length) throw new Error(`${boxes.length} boxes but ${goals.length} goals`);
  if (!boxes.length) throw new Error('no boxes');
  const step = DIRS.map((d) => d.dy * w + d.dx);
  return { w, h, n, wall, floor, goal, goals, boxes: boxes.sort((a, b) => a - b), player, step };
}

/** Cells from which a single box can still reach some goal (reverse pulls from every goal). */
export function liveSquares(board) {
  const { n, floor, goals, step } = board;
  const live = new Uint8Array(n);
  const stack = [...goals];
  for (const g of goals) live[g] = 1;
  while (stack.length) {
    const c = stack.pop();
    for (const s of step) {
      const from = c - s; // box pulled from c to c - s, player stands at c - 2s
      const playerAt = c - 2 * s;
      if (floor[from] && floor[playerAt] && !live[from]) {
        live[from] = 1;
        stack.push(from);
      }
    }
  }
  return live;
}

/* ----------------------------------------------------------------- search */

const keyOf = (boxes, player) => String.fromCharCode(...boxes, player);

function makeScratch(n) {
  return { occ: new Uint8Array(n), seen: new Int32Array(n), stamp: 0, queue: new Int32Array(n) };
}

/** Flood the player's reachable area; returns the smallest reachable index (the normalized position). */
function reach(board, sc, start) {
  const { floor, step } = board;
  const { occ, seen, queue } = sc;
  const stamp = ++sc.stamp;
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  seen[start] = stamp;
  let min = start;
  while (head < tail) {
    const c = queue[head++];
    if (c < min) min = c;
    for (let k = 0; k < 4; k++) {
      const j = c + step[k];
      if (floor[j] && !occ[j] && seen[j] !== stamp) {
        seen[j] = stamp;
        queue[tail++] = j;
      }
    }
  }
  return min;
}

/** Is the box at c frozen (immovable on both axes)? Boxes in `held` count as walls. */
function frozen(board, live, occ, c, held) {
  held.add(c);
  const result = blocked(board, live, occ, c, 0, held) && blocked(board, live, occ, c, 2, held);
  held.delete(c);
  return result;
}

function blocked(board, live, occ, c, axis, held) {
  const { floor, step } = board;
  const a = c + step[axis];
  const b = c + step[axis + 1];
  if (!floor[a] || !floor[b]) return true;
  if (!live[a] && !live[b]) return true;
  if (held.has(a) || held.has(b)) return true;
  if (occ[a] && frozen(board, live, occ, a, held)) return true;
  if (occ[b] && frozen(board, live, occ, b, held)) return true;
  return false;
}

/**
 * Breadth-first search over pushes. Returns { pushes, states, path } where path
 * is a list of { box, dir } pushes, or { pushes: -1 } when unsolvable.
 */
export function solve(board, { prune = true, maxStates = 4_000_000 } = {}) {
  const { n, goal, step } = board;
  const live = prune ? liveSquares(board) : new Uint8Array(n).fill(1);
  const sc = makeScratch(n);
  const child = { ...makeScratch(n), occ: sc.occ }; // separate seen marks, shared occupancy
  const allOnGoal = (bx) => bx.every((b) => goal[b]);

  for (const b of board.boxes) if (!live[b]) return { pushes: -1, states: 0, reason: 'box starts on a dead square' };
  for (const b of board.boxes) sc.occ[b] = 1;
  const startNorm = reach(board, sc, board.player);
  for (const b of board.boxes) sc.occ[b] = 0;
  const startKey = keyOf(board.boxes, startNorm);
  if (allOnGoal(board.boxes)) return { pushes: 0, states: 1, path: [] };

  const parent = new Map([[startKey, null]]);
  let frontier = [{ boxes: board.boxes, player: board.player, key: startKey }];
  let depth = 0;
  const held = new Set();
  while (frontier.length) {
    depth++;
    const next = [];
    for (const state of frontier) {
      const { boxes } = state;
      for (const b of boxes) sc.occ[b] = 1;
      reach(board, sc, state.player);
      const stamp = sc.stamp;
      for (let bi = 0; bi < boxes.length; bi++) {
        const b = boxes[bi];
        for (let k = 0; k < 4; k++) {
          const s = step[k];
          const from = b - s;
          const to = b + s;
          if (sc.seen[from] !== stamp || !board.floor[to] || sc.occ[to] || !live[to]) continue;
          // Apply the push.
          sc.occ[b] = 0;
          sc.occ[to] = 1;
          let ok = true;
          if (prune && !goal[to] && frozen(board, live, sc.occ, to, held)) ok = false;
          let nb = null;
          let key = '';
          if (ok) {
            nb = boxes.slice();
            nb[bi] = to;
            nb.sort((x, y) => x - y);
            // Player now stands on b; normalize its area.
            const norm = reach(board, child, b);
            key = keyOf(nb, norm);
            if (parent.has(key)) ok = false;
          }
          sc.occ[to] = 0;
          sc.occ[b] = 1;
          if (!ok) continue;
          parent.set(key, { prev: state.key, box: b, dir: k });
          if (allOnGoal(nb)) {
            for (const x of boxes) sc.occ[x] = 0;
            return { pushes: depth, states: parent.size, path: tracePath(parent, key) };
          }
          next.push({ boxes: nb, player: b, key });
          if (parent.size > maxStates) {
            for (const x of boxes) sc.occ[x] = 0;
            return { pushes: -1, states: parent.size, reason: 'state limit reached' };
          }
        }
      }
      for (const b of boxes) sc.occ[b] = 0;
    }
    frontier = next;
  }
  return { pushes: -1, states: parent.size, reason: 'no solution' };
}

function tracePath(parent, key) {
  const path = [];
  let k = key;
  while (parent.get(k)) {
    const p = parent.get(k);
    path.push({ box: p.box, dir: p.dir });
    k = p.prev;
  }
  return path.reverse();
}

/** Turn a push path into a LURD string (lowercase walk, uppercase push). */
export function toLurd(board, path) {
  const { n, floor, step } = board;
  const occ = new Uint8Array(n);
  let boxes = board.boxes.slice();
  for (const b of boxes) occ[b] = 1;
  let player = board.player;
  let out = '';
  for (const { box, dir } of path) {
    const target = box - step[dir];
    out += walk(board, occ, player, target);
    out += DIRS[dir].key.toUpperCase();
    occ[box] = 0;
    occ[box + step[dir]] = 1;
    player = box;
  }
  return out;

  function walk(bd, o, from, to) {
    if (from === to) return '';
    const prev = new Int32Array(n).fill(-1);
    const q = [from];
    prev[from] = from;
    while (q.length) {
      const c = q.shift();
      if (c === to) break;
      for (let k = 0; k < 4; k++) {
        const j = c + step[k];
        if (floor[j] && !o[j] && prev[j] < 0) {
          prev[j] = c * 4 + k;
          q.push(j);
        }
      }
    }
    let s = '';
    let c = to;
    while (c !== from) {
      const k = prev[c] & 3;
      s = DIRS[k].key + s;
      c = prev[c] >> 2;
    }
    return s;
  }
}

/** Play a LURD string on the board; returns { solved, pushes, moves } or throws on an illegal move. */
export function replay(board, lurd) {
  const occ = new Uint8Array(board.n);
  for (const b of board.boxes) occ[b] = 1;
  let p = board.player;
  let pushes = 0;
  for (const ch of lurd) {
    const k = DIRS.findIndex((d) => d.key === ch.toLowerCase());
    if (k < 0) throw new Error(`bad move ${ch}`);
    const s = board.step[k];
    const t = p + s;
    if (!board.floor[t]) throw new Error(`walked into a wall at move ${pushes}`);
    if (occ[t]) {
      if (!board.floor[t + s] || occ[t + s]) throw new Error('blocked push');
      if (ch !== ch.toUpperCase()) throw new Error('push written in lowercase');
      occ[t] = 0;
      occ[t + s] = 1;
      pushes++;
    } else if (ch === ch.toUpperCase()) throw new Error('uppercase move without a push');
    p = t;
  }
  const solved = board.goals.every((g) => occ[g]);
  return { solved, pushes, moves: lurd.length };
}

/* ------------------------------------------------------------------- main */

function main() {
  const args = new Set(process.argv.slice(2));
  const argv = process.argv.slice(2);
  const fileArg = argv.indexOf('--file');
  const text = readFileSync(fileArg >= 0 ? argv[fileArg + 1] : LEVEL_FILE, 'utf8');
  const draft = fileArg >= 0;
  const levels = parseCollection(text);
  const failures = [];
  const json = [];
  const seenMaps = new Set();
  let world = 0;
  const t0 = Date.now();
  if (!args.has('--json')) console.log(`Verifying ${levels.length} levels in ${LEVEL_FILE.split('/').slice(-3).join('/')}\n`);
  levels.forEach((lvl, i) => {
    const num = String(i + 1).padStart(2, '0');
    const name = lvl.meta.title ?? '(untitled)';
    const label = `${num} ${name}`.padEnd(26);
    const fail = (msg) => {
      failures.push(`${num} ${name}: ${msg}`);
      if (!args.has('--json')) console.log(`  FAIL ${label} ${msg}`);
    };
    if (Number(lvl.meta.world) !== world) {
      world = Number(lvl.meta.world);
      if (!args.has('--json')) console.log(`World ${world}`);
    }
    if (!lvl.meta.title) return fail('missing Title');
    if (!lvl.meta.world) return fail('missing World');
    if (!/^\d+$/.test(lvl.meta.par ?? '')) return fail('missing or invalid Par');
    const mapKey = lvl.rows.join('\n');
    if (seenMaps.has(mapKey)) return fail('duplicate map');
    seenMaps.add(mapKey);
    let board;
    try {
      board = buildBoard(lvl.rows);
    } catch (e) {
      return fail(e.message);
    }
    const t = Date.now();
    const res = solve(board);
    const ms = Date.now() - t;
    const par = Number(lvl.meta.par);
    if (res.pushes < 0) return fail(`unsolvable (${res.reason}, ${res.states} states)`);
    if (res.pushes !== par) {
      if (draft) console.log(`       ${toLurd(board, res.path)}  (${res.states} states, ${ms} ms)`);
      return fail(`par ${par} but optimal is ${res.pushes} pushes`);
    }
    if (args.has('--cross') && res.states < 300_000) {
      const plain = solve(board, { prune: false, maxStates: 3_000_000 });
      if (plain.pushes >= 0 && plain.pushes !== res.pushes) return fail(`pruned ${res.pushes} vs unpruned ${plain.pushes}`);
    }
    const lurd = toLurd(board, res.path);
    try {
      const check = replay(board, lurd);
      if (!check.solved || check.pushes !== par) return fail('solution replay did not solve the level');
    } catch (e) {
      return fail(`solution replay failed: ${e.message}`);
    }
    json.push({ index: i, title: name, par, lurd });
    if (!args.has('--json')) {
      console.log(`  ok   ${label} par ${String(par).padStart(3)}  ${board.boxes.length} boxes  ${String(res.states).padStart(8)} states  ${ms} ms`);
      if (args.has('--solutions')) console.log(`       ${lurd}`);
    }
  });
  if (args.has('--json')) {
    console.log(JSON.stringify(json));
  } else {
    console.log(`\n${levels.length - failures.length}/${levels.length} levels verified in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (levels.length < 40 && !draft) failures.push(`only ${levels.length} levels (need 40)`);
  if (failures.length) {
    console.error(`\nFAILED:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
