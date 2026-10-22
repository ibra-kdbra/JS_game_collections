/**
 * A paddle autopilot used to prove levels are beatable (tools/verify-levels.mjs)
 * and to drive the demo behind the title screen.
 *
 * It predicts where the most urgent ball will cross the paddle line, then
 * offsets the paddle so the bounce heads for a chosen brick, directly or
 * banked off a side wall when steel is in the way.
 *
 *   'perfect' moves at pointer speed with exact aim.
 *   'casual'  moves slower than the keyboard cap, only reacts once a ball has
 *             been falling for a moment, misjudges wall bounces and aims
 *             loosely. It stands in for a first-time player to rate difficulty.
 */
import { CONFIG } from './config.js';

const SKILL = {
  perfect: { speed: CONFIG.paddle.followSpeed, landNoise: 0, bounceNoise: 0, aimNoise: 0.06, rethink: 0.05, react: 0 },
  casual: { speed: CONFIG.paddle.keySpeed * 0.7, landNoise: 6, bounceNoise: 14, aimNoise: 0.4, rethink: 0.15, react: 0.3 },
};

export function createBot(world, rng, skill = 'perfect') {
  const S = SKILL[skill];
  const cfg = world.cfg;
  const G = cfg.grid;
  const W = cfg.field.w;
  const rad = cfg.ball.r;
  const maxA = (cfg.paddle.maxBounceDeg * Math.PI) / 180;
  let target = null;
  let aimX = null;
  let plan = null;
  let think = 0;
  let stuckFor = 0;
  let lastPaddleHits = -1;
  let paddleHits = 0;
  const falling = new Map(); // ball id -> seconds spent descending
  const noise = new Map(); // ball id -> landing misjudgement for this descent

  const gauss = () => (rng() + rng() + rng() - 1.5) * 1.15;

  function landing(ball) {
    const yLine = world.paddle.y - rad;
    if (ball.dy <= 0) return null;
    const t = (yLine - ball.y) / ball.dy;
    if (t < 0) return null;
    const raw = ball.x + ball.dx * t;
    const span = W - 2 * rad;
    let u = (raw - rad) % (2 * span);
    if (u < 0) u += 2 * span;
    const bounces = Math.floor(Math.abs(raw - rad) / span);
    const x = rad + (u > span ? 2 * span - u : u);
    const speed = ball.speed * (world.effects.slow > 0 ? cfg.powerups.slowFactor : 1);
    return { x, time: t / speed, bounces };
  }

  /** True when the straight segment only meets air (or the target itself). */
  function clear(x0, y0, x1, y1, goal) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.ceil(len / 5);
    for (let i = 1; i < n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const y = y0 + ((y1 - y0) * i) / n;
      for (const [ox, oy] of [[-rad, 0], [rad, 0], [0, -rad]]) {
        const c = Math.floor((x + ox) / G.cellW);
        const r = Math.floor((y + oy - G.top) / G.cellH);
        if (r < 0 || r >= world.rows || c < 0 || c >= G.cols) continue;
        const b = world.grid[r][c];
        if (b && b.alive && b !== goal) return false;
      }
    }
    return true;
  }

  /** Where to aim (possibly a mirrored point for a wall bank) to reach brick b from x0. */
  function routeTo(b, x0) {
    const y0 = world.paddle.y - rad;
    const tx = b.x + b.w / 2;
    const ty = b.y + b.h / 2;
    const options = [];
    if (clear(x0, y0, tx, ty, b)) options.push(tx);
    for (const wall of [rad, W - rad]) {
      const mx = 2 * wall - tx; // target mirrored in the wall
      const k = (wall - x0) / (mx - x0);
      if (!(k > 0 && k < 1)) continue;
      const wy = y0 + (ty - y0) * k;
      if (clear(x0, y0, wall, wy, b) && clear(wall, wy, tx, ty, b)) options.push(mx);
    }
    const ok = options.filter((ax) => Math.abs(Math.atan2(ax - x0, y0 - ty)) < maxA * 0.85);
    return ok.length ? ok[Math.floor(rng() * ok.length)] : null;
  }

  function pickTarget(x0) {
    const alive = world.bricks.filter((b) => b.alive && b.kind !== 'steel');
    if (!alive.length) return { brick: null, aim: null };
    alive.sort((a, b) => b.y - a.y);
    for (let tries = 0; tries < 12; tries++) {
      const pool = tries < 6 ? alive.slice(0, Math.max(3, Math.ceil(alive.length * 0.4))) : alive;
      const brick = pool[Math.floor(rng() * pool.length)];
      const aim = routeTo(brick, x0);
      if (aim != null) return { brick, aim };
    }
    const brick = alive[Math.floor(rng() * alive.length)];
    return { brick, aim: brick.x + brick.w / 2 };
  }

  function observe(events) {
    for (const e of events) if (e.type === 'paddle' || e.type === 'catch') paddleHits++;
  }

  function input(dt) {
    const p = world.paddle;
    const out = { targetX: null, moveDir: 0, launch: false };
    if (world.balls.some((b) => b.stuck)) {
      stuckFor += dt;
      if (stuckFor > 0.25) {
        out.launch = true;
        stuckFor = 0;
      }
    } else stuckFor = 0;

    for (const b of world.balls) {
      if (b.dy > 0 && !b.stuck) falling.set(b.id, (falling.get(b.id) ?? 0) + dt);
      else {
        falling.set(b.id, 0);
        noise.delete(b.id);
      }
    }

    think -= dt;
    if (think <= 0) {
      think = S.rethink;
      let best = null;
      for (const b of world.balls) {
        if (b.stuck || (falling.get(b.id) ?? 0) < S.react) continue;
        const l = landing(b);
        if (l && (!best || l.time < best.time)) best = { ...l, ball: b };
      }
      if (best) {
        if (!noise.has(best.ball.id)) noise.set(best.ball.id, gauss());
        const err = noise.get(best.ball.id) * (S.landNoise + S.bounceNoise * best.bounces);
        const landX = best.x + err;
        if (paddleHits !== lastPaddleHits || !target || !target.alive) {
          const pick = pickTarget(best.x);
          target = pick.brick;
          aimX = pick.aim;
          lastPaddleHits = paddleHits;
        }
        let offset = 0;
        if (target && aimX != null) {
          const ty = target.y + target.h / 2;
          offset = Math.max(-0.85, Math.min(0.85, Math.atan2(aimX - best.x, p.y - ty) / maxA));
        }
        offset += gauss() * S.aimNoise * 0.5;
        offset = Math.max(-0.9, Math.min(0.9, offset));
        plan = landX - offset * (p.w / 2);
      } else if (!world.balls.some((b) => b.dy > 0 && !b.stuck)) {
        const cap = world.capsules[0];
        if (cap) plan = cap.x;
      }
    }
    if (plan != null) {
      const max = S.speed * dt;
      const d = plan - p.x;
      out.targetX = p.x + Math.max(-max, Math.min(max, d));
    }
    return out;
  }

  return { input, observe };
}
