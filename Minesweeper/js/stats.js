/** Per-difficulty statistics kept in the kit store. */

export const STAT_KEYS = [
  ['beginner', 'Beginner'],
  ['intermediate', 'Intermediate'],
  ['expert', 'Expert'],
  ['custom', 'Custom'],
  ['daily', 'Daily'],
  ['puzzle', 'Puzzles'],
];

const blank = () => ({ games: 0, wins: 0, best: null, streak: 0, bestStreak: 0 });

export function createStats(store) {
  let all = store.get('stats', {}) ?? {};
  const save = () => store.set('stats', all);

  return {
    get(key) {
      return { ...blank(), ...(all[key] ?? {}) };
    },
    /** Record a finished game. Returns a token that `revert` can use to undo it. */
    record(key, won, seconds) {
      const before = all[key] ? { ...all[key] } : null;
      const s = this.get(key);
      s.games++;
      if (won) {
        s.wins++;
        s.streak++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        if (s.best === null || seconds < s.best) s.best = seconds;
      } else {
        s.streak = 0;
      }
      all[key] = s;
      save();
      return { key, before };
    },
    revert(token) {
      if (!token) return;
      if (token.before) all[token.key] = token.before;
      else delete all[token.key];
      save();
    },
    reset() {
      all = {};
      save();
    },
  };
}

export function formatTime(sec) {
  if (sec === null || sec === undefined) return '–';
  if (sec < 60) return sec.toFixed(1) + 's';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
