/** Small deterministic random helpers, so a seed always gives the same game. */

/** FNV-1a 32-bit hash of a string. */
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: fast, good enough for games, and identical on every browser. */
export function createRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's date in UTC as YYYY-MM-DD, so the daily board flips at the same moment worldwide. */
export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
