/**
 * Sprite art from two free packs (see sprites/LICENSE.txt):
 * Andrew Tidey's "Fish Pack" (CC0) for guppies, the carnivore, coins, the
 * diamond, the jellyfish alien and the first tank; Game Developer Studio's
 * "Cartoon fish" (CC-BY 3.0) for the breeder, muncher and leviathan.
 *
 * Everything loads in the background; until an image is ready (or if it fails)
 * the renderer draws its own vector art instead. Variants the packs don't
 * have, a hungry tint, a grey dead fish and a white hit flash, are made here
 * once from the pixels.
 */

const BASE = new URL('../sprites/', import.meta.url);

const FILES = [
  'guppy-small', 'guppy-small-sick', 'guppy-small-dead',
  'guppy-medium', 'guppy-medium-sick', 'guppy-medium-dead',
  'guppy-large', 'guppy-large-sick', 'guppy-large-dead',
  'predator', 'predator-sick', 'predator-dead',
  'coin-silver', 'coin-gold', 'diamond', 'jelly', 'tank-shallows',
  'fish-black', 'fish-blue', 'fish-purple',
];

/** Strips: name -> frame count. Frames are laid out left to right. */
export const STRIPS = { jelly: 6, 'fish-black': 12, 'fish-blue': 12, 'fish-purple': 12 };

const images = {};
let pending = FILES.length;

function recolor(img, fn) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const data = g.getImageData(0, 0, c.width, c.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [r, gg, b] = fn(d[i], d[i + 1], d[i + 2]);
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
  }
  g.putImageData(data, 0, 0);
  return c;
}

const gray = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
// Hungry: drained towards a sickly olive, like the pack's own sick guppies.
const hungry = (r, g, b) => {
  const y = gray(r, g, b);
  return [y * 0.55 + 150 * 0.45 * (y / 255) + 20, y * 0.55 + 160 * 0.45 * (y / 255) + 18, y * 0.45 + 70 * 0.45 * (y / 255)];
};
const dead = (r, g, b) => {
  const y = gray(r, g, b) * 0.85 + 30;
  return [y, y, y * 1.03];
};
const white = () => [255, 255, 255];
// Twins: the purple jellyfish turned teal.
const teal = (r, g, b) => [g * 0.6, Math.min(255, r * 0.75 + 40), Math.min(255, b * 0.85 + 20)];

export function loadSprites(onReady = () => {}) {
  if (typeof Image === 'undefined') return images;
  for (const name of FILES) {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      images[name] = img;
      if (name.startsWith('fish-')) {
        images[`${name}-hungry`] = recolor(img, hungry);
        images[`${name}-dead`] = recolor(img, dead);
      }
      if (name === 'jelly') {
        images['jelly-flash'] = recolor(img, white);
        images['jelly-teal'] = recolor(img, teal);
      }
      if (name === 'predator') images['predator-flash'] = recolor(img, white);
      if (--pending === 0) onReady();
    };
    img.onerror = () => {
      if (--pending === 0) onReady();
    };
    img.src = new URL(`${name}.webp`, BASE).href;
  }
  return images;
}

export const sprite = (name) => images[name] ?? null;
