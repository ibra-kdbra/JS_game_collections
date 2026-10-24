# Tower Defense

A tower defense game in p5.js. Build and upgrade seven kinds of towers, maze the
enemies on random maps or hold the line on hand-made ones.

- **Campaign**: 30 authored waves that introduce one enemy type at a time. Clear wave 30 to win.
- **Endless**: random waves that keep getting tougher.
- **Difficulty**: Easy, Normal or Hard (lives, starting cash, enemy health and the pause between waves).
- **Maps**: 18 campaign maps in order of difficulty, 8 random layouts, and your own: build one in the
  [map editor](../td-editor/index.html) (it can open the campaign maps too) and press **Play this map**,
  or paste a map string with **Import map**.
- **Gold**: enemies pay a bounty, every cleared wave pays (10 + 2 x wave) gold per portal, and
  maps with more portals start with $25 more per extra portal. A Hive's portal closes when its wave ends.

Pick a map, mode and difficulty on the map screen. Winning the campaign earns up to
three stars depending on how many lives you keep; stars and your best wave are shown
per map, mode and difficulty.

The wave panel shows what the next wave brings, with a picture of each enemy (new
types are marked; tap one to read about it), a countdown between waves and a button
to send the next wave early for bonus gold. The build menu compares towers with
power, range and rate bars. Select a tower to see its stats, what the upgrade
changes (the bars and the upgraded range on the map show it too), its sell price
and which enemy it targets (First, Last, Strongest or Closest). Each tower also counts its kills and the damage it has dealt. The menu (Esc) has
sound, screen shake (Off, Subtle or Full; Subtle only shakes for bosses and lost
lives), vibration (phones only), damage numbers, health bars, particles and
back-to-back waves. The shake only moves the picture of the map, never what you
point at: clicks and taps always land on the tile under the pointer. The first game shows a few short tips; they can be skipped
or replayed from the menu.

Arrows on the ground show the way enemies will walk. While you place a tower on
open ground, yellow arrows show the new way they would take.

### Campaign maps

`scripts/maps.js` holds the maps. The first eight are map strings from the editor;
the ten newer ones (Switchback, Twin Rivers, Crossroads, Open Field, Labyrinth, Moat,
Canyon, Bottleneck, Portal Storm, Gauntlet) are drawn as text with `fromText`, one
character per tile. `CAMPAIGN` sets their order and an optional per-map enemy health
(`hp`) for maps that are much harder than their place in the list.

`node TowerDefense/tools/verify-maps.mjs` runs the real game logic in Node with a
simple bot that follows a fixed build list, and fails if any campaign map's routes are
broken or the bot can't win it on Normal. `--rate` also measures each map's margin
(how much more enemy health the bot can take); the campaign order follows it.
`node TowerDefense/tools/aim-test.mjs` (Playwright) clicks towers in a late wave full
of explosions and checks that every click selects the tower under the pointer.

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
