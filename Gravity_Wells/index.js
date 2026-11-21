import { initShell } from '../assets/kit/shell.js';
import gameSystem from './src/game.js';
import dataSystem from './src/data.js';
import uiSystem from './src/ui.js';

initShell({ slug: 'gravity-wells' });

let entities;
try {
  const response = await fetch('./assets/entities.json');
  entities = await response.json();
  if (window.matchMedia('(pointer: coarse)').matches) {
    const intro = entities.startscreen.puzzle;
    intro.text = intro.text.map((line) =>
      line === 'Keys: arrows, R to reset.' ? 'Tap squares to make a move.' : line);
  }
} catch (error) {
  console.error('Error loading entities.json:', error);
  entities = {};
}

let levels = entities.game.levels;
let current = levels.sequence.indexOf(dataSystem.load('level'));
if (current > -1) {
  levels.current = current;
  entities.level.state.updates = [levels.sequence[current]];
}

gameSystem.setup(entities);
uiSystem.setup(entities);
