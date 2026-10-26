/** Short effects drawn over the tank, all from the original sprite strips. */

export function createFx() {
  let list = [];
  const add = (e) => list.push({ t: 0, ...e });

  return {
    clear() {
      list = [];
    },
    shot(x, y, level, miss) {
      add({ kind: 'shot', x, y, row: Math.min(5, Math.floor(level / 2)), dur: 20, miss });
    },
    boom(x, y, small = false) {
      add({ kind: small ? 'explosionsmall' : 'explosion', x, y, dur: 30 });
    },
    portal(x, y) {
      add({ kind: 'portal', x, y, dur: 68 });
    },
    sparkle(x, y) {
      add({ kind: 'sparkle', x, y, dur: 28 });
    },
    chomp(x, y) {
      add({ kind: 'chomp', x, y, dur: 15 });
    },
    bubbles(x, y, n = 3) {
      for (let i = 0; i < n; i++) add({ kind: 'bubble', x: x + (Math.random() - 0.5) * 16, y, dur: 60 + Math.random() * 40, vx: (Math.random() - 0.5) * 0.4, r: Math.floor(Math.random() * 3) });
    },
    text(str, x, y, { font = 'junglefever12outline', dur = 60, color = null, rise = 0.5 } = {}) {
      add({ kind: 'text', str, x, y, dur, font, color, rise });
    },
    step() {
      for (const e of list) {
        e.t++;
        if (e.kind === 'bubble') {
          e.y -= 1;
          e.x += e.vx;
        }
        if (e.kind === 'text') e.y -= e.rise;
      }
      list = list.filter((e) => e.t < e.dur);
    },
    draw(gfx, t) {
      for (const e of list) {
        const k = e.t / e.dur;
        switch (e.kind) {
          case 'shot':
            gfx.frame('lasers', k * 10, e.row, e.x, e.y, { add: true });
            break;
          case 'explosion':
          case 'explosionsmall':
            gfx.frame(e.kind, k * 10, 0, e.x, e.y, { add: true });
            break;
          case 'portal':
            gfx.frame('warphole', k * 17, 0, e.x, e.y);
            gfx.frame('warpglow', k * 17, 0, e.x, e.y, { add: true });
            break;
          case 'sparkle':
            gfx.frame('sparkle', k * 14, 0, e.x, e.y, { add: true, scale: 1.5 });
            break;
          case 'chomp':
            gfx.frame('chomp', k * 5, 0, e.x, e.y, { add: true });
            break;
          case 'bubble':
            gfx.frame('bubbles', e.r, 0, e.x, e.y, { add: true, alpha: Math.min(1, (1 - k) * 3) });
            break;
          case 'text':
            gfx.text(e.font, e.str, e.x, e.y, { align: 'center', color: e.color, alpha: Math.min(1, (1 - k) * 4) });
            break;
        }
      }
    },
  };
}
