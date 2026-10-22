/**
 * Breakout simulation. Pure logic with no DOM, so the same code runs in the
 * browser and in the level-verification bot under Node.
 *
 *   const world = createWorld({ map, speed, rng });
 *   world.step(dt, { targetX, moveDir, launch });
 *   for (const e of world.drainEvents()) ...
 *
 * The ball moves in substeps no longer than CONFIG.ball.maxSubstep (half its
 * radius), so it cannot pass through a brick or the paddle at any speed.
 */
import { CONFIG } from './config.js';
import { parseMap } from './levels.js';

export const POWERUPS = ['wide', 'multi', 'slow', 'laser', 'catch', 'life'];

const DEG = Math.PI / 180;

export function createWorld({ map, speed, rng = Math.random, lives = CONFIG.lives.start, score = 0, cfg = CONFIG }) {
  const G = cfg.grid;
  const F = cfg.field;
  const cells = parseMap(map, G.cols);

  /** @type {(object|null)[][]} */
  const grid = [];
  const bricks = [];
  cells.forEach((row, r) => {
    grid[r] = [];
    row.forEach((cell, c) => {
      if (!cell) {
        grid[r][c] = null;
        return;
      }
      const spec = cfg.bricks[cell.kind];
      const b = {
        r,
        c,
        x: c * G.cellW + G.inset,
        y: G.top + r * G.cellH + G.inset,
        w: G.cellW - G.inset * 2,
        h: G.cellH - G.inset * 2,
        kind: cell.kind,
        hp: spec.hp,
        maxHp: spec.hp,
        color: cell.color ?? r % 7,
        drop: !!cell.drop,
        alive: true,
        flash: 0,
        armed: false,
      };
      grid[r][c] = b;
      bricks.push(b);
    });
  });

  const world = {
    cfg,
    bricks,
    grid,
    rows: cells.length,
    balls: [],
    capsules: [],
    bolts: [],
    events: [],
    pendingBlasts: [],
    paddle: { x: F.w / 2, w: cfg.paddle.w, targetW: cfg.paddle.w, y: cfg.paddle.y, h: cfg.paddle.h, vx: 0 },
    effects: { wide: 0, slow: 0, laser: 0, catch: 0 },
    laserCooldown: 0,
    lives,
    score,
    combo: 0,
    bestCombo: 0,
    livesLost: 0,
    time: 0,
    dropCooldown: 0,
    stall: 0, // seconds since a breakable brick was last hit
    baseSpeed: speed,
    state: 'serve', // serve | play | cleared | dead
    breakable: bricks.filter((b) => b.kind !== 'steel').length,
    totalBreakable: 0,
    nextBallId: 1,
  };
  world.totalBreakable = world.breakable;

  const emit = (type, data = {}) => world.events.push({ type, ...data });

  world.drainEvents = () => {
    const out = world.events;
    world.events = [];
    return out;
  };

  world.multiplier = () => Math.min(cfg.combo.maxMult, 1 + Math.floor(world.combo / cfg.combo.step));

  function newBall(x, y, dx, dy, spd) {
    const ball = { id: world.nextBallId++, x, y, px: x, py: y, dx, dy, speed: spd, stuck: false, stuckOffset: 0, stuckTime: 0, idle: 0, trail: [] };
    world.balls.push(ball);
    return ball;
  }

  function serveBall() {
    const p = world.paddle;
    const ball = newBall(p.x, p.y - cfg.ball.r - 0.5, 0, -1, world.baseSpeed);
    ball.stuck = true;
    ball.stuckOffset = 0;
    world.state = 'serve';
  }
  serveBall();

  function setDirFromAngle(ball, angle) {
    ball.dx = Math.sin(angle);
    ball.dy = -Math.cos(angle);
  }

  function guardAngle(ball) {
    const min = cfg.ball.minVerticalRatio;
    if (Math.abs(ball.dy) < min) {
      const sy = ball.dy === 0 ? (ball.y < F.h / 2 ? 1 : -1) : Math.sign(ball.dy);
      ball.dy = sy * min;
      ball.dx = Math.sign(ball.dx || 1) * Math.sqrt(1 - min * min);
    }
    const len = Math.hypot(ball.dx, ball.dy) || 1;
    ball.dx /= len;
    ball.dy /= len;
  }

  /** Long rallies with nothing but walls and steel get a small random tilt per bounce. */
  function idleNudge(ball) {
    if (ball.idle < cfg.ball.idleNudgeAfter) return;
    const a = (rng() * 2 - 1) * cfg.ball.idleNudgeDeg * DEG;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const dx = ball.dx * cos - ball.dy * sin;
    const dy = ball.dx * sin + ball.dy * cos;
    ball.dx = dx;
    ball.dy = dy;
    // Prefer heading back towards the paddle after a long idle spell.
    if (ball.idle > cfg.ball.idleNudgeAfter * 2 && ball.dy < 0 && rng() < 0.5) ball.dy = -ball.dy;
    guardAngle(ball);
  }

  function launch(ball) {
    if (!ball.stuck) return;
    const p = world.paddle;
    const t = Math.max(-1, Math.min(1, ball.stuckOffset / (p.w / 2)));
    let angle = t * cfg.paddle.maxBounceDeg * DEG;
    if (Math.abs(t) < 0.05) angle = (rng() * 2 - 1) * cfg.ball.launchSpreadDeg * DEG;
    setDirFromAngle(ball, angle);
    ball.stuck = false;
    ball.idle = 0;
    world.state = 'play';
    emit('launch', { x: ball.x, y: ball.y });
  }

  function speedCap() {
    return world.baseSpeed + cfg.ball.maxSpeedOver;
  }

  function scoreBrick(b, destroyed) {
    if (!destroyed) {
      world.score += cfg.bricks.hitScore * world.multiplier();
      return;
    }
    world.combo++;
    world.bestCombo = Math.max(world.bestCombo, world.combo);
    const pts = cfg.bricks[b.kind].score * world.multiplier();
    world.score += pts;
    return pts;
  }

  function maybeDrop(b) {
    const P = cfg.powerups;
    const forced = b.drop;
    if (!forced) {
      if (world.dropCooldown > 0) return;
      if (world.capsules.length >= P.maxFalling) return;
      if (rng() >= P.dropChance) return;
    }
    let total = 0;
    for (const k of POWERUPS) total += P.weights[k];
    let pick = rng() * total;
    let type = POWERUPS[0];
    for (const k of POWERUPS) {
      pick -= P.weights[k];
      if (pick <= 0) {
        type = k;
        break;
      }
    }
    if (type === 'life' && world.lives >= cfg.lives.max) type = 'multi';
    world.capsules.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, type, t: 0 });
    world.dropCooldown = P.minGap;
  }

  function destroyBrick(b, cause) {
    if (!b.alive) return;
    b.alive = false;
    world.grid[b.r][b.c] = null;
    world.breakable--;
    const pts = scoreBrick(b, true);
    emit('break', { x: b.x + b.w / 2, y: b.y + b.h / 2, kind: b.kind, color: b.color, pts, combo: world.combo, cause });
    if (b.kind === 'bomb') {
      world.pendingBlasts.push({ r: b.r, c: b.c, t: cfg.bricks.bomb.chainDelay });
      emit('explode', { x: b.x + b.w / 2, y: b.y + b.h / 2 });
    }
    maybeDrop(b);
    if (world.breakable <= 0 && world.state !== 'cleared') clearLevel();
  }

  function hitBrick(b, cause) {
    if (b.kind === 'steel') {
      b.flash = 1;
      emit('steel', { x: b.x + b.w / 2, y: b.y + b.h / 2 });
      return false;
    }
    b.hp--;
    b.flash = 1;
    world.stall = 0;
    if (b.hp <= 0) {
      destroyBrick(b, cause);
      return true;
    }
    scoreBrick(b, false);
    emit('hit', { x: b.x + b.w / 2, y: b.y + b.h / 2, kind: b.kind, hp: b.hp, combo: world.combo });
    return false;
  }

  function clearLevel() {
    world.state = 'cleared';
    world.capsules.length = 0;
    world.bolts.length = 0;
    emit('cleared');
  }

  function loseBallCheck() {
    if (world.balls.length > 0 || world.state === 'cleared') return;
    world.lives--;
    world.livesLost++;
    world.combo = 0;
    world.capsules.length = 0;
    world.bolts.length = 0;
    world.effects = { wide: 0, slow: 0, laser: 0, catch: 0 };
    world.paddle.targetW = cfg.paddle.w;
    emit('lifeLost', { lives: world.lives });
    if (world.lives <= 0) {
      world.state = 'dead';
      emit('gameOver');
      return;
    }
    serveBall();
  }

  function applyPowerup(type) {
    const P = cfg.powerups;
    const E = world.effects;
    switch (type) {
      case 'wide':
        E.wide = P.duration.wide;
        world.paddle.targetW = cfg.paddle.wideW;
        break;
      case 'slow':
        E.slow = P.duration.slow;
        break;
      case 'laser':
        E.laser = P.duration.laser;
        break;
      case 'catch':
        E.catch = P.duration.catch;
        break;
      case 'life':
        world.lives = Math.min(cfg.lives.max, world.lives + 1);
        break;
      case 'multi': {
        for (const b of world.balls) if (b.stuck) launch(b);
        const sources = world.balls.slice(0, 3);
        for (const src of sources) {
          for (const sign of [-1, 1]) {
            if (world.balls.length >= cfg.ball.maxBalls) break;
            const a = sign * P.multiSpreadDeg * DEG;
            let dx = src.dx * Math.cos(a) - src.dy * Math.sin(a);
            let dy = src.dx * Math.sin(a) + src.dy * Math.cos(a);
            const nb = newBall(src.x, src.y, dx, dy, src.speed);
            guardAngle(nb);
          }
        }
        break;
      }
    }
    emit('powerup', { type, x: world.paddle.x, y: world.paddle.y });
  }

  /* ---------- Collision helpers ---------- */

  function aliveAt(r, c) {
    if (r < 0 || r >= world.rows || c < 0 || c >= G.cols) return false;
    const b = world.grid[r][c];
    return !!(b && b.alive);
  }

  /** Circle vs. rectangle; returns { nx, ny, pen } or null. */
  function circleRect(x, y, rad, rx, ry, rw, rh, px, py) {
    const cx = Math.max(rx, Math.min(x, rx + rw));
    const cy = Math.max(ry, Math.min(y, ry + rh));
    let dx = x - cx;
    let dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > rad * rad) return null;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      return { nx: dx / d, ny: dy / d, pen: rad - d };
    }
    // Centre inside the rectangle: push out along the axis it came in from.
    const left = x - rx;
    const right = rx + rw - x;
    const top = y - ry;
    const bottom = ry + rh - y;
    const fromX = px < rx ? -1 : px > rx + rw ? 1 : 0;
    const fromY = py < ry ? -1 : py > ry + rh ? 1 : 0;
    if (fromY !== 0) return { nx: 0, ny: fromY, pen: rad + (fromY < 0 ? top : bottom) };
    if (fromX !== 0) return { nx: fromX, ny: 0, pen: rad + (fromX < 0 ? left : right) };
    const m = Math.min(left, right, top, bottom);
    if (m === top) return { nx: 0, ny: -1, pen: rad + top };
    if (m === bottom) return { nx: 0, ny: 1, pen: rad + bottom };
    if (m === left) return { nx: -1, ny: 0, pen: rad + left };
    return { nx: 1, ny: 0, pen: rad + right };
  }

  function collideBricks(ball, px, py) {
    const rad = cfg.ball.r;
    const c0 = Math.floor((ball.x - rad) / G.cellW);
    const c1 = Math.floor((ball.x + rad) / G.cellW);
    const r0 = Math.floor((ball.y - rad - G.top) / G.cellH);
    const r1 = Math.floor((ball.y + rad - G.top) / G.cellH);
    let best = null;
    for (let r = Math.max(0, r0); r <= Math.min(world.rows - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(G.cols - 1, c1); c++) {
        const b = world.grid[r][c];
        if (!b || !b.alive) continue;
        const hit = circleRect(ball.x, ball.y, rad, b.x, b.y, b.w, b.h, px, py);
        if (hit && (!best || hit.pen > best.hit.pen)) best = { b, hit };
      }
    }
    if (!best) return false;
    const { b, hit } = best;
    let { nx, ny } = hit;
    // A corner shared with a neighbour is really a flat face: no odd diagonal kicks on seams.
    if (nx !== 0 && ny !== 0) {
      const sx = Math.sign(nx);
      const sy = Math.sign(ny);
      if (aliveAt(b.r, b.c + sx)) {
        nx = 0;
        ny = sy;
      } else if (aliveAt(b.r + sy, b.c)) {
        nx = sx;
        ny = 0;
      }
    }
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    ball.x += nx * hit.pen;
    ball.y += ny * hit.pen;
    const dot = ball.dx * nx + ball.dy * ny;
    if (dot < 0) {
      ball.dx -= 2 * dot * nx;
      ball.dy -= 2 * dot * ny;
    }
    const breakable = b.kind !== 'steel';
    hitBrick(b, 'ball');
    if (breakable) {
      ball.idle = 0;
      ball.speed = Math.min(speedCap(), ball.speed + cfg.ball.speedPerHit);
    } else {
      idleNudge(ball);
    }
    guardAngle(ball);
    return true;
  }

  function collidePaddle(ball, py) {
    const p = world.paddle;
    const rad = cfg.ball.r;
    if (ball.dy <= 0) return false;
    const left = p.x - p.w / 2;
    if (ball.x + rad < left || ball.x - rad > left + p.w) return false;
    if (ball.y + rad < p.y || ball.y - rad > p.y + p.h) return false;
    // Only the top face bounces; a ball already below it is lost.
    if (py + rad > p.y + p.h * 0.6) return false;
    const t = Math.max(-1, Math.min(1, (ball.x - p.x) / (p.w / 2)));
    ball.y = p.y - rad;
    world.combo = 0;
    ball.idle = 0;
    if (world.effects.catch > 0) {
      ball.stuck = true;
      ball.stuckOffset = ball.x - p.x;
      ball.stuckTime = 0;
      emit('catch', { x: ball.x, y: ball.y });
      return true;
    }
    setDirFromAngle(ball, t * cfg.paddle.maxBounceDeg * DEG);
    guardAngle(ball);
    emit('paddle', { x: ball.x, y: ball.y, t });
    return true;
  }

  function moveBall(ball, dt) {
    const rad = cfg.ball.r;
    const p = world.paddle;
    ball.px = ball.x;
    ball.py = ball.y;
    if (ball.stuck) {
      ball.stuckTime += dt;
      const half = p.w / 2 - rad;
      ball.stuckOffset = Math.max(-half, Math.min(half, ball.stuckOffset));
      ball.x = p.x + ball.stuckOffset;
      ball.y = p.y - rad - 0.5;
      if (world.state === 'play' && ball.stuckTime > cfg.ball.catchHoldMax) launch(ball);
      return;
    }
    ball.idle += dt;
    guardAngle(ball);
    const spd = ball.speed * (world.effects.slow > 0 ? cfg.powerups.slowFactor : 1);
    const dist = spd * dt;
    const n = Math.max(1, Math.ceil(dist / cfg.ball.maxSubstep));
    const s = dist / n;
    for (let i = 0; i < n; i++) {
      const ox = ball.x;
      const oy = ball.y;
      ball.x += ball.dx * s;
      ball.y += ball.dy * s;
      let wall = false;
      if (ball.x - rad < 0) {
        ball.x = rad;
        ball.dx = Math.abs(ball.dx);
        wall = true;
      } else if (ball.x + rad > F.w) {
        ball.x = F.w - rad;
        ball.dx = -Math.abs(ball.dx);
        wall = true;
      }
      if (ball.y - rad < 0) {
        ball.y = rad;
        ball.dy = Math.abs(ball.dy);
        wall = true;
      }
      if (wall) {
        idleNudge(ball);
        guardAngle(ball);
        emit('wall', { x: ball.x, y: ball.y });
      }
      collideBricks(ball, ox, oy);
      if (collidePaddle(ball, oy)) {
        if (ball.stuck) return;
      }
      if (world.state === 'cleared') return;
    }
  }

  function stepLasers(dt) {
    const L = cfg.laser;
    const p = world.paddle;
    if (world.effects.laser > 0 && world.state === 'play') {
      world.laserCooldown -= dt;
      if (world.laserCooldown <= 0) {
        world.laserCooldown = L.interval;
        world.bolts.push({ x: p.x - p.w / 2 + 6, y: p.y }, { x: p.x + p.w / 2 - 6, y: p.y });
        emit('laser', { x: p.x, y: p.y });
      }
    }
    const dist = L.speed * dt;
    for (const bolt of world.bolts) {
      const steps = Math.ceil(dist / 6);
      for (let i = 0; i < steps && !bolt.dead; i++) {
        bolt.y -= dist / steps;
        if (bolt.y < 0) {
          bolt.dead = true;
          break;
        }
        const c = Math.floor(bolt.x / G.cellW);
        const r = Math.floor((bolt.y - G.top) / G.cellH);
        if (r < 0 || r >= world.rows || c < 0 || c >= G.cols) continue;
        const b = world.grid[r][c];
        if (b && b.alive && bolt.x >= b.x && bolt.x <= b.x + b.w && bolt.y <= b.y + b.h) {
          hitBrick(b, 'laser');
          bolt.dead = true;
        }
      }
    }
    world.bolts = world.bolts.filter((b) => !b.dead);
  }

  function stepBlasts(dt) {
    if (!world.pendingBlasts.length) return;
    const ready = [];
    for (const blast of world.pendingBlasts) {
      blast.t -= dt;
      if (blast.t <= 0) ready.push(blast);
    }
    world.pendingBlasts = world.pendingBlasts.filter((b) => b.t > 0);
    const R = cfg.bricks.bomb.radius;
    for (const blast of ready) {
      for (let dr = -R; dr <= R; dr++) {
        for (let dc = -R; dc <= R; dc++) {
          const r = blast.r + dr;
          const c = blast.c + dc;
          if (!aliveAt(r, c)) continue;
          const b = world.grid[r][c];
          if (b.kind === 'steel') continue;
          destroyBrick(b, 'blast');
        }
      }
    }
  }

  function stepPaddle(dt, input) {
    const p = world.paddle;
    const P = cfg.paddle;
    // Width eases towards its target, staying on screen.
    if (p.w !== p.targetW) {
      const dw = P.resizeRate * dt;
      p.w = p.w < p.targetW ? Math.min(p.targetW, p.w + dw) : Math.max(p.targetW, p.w - dw);
    }
    const before = p.x;
    if (input.targetX != null) {
      const max = P.followSpeed * dt;
      const d = input.targetX - p.x;
      p.x += Math.max(-max, Math.min(max, d));
      p.kvx = 0;
    } else {
      const dir = input.moveDir || 0;
      p.kvx = p.kvx || 0;
      if (dir !== 0) {
        if (Math.sign(p.kvx) !== dir) p.kvx = 0;
        p.kvx += dir * P.keyAccel * dt;
        p.kvx = Math.max(-P.keySpeed, Math.min(P.keySpeed, p.kvx));
      } else {
        p.kvx = 0;
      }
      p.x += p.kvx * dt;
    }
    p.x = Math.max(p.w / 2, Math.min(F.w - p.w / 2, p.x));
    p.vx = (p.x - before) / dt;
  }

  function stepCapsules(dt) {
    const P = cfg.powerups;
    const p = world.paddle;
    for (const cap of world.capsules) {
      cap.y += P.fallSpeed * dt;
      cap.t += dt;
      const hitX = Math.abs(cap.x - p.x) <= p.w / 2 + P.w / 2;
      const hitY = cap.y + P.h / 2 >= p.y && cap.y - P.h / 2 <= p.y + p.h;
      if (hitX && hitY) {
        cap.dead = true;
        applyPowerup(cap.type);
      } else if (cap.y - P.h / 2 > F.h) {
        cap.dead = true;
      }
    }
    world.capsules = world.capsules.filter((c) => !c.dead);
  }

  /** A field that has stalled gets a supply drop, so the last bricks never become a grind. */
  function stepStall(dt) {
    const P = cfg.powerups;
    if (world.state !== 'play') return;
    world.stall += dt;
    if (world.stall < P.stallDrop || world.capsules.length) return;
    world.stall = P.stallDrop * 0.4;
    world.capsules.push({ x: 60 + rng() * (F.w - 120), y: 8, type: 'multi', t: 0, supply: true });
    emit('supply');
  }

  function stepEffects(dt) {
    const E = world.effects;
    for (const k of Object.keys(E)) {
      if (E[k] > 0) {
        E[k] = Math.max(0, E[k] - dt);
        if (E[k] === 0) {
          if (k === 'wide') world.paddle.targetW = cfg.paddle.w;
          if (k === 'catch') for (const b of world.balls) if (b.stuck && world.state === 'play') launch(b);
          emit('expire', { type: k });
        }
      }
    }
    for (const b of world.bricks) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 5);
  }

  world.step = (dt, input = {}) => {
    if (world.state === 'dead') return;
    world.time += dt;
    world.dropCooldown = Math.max(0, world.dropCooldown - dt);
    stepPaddle(dt, input);
    if (world.state === 'cleared') {
      stepEffects(dt);
      return;
    }
    if (input.launch) for (const b of world.balls) if (b.stuck) launch(b);
    stepEffects(dt);
    for (const ball of world.balls) {
      moveBall(ball, dt);
      ball.trail.push(ball.x, ball.y);
      if (ball.trail.length > cfg.ball.trail * 2) ball.trail.splice(0, 2);
      if (ball.y - cfg.ball.r > F.h) ball.dead = true;
    }
    world.balls = world.balls.filter((b) => !b.dead);
    if (world.state === 'cleared') return;
    stepBlasts(dt);
    stepLasers(dt);
    stepCapsules(dt);
    stepStall(dt);
    loseBallCheck();
  };

  return world;
}
