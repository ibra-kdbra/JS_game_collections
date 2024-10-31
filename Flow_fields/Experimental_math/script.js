vec.polute();
microcan.polute();

const ctx = document.getElementById("main").getContext('2d');
const w = window.innerWidth;
const h = window.innerHeight;

const n = 100;
const fieldSize = w / n;

const maxLifetime = 30 * 10;
const pn = 1000;
const particles = Array.from({length: pn}, () => [Math.random() * w, Math.random() * h]);
const lifetimes = particles.map(() => Math.round(Math.random() * maxLifetime));

const clamp = (x, min, max) => Math.min(max, Math.max(x, min));
const vClamp = ([x, y], [min, max]) => [clamp(x, min, max), clamp(y, min, max)];

const vWindowToField = ([x, y]) => {
  const fv = [Math.floor(x / fieldSize), Math.floor(y / fieldSize)];
  return vClamp(fv, [0, n-1]);
};

const vRandom = () => vAngle(Math.random() * Math.PI * 2);

const computeFieldValue = ([x, y]) => {
  const sins = [
    Math.sin(x*0.1 + y*0.1),
    Math.sin(x*0.08 * y*-0.15),
    Math.sin((x & y) * 0.4),
  ];
  const averageSin = sins.reduce((a, b) => a + b, 0) / sins.length;

  return vAngle(((averageSin + 1) / 2) * Math.PI * 2);
}

const field = Array.from({length: n}, (_, y) => Array.from({length: n}, (__, x) => {
  return computeFieldValue([x, y]);
}));

setCanvasSize("main", w, h);
background(ctx, 0, 0, 0, 1, w, h);

const draw = () => {
  // background(ctx, 0, 0, 0, 0.05, w, h);

  noStroke(ctx);
  fill(ctx, 255, 255, 255, 0.05);

  for (let i = 0; i < pn; i++) {
    const p = particles[i];
    const [fx, fy] = vWindowToField(p);
    const fv = field[fy][fx];
    particles[i] = vAdd(p, fv);

    ellipse(ctx, particles[i], 1);

    if (lifetimes[i]-- <= 0) {
      particles[i] = [Math.random() * w, Math.random() * h];
      lifetimes[i] = Math.round(Math.random() * maxLifetime);
    }
  }

  window.requestAnimationFrame(draw);
}

draw();
