/**
 * Game Lab registry: the single source of truth for the hub and the Art Lab page.
 *
 * Paths are relative to the site root; each page prefixes its own base ('./' or '../').
 * Thumbnails live in assets/thumbs/<slug>-480.webp and <slug>-960.webp (16:10).
 * After editing, run `node tools/render-pages.mjs` to update the static pages.
 *
 * genre   – one of GENRES, used by the genre filter.
 * inputs  – controls the game supports: keyboard, mouse, touch, gamepad.
 * mobile  – true only when the game has been checked at phone size and plays by touch.
 *
 * Experiments also carry their Art Lab card details:
 * engine   – what the piece runs on, shown as the card's badge.
 * input    – how you play with it: Watch, Keys or Panel.
 * rarity   – 1 common, 2 uncommon, 3 holo (a collector touch on the card).
 * controls – one line on how to play with it, shown in the card's details.
 */

export const GENRES = {
  arcade: 'Arcade',
  puzzle: 'Puzzle',
  action: 'Action',
  strategy: 'Strategy',
};

export const games = [
  {
    slug: '2048',
    title: '2048 with AI',
    href: '2048/index.html',
    blurb: 'Challenge yourself with the classic tile-merging puzzle. It has a built-in AI player, with some fantastic algorithms.',
    genre: 'puzzle',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'tower-defense',
    title: 'Tower Defense Game',
    href: 'TowerDefense/index.html',
    blurb: 'A tower defense game with many options built with p5.js, with a few enhancements, many modes, playgrounds provided.',
    genre: 'strategy',
    inputs: ['mouse', 'keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'hangman',
    title: 'Hangman',
    href: 'Hangman/index.html',
    blurb: 'Classic Hangman game with multiple options, wonderful game play.',
    genre: 'puzzle',
    inputs: ['keyboard', 'mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'raven',
    title: 'Raven',
    href: 'Raven/index.html',
    blurb: 'In this 2D puzzle-action game, you must fix a security system while surviving enemies who only attack when you’re not looking.',
    genre: 'action',
    inputs: ['keyboard', 'mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'pacman-slasher',
    title: 'PacMan Slasher',
    href: 'PacMan_Slasher/index.html',
    blurb: 'Defeat a pacman by drawing its symbol anywhere.',
    genre: 'arcade',
    inputs: ['mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'tron',
    title: 'Tron',
    href: 'Tron/index.html',
    blurb: 'Remake of the classic arcade game that involves maneuvering a ‘light cycle’ in an arena against an opponent.',
    genre: 'arcade',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'tetris',
    title: 'Tetris',
    href: 'Tetris/index.html',
    blurb: 'The original Tetris game, with a few enhancements, many options included.',
    genre: 'puzzle',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'souls-bumper',
    title: 'Souls Bumper',
    href: 'Souls-Bumper/index.html',
    blurb: 'Souls Bumper is a platformer where you navigate through challenging levels.',
    genre: 'action',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'pacman',
    title: 'PacMan',
    href: 'PacMan/index.html',
    blurb: 'The original PacMan game, with a few enhancements, many modes, playgrounds provided.',
    genre: 'arcade',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'moonldr',
    title: 'MoonLDR',
    href: 'MoonLDR/index.html',
    blurb: 'Fun landing ship on ground game, it’s a classic based on Lunar Lander.',
    genre: 'arcade',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'huggers-fight',
    title: 'HuggersFight',
    href: 'HuggersFight/index.html',
    blurb: 'The empire is spreading like a plague across the galaxy and building outposts on remote planets.',
    genre: 'action',
    inputs: ['keyboard', 'mouse', 'touch', 'gamepad'],
    mobile: true,
  },
  {
    slug: 'interlaced',
    title: 'InterLaced',
    href: 'InterLaced/index.html',
    blurb: 'Interlaced is a tactical network intrusion and sabotage simulator.',
    genre: 'strategy',
    inputs: ['keyboard', 'mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'gravity-wells',
    title: 'Gravity Wells',
    href: 'Gravity_Wells/index.html',
    blurb: 'Gravity Wells is a puzzle game set in space.',
    genre: 'puzzle',
    inputs: ['touch', 'mouse', 'keyboard'],
    mobile: true,
  },
  {
    slug: 'rewire',
    title: 'ReWire',
    href: 'ReWire/index.html',
    blurb: 'Drag the cable around the power nodes and plug it in to bring the system back online.',
    genre: 'puzzle',
    inputs: ['mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'wahdatio',
    title: 'Wahdatio',
    href: 'Wahdatio/index.html',
    blurb: 'A profound 3D strategy game that embodies the concept of unity and interconnectedness.',
    genre: 'strategy',
    inputs: ['mouse', 'touch', 'keyboard'],
    mobile: true,
  },
  {
    slug: 'brainy-warrior',
    title: 'Brainy Warrior 3D',
    href: 'Brainy_Warrior/index.html',
    blurb: 'Slide your warrior into every enemy without falling into the sea, and move the wizard to make your own walls. A 3D island puzzle with 34 levels, hints, and five search algorithms (A* in WebAssembly) that you can watch solve it.',
    genre: 'puzzle',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'minesweeper',
    title: 'Minesweeper',
    href: 'Minesweeper/index.html',
    blurb: 'Classic Minesweeper where every board can be solved by logic, with a daily board, a puzzle ladder, hints and stats.',
    genre: 'puzzle',
    inputs: ['mouse', 'keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'sokoban',
    title: 'Crate Lab',
    href: 'Sokoban/index.html',
    blurb: 'A Sokoban-style puzzle: push every crate onto a pad across 40 original levels, and try to match the solver-proven par.',
    genre: 'puzzle',
    inputs: ['keyboard', 'mouse', 'touch'],
    mobile: true,
  },
  {
    slug: 'snake',
    title: 'Snake',
    href: 'Snake/index.html',
    blurb: 'The classic Snake with Classic, Wrap, Zen and daily modes, plus 20 hand-built arenas with portals.',
    genre: 'arcade',
    inputs: ['keyboard', 'touch'],
    mobile: true,
  },
  {
    slug: 'reef-keeper',
    title: 'Reef Keeper',
    href: 'Reef_Keeper/index.html',
    blurb: 'Keep an aquarium: feed your fish, collect the coins they drop, fight off squid and eels, and buy three pearls to clear each tank.',
    genre: 'strategy',
    inputs: ['mouse', 'touch', 'keyboard'],
    mobile: true,
  },
  {
    slug: 'breakout',
    title: 'Breakout',
    href: 'Breakout/index.html',
    blurb: 'Classic brick breaker with 27 levels, steel, armour and explosive bricks, six power-ups and an endless mode.',
    genre: 'arcade',
    inputs: ['keyboard', 'mouse', 'touch'],
    mobile: true,
  },
];

export const experiments = [
  {
    slug: 'blossoming-flowers',
    title: 'Blossoming Flowers',
    href: 'Art_Lab/BlossomingFlowers/index.html',
    blurb: 'Pure CSS blossoming flowers animation. Watch as petals unfold in a mesmerizing dance of color and motion.',
    tags: ['CSS Art', 'Animation'],
    engine: 'CSS',
    input: 'Watch',
    rarity: 1,
    controls: 'No input: sit back and let it bloom. Pure CSS, no canvas.',
  },
  {
    slug: 'flow-fields',
    title: 'Flow Fields',
    href: 'Art_Lab/Simple/index.html',
    blurb: 'Experiment with flow fields. Press D to debug or double touch. Watch particles dance through invisible currents.',
    tags: ['Canvas', 'Particles'],
    engine: 'Canvas',
    input: 'Keys',
    rarity: 1,
    controls: 'D or a double tap shows the hidden field. The corner button opens colours and screenshots.',
  },
  {
    slug: 'text-fields',
    title: 'Text Fields',
    href: 'Art_Lab/Text_Fields/index.html',
    blurb: 'Typography meets generative art. Text rendered as particle systems moving through flow fields.',
    tags: ['Typography', 'Canvas'],
    engine: 'Canvas',
    input: 'Keys',
    rarity: 2,
    controls: 'D or a double tap shows the field under the letters. The corner button sets your own text and colours.',
  },
  {
    slug: 'experimental-math',
    title: 'Experimental Math',
    href: 'Art_Lab/Experimental_math/index.html',
    blurb: 'Low-level mathematical explorations with flow fields. Visualize equations in motion.',
    tags: ['Math', 'Generative'],
    engine: 'Canvas',
    input: 'Watch',
    rarity: 1,
    controls: 'No input: the equations drift and redraw on their own.',
  },
  {
    slug: 'adaptive-fields',
    title: 'Adaptive Fields',
    href: 'Art_Lab/Adaptive/index.html',
    blurb: 'Try multiple variations with adaptive flow fields that respond to your interaction.',
    tags: ['Interactive', 'Canvas'],
    engine: 'p5.js',
    input: 'Panel',
    rarity: 2,
    controls: 'Pick colours, border rules and presets; type a value and press Enter to apply it.',
  },
  {
    slug: 'lsd',
    title: 'LSD',
    href: 'Art_Lab/LSD/index.html',
    blurb: 'Create psychedelic animations in real-time. A trip through color and form.',
    tags: ['Psychedelic', 'Real-time'],
    engine: 'WebGL',
    input: 'Keys',
    rarity: 3,
    controls: 'R randomise, Space pause, S screenshot, V record a clip, M music.',
  },
  {
    slug: 'particular-drift',
    title: 'Particular Drift',
    href: 'Art_Lab/ParticularDrift/index.html',
    blurb: 'Watch particles drift through space in this meditative visual experience.',
    tags: ['Particles', 'Ambient'],
    engine: 'WebGL 2',
    input: 'Keys',
    rarity: 3,
    controls: 'U upload your own image, R randomise, C colours, S save, V record.',
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

/** Platform tags shown on a card: every game runs on PC; Mobile only when verified. */
export function platformTags(game) {
  return game.mobile ? ['pc', 'mobile'] : ['pc'];
}
