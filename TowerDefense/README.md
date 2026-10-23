# Tower Defense

A tower defense game in p5.js. Build and upgrade seven kinds of towers, maze the
enemies on random maps or hold the line on hand-made ones.

- **Campaign**: 30 authored waves that introduce one enemy type at a time. Clear wave 30 to win.
- **Endless**: random waves that keep getting tougher.
- **Difficulty**: Easy, Normal or Hard (lives, starting cash, enemy health and the pause between waves).
- **Maps**: 8 random layouts, 8 designed maps, and your own: build one in the
  [map editor](../td-editor/index.html) and press **Play this map**, or paste a map string with **Import map**.

Pick a map, mode and difficulty on the map screen. Winning the campaign earns up to
three stars depending on how many lives you keep; stars and your best wave are shown
per map, mode and difficulty.

The wave panel shows what the next wave brings (new enemy types are marked), a
countdown between waves and a button to send the next wave early for bonus gold.
Select a tower to see its stats, what the upgrade changes, its sell price and
which enemy it targets (First, Last, Strongest or Closest). The menu (Esc) has
sound, damage numbers, health bars, particles and back-to-back waves.

### Touch

Pick a tower, tap a tile to see its range and whether it fits, then tap the same
tile again or press **Build**. Tap a built tower to upgrade, sell or retarget it.

### Keyboard and mouse

* Mouse: click a tile to build the selected tower (you keep building until you
  run out of gold), click a tower to select it, right click to stop
* 1-7: choose a tower to build (Gun, Laser, Slow, Sniper, Rocket, Bomb, Tesla); the same key again puts it away
* Esc: cancel building / deselect, otherwise open the menu
* Space: start, pause and resume
* T: game speed 1x / 2x / 3x
* N: send the next wave early (bonus gold)
* U / S: upgrade / sell the selected tower
* C: change the selected tower's target
* R: restart
* V: mute sound
* M: import a map string (restarts the game)
* X: export the current map string
* [ and ]: smaller or bigger tiles on random maps (restarts the game)
* Z: default tile size on random maps (restarts the game)

Debug keys: F shows FPS, G toggles god mode, H toggles enemy health bars,
P toggles particle effects, Q stops towers firing, W starts waves back to back.

Libraries (in `vendor/`): p5.js 1.11.2 (LGPL-2.1) and lz-string 1.5.0 (MIT).
Weapon sound credits are in [sounds/README.md](sounds/README.md); interface sounds are synthesised with Web Audio.
