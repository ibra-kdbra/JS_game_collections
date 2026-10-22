# Brainy Warrior 3D

A 3D sliding logic puzzle inspired by the mobile game *Brainy Warrior*. Slide the hero to defeat every enemy without falling into the water.

## Rules

- The hero slides in a straight line until something stops it: a rock wall, a hedge, the wizard, or an enemy.
- Sliding into an **enemy** defeats it and stops the hero on its tile.
- **Armoured enemies** (red, horned) need a sword. Without one they block you like a wall. Each **sword** you slide over is picked up on the way and breaks one armour.
- The **wizard** stands on one of the glowing pads. Teleporting it to its other pad costs a move; it stops the hero like a wall.
- Sliding off the island means a swim: the hero climbs back to where the slide began, and the move doesn't count.
- Clear a level in as few moves as possible. `par` is the optimal number of moves.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Slide | Arrow keys / WASD | Swipe on the board, or the on-screen arrows |
| Teleport wizard | Space / E | **Wizard** |
| Undo | Z / U / Backspace | **Undo** |
| Restart | R | **Restart** |
| Show solution | H | **Show solution** |
| Level select | L | **Levels** |

Progress (unlocked levels and best move counts) is saved in the browser. Clears that used **Show solution** unlock the next level but don't count as a best.

## Levels

There are 14 levels, introducing one idea at a time: water, walls, hedges, swords and armoured enemies, then the wizard, before combining them. Levels are drawn as text in `js/levels.js`.

Every level is verified with the same solver the game uses for **Show solution**: a breadth-first search (`js/solver.js`) over the shared rules in `js/rules.js`, so the in-game hint and the checker can never disagree. Run it from the repo root:

```sh
node Brainy_Warrior/tools/verify-levels.mjs
```

It fails if any level is unsolvable or if its `par` differs from the optimal solution.

## Code

| File | Purpose |
| --- | --- |
| `js/game.js` | Scene, camera fitting, input, UI, progress |
| `js/rules.js` | Pure puzzle rules (slide, wizard, win check) |
| `js/solver.js` | Breadth-first solver for optimal solutions |
| `js/levels.js` | Level maps and parser |
| `js/level.js` | Builds the board and models with procedural (canvas-drawn) textures |
| `js/player.js`, `js/wizard.js` | Hero and wizard animation |

three.js 0.150.1 is vendored in `vendor/three-0.150.1/` (MIT license included) and loaded through an import map, so the game runs offline with no CDN.
