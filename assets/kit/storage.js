/**
 * Namespaced, failure-tolerant localStorage.
 *
 * Every key is stored as `<slug>.<key>`, so games on the same origin can't
 * overwrite each other. Reads and writes never throw: when storage is blocked
 * (private mode, sandboxed iframe, quota) the game keeps running in memory.
 *
 * Personal bests are also mirrored to `gamelab.best.<slug>` so the hub can show them.
 */

const memory = new Map();

function read(fullKey) {
  try {
    const raw = localStorage.getItem(fullKey);
    if (raw !== null) return JSON.parse(raw);
  } catch {
    // Fall through to the in-memory copy.
  }
  return memory.has(fullKey) ? memory.get(fullKey) : undefined;
}

function write(fullKey, value) {
  memory.set(fullKey, value);
  try {
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch {
    // Storage unavailable; the in-memory copy still serves this session.
  }
}

function remove(fullKey) {
  memory.delete(fullKey);
  try {
    localStorage.removeItem(fullKey);
  } catch {}
}

/**
 * @param {string} slug  The game's registry slug, e.g. "tetris".
 */
export function createStore(slug) {
  const key = (k) => `${slug}.${k}`;
  return {
    get(k, fallback = null) {
      const value = read(key(k));
      return value === undefined ? fallback : value;
    },
    set(k, value) {
      write(key(k), value);
    },
    remove(k) {
      remove(key(k));
    },
  };
}

/**
 * Record a result and report whether it beat the stored best.
 *
 * @param {string} slug
 * @param {number} value
 * @param {object} [options]
 * @param {boolean} [options.lowerIsBetter=false]  For times, moves, deaths.
 * @param {string}  [options.mode='default']       Separate bests per mode or level.
 * @param {string}  [options.label]                Human text for the hub, e.g. "Wave 12" or "1:42.3".
 * @returns {{ best: number, isNew: boolean }}
 */
export function recordBest(slug, value, { lowerIsBetter = false, mode = 'default', label } = {}) {
  const fullKey = `gamelab.best.${slug}`;
  const all = read(fullKey) ?? {};
  const previous = all[mode];
  const isNew =
    previous === undefined || (lowerIsBetter ? value < previous.value : value > previous.value);
  if (isNew) {
    all[mode] = { value, label: label ?? String(value), lowerIsBetter, at: Date.now() };
    write(fullKey, all);
  }
  return { best: isNew ? value : previous.value, isNew };
}

/** All stored bests for a game, keyed by mode: `{ default: { value, label, ... } }`. */
export function readBests(slug) {
  return read(`gamelab.best.${slug}`) ?? {};
}

/** Copy a value saved under an old, un-namespaced key into the store once, then drop the old key. */
export function migrateKey(store, oldKey, newKey, { parse = (v) => v } = {}) {
  if (store.get(newKey) !== null) return;
  try {
    const raw = localStorage.getItem(oldKey);
    if (raw === null) return;
    store.set(newKey, parse(raw));
    localStorage.removeItem(oldKey);
  } catch {}
}
