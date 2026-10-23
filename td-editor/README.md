# Tower Defense Map Editor

Map editor for the [Tower Defense](../TowerDefense/index.html) game. Paint tiles with the
mouse or a finger, then press **Play this map** to open it in the game as the Custom map.
**Export map** gives a map string you can share; **Import map** loads one.

It uses p5.js and lz-string from `../TowerDefense/vendor/`.

### Controls

* Mouse or touch: paint the selected tile (drag to paint a line)
* Columns / Rows buttons, or [ and ] (with Shift for rows): change the map size (resets the map)
* Gameplay / Decoration buttons or Spacebar: switch between the gameplay tiles and the decorative display layer
* 0-8 and arrow keys: select tiles to place
* C: clear decorative display tiles
* D: toggle automatically updating the display layer as you draw
* F: fill the map with the selected tile
* L: copy paths to the display layer
* M: import a map string (replaces the map)
* P: pathfind automatically
* Q: erase all pathfinding
* R: reset the map
* S: clear spawnpoints
* U: rebuild the display layer from the regular tiles
* X: export the map string
* Z: return to the default tile size (resets the map)
