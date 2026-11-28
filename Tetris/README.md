# Tetris

A guideline-style Tetris in plain JavaScript and canvas, based on [tetr.js](https://github.com/simonlc/tetr.js) by Simon M. Laroche (MIT, see `LICENSE`): hold, ghost piece, a seven-piece bag with a six-piece preview, SRS wall kicks, replays and fully adjustable handling.

## Modes

| Mode | Goal | Personal best |
| --- | --- | --- |
| **Sprint** | Clear 40 lines | Fastest time |
| **Marathon** | Play through levels 1-15. Every 10 lines the level and the gravity go up | Highest score |
| **Ultra** | Score as much as you can in 2 minutes | Highest score |
| **Dig Race** | Clear 10 rows of garbage | Fastest time |
| **Zen** | No gravity and no game over: if the stack tops out, the board is cleared and you carry on | - |
| **Survival** (hard) | Garbage rows rise from the floor, every 9 seconds at first and every 2.2 seconds at the end, each with one hole that usually stays in the same column. The level and gravity go up every 20 seconds. A meter along the floor fills up before each row rises | Longest time |
| **Master** (hard) | Pieces fall instantly (20G) from the first piece, and the lock delay shrinks every level, from half a second to a sixth. 150 lines to finish | Highest score |

Personal bests are shown in the main menu and on the game over screen.

### Scoring (Marathon, Ultra and Master)

- Single 100, double 300, triple 500, Tetris 800
- T-spins (a T rotated into place with three of its four corners blocked): 400 with no lines, then 800, 1200 and 1600 for a single, double and triple. A T-spin mini scores 100, 200 or 400
- Back-to-back: a Tetris or a T-spin that clears lines, right after another one, scores 1.5 times
- Combo: every clear right after another clear adds 50 × the combo count
- All clear: emptying the whole board adds 800, 1200, 1800 or 2000 for a single, double, triple or Tetris
- Everything is multiplied by the level. Soft drop: 1 point per row, hard drop: 2 points per row

T-spins, combos, back-to-backs and all clears are called out in every mode, and the game over screen shows a results card: time, score, level, lines, pieces, pieces per second, Tetrises, T-spins, best combo (and garbage rows in Survival).

## Controls

### Keyboard (rebindable under Controls)

| Key | Action |
| --- | --- |
| ← → | Move |
| ↓ | Soft drop |
| Space | Hard drop |
| X / Z | Rotate clockwise / counter-clockwise |
| Shift | Rotate 180° |
| C | Hold |
| R | Retry |
| Esc | Pause (the game also pauses when you leave the tab) |
| T | Cycle background themes |

### Touch

Gestures work anywhere on the game:

| Gesture | Action |
| --- | --- |
| Tap | Rotate clockwise |
| Two-finger tap | Rotate counter-clockwise |
| Drag sideways | Move one cell for every cell dragged |
| Drag down | Soft drop, one row for every cell dragged |
| Flick down | Hard drop (also after a sideways drag, in one motion) |
| Flick up, or tap the Hold box | Hold |

On-screen buttons sit below the board in portrait and on both sides in landscape: hold, soft drop, left and right under the left thumb; drop and both rotations under the right thumb. Held buttons repeat with your DAS and ARR settings. Pause is next to the stats. The buttons can be switched off under Settings (Buttons), which gives the board more room.

## Settings

DAS, ARR, gravity, soft drop speed, lock delay, playfield size, on-screen buttons, sound and volume, block style, ghost piece, grid, outlines and theme. Settings and key bindings are saved in the browser.

## Themes

A theme changes the animated scene behind the game and the colours of everything in front of it (cards, board, accent, buttons, menus) together. Change it under Settings or press **T**.

| Theme | Scene |
| --- | --- |
| **Rain** (default) | Rain on a night window over the city: falling rain at two depths, drops that cling to the glass and run down it, lightning now and then |
| **Obsidian** | The Game Lab's yellow on black, with tetromino outlines drifting down |
| **Aurora** | Northern lights over a starry sky and a dark ridge |
| **Synthwave** | A striped sun setting over a neon grid that rolls towards you |
| **Code Rain** | Columns of falling green glyphs |

Cleared rows flash (brighter for a Tetris or a T-spin), hard drops leave a short streak, the board's edge pulses when the level goes up, and it glows red while the stack reaches into the top rows. The scenes react to play too: clearing lines brightens them, and a Tetris sets off lightning in Rain and sends a ring out in Obsidian. They run at up to 60 frames a second at a capped pixel density, stop while the tab is hidden, and hold still if the system asks for reduced motion.

Blocks come in six styles; **Modern** (rounded tiles lit from above) is the default, and Shaded, Solid, Glossy, Arika and World are still there.

## How it works

- Game logic runs in fixed 60 Hz steps (DAS, ARR, gravity and lock delay are counted in those steps), so it plays the same on 60 Hz and 120 Hz screens. The clock counts steps too, so it stops while paused and replays show the same time.
- The playfield, hold and preview canvases are drawn at the screen's pixel density, capped at 2x. With a keyboard and mouse the board sits between two cards, Hold and the stats on the left and Next on the right, sized in cells with room around the pieces; on narrow screens the cards shrink. On touch screens the board is sized to fit around the buttons and the safe areas; tall phones get the hold box and stats in a strip above the board. Layout runs once per frame at most while the window is resized or rotated.
- Replays store the keys pressed on each step together with the random seed, and the touch gestures applied on each step.

## Files

```
Tetris/
├── index.html
├── css/                 style.css (game) and screen.css (loading screen, effects)
├── scripts/
│   ├── tetris.js        game state, modes, scoring, loop, layout and drawing
│   ├── piece.js         active piece: movement, rotation, gravity, locking
│   ├── stack.js         playfield and line clears
│   ├── hold.js          hold slot
│   ├── preview.js       seven-piece bag and next queue
│   ├── menu.js          menus, settings, key bindings, saving, touch controls
│   ├── responsive.js    touch gestures and on-screen buttons
│   ├── liveBackground.js themes: the animated scenes and the interface colours
│   ├── audio.js         sound effects and music (Web Audio)
│   ├── particles.js     line clear sparks
│   ├── fx.js            row flashes, drop streaks, board pulses, the Survival meter
│   └── init.js          loading screen and theme shortcut
├── fonts/               icon font for the menus
├── vendor/fonts/        Source Sans Pro and Lato (SIL OFL), self-hosted
└── imgs/                favicon and background image
```

Open the page with `?debug` to show a frame rate readout.
