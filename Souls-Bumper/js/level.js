'use strict';

function level(id, scale, doorDrop, tiles) {
  this.tiles = [];
  this.triggers = [];
  this.mvTiles = [];
  this.roomNo = id;
  this.opendoors = false;
  this.startPos = [0, 0];
  this.doorDrop = doorDrop;
  this.cols = tiles[0].length;
  const tileSize = 16;
  let mvd = 0;

  this.draw = function(hero, delta) {
    this.tiles.forEach(e => e.update(delta));

    if (this.opendoors) {
      this.mvTiles.forEach((d) => {
        d.entity.isSolid = false;
        if (mvd < this.doorDrop) {
          d.entity.y += 2;
          mvd += 1;
        } else if (d.entity.active) {
          cart.shakeTime = .1;
          d.entity.active = false;
        }
      });
    }

    // Falling spike traps drop once the hero passes underneath.
    this.triggers.forEach((t) => {
      if (!t.trigger || t.entity.type != types.DROPY) return;

      if (!t.entity.trapactive) {
        const hx = hero.e.x;
        const hx2 = hero.e.x + (hero.e.width * scale);
        const tx = t.entity.x;
        const tx2 = t.entity.x + (t.entity.width * scale);

        if ((hx > tx && hx < tx2) || (hx2 > tx && hx2 < tx2)) {
          if (hero.e.y - hero.e.height > t.entity.y) t.entity.trapactive = true;
        }
      } else {
        t.entity.y += 15;
      }

      if (rectColiding(hero.e.hb, t.entity.hb)) {
        hero.bloodSplatter(false, hero.e.x, hero.e.y);
        hero.kill();
        t.trigger = false;
        t.entity.active = false;
        t.entity.kills = false;
      } else if (t.entity.y > 1000) {
        t.trigger = false;
        t.entity.active = false;
      }
    });
  };

  this.reset = function() {
    this.tiles = [];
    this.triggers = [];
    this.mvTiles = [];
    this.opendoors = false;
    mvd = 0;
    const ts = tileSize * scale;

    for (let r = 0; r < tiles.length; r++) {
      for (let c = 0; c < this.cols; c++) {
        let t = tiles[r][c] || types.AIR;
        const xx = c * ts;
        const yy = r * ts;
        const trigger = t == types.DROPY;

        if (t == types.HERO) {
          t = types.AIR;
          this.startPos = [xx, yy];
        }
        if (t == types.AIR && rndNo(0, 100) > 95) {
          t = types.BRICK;
        }
        const tile = new Tile(tileSize, xx, yy, 0, t, false, c, r, scale, trigger);
        this.tiles.push(tile);

        if (tile.trigger) this.triggers.push(tile);
        if (t == types.DOOR) this.mvTiles.push(tile);
      }
    }
  };
}
