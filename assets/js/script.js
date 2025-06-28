import { createGameCards } from './Card.js';
import { games } from './data.js';
import './musicPlayer.js'; 
import { VideoPlayerComponent } from './videoPlayer.js';

document.addEventListener("DOMContentLoaded", () => {
  const videoPlayer = new VideoPlayerComponent();
  videoPlayer.render('#video-player-container');
  const container = document.getElementById("game-cards-container");
  const bodyId = document.body.id;

  let selectedGames = [];

  if (bodyId === "flow-body") {
    selectedGames = games.slice(0, 7);
    initializeHorizontalScroll(container);
  } else if (bodyId === "main") {
    selectedGames = games.slice(7, 18);
    initializeVerticalScroll(container);
  }

  createGameCards(container, selectedGames);
});

function initializeHorizontalScroll(container) {
  let startX;

  container.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  container.addEventListener("touchmove", (e) => {
    if (startX === undefined) return;

    let diff = startX - e.touches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        container.scrollBy({ left: 300, behavior: "smooth" });
      } else {
        container.scrollBy({ left: -300, behavior: "smooth" });
      }
      startX = undefined;
    }
  });

  const leftButton = document.querySelector(".scroll-button.left");
  const rightButton = document.querySelector(".scroll-button.right");

  leftButton.addEventListener("click", () => {
    container.scrollBy({ left: -300, behavior: "smooth" });
  });

  rightButton.addEventListener("click", () => {
    container.scrollBy({ left: 300, behavior: "smooth" });
  });
}

function initializeVerticalScroll(container) {
  let startY;

  container.addEventListener("touchstart", (e) => {
    startY = e.touches[0].clientY;
  });

  container.addEventListener("touchmove", (e) => {
    if (startY === undefined) return;

    let diff = startY - e.touches[0].clientY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        container.scrollBy({ top: 300, behavior: "smooth" });
      } else {
        container.scrollBy({ top: -300, behavior: "smooth" });
      }
      startY = undefined;
    }
  });
}
