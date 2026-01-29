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
    console.log("Music player elements not found, retrying...");
    setTimeout(initMusicPlayer, 500);
    return;
  }

  let isMuted = false;
  let playlist = [];
  let currentMedia = { type: 'playlist', id: GAMING_MUSIC_PLAYLIST_ID };

  // ... (Parsing and Loading logic remains similar) ...

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
    localStorage.setItem('youtubeMedia', input);

    if (currentMedia.type === 'playlist') {
      elements.changeButton.style.display = 'flex';
      await loadPlaylist(currentMedia.id);
    } else if (currentMedia.type === 'video') {
      elements.changeButton.style.display = 'none';
      await loadSingleVideo(currentMedia.id);
    }
  }

  async function loadPlaylist(playlistId) {
    try {
      playlist = await fetchPlaylistItems(playlistId);
      if (playlist.length > 0) {
        loadRandomVideo();
      } else {
        console.error('Failed to load playlist. Using default videos.');
        loadDefaultVideo();
      }
    } catch (error) {
      console.error('Error loading playlist. Using default videos.', error);
      loadDefaultVideo();
    }
  }

  async function loadSingleVideo(videoId) {
    try {
      const videoDetails = await fetchVideoDetails(videoId);
      if (videoDetails && !videoDetails.embeddable) {
        console.warn('Video reported as not embeddable by API, skipping:', videoId);
        loadDefaultVideo();
        return;
      }
    } catch (e) {
      // Ignore API errors and try loading anyway
      console.log('Skipping API check for video details, attempting load...');
    }

    elements.thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    const origin = window.location.origin;
    elements.player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1&origin=${origin}`;
  }

  function loadRandomVideo() {
    if (!playlist || playlist.length === 0) {
      // Use local defaults if playlist failed
      const localDefaults = DEFAULT_VIDEO_IDS;
      const randomId = localDefaults[Math.floor(Math.random() * localDefaults.length)];
      loadSingleVideo(randomId);
      return;
    };
    const randomIndex = Math.floor(Math.random() * playlist.length);
    const video = playlist[randomIndex];

    // Support both API object structure and raw ID strings
    const videoId = video.videoId || video;
    const thumb = video.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    elements.thumbnail.src = thumb;
    const origin = window.location.origin;
    elements.player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1&origin=${origin}`;
  }

  function loadDefaultVideo() {
    elements.changeButton.style.display = 'flex';
    const randomId = DEFAULT_VIDEO_IDS[Math.floor(Math.random() * DEFAULT_VIDEO_IDS.length)];
    loadSingleVideo(randomId);
  }

  function openModal() {
    elements.playlistModal.classList.remove('hidden');
  }

  function closeModal() {
    elements.playlistModal.classList.add('hidden');
  }

  // Initial State
  elements.muteIcon.classList.add("fa-volume-up");
  elements.muteIcon.classList.remove("fa-volume-mute");

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
  };

  // Event Listeners
  // Note: Hover animations are now handled by CSS in music-player.css

  // Debug: Check if buttons exist
  if (!elements.closeModalBtn) console.error("Close Modal Button not found in DOM");
  if (!elements.loadMediaBtn) console.error("Load Media Button not found in DOM");

  elements.videoCircle.addEventListener("click", toggleMute);
  elements.muteCircle.addEventListener("click", toggleMute);
  elements.changeButton.addEventListener("click", loadRandomVideo);

  elements.settingsBtn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal();
  });

  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Cancel clicked");
      closeModal();
    });
  }

  if (elements.loadMediaBtn) {
    elements.loadMediaBtn.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Load clicked");
      const mediaInput = elements.mediaInput.value.trim();
      if (mediaInput) {
        loadMedia(mediaInput);
        closeModal();
      } else {
        console.warn("Input is empty");
        // Optional: Shake animation or alert
      }
    });
  }

  // Load Initial Media
  const savedMedia = localStorage.getItem('youtubeMedia') || GAMING_MUSIC_PLAYLIST_ID;
  elements.mediaInput.value = savedMedia;
  await loadMedia(savedMedia);
}

initMusicPlayer();
