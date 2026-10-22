# Crate Lab

A box-pushing puzzle in the Sokoban tradition for Game Lab. Steer the lab bot, push every crate onto a pad, and try to match par: the fewest pushes possible, proven by a solver.

Play: `Sokoban/index.html`. It is served as static files with no build step. The level file is fetched, so open it over http, for example `python3 -m http.server` from the repository root.

## Levels

There are 40 original levels in [`levels/crate-lab.xsb`](levels/crate-lab.xsb), in standard XSB text, spread over four worlds of ten:

1. **Intake** teaches one idea per level: pushing, walking round, corners, dead ends and making room.
2. **Storage** uses hand-drawn rooms built around one idea each: a parking bay, a pocket pad, a 2x2 block, a dead-end shelf and two lanes.
3. **Sorting** has three and four crates in larger rooms.
4. **Night Shift** has four and five crates, ending with a 42-push finale.

Each level has a `Title`, `World`, `Par` (optimal pushes) and an `Idea` line, which the game shows as the level brief.

None of the levels come from the classic collections. World 1 was drawn by hand. The later rooms were designed by hand or sketched with a small generator, and `tools/design.mjs` then placed the crates by pulling them backwards from the solved position to find the starts that need the most pushes.

## Tools

```sh
node Sokoban/tools/verify-levels.mjs              # CI check: exit 1 on any problem
node Sokoban/tools/verify-levels.mjs --solutions  # also print a LURD solution per level
node Sokoban/tools/verify-levels.mjs --cross      # re-solve with pruning off to confirm the pars
node Sokoban/tools/design.mjs rooms.xsb --top 3   # hardest starts for draft rooms
```

The verifier runs a breadth-first search over pushes. Dead-square and freeze-deadlock pruning keep it fast. It checks every level for these things:

- the level parses
- the crate and pad counts match
- the level is solvable
- `Par` equals the optimal number of pushes
- the solution replays correctly

All 40 levels verify in about 2 seconds.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Move | arrows, WASD | d-pad, swipe |
| Walk to a tile | | tap or click it (never pushes) |
| Push a crate in a line | | drag the crate |
| Undo | Z, U, Backspace | Undo (hold to rewind) |
| Restart | R (Undo brings the attempt back) | Restart |
| Levels / prev / next | L, [ , ] | grid button |
| Mute | M | speaker button |

## Features

- Undo is unlimited and works on whole actions: one undo reverts a whole walk or drag.
- The HUD shows the move counter, the push counter and par.
- Each level earns up to two stars, one for solving it and one for matching par. Par is optimal, so you cannot beat it.
- An optional warning puts red stripes on crates that can no longer reach a pad (dead squares and frozen crates).
- After a level is cleared, the complete screen lets you replay your solution at 1x, 2x or 4x.
- Sounds are synthesized with WebAudio, and the mute setting is remembered.
- The game respects `prefers-reduced-motion`.
- It uses the Game Lab kit: `initShell`, `createLoop` (moves tween in fixed steps), `createStore('sokoban')` and `recordBest('sokoban', levelsSolved)`. The kit's d-pad and buttons appear on touch screens.

## Files

- `index.html`, `css/style.css`: the page
- `js/main.js`: input, the loop, menus, progress and replay
- `js/puzzle.js`: rules, grouped undo, path finding and deadlock hints, with no DOM code
- `js/render.js`: canvas renderer, sharp at any devicePixelRatio
- `js/audio.js`: synthesized sound
- `fonts/`: Big Shoulders Stencil Display and IBM Plex Mono, self-hosted from @fontsource under the SIL Open Font License (licenses included)
