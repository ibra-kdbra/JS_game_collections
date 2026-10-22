import gameSystem from './src/game.js';
import dataSystem from './src/data.js';

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
  let puzzleId = entities.game.levels.sequence[current];
  entities.level.state.updates = [puzzleId];
}

gameSystem.setup(entities);
