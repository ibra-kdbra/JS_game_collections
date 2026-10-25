# Reef Keeper

An aquarium money game in the style of PopCap's *Insaniquarium* (2001), written for Game Lab. The fish, invaders, art, music and sounds are original and all made in code; the only image file is the icon.

## How to play

- **Feed:** click or tap the water to drop food (5 coins). Only hungry fish eat. A hungry fish turns pale green and opens its mouth; leave it too long and it dies.
- **Grow:** a minnow grows as it eats. Medium minnows drop silver coins (15), large ones gold (35).
- **Collect:** click coins before they fade on the sand. A crab picks them up for you.
- **Invaders:** a warning sounds first. While one is in the tank, clicks are shots instead of food. Beat it and it leaves a treasure chest (1,500).
- **Clear the tank:** buy all three pearls.

| Shop | Cost | Effect |
| --- | ---: | --- |
| Minnow | 100 | A new small fish |
| Pike | 1,000 | Eats small minnows, drops gems (200). Tanks 3–4 |
| Food quality | 200, 650 | Pellets, then krill: grow fish faster and keep them fed longer |
| Food count | 300 each | One more piece of food in the water at once (up to 9) |
| Zapper | 800, 2,000, 4,000 | Hits invaders for 2, 4, then 7 instead of 1 |
| Crab | 400 | Collects coins from the sand. Tank 2 on |
| Pearl | 600 to 4,000 | Three clear the tank |

Keys: 1–7 buy from the shop, P pause, M mute.

## Tanks

| # | Tank | Pearls | Invader | Bot time |
| ---: | --- | ---: | --- | ---: |
| 1 | Shallows | 600 | Squid every 2.5 min | 4.1 min |
| 2 | Kelp Forest | 1,200 | Squid, sooner and more often | 5.3 min |
| 3 | Coral Shelf | 2,500 | Squid, more often still | 6.6 min |
| 4 | The Trench | 4,000 | Eel (more than twice the squid's health) | 8.6 min |

Every number is in `src/config.js`. Upgrades are bought fresh in each tank, so any tank can be played on its own once it is unlocked.

## Checks

```sh
node Reef_Keeper/tools/verify.mjs
```

It runs the real game code headless (`src/sim.js` has no DOM):

1. A bot that plays like a reasonable person (`tools/bot.mjs`: five clicks a second, a little off target, feeds the hungriest fish, collects the coins about to fade, shoots invaders, buys in a sensible order) clears every tank with eight seeds, each within 12 minutes.
2. The tanks take longer in order (the bot times in the table above).
3. A slower player (half the clicks) still clears the first tank.
4. Neglected fish starve, and with no fish and no money for a new one the tank is lost: the game ends instead of hanging.

CI runs it from `.github/workflows/smoke.yml`. `node Reef_Keeper/tools/bot.mjs [seeds]` prints the bot's results per tank.

`?speed=N` in the page's address runs the game N times faster, for testing.

## Code

| File | Purpose |
| --- | --- |
| `src/config.js` | Balance: fish, coins, food, upgrades, invaders, tanks |
| `src/sim.js` | Game logic: fish AI, hunger and growth, coins, food, crab, invaders, shop. Pure, no DOM |
| `src/render.js` | Vector art drawn in code: water, light, kelp and coral, fish, coins, invaders, shop icons |
| `src/fx.js` | Bubbles, sparkles and floating coin values |
| `src/audio.js` | WebAudio effects and an original calm loop that turns tense when an invader arrives |
| `src/main.js` | Screens, shop, HUD, input, saving progress |

It uses the Game Lab kit's fixed-step loop, storage and best scores.
