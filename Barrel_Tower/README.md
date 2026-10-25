# Barrel Tower

An arcade climber in the spirit of the 1981 barrel-and-girder games, written for Game Lab. A scrap-metal brute has taken a half-built tower; you climb it anyway. The stages, characters, pixel art, music and sounds are all original and drawn or synthesised in code: there are no image or audio files besides the icon.

## How to play

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk | ← → / A D | Pad |
| Climb (at a ladder) | ↑ ↓ / W S | Pad |
| Jump | Space / Z / K / X | **Jump** |
| Pause | P / Esc | Pause button |
| Mute | M | Speaker button |

- You can't steer in mid-air, and a drop of more than 22 px (a little over one hero) is fatal.
- **Hammers** hang above the girders: jump to grab one. For ten seconds it smashes barrels (300) and sparks (500), but you can't climb while you hold it.
- **Broken ladders** (missing rungs) are only for barrels and sparks.
- **Bonus** starts at 5,000 to 8,000 depending on the round and drops by 100 every two seconds. What's left is added when you clear a stage; at zero you lose a life.
- Jumping a barrel scores 100, pulling a rivet 100. An extra life at 10,000 points.

## Stages

| Stage | Goal | Hazards |
| --- | --- | --- |
| The Ramps | Climb six sloping girders to the beacon | Barrels roll down and sometimes take a ladder (more often when you are below). Barrels that reach the fuel drum light it, and each one sets a spark loose that wanders the girders and climbs after you |
| The Lifts | Ride the rising lift, hop to the sinking one, then up to the beacon | Springs bounce along the top girder and drop down the right-hand side; sparks patrol two ledges. Riding a lift off the end of its shaft is fatal |
| The Rivets | Walk over all eight rivets to pull them; the last one brings the brute down | Sparks come out of the vents. A pulled rivet leaves a gap you have to jump |

Round 1 is the ramps and the rivets; from round 2 the lifts come in between. Each round, up to round 5, rolls barrels faster and more often, sends barrels down ladders more often, allows more sparks and makes them quicker, launches springs faster and more often, and speeds up the lifts (`difficulty()` in `src/stages.js`).

## Checks

```sh
node Barrel_Tower/tools/verify.mjs
```

- Each stage has a recorded input run in `tools/runs.json`. It is replayed with the real game code and hazards switched off, and it must clear the stage in every round, so the girders, ladders, rivet gaps and lifts connect. The lifts have one run per round, since they speed up.
- Then every stage is played with hazards on, with random input, for rounds 1 to 5 and four seeds (the hero can't die in this pass). Nothing may throw, and each stage's hazards must appear: barrels and a lit drum, springs, sparks from the vents.

CI runs it from `.github/workflows/smoke.yml`. The runs come from:

- `node Barrel_Tower/tools/route.mjs <stage>` writes a run from a readable route (walk to x, climb, jump); used for the ramps and the rivets.
- `node Barrel_Tower/tools/explore.mjs <stage> [round] [seed] [iterations] [--hazards]` searches for a run, Go-Explore style; used for the lifts. With `--hazards` it plays against the barrels, sparks and springs: it has cleared the ramps and the lifts in round 1 and in round 5.

The verifier also plays the ramps and the rivets with `tools/bot.mjs`, a careful-player bot that follows the route, jumps whatever comes at it along the girder and waits at busy ladders. It must clear each of them at least once in 60 tries in round 1 and in round 5. `node Barrel_Tower/tools/bot.mjs` prints its clear rate per round, a rough difficulty curve:

| Stage | Round 1 | 2 | 3 | 4 | 5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| The Ramps | 42% | 23% | 17% | 13% | 3% |
| The Rivets | 42% | 33% | 20% | 17% | 17% |

(60 tries each. A person who uses the hammers and watches the ladders does better.)

## Code

| File | Purpose |
| --- | --- |
| `src/stages.js` | Stage geometry, stage order per round, difficulty per round |
| `src/sim.js` | Game logic: hero, barrels, sparks, springs, lifts, rivets, scoring. Pure, no DOM |
| `src/render.js` | Draws at 224 × 256 into an offscreen canvas, scaled up with smoothing off |
| `src/sprites.js` | Pixel art as text, baked into canvases |
| `src/fx.js` | Particles, score pop-ups, screen shake |
| `src/audio.js` | WebAudio effects and an original chiptune loop (with a faster hammer tune) |
| `src/main.js` | Screens, HUD, input, game flow, saving the best score |

The game uses the Game Lab kit for its fixed-step loop, storage, best scores and touch controls.
