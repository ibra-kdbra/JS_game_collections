# MoonLDR

## Gameplay

This game was inspired by [Lunar Lander](https://en.wikipedia.org/wiki/Lunar_Lander_(1979_video_game)).  
The player controls lander rotation and thrusters in order to safely land on the surface.  
The player can land on marked areas to earn extra points and fuel.  
The game goes on until no fuel is remaining.

Before each flight, pick a difficulty and a terrain:

* **Cadet** - low gravity, a 1500 unit tank, gentler crash penalties and looser landing limits
* **Pilot** - the original game: lunar gravity and a 1000 unit tank
* **Commander** - heavy gravity, an 800 unit tank, bigger crash penalties and stricter landings
* **Classic** terrain is the original hand-made surface; **New every round** generates fresh terrain for each landing from a seed, so a run can be reproduced

Your best score for each difficulty is saved in the browser.

## Controls

* **Left / Right arrows** - rotate
* **Up arrow** - thrust
* **P** or **Esc** - pause (the game also pauses when the tab is hidden)
* On touch screens: on-screen rotate buttons, a Thrust button and Pause

![game](./images/start.png "game")  

## Technologies used

* HTML5
* JavaScript
* WebGL
* [three.js](https://threejs.org/) r124, vendored in `vendor/three` (MIT license)

## Project architecture

* `constants.js` - game, ui and particle parameters
* `globals.js` - global variables
* `terrainData.js` - the classic terrain and the seeded terrain generator
* `sound.js` - sound effects
* `hud.js` - HUD code
* `particles.js` - particle systems
* `main.js` - main game functionality

## The lander, terrain and camera

The lander itself is a quad with a texture.
Using thrusters does not directly change velocity or acceleration, but [jerk](https://en.wikipedia.org/wiki/Jerk_(physics)), in order to have smoother landings.
Horizontal speed is slightly decreasing to enable strategic decisions regarding fuel consumption.
Vertical speed is only affected by gravity.

The lander is spawned randomly, with a random horizontal speed forcing the player to use some more fuel before attempting to land.

The terrain is defined through an array of points.
Between each pair of points, a quad is positioned, rotated and scaled to connect the two points.

Once the altitude drops below a certain threshold, the camera zooms in and follows the center point between the lander and terrain directly below.
It makes the game less static and helps with landing.

The world never stretches: large screens show the whole 800x450 world with letterboxing, while small screens (such as a phone held upright) show its full height and scroll sideways with the lander.

The simulation runs in fixed 60 Hz steps, independent of the display's refresh rate.

## Collision detection

The shape of the lander is approximated with 3 circles which makes collision detection easier due to rotation.  
Each circle is checked against every line segment defined by the terrain (basic circle-line intersection).

![lander](./images/normal.png "lander")  

![colliders](./images/colliders.png "colliders")

Upon collision, the landing is safe if 4 conditions are met:

* velocity magnitude must not be too high
* rotation angle must not be too high
* landing terrain must have a slope of 0
* both landing legs must be grounded

## HUD

The HUD is made with a separate scene and camera which are additively rendered on top of the world scene and world camera.
It is drawn at the screen's pixel density and switches to short labels on narrow screens.
It contains score and fuel information on the left, lander parameters on the right and some basic information in the middle.
Bonus markings are rendered in world space.

![landing](./images/landing.png "landing")

## Particle systems

One particle system is attached to the thruster and it emits particles in a cone.  
The other one creates a circular explosion when the player crashes.

![thruster](./images/thruster.png "thruster")

![explosion](./images/explosion.png "explosion")

## Audio

Audio is played through the HTML5 audio element, and only once a game has been started.
There are 4 sounds in the game:

* `crash.mp3` - played on crash
* `morse.mp3` - randomly played every x seconds
* `alarm.mp3` - played every x seconds once the next crash means game over
* `rocket.mp3` - looped while using thrusters
