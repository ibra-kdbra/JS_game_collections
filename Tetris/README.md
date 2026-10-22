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

- On-screen pad: move left and right, soft drop (down) and hard drop (up, marked DROP)
- Buttons: rotate counter-clockwise, rotate clockwise, hold and pause
- Gestures on the playfield: drag sideways to move, drag down to soft drop, flick up to hard drop, tap to rotate, double tap to hold

The on-screen buttons press whatever keys you have bound, so they keep working after you change the controls.

## Settings

DAS, ARR, gravity, soft drop speed, lock delay, playfield size, sound and volume, block style, ghost piece, grid, outlines and background theme. Settings and key bindings are saved in the browser.

## How it works

- Game logic runs in fixed 60 Hz steps (DAS, ARR, gravity and lock delay are counted in those steps), so it plays the same on 60 Hz and 120 Hz screens. The clock counts steps too, so it stops while paused and replays show the same time.
- The playfield, hold and preview canvases are drawn at the screen's pixel density. On narrow screens the side panels shrink, and on touch screens the layout leaves room for the controls.
- Replays store the keys pressed on each step together with the random seed.

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
│   ├── responsive.js    touch gestures on the playfield
│   ├── liveBackground.js animated background themes
│   ├── audio.js         sound effects and music (Web Audio)
│   ├── particles.js     line clear sparks
│   └── init.js          loading screen and theme shortcut
├── fonts/               icon font for the menus
├── vendor/fonts/        Source Sans Pro and Lato (SIL OFL), self-hosted
└── imgs/                favicon and background image
```

Open the page with `?debug` to show a frame rate readout.
