// Import all draw modules
import arrowdown from './draws/arrowdown.js';
import arrowleft from './draws/arrowleft.js';
import arrowright from './draws/arrowright.js';
import arrowup from './draws/arrowup.js';
import bgcut from './draws/bgcut.js';
import blackhole from './draws/blackhole.js';
import blanksquare from './draws/blanksquare.js';
import fillrect from './draws/fillrect.js';
import maintitle from './draws/maintitle.js';
import neutronstar from './draws/neutronstar.js';
import progress from './draws/progress.js';
import text from './draws/text.js';
import tunnel from './draws/tunnel.js';
import xsquare from './draws/xsquare.js';

// Import all transform modules
import mask from './transforms/mask.js';
import position from './transforms/position.js';

const draws = {
  arrowdown,
  arrowleft,
  arrowright,
  arrowup,
  bgcut,
  blackhole,
  blanksquare,
  fillrect,
  maintitle,
  neutronstar,
  progress,
  text,
  tunnel,
  xsquare
};

const transforms = {
  mask,
  position
};

const process = (entities, ids, ctx, time, delta) => {
  ids.forEach(id => {
    let entity = entities[id];
    ctx.save();
    ctx.scale(
      entities.game.canvas.zoom,
      entities.game.canvas.zoom
    );
    Object.keys(entity).forEach(component => {
      if (transforms[component] !== undefined) {
        transforms[component].transform(entities, entity, ctx, time, delta);
      }
    });
    Object.keys(entity).forEach(component => {
      if (draws[component] !== undefined) {
        draws[component].draw(entities, entity, ctx, time, delta);
      }
    });
    ctx.restore();
  });
};

export default Object.freeze({
  process
});