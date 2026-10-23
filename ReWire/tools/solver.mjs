// Exact ReWire solver over the game's own geometry (calculateTangents,
// lineCircleIntersect, lineLineIntersect from js/).
//
// A finished cable is a chain start -> (node, side) ... -> finish. The chain is
// stable and wins in the real spool system when:
//   - no segment touches a node that is not one of its two ends (it would be
//     wrapped, or flagged as overlapping) and no segment touches a block,
//   - every wrap passes the game's unwrap test (resolveDisconnections),
//   - segments outside an isolator pair do not cross each other,
//   - every spool is wrapped once, outside an isolator pair (isolated spools
//     get no power).
// The search enumerates every such chain, so its counts are exact. Segments,
// unwrap tests and crossings depend only on their end points, so they are
// computed once per pair and cached.

export function solve(ctx, level, { maxSolutions = 5000000, maxNodes = 200000000, keep = 200000 } = {}) {
  const { Side, NodeType, calculateTangents, lineCircleIntersect, lineLineIntersect, subV } = ctx;
  const nodes = [
    ...level.spools.map(([x, y, r]) => ({ pos: { x, y }, spool: { size: r, type: NodeType.spool } })),
    ...level.isolators.map(([x, y, r]) => ({ pos: { x, y }, spool: { size: r, type: NodeType.isolator } })),
  ];
  const blocks = level.blocks.map(([x, y, r]) => ({ pos: { x, y }, r }));
  const start = { pos: { x: level.start[0], y: level.start[1] }, spool: { size: 0, type: NodeType.start } };
  const end = { pos: { x: level.finish[0], y: level.finish[1] }, spool: { size: 0, type: NodeType.end } };
  const numSpools = level.spools.length;
  const n = nodes.length;

  // End points: 0 = start, 1 + 2k (+1) = node k wrapped left (right), E - 1 = finish.
  const E = 2 * n + 2;
  const FIN = E - 1;
  const epEntity = (e) => (e === 0 ? start : e === FIN ? end : nodes[(e - 1) >> 1]);
  const epSide = (e) => (e === 0 || e === FIN ? Side.left : (e - 1) & 1 ? Side.right : Side.left);
  const epNode = (e) => (e === 0 || e === FIN ? -1 : (e - 1) >> 1);

  // segment a -> b: null when the game would not accept it anywhere in a cable
  const segs = new Array(E * E);
  const seg = (a, b) => {
    const k = a * E + b;
    if (segs[k] !== undefined) return segs[k];
    const A = { entity: epEntity(a), side: epSide(a) };
    const B = { entity: epEntity(b), side: epSide(b) };
    calculateTangents([A, B]);
    let s = null;
    if (A.outPos && B.inPos) {
      const p = A.outPos, q = B.inPos;
      let ok = true;
      for (const nd of nodes) if (nd !== A.entity && nd !== B.entity && lineCircleIntersect(p, q, nd.pos, nd.spool.size)) { ok = false; break; }
      if (ok) for (const bl of blocks) if (lineCircleIntersect(p, q, bl.pos, bl.r)) { ok = false; break; }
      if (ok) {
        let clearance = Infinity;
        for (const nd of nodes) if (nd !== A.entity && nd !== B.entity) clearance = Math.min(clearance, Math.sqrt(segPointDist2(p, q, nd.pos)) - nd.spool.size);
        for (const bl of blocks) clearance = Math.min(clearance, Math.sqrt(segPointDist2(p, q, bl.pos)) - bl.r);
        s = { id: k, p, q, clearance, length: Math.hypot(q.x - p.x, q.y - p.y) };
      }
    }
    segs[k] = s;
    return s;
  };

  // unwrap test of resolveDisconnections at the middle point of x -> a -> b
  const turnCache = new Int8Array(E * E * E);
  const turnOk = (x, a, b) => {
    const k = (x * E + a) * E + b;
    if (turnCache[k]) return turnCache[k] > 0;
    const s1 = seg(x, a), s2 = seg(a, b);
    const vAB = subV(s1.p, s1.q);
    const vBC = subV(s2.p, s2.q);
    let angle = Math.atan2(vBC.y, vBC.x) - Math.atan2(vAB.y, vAB.x);
    if (angle < 0) angle += 2 * Math.PI;
    const side = epSide(a);
    const ok = !((side == Side.left && angle > Math.PI * 1.8) || (side == Side.right && angle < Math.PI * 0.2));
    turnCache[k] = ok ? 1 : -1;
    return ok;
  };

  const crossCache = new Map();
  const crosses = (s, t) => {
    const k = s.id < t.id ? s.id * E * E + t.id : t.id * E * E + s.id;
    let v = crossCache.get(k);
    if (v === undefined) { v = lineLineIntersect(s.p, s.q, t.p, t.q); crossCache.set(k, v); }
    return v;
  };

  const used = new Uint8Array(n);
  const chain = [0];
  const chainSegs = [];
  const live = []; // segments outside isolator pairs
  let spoolsDone = 0;
  let parity = false; // isolated flag of the segment leaving the last end point

  const stats = { nodes: 0, solutions: 0, onPath: 0, deadEnds: 0, firstMoves: 0, firstGood: 0, truncated: false };
  const solutions = [];

  const tryLink = (b) => {
    const a = chain[chain.length - 1];
    const s = seg(a, b);
    if (!s) return null;
    if (chain.length > 1 && !turnOk(chain[chain.length - 2], a, b)) return null;
    if (!parity) for (const t of live) if (crosses(s, t)) return null;
    return s;
  };

  const dfs = (depth) => {
    if (stats.nodes >= maxNodes || stats.solutions >= maxSolutions) { stats.truncated = true; return false; }
    let good = false;
    let children = 0;
    if (spoolsDone === numSpools) {
      const s = tryLink(FIN);
      if (s) {
        children++;
        stats.nodes++;
        stats.solutions++;
        good = true;
        if (solutions.length < keep) {
          const all = [...chainSegs, s];
          solutions.push({
            route: chain.slice(1).map((e) => ({ node: epNode(e), side: epSide(e) })),
            clearance: Math.min(...all.map((x) => x.clearance)),
            length: all.reduce((t, x) => t + x.length, 0),
          });
        }
      }
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      const isSpool = nodes[i].spool.type === NodeType.spool;
      if (isSpool && parity) continue; // a spool inside an isolator pair never gets power
      for (let side = 0; side < 2; side++) {
        const b = 1 + 2 * i + side;
        const s = tryLink(b);
        if (!s) continue;
        children++;
        stats.nodes++;
        if (depth === 0) stats.firstMoves++;
        used[i] = 1;
        if (isSpool) spoolsDone++;
        const savedParity = parity;
        if (!parity) live.push(s);
        if (!isSpool) parity = !parity;
        chain.push(b);
        chainSegs.push(s);
        const sub = dfs(depth + 1);
        chain.pop();
        chainSegs.pop();
        parity = savedParity;
        if (!parity) live.pop();
        if (isSpool) spoolsDone--;
        used[i] = 0;
        if (sub) {
          good = true;
          stats.onPath++;
          if (depth === 0) stats.firstGood++;
        }
      }
    }
    if (children === 0) stats.deadEnds++;
    return good;
  };

  dfs(0);
  return { stats, solutions, nodes };
}

function segPointDist2(a, b, c) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  let u = l2 ? ((c.x - a.x) * vx + (c.y - a.y) * vy) / l2 : 0;
  u = Math.max(0, Math.min(1, u));
  const x = a.x + vx * u - c.x, y = a.y + vy * u - c.y;
  return x * x + y * y;
}
