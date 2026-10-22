'use strict';

// The world is laid out on an 800x600 virtual screen; game.js scales it to fit.
const WORLD_W = 800;
const WORLD_H = 600;

function Cart() {
  this.cam = new Camera();
  this.tips = true;
  this.scale = 2;
  this.cube = 16; // width of tiles
  this.scaled = this.scale * this.cube;
  this.hero = new hero(16, 16, 40 * this.scale, 100 * this.scale, 0, types.HERO, this.scale);
  this.shake = 0;
  this.shakeTime = 0;
  this.levels = [];

  this.genLevel = function(num) {
    this.levels = LEVELS.map((def, i) => {
      const lvl = new level(i, this.scale, 130, def.map);
      lvl.reset();
      return lvl;
    });
    this.setLevel(num);
  };

  this.setLevel = function(num) {
    this.level = this.levels[num];
    this.hero.e.curLevel = num;
    // The surrounding-tiles offsets depend on the level's width.
    const c = this.level.cols;
    this.surTiles = [-1, 1, c - 1, c, c + 1, -c - 1, -c, -c + 1];
    this.hero.reset(this.level);
    this.cam.x = -this.hero.e.x + WORLD_W / 2 - 20;
    this.cam.y = -this.hero.e.y + WORLD_H / 2 - 80;
  };

  this.genLevel(0);

  // Render & Logic
  this.update = function(delta, time, intro = false) {
    // Screen shake
    this.shake = Math.cos(time);

    this.hero.setCurrentTile(this.scaled);

    this.level.draw(this.hero, delta);

    if (intro) return;

    this.hero.update(ctx, delta);

    if (RELOAD) {
      RELOAD = false;
      this.level.reset();
      this.hero.reset(this.level);
      onLevelRestart();
    }

    if (this.hero.doneTime <= 0 && this.hero.changeLevel) {
      this.hero.changeLevel = false;
      const next = this.hero.e.curLevel + 1;
      onLevelComplete(this.hero.e.curLevel);
      if (next < this.levels.length - 1) {
        speak("Level " + (next + 1));
      } else {
        speak("Thank you for playing!");
      }
      this.setLevel(next);
    }
    // Follow hero
    this.cam.x = lerp(-this.hero.e.x + WORLD_W / 2 - 20, this.cam.x, .8);
    this.cam.y = lerp(-this.hero.e.y + WORLD_H / 2 - 80, this.cam.y, .8);
  };
}
