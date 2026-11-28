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
The Machine Learning strategy needs the weights of its n-tuple network, which it downloads only when that strategy is picked in AI settings (or when the page opens with it saved as your choice). They ship as [model.gz](model.gz) (4.3 MB): the original 46 MB `model.bmp` with every weight rounded to a multiple of 16 (each moves by at most 8), packed and gzipped. The worker (`js/ai_controller.js`) downloads it with a progress bar, gunzips it with the browser's `DecompressionStream` (Chrome 80, Firefox 113, Safari 16.4 or newer), unpacks it with `js/td0_weights.js` and hands `players.wasm` the model file it asks for, so the wasm is unchanged. Over 1000 seeded games the rounded weights play as well as the original (average score 123812 against 123533; 2048 or better in 96.1% against 96.6%; 8192 in 73.0% against 71.7%). The figures are in `tools/weights-stats.json`.

- `node 2048/tools/pack-weights.mjs <original model.bmp>` regenerates model.gz and measures it (the original is in git history: `git show 6a20afc:2048/model.bmp`).
- `node 2048/tools/verify-weights.mjs` (run in CI) checks model.gz unpacks to the measured model and replays 30 seeded games with the real player; add `--original <file>` to compare every weight with the original.

## Credits

This game is based on [qpwoeirut/2048](https://github.com/qpwoeirut/2048) by Stanley Zhong, a version of [Gabriele Cirulli's 2048](https://github.com/gabrielecirulli/2048) that plays itself. The AI strategies come from his [qpwoeirut/2048-solver](https://github.com/qpwoeirut/2048-solver), compiled to WebAssembly (`js/players.js`, `js/players.wasm`), and `model.gz` holds the weights of its n-tuple network (rounded and compressed from his original `model.bmp`). All of it is under the MIT licence; the notices are in [`LICENSE`](LICENSE).
