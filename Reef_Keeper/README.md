# Reef Keeper

An aquarium money game in the style of PopCap's *Insaniquarium* (2001), written for Game Lab. It follows the original's layout and flow: a shop bar of item buttons across the top with the money box on the right, a tank of cartoon fish below, three egg pieces to clear a level, and a pet that hatches from the egg. The fish, aliens, pets, art, music and sounds are original and drawn in code; the only files are the icon and two OFL fonts (Luckiest Guy, Balsamiq Sans).

## How to play

- **Feed:** click the water to drop food ($5).
  - Hungry fish turn green and open their mouths.
  - Starving ones tremble and show a red **!**.
  - You can have three pieces of food in the water at the start. A click over the limit says *MAX FOOD*, and a click without money says *NO MONEY*.
- **Grow:** guppies grow as they eat. Medium ones drop silver coins ($15), big ones gold ($35).
- **Collect:** click coins before they fade on the sand. Collected coins fly to the money box.
- **Aliens:**
  - A siren and a *WARNING!* come first.
  - While an alien is in the tank, clicks zap it instead of feeding, and each hit knocks it back.
  - Beating it leaves a treasure chest ($1,500).
- **Egg:** buy the three egg pieces to clear the tank. The egg hatches a pet that helps you in every later tank.
- **Keys:** 1–7 buy from the shop, P pause, M mute. Hovering a shop button with the mouse shows what it does.

| Shop | Cost | Effect |
| --- | ---: | --- |
| Guppy | $100 | A baby guppy drops in |
| Food | $200, $500 | Flakes, then pellets, then capsules: fish stay fed longer, and capsules grow them twice as fast |
| More food | $300 each | One more piece in the water at a time (up to 10) |
| Carnivore | $1,000 | Eats baby guppies, drops diamonds ($200). From tank 1-3 |
| Breeder | $750 | Has a baby guppy every 25 s while fed. From tank 1-4 |
| Zapper | $1,000, $2,000, $3,000 | Hits for 2, 3, then 5 instead of 1 |
| Egg piece | $500 to $6,200 | Three clear the tank |

## Tanks and pets

| Tank | Name | Egg piece | Alien | Hatches | Bot time |
| --- | --- | ---: | --- | --- | ---: |
| 1-1 | First Fish | $500 | none | Shelby the snail: collects coins from the sand | 3.5 min |
| 1-2 | Uninvited | $1,650 | Gobbler | Pearl the clam: a $250 pearl every 30 s | 4.4 min |
| 1-3 | Big Teeth | $3,800 | Gobbler, more often | Puff the pufferfish: feeds a starving fish now and then | 4.6 min |
| 1-4 | Nursery | $4,800 | Gobbler, more often still | | 5.2 min |
| 1-5 | The Grinder | $6,200 | Grinder (2.5 times the health) | | 6.6 min |

Every number is in `src/config.js`.

## Checks

```sh
node Reef_Keeper/tools/verify.mjs
```

It runs the real game code headless (`src/sim.js` has no DOM):

1. A bot that plays like a reasonable person clears every tank with eight seeds, each within 12 minutes. The bot is `tools/bot.mjs`: five clicks a second, a little off target, with the pets from the tanks before. It feeds the hungriest fish, collects the coins about to fade, zaps aliens and buys in a sensible order.
2. The tanks take longer in order (the bot times above).
3. A slower player (2.5 clicks a second) still clears the first tank.
4. Neglected fish starve. With no fish and no money for a new one, the tank is lost, so the game ends instead of hanging.
5. Clicks always do something: the first three drop food, the fourth reports the limit, and a click without money says so.

CI runs it from `.github/workflows/smoke.yml`. `node Reef_Keeper/tools/bot.mjs [seeds]` prints the bot's results per tank.

`?speed=N` in the page's address runs the game N times faster, for testing.

## Code

| File | Purpose |
| --- | --- |
| `src/config.js` | Balance: fish, coins, food, zapper, aliens, pets, tanks |
| `src/sim.js` | Game logic: fish AI, hunger and growth, coins, food, pets, aliens, shop. Pure, no DOM |
| `src/render.js` | The 640 × 480 frame: shop bar, money box, tank, fish, aliens, pets, coins, effects, tooltips |
| `src/fx.js` | Ripples, bubbles, stars, floating text, coins flying to the money box, shake |
| `src/audio.js` | WebAudio effects and an original calm loop that turns tense when an alien arrives |
| `src/main.js` | Screens, input, feedback for every action, progress and pets |

It uses the Game Lab kit's fixed-step loop, storage and best scores.
