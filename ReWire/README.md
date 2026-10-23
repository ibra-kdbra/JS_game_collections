# ReWire

Drag the cable from the power source around every coil and plug it into the
socket on the right. The cable must not cross itself, except between two
isolators, and must not touch a spinning block. Coils wrapped between two
isolators get no power.

Levels 1-16 are the original game. Levels 17-22 were added later and are
meant to be harder than all of them, each one harder than the one before.

## Checking the levels

```
node ReWire/tools/verify-levels.mjs           # CI check: exit 1 on any problem
node ReWire/tools/verify-levels.mjs --routes  # also print one solution per level
```

`tools/solver.mjs` searches every finished cable the game accepts, using the
game's own geometry code, so each level's number of solutions and the size of
its search are exact. `tools/sim.mjs` runs the real game scripts in Node, and
the checker drags the cable along one solution with pointer events until the
level reports done. The difficulty score is `log2(search nodes / solutions)`:
how much trying it takes to find one way through. The checker fails if a
level cannot be played to the end, or if an added level does not score above
the hardest original and above the level before it.

Level data lives in `js/level.js`: each level lists `spools`, `isolators` and
`blocks` as `[x, y, radius]` on the 1280 x 720 stage (radii in steps of 10;
coils and blocks 30-160, isolators 30-80).
