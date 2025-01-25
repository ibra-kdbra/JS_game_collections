import { View } from './view.js';

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.end-display').forEach(el => el.style.display = 'none');

  const rootEl = document.querySelector('.tron-game');
  window.wins = { blue: 0, red: 0 };

  const startButton = document.getElementById('start');
  const twoPlayerButton = document.getElementById('two-player');
  const replayButton = document.getElementById('replay');
  const scoreEl = document.querySelector('.score');
  const difficultyEl = document.querySelector('.difficulty');

  const audioEl = document.getElementById('game-audio');
  const muteBtn = document.getElementById('mute-btn');

  audioEl.muted = false;

  muteBtn.addEventListener('click', () => {
    audioEl.muted = !audioEl.muted;
    muteBtn.textContent = audioEl.muted ? '🔇' : '🔊';
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > 50) {
        sendSwipeDirection('E');
      } else if (deltaX < -50) {
        sendSwipeDirection('W');
      }
    } else {
      if (deltaY > 50) {
        sendSwipeDirection('S');
      } else if (deltaY < -50) {
        sendSwipeDirection('N');
      }
    }
  }

  function sendSwipeDirection(direction) {
    if (window.currentView) {
      window.currentView.handleSwipe(direction);
    }
  }

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, false);

  document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].clientX;
    touchEndY = e.changedTouches[0].clientY;
    handleSwipe();
  }, false);

  startButton.addEventListener('click', () => {
    audioEl.play().catch(() => { /* handle if blocked */ });

    document.querySelectorAll('.start-display').forEach(el => el.style.display = 'none');
    scoreEl.style.display = 'block';
    difficultyEl.style.display = 'block';

    const view = new View(rootEl, 1);
    window.players = 1;
    window.currentView = view;
    view.startGame();
    rootEl.style.display = 'block';
  });

  twoPlayerButton.addEventListener('click', () => {
    audioEl.play().catch(() => { /* handle if blocked */ });

    document.querySelectorAll('.start-display').forEach(el => el.style.display = 'none');
    scoreEl.style.display = 'block';

    const view = new View(rootEl, 2);
    window.players = 2;
    window.currentView = view;
    view.startGame();
    rootEl.style.display = 'block';
  });

  replayButton.addEventListener('click', () => {
    audioEl.play().catch(() => { /* handle if blocked */ });

    document.querySelectorAll('.end-display').forEach(el => el.style.display = 'none');
    const players = window.players || 1;
    const view = new View(rootEl, players);
    window.currentView = view;
    view.startGame();
    rootEl.style.display = 'block';
  });
});

