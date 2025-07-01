function initMusicPlayer() {
  const videoIds = ["X2V0ag9mCjc", "CPIyuGoH_24", "-tOSh9bDh00"];
  const elements = {
    musicSlider: document.getElementById("music-slider"),
    videoCircle: document.getElementById("video-circle"),
    muteCircle: document.getElementById("mute-circle"),
    muteIcon: document.getElementById("mute-icon"),
    player: document.getElementById("youtube-player"),
    thumbnail: document.getElementById("music-thumbnail"),
    changeButton: document.getElementById("change-btn")
  };

  if (Object.values(elements).some(el => !el)) {
    setTimeout(initMusicPlayer, 100);
    return;
  }
  let isMuted = false;

  const loadVideo = (videoId) => {
    const fullUrl = `https://www.youtube.com/watch?v=${videoId}`;
    elements.thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    elements.player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=0&loop=1&playlist=${videoId}&controls=0&modestbranding=1`;
  };

  // Load default/random video
  const randomId = videoIds[Math.floor(Math.random() * videoIds.length)];
  loadVideo(randomId);

  elements.muteIcon.classList.add("fa-volume-up");
  elements.muteIcon.classList.remove("fa-volume-mute");

  elements.videoCircle.addEventListener("mouseenter", () => {
    gsap.to(elements.musicSlider, { right: "1rem", duration: 0.3, ease: "power2.out" });
  });

  elements.videoCircle.addEventListener("mouseleave", () => {
    gsap.to(elements.musicSlider, { right: "-100px", duration: 0.3, ease: "power2.in" });
  });

  document.addEventListener("DOMContentLoaded", () => {
    elements.videoCircle.style.opacity = "1";
  });

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

  elements.videoCircle.addEventListener("click", toggleMute);
  elements.muteCircle.addEventListener("click", toggleMute);

  elements.changeButton.addEventListener("click", () => {
    const randomId = videoIds[Math.floor(Math.random() * videoIds.length)];
    loadVideo(randomId);
  });
}

initMusicPlayer();