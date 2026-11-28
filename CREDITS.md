# Credits

Game Lab collects games and experiments from several sources. Many started as open-source
projects by other people and were then reworked here (touch controls, fixed-step loops, level
select, the shared kit). This file records where each one came from and under which licence,
as far as it could be traced. The repository `LICENSE` (MIT) covers the original work in this
repository; third-party code and assets keep their own licences, listed below.

Entries marked **unknown** could not be traced. Corrections are welcome.

## Games

| Game | Based on | Author | Licence |
| --- | --- | --- | --- |
| 2048 | [qpwoeirut/2048](https://github.com/qpwoeirut/2048), itself based on [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048) | Stanley Zhong; Gabriele Cirulli | MIT (notices in `2048/LICENSE`) |
| 2048 AI players (`js/players.js`, `js/players.wasm`, `model.gz`) | The strategies of [qpwoeirut/2048-solver](https://github.com/qpwoeirut/2048-solver) compiled to WebAssembly, and the weights of its temporal-difference n-tuple network (after Szubert and Jaśkowski, [Temporal Difference Learning of N-Tuple Networks for the Game 2048](https://www.cs.put.poznan.pl/wjaskowski/pub/papers/Szubert2014_2048.pdf), 2014). The wasm is byte-identical to the file served by [qpwoeirut.github.io/2048](https://qpwoeirut.github.io/2048/). The weights are derived from his `model.bmp` (46 MB, the same file as `model_8-6_16_0.000150_1000.dat` in 2048-solver): every weight rounded to a multiple of 16, then stored packed and gzipped in `model.gz` (4.3 MB) by `2048/tools/pack-weights.mjs` | Stanley Zhong | MIT |
| Brainy Warrior 3D | Rules and levels follow the mobile game *Brainy Warrior* and the C++ terminal version in [susalulmumaO12/cppMiniPrograms](https://github.com/susalulmumaO12/cppMiniPrograms) (folder `Brainy_Warrior`) | susalulmumaO12 (C++ version) | **unknown** for the C++ version |
| Gravity Wells | [Quinten/black-hole-square](https://github.com/Quinten/black-hole-square), a js13k 2021 entry | Quinten Clause | MIT |
| Hangman | [abdoutech19/hangman-game](https://github.com/abdoutech19/hangman-game) | abdoutech19 | MIT |
| HuggersFight | *Space Huggers* ([KilledByAPixel/SpaceHuggers](https://github.com/KilledByAPixel/SpaceHuggers)), a js13k 2021 entry, on the [LittleJS](https://github.com/KilledByAPixel/LittleJS) engine (v0.74, in `engine/`) | Frank Force | Space Huggers: GPL-3.0 (text in `HuggersFight/LICENSE`). LittleJS: MIT (`HuggersFight/engine/LICENSE`) |
| InterLaced | [mdbarr/enmeshed](https://github.com/mdbarr/enmeshed), a js13k 2018 entry | Mark Barr | MIT |
| MoonLDR | [tblazevic/moonlander](https://github.com/tblazevic/moonlander) | Tin Blažević | MIT |
| PacMan | [masonicGIT/pacman](https://github.com/masonicGIT/pacman) (formerly shaunew/Pac-Man), a tribute to Namco's *Pac-Man* and GCC/Midway's *Ms. Pac-Man* | Shaun Williams, Mason Borda | GPL-3.0 (text in `PacMan/LICENSE`) |
| PacMan Slasher | [vmikhav/AntiPacMan](https://github.com/vmikhav/AntiPacMan) | Volodymyr Mikhav | MIT |
| Raven | [elliot-nelson/js13k-2018-raven](https://github.com/elliot-nelson/js13k-2018-raven), a js13k 2018 entry | Elliot Nelson | ISC (stated in its `package.json`; the repository has no licence file) |
| ReWire | [jmankopf/js13k-rewire](https://github.com/jmankopf/js13k-rewire), a js13k 2018 entry | Jan Mankopf | MIT |
| Souls Bumper | [tyler6699/js13k2022](https://github.com/tyler6699/js13k2022), a js13k 2022 entry (theme "Death") | tyler6699 | ISC (stated in its `package.json`; no licence file) |
| Tetris | [simonlc/tetr.js](https://github.com/simonlc/tetr.js) | Simon M. Laroche | MIT (notice in `Tetris/LICENSE`) |
| Tower Defense | [selenebun/towerdefense](https://github.com/selenebun/towerdefense) | Amelia Clarke (selenebun) | MIT (notice in `TowerDefense/LICENSE`) |
| Tower Defense map editor (`td-editor/`) | [selenebun/td-editor](https://github.com/selenebun/td-editor) | Amelia Clarke (selenebun) | MIT (its `LICENSE` file; both notices in `td-editor/LICENSE`) |
| Tron | Started from [momajd/Tron](https://github.com/momajd/Tron), a DOM light-cycle game. Everything has been rewritten here since: the canvas arena, rounds, AI, controls and soundtrack. Only the file names (`bike.js`, `board.js`, `view.js`) and the idea are left; a line-by-line comparison finds no shared code beyond braces and two property assignments | momajd (original) | The original has no licence file. No code from it remains |
| Wahdatio | [monsterkodi/konnekt](https://github.com/monsterkodi/konnekt) (the original CoffeeScript sources are there; `Wahdatio/script.js` is the compiled game, edited directly since) | monsterkodi | Unlicense |
| Breakout, Snake, Minesweeper, Crate Lab, Volt Flip | Written for this collection | ibra-kdbra | MIT |

## Art Lab

| Experiment | Based on | Author | Licence |
| --- | --- | --- | --- |
| LSD | [collidingScopes/liquid-shape-distortions](https://github.com/collidingScopes/liquid-shape-distortions) | collidingScopes | MIT (stated in its README) |
| Particular Drift | [collidingScopes/particular-drift](https://github.com/collidingScopes/particular-drift) | collidingScopes | MIT (stated in its README) |
| Adaptive Fields | [ChevalMonsieur/AdaptiveFlowField](https://github.com/ChevalMonsieur/AdaptiveFlowField) (`script.js` is its `main.js` with changes; `font.otf` is the same file) | Justin Hurson (ChevalMonsieur) | **Permission needed.** Its README licence allows personal and commercial use but says "Do not resell or redistribute in any way without the consent of creator Justin HURSON aka @ChevalMonsieur" |
| Experimental Math | [thatsKevinJain/flowfields](https://github.com/thatsKevinJain/flowfields) (confirmed: `script.js` is its `index.js` reworked, and both helper files match it apart from whitespace) | Kevin Jain | Sketch: no licence file in the repository. Helpers `microcan.window.js` and `vec.window.js` are [microcan](https://github.com/francisrstokes/microcan) and [vec-la](https://github.com/francisrstokes/vec) by Francis Stokes: MIT |
| Flow Fields, Text Fields | Flow-field technique from Frank's Laboratory tutorials (likely) | **unknown** | **unknown** |
| Blossoming Flowers | "CSS Blossoming Flowers at Magical Night", [codepen.io/fikkkhdyt/pen/GRGVmOo](https://codepen.io/fikkkhdyt/pen/GRGVmOo) (2022, also in [a gist by the same author](https://gist.github.com/fikkkhdyt/8d6e85fff6a608e990f547e5f8bca889); the same class names and structure) | fikkkhdyt | MIT: public CodePen pens are MIT-licensed unless the author says otherwise ([codepen.io/license/pen/GRGVmOo](https://codepen.io/license/pen/GRGVmOo)) |
| Sprite Lab (`Sprites_Games/`: lessons 1-8 in `*_project`, the page in `index.html` and `lab/`) | The JavaScript game development tutorials by [Franks Laboratory](https://www.youtube.com/c/Frankslaboratory) and their sprite sheets; `lab/dog-run.webp` is the run row cut from lesson 1's `shadow_dog.png`. Phone layouts, touch controls and the lab page were added here | Franks Laboratory | code and art: **unknown** terms |

## Music and sound

| File | What it is | Source | Licence |
| --- | --- | --- | --- |
| LSD soundtrack (`Art_Lab/LSD/js/soundtrack.js`) | An ambient electronic piece generated live with the Web Audio API; no audio file. It replaced a commercial track ("Fahrenheit Fair Enough", Telefon Tel Aviv) that could not be hosted | Written for Game Lab | MIT, with the rest of the repository |
| Hangman sounds (`Hangman/scripts/sounds.js`) | Every effect (guesses, winch, rope, drop, win, lose) generated live with the Web Audio API; no audio files. They replaced seven mp3s that could not be cleared (three tagged "Copyright Alan McKinney", a salamisound.com winch "for non commercial use only", and three of unknown origin); those are still in the git history | Written for Game Lab | MIT, with the rest of the repository |
| `PacMan/sounds/*.mp3` | Sounds from the *Pac-Man* arcade game | Namco (via the upstream project) | Copyright Namco / Bandai Namco |
| `PacMan_Slasher/audio/*.mp3` | Pac-Man-style jingles and effects | Upstream project; original source **unknown** | **unknown** |
| `MoonLDR/audio/*.mp3` | Thruster, alarm, crash, morse | Upstream project; original source **unknown** | **unknown** |
| `TowerDefense/sounds/*.wav` | Weapon sounds | SoundBible and freesoundeffects.com, see [TowerDefense/sounds/README.md](TowerDefense/sounds/README.md) | CC BY 3.0, public domain, or site terms |
| `Sprites_Games/*/audio/boom.wav` | Explosion | Frank's Laboratory tutorial assets | **unknown** |
| Tron soundtrack | Generated in the browser (`Tron/js/audio.js`). The earlier `derezzed.mp3` (Daft Punk, *TRON: Legacy*) was removed from the game, but it is still in the git history | — | — |
| Souls Bumper music | Generated with the Sonant-X player in `js/audio.js` | Marcus Geelnard (player) | zlib licence (in the file header) |
| HuggersFight, ReWire sounds | Generated with [ZzFX](https://github.com/KilledByAPixel/ZzFX) | Frank Force | MIT |
| Hub music circle | Plays YouTube embeds chosen by the visitor or a default playlist. Nothing is hosted here | YouTube | YouTube terms |

## 3D models

| File | What it is | Source | Licence |
| --- | --- | --- | --- |
| `Brainy_Warrior/models/warrior.glb`, `wizard.glb` | Warrior and wizard, animated | *RPG Characters - Nov 2020* by [Quaternius](https://quaternius.com), converted and compressed (see `Brainy_Warrior/models/LICENSE.txt`) | CC0 1.0 |
| `Brainy_Warrior/models/orc.glb`, `orc-skull.glb`, `tribal.glb` | Enemies, animated | *Ultimate Monsters* by [Quaternius](https://quaternius.com), converted and compressed | CC0 1.0 |
| `TowerDefense/models/kenney-tower-defense/` (35 of the kit's models and its palette texture) | Tower Defense's 3D view: map tiles, rocks, crystals, the gate, ammo, selection marker | [*Tower Defense Kit* 2.1](https://opengameart.org/content/tower-defense-kit) by [Kenney](https://www.kenney.nl) (see `License.txt` there) | CC0 1.0 |
| `TowerDefense/models/quaternius/nature/` (rock, flowers) | Tower Defense map details | [*Stylized Nature MegaKit*](https://opengameart.org/content/stylized-nature-megakit) (free version) by [Quaternius](https://quaternius.com), textures reduced | CC0 1.0 |

## Libraries

| Library | Where | Licence |
| --- | --- | --- |
| three.js | `assets/vendor/three/`, `MoonLDR/vendor/three/`, `Brainy_Warrior/vendor/three-0.150.1/` (with the `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils` addons from the r150 tag in `addons/`), `TowerDefense/vendor/three-addons-0.160.0/` (the r160 `GLTFLoader`, `BufferGeometryUtils`, `SkeletonUtils` and the bloom post-processing passes, for the shared r160 build) | MIT (licence files included) |
| meshoptimizer decoder | `Brainy_Warrior/vendor/meshoptimizer/`, `TowerDefense/vendor/meshoptimizer/` (decodes the compressed character models) | MIT (licence file included) |
| GSAP and ScrollTrigger | `assets/vendor/gsap/`, `Hangman/libs/` | GreenSock standard licence (free to use) |
| Font Awesome Free (icon subset) | `assets/vendor/fontawesome/`, `Tetris/fonts/` | Icons CC BY 4.0, fonts SIL OFL 1.1, code MIT |
| p5.js 1.11.2 | `TowerDefense/vendor/` | LGPL-2.1 (licence file included) |
| lz-string 1.5.0 | `TowerDefense/vendor/` | MIT (licence file included) |
| howler.js 2.2.4 | `PacMan_Slasher/js/vendor/` | MIT (licence file included) |
| mp4-muxer 4.3.3 | `assets/vendor/mp4-muxer/` | MIT (licence file included) |
| dat.GUI 0.7.9 | `assets/vendor/dat-gui/` | Apache-2.0 (licence file included) |
| Pickr 1.8.2 | `assets/vendor/pickr/` | MIT (licence file included) |
| LittleJS 0.74 | `HuggersFight/engine/` | MIT |
| Sonant-X | `Souls-Bumper/js/audio.js` | zlib |

Nothing is loaded from a CDN.

## Fonts

All self-hosted fonts are under the SIL Open Font License 1.1 unless noted; each folder carries
its licence file.

| Font | Where |
| --- | --- |
| Albert Sans, Chakra Petch | `assets/fonts/` (also used by Volt Flip) |
| Chakra Petch, JetBrains Mono | `Breakout/fonts/` |
| Martian Mono | `Minesweeper/fonts/`, `Snake/fonts/` |
| Big Shoulders Stencil Display, IBM Plex Mono | `Sokoban/fonts/` |
| Pixelify Sans, VT323 | `Souls-Bumper/vendor/fonts/` |
| Modak | `Art_Lab/LSD/fonts/` |
| Montserrat | `Art_Lab/Adaptive/fonts/` |
| Lato, Source Sans Pro | `Tetris/vendor/fonts/` |
| Audiowide, Orbitron | `Tron/vendor/fonts/` |
| Press Start 2P (Cody "CodeMan38" Boisclair) | `PacMan/font/`, `PacMan_Slasher/css/fonts/` |
| `ARCADE_R.TTF` ("Arcade" font) | `PacMan/font/`: licence **unknown**; the upstream author removed an earlier copy of this font over its licence |
| Clear Sans (Intel) | `2048/style/fonts/`: Apache 2.0 |
| Source Code Pro (Adobe) | `TowerDefense/fonts/`, `td-editor/fonts/` (no licence file shipped) |
| Balsamiq Sans, Luckiest Guy | `Hangman/fonts/` |
| `Art_Lab/Adaptive/font.otf` | **unknown** |
