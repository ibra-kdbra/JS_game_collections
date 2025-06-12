import gameSystem from './src/game.js';
import dataSystem from './src/data.js';
import { initTouchControls } from './src/touch.js'; 

let entities;
try {
  const response = await fetch('./assets/entities.json');
  entities = await response.json();
} catch (error) {
  console.error('Error loading entities.json:', error);
  entities = {}; // fallback empty object
}

let current = dataSystem.load('current');
if (current !== undefined) {
  entities.game.levels.current = current;
  let sequence = dataSystem.load('payed') 
    ? entities.game.levels.wm 
    : entities.game.levels.sequence;
  let puzzleId = sequence[current];
  entities.level.state.updates = [puzzleId];
}

gameSystem.setup(entities);

document.addEventListener('DOMContentLoaded', () => {
  initTouchControls('game'); // Call the touch module
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        '/Gravity_Wells/src/sw.js',
        { scope: '/Gravity_Wells/' }
      );
      console.log('SW registered:', registration);
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  });
}