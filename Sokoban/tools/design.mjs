#!/usr/bin/env node
/**
 * Level design helper: give it rooms (walls, goals and a player in XSB; boxes
 * are ignored) and it pulls boxes backwards from the solved position to every
 * reachable start, reporting the starts that need the most pushes.
 *
 *   node Sokoban/tools/design.mjs drafts.xsb [--top 3] [--depth N] [--no-goal-starts]
 *
 * Every state it prints is solvable by construction; its push distance is
 * optimal because the search is a multi-source BFS over pulls.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseCollection, buildBoard } from './verify-levels.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const TOP = opt('--top', 3);
const DEPTH = opt('--depth', -1);
const MAX = opt('--max', 3_000_000);
const noGoalStarts = args.includes('--no-goal-starts');

function regionMin(board, occ, start, seen, stamp) {
  const q = [start];
  seen[start] = stamp;
  let min = start;
  for (let h = 0; h < q.length; h++) {
    const c = q[h];
    if (c < min) min = c;
    for (const s of board.step) {
      const j = c + s;
      if (board.floor[j] && !occ[j] && seen[j] !== stamp) {
        seen[j] = stamp;
        q.push(j);
      }
    }
  }
  return { min, cells: q };
}

export function explore(board, { max = MAX } = {}) {
  const { n, step, floor } = board;
  const occ = new Uint8Array(n);
  const seen = new Int32Array(n);
  let stamp = 0;
  const key = (bx, p) => String.fromCharCode(...bx, p);
  const dist = new Map();
  let frontier = [];
  const goals = board.goals.slice();
  for (const g of goals) occ[g] = 1;
  for (let c = 0; c < n; c++) {
    if (!floor[c] || occ[c] || seen[c] > 0) continue;
    const { min } = regionMin(board, occ, c, seen, ++stamp);
    const k = key(goals, min);
    if (!dist.has(k)) {
      dist.set(k, 0);
      frontier.push({ boxes: goals, player: min });
    }
  }
  for (const g of goals) occ[g] = 0;
  const layers = [frontier];
  let depth = 0;
  while (frontier.length && dist.size < max) {
    depth++;
    const next = [];
    for (const st of frontier) {
      for (const b of st.boxes) occ[b] = 1;
      const s0 = ++stamp;
      regionMin(board, occ, st.player, seen, s0);
      const reachable = seen.slice();
      for (let bi = 0; bi < st.boxes.length; bi++) {
        const b = st.boxes[bi];
        for (const s of step) {
          const p = b + s; // player stands here
          const p2 = p + s; // and steps back to here
          if (reachable[p] !== s0 || !floor[p2] || occ[p2]) continue;
          const nb = st.boxes.slice();
          nb[bi] = p;
          nb.sort((x, y) => x - y);
          occ[b] = 0;
          occ[p] = 1;
          const { min } = regionMin(board, occ, p2, seen, ++stamp);
          occ[p] = 0;
          occ[b] = 1;
          const k = key(nb, min);
          if (dist.has(k)) continue;
          dist.set(k, depth);
          next.push({ boxes: nb, player: p2 });
        }
      }
      for (const b of st.boxes) occ[b] = 0;
    }
    if (next.length) layers.push(next);
    frontier = next;
  }
  return { layers, states: dist.size, capped: dist.size >= max };
}

export function render(board, boxes, player) {
  const rows = [];
  const bs = new Set(boxes);
  for (let y = 0; y < board.h; y++) {
    let r = '';
    for (let x = 0; x < board.w; x++) {
      const i = y * board.w + x;
      if (board.wall[i]) r += '#';
      else if (!board.floor[i]) r += ' ';
      else if (bs.has(i)) r += board.goal[i] ? '*' : '$';
      else if (i === player) r += board.goal[i] ? '+' : '@';
      else r += board.goal[i] ? '.' : ' ';
    }
    rows.push(r.replace(/\s+$/, ''));
  }
  return rows.join('\n');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain && file) {
  const drafts = parseCollection(readFileSync(file, 'utf8'));
  for (const d of drafts) {
    // Boxes in a draft are ignored; the draft only needs walls, goals and a player.
    const rows = d.rows.map((r) => r.replace(/\$/g, ' ').replace(/\*/g, '.'));
    const goalsOnly = rows;
    const boxCount = goalsOnly.join('').split('').filter((c) => c === '.' || c === '+').length;
    // buildBoard wants as many boxes as goals; place them on the goals.
    const board = buildBoard(goalsOnly.map((r) => r.replace(/\./g, '*').replace(/\+/g, '@')));
    for (const g of board.goals) board.goal[g] = 1;
    const { layers, states, capped } = explore(board);
    console.log(`\n=== ${d.meta.title ?? 'draft'}: ${boxCount} boxes, ${states} states${capped ? ' (capped)' : ''}, max ${layers.length - 1} pushes`);
    const want = DEPTH >= 0 ? [Math.min(DEPTH, layers.length - 1)] : [layers.length - 1, layers.length - 2].filter((x) => x > 0);
    for (const depth of want) {
      let picks = layers[depth];
      if (noGoalStarts) picks = picks.filter((s) => s.boxes.every((b) => !board.goal[b]));
      picks = picks.slice().sort((a, b) => a.boxes.filter((x) => board.goal[x]).length - b.boxes.filter((x) => board.goal[x]).length);
      for (const st of picks.slice(0, TOP)) {
        console.log(`-- ${depth} pushes, ${st.boxes.filter((x) => board.goal[x]).length} on goal`);
        console.log(render(board, st.boxes, st.player));
      }
    }
  }
}
