import { fetchPlaylistItems, fetchVideoDetails } from './youtube.js';

const GAMING_MUSIC_PLAYLIST_ID = 'DP3rDP02lE0';
const DEFAULT_VIDEO_IDS = ["X2V0ag9mCjc", "CPIyuGoH_24", "-tOSh9bDh00"];

async function initMusicPlayer() {
  const elements = {
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
  };

  if (Object.values(elements).some(el => !el)) {
    setTimeout(initMusicPlayer, 100);
    return;
  }

  let isMuted = false;
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
    // Assume it's a raw playlist ID if it doesn't match a video URL format
    if (url.length > 11) {
        return { type: 'playlist', id: url };
    }
    return null;
  }

  async function loadMedia(input) {
    const parsed = parseYoutubeUrl(input);
    currentMedia = parsed || { type: 'playlist', id: GAMING_MUSIC_PLAYLIST_ID };
    
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
    const videoDetails = await fetchVideoDetails(videoId);
    if (videoDetails && videoDetails.embeddable) {
      elements.thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      elements.player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1`;
    } else {
      console.error('Failed to load single video. Using default videos.');
      loadDefaultVideo();
    }
  }

  function loadRandomVideo() {
    if (playlist.length === 0) {
        loadDefaultVideo();
        return;
    };
    const randomIndex = Math.floor(Math.random() * playlist.length);
    const video = playlist[randomIndex];
    elements.thumbnail.src = video.thumbnail;
    elements.player.src = `https://www.youtube.com/embed/${video.videoId}?enablejsapi=1&autoplay=1&mute=${isMuted ? 1 : 0}&loop=1&playlist=${video.videoId}&controls=0&modestbranding=1`;
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

  elements.muteIcon.classList.add("fa-volume-up");
  elements.muteIcon.classList.remove("fa-volume-mute");

  elements.videoCircle.addEventListener("mouseenter", () => {
    gsap.to(elements.musicSlider, { right: "1rem", duration: 0.3, ease: "power2.out" });
  });

  elements.videoCircle.addEventListener("mouseleave", () => {
    gsap.to(elements.musicSlider, { right: "-100px", duration: 0.3, ease: "power2.in" });
  });

  const toggleMute = () => {
    isMuted = !isMuted;
    const action = isMuted ? 'mute' : 'unMute';
    elements.player.contentWindow.postMessage(`{"event":"command","func":"${action}","args":""}`, "*");
    elements.muteIcon.classList.toggle("fa-volume-up", !isMuted);
    elements.muteIcon.classList.toggle("fa-volume-mute", isMuted);
  };

  elements.videoCircle.addEventListener("click", toggleMute);
  elements.muteCircle.addEventListener("click", toggleMute);
  elements.changeButton.addEventListener("click", loadRandomVideo);
  elements.settingsBtn.addEventListener("click", openModal);
  elements.closeModalBtn.addEventListener("click", closeModal);

  elements.loadMediaBtn.addEventListener("click", () => {
    const mediaInput = elements.mediaInput.value.trim();
    if (mediaInput) {
      loadMedia(mediaInput);
      closeModal();
    }
  });

  const savedMedia = localStorage.getItem('youtubeMedia') || GAMING_MUSIC_PLAYLIST_ID;
  elements.mediaInput.value = savedMedia;
  await loadMedia(savedMedia);
}

initMusicPlayer();
