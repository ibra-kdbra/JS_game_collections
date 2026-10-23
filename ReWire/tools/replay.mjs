// Turns a solver route into a pointer path and plays it in the real game.
import { createLevel } from "./sim.mjs";

// Pointer path (stage coordinates) that drags the cable end along the route:
// straight runs on the tangents and arcs around each wrapped node, `margin`
// pixels outside it.
export function routePath(ctx, level, route, { margin = 14, stepPx = 4 } = {}) {
  const { Side, getTangents } = ctx;
  const circles = [...level.spools, ...level.isolators].map(([x, y, r]) => ({ x, y, r: r + margin }));
  const pts = [];
  const push = (p) => pts.push({ x: p.x, y: p.y });
  const line = (a, b) => {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / stepPx));
    for (let i = 1; i <= n; i++) push({ x: a.x + (b.x - a.x) * i / n, y: a.y + (b.y - a.y) * i / n });
  };
  const tangent = (pa, ra, sa, pb, rb, sb) => {
    const t = getTangents(pa, ra, pb, rb);
    const idx = sa == Side.left ? sb == Side.left ? 1 : 3 : sb == Side.left ? 2 : 0;
    return t[idx];
  };
  let cur = { x: level.end[0], y: level.end[1] };
  push(cur);
  let prev = { pos: cur, r: 0, side: Side.left };
  const steps = [...route.map((s) => ({ ...circles[s.node], side: s.side })), { x: level.finish[0], y: level.finish[1], r: 0, side: Side.left }];
  for (let k = 0; k < steps.length; k++) {
    const c = steps[k];
    const t = tangent(prev.pos, prev.r, prev.side, c, c.r, c.side);
    if (!t) throw new Error("no tangent");
    if (k > 0) arc(prev, cur, t[0]);
    else line(cur, t[0]);
    line(t[0], t[1]);
    cur = t[1];
    prev = { pos: c, r: c.r, side: c.side, dir: { x: t[1].x - t[0].x, y: t[1].y - t[0].y } };
  }
  return pts;

  // around circle c from point a to point b, continuing direction c.dir
  function arc(c, a, b) {
    const o = c.pos;
    let t0 = Math.atan2(a.y - o.y, a.x - o.x);
    let t1 = Math.atan2(b.y - o.y, b.x - o.x);
    const ccw = c.dir.x * -Math.sin(t0) + c.dir.y * Math.cos(t0) > 0;
    let d = t1 - t0;
    if (ccw) { while (d < 0) d += 2 * Math.PI; } else { while (d > 0) d -= 2 * Math.PI; }
    const n = Math.max(1, Math.ceil(Math.abs(d) * c.r / stepPx));
    for (let i = 1; i <= n; i++) {
      const t = t0 + d * i / n;
      push({ x: o.x + Math.cos(t) * c.r, y: o.y + Math.sin(t) * c.r });
    }
  }
}

// Drag the cable end along `pts` in the real game, one fixed update per
// `perStep` pointer moves. Returns { completed, steps }.
export function playPath(level, pts, { perStep = 1, pointerType = "mouse", ctx } = {}) {
  const lv = createLevel(level, ctx);
  lv.pointer("move", pts[0].x, pts[0].y, pointerType);
  lv.step();
  lv.pointer("down", pts[0].x, pts[0].y, pointerType);
  lv.step();
  let steps = 2;
  for (let i = 1; i < pts.length && !lv.completed; i++) {
    lv.pointer("move", pts[i].x, pts[i].y, pointerType);
    if (i % perStep === 0 || i === pts.length - 1) { lv.step(); steps++; }
  }
  for (let i = 0; i < 30 && !lv.completed; i++) { lv.step(); steps++; }
  const attachments = lv.attachments.map((a) => a.entity);
  lv.pointer("up", pts[pts.length - 1].x, pts[pts.length - 1].y, pointerType);
  return { completed: lv.completed, steps, attachments, lv };
}
