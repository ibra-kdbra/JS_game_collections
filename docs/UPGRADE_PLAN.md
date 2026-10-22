# Game Lab Upgrade Plan

A phased plan to take the collection from "a folder of demos" to a polished, mobile-ready
arcade. Each phase ships on its own and leaves the site working. Each phase lands as one or
more PRs that can be reviewed and reverted independently.

The audit behind this plan ran every page in headless Chromium at 390×844 (touch) and
1440×900, and read each game's code. The findings below are the ones it confirmed.

## Guiding rules

- **Vanilla stays vanilla.** No framework or build step for the hub. Each game keeps its
  own engine; we fix and extend rather than rewrite, unless a rewrite is the cheaper fix.
- **Vendor everything that matters.** CDN failures currently leave Hangman on a frozen
  loading screen and Brainy Warrior unable to start. Libraries a game needs to boot live in the repo, with pinned versions.
- **Every game must be playable by touch, or say clearly that it isn't.** The `#Mobile` tag is a
  promise; we only set it after testing on a phone viewport.
- **Time-based simulation.** Game logic advances by elapsed time (fixed-step accumulator),
  never by frames, so 120/144 Hz screens don't double the speed.
- **Namespaced storage.** Every `localStorage` key is `<game>.<key>`; reads are guarded.
- **Keep the identity.** The Cyber Yellow & Obsidian design is the collection's identity. The
  impeccable and UI UX Pro Max checklists are used for accessibility, polish and performance,
  not to restyle it.

## Phase 0: Stop the bleeding (done)

Bugs that were confirmed in a browser and have small, safe fixes.

| Game | Fix |
| --- | --- |
| Tron | Swipe crashed (`handleSwipe` missing on `View`). Difficulty was inverted (Hard never re-planned). Key and click listeners piled up on every replay. |
| HuggersFight | Shipped the LittleJS **debug build**: version/FPS watermark, cheat keys, free camera. Debug and watermark are now off, and the missing doctype is added. |
| PacMan Slasher | All 10 sounds 404'd (`./sound/` vs `audio/`). Added viewport meta, fixed title and credit link. |
| Gravity Wells | Manifest fetch 404'd, so saves went to the key `"undefined Data"`. Moved to `gravity-wells.data` with migration. Removed the stray `linkstyle` text, a dead Hammer.js CDN dependency, and a service worker that could never register. |
| ReWire / Raven | Both saved progress to the same `level` key and overwrote each other. Now `rewire.level` / `raven.level`. |
| InterLaced | `<doctype html>` typo put the page in quirks mode. Unguarded `localStorage` could stop the game from booting. Keys are now namespaced. |
| PacMan, Raven, ReWire, Wahdatio, InterLaced | Missing viewport meta; phones rendered them at 980px. |
| PacMan | Swipes scrolled or bounced the page (`touch-action: none`). Stray `</div>`, `meta names` typo. |
| TowerDefense / td-editor | Font 404 (wrong relative path), editor favicon 404. Space toggled pause *and* re-clicked the focused button, so pause cancelled itself. Removed a byte-identical unused `style.css`. |
| Tetris | Removed a dead Universal Analytics tag that sent data to someone else's account. Removed the commented-out `bg.js`. |
| Art Lab | Removed foreign Umami analytics IDs (LSD, ParticularDrift). Fixed the mp4-muxer path so video export works. Removed a debug overlay that showed raw JS errors to visitors. |
| Sprites #9 | Swipe-down threw `ReferenceError: gameOver`. `touchend` removed the wrong key. |
| Hub registry | Brainy Warrior is hidden until Phase 2 fixes it (it crashed on import and had a missing stylesheet, textures and thumbnail). ReWire's `#Mobile` tag is removed until it has touch input. |

## Phase 1: Hub upgrades and platform

**Goal:** keep the Cyber Yellow & Obsidian identity exactly as designed, and fix what is
underneath it.

**Problems found**
- Cards and the Art Lab showcase were built entirely by JavaScript, so a slow or failed
  script left the page empty.
