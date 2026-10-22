# Tower Defense

A tower defense game in p5.js. Build and upgrade seven kinds of towers, maze the
enemies on random maps or hold the line on hand-made ones.

- **Campaign**: 30 authored waves that introduce one enemy type at a time. Clear wave 30 to win.
- **Endless**: random waves that keep getting tougher.
- **Difficulty**: Easy, Normal or Hard (lives, starting cash, enemy health and the pause between waves).
- **Maps**: 8 random layouts, 8 designed maps, and your own: build one in the
  [map editor](../td-editor/index.html) and press **Play this map**, or paste a map string with **Import map**.

Your best result (waves cleared) is saved per map, mode and difficulty.

### Touch

Pick a tower, tap a tile to see its range, tap the same tile again to build.
Tap a built tower to upgrade or sell it. Designed maps get bigger tiles with the phone held sideways.

### Keyboard and mouse

* Mouse: click a tile to build the selected tower, click a tower to select it
* 1-7: choose a tower to build (Gun, Laser, Slow, Sniper, Rocket, Bomb, Tesla)
* Esc: cancel building / deselect
* Space: start, pause and resume
* T: game speed 1x / 2x / 3x
* N: call the next wave early (bonus cash)
* S: sell the selected tower
* U: upgrade the selected tower
* R: restart
* V: mute sound
* M: import a map string (restarts the game)
* X: export the current map string
* [ and ]: smaller or bigger tiles on random maps (restarts the game)
* Z: default tile size on random maps (restarts the game)

Debug keys: F shows FPS, G toggles god mode, H toggles enemy health bars,
P toggles particle effects, Q stops towers firing, W starts waves back to back.

Libraries (in `vendor/`): p5.js 1.11.2 (LGPL-2.1) and lz-string 1.5.0 (MIT).
Sound credits are in [sounds/README.md](sounds/README.md).
