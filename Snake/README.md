# Snake

Eat, grow, and don't run into anything. Plain ES modules on a canvas, with no build step and no network requests.

## Modes

- **Classic**: the edges are walls. The snake speeds up every 4 foods.
- **Wrap**: leave one edge and you come back through the opposite one.
- **Arenas**: 20 hand-built maps that unlock in order. Reach the target length to clear one. Your best time is saved for each arena.
- **Daily**: one layout and one food order for everyone, built from the UTC date. Your best score is saved for each date.
- **Zen**: no death. If you bite yourself, you lose the tail from that point on.

## Controls

- Arrow keys or WASD steer. Two turns can be queued, so a quick double tap makes a tight U-turn. A turn that would reverse the snake into itself is ignored.
- On a phone, swipe anywhere. Swipe again without lifting your finger to chain turns. You can turn on an on-screen d-pad in Settings.
- P or Esc pauses, M mutes (the setting is remembered), and R watches the last 3 seconds after a crash.

## Items

| Item | Effect |
| --- | --- |
| Pink diamond | +1 length, 10 points |
| Golden star | +3 length, 50 points. It disappears when its ring runs out |
| Cyan capsule | Speed-up for 6 s. Food is worth double while it lasts |
| Violet capsule | Slow-down for 6 s |
| Portal rings | Enter one and you leave from its twin, still heading the same way |

## Files

- `js/config.js` holds every tuning lever: speeds, chances, timers, scores and queue length.
- `js/arenas.js` holds the 20 arenas as 20×20 text maps (`#` wall, `S` start, `1`–`4` portal pairs, an open edge wraps).
- `js/game.js` is the deterministic simulation. It advances in fixed 60 Hz steps, so the speed never depends on the refresh rate.
- `js/bot.js` is the autopilot behind the title-screen demo and the verifier.
- `js/render.js`, `js/audio.js` and `js/main.js` handle drawing, sound synthesized with WebAudio, and the screens, input and layout.
- `tools/verify.mjs` (`node Snake/tools/verify.mjs`) checks that every arena is reachable and can be cleared by the bot, that the daily seed is deterministic, and that the turn, Zen and death rules work.

Uses the shared Game Lab kit in `../assets/kit/`. The font is Martian Mono, from @fontsource/martian-mono and licensed under the SIL OFL 1.1 (`fonts/LICENSE-OFL.txt`).
