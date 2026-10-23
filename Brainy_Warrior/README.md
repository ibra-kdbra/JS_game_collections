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

There are 29 levels: all 17 from the C++ version, 9 from the first 3D version (one redrawn without its swords, a mechanic the original doesn't have), and 3 new wizard puzzles found by a solver-driven search and picked by hand. They are ordered by measured difficulty: optimal length, plus BFS nodes expanded, plus average branching.

| # | Level | Optimal moves | Source |
| ---: | --- | ---: | --- |
| 1 | First Strike | 1 | C++ 1 |
| 2 | Two Guards | 2 | C++ 2 |
| 3 | Shoreline | 3 | C++ 4 |
| 4 | Island Ring | 3 | 3D v1 |
| 5 | The Narrows | 3 | C++ 6 |
| 6 | Watchtower | 3 | C++ 3 |
| 7 | Rock Walls | 4 | 3D v1 |
| 8 | Long Beach | 4 | C++ 5 |
| 9 | The Wizard | 5 | 3D v1 |
| 10 | Corners | 5 | 3D v1 |
| 11 | Garrison | 5 | C++ 8 |
| 12 | Rock Maze | 7 | 3D v1 |
| 13 | Crossroads | 5 | C++ 10 |
| 14 | Cliffside | 8 | C++ 7 |
| 15 | Blink | 9 | 3D v1 |
| 16 | Spellbound | 12 | 3D v1 |
| 17 | Hold the Line | 7 | C++ 14 |
| 18 | Arena | 8 | C++ 13 |
| 19 | Walled Garden | 10 | C++ 16 |
| 20 | Courtyard | 11 | 3D v1 |
| 21 | The Long Way | 15 | 3D v1 |
| 22 | Outpost | 10 | C++ 9 |
| 23 | Barracks | 11 | C++ 11 |
| 24 | Parade Ground | 8 | C++ 12 |
| 25 | The Wizard's Isle | 14 | C++ 17 |
| 26 | The Gauntlet | 15 | new |
| 27 | Stepping Stones | 14 | new |
| 28 | Tower of Tricks | 17 | new |
| 29 | The Horde | 13 | C++ 15 |

Levels are text maps in `js/levels.js` (`~` sea, `.` grass, `#` rock, `P` warrior, `E` enemy, `W` wizard, `w` another wizard circle).

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

This runs the WASM BFS and A\* and the independent JavaScript BFS on every level, and checks that all three agree with `par`. It replays every WASM solution through `js/rules.js`, so the C++ and JavaScript rules can't drift apart. It also checks A\* hints against BFS from about 1,200 mid-game positions, and spot-checks individual rules. It exits non-zero on any failure.

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

## Code

| File | Purpose |
| --- | --- |
| `js/rules.js` | Pure rules: slide, magic, win and loss. No DOM. |
| `js/levels.js` | Level maps and parser |
| `wasm/solver.cpp` | BFS / DFS / UCS / Greedy / A\* in freestanding C++ |
| `js/wasm-solver.js`, `js/solver-client.js` | WASM binding and loader (with the JavaScript fallback) |
| `js/solver.js` | JavaScript reference BFS |
| `js/scene.js` | three.js world: island, shader water with shore foam, shadows, animation, particles, camera |
| `js/models.js` | Procedural low-poly warrior, goblins, wizard and rocks |
| `js/audio.js` | Synthesised WebAudio sound effects |
| `js/game.js` | Game flow, input, HUD, dialogs and progress |
| `tools/verify-levels.mjs` | Level and solver checks |

three.js 0.150.1 is vendored in `vendor/three-0.150.1/` (MIT licence included). Everything runs offline, with no CDN, no asset downloads and no build step.

## Credits

- Original game: [Brainy Warrior on Coolmath Games](https://www.coolmathgames.com/0-brainy-warrior).
- C++ terminal version, the reference for the 17 levels and the five search algorithms: [susalulmumaO12/cppMiniPrograms](https://github.com/susalulmumaO12/cppMiniPrograms) (`Brainy_Warrior/`).
