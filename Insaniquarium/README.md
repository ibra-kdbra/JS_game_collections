# Insaniquarium (web)

A browser version of *Insaniquarium Deluxe* that runs on the original game's own art, sounds, music, fonts and text, taken from your copy of the game. It is for private, local play: keep it on your own computer.

This folder holds only the code. None of the game's files are in it: `tools/convert.py` builds them from your own install (see [Setting up](#setting-up)).

## Setting up

You need Python 3 with Pillow and NumPy, ffmpeg (with libopenmpt, for the music) and Node.js.

```sh
python3 tools/convert.py "path/to/Insaniquarium Deluxe" assets
node tools/build.mjs
```

The first command takes a few minutes. Then open `index.html`.

## Play

Open `index.html` in Chrome, Edge or Firefox; no server or install is needed. It keeps your progress in that browser.

- **Mouse:** click the tank to drop food, click coins to collect them, click aliens to shoot.
  - Hold the button down to keep feeding or firing.
  - Click a missile to destroy it, or to knock Ulysses' missiles back at him.
- **Keys:**
  - `1`–`8` buy from the shop.
  - `P` / `Esc` / `Space` pause.
- **Menu button (top right):** pause, sound, music, restart, main menu.

## The remaster

The art is the original's, remastered, and the gameplay is unchanged.

- **Sprites:** every sprite is upscaled with xBR at 4×, then smoothed down to 2×, so outlines stay crisp. Transparency is scaled separately so there are no fringes.
- **Backgrounds:** JPEG noise is removed first.
- **Fonts:** remastered the same way.
- **Motion:**
  - drawn between game ticks, so it's smooth on 120/144 Hz screens;
  - sprite animations blend frame to frame;
  - fish tilt as they climb and dive.
- **Lighting:**
  - drifting light rays and surface caustics;
  - floating particles and bubble streams;
  - soft shadows on the sand;
  - glowing diamonds, stars, chests and potions;
  - a vignette.
- **Feel:**
  - coins fly to the money counter with a "+$" pop;
  - screen shake when aliens arrive or die;
  - fades between screens.
- **Interface:**
  - the original cursors as real system cursors, with the click point on the tip;
  - bigger coin hit areas;
  - modern shop tooltips that say how much more money you need;
  - a blurred backdrop instead of black bars on wide screens.

## What's in it

| Mode | |
| --- | --- |
| Adventure | Tanks 1–4, five levels each. Every level hatches the next pet: Stinky, Niko, Itchy, Prego, Zorf, Clyde, Vert, Rufus, Meryl, Wadsworth, Seymour, Shrapnel, Gumbo, Blip, Rhubarb, Nimbus, Amp, Gash, Angie, Presto. Then the final battle with Cyrax. Take three pets into each level. |
| Time Trial | Earn as much money as you can in 5 minutes. |
| Challenge | Waves of aliens that get harder, with prices that rise each wave. |
| Virtual Tank | A tank you keep: fish never die, and it saves when you leave. In the Fish Emporium (Menu > Visit Store), trade Shells for money or buy the four bonus pets. |

You earn **Shells** in every mode.

**Characters:**

- **Fish:**
  - Guppy (small, medium and large, plus the star guppy from a star potion)
  - Carnivore
  - Breeder
  - Starcatcher
  - Guppycruncher (makes beetles)
  - Beetlemuncher (makes pearls)
  - Ultravore
- **Aliens:**
  - Sylvester and Balrog
  - Gus: lasers don't hurt him, so feed him until he bursts.
  - Destructor: fires missiles from the sand.
  - Ulysses: deflect his missiles back at him.
  - Psychosquid: don't shoot while he's blue, or he heals.
  - Bilaterus: a chain of bones with a head at each end. Only the heads can be hurt; when one dies, the other takes the lead.
  - Minisylvester, and Cyrax the final boss.
- **Pets:** each of the 20 Adventure pets does what the original's help screen says.
- **Bonus pets:** bought for 2,000 Shells each in the Fish Emporium, then picked like any other pet. What they do is read from the original program:
  - **Brinkley** swims after your food and eats it. Every 3rd pellet comes back as a star, every 15th as a diamond, every 45th as a pearl and every 135th as a treasure chest.
  - **Nostradamus** sneezes out a food pellet every 3–6 s.
  - **Stanley** knocks alien missiles out of the water with balls, and throws a ball at an alien every second.
  - **Walter:** click him and he punches whatever fish or pet is in front of him. A fish drops its coin at once, and a pet uses its power at once.

**Original text:** the alien warnings, hints, help pages and pet descriptions are the original game's own text. They're read from your `Insaniquarium.exe` at the places listed in `tools/strings.json`, so the words themselves aren't in this source.

## The files

- `assets/` holds the converted game files, made by `tools/convert.py` from the install folder (it isn't committed):
  - each image with its transparency mask joined in, in `img/`;
  - a 2× enhanced copy (upscaled and sharpened) in `img2x/`, which the game uses;
  - the bitmap fonts;
  - every sound effect as `.ogg`, with the `.au` files converted;
  - the three music tracks, rendered from the tracker format to `.ogg`;
  - the game text, in `text.json`.
- `js/` is the source:
  - `data.js`: every number;
  - `text.js`: looking up the game text;
  - `tank.js`: the simulation;
  - `view.js`: drawing the tank and shop bar;
  - `main.js`: screens and input;
  - `gfx.js`: sprites and bitmap fonts;
  - `fx.js`: effects;
  - `polish.js`: the remaster's lighting, particles and motion;
  - `sound.js`: audio;
  - `assets.js`: loading.
- `game.js` and `assets/data.js` are built from `js/` by `node tools/build.mjs`. Rebuild after editing anything in `js/`.
- `tools/bot.mjs` plays every level with a simple player and prints the times. Run it with `node tools/bot.mjs` after changing numbers in `data.js`. It clears all 20 levels and the boss, in 1–10 minutes a level.

## Numbers from the original

Most numbers in `data.js` are read from the original program, `Insaniquarium.exe` v1.1. It runs 100 updates a second, so its times are written in its own ticks and converted.

- **Shops:** what each level sells, and the price of every item, egg piece and laser upgrade.
- **Aliens:**
  - which aliens each level sends;
  - their health and speed;
  - 30 s between attacks, and the clock only runs while no aliens are in the tank;
  - the warning time.
- **Laser:** each click does 3 damage per laser level (levels 1–10). Shooting Psychosquid while his shield is up heals him by as much.
- **Gus:** a pellet does 4, 6 or 8 damage by food quality.
- **Hunger:**
  - each fish's fullness counter, and when it gets hungry and starves;
  - how much each food quality fills;
  - fish don't get hungrier while aliens are in the tank.
- **Growth:** guppies need 4–5 growth points to reach medium and 5–9 more to reach large. A pellet gives 1, 2 or 3 points by food quality.
- **Coins:** every coin's value. Fish drop a coin every 2–4.5 s.

## Not the same as the original

- **Estimated numbers:** these are not yet read from the original program:
  - the 20 Adventure pets' timings;
  - the Breeder's birth rate;
  - how often aliens bite;
  - Destructor's and Ulysses' missiles;
  - Cyrax's attacks;
  - Bilaterus's speed, and how often he turns around;
  - the damage of Stanley's balls (8 a hit).
- **Bonus pets:** the original's way of getting them isn't decoded yet. Here they're sold in the Fish Emporium, and the 2,000-Shell price is this version's own.
- **Virtual Tank:** much simpler than the original's (no fish naming, backdrops or screensaver).
