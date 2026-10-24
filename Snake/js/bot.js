/**
 * A cautious Snake bot. It drives the title-screen demo and the Node verifier
 * that proves every arena can be cleared.
 *
 * Each move: find the shortest path to food (or a golden bonus); take it only if,
 * once there, the head can still reach the tail. Otherwise chase the tail the
 * long way round, or failing that, head for the biggest open area.
 */
import { DIR_NAMES, OPPOSITE, stepCell, stepsPerMove } from './game.js';

function bfs(board, from, blocked, firstDirs) {
  const n = board.w * board.h;
  const dist = new Int32Array(n).fill(-1);
  const parent = new Int32Array(n).fill(-1);
  const first = new Array(n);
  const queue = [from];
  dist[from] = 0;
  for (let q = 0; q < queue.length; q++) {
    const cell = queue[q];
    for (const dir of q === 0 ? firstDirs : DIR_NAMES) {
      const next = stepCell(board, cell, dir);
      if (next.cause || dist[next.cell] >= 0 || blocked[next.cell]) continue;
      dist[next.cell] = dist[cell] + 1;
      parent[next.cell] = cell;
      first[next.cell] = q === 0 ? dir : first[cell];
      queue.push(next.cell);
    }
  }
  return { dist, parent, first };
}

function pathTo(search, from, to) {
  const path = [];
  for (let c = to; c !== from; c = search.parent[c]) path.push(c);
  return path.reverse();
}

function occupancy(n, snake, freeTail) {
  const blocked = new Uint16Array(n);
  for (const c of snake) blocked[c]++;
  if (freeTail) blocked[snake[snake.length - 1]]--;
  return blocked;
}

function legalDirs(s) {
  return DIR_NAMES.filter((d) => !s.dir || d !== OPPOSITE[s.dir]);
}

/** Can the head of a (virtual) snake reach its own tail? */
function tailReachable(board, snake) {
  if (snake.length < 3) return true;
  const n = board.w * board.h;
  const blocked = occupancy(n, snake, true);
  const tail = snake[snake.length - 1];
  blocked[snake[0]] = 0;
  const search = bfs(board, snake[0], blocked, DIR_NAMES);
  return search.dist[tail] > 0 || (search.dist[tail] === 0 && snake.length < 3);
}

/** Walk a path virtually, growing at each item it eats. */
function simulate(s, path) {
  let snake = s.snake.slice();
  let growth = s.growth;
  for (const cell of path) {
    snake.unshift(cell);
    if (cell === s.food) growth += s.cfg.food.grow;
    if (s.golden && cell === s.golden.cell) growth += s.cfg.golden.grow;
    if (growth > 0) growth--;
    else snake.pop();
  }
  // Pending growth keeps the tail in place, so count it as extra length.
  for (let i = 0; i < growth; i++) snake.push(snake[snake.length - 1]);
  return snake;
}

export function botMove(s) {
  const { board } = s;
  const n = board.w * board.h;
  const head = s.snake[0];
  const blocked = occupancy(n, s.snake, s.growth === 0);
  blocked[head] = 0;
  const dirs = legalDirs(s);
  const search = bfs(board, head, blocked, dirs);

  const targets = [s.golden?.cell, s.food].filter((c) => c !== undefined && c >= 0 && search.dist[c] > 0);
  targets.sort((a, b) => search.dist[a] - search.dist[b]);
  for (const target of targets) {
    if (s.golden && target === s.golden.cell && search.dist[target] * stepsPerMove(s) >= s.golden.life) continue;
    const path = pathTo(search, head, target);
    if (tailReachable(board, simulate(s, path))) return search.first[target];
  }

  // No safe meal: pick the move that keeps the tail reachable and stays far from it,
  // which stalls in open space until a safe path opens up.
  let best = null;
  let bestScore = -Infinity;
  for (const dir of dirs) {
    const next = stepCell(board, head, dir);
    if (next.cause) continue;
    if (blocked[next.cell]) continue;
    const virtual = simulate(s, [next.cell]);
    const safe = tailReachable(board, virtual);
    const vBlocked = occupancy(n, virtual, true);
    vBlocked[virtual[0]] = 0;
    const area = bfs(board, virtual[0], vBlocked, DIR_NAMES);
    let reach = 0;
    for (let i = 0; i < n; i++) if (area.dist[i] > 0) reach++;
    const tailDist = area.dist[virtual[virtual.length - 1]];
    const score = (safe ? 10000 : 0) + reach * 4 + (safe ? tailDist : 0) + (dir === s.dir ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best ?? s.dir ?? 'right';
}
