/**
 * Loads the converted game files (see tools/convert.py): images, the 2x
 * enhanced images, bitmap fonts, sound effects and music.
 */

export const assets = { img: {}, font: {}, sfx: {}, music: {}, manifest: null, hd: false };

async function image(url) {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

/**
 * Load everything. `hd` picks the enhanced 2x images; `onProgress(k)` gets 0..1.
 */
export async function loadAll({ hd = true, first = [], onProgress = () => {} } = {}) {
  // assets/data.js (from tools/build.mjs) holds the manifest and fonts, so no
  // fetch is needed and the game runs from disk.
  const pack = globalThis.__ASSETS;
  const m = pack ? pack.manifest : await (await fetch('assets/manifest.json')).json();
  assets.manifest = m;
  assets.hd = hd;
  const jobs = [];
  const names = [...first.filter((n) => m.img[n]), ...Object.keys(m.img).filter((n) => !first.includes(n))];
  for (const name of names) {
    jobs.push(async () => {
      const [w, h] = m.img[name];
      const img = await image(`assets/${hd ? 'img2x' : 'img'}/${name}.webp`);
      // `w`, `h`: the original size; drawing always uses original coordinates.
      assets.img[name] = { img, w, h };
    });
  }
  for (const name of m.font) {
    jobs.push(async () => {
      const def = pack ? structuredClone(pack.fonts[name]) : await (await fetch(`assets/font/${name}.json`)).json();
      for (const L of Object.values(def.layers)) if (L.image) L.img = await image(`assets/font/${L.image}.webp`);
      assets.font[name] = def;
    });
  }
  let done = 0;
  const total = jobs.length;
  // A few at a time keeps the page responsive.
  // The first images load before anything else (the loading screen needs them).
  for (const job of jobs.splice(0, first.length)) {
    await job().catch(() => null);
    onProgress(++done / total);
  }
  const queue = jobs.slice();
  const workers = Array.from({ length: 6 }, async () => {
    while (queue.length) {
      const job = queue.shift();
      try {
        await job();
      } catch (e) {
        console.warn('asset failed', e);
      }
      onProgress(++done / total);
    }
  });
  await Promise.all(workers);
  return assets;
}

/** A sheet of `cols` x `rows` frames. */
export function sheet(name, cols = 1, rows = 1) {
  const a = assets.img[name];
  if (!a) return null;
  return { ...a, cols, rows, fw: a.w / cols, fh: a.h / rows, k: a.img.naturalWidth / a.w };
}
