const musicSlider = document.getElementById("music-slider");
const videoCircle = document.getElementById("video-circle");
const muteCircle = document.getElementById("mute-circle");
const muteIcon = document.getElementById("mute-icon");
const player = document.getElementById("youtube-player");
const thumbnail = document.getElementById("music-thumbnail");

const videoUrl = "https://www.youtube.com/watch?v=CPIyuGoH_24"; // Replace with actual video link
const videoId = new URL(videoUrl).searchParams.get("v"); // Extract Video ID

// Set Thumbnail Image
thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

//  YouTube Embed URL & Auto-Play + Unmute**
player.src = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=0&loop=1&playlist=${videoId}
&controls=0&showinfo=0&modestbranding=1`;

let isMuted = false;

//  Smooth Hover Transition for Mute Button (No Lag)**
videoCircle.addEventListener("mouseenter", () => {
  gsap.to(musicSlider, { right: "1rem", duration: 0.3, ease: "power2.out" });
});

videoCircle.addEventListener("mouseleave", () => {
  gsap.to(musicSlider, { right: "-100px", duration: 0.3, ease: "power2.in" });
});

//  Ensure Video and Audio Start Correctly (on Mobile)**
document.addEventListener("DOMContentLoaded", () => {
  videoCircle.style.opacity = "1"; // Ensure it never disappears
});

// Toggle Mute/Unmute on Mobile (Click Video Circle)
videoCircle.addEventListener("click", () => {
  if (isMuted) {
    player.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', "*");
    muteIcon.classList.replace("fa-volume-mute", "fa-volume-up");
  } else {
    player.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', "*");
    muteIcon.classList.replace("fa-volume-up", "fa-volume-mute");
  }
  isMuted = !isMuted;
});

//  Mute/Unmute on Desktop (Click Mute Button)**
muteCircle.addEventListener("click", () => {
  if (isMuted) {
    player.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', "*");
    muteIcon.classList.replace("fa-volume-mute", "fa-volume-up");
  } else {
    player.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', "*");
    muteIcon.classList.replace("fa-volume-up", "fa-volume-mute");
  }
  isMuted = !isMuted;
});
