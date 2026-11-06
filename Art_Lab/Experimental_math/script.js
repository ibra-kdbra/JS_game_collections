vec.polute();
microcan.polute();

const canvas = document.getElementById("main");
const ctx = canvas.getContext('2d');
let w = window.innerWidth;
let h = window.innerHeight;

// Device pixels per CSS pixel: the backing store is w*dpr by h*dpr and all
// drawing is scaled, so the dots stay sharp on high-DPI screens.
const pixelRatio = () => (window.ArtEmbed ? window.ArtEmbed.dpr(1.5) : window.devicePixelRatio || 1);
let dpr = pixelRatio();

const n = 100;
// The n x n field covers the longer side, so an upright phone gets the whole
// pattern instead of the last row repeated down the bottom of the screen.
let fieldSize = Math.max(w, h) / n;

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

const fitCanvas = () => {
  dpr = pixelRatio();
  setCanvasSize("main", Math.round(w * dpr), Math.round(h * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  background(ctx, 0, 0, 0, 1, w, h);
};
fitCanvas();

// Rotating a phone or resizing the window: match the new size (once it
// settles) instead of stretching the old drawing, and spread the particles
// over the new area.
let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    if (nw === w && nh === h && pixelRatio() === dpr) return;
    for (let i = 0; i < pn; i++) particles[i] = [particles[i][0] * nw / w, particles[i][1] * nh / h];
    w = nw;
    h = nh;
    fieldSize = Math.max(w, h) / n;
    fitCanvas();
  }, 150);
});

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
