import { fetchPlaylistItems } from './youtube.js';

const GAMING_MUSIC_PLAYLIST_ID = 'gaming-mix'; // the built-in rotation below
const DONKEY_KONG_VIDEO_ID = 'DP3rDP02lE0';
const DEFAULT_VIDEO_IDS = ["X2V0ag9mCjc", "CPIyuGoH_24", "-tOSh9bDh00", DONKEY_KONG_VIDEO_ID];
const PREF_KEY = 'musicPref'; // 'on' | 'off'

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

async function initMusicPlayer() {
  // DOM Elements are selected afresh to ensure we get the injected ones
  const getElements = () => ({
    musicSlider: document.getElementById("music-slider"),
    videoCircle: document.getElementById("video-circle"),
    muteCircle: document.getElementById("mute-circle"),
    muteIcon: document.getElementById("mute-icon"),
    player: document.getElementById("youtube-player"),
    thumbnail: document.getElementById("music-thumbnail"),
    changeButton: document.getElementById("change-btn"),
    settingsBtn: document.getElementById("settings-btn"),
    playlistModal: document.getElementById("playlist-modal"),
    mediaInput: document.getElementById("media-input"),
    loadMediaBtn: document.getElementById("load-media-btn"),
    closeModalBtn: document.getElementById("close-modal-btn"),
    prompt: document.getElementById("music-prompt"),
    promptPlay: document.getElementById("music-prompt-play"),
    promptLater: document.getElementById("music-prompt-later"),
  });

  let elements = getElements();

  // Retry if elements not yet injected (by VideoPlayerComponent)
  if (!elements.musicSlider) {
    setTimeout(initMusicPlayer, 500);
    return;
  }

  // Nothing loads or plays until the visitor asks for music, so a track never
  // starts silently in the background and jumps in halfway through.
  let playing = false;
  let started = false;
  let playlist = [];
  let currentVideoId = null;
  let currentMedia = { type: 'playlist', id: GAMING_MUSIC_PLAYLIST_ID };

  function parseYoutubeUrl(url) {
    const videoIdMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (videoIdMatch) {
      return { type: 'video', id: videoIdMatch[1] };
    }
    const playlistIdMatch = url.match(/[&?]list=([a-zA-Z0-9_-]+)/);
    if (playlistIdMatch) {
      return { type: 'playlist', id: playlistIdMatch[1] };
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
      return { type: 'video', id: url };
    }
    if (url.length > 11) {
      return { type: 'playlist', id: url };
    }
    return null;
  }

  const thumbFor = (videoId) => `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const randomDefault = () => DEFAULT_VIDEO_IDS[Math.floor(Math.random() * DEFAULT_VIDEO_IDS.length)];

  // Pick the track to play (shows its cover) without loading the player.
  async function chooseMedia(input) {
    const fallback = { type: 'playlist', id: GAMING_MUSIC_PLAYLIST_ID };
    // The bare Donkey Kong id was the old default setting; it means the mix.
    const isMix = input === GAMING_MUSIC_PLAYLIST_ID || input === DONKEY_KONG_VIDEO_ID;
    currentMedia = isMix ? fallback : (parseYoutubeUrl(input) || fallback);
    store.set('youtubeMedia', input);
    playlist = [];

    if (currentMedia.type === 'video') {
      elements.changeButton.style.display = 'none';
      currentVideoId = currentMedia.id;
    } else {
      elements.changeButton.style.display = 'flex';
      if (currentMedia.id !== GAMING_MUSIC_PLAYLIST_ID) {
        try { playlist = await fetchPlaylistItems(currentMedia.id); } catch { playlist = []; }
      }
      // The mix opens with the Donkey Kong theme; the change button rotates from there.
      currentVideoId = currentMedia.id === GAMING_MUSIC_PLAYLIST_ID ? DONKEY_KONG_VIDEO_ID : pickFromPlaylist();
    }
    elements.thumbnail.src = thumbFor(currentVideoId);
  }

  function pickFromPlaylist() {
    if (!playlist.length) {
      let id = randomDefault();
      if (DEFAULT_VIDEO_IDS.length > 1) while (id === currentVideoId) id = randomDefault();
      return id;
    }
    const video = playlist[Math.floor(Math.random() * playlist.length)];
    return video.videoId || video;
  }

  // Load the current track from its first second, with sound. Called from a click,
  // so the browser lets it play out loud.
  function startTrack() {
    const originParam = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file'))
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';
    const id = currentVideoId;
    elements.player.src = `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&autoplay=1&start=0&loop=1&playlist=${id}&controls=0&modestbranding=1&playsinline=1${originParam}`;
    started = true;
    setPlaying(true);
  }

  function command(func, args = '') {
    if (elements.player.contentWindow) {
      elements.player.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
    }
  }

  // If the browser held autoplay back, ask the player again once it has loaded.
  elements.player.addEventListener('load', () => {
    if (playing) { command('unMute'); command('playVideo'); }
  });

  function setPlaying(on) {
    playing = on;
    elements.muteIcon.classList.toggle("fa-volume-up", on);
    elements.muteIcon.classList.toggle("fa-volume-mute", !on);
    elements.muteCircle.setAttribute('aria-pressed', String(on));
    elements.videoCircle.setAttribute('aria-pressed', String(on));
    elements.musicSlider.classList.toggle('is-playing', on);
  }

  // Play / pause. Pausing (not muting) keeps the song where you left it.
  const togglePlay = () => {
    hidePrompt();
    if (!started) {
      store.set(PREF_KEY, 'on');
      startTrack();
      return;
    }
    if (playing) {
      command('pauseVideo');
      setPlaying(false);
    } else {
      command('unMute');
      command('playVideo');
      setPlaying(true);
    }
  };

  const nextTrack = () => {
    hidePrompt();
    currentVideoId = pickFromPlaylist();
    elements.thumbnail.src = thumbFor(currentVideoId);
    store.set(PREF_KEY, 'on');
    startTrack();
  };

  // The "play music?" card, shown once per page unless music was turned down for good.
  let promptTimer = 0;
  function showPrompt() {
    if (!elements.prompt) return;
    elements.prompt.hidden = false;
    requestAnimationFrame(() => elements.prompt.classList.add('is-open'));
    promptTimer = setTimeout(hidePrompt, 15000);
  }
  function hidePrompt() {
    clearTimeout(promptTimer);
    if (!elements.prompt || elements.prompt.hidden) return;
    elements.prompt.classList.remove('is-open');
    setTimeout(() => { elements.prompt.hidden = true; }, 250);
  }

  function openModal() {
    hidePrompt();
    elements.playlistModal.classList.remove('hidden');
    elements.mediaInput.focus();
  }

  function closeModal() {
    elements.playlistModal.classList.add('hidden');
    elements.settingsBtn.focus();
  }

  async function loadAndPlay(input) {
    await chooseMedia(input);
    closeModal();
    store.set(PREF_KEY, 'on');
    startTrack();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.playlistModal.classList.contains('hidden')) closeModal();
  });

  setPlaying(false);

  // Event Listeners (hover/focus reveal of the controls is handled in music-player.css)
  elements.videoCircle.addEventListener("click", togglePlay);
  elements.muteCircle.addEventListener("click", togglePlay);
  elements.changeButton.addEventListener("click", nextTrack);

  elements.settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  elements.closeModalBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal();
  });

  elements.loadMediaBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const mediaInput = elements.mediaInput.value.trim();
    if (mediaInput) loadAndPlay(mediaInput);
    else elements.mediaInput.focus();
  });

  elements.playlistModal.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      elements.mediaInput.value = btn.dataset.preset;
      loadAndPlay(btn.dataset.preset);
    });
  });

  elements.promptPlay?.addEventListener('click', togglePlay);
  elements.promptLater?.addEventListener('click', () => {
    store.set(PREF_KEY, 'off');
    hidePrompt();
  });

  // Initial track (cover only; nothing plays yet)
  const savedMedia = store.get('youtubeMedia') || GAMING_MUSIC_PLAYLIST_ID;
  elements.mediaInput.value = savedMedia;
  await chooseMedia(savedMedia);

  if (store.get(PREF_KEY) !== 'off') setTimeout(showPrompt, 1200);
}

initMusicPlayer();
