# Minesweeper

Minesweeper where luck never decides the game. Every board can be cleared by logic from the first click. Plain ES modules, no build step and no network requests.

## Play

| | Mouse | Touch | Keyboard |
| --- | --- | --- | --- |
| Reveal | Left click | Tap | <kbd>Space</kbd> / <kbd>Enter</kbd> |
| Flag | Right click | Hold about 350 ms (with a short vibration), or switch the Reveal/Flag toggle | <kbd>F</kbd> |
| Chord | Both buttons, middle click, or click a finished number | Tap a finished number | <kbd>C</kbd> (or <kbd>Space</kbd> on a number) |
| Move cursor | | | Arrow keys |
| Hint / undo / new game | Buttons | Buttons | <kbd>H</kbd> / <kbd>U</kbd> / <kbd>N</kbd> |

- **Boards:** Beginner 9×9/10, Intermediate 16×16/40, Expert 30×16/99, and Custom (width 5–50, height 5–40, up to width × height − 9 mines). Custom input is checked as you type, and you get a warning when no-guess may fail at that density.
- **Daily:** a 16×16/40 board seeded by the UTC date, so everyone gets the same one. The start is already open.
- **Puzzles:** a ladder of 12 fixed boards. Each level is bigger, denser or needs more pair logic than the one before, and the starting area is capped so early levels are not half solved before you move. Clear a level to unlock the next.
- **Hint** (+10 s) lights up one cell that logic proves safe, and outlines the numbers that prove it.
- **Undo** (+15 s, once per game) takes back the click that set off a mine.
- **Stats** for each board: games, wins, best time, and current and longest streak. Best times for Beginner, Intermediate, Expert and Daily also go to the hub through `recordBest`.
- **Settings:** no-guess on or off, question marks, turning wide boards upright on tall screens, and sound. Settings and mute are remembered.
- The clock stops while the tab is hidden or a dialog is open.

## How no-guess works

`js/solver.js` reads the board the way a player does:

1. **Single:** a number with no mines left around it makes all of its hidden neighbours safe. A number with as many mines left as hidden neighbours makes all of them mines.
2. **Pair:** for two numbers A and B that share cells, if A's remaining mines minus B's equals the number of cells only A touches, those cells are mines and the cells only B touches are safe. Subset reasoning is the case where A touches no cells outside B.
3. **Global:** the mine counter. If no mines are left, every hidden cell is safe. If the mines left equal the hidden cells, every one is a mine.

`js/generator.js` keeps the 3×3 around the first click clear, so the first click always opens an area. It then plays the board with the solver. When the solver gets stuck, the generator moves one mine from the stuck edge into cells nobody has seen yet and tries again, up to 40 times, before it starts over. This repair step keeps Expert fast.

`node Minesweeper/test/solver.test.mjs [n]` builds n boards per preset (default 200), plays each from its first click, and fails if any board needs a guess or the solver ever marks a cell wrongly. It also checks the daily seed and the puzzle ladder. A typical run:

| Preset | avg | median | p95 | max | attempts/board |
| --- | --- | --- | --- | --- | --- |
| Beginner | 0.1 ms | 0.1 ms | 0.4 ms | 2.6 ms | 1.09 |
| Intermediate | 0.5 ms | 0.3 ms | 1.9 ms | 6.6 ms | 1.26 |
| Expert | 4.7 ms | 3.6 ms | 12.5 ms | 27.8 ms | 2.13 |

Custom boards measured on 30×16 still generate in under 0.5 s at 32 % mines. A 50×40 board starts to run out of the 1.5 s budget above about 24 %. When that happens the game says so and deals a normal board instead.

## Why a DOM grid and not canvas

An Expert board has only 480 cells, so the DOM is fast enough. The DOM also gives sharp text at any devicePixelRatio and zoom level for free, CSS for every cell state, per-cell animations through the Web Animations API, and normal hit-testing for pointer events. Turning Expert upright on a phone only means swapping each cell's `grid-row` and `grid-column`. The board scrolls and zooms inside its own container (zoom slider, or pinch on touch). The page itself never scrolls.

## Tuning

All the numbers you might want to change are in `js/config.js`: presets, custom limits, generation budget and repairs, hint and undo penalties, long-press time, cascade timing, cell size limits, and the puzzle ladder (`pair` = minimum rounds of pair logic, `open` = largest share of safe cells the start may reveal).

## Look and accessibility

- Obsidian field with Cyber Yellow instruments. The font is Martian Mono (self-hosted, SIL OFL 1.1, see `fonts/OFL.txt`), taken from `@fontsource/martian-mono` 5.3.0.
- Numbers do not rely on hue alone. 1 and 2 use medium weight. 3 and up are heavy. 4, 5 and 6 sit inside a square, circle and diamond, and 7 and 8 sit on solid and striped chips.
- Every text colour has at least 4.5:1 contrast on its background. Number colours on open cells range from 7.4:1 to 17:1.
- The cascade reveal and the mine animations switch off under `prefers-reduced-motion`.
- Sound is synthesized with WebAudio (`js/audio.js`). There are no audio files.

## Files

```
index.html        markup and dialogs
css/style.css     all styling
js/config.js      tuning levers
js/solver.js      constraint solver (pure)
js/generator.js   safe-first-click and no-guess generation (pure)
js/game.js        rules, clock, hint, undo (no DOM)
js/main.js        UI, input, layout and zoom, dialogs
js/stats.js       per-board statistics
js/audio.js       synthesized sound
js/rng.js         seeded PRNG for daily and puzzle boards
test/             node test for the generator and solver
fonts/            Martian Mono woff2 and licence
```
