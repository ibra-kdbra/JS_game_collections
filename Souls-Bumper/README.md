# Souls Bumper

A vanilla JavaScript platformer created for the JS13k Game Jam #11.

## Theme

**Death**

## Description

Every death leaves your soul behind as a solid block. Use it as a bridge over spikes, a step up a wall or something to wall-jump off, then rewind it along the path you took to use it again. Fourteen levels, from a first gap to the tower.

Pick any level you have unlocked from the level select. Your best time and fewest deaths for each level are saved, along with your best time for a full run from level 1.

## Controls

- **[A][D]** or **[←][→]**: Move Left / Right
- **[W]**, **[Space]**, or **[↑]**: Jump
- **[E]**: Rewind Ghost
- **[R]**: Reset the level · **[Esc]**: Pause
- **[M]**: Music on/off · **[T]**: Tips on/off

On a phone or tablet, use the on-screen pad and the Jump, Soul, Reset and Pause buttons. Tap a level to start.

## Code

Plain scripts, no build step. `js/levels.js` holds every level map (one number per tile, see `js/enums.js`). The game advances in fixed 20 ms steps on the shared Game Lab loop and pauses when the tab is hidden; the 800x600 world is scaled to fit the screen with letterboxing.

## Level tools

All of them run the real game scripts headlessly in Node (`tools/sim.mjs`).

- `node Souls-Bumper/tools/verify-levels.mjs` replays the recorded run of every level (`tools/runs.json`) and then all of them back to back from level 1.
- `node Souls-Bumper/tools/map.mjs <n>` prints a level as text.
- `node Souls-Bumper/tools/explore.mjs <n> [--no-death] [--no-rewind] [--from "<run>"]` searches for a run that clears a level. With `--no-death` or `--no-rewind` it shows whether a level can be done without the soul or without [E].
- `node Souls-Bumper/tools/levels-report.mjs` prints a difficulty table for every level and fails when a level that declares `needs: ["soul", "rewind"]` in `js/levels.js` can be cleared without it. It runs several searches per level, so it takes a while (about half an hour with the default budget).