- Thumbnails weighed up to 5.6 MB (Art Lab), 2.6 MB (Tetris) and 2.3 MB (Adaptive).
- three.js, Font Awesome and the fonts came from CDNs on every visit.
- The service worker cached every response forever under `v1`, including the 46 MB `model.bmp`.
- `cyberpunk.css` imported two files twice; dead code in the hub script.

**What shipped** (branch `upgrade/phase-1-landing-redesign`)

The Cyber Yellow & Obsidian design stays: hero, glass game cards, Art Lab showcase, WebGL
particle background, music circle and feedback modal. The work is underneath it.
- Game cards, the Art Lab showcase and the Art Lab carousel are pre-rendered from
  `assets/js/data.js` by `tools/render-pages.mjs`, so they appear before any JavaScript runs.
  Run it after editing the registry (`--check` for CI).
- Filters: the PC / Mobile row plus a genre row (Arcade, Puzzle, Action, Strategy). Search
  matches word starts. The filter state is kept in the URL and `/` focuses search. A "Continue
  playing" row shows the games recently opened in this browser.
- Thumbnails are the original game images, compressed to 16:10 WebP at two widths (1.1 MB total).
- Fonts (Albert Sans, Chakra Petch), Font Awesome (subset of the icons used, under 6 KB),
  three.js and GSAP are all self-hosted, so no CDN is needed to render the page.
- Particle background: starts after the page loads, falls back to the CSS gradient without
  WebGL, and draws a still frame under `prefers-reduced-motion`.
- Accessibility: skip link, visible focus rings in the theme yellow, labelled icon buttons, a
  keyboard-operable music circle, `aria-pressed` filters, dialog semantics with focus return,
  muted text raised to 4.5:1 contrast.
- Feedback: **fixed a stored XSS** (names and comments from the public API were inserted as
  HTML), and fixed the profanity filter, whose global regex let every second match through.
- Music player: debug logging removed, storage guarded, Escape closes the playlist dialog.
- Service worker v2: versioned shell precache, network-first with a bounded runtime cache
  (300 entries, 5 MB per file), skips range and cross-origin requests, purges the old cache.
- Art Lab palette: leftover purple accents unified to the Cyber Yellow palette.
- Removed: the duplicate CSS imports, the unused lazy-loader, and dead code in the hub script.

**Moved to the start of Phase 2:** the shared game kit below, since each part is only
proven once a game adopts it.

**Shared game kit** (`assets/kit/`, opt-in per game, no build step)
- `storage.js`: namespaced and guarded get/set, best-score helpers the hub can read.
- `loop.js`: fixed-step accumulator with pause on `visibilitychange`.
- `touch.js`: on-screen D-pad, buttons and swipe, emitting the same events as the keyboard.
- `shell.css` + `shell.js`: a consistent "back to Game Lab" bar, pause and mute, plus fullscreen and an orientation hint.

## Phase 2: Game-by-game upgrades (in waves)

Each wave adds the shared kit, fixes responsiveness, adds touch, saves bests, then adds content.

**Wave A: closest to mobile-ready**
- **PacMan**: on-screen D-pad, `#Mobile` tag, move dev folders (`src/`, `mapgen/`, `fruit/`)
  out of the deploy, restore upstream attribution (shaunew/Pac-Man).
- **PacMan Slasher**: delta-time, pause on hidden tab, new glyphs and enemy types per wave,
  combo meter, Howler 2.2.
- **2048**: `width=device-width` (currently fixed at 425), start with AI off and a clear
  Play / Watch AI toggle, a hint button, undo, 3×3 to 6×6 boards, lazy-load the 46 MB model with a progress bar.
- **Gravity Wells**: level-select grid, mute and keyboard, load the 24 component JSONs in
  parallel, credit Black Hole Square (js13k).

**Wave B: layout and loop fixes**
- **Tetris**: stack panels on phones, on-screen buttons, fixed-step loop, devicePixelRatio,
  personal bests, plus Marathon, Ultra and Zen modes.
- **Tron**: canvas renderer (replaces 7,000 `<li>`), responsive intro screens, pause and
  countdown, saved wins, arena sizes and obstacles, boost. Replace the copyrighted track.
- **Souls Bumper**: aspect-correct letterbox scaling, rAF with a clamped delta, touch buttons, level
  select, best deaths per level, fix leaked globals and the never-cleared audio interval, new levels.
- **MoonLDR**: camera frustum fitted to the aspect ratio, HUD disposal, setPixelRatio, touch thrust and rotate,
  procedural terrain per round, difficulty presets, high score.

**Wave C: input model work**
- **TowerDefense**: tile size from the available space, `windowResized`, on-screen sell, upgrade and
  speed controls, a working "Custom" map with editor round-trip, authored waves and difficulty,
  best wave per map.
- **ReWire**: Pointer Events (unlocks mobile), delta-time, DPR, level select, a custom-level share code.
- **Raven**: touch twin-stick mode without pointer lock, DPR, resize, level select with best times, new levels.
- **InterLaced**: tappable terminal (an Enter button and an input that opens the soft keyboard), sound,
  stage select, a MeshCoin shop, a daily seeded challenge.
- **Wahdatio**: unzip the CoffeeScript sources into `src/`, Pointer Events, time-based ticks, bot
  difficulty, attribution (konekt).
- **HuggersFight**: canvas-relative text sizes, touch stick and buttons, title and pause menu, best level.
- **Hangman**: vendor PreloadJS and Parallax (or drop them), local word lists with the API as an
  extra, saved best score, physical keyboard input, empty-list and error recovery, daily word.

**Wave D: rescue and surface**
- **Brainy Warrior**: finish the half-done refactor (Level, Player and slide APIs), procedural
  materials instead of the missing textures, swipe controls, more levels, thumbnail. Then re-list it.
- **Shadow Dog Runner** (Sprites #9): restart, pause, touch actually driving the player, high score. Then list it.
  Group tutorials #1–#8 under a "Sprite lab" entry in Art Lab, crediting Franks Laboratory.
- **Art Lab**: fix Text Fields' aspect and resize, add DPR to Experimental Math, pin the Pickr version,
  credit the collidingScopes forks.

## Phase 3: New games to fill genre gaps

The collection has arcade, puzzle and strategy. It's missing a few short-session staples that
work well on touch:

1. **Breakout / brick breaker** with level packs and power-ups (paddle by pointer).
2. **Snake** with modern modes: wrap or walls, obstacles, daily seed.
3. **Minesweeper** with long-press flagging, no-guess board generation, 3 sizes.
4. **Match-3 or Sokoban-style** puzzle with authored levels.
5. **Endless runner or flappy-style** one-button game.

Each one is built on the shared kit from day one, as the reference implementation.

## Phase 4: Repo hygiene and performance

- Move README-only media out of the deploy (about 50 MB: `ParticularDrift/example.gif` at 24 MB,
  `LSD.gif`, the `Adaptive/result*.png` files, `Wahdatio/img/samples`) into `docs/media/` or
  compressed WebM/WebP.
- Remove deployed source and design files: `*.psd`, `*.pxm`, `*.afdesign`, `engine/build/`,
  `coffee.zip`, `style/*.scss`, unused sprites, and duplicate audio formats.
- Review licenses: third-party music (Tron "Derezzed", the LSD track) and forked games without
  credit. Add a CREDITS file.
- CI: a Playwright smoke test that opens every registered game at phone and desktop size and
  fails on page errors or 404s. Run a link check on `data.js`.

## Tracking

- [x] Phase 0: confirmed bug fixes
- [x] Phase 1: hub and Art Lab upgrades on the original design, service worker, feedback XSS fix
- [ ] Shared game kit (start of Phase 2)
- [ ] Phase 2A · 2B · 2C · 2D
- [ ] Phase 3: new games
- [ ] Phase 4: hygiene, licensing, CI smoke tests
