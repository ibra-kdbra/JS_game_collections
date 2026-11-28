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
| **Master** (hard) | Gravity climbs to 20G (pieces fall instantly) by level 4, and the lock delay shrinks every level, from half a second to a quarter. 150 lines to finish. See below | Highest score |

Personal bests are shown in the main menu and on the game over screen.

### Master

| Level | Gravity | Lock delay (steps of 1/60 s) |
| --- | --- | --- |
| 1 | 1/4G | 30 |
| 2 | 1G | 29 |
| 3 | 5G | 28 |
| 4-15 | 20G | 27, 26, 25, 24, 22, 21, 20, 19, 18, 17, 16, 15 |

A move or rotation restarts the lock delay at most 15 times per piece (the guideline's
"move reset"); the count starts over when the piece falls to a lower row than it has been.
The other modes keep tetr.js's rule: every move restarts it, with no limit.

The curve used to be 20G from the first piece, lock delay 30 dropping 1.5 per level to a
floor of 10, and unlimited restarts. Nobody had played it past level 2, so it was measured
with `node Tetris/tools/playtest-master.mjs`: a bot that plays through the real input path
(key events; touch events on the on-screen buttons of an emulated phone) with human timing
profiles, in steps: a fast keyboard player (DAS 6 = 100 ms, ARR 0 or 1, first press 6 steps
after the drop, 4 to switch keys) and a touch player at the buttons' default repeat (DAS 10,
ARR 1, first press 12 steps after the drop, 10 to switch buttons, 9 between taps on one
button), plus a slower touch player (16 and 14). What it found, and what changed:

- **Every move restarted the lock delay, with no limit**, in every mode (tetr.js resets it
  in `moveValid`). Rotating back and forth on the floor never locked, at any level (20 s
  tried). So the time limit is not on the whole placement but on each gap between two
  presses: the first press has to come within lock delay + 1 steps of the spawn, and every
  next one within the lock delay of the last move. Master now caps the restarts at 15; the
  bot never needed more than 5 for one piece.
- **The floor of 10 was too short for the buttons.** Holding a button to a wall waits DAS
  (10 steps) between the first and second move, and pressing Drop after the piece arrives
  takes a reaction. On an empty board the touch player got every piece and rotation to both
  walls (56 of 56) down to lock delay 14, but 48 at 12, 28 at 11 and 5 at 10; the slower one
  failed from 15 down (20 of 56 at 15, none at 12). The keyboard player reached 56 of 56 at
  every level. The floor is now 15 (250 ms), reached at the last level.
- **20G from the first piece was the whole difficulty.** The keyboard bot, with no timing
  trouble at all (no piece locked early, 15+ steps to spare on every piece), topped out at
  level 3 to 8 at 20G (median level 6, 48 lines, 0 of 6 games won). The same bot at 1/64G
  cleared all 150 lines in 6 of 6 games. At 20G a piece cannot climb the stack, so the
  stack's shape decides where pieces can go, from the very first one. Master now gives
  three levels (30 lines) at 1/4G, 1G and 5G to get into it, and is 20G from level 4.

A bot is not a person: these numbers bound the timing, they do not say how 20G feels. The
gravity ramp and the floor are worth a real playtest on a phone.

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

## Checks

- `node Tetris/tools/verify-play.mjs`: a seeded Sprint played with the keyboard clears 40 lines.
- `node Tetris/tools/verify-replays.mjs`: 19 seeded games in every mode replay exactly.
- `node Tetris/tools/verify-dig-race.mjs`: a Dig Race ends once its garbage is cleared, in any order.
- `node Tetris/tools/verify-master.mjs`: at Master's top lock delay every piece can be taken
  from spawn to both walls with the keyboard and with the on-screen buttons, and the move
  reset runs out after 15 restarts (and is still unlimited in Marathon).
- `node Tetris/tools/playtest-master.mjs`: not a check; prints the Master measurements above
  (slow: several minutes per player).
