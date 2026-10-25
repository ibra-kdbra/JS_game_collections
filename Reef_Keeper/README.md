# Reef Keeper

An aquarium money game in the style of PopCap's *Insaniquarium* (2001), written for Game Lab. It follows the original's layout and flow:

- a shop bar of item buttons across the top, with the money box on the right;
- a tank of cartoon fish that grow and drop coins;
- aliens to zap;
- three egg pieces to clear a level;
- pets that hatch from the eggs and help you.

The fish, aliens, pets, art, music and sounds are original and drawn in code. The only files are the icon and two OFL fonts (Luckiest Guy, Balsamiq Sans).

## Modes

| Mode | What it is |
| --- | --- |
| Campaign | 50 levels in five worlds (Shallows, Kelp Forest, Coral Shelf, Shipwreck, The Trench). Up to three stars per level for a fast clear; ten levels hatch pets. |
| Hard | The 50 levels again, with hungrier fish, tougher aliens that come sooner, and dearer eggs. Opens after level 1-10. |
| Endless | No egg: aliens keep coming in bigger, tougher waves. Your best wave and earnings are kept. |
| Free tank | No aliens, no goal, $5,000 to spend. Just enjoy your fish. |

The first level starts with an interactive **tutorial** (feed, wait for a coin, collect it, buy a guppy, upgrade food, buy the egg). It can be replayed from *How to play*. A **New!** card introduces each fish, item, alien and pet the first time it appears. *How to play* also has a codex of everything you have met.

## Characters

| Fish | Cost | |
| --- | ---: | --- |
| Guppy | $100 | Grows as it eats; medium drops silver ($15), large drops gold ($35) |
| Star guppy | $250 potion | A large guppy that drinks a star potion drops stars ($40) |
| Breeder | $750 | Has a baby guppy every 25 s while fed |
| Carnivore | $1,000 | Eats baby guppies, drops diamonds ($200) |
| Leviathan | $5,000 | Eats carnivores, drops treasure chests ($1,500) |
| Starcatcher | $750 | Lives on the sand, eats falling stars, drops diamonds |
| Grubber | $500 | Crawls on the sand dropping grubs (eats food that reaches the sand) |
| Muncher | $600 | Eats grubs, drops pearls ($250) |

| Alien | |
| --- | --- |
| Gobbler | Eats fish; click it again and again to zap it |
| Grinder | Tougher and hungrier |
| Twins | Two small gobblers at once |
| Glutton | Zaps bounce off: feed it until it bursts |
| Bomber | Sits on the sand firing bombs at your fish; zap it and click the bombs to pop them |
| Mirror | Its shield glows now and then, and zapping it then heals it: wait |

| Pet | Hatches in | |
| --- | --- | --- |
| Shelby the snail | 1-5 | Collects coins from the sand |
| Pearl the clam | 1-10 | A $250 pearl every 30 s |
| Puff the pufferfish | 2-5 | Feeds a starving fish now and then |
| Dash the seahorse | 2-10 | Darts out to grab coins in the water |
| Shellsworth the turtle | 3-5 | Slows aliens down |
| Inky the octopus | 3-10 | Inks each alien as it arrives, stunning it |
| Grace the angelfish | 4-5 | Brings a starved fish back to life every minute |
| Sparky the electric eel | 4-10 | Zaps aliens every two seconds |
| Glo the jellyfish | 5-5 | Your fish get hungry 25% slower |
| Pinch the crab | 5-10 | Brings food that reaches the sand back to the top |

You take up to three pets into a level, picked before it starts.

## How to play

- **Feed:** click the water to drop food ($5).
  - Hungry fish turn olive and open their mouths. Starving ones tremble and show a red **!**.
  - You can have three pieces in the water at the start. *MAX FOOD* and *NO MONEY* say why a click didn't drop food.
- **Collect:** click coins before they fade on the sand; they fly to the money box.
- **Aliens:** a siren and *WARNING!* come first. While an alien is in the tank, clicks zap it (each hit knocks it back). Beating one leaves a treasure chest.
- **Shop:** each level stocks the basics (guppy, better food, more food, zapper, egg piece) and up to three featured specials, so the bar holds at most eight buttons. Endless and the free tank page through the rest with **More**. Hover a button to see what it does.
- **Keys:** 1–9 buy from the shop, P pause, M mute.

Every number is in `src/config.js`; levels are built by `buildLevels()` from the five worlds.

## Checks

```sh
node Reef_Keeper/tools/verify.mjs
```

It runs the real game code headless (`src/sim.js` has no DOM).

- **The bot:** `tools/bot.mjs` plays like a reasonable person.
  - It clicks five times a second, a little off target, and takes the pets hatched so far.
  - It feeds the hungriest fish and collects coins.
  - It zaps aliens, feeds gluttons, pops bombs and waits out shields.
  - It buys in a sensible order.
- **Campaign:** the bot clears all 50 levels with two seeds, and the worlds take longer in order (about 4.4, 4.6, 6.0, 7.1 and 7.8 minutes).
- **Hard:** the bot clears all 50 hard levels.
- **Slower player:** a bot with half the clicks still clears level 1-1.
- **Endless:** the bot survives at least three waves.
- **Neglect:** fish that are never fed starve, and with no fish and no money left the level ends (it doesn't hang).
- **Clicks:** clicks always say what happened.
- **Shop and stars:** every shop fits the bar, and every level has a target time.

CI runs it from `.github/workflows/smoke.yml`.

**Other tools:**

- `node Reef_Keeper/tools/bot.mjs [seeds] [normal|hard]` prints the bot's results per level.
- `node Reef_Keeper/tools/pars.mjs` regenerates `src/pars.js`, the target times behind the stars (three stars within 1.25 times the bot's median, two within 1.75 times). Rerun it after balance changes.
- `?speed=N` in the page's address runs the game N times faster, for testing.

## Code

| File | Purpose |
| --- | --- |
| `src/config.js` | Balance and content: fish, coins, food, zapper, aliens, pets, worlds, level builder, endless and free tank |
| `src/pars.js` | Target time per level (generated) |
| `src/sim.js` | Game logic: fish AI, hunger and growth, coins, food, grubs and potions, pets, aliens, bombs, shop. Pure, no DOM |
| `src/render.js` | The 640 × 480 frame: shop bar, money box, tank, every character, coins, effects, tooltips, tutorial hints |
| `src/fx.js` | Ripples, bubbles, stars, floating text, coins flying to the money box, shake |
| `src/audio.js` | WebAudio effects and an original calm loop that turns tense when an alien arrives |
| `src/main.js` | Screens and modes, level select with stars, pet picking, tutorial, New! cards, codex, input and feedback, progress |

It uses the Game Lab kit's fixed-step loop, storage and best scores (the hub shows your total stars).
