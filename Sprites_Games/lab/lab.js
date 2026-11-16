/**
 * Sprite lab hero: the Shadow Dog from lesson 1 runs over the five parallax
 * layers from lesson 2. It is also the Art Lab card's live preview (?embed=1).
 *
 * The canvas is drawn in CSS pixels on a backing store scaled by the device
 * pixel ratio, so it stays sharp on high-DPI screens, and it is rebuilt when
 * the window or the phone's orientation changes.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const embed = window.ArtEmbed || { on: false, dpr: () => window.devicePixelRatio || 1 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Lesson 2's layers are 2400x720 and scroll at 0.2x to 1x the game speed.
  const LAYER_W = 2400;
  const LAYER_H = 720;
  const SPEEDS = [0.2, 0.4, 0.6, 0.8, 1];
  // The ground line in the layer art, as a fraction of its height.
  const GROUND = 0.835;
  // The run row of lesson 1's sheet, cut into its own strip (9 frames).
  const DOG_FRAMES = 9;

  const load = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  let W = 0;
  let H = 0;
  let dpr = 1;

  function fit() {
    const r = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    dpr = Math.min(embed.dpr(1.5), 3);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingQuality = 'high';
  }

  Promise.all([
    ...[1, 2, 3, 4, 5].map((n) => load(`second_project/images/layer-${n}.png`)),
    load('lab/dog-run.webp'),
  ]).then((images) => {
    const layers = images.slice(0, 5);
    const dog = images[5];
    const offsets = [0, 0, 0, 0, 0];
    let last = 0;
    let frame = 0;
    let frameTime = 0;

    fit();

    function draw(t) {
      const dt = last ? Math.min(50, t - last) : 16;
      last = t;
      // The scene scales with the canvas height; the speed is lesson 2's
      // default of 5 px per frame at 60 fps, in layer pixels.
      const s = H / LAYER_H;
      const lw = LAYER_W * s;
      const moving = !reduced.matches;
      ctx.clearRect(0, 0, W, H);
      layers.forEach((img, i) => {
        if (!img) return;
        if (moving) offsets[i] = (offsets[i] + SPEEDS[i] * 5 * (dt / 16.67)) % LAYER_W;
        let x = -offsets[i] * s;
        while (x < W) {
          ctx.drawImage(img, x, 0, lw, H);
          x += lw;
        }
      });
      if (dog) {
        const fw = dog.width / DOG_FRAMES;
        const fh = dog.height;
        const dh = H * 0.34;
        const dw = (dh * fw) / fh;
        if (moving) {
          frameTime += dt;
          if (frameTime > 70) {
            frame = (frame + 1) % DOG_FRAMES;
            frameTime = 0;
          }
        }
        const x = Math.max(8, W * 0.16);
        const y = H * GROUND - dh * 0.97;
        ctx.drawImage(dog, Math.floor(frame) * fw, 0, fw, fh, x, y, dw, dh);
      }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);

    let timer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(fit, 120);
    });
  });
})();
