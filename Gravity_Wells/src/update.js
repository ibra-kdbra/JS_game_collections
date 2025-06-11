import home from './updates/home.js';
import progress from './updates/progress.js';
import puzzle from './updates/puzzle.js';

const updates = {
  home,
  progress,
  puzzle
};

const process = (entities, ids, time, delta) => {
  ids.forEach(id => {
    let entity = entities[id];
    Object.keys(entity).forEach(component => {
      if (updates[component] !== undefined) {
        updates[component].update(
          entities,
          entity,
          time,
          delta
        );
      }
    });
  });
};

export default Object.freeze({
  process
});