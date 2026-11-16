# JavaScript Game Collection

![Main Screenshot](assets/imgs/captured.png)

<div style="text-align: center;">
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT">
  </a>
  <a href="https://github.com/ibra-kdbra/JS_game_collections/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/ibra-kdbra/JS_game_collections.svg" alt="GitHub contributors">
  </a>
  <a href="https://github.com/ibra-kdbra/JS_game_collections/stargazers" target="_blank">
    <img src="https://img.shields.io/github/stars/ibra-kdbra/JS_game_collections.svg" alt="GitHub stars">
  </a>
  <a href="https://github.com/ibra-kdbra/JS_game_collections/network/members" target="_blank">
    <img src="https://img.shields.io/github/forks/ibra-kdbra/JS_game_collections.svg" alt="GitHub forks">
  </a>
  <a href="https://jsgamelab.ibrakdbra.me/" target="_blank">
    <img src="https://img.shields.io/github/deployments/ibra-kdbra/JS_game_collections/github-pages" alt="Deployment Status">
  </a>
</div>

**Play it here: [jsgamelab.ibrakdbra.me](https://jsgamelab.ibrakdbra.me/)**

<details>
<summary>Table of Contents</summary>

- [JavaScript Game Collection](#javascript-game-collection)
  - [Overview](#overview)
  - [The Games](#the-games)
  - [Art Lab](#art-lab)
  - [Why Plain JavaScript and the Canvas?](#why-plain-javascript-and-the-canvas)
  - [Getting Started](#getting-started)
  - [Checks](#checks)
  - [Game Development Process](#game-development-process)
</details>

## Overview

A collection of 22 browser games and 8 visual experiments, written in plain **JavaScript**,
**HTML5** and **CSS3**: no framework and no build step. Every page is a static file you can
open from any web server. Every game works on phones (touch controls, phone-sized
layouts) as well as with a keyboard and mouse.

A few games use a small library where it does real work: three.js for the 3D games, p5.js for
Tower Defense, Howler for one game's sound. They are kept in the repository, so nothing is
loaded from a CDN and the site works the same everywhere.

## The Games

| Game | Genre | What it is |
|---|---|---|
| [Tower Defense](https://jsgamelab.ibrakdbra.me/TowerDefense/index.html) | Strategy | 30-wave campaigns and an endless mode on 18 maps, 7 towers that upgrade, bosses. Plays in a lit 3D view (models built in code to match the 2D art, animated on the GPU) or the classic flat view; a 3D/2D button switches. |
| [Brainy Warrior 3D](https://jsgamelab.ibrakdbra.me/Brainy_Warrior/index.html) | Puzzle | Slide your warrior into every enemy without falling into the sea, and move the wizard to make your own walls. 34 levels on a 3D island, each with a solver-proven par. |
| [Volt Flip](https://jsgamelab.ibrakdbra.me/Volt_Flip/index.html) | Arcade | A one-button runner: flip gravity between floor and ceiling. Endless mode plus a 25-level story campaign. |
| [Reef Keeper](https://jsgamelab.ibrakdbra.me/Reef_Keeper/index.html) | Strategy | An aquarium money game: feed your fish, grab their coins, fight off aliens, hatch pets. 100 levels, endless mode and a free tank. |
| [2048 with AI](https://jsgamelab.ibrakdbra.me/2048/index.html) | Puzzle | The tile-merging puzzle with a built-in AI player. |
| [Crate Lab](https://jsgamelab.ibrakdbra.me/Sokoban/index.html) | Puzzle | Sokoban-style crate pushing across 40 original levels with solver-proven pars. |
| [Minesweeper](https://jsgamelab.ibrakdbra.me/Minesweeper/index.html) | Puzzle | Every board solvable by logic, with a daily board, a puzzle ladder, hints and stats. |
| [Gravity Wells](https://jsgamelab.ibrakdbra.me/Gravity_Wells/index.html) | Puzzle | A space puzzle game of 25 puzzles, each solvable within its move limit. |
| [ReWire](https://jsgamelab.ibrakdbra.me/ReWire/index.html) | Puzzle | Drag the cable around the power nodes and plug it in. 22 levels. |
| [Hangman](https://jsgamelab.ibrakdbra.me/Hangman/index.html) | Puzzle | Classic word guessing with word categories and options. |
| [Tetris](https://jsgamelab.ibrakdbra.me/Tetris/index.html) | Puzzle | The block-stacking classic, with options. |
| [Breakout](https://jsgamelab.ibrakdbra.me/Breakout/index.html) | Arcade | Brick breaker with 27 levels, special bricks, six power-ups and an endless mode. |
| [Snake](https://jsgamelab.ibrakdbra.me/Snake/index.html) | Arcade | Classic, Wrap, Zen and daily modes, plus 20 arenas with portals. |
| [PacMan](https://jsgamelab.ibrakdbra.me/PacMan/index.html) | Arcade | The arcade classic, with modes and playgrounds. |
| [PacMan Slasher](https://jsgamelab.ibrakdbra.me/PacMan_Slasher/index.html) | Arcade | Defeat each pacman by drawing its symbol anywhere on screen. |
| [Tron](https://jsgamelab.ibrakdbra.me/Tron/index.html) | Arcade | Light-cycle duels against an AI opponent. |
| [MoonLDR](https://jsgamelab.ibrakdbra.me/MoonLDR/index.html) | Arcade | Land the ship gently, in the spirit of Lunar Lander. |
| [Raven](https://jsgamelab.ibrakdbra.me/Raven/index.html) | Action | Fix a security system while enemies attack only when you aren't looking. 13 levels. |
| [Souls Bumper](https://jsgamelab.ibrakdbra.me/Souls-Bumper/index.html) | Action | A platformer through 14 challenging levels. |
| [HuggersFight](https://jsgamelab.ibrakdbra.me/HuggersFight/index.html) | Action | Fight the empire's outposts on remote planets. |
| [InterLaced](https://jsgamelab.ibrakdbra.me/InterLaced/index.html) | Strategy | A tactical network intrusion and sabotage simulator. |
| [Wahdatio](https://jsgamelab.ibrakdbra.me/Wahdatio/index.html) | Strategy | A 3D strategy game about unity and connection. |

The `Insaniquarium/` folder holds code only: a remaster that runs on the art and sounds from
the player's own copy of the original game, built locally by its `tools/convert.py`. None of
the game's files are in the repository, and it is not published on the site.

[Back to top](#javascript-game-collection)

## Art Lab

Visual experiments, on the hub's [Art Lab](https://jsgamelab.ibrakdbra.me/Art_Lab/index.html)
page: Blossoming Flowers (pure CSS), Flow Fields, Text Fields, Experimental Math, Adaptive
Fields, LSD, Particular Drift, and Sprite Lab (eight sprite and game-loop lessons from
Franks Laboratory).

## Why Plain JavaScript and the Canvas?

1. **Understanding the platform**: building games on the browser's own APIs (canvas, WebGL,
   Web Audio, pointer events) without a framework teaches how they really work.
2. **Performance**: no framework layer between the game loop and the screen, and only the
   code each game needs.
3. **Complete control**: every system (loops, input, collisions, rendering, sound) is written
   for the game it serves, and can be tuned for it.

## Getting Started

To explore and run the games in this collection:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ibra-kdbra/JS_game_collections.git
   ```

2. **Go to the project directory**:
   ```bash
   cd JS_game_collections
   ```
3. **Serve it locally:** the hub and the 3D games use ES modules, which browsers won't load
   from `file://`. Any static server works:
   ```bash
   python3 -m http.server 8000
   ```
   Then open http://localhost:8000.

### Adding or editing a game on the hub

The hub and the Art Lab page are generated from one registry, `assets/js/data.js`.

1. Add an entry to `games` (or `experiments`) with its `slug`, `title`, `href`, `blurb`,
   `genre`, `inputs` and `mobile` flag. Set `mobile: true` only after checking the game at
   phone size with touch.
2. Add a 16:10 thumbnail as `assets/thumbs/<slug>-480.webp` and `<slug>-960.webp`.
3. Re-render the pages so the list works without JavaScript:
   ```bash
   node tools/render-pages.mjs
   ```
   `node tools/render-pages.mjs --check` exits non-zero if the pages are stale.

See [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md) for the roadmap and [CREDITS.md](CREDITS.md) for
the original authors and licences of the games, models, sounds and libraries.

[Back to top](#javascript-game-collection)

## Checks

Every pull request and every push to `main` runs the checks in
[`.github/workflows/smoke.yml`](.github/workflows/smoke.yml), in parallel jobs:

- **Level checks**: each puzzle and level game has a solver or bot that proves every level
  can be won (Brainy Warrior, Crate Lab, Breakout, Snake, Volt Flip, Minesweeper, Souls Bumper,
  Gravity Wells, Reef Keeper, ReWire, Raven, Tower Defense maps, Insaniquarium), and the hub
  pages must match `data.js`.
- **Browser smoke test**: `node tools/smoke.mjs` opens every page at phone and desktop size in
  Chromium and fails on any script error or missing file.
- **Tower Defense**: `node TowerDefense/tools/test-3d.mjs` checks the 3D view (load time, model
  size, draw-call budget, no stalls mid-battle, fallback to Flat), and
  `node TowerDefense/tools/aim-test.mjs` clicks towers during heavy explosions.

The browser checks need Playwright (`npm install --no-save playwright`, then
`npx playwright install chromium`). The workflow file lists the command for every check, to run
any of them locally.

[Back to top](#javascript-game-collection)

## Game Development Process

Each game in this collection is developed following a structured approach:

1. **Concept and design**: define the game's mechanics, objectives and controls, and sketch
   its layout and flow.

2. **Project setup**: a clean folder per game with separate HTML, CSS and JavaScript,
   semantic HTML5 elements and organised assets.

3. **Game logic**: algorithms and data structures for game state, input and rules.

4. **Rendering**, on the canvas, in WebGL, or with plain DOM and CSS art:
   - Drawing shapes and images with the canvas API, or 3D models with three.js.
   - Animating game objects with a fixed-step game loop and animation frames.
   - Collision detection between game entities.
   - The pattern that best fits each game.

   For a guide to the canvas element, see the [MDN Web Docs on the Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API).

5. **Styling with plain CSS**:
   - Responsive layouts for phones and desktops, portrait and landscape.
   - A theme for each game's concept.
   - Animations and transitions for feedback.

6. **Testing and optimisation**: a solver or bot proves the levels can be won, the smoke test
   opens every page on phone and desktop, and code and assets are kept small so games run
   smoothly on modest devices.

[Back to top](#javascript-game-collection)
