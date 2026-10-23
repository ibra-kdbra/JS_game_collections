# Tetris

A guideline-style Tetris in plain JavaScript and canvas, based on tetr.js: hold, ghost piece, a seven-piece bag with a six-piece preview, SRS wall kicks, replays and fully adjustable handling.

## Modes

| Mode | Goal | Personal best |
| --- | --- | --- |
| **Sprint** | Clear 40 lines | Fastest time |
| **Marathon** | Play through levels 1-15. Every 10 lines the level and the gravity go up | Highest score |
| **Ultra** | Score as much as you can in 2 minutes | Highest score |
| **Dig Race** | Clear 10 rows of garbage | Fastest time |
| **Zen** | No gravity and no game over: if the stack tops out, the board is cleared and you carry on | - |

Personal bests are shown in the main menu and on the game over screen.

### Scoring (Marathon and Ultra)

- Single 100, double 300, triple 500, Tetris 800, all multiplied by the level
- Back-to-back Tetrises score 1.5 times
- Soft drop: 1 point per row, hard drop: 2 points per row

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

DAS, ARR, gravity, soft drop speed, lock delay, playfield size, on-screen buttons, sound and volume, block style, ghost piece, grid, outlines and background theme. Settings and key bindings are saved in the browser.

## How it works

- Game logic runs in fixed 60 Hz steps (DAS, ARR, gravity and lock delay are counted in those steps), so it plays the same on 60 Hz and 120 Hz screens. The clock counts steps too, so it stops while paused and replays show the same time.
- The playfield, hold and preview canvases are drawn at the screen's pixel density, capped at 2x. On narrow screens the side panels shrink. On touch screens the board is sized to fit around the buttons and the safe areas; tall phones get the hold box and stats in a strip above the board. Layout runs once per frame at most while the window is resized or rotated.
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
│   ├── liveBackground.js animated background themes
│   ├── audio.js         sound effects and music (Web Audio)
│   ├── particles.js     line clear sparks
│   └── init.js          loading screen and theme shortcut
├── fonts/               icon font for the menus
├── vendor/fonts/        Source Sans Pro and Lato (SIL OFL), self-hosted
└── imgs/                favicon and background image
```

Open the page with `?debug` to show a frame rate readout.
