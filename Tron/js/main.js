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

  startButton.addEventListener('click', () => {
    document.querySelectorAll('.start-display').forEach(el => el.style.display = 'none');
    scoreEl.style.display = 'block';
    difficultyEl.style.display = 'block';
    
    const view = new View(rootEl, 1);
    window.players = 1;
    view.startGame();
  });

  twoPlayerButton.addEventListener('click', () => {
    document.querySelectorAll('.start-display').forEach(el => el.style.display = 'none');
    scoreEl.style.display = 'block';
    
    const view = new View(rootEl, 2);
    window.players = 2;
    view.startGame();
  });

  replayButton.addEventListener('click', () => {
    document.querySelectorAll('.end-display').forEach(el => el.style.display = 'none');
    const players = window.players || 1;
    const view = new View(rootEl, players);
    view.startGame();
  });
});
