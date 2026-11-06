/**
 * Campaign progress, kept through the kit's guarded storage (it survives
 * blocked storage by living in memory for the session). Everything read back
 * is checked against the level list, so stale or hand-edited saves can't
 * unlock levels that don't exist or break the map.
 *
 * Saved as `volt-flip.campaign`:
 *   { levels: { '1-1': { stars: [finish, shards, noHit], shards, clears, tries } },
 *     seen: { 1: true }, epilogue: false }
 */
import { CHAPTERS, LEVELS, shardTarget } from './levels.js';

const count = (n) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function createProgress(store) {
  let data = read();

  function read() {
    const raw = store.get('campaign', null);
    const out = { levels: {}, seen: {}, epilogue: false };
    if (!raw || typeof raw !== 'object') return out;
    for (const lv of LEVELS) {
      const r = raw.levels?.[lv.id];
      if (!r || typeof r !== 'object') continue;
      const stars = [0, 1, 2].map((i) => Boolean(Array.isArray(r.stars) && r.stars[i]));
      out.levels[lv.id] = { stars, shards: count(r.shards), clears: count(r.clears), tries: count(r.tries) };
    }
    for (const ch of CHAPTERS) if (raw.seen?.[ch.id]) out.seen[ch.id] = true;
    out.epilogue = Boolean(raw.epilogue);
    return out;
  }

  const save = () => store.set('campaign', data);
  const result = (lv) => data.levels[lv.id] || null;
  const starsOf = (lv) => (result(lv)?.stars || [false, false, false]);
  const cleared = (lv) => starsOf(lv)[0];

  return {
    result,
    stars: starsOf,
    cleared,
    starCount: (lv) => starsOf(lv).filter(Boolean).length,
    total: () => LEVELS.reduce((n, lv) => n + starsOf(lv).filter(Boolean).length, 0),
    max: LEVELS.length * 3,
    unlocked: (lv) => lv.index === 0 || cleared(LEVELS[lv.index - 1]),
    chapterUnlocked: (ch) => ch.levels[0].index === 0 || cleared(LEVELS[ch.levels[0].index - 1]),
    /** The level to offer first: the earliest unlocked one not yet cleared, or the last one. */
    current() {
      return LEVELS.find((lv) => !cleared(lv)) || LEVELS[LEVELS.length - 1];
    },
    seen: (ch) => Boolean(data.seen[ch.id]),
    markSeen(ch) {
      data.seen[ch.id] = true;
      save();
    },
    get epilogueSeen() {
      return data.epilogue;
    },
    markEpilogue() {
      data.epilogue = true;
      save();
    },
    /**
     * Record a finished or failed try and return the stars it earned this time,
     * which of them are new, and the stored result.
     */
    record(lv, { won, shards, hits, total }) {
      const prev = result(lv) || { stars: [false, false, false], shards: 0, clears: 0, tries: 0 };
      const now = [won, won && shards >= shardTarget(lv, total), won && hits === 0];
      const fresh = now.map((s, i) => s && !prev.stars[i]);
      const next = {
        stars: prev.stars.map((s, i) => s || now[i]),
        shards: won ? Math.max(prev.shards, shards) : prev.shards,
        clears: prev.clears + (won ? 1 : 0),
        tries: prev.tries + 1,
      };
      data.levels[lv.id] = next;
      save();
      return { now, fresh, result: next, firstClear: won && !prev.stars[0] };
    },
  };
}
