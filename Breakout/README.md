# Breakout

A brick breaker for Game Lab with 27 hand-built levels, six power-ups and an endless mode. Plain ES modules and a canvas, no build step.

## Controls

| Action | Touch | Mouse | Keyboard |
| --- | --- | --- | --- |
| Move paddle | Drag anywhere (relative, so your thumb stays clear of the ball) | Move | ← → or A D |
| Launch / release a caught ball | Tap | Click | Space (or ↑ / W) |
| Pause | Pause button | Pause button | P or Esc |
| Mute | Speaker button | Speaker button | M |

Menus work with Tab, arrow keys, Enter and Esc.

## Features

- 27 levels in three acts (Workshop, Twists, Foundry), written as text maps in `src/levels.js`.
- Bricks: tiles (1 hit), plates (2), armour (3), steel (never breaks), charges (clear their 3 x 3 neighbourhood, and chain), and marked bricks that always drop a power-up.
- Power-ups: wide paddle, multi-ball, slow ball, laser, catch, extra life. If the field stalls, a supply drop brings a free multi-ball.
- Combo multiplier (up to ×6) for bricks broken without touching the paddle, plus clear, flawless and spare-ball bonuses.
- Level select with stars (3 for no ball lost, 2 for one, 1 for a clear) and best score per level. Levels unlock in order.
- Endless mode: seeded, mirrored stages that get denser and faster, with an extra ball every third stage.
- Physics: substepped movement (never more than half the ball's radius per step), paddle angle set by the hit position, a minimum vertical speed and an idle nudge so the ball can't loop forever.
- Feel: screen shake (Full, Low or Off; Low by default under reduced motion), particles, ball trail, synthesized sound with a remembered mute.
- Progress, settings and bests are saved through the Game Lab kit (`breakout.*` and `gamelab.best.breakout`).

## Files

- `src/config.js` every tuning value in one table
- `src/levels.js` level maps, reachability check, endless generator
- `src/sim.js` simulation (no DOM)
- `src/bot.js` autopilot for the title demo and level checks
- `src/render.js`, `src/fx.js`, `src/audio.js`, `src/main.js` drawing, effects, sound, screens and input
- `tools/verify-levels.mjs` run `node Breakout/tools/verify-levels.mjs` to check every level is reachable and cleared by the bot

Fonts: Chakra Petch and JetBrains Mono from @fontsource, under the SIL Open Font License (see `fonts/`).
