import { fetchPlaylistItems, fetchVideoDetails } from './youtube.js';

const GAMING_MUSIC_PLAYLIST_ID = 'DP3rDP02lE0';
const DEFAULT_VIDEO_IDS = ["X2V0ag9mCjc", "CPIyuGoH_24", "-tOSh9bDh00"];

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
    closeModalBtn: document.getElementById("close-modal-btn")
  });

  let elements = getElements();

  // Retry if elements not yet injected (by VideoPlayerComponent)
  if (!elements.musicSlider) {
    setTimeout(initMusicPlayer, 500);
    return;
  }

  let isMuted = true; // Start muted to allow Autoplay
  let playlist = [];
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
    if (url.length > 11) {
      return { type: 'playlist', id: url };
    }
    return null;
  }

  async function loadMedia(input) {
    const parsed = parseYoutubeUrl(input);
    currentMedia = parsed || { type: 'playlist', id: GAMING_MUSIC_PLAYLIST_ID };

    // Save preference
    try {
      localStorage.setItem('youtubeMedia', input);
    } catch {}

    if (currentMedia.type === 'playlist') {
      elements.changeButton.style.display = 'flex';
      await loadPlaylist(currentMedia.id);
    } else if (currentMedia.type === 'video') {
      elements.changeButton.style.display = 'none';
      await loadSingleVideo(currentMedia.id);
    }
  }

  async function loadPlaylist(playlistId) {
    // Optimization: If using the default playlist and we know the API key is restricted,
    // skip the fetch entirely and use local defaults immediately.
    if (playlistId === GAMING_MUSIC_PLAYLIST_ID) {
      loadDefaultVideo();
      return;
    }

    try {
      playlist = await fetchPlaylistItems(playlistId);
      if (playlist.length > 0) {
        loadRandomVideo();
      } else {
        loadDefaultVideo();
      }
    } catch (error) {
      loadDefaultVideo();
    }
  }

  async function loadSingleVideo(videoId) {
    elements.thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const originParam = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file')) 
      ? `&origin=${encodeURIComponent(window.location.origin)}` 
      : '';
    elements.player.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1${originParam}`;
    elements.player.allow = "autoplay; encrypted-media";
  }

  function loadRandomVideo() {
    if (!playlist || playlist.length === 0) {
      const localDefaults = DEFAULT_VIDEO_IDS;
      const randomId = localDefaults[Math.floor(Math.random() * localDefaults.length)];
      loadSingleVideo(randomId);
      return;
    }
    const randomIndex = Math.floor(Math.random() * playlist.length);
    const video = playlist[randomIndex];

    const videoId = video.videoId || video;
    const thumb = video.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    elements.thumbnail.src = thumb;
    const originParam = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file')) 
      ? `&origin=${encodeURIComponent(window.location.origin)}` 
      : '';
    elements.player.src = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1${originParam}`;
    elements.player.allow = "autoplay; encrypted-media";
  }

  function loadDefaultVideo() {
    elements.changeButton.style.display = 'flex';
    const randomId = DEFAULT_VIDEO_IDS[Math.floor(Math.random() * DEFAULT_VIDEO_IDS.length)];
    loadSingleVideo(randomId);
  }

  function openModal() {
    elements.playlistModal.classList.remove('hidden');
    elements.mediaInput.focus();
  }

  function closeModal() {
    elements.playlistModal.classList.add('hidden');
    elements.settingsBtn.focus();
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.playlistModal.classList.contains('hidden')) closeModal();
  });

  // Initial State
  // Start OFF as muted visually too
  elements.muteIcon.classList.remove("fa-volume-up");
  elements.muteIcon.classList.add("fa-volume-mute");

  // Toggle Mute Logic
  const toggleMute = () => {
    isMuted = !isMuted;
    const action = isMuted ? 'mute' : 'unMute';
    // Post message to iframe
    if (elements.player.contentWindow) {
      elements.player.contentWindow.postMessage(`{"event":"command","func":"${action}","args":""}`, "*");
    }
    elements.muteIcon.classList.toggle("fa-volume-up", !isMuted);
    elements.muteIcon.classList.toggle("fa-volume-mute", isMuted);
    elements.muteCircle.setAttribute('aria-pressed', String(!isMuted));
    elements.videoCircle.setAttribute('aria-pressed', String(!isMuted));
  };

  // Event Listeners (hover/focus reveal of the controls is handled in music-player.css)
  elements.videoCircle.addEventListener("click", toggleMute);
  elements.muteCircle.addEventListener("click", toggleMute);
  elements.changeButton.addEventListener("click", loadRandomVideo);

  // "Unmute on First Click" Hack
  // Browsers block audio until the user interacts with the page.
  // We listen for the first click anywhere to instantly unmute.
  const unmuteOnFirstInteract = () => {
    if (isMuted) {
      toggleMute();
    }
  };
  document.addEventListener('click', unmuteOnFirstInteract, { once: true });

  elements.settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  if (elements.loadMediaBtn) {
    elements.loadMediaBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const mediaInput = elements.mediaInput.value.trim();
      if (mediaInput) {
        loadMedia(mediaInput);
        closeModal();
      } else {
        elements.mediaInput.focus();
      }
    });
  }

  // Load Initial Media
  let savedMedia = GAMING_MUSIC_PLAYLIST_ID;
  try {
    savedMedia = localStorage.getItem('youtubeMedia') || GAMING_MUSIC_PLAYLIST_ID;
  } catch {}
  elements.mediaInput.value = savedMedia;
  await loadMedia(savedMedia);
}

initMusicPlayer();
