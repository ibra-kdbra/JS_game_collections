# 2048

This is a clone of the [2048 game](https://github.com/gabrielecirulli/2048), but with a twist: it comes with an AI solver with multiple algorithms.

- **Play** (the default) or **Watch AI** with the toggle above the board.
- Boards of 3×3 (goal 256), 4×4 (goal 2048), 5×5 (goal 4096) and 6×6 (goal 8192), each with its own saved game and best score.
- **Undo** steps back one move, three times per game (also `U` or Ctrl/Cmd+Z), even from the game-over screen.
- **Hint** asks the current AI strategy for a move (also `?`).
- The AI players work on a 64-bit bitboard, so Watch AI and Hint are only available on 4×4.
- Games the AI moves in don't count towards your best score.

For more information on the strategies, check [this](https://github.com/ibra-kdbra/Cpp_Projects/tree/main/Atari-Games/2048_AI/strategies).


## Notes
[model.bmp](/model.bmp) is actually a binary data file (46 MB) for the Machine Learning strategy.
It has a .bmp extension so that GitHub pages will compress it while serving it.
The page shows download progress while it loads.
