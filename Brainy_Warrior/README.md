# Brainy Warrior 3D

A 3D sliding logic puzzle after Coolmath Games' *Brainy Warrior*. Slide the warrior into every enemy without sliding into the sea, and move the wizard to make walls where you need them. Every level has a known optimal solution, and five search algorithms will solve it in front of you.

## Rules

- Each move slides the warrior in a straight line until something stops him.
- Sliding into an **enemy** defeats it. The warrior stops on the enemy's tile.
- A **rock** stops the warrior on the tile in front of it.
- With nothing to stop him, the warrior slides into the **sea** and the level is lost. Undo the move or restart. The island is surrounded by sea, so leaving the map counts as the sea too.
- The **wizard** stands on one of the glowing circles and stops the warrior like a rock. **Magic** sends him to his next free circle, in reading order, and costs one move. He skips a circle that the warrior or an enemy is standing on.
- Defeat every enemy to win. Stars: three for the optimal move count, two for a few moves more, one otherwise. Using a hint caps a clear at two stars. A level the AI solved is unlocked but earns no stars.

### Rule decisions

The Coolmath page describes the core rules: slide until an enemy or a wall stops you, fall into the water otherwise, and press the magic button to move the wizard. The site itself could not be reached from the build environment, so the finer points came from that description and from the C++ reference. Where the two differ, this version follows the original:

| | C++ reference | This version |
| --- | --- | --- |
| Map edge | Stops the warrior like a wall | Sea, since the original island sits in open water |
| Wizard | The warrior lands on the wizard and "uses him up" | The wizard is an obstacle that you reposition with magic |
| Magic | Swaps tile values, which can move the warrior | Moves only the wizard, skipping occupied circles |
| A\* | Weighted heuristic (×50 per enemy), so not optimal | Admissible heuristic, so it always finds the fewest moves |
| UCS | Arbitrary costs per direction (up 1, down 2, ...) | Cost is tiles travelled, so it finds the shortest run |

Two C++ maps needed a fix under these rules. Level 16 has no border and relied on stopping at the map edge, so it gets a rock wall around it, which plays exactly like the C++ version. Level 17 can't be won under any reading of the rules, so it gets one extra rock (row 4, column 4).

## Levels

