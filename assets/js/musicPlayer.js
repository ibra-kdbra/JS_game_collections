function initMusicPlayer() {
  const videoUrls = ["https://www.youtube.com/watch?v=X2V0ag9mCjc", "https://www.youtube.com/watch?v=axYc-NpvZWg","https://www.youtube.com/watch?v=Yys43tMxMoc"];
  const elements = {
    musicSlider: document.getElementById("music-slider"),
    videoCircle: document.getElementById("video-circle"),
    muteCircle: document.getElementById("mute-circle"),
    muteIcon: document.getElementById("mute-icon"),
    player: document.getElementById("youtube-player"),
    thumbnail: document.getElementById("music-thumbnail"),
    changeButton: document.getElementById('change-btn')
  };

  // Check if all required elements exist
  if (Object.values(elements).some(el => !el)) {
    setTimeout(initMusicPlayer, 100); // Try again in 100ms if elements aren't ready
    return;
  }
  let isMuted = false;
  const loadVideo = (url) => {
    const defaultvideoUrl = "https://www.youtube.com/watch?v=X2V0ag9mCjc";
    let videoId = new URL(url).searchParams.get("v");
    let currentVideoId = videoId;
    // Initialize player
    elements.thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    elements.player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&showinfo=0&modestbranding=1`;
  };

  // Initialize with default video
  loadVideo(videoUrls[Math.floor(Math.random() * videoUrls.length)]);
  // Player configuration

  // Set initial icon state
  elements.muteIcon.classList.add("fa-volume-up");
  elements.muteIcon.classList.remove("fa-volume-mute");

  // Animation effects
  elements.videoCircle.addEventListener("mouseenter", () => {
    gsap.to(elements.musicSlider, { right: "1rem", duration: 0.3, ease: "power2.out" });
  });

  elements.videoCircle.addEventListener("mouseleave", () => {
    gsap.to(elements.musicSlider, { right: "-100px", duration: 0.3, ease: "power2.in" });
  });

  // Ensure visibility
  document.addEventListener("DOMContentLoaded", () => {
    elements.videoCircle.style.opacity = "1";
  });

  // Mute toggle function
  const toggleMute = () => {
    if (isMuted) {
      elements.player.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', "*");
      elements.muteIcon.classList.replace("fa-volume-mute", "fa-volume-up");
    } else {
      elements.player.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', "*");
      elements.muteIcon.classList.replace("fa-volume-up", "fa-volume-mute");
    }
    isMuted = !isMuted;
  };

  // Event listeners
  elements.videoCircle.addEventListener("click", toggleMute);
  elements.muteCircle.addEventListener("click", toggleMute);

  elements.changeButton.addEventListener('click', () => {
    const randomUrl = videoUrls[Math.floor(Math.random() * videoUrls.length)];
    loadVideo(randomUrl);
  });
}

// Start initialization
initMusicPlayer();