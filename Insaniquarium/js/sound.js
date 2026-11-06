/**
 * Original sound effects and music (assets/sfx, assets/music). Uses audio
 * elements so the game also works when index.html is opened straight from disk.
 */

export function createSound() {
  const pools = {};
  let music = null;
  let musicName = '';
  const state = { sfx: 0.8, music: 0.6 };

  function pool(name) {
    if (!pools[name]) {
      const a = new Audio(`assets/sfx/${name}.ogg`);
      a.preload = 'auto';
      pools[name] = [a];
    }
    return pools[name];
  }

  function preload(names) {
    for (const n of names) pool(n);
  }

  function play(name, { volume = 1 } = {}) {
    if (!state.sfx) return;
    const list = pool(name);
    // Reuse a finished copy, or make another so sounds can overlap.
    let a = list.find((x) => x.paused || x.ended);
    if (!a) {
      if (list.length >= 6) return;
      a = list[0].cloneNode();
      list.push(a);
    }
    a.volume = Math.max(0, Math.min(1, volume * state.sfx));
    a.currentTime = 0;
    a.play().catch(() => {});
  }

  function playMusic(name) {
    if (musicName === name) return;
    musicName = name;
    if (music) music.pause();
    music = new Audio(`assets/music/${name}.ogg`);
    music.loop = true;
    music.volume = state.music;
    if (state.music) music.play().catch(() => {});
  }

  function stopMusic() {
    if (music) music.pause();
    music = null;
    musicName = '';
  }

  /** Browsers only start audio after a click; call this from one. */
  function unlock() {
    if (music && music.paused && state.music) music.play().catch(() => {});
  }

  function setVolume(kind, v) {
    state[kind] = v;
    if (kind === 'music' && music) {
      music.volume = v;
      if (v) music.play().catch(() => {});
      else music.pause();
    }
  }

  return { preload, play, playMusic, stopMusic, unlock, setVolume, state };
}
