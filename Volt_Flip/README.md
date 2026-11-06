# Volt Flip

A one-button endless runner with a story campaign. The courier runs along a corridor and every tap flips gravity, so it falls to the other rail and keeps running. Plain ES modules on a canvas, with no build step and no network requests.

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

## Campaign

Endless is the main mode; **Campaign** is the second button on the title screen. The grid went dark at 02:14 and the courier carries the last charge uptown to the relay tower, told in a few lines per chapter on skippable chapter cards (tap, Space or Esc continues; the map's Story button shows a card again).

Five chapters of five fixed, hand-built levels. Each chapter brings in one thing and ends with a harder finale:

| Chapter | New | Levels |
| --- | --- | --- |
| 1 Brownout | flips, spikes and holes (teaches the controls) | First Current, Both Rails, Mind the Gap, Live Wire, Blackout Run |
| 2 Pylon Yards | pylons | Switchyard, Zigzag, Cable Ladder, Tall Order, Yard Master |
| 3 Drone Quarter | drones and sweepers | Night Market, Patrol Hours, Hover Lane, Sweepers, The Hive |
| 4 Shutter Line | shutters | Gatehouse, Metronome, Double Gate, Rush Hour, Last Train |
| 5 The Uplink | tunnels, everything at speed | Broken Rails, Hillside, Overload, Storm Line, Relight |

- Every level is a run to a finish line (the chequered uplink gate). You start it with a shield charged.
- Three stars per level: reach the uplink, collect at least 80% of the level's shards, and finish without breaking the shield. Stars add up across tries.
- Clearing a level opens the next. Stars, best shards, clears and tries are saved in this browser (`volt-flip.campaign`).
- A level starts with a 3-2-1 count-in under its name and goal. Pause, mute, the pause on a hidden tab and the count-in on resume work as in endless. After a level: Next level, Retry or Map; after a fall: Retry or Map.
- Levels speed up from 230 to 430 units per second and the room per forced flip shrinks from 0.6 s to 0.24 s across the campaign (endless ends at 480 and 0.17 s).

## Scoring

- 1 point per metre, 25 per volt shard and 15 per close call, all times the multiplier.
- Eight shards or close calls in a row raise the multiplier, up to ×5. Missing a row of shards lowers it by one.
- Shield cell (cyan): takes one hit or throws you back out of a hole, and resets the multiplier.
- Magnet (violet): pulls nearby shards in for 7 s.
- Your best score and furthest distance are saved in this browser.

## Files

- `js/config.js` holds every tuning lever: physics, speed and margin ramps, unlock distances, scores and pickups.
- `js/levels.js` holds the campaign as data: chapters, story lines and each level as a list of one-line segments (`'spike F 2 *'`, `'hole C 160 *'`, `'drone 70 1.8 0.25'`, `'shutter 1.2 F 0.6'`, `'run 0.4'` ...). The segment language is described in `buildLevel()` in `js/course.js`; every obstacle is followed by one flip plus the level's margin of room, and drone and shutter phases are given at the moment the courier arrives. `js/progress.js` reads and writes the saved progress.
- `js/course.js` builds the endless course from patterns, sized from the current speed so every forced change of side leaves one flip plus the margin.
- `js/sim.js` is the deterministic simulation. It advances in fixed 60 Hz steps, so the speed never depends on the refresh rate.
- `js/bot.js` is the look-ahead autopilot behind the title-screen demo and the verifier.
- `js/render.js`, `js/audio.js` and `js/main.js` handle drawing (canvas at the device pixel ratio, up to 3), sound synthesized with WebAudio, and the screens, input and layout.
- `tools/verify.mjs` (`node Volt_Flip/tools/verify.mjs`) checks that seeds build the same course, that the flip, buffer and hole rules work, that the bot survives 4000 m on every seed with no shield, and prints the difficulty ramp. For the campaign it checks every level's spacing, that the look-ahead bot finishes each one without a hit, that a shard-seeking version earns all three stars in one run, and prints a casual bot's finish rate per level and chapter (with its shield); it fails if chapter 1 is not easy, a chapter is easier than the one before, or a finale is not its chapter's hardest level. `--campaign` runs only the campaign part.

Uses the shared Game Lab kit in `../assets/kit/` and the hub's self-hosted Chakra Petch and Albert Sans fonts in `../assets/fonts/` (SIL OFL 1.1).
