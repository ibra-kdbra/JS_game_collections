# Gravity Wells

Theme: SPACE

Clean up all the other squares in the universe. Just tap them and see what happens.
Swipe right to reset a puzzle or go back to the old ones. Swipe left to skip a puzzle.

25 puzzles. The grid button (top right) lists them all with the ones you have
solved; the speaker button mutes the music. Keyboard: left/right arrows go to the
previous/next puzzle, R or Enter resets, M mutes, L opens the puzzle list.

Each puzzle's move limit equals its shortest solution (two older puzzles,
snatch and swivel, allow a little slack).

`node Gravity_Wells/tools/verify-puzzles.mjs` solves every puzzle with the game's
move rules and checks the move limits. It also rates each puzzle by the chance
that random taps clean the board, and checks that every puzzle added to the
original 18 is harder than the one before it. It takes a few minutes (the
largest puzzles have millions of reachable boards).
