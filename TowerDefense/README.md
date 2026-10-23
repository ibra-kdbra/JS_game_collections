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

The wave panel shows what the next wave brings, with a picture of each enemy (new
types are marked; tap one to read about it), a countdown between waves and a button
to send the next wave early for bonus gold. The build menu compares towers with
power, range and rate bars. Select a tower to see its stats, what the upgrade
changes (the bars and the upgraded range on the map show it too), its sell price
and which enemy it targets (First, Last, Strongest or Closest). The menu (Esc) has
sound, damage numbers, health bars, particles, screen shake, vibration (phones)
and back-to-back waves. The first game shows a few short tips; they can be skipped
or replayed from the menu.

Arrows on the ground show the way enemies will walk. While you place a tower on
open ground, yellow arrows show the new way they would take.

### Look

Everything is drawn in code, no image files: `scripts/terrain.js` paints each map
once (ground, roads with rounded edges, raised walls, build pads, trees, rocks,
crystals) in one of six looks (Meadow, City, Desert, Frost, Void, Ashlands),
`scripts/art.js` draws the towers (a new silhouette per upgrade), enemies and
effect sprites into one atlas at the current tile size, `scripts/fx.js` runs pooled
particles, beams and shock rings, and `scripts/render.js` draws each frame on a 2D
canvas from those cached pictures. Quality steps down by itself when frames get
slow. Add `?perf=1` to the address (or press F) for frame times, entity counts and
draw calls.

### Touch

Pick a tower, tap a tile to see its range and whether it fits, then tap the same
tile again or press **Build**. While placing, the row of towers in the panel
switches type. Tap a built tower to upgrade, sell or retarget it. Pinch or use the
+ and - buttons to zoom, drag to look around.

### Keyboard and mouse

* Mouse: click a tile to build the selected tower (you keep building until you
  run out of gold), click a tower to select it, right click to stop; wheel to
  zoom, drag to pan when zoomed in
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

Debug keys: F shows performance numbers, G toggles god mode, H toggles enemy health bars,
P toggles particle effects, Q stops towers firing, W starts waves back to back.

Libraries (in `vendor/`): p5.js 1.11.2 (LGPL-2.1) and lz-string 1.5.0 (MIT).
Weapon sound credits are in [sounds/README.md](sounds/README.md); interface sounds are synthesised with Web Audio.
