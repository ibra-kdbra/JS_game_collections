/**
 * Pixel art, drawn in code: each sprite is rows of palette letters ('.' is
 * clear). Sprites are baked once into small canvases, plus mirrored copies.
 */

export const PAL = {
  Y: '#facc15', y: '#b98a0c', // hard hat
  S: '#f4be8c', s: '#c98a57', // skin
  B: '#3474e0', b: '#1f4a9c', // overalls
  R: '#e5484d', // shirt
  K: '#231a14', // boots, outlines
  E: '#14161c', W: '#ffffff',
  G: '#6c7488', g: '#3a3f4c', L: '#a3acbf', // gunmetal boss
  r: '#ff3b3b', O: '#ff9a1f', o: '#ffd166',
  H: '#cfd5e0', h: '#8a5a2c', // hammer head, handle
};

export const SPRITES = {
  heroStand: [
    '....yYYYy...',
    '...yYYYYYy..',
    '...YYYYYYYYY',
    '...SSSSES...',
    '...SSSSSSS..',
    '....SSSs....',
    '...RRBBRR...',
    '..RRBBBBRR..',
    '..SRBBBBRS..',
    '..S.BBBB.S..',
    '....BBBB....',
    '....bBBb....',
    '....BB.BB...',
    '....BB.BB...',
    '...KKK.KKK..',
    '...KKK.KKK..',
  ],
  heroWalk1: [
    '....yYYYy...',
    '...yYYYYYy..',
    '...YYYYYYYYY',
    '...SSSSES...',
    '...SSSSSSS..',
    '....SSSs....',
    '...RRBBRR...',
    '..RRBBBBRR..',
    '..SRBBBBRS..',
    '..S.BBBB.S..',
    '....BBBB....',
    '...bBBBBb...',
    '...BB..BB...',
    '..BB....BB..',
    '.KKK....KKK.',
    '.KK......KK.',
  ],
  heroWalk2: [
    '....yYYYy...',
    '...yYYYYYy..',
    '...YYYYYYYYY',
    '...SSSSES...',
    '...SSSSSSS..',
    '....SSSs....',
    '...RRBBRR...',
    '...RBBBBR...',
    '...SBBBBS...',
    '....BBBB....',
    '....BBBB....',
    '....bBBb....',
    '....BBBB....',
    '....BBB.....',
    '....KKKK....',
    '....KKKKK...',
  ],
  heroJump: [
    '....yYYYy...',
    '...yYYYYYy..',
    'S..YYYYYYYYY',
    'S..SSSSES..S',
    'R..SSSSSSS.S',
    'RR..SSSs..RR',
    '.RRRBBBBRRR.',
    '....BBBB....',
    '....BBBB....',
    '...bBBBBb...',
    '..BB....BB..',
    '.KKK....KKK.',
    '.KK......KK.',
    '............',
    '............',
    '............',
  ],
  heroClimb: [
    '....yYYy....',
    '...yYYYYy...',
    'S..YYYYYY...',
    'S..ssssss...',
    'R...ssss....',
    'RRRRBBBBRR..',
    '..RRBBBBRRS.',
    '....BBBB..S.',
    '....BBBB....',
    '....bBBb....',
    '....BB.BB...',
    '....BB.BB...',
    '....BB..BB..',
    '...KKK..BB..',
    '...KKK..BB..',
    '........KKK.',
  ],
  hammer: [
    '.HHHHHH.',
    'HHHHHHHH',
    '.HHHHHH.',
    '...hh...',
    '...hh...',
    '...hh...',
    '...hh...',
    '...hh...',
  ],
  // The boss without arms; arms are drawn separately so they can move.
  boss: [
    '........gggggggggggg........',
    '......ggLLLLLLLLLLLLgg......',
    '.....gLLGGGGGGGGGGGGLLg.....',
    '....gLGGGGGGGGGGGGGGGGLg....',
    '....gGGGKKKKKKKKKKKKGGGg....',
    '....gGGKKrrKKKKKKrrKKGGg....',
    '....gGGKKrrKKKKKKrrKKGGg....',
    '....gGGGKKKKKKKKKKKKGGGg....',
    '.....gGGGLLLLLLLLLLGGGg.....',
    '......gGGLKLKLKLKLGGGg......',
    '.....ggGGGGGGGGGGGGGGgg.....',
    '....gGGGGGGGGGGGGGGGGGGg....',
    '....gGGGGGGGGOOGGGGGGGGg....',
    '....gGGGGGGGOooOGGGGGGGg....',
    '....gGGGGGGGGOOGGGGGGGGg....',
    '....gGGGGGGGGGGGGGGGGGGg....',
    '.....gGGGGGGGGGGGGGGGGg.....',
    '.....gGGGLLLLLLLLLLGGGg.....',
    '.....gGGGGGGGGGGGGGGGGg.....',
    '......ggGGGGGGGGGGGGgg......',
    '.......gGGGGg..gGGGGg.......',
    '.......gGGGGg..gGGGGg.......',
    '......gGGGGGg..gGGGGGg......',
    '.....gLLLLLLg..gLLLLLLg.....',
    '.....KKKKKKKK..KKKKKKKK.....',
  ],
  bossArm: [
    '.ggg.',
    'gGGGg',
    'gGLGg',
    'gGLGg',
    'gGGGg',
    'gGGGg',
    'gGGGg',
    'gLLLg',
    'gLLLg',
    'KLLLK',
    'KKKKK',
  ],
};

/** Bake a sprite into a canvas; `flip` mirrors it left to right. */
export function bake(rows, flip = false) {
  const h = rows.length;
  const w = rows[0].length;
  for (const r of rows) if (r.length !== w) throw new Error(`sprite row "${r}" is ${r.length} wide, expected ${w}`);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  rows.forEach((row, j) => {
    for (let i = 0; i < w; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      x.fillStyle = PAL[ch];
      x.fillRect(flip ? w - 1 - i : i, j, 1, 1);
    }
  });
  return c;
}

/** 3x5 digits for score pop-ups. */
export const DIGITS = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '011', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};
