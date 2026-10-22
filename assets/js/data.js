/**
 * Game Lab registry: the single source of truth for the hub and the Art Lab page.
 *
 * Paths are relative to the site root; each page prefixes its own base ('./' or '../').
 * Thumbnails live in assets/thumbs/<slug>-480.webp and <slug>-960.webp (16:10).
 *
 * inputs  – controls the game actually supports today.
 * mobile  – true only when the game has been checked at phone size and plays by touch.
 */

export const GENRES = {
  arcade: 'Arcade',
  puzzle: 'Puzzle',
  action: 'Action',
  strategy: 'Strategy',
};

export const INPUTS = {
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  touch: 'Touch',
  gamepad: 'Gamepad',
};

export const games = [
  {
    slug: 'pacman',
    title: 'Pac-Man',
    href: 'PacMan/index.html',
    blurb: 'The arcade original plus Ms. Pac-Man and procedurally generated Cookie-Man mazes, with practice mode and a rewind button.',
    genre: 'arcade',
    inputs: ['keyboard', 'touch'],
    mobile: true,
    featured: true,
  },
  {
    slug: 'tetris',
    title: 'Tetris',
    href: 'Tetris/index.html',
    blurb: 'Sprint 40 lines or dig through garbage. Hold, ghost piece, replays, custom handling and rebindable keys.',
    genre: 'puzzle',
    inputs: ['keyboard', 'touch'],
    mobile: false,
    featured: true,
  },
  {
    slug: '2048',
    title: '2048',
    href: '2048/index.html',
    blurb: 'Slide and merge to 2048, or hand the board to one of ten AI strategies and watch it chase 16384.',
    genre: 'puzzle',
    inputs: ['keyboard', 'touch'],
    mobile: true,
    featured: true,
  },
  {
    slug: 'huggers-fight',
    title: 'Huggers Fight',
    href: 'HuggersFight/index.html',
    blurb: 'Wipe out enemy outposts on generated planets. Almost everything breaks, some things burn. Up to four gamepads.',
    genre: 'action',
    inputs: ['keyboard', 'mouse', 'gamepad'],
    mobile: false,
    featured: true,
  },
  {
    slug: 'gravity-wells',
    title: 'Gravity Wells',
    href: 'Gravity_Wells/index.html',
    blurb: 'Clear every other square in the universe across eighteen compact puzzles. Tap one and see what happens.',
    genre: 'puzzle',
    inputs: ['touch', 'mouse'],
    mobile: true,
    featured: true,
  },
  {
    slug: 'souls-bumper',
    title: 'Souls Bumper',
    href: 'Souls-Bumper/index.html',
    blurb: 'A JS13k platformer about death. Rewind your ghost to get through ten tough levels.',
    genre: 'action',
    inputs: ['keyboard'],
    mobile: false,
    featured: true,
  },
  {
    slug: 'tower-defense',
    title: 'Tower Defense',
    href: 'TowerDefense/index.html',
    blurb: 'Seven upgradeable towers, sixteen maps and endless waves. Build your own maps in the editor.',
    genre: 'strategy',
    inputs: ['mouse', 'keyboard'],
    mobile: false,
  },
  {
    slug: 'raven',
    title: 'Raven',
    href: 'Raven/index.html',
    blurb: 'Bring a facility’s cameras back online while the Raven close in, but only when you aren’t looking.',
    genre: 'action',
    inputs: ['keyboard', 'mouse'],
    mobile: false,
  },
  {
    slug: 'pacman-slasher',
    title: 'Pac-Man Slasher',
    href: 'PacMan_Slasher/index.html',
    blurb: 'Draw the symbol above each Pac-Man to slash it before it reaches you. Waves get faster.',
    genre: 'arcade',
    inputs: ['mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'tron',
    title: 'Tron',
    href: 'Tron/index.html',
    blurb: 'Light-cycle duels against the computer or a friend on the same keyboard. Don’t touch the walls.',
    genre: 'arcade',
    inputs: ['keyboard', 'touch'],
    mobile: false,
  },
  {
    slug: 'moonldr',
    title: 'MoonLDR',
    href: 'MoonLDR/index.html',
    blurb: 'A Lunar Lander homage. Touch down on marked pads for bonus points and fuel; the run lasts until the tank is dry.',
    genre: 'arcade',
    inputs: ['keyboard'],
    mobile: false,
  },
  {
    slug: 'hangman',
    title: 'Hangman',
    href: 'Hangman/index.html',
    blurb: 'Guess the word across ten categories and three difficulties before you run out of guesses.',
    genre: 'puzzle',
    inputs: ['mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'interlaced',
    title: 'InterLaced',
    href: 'InterLaced/index.html',
    blurb: 'A terminal-driven network intrusion sim. Cut, slow and reroute packets to take each mesh offline.',
    genre: 'strategy',
    inputs: ['keyboard', 'mouse'],
    mobile: false,
  },
  {
    slug: 'rewire',
    title: 'ReWire',
    href: 'ReWire/index.html',
    blurb: 'Drag a cable around power nodes and plug it in. Sixteen levels of tangled spatial logic.',
    genre: 'puzzle',
    inputs: ['mouse'],
    mobile: false,
  },
  {
    slug: 'wahdatio',
    title: 'Wahdatio',
    href: 'Wahdatio/index.html',
    blurb: 'Capture nodes on a rotating sphere by sending processes between them, and outplay an adaptive AI.',
    genre: 'strategy',
    inputs: ['mouse'],
    mobile: false,
  },
];

export const experiments = [
  {
    slug: 'blossoming-flowers',
    title: 'Blossoming Flowers',
    href: 'Art_Lab/BlossomingFlowers/index.html',
    blurb: 'Petals unfold in a loop of pure CSS animation.',
    tags: ['CSS', 'Animation'],
  },
  {
    slug: 'flow-fields',
    title: 'Flow Fields',
    href: 'Art_Lab/Simple/index.html',
    blurb: 'Particles drift through an invisible vector field. Press D, or double-tap, to see it.',
    tags: ['Canvas', 'Particles'],
  },
  {
    slug: 'text-fields',
    title: 'Text Fields',
    href: 'Art_Lab/Text_Fields/index.html',
    blurb: 'Type becomes a particle system that flows through the field.',
    tags: ['Typography', 'Canvas'],
  },
  {
    slug: 'experimental-math',
    title: 'Experimental Math',
    href: 'Art_Lab/Experimental_math/index.html',
    blurb: 'Equations plotted as motion, one vector at a time.',
    tags: ['Math', 'Generative'],
  },
  {
    slug: 'adaptive-fields',
    title: 'Adaptive Fields',
    href: 'Art_Lab/Adaptive/index.html',
    blurb: 'Tune color, noise and density and export the result.',
    tags: ['Interactive', 'p5.js'],
  },
  {
    slug: 'lsd',
    title: 'Liquid Shapes',
    href: 'Art_Lab/LSD/index.html',
    blurb: 'A fragment shader you can steer in real time, with video export.',
    tags: ['WebGL', 'Shader'],
  },
  {
    slug: 'particular-drift',
    title: 'Particular Drift',
    href: 'Art_Lab/ParticularDrift/index.html',
    blurb: 'Any image dissolves into tens of thousands of drifting particles.',
    tags: ['WebGL', 'Particles'],
  },
];

/** Thumbnail srcset for a slug, relative to the page's base path. */
export function thumbSet(slug, base = './') {
  const path = `${base}assets/thumbs/${slug}`;
  return {
    src: `${path}-480.webp`,
    srcset: `${path}-480.webp 480w, ${path}-960.webp 960w`,
  };
}
