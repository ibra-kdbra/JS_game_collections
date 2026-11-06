# Volt Flip

A one-button endless runner. The courier runs along a corridor and every tap flips gravity, so it falls to the other rail and keeps running. Plain ES modules on a canvas, with no build step and no network requests.

## Playing

- Tap anywhere, click, or press Space (or Up, Down, W, S, Enter) to flip. You can flip only from a rail; a tap up to 0.12 s before landing is kept and flips you on touchdown, and you still get 0.07 s after running off an edge.
- P or Esc pauses, M mutes (the setting is remembered). Switching tabs or windows pauses the run, and it resumes with a short count-in.
- The run speeds up from 260 to 480 units per second, and the room left between forced flips shrinks from 0.46 s to 0.17 s beyond the flip itself.

## The corridor

| Thing | What to do | From |
| --- | --- | --- |
| Spikes | Be on the other rail | 0 m |
| Holes (red caps on a rail) | Don't run into one | 0 m |
| Zigzags | Spikes on alternating rails | 120 m |
| Pylons | Tall spikes: don't flip into them | 220 m |
| Drones | Patrol the middle of the corridor on a dotted track: don't flip into them | 420 m |
| Shutters | Burn one half of the corridor, pause, then burn the other half | 700 m |
| Tunnels | Holes on alternating rails | 950 m |
| Combos | Holes, shutters, pylons and spikes mixed, or drones over long spike strips | 1250 m |
| Sweepers | Double-ringed drones whose track reaches the rails | 1700 m |

## Scoring

- 1 point per metre, 25 per volt shard and 15 per close call, all times the multiplier.
- Eight shards or close calls in a row raise the multiplier, up to ×5. Missing a row of shards lowers it by one.
- Shield cell (cyan): takes one hit or throws you back out of a hole, and resets the multiplier.
- Magnet (violet): pulls nearby shards in for 7 s.
- Your best score and furthest distance are saved in this browser.

## Files

- `js/config.js` holds every tuning lever: physics, speed and margin ramps, unlock distances, scores and pickups.
- `js/course.js` builds the endless course from patterns, sized from the current speed so every forced change of side leaves one flip plus the margin.
- `js/sim.js` is the deterministic simulation. It advances in fixed 60 Hz steps, so the speed never depends on the refresh rate.
- `js/bot.js` is the look-ahead autopilot behind the title-screen demo and the verifier.
- `js/render.js`, `js/audio.js` and `js/main.js` handle drawing (canvas at the device pixel ratio, up to 3), sound synthesized with WebAudio, and the screens, input and layout.
- `tools/verify.mjs` (`node Volt_Flip/tools/verify.mjs`) checks that seeds build the same course, that the flip, buffer and hole rules work, that the bot survives 4000 m on every seed with no shield, and prints the difficulty ramp.

Uses the shared Game Lab kit in `../assets/kit/` and the hub's self-hosted Chakra Petch and Albert Sans fonts in `../assets/fonts/` (SIL OFL 1.1).
