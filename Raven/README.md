# Raven

## Description

In this 2D top-down action-puzzle game, the security cameras for a secret facility have been taken offline, and it is YOUR job to fix the problem. Take on a series of floors overrun by mysterious enemies known only as "Raven" -- although harmless as long as you can see them, they are deadly if you turn your back.

Use your mouse or touchpad to look around, and W/A/S/D or the arrow keys to move. Space or Enter uses terminals and Esc pauses. On a phone or tablet, drag with your left thumb to move and your right thumb to look; on-screen buttons pause and use terminals.

The game has 13 levels. Pick any level you have reached from **Select Level**, which also shows your best clear time for each one. Volume is in the start and pause menus.

## Making levels

Levels are drawn in [Tiled](https://www.mapeditor.org/) (`levels/level*.json`, tileset `levels/raven.tsx`). Names, hints and intro text live in `Level_MetaData_Packer/level-metadata.js`. The packer in `Level_MetaData_Packer/level-packer.js` merges both into `js/LevelCache.js`; it needs Node.js and the `glob` package.

## Checking the levels

```
node Raven/tools/verify-levels.mjs              # CI check: exit 1 on any problem
node Raven/tools/map.mjs 11                     # print a level as text
node Raven/tools/search-runs.mjs 11 --seeds 3   # find a new clearing run
```

`tools/sim.mjs` runs the real game logic in Node with a fixed 1/60 s step.
Every level has a recorded input run in `tools/runs.json` (keys held, where
the crosshair points, when the terminal key is pressed); the checker replays
it and the level must be cleared without dying. The runs were found by the
search bot in `tools/bot.mjs`: it walks to each terminal and the exit, turns
its line of sight to whatever Raven could reach it unseen (scored with the
game's own attack code), and when it dies it rewinds a little and tries other
moves. The checker also prints, per level, how many Raven were awake at once,
the pressure (Raven-seconds of awake Raven not held by a camera), how long they
charged, how close they came, and how many deaths the search needed. The
score is pressure + 10 x most awake at once; levels 11-13 (added later, the
first ten are the original game) must score above all of levels 1-10 and
rise in order.

## Postmortem

### Inspiration

As implemented in the game, the Raven are very similar to the infamous [Weeping Angels](http://tardis.wikia.com/wiki/Weeping_Angel), although my original idea was actually based on the similar [SCP-173](http://www.scp-wiki.net/scp-173). Either way, I knew that I wanted my game to be heavily based on what you were looking at, with your line of sight being your only "weapon" against creatures that were very dangerous when you weren't looking at them.

Overall I'm pretty pleased with how it turned out! The enemy behavior in certain corner cases could use some love, and you can imagine some extra stuff that would spice the levels up (security cameras that move, terminals that open doors instead of turning on cameras, enemies that patrol even after spotting you, better "pack attacks" - intentionally splitting up to cover more attack angles, etc.). Of course, if the enemy evolved, the player would need to evolve too -- maybe by having a mobile "partner" they could toss onto the ground that can look around a corner for a few seconds, or adding a sprint button...


## References

I couldn't have made this game without the following stellar resources. They may be of help to you on your own games:

* [Pointer Lock and First Person Shooter Controls](https://www.html5rocks.com/en/tutorials/pointerlock/intro/)

Useful and very thorough introduction to the Pointer Lock API. (Some of the notes on compatibility are now outdated, but otherwise still aces.)

* [2d Visibility](https://www.redblobgames.com/articles/visibility/)

Like every other tutorial on Red Blob, this one is super cool, and in some ways his little demos are the inspiration for this game. Actually, almost everything in this game can be traced back one of Amit's articles (ray casting, path finding, etc.).

* [Grid pathfinding optimizations](https://www.redblobgames.com/pathfinding/grids/algorithms.html)

Speaking of Amit's articles... To be honest, very little of the the advice in this article is implemented in this game, as time and space (ie lines of code) were not on my side. But I did reference this article frequently while working on the enemy AI, and if I ever work on the game post-competition, the enemies could probably get much smarter.

* [Line intersection and its applications](https://www.topcoder.com/community/data-science/data-science-tutorials/geometry-concepts-line-intersection-and-its-applications/)

Math resource (does a line intersect with another line?).

* [Accurate point in triangle test](http://totologic.blogspot.com/2014/01/accurate-point-in-triangle-test.html)

Math resource (is a point within a known triangle?).

* [Even-odd rule](https://en.wikipedia.org/wiki/Even%E2%80%93odd_rule)
* [How to check if a given point lies inside a polygon](https://www.geeksforgeeks.org/how-to-check-if-a-given-point-lies-inside-a-polygon/)

More math resources; two different explanations of the same algorithm for determining if a point lies within a polygon. (I find that this comes up a lot, and not just in games either, so it's a nice tool to have at your fingertips).

* [Tiled Map Editor](https://www.mapeditor.org/)

I used Tiled to create all of the levels for this game, and overall I was pretty pleased. I have to say it wasn't a perfect match, some of the things I wanted to do regarding enemies and cameras and terminals felt kind of difficult to do, but I think that was my experience level more than the tool itself.

I ended up implementing a relatively serious post-processing step for the Tiled levels, to get them compact enough to include in the final app bundle, and this is where I merge in the rest of my level metadata as well.

* [miniMusic](https://xem.github.io/miniMusic/)

A small and simple music generator for the Web Audio API. The music for this game was composed on the "advanced" miniMusic composer. I ended up making a lot of changes to the generated javascript, but the original audio snippet came right from Maxime's generator.

* [Web Audio, the ugly click and the human ear](http://alemangui.github.io/blog//2015/12/26/ramp-to-value.html)

Excellent article that gives a couple ways to prevent oscillator "clicks". Your ears will thank you.

* [AdvanceCOMP](http://www.advancemame.it/download)

Additional compression tools that are quite nice for a competition like this (it's linked to on the js13kgames resources page as well). My experience is that the imagemin tool is already quite good, so `advpng` will likely only save you a handful of bytes, if any. However, `advzip` is great at squeezing those last 100 bytes out of your zip file, when you've already squeezed everything else you can.
