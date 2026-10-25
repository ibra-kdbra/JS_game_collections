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
| 2048 | [gabrielecirulli/2048](https://github.com/gabrielecirulli/2048) | Gabriele Cirulli | MIT |
| 2048 AI players (`js/players.wasm`, `model.bmp`) | n-tuple network after Szubert and Jaśkowski, [Temporal Difference Learning of N-Tuple Networks for the Game 2048](https://www.cs.put.poznan.pl/wjaskowski/pub/papers/Szubert2014_2048.pdf) (2014); strategies described in [ibra-kdbra/Cpp_Projects](https://github.com/ibra-kdbra/Cpp_Projects/tree/main/Atari-Games/2048_AI/strategies) | origin of the compiled build and the weights file is **unknown** | **unknown** |
| Brainy Warrior 3D | Rules and levels follow the mobile game *Brainy Warrior* and the C++ terminal version in [susalulmumaO12/cppMiniPrograms](https://github.com/susalulmumaO12/cppMiniPrograms) (folder `Brainy_Warrior`) | susalulmumaO12 (C++ version) | **unknown** for the C++ version |
| Gravity Wells | [Quinten/black-hole-square](https://github.com/Quinten/black-hole-square), a js13k 2021 entry | Quinten Clause | MIT |
| Hangman | [abdoutech19/hangman-game](https://github.com/abdoutech19/hangman-game) | abdoutech19 | MIT |
| HuggersFight | *Space Huggers* ([KilledByAPixel/SpaceHuggers](https://github.com/KilledByAPixel/SpaceHuggers)), a js13k 2021 entry, on the [LittleJS](https://github.com/KilledByAPixel/LittleJS) engine (v0.74, in `engine/`) | Frank Force | Space Huggers: GPL-3.0. LittleJS: MIT |
| InterLaced | [mdbarr/enmeshed](https://github.com/mdbarr/enmeshed), a js13k 2018 entry | Mark Barr | MIT |
| MoonLDR | [tblazevic/moonlander](https://github.com/tblazevic/moonlander) | Tin Blažević | MIT |
| PacMan | [masonicGIT/pacman](https://github.com/masonicGIT/pacman) (formerly shaunew/Pac-Man), a tribute to Namco's *Pac-Man* and GCC/Midway's *Ms. Pac-Man* | Shaun Williams, Mason Borda | GPL-3.0 |
| PacMan Slasher | [vmikhav/AntiPacMan](https://github.com/vmikhav/AntiPacMan) | Volodymyr Mikhav | MIT |
| Raven | [elliot-nelson/js13k-2018-raven](https://github.com/elliot-nelson/js13k-2018-raven), a js13k 2018 entry | Elliot Nelson | ISC (stated in its `package.json`; the repository has no licence file) |
| ReWire | [jmankopf/js13k-rewire](https://github.com/jmankopf/js13k-rewire), a js13k 2018 entry | Jan Mankopf | MIT |
| Souls Bumper | [tyler6699/js13k2022](https://github.com/tyler6699/js13k2022), a js13k 2022 entry (theme "Death") | tyler6699 | ISC (stated in its `package.json`; no licence file) |
| Tetris | tetr.js (named in `Tetris/README.md`) | Simon Laroche | **unknown** |
| Tower Defense | [selenebun/towerdefense](https://github.com/selenebun/towerdefense) | selenebun | MIT |
| Tower Defense map editor (`td-editor/`) | [selenebun/td-editor](https://github.com/selenebun/td-editor) | selenebun | **unknown** (the repository has no detected licence); `td-editor/LICENSE` here names only ibra-kdbra |
| Tron | [momajd/Tron](https://github.com/momajd/Tron) (the original DOM version; the arena, AI and soundtrack were rewritten here) | momajd | **unknown** (no licence file found) |
| Wahdatio | [monsterkodi/konnekt](https://github.com/monsterkodi/konnekt) (CoffeeScript sources in `Wahdatio/src/`) | monsterkodi | Unlicense |
| Sprite tutorials (`Sprites_Games/*_project`) | Frank's Laboratory JavaScript game development tutorials and their sprite sheets | Frank's Laboratory | assets: **unknown** terms |
| Barrel Tower, Breakout, Snake, Minesweeper, Crate Lab | Written for this collection (Barrel Tower's stages, art, music and sounds are original; only the genre comes from the 1981 arcade games) | ibra-kdbra | MIT |

## Art Lab

| Experiment | Based on | Author | Licence |
| --- | --- | --- | --- |
| LSD | [collidingScopes/liquid-shape-distortions](https://github.com/collidingScopes/liquid-shape-distortions) | collidingScopes | MIT (stated in its README) |
| Particular Drift | [collidingScopes/particular-drift](https://github.com/collidingScopes/particular-drift) | collidingScopes | MIT (stated in its README) |
| Adaptive Fields | [ChevalMonsieur/AdaptiveFlowField](https://github.com/ChevalMonsieur/AdaptiveFlowField) | ChevalMonsieur | **unknown** (its README has a licence section that could not be read) |
| Experimental Math | Probably [thatsKevinJain/flowfields](https://github.com/thatsKevinJain/flowfields) (same `microcan` and `vec` helpers) | thatsKevinJain | **unknown** |
| Flow Fields, Text Fields | Flow-field technique from Frank's Laboratory tutorials (likely) | **unknown** | **unknown** |
| Blossoming Flowers | A CSS animation, origin **unknown** | **unknown** | **unknown** |

## Music and sound

| File | What it is | Source | Licence |
| --- | --- | --- | --- |
| `Art_Lab/LSD/assets/fahrenheitFairEnough.mp3` | "Fahrenheit Fair Enough" by Telefon Tel Aviv (from the file's tags) | Commercial release (Hefty Records, 2001) | **All rights reserved**; no licence to host is known |
| `Hangman/audio/correct.mp3`, `hang.mp3`, `pullup.mp3` | Sound effects | Tags say "Copyright Alan McKinney" | **unknown** |
| `Hangman/audio/rotate.mp3` | Cable winch rotation | salamisound.com (Sebastian Karpp) | Tag says "for non commercial use only" |
| `Hangman/audio/win.mp3`, `lose.mp3`, `wrong.mp3` | Sound effects | **unknown** | **unknown** |
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

## Libraries

| Library | Where | Licence |
| --- | --- | --- |
| three.js | `assets/vendor/three/`, `MoonLDR/vendor/three/`, `Brainy_Warrior/vendor/three-0.150.1/` (with the `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils` addons from the r150 tag in `addons/`) | MIT (licence files included) |
| meshoptimizer decoder | `Brainy_Warrior/vendor/meshoptimizer/` (decodes the compressed character models) | MIT (licence file included) |
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
| Albert Sans, Chakra Petch | `assets/fonts/` |
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