There are 34 levels: all 17 from the C++ version, 8 from the first 3D version (one redrawn without its swords, a mechanic the original doesn't have), 3 wizard puzzles from v2 and 6 new ones from v3, all found by a solver-driven search and picked by hand. The 3D v1 "Island Ring" was dropped: it was a weaker copy of the opening levels.

### The difficulty curve

The order follows a measured difficulty score, not just the optimal move count. `tools/difficulty.mjs` builds the full state graph of a level and measures:

| Measure | Meaning |
| --- | --- |
| Par | Optimal number of moves (magic counts as a move) |
| Hidden dead ends | Share of the moves along the solution that don't fall into the sea but still lead to a position that can't be won |
| Narrowness | Share of the safe-looking moves along the solution that aren't optimal |
| Solutions | Number of distinct optimal move sequences (fewer is harder) |
| Magic | Fewest magic moves any winning line needs (0 means the wizard is optional) |
| State space | Reachable positions |
| Bot wins | Success rate of a human-like bot over 3,000 seeded attempts. It never slides into open sea, defeats an enemy when it can (3 times in 4), avoids repeating a position, gives up when the game says the level can't be won any more, and has twice par plus four moves |

The score adds these with weights calibrated on the levels (see `SCORE` in the file): about 4 points per optimal move, 16 per factor-of-e drop in the bot's success rate, 20 for a level where every safe-looking move is a dead end, up to 9 for a unique solution, 3 per required spell and 2 per doubling of the state space. Short levels get less credit for a unique or narrow solution, because with one or two moves that is unavoidable.

The ramp: levels 1-3 are easy (score 20 or less) and teach sliding, defeating and the sea; 4-8 are medium and bring in rock walls, more enemies and, at level 8, the wizard; from level 9 on the score only rises (a 2-point tolerance is allowed), through the hard C++ levels and the wizard puzzles to six generated finales of 23 to 30 moves. `verify-levels.mjs` prints this table and fails if the ramp breaks.

| # | Level | Par | Score | Band | Bot wins | Magic | Source |
| ---: | --- | ---: | ---: | --- | ---: | ---: | --- |
| 1 | First Strike | 1 | 18.5 | easy | 87.2% | 0 | C++ 1 |
| 2 | Two Guards | 2 | 12.7 | easy | 100.0% | 0 | C++ 2 |
| 3 | Shoreline | 3 | 17.3 | easy | 100.0% | 0 | C++ 4 |
| 4 | Watchtower | 3 | 20.9 | medium | 96.2% | 0 | C++ 3 |
| 5 | Long Beach | 4 | 23.3 | medium | 97.8% | 0 | C++ 5 |
| 6 | Rock Walls | 4 | 26.2 | medium | 96.6% | 0 | 3D v1 |
| 7 | Corners | 5 | 33.9 | medium | 88.4% | 0 | 3D v1 |
| 8 | The Wizard | 5 | 35.3 | medium | 90.2% | 1 | 3D v1 |
| 9 | The Narrows | 3 | 44.2 | medium | 30.8% | 0 | C++ 6 |
| 10 | Garrison | 5 | 46.2 | medium | 62.3% | 0 | C++ 8 |
| 11 | Crossroads | 5 | 48.7 | medium | 40.2% | 0 | C++ 10 |
| 12 | Rock Maze | 7 | 49.4 | medium | 51.9% | 0 | 3D v1 |
| 13 | Wizard's Wall | 7 | 52.1 | medium | 64.2% | 1 | v3 generator |
| 14 | Arena | 8 | 59.0 | medium | 64.0% | 0 | C++ 13 |
| 15 | Parade Ground | 8 | 62.2 | hard | 71.7% | 0 | C++ 12 |
| 16 | Cliffside | 8 | 62.9 | hard | 37.5% | 0 | C++ 7 |
| 17 | Walled Garden | 10 | 63.0 | hard | 63.8% | 0 | C++ 16 |
| 18 | Hold the Line | 7 | 65.7 | hard | 44.6% | 0 | C++ 14 |
| 19 | Outpost | 10 | 67.5 | hard | 65.8% | 0 | C++ 9 |
| 20 | Courtyard | 11 | 78.3 | hard | 36.0% | 0 | 3D v1 |
| 21 | The Gauntlet | 15 | 80.0 | hard | 40.4% | 2 | v2 generator |
| 22 | Barracks | 11 | 85.6 | hard | 21.2% | 0 | C++ 11 |
| 23 | Stepping Stones | 14 | 86.2 | hard | 33.8% | 2 | v2 generator |
| 24 | The Long Way | 15 | 91.9 | hard | 23.5% | 0 | 3D v1 |
| 25 | Blink | 9 | 92.2 | hard | 12.1% | 3 | 3D v1 |
| 26 | The Horde | 13 | 96.1 | hard | 32.0% | 0 | C++ 15 |
| 27 | Spellbound | 12 | 101.2 | hard | 8.8% | 2 | 3D v1 |
| 28 | The Wizard's Isle | 14 | 113.5 | hard | 7.8% | 6 | C++ 17 |
| 29 | Tower of Tricks | 17 | 144.2 | expert | 0.9% | 4 | v2 generator |
| 30 | The Labyrinth | 24 | 157.0 | expert | 0.0% | 0 | v3 generator |
| 31 | The Long March | 27 | 161.0 | expert | 0.1% | 0 | v3 generator |
| 32 | Spell Lattice | 23 | 170.2 | expert | 0.0% | 5 | v3 generator |
| 33 | The Archmage's Trial | 28 | 178.8 | expert | 0.0% | 5 | v3 generator |
| 34 | The Last Stand | 30 | 183.0 | expert | 0.0% | 4 | v3 generator |

New levels come from `tools/generate-levels.mjs`: it grows island-shaped layouts, hill-climbs them (moving rocks, enemies, the warrior and wizard circles, growing or eroding the coast) towards a higher score or a target score, and keeps the ones with few optimal solutions, required magic and long solutions. Every candidate is one connected island.

Levels are text maps in `js/levels.js` (`~` sea, `.` grass, `#` rock, `P` warrior, `E` enemy, `W` wizard, `w` another wizard circle). Progress is saved by level id, so stars survive the reordering.

## The solver

The search runs in C++ compiled to WebAssembly (`wasm/solver.cpp` → `wasm/solver.wasm`, about 5 KB). It is freestanding C++, with no standard library and static memory, built with plain `clang` and `wasm-ld` (`wasm/build.sh`). No Emscripten is needed. The `.wasm` file is committed, so the site needs no build step.

| Algorithm | What it does |
| --- | --- |
| BFS | Breadth-first. Always the fewest moves. |
| DFS | Depth-first. Finds a solution, usually a long one. |
| UCS | Uniform-cost, where cost is tiles travelled. Finds the shortest run, which is not always the fewest moves. |
| Greedy | Best-first on the heuristic only, like the "hill climbing" in the C++ version. Fast, but not optimal. |
| A\* | Moves so far plus a lower bound on the moves left: the enemies left, plus one if none is in the warrior's row or column. The bound is admissible and consistent, so A\* is optimal and expands far fewer states than BFS. |

In the game the solver powers:

- **Optimal** in the HUD. Each level's `par` is checked against the solver.
- **Hint**, which runs A\* from the current position and lights up the next optimal move.
- **Stuck detection**. After every move, the game checks whether the level can still be won and offers an undo if it can't.
- **Watch the AI**, where you pick an algorithm and see where it searched (a heat map of expanded states), its nodes expanded and generated, path length and time, and then watch it play. **Compare all** puts the five algorithms side by side.

If WebAssembly can't load, `js/solver.js` (a JavaScript BFS over the same rules) takes over for hints and stuck detection.

### Verifying the levels

```sh
node Brainy_Warrior/tools/verify-levels.mjs
```

This runs the WASM BFS and A\* and the independent JavaScript BFS on every level, and checks that all three agree with `par`. It replays every WASM solution through `js/rules.js`, so the C++ and JavaScript rules can't drift apart. It also checks A\* hints against BFS from about 1,500 mid-game positions, spot-checks individual rules, prints the difficulty table and checks the ramp. It exits non-zero on any failure.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Slide | Arrow keys / WASD | Swipe on the board, or the on-screen pad |
| Magic (move the wizard) | Space / E | **Magic** |
| Undo | Z / U / Backspace | **Undo** |
| Restart | R | **Restart** |
| Hint | H | **Hint** |
| Watch the AI | I | **AI** |
| Levels | L / Esc | **Levels** |
| Sound | M | Speaker button |
| Camera | Drag to tilt, scroll to zoom, double-click or C to reset | Two fingers to tilt and pinch to zoom |

Progress (best moves and stars per level) is saved in the browser through the Game Lab kit's `createStore`. Total stars are reported to the hub.

## Graphics

- **Characters** are Quaternius' CC0 models (*RPG Characters* for the warrior and the wizard, *Ultimate Monsters* for three kinds of orc), with their own skeletal animations: the warrior idles, runs while sliding, swings his sword on a hit, falls into the sea and celebrates; enemies idle, taunt now and then, cheer when you fall in and die when hit; the wizard idles and casts. The wizard's hat is modelled in code and rides on his head bone.
- **The island** is generated from the map: bevelled grass and stone tiles with painted textures, rocky cliffs that are pushed in and out by noise, a sand skirt at the waterline, mossy boulders and shrubs on rock tiles, swaying grass and flowers, and palm islets well clear of the board.
- **The sea** is one shader: vertex waves, scrolling normal maps, depth colour from the distance to the shore, breaking foam, sky reflection with Fresnel and a sun glint. A gradient sky dome and fog fade it into the horizon.
- **Light**: a hemisphere light plus a sun with soft shadows, in linear colour with sRGB output. No post-processing.

All ground textures are painted on a canvas at start-up (`js/textures.js`), so the only downloaded art is the five character models.

### The models

`tools/pack-models.py` turns the Quaternius glTF files into `models/*.glb`: it merges every character into one skinned mesh with one material (props the source hangs on bones become vertices bound to that bone, and their textures go into one atlas), drops non-bone nodes and unused clips, and resizes textures. It then runs `gltfpack` from [meshoptimizer](https://github.com/zeux/meshoptimizer) to simplify the meshes (warrior and wizard to 60%, orcs to 45%, which is invisible at board size), quantise them and compress geometry and animation (`EXT_meshopt_compression`). The five files total 376 KB, about 3,000 triangles each. The game decodes them with the vendored meshoptimizer decoder and three.js' `GLTFLoader`. If they can't load, the procedural models in `js/models.js` stand in (`?models=simple` forces that).

## Performance

Budgets, checked by `tools/perf-check.mjs` (headless Chromium through Playwright, every level, at the highest quality tier):

| Budget | Limit | Worst level now |
| --- | ---: | ---: |
| Draw calls per frame (with the shadow pass) | 150 | 32 |
| Triangles per frame (with the shadow pass) | 300,000 | 108,002 |
| Live GPU textures | 32 | 23 |
| Total download | 5 MB | 1.36 MB |
| Character models | 1 MB | 376 KB |
| JS heap after every level | 32 MB | 7.8 MB |

```sh
node Brainy_Warrior/tools/perf-check.mjs   # PLAYWRIGHT=..., CHROME=... if not found
```

How it stays fast:

- **Few draw calls.** Each level's island (tiles, cliffs, skirt, boulders, shrubs, islets) is one merged mesh with one material; grass, flowers and palms are three instanced meshes; each character is one skinned mesh; blob shadows and the AI heat map are instanced. A level costs 10 to 20 draw calls before shadows.
- **Adaptive quality** (`js/perf.js`). Four tiers set the pixel-ratio cap (2, 1.5, 1, 0.8), the shadow map (2048 soft, 1024, 1024, off), whether characters cast real shadows, the water detail (two normal maps, one, or analytic waves) and grass density. Desktop starts on the top tier and phones one below; the game steps down when frames stay above 22 ms and tries one step back up after a long smooth run. `?quality=0..3` pins a tier.
- **Shadows only where needed.** Below the top tier the shadow map holds only the island and is drawn once per level (and while the island drops in); characters stand on soft instanced blob shadows. Characters, grass and water never receive shadows.
- **No per-frame allocations.** The frame loop, tweens, particles, camera and idle animation reuse scratch objects.
- **Disposal and pooling.** Building a level disposes the previous island, masks, rings and overlays; enemy actors are pooled per kind and reused. The geometry count stays flat across all 34 levels.
- **Lazy loading.** The characters load after the page is up, behind a short loading bar; ground textures are generated, not downloaded.
- **Cheap shading.** Lambert materials everywhere (the art is matte), no tone mapping or post-processing pass.

`?perf=1` shows a developer overlay with fps, frame time, CPU time per frame, draw calls, triangles, geometries, textures, shader programs, JS heap, quality tier and pixel ratio.

### Before and after (v2 procedural models vs v3)

Measured in headless Chromium on SwiftShader (CPU rendering, no GPU), same levels and camera, with the shadow pass counted in both. Frame times on SwiftShader say nothing about a phone's GPU, so only compare them with each other.

| | v2 | v3 |
| --- | ---: | ---: |
| Draw calls (First Strike / The Wizard / Parade Ground / The Horde / The Wizard's Isle) | 60 / 91 / 158 / 172 / 119 | 15 / 23 / 29 / 31 / 27 (phone tier: 11 / 16 / 18 / 19 / 19) |
| Triangles, same levels | 13k / 13k / 18k / 18k / 15k | 37k / 41k / 102k / 108k / 61k (phone tier: 22k / 23k / 54k / 57k / 34k) |
| Geometries alive after visiting those levels | 40 then rising to 210 (leak) | 11, then flat at 16 |
| GPU textures | 3 | 10 to 23 |
| JS heap (after GC) | 4 to 5 MB | 6 to 9 MB |
| Download | 783 KB | 1,398 KB |
| SwiftShader frame time, 390x844, phone tier (median, back-to-back runs) | 167 to 333 ms | 183 to 400 ms |

The v2 scene leaked every level's character geometry and spent most of its draw calls on per-part meshes; v3 draws about a fifth as many calls for a much richer scene. On the CPU rasteriser v3 costs 1.0 to 1.5 times as much per frame at the phone tier, mostly per-pixel work on the island and the sea.

## Code

| File | Purpose |
| --- | --- |
| `js/rules.js` | Pure rules: slide, magic, win and loss. No DOM. |
| `js/levels.js` | Level maps and parser |
| `wasm/solver.cpp` | BFS / DFS / UCS / Greedy / A\* in freestanding C++ |
| `js/wasm-solver.js`, `js/solver-client.js` | WASM binding and loader (with the JavaScript fallback) |
| `js/solver.js` | JavaScript reference BFS |
| `js/scene.js` | three.js world: level build, animation, effects, hints, camera, frame loop |
| `js/actors.js` | Loads the character models; animated actor wrapper; the wizard's hat |
| `js/island.js` | Builds a level's island as one merged mesh plus instanced grass, flowers and palms |
| `js/environment.js` | Sea shader, shore mask and sky |
| `js/textures.js` | Ground atlas, rune circle and particle textures, painted at start-up |
| `js/perf.js` | Adaptive quality tiers and the `?perf=1` overlay |
| `js/color.js` | Colour management setup |
| `js/models.js` | Procedural fallback characters |
| `js/audio.js` | Synthesised WebAudio sound effects |
| `js/game.js` | Game flow, input, HUD, dialogs and progress |
| `tools/verify-levels.mjs` | Level, solver and difficulty-ramp checks |
| `tools/difficulty.mjs` | Difficulty measures and score |
| `tools/generate-levels.mjs` | Solver-driven level generator |
| `tools/perf-check.mjs` | Performance budget check |
| `tools/pack-models.py` | Converts the character models (run by hand) |

three.js 0.150.1 is vendored in `vendor/three-0.150.1/` with the `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils` addons from the same release (MIT licence included), and the meshoptimizer decoder in `vendor/meshoptimizer/` (MIT). Everything runs offline, with no CDN and no build step.

## Credits

- Original game: [Brainy Warrior on Coolmath Games](https://www.coolmathgames.com/0-brainy-warrior).
- C++ terminal version, the reference for the 17 levels and the five search algorithms: [susalulmumaO12/cppMiniPrograms](https://github.com/susalulmumaO12/cppMiniPrograms) (`Brainy_Warrior/`).
- Character models: [Quaternius](https://quaternius.com), *RPG Characters* and *Ultimate Monsters*, CC0 (see `models/LICENSE.txt`).
- Model simplification and compression: [meshoptimizer](https://github.com/zeux/meshoptimizer) by Arseny Kapoulkine (MIT).
