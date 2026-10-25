// Input runs: "R40 RJ1 R12 U30" holds the letters for N steps (60 per second).
// R/L walk, U/D climb, J jump (pressed on the step it first appears), _ nothing.

export function parseRun(run) {
  const steps = [];
  for (const tok of run.trim().split(/\s+/)) {
    const m = /^([RLUDJ_]+)(\d+)$/.exec(tok);
    if (!m) throw new Error('bad token ' + tok);
    for (let i = 0; i < +m[2]; i++) steps.push(m[1]);
  }
  return steps;
}

export function compress(steps) {
  const out = [];
  for (const s of steps) {
    const k = s || '_';
    if (out.length && out[out.length - 1][0] === k) out[out.length - 1][1]++;
    else out.push([k, 1]);
  }
  return out.map(([k, n]) => k + n).join(' ');
}

export const inputFor = (s) => ({
  right: s.includes('R'),
  left: s.includes('L'),
  up: s.includes('U'),
  down: s.includes('D'),
  jump: s.includes('J'),
});
