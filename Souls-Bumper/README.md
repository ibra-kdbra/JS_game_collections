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
