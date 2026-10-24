/**
 * Hand-authored levels. Each map is up to 15 rows of exactly 12 characters.
 *
 *   .  empty                 1  normal brick, colour from its row
 *   a-g normal brick in a set colour (a yellow, b amber, c orange, d red,
 *       e bone, f teal, g sky)
 *   2  two-hit plate         3  three-hit armour
 *   #  steel (indestructible) *  explosive (clears its 3 x 3 neighbourhood)
 *   ?  normal brick that always drops a power-up
 *
 * The curve runs in three acts: Workshop teaches one idea per level, Twists
 * bends each idea, Foundry combines them. tools/verify-levels.mjs checks every
 * map is well formed and clears each one with a bot.
 */
export const LEGEND = {
  '.': null,
  1: { kind: 'normal' },
  a: { kind: 'normal', color: 0 },
  b: { kind: 'normal', color: 1 },
  c: { kind: 'normal', color: 2 },
  d: { kind: 'normal', color: 3 },
  e: { kind: 'normal', color: 4 },
  f: { kind: 'normal', color: 5 },
  g: { kind: 'normal', color: 6 },
  '?': { kind: 'normal', drop: true },
  2: { kind: 'tough2' },
  3: { kind: 'tough3' },
  '#': { kind: 'steel' },
  '*': { kind: 'bomb' },
};

export const ACTS = ['Workshop', 'Twists', 'Foundry'];

export const LEVELS = [
  // ---------- Act I: Workshop. One new idea per level. ----------
  {
    name: 'First Light',
    act: 0,
    tip: 'Where the ball meets the paddle sets its angle. Edges send it wide.',
    map: `
............
............
.aaaaaaaaaa.
.bbbbbbbbbb.
.cccccccccc.
.dddddddddd.`,
  },
  {
    name: 'Twin Stairs',
    act: 0,
    tip: 'Hit with the paddle edge to climb the stairs.',
    map: `
............
aa........aa
bbb......bbb
cccc....cccc
ddddd..ddddd
eeeeeeeeeeee`,
  },
  {
    name: 'Double Plate',
    act: 0,
    tip: 'Plates take two hits. The pips show what is left.',
    map: `
............
aaaaaaaaaaaa
bbbbbbbbbbbb
............
2.2.2..2.2.2
.2.2.22.2.2.`,
  },
  {
    name: 'Fuse',
    act: 0,
    tip: 'Striped bricks explode and take their neighbours with them.',
    map: `
............
cccccccccccc
cc*cccccc*cc
cccccccccccc
............
ffff....ffff
ff*f....f*ff
ffff....ffff`,
  },
  {
    name: 'Rivets',
    act: 0,
    tip: 'Steel never breaks. Use it as a bumper.',
    map: `
aaaaaaaaaaaa
bbbbbbbbbbbb
cccccccccccc
dddddddddddd
............
.##..##..##.`,
  },
  {
    name: 'Heavy Core',
    act: 0,
    tip: 'Armour takes three hits. Crack the shell to reach the core.',
    map: `
............
..33333333..
..3aaaaaa3..
..3abbbba3..
..3abbbba3..
..3aaaaaa3..
..33333333..`,
  },
  {
    name: 'Supply Run',
    act: 0,
    tip: 'Marked bricks always drop a power-up. Catch the capsule.',
    map: `
............
eeeeeeeeeeee
e?eeeeeeee?e
eeee2222eeee
eeee2??2eeee
eeee2222eeee
............
gggggggggggg`,
  },
  {
    name: 'Workshop Exam',
    act: 0,
    tip: 'Everything so far, all at once.',
    map: `
............
a*aaaaaaaa*a
bbbbbbbbbbbb
22222..22222
............
.#..3333..#.
....3??3....`,
  },

  // ---------- Act II: Twists. The same ideas, bent. ----------
  {
    name: 'Funnel',
    act: 1,
    tip: 'The steel funnel only lets you through the middle.',
    map: `
aaaaaaaaaaaa
bbbbbbbbbbbb
cccccccccccc
dddddddddddd
............
#..........#
##........##
.##......##.
..###..###..`,
  },
  {
    name: 'Chain Reaction',
    act: 1,
    tip: 'One spark can clear a row. Find the right one.',
    map: `
............
d*dd*dd*dd*d
dddddddddddd
c*cc*cc*cc*c
cccccccccccc
b*bb*bb*bb*b
............`,
  },
  {
    name: 'Armory',
    act: 1,
    tip: 'Armoured pillars split the field into lanes.',
    map: `
............
3aa3aaaa3aa3
3bb3bbbb3bb3
3cc3cccc3cc3
3dd3dddd3dd3
............
.2..2..2..2.`,
  },
  {
    name: 'Portcullis',
    act: 1,
    tip: 'A single gate. Thread it and the ball does the rest.',
    map: `
aaaaaaaaaaaa
b?bbbbbbbb?b
cccccccccccc
............
#####..#####
............
....2222....`,
  },
  {
    name: 'Checker',
    act: 1,
    tip: 'Plates and tiles interleaved. Two charges hide inside.',
    map: `
............
2a2a2a2a2a2a
a2a2a*a2a2a2
2b2b2b2b2b2b
b2b2b2b*b2b2
2c2c2c2c2c2c`,
  },
  {
    name: 'Cellblock',
    act: 1,
    tip: 'Each cell opens only from below.',
    map: `
############
#aa#bb#bb#aa
#aa#bb#bb#aa
#2*#22#22#*2
#..#..#..#..
............
eeeeeeeeeeee`,
  },
  {
    name: 'Overpass',
    act: 1,
    tip: 'Go around the steel shelf, not through it.',
    map: `
aaaaaaaaaaaa
b*bbbbbbbb*b
cccccccccccc
............
..########..
............
.3........3.`,
  },
  {
    name: 'Ignition',
    act: 1,
    tip: 'The charges sit behind armour. Crack it and stand back.',
    map: `
............
dddddddddddd
dd*dd**dd*dd
dddddddddddd
333333333333
............`,
  },

  // ---------- Act III: Foundry. Everything, combined. ----------
  {
    name: 'Citadel',
    act: 2,
    tip: 'The keep has one door. Its charges do the rest.',
    map: `
....3333....
....3??3....
..##3333##..
..#bbbbbb#..
..#b*bb*b#..
..#bbbbbb#..
..##2..2##..
............
1..........1`,
  },
  {
    name: 'Switchback',
    act: 2,
    tip: 'Two shelves, two directions. Bank around them.',
    map: `
eeeeeeeeeeee
e?eeeeeeee?e
.........###
cccccccccccc
###.........
............
2222....2222`,
  },
  {
    name: 'Minefield',
    act: 2,
    tip: 'Charges everywhere. Watch the chains.',
    map: `
............
*c2c*cc*c2c*
cc2cc22cc2cc
2cc*c22c*cc2
cc2cc22cc2cc
*c2c*cc*c2c*
............
.#...##...#.`,
  },
  {
    name: 'Foundry',
    act: 2,
    tip: 'Charges in the steel line break the armour beneath.',
    map: `
aaaaaaaaaaaa
a2a2a2a2a2a2
............
##.#*##*#.##
............
33.333333.33
2?22222222?2`,
  },
  {
    name: 'Reactor',
    act: 2,
    tip: 'The core is packed with charges. One way in.',
    map: `
............
...######...
..#333333#..
..#3*bb*3#..
..#3b**b3#..
..#3*bb*3#..
..#333333#..
...##..##...
............
22........22`,
  },
  {
    name: 'Vault',
    act: 2,
    tip: 'A row of charges waits behind the armour.',
    map: `
############
#?aaaaaaaa?#
#a33333333a#
#a3******3a#
#a33333333a#
#aaaaaaaaaa#
####....####
............
2.2.2..2.2.2`,
  },
  {
    name: 'Gauntlet',
    act: 2,
    tip: 'Posts everywhere. Every bounce counts.',
    map: `
aaaaaaaaaaaa
bbbbbbbbbbbb
3#3#3##3#3#3
cccccccccccc
#2#2#22#2#2#
dddddddddddd
............
.*........*.`,
  },
  {
    name: 'Hourglass',
    act: 2,
    tip: 'The neck is narrow, but the sides are open.',
    map: `
aaaaaaaaaaaa
.bbbbbbbbbb.
..cccccccc..
...#dddd#...
....#ee#....
....#..#....
...#2222#...
..33333333..
.2222222222.`,
  },
  {
    name: 'Labyrinth',
    act: 2,
    tip: 'Each steel floor has a door. Find it, then the next.',
    map: `
aaaaaaaaaaaa
#..######..#
bbbbbbbbbbbb
##..####..##
cccccccccccc
###..##..###
dddddddddddd
............`,
  },
  {
    name: 'Overload',
    act: 2,
    tip: 'Armour around a nest of charges. Light it up.',
    map: `
?2222222222?
233333333332
23*a*aa*a*32
23a*a**a*a32
23*a*aa*a*32
233333333332
222222222222
............
..##....##..`,
  },
  {
    name: 'Last Light',
    act: 2,
    tip: 'The final chamber. Two doors, one chance at a clean run.',
    map: `
.##########.
.#33333333#.
.#3**33**3#.
.#33333333#.
.##.2222.##.
............
aaaaaaaaaaaa
b#b#b##b#b#b
cccccccccccc
22........22`,
  },
];

/** Parse a map into rows of LEGEND cells. Throws on malformed maps. */
export function parseMap(map, cols = 12) {
  const rows = map.replace(/^\n/, '').split('\n');
  return rows.map((row, r) => {
    if (row.length !== cols) throw new Error(`Row ${r} is ${row.length} wide, expected ${cols}: "${row}"`);
    return [...row].map((ch) => {
      if (!(ch in LEGEND)) throw new Error(`Unknown brick "${ch}" in row ${r}`);
      return LEGEND[ch];
    });
  });
}

/**
 * Static check: can every breakable brick be reached? Treats empty cells as
 * open air, the lanes above and below the grid as open, and lets explosives
 * clear their neighbourhood. Returns the number of breakable bricks that can
 * never be reached (0 means the level is clearable in principle).
 */
export function unreachableCount(cells) {
  const rows = cells.length;
  const cols = cells[0]?.length ?? 0;
  const state = cells.map((row) => row.map((c) => (c ? c.kind : null)));
  let changed = true;
  // Air connected to the open lanes; recomputed as bricks fall.
  while (changed) {
    changed = false;
    const air = state.map((row) => row.map(() => false));
    const queue = [];
    for (let c = 0; c < cols; c++) {
      for (const r of [0, rows - 1]) {
        if (state[r][c] === null && !air[r][c]) {
          air[r][c] = true;
          queue.push([r, c]);
        }
      }
    }
    while (queue.length) {
      const [r, c] = queue.pop();
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        if (state[nr][nc] === null && !air[nr][nc]) {
          air[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }
    const touchesAir = (r, c) =>
      [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows) return true; // open lanes
        if (nc < 0 || nc >= cols) return false; // side walls
        return air[nr][nc];
      });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = state[r][c];
        if (k && k !== 'steel' && touchesAir(r, c)) {
          state[r][c] = null;
          changed = true;
          if (k === 'bomb') {
            for (let dr = -1; dr <= 1; dr++)
              for (let dc = -1; dc <= 1; dc++) {
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && state[nr][nc] && state[nr][nc] !== 'steel') state[nr][nc] = null;
              }
          }
        }
      }
    }
  }
  let left = 0;
  for (const row of state) for (const k of row) if (k && k !== 'steel') left++;
  return left;
}

/* ---------- Endless mode: seeded, mirrored, always reachable ---------- */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Builds a left-right mirrored map for endless stage `stage` (1-based).
 * Difficulty rises with the stage: more rows, more armour, more steel.
 */
export function generateLevel(stage, seed) {
  const rand = mulberry32(seed * 7919 + stage * 104729);
  const d = Math.min(1, (stage - 1) / 14);
  const colors = 'abcdefg';
  for (let attempt = 0; attempt < 40; attempt++) {
    const rows = 5 + Math.floor(rand() * 2 + d * 4);
    const pTough2 = 0.06 + d * 0.22;
    const pTough3 = d * 0.14;
    const pSteel = d > 0.15 ? 0.03 + d * 0.07 : 0;
    const pBomb = 0.03 + d * 0.04;
    const pDrop = 0.03;
    const pEmpty = 0.08 + rand() * 0.18;
    const pattern = Math.floor(rand() * 4);
    const lines = [];
    lines.push('............');
    for (let r = 0; r < rows; r++) {
      const color = colors[(r + Math.floor(rand() * 2)) % colors.length];
      const half = [];
      for (let c = 0; c < 6; c++) {
        let ch = color;
        const x = rand();
        if (pattern === 1 && (r + c) % 2 === 0 && rand() < 0.6) ch = '.';
        else if (pattern === 2 && c < r - 1) ch = '.';
        else if (pattern === 3 && r % 3 === 2) ch = rand() < 0.5 ? '.' : '2';
        else if (x < pEmpty) ch = '.';
        else if (x < pEmpty + pSteel) ch = '#';
        else if (x < pEmpty + pSteel + pBomb) ch = '*';
        else if (x < pEmpty + pSteel + pBomb + pTough3) ch = '3';
        else if (x < pEmpty + pSteel + pBomb + pTough3 + pTough2) ch = '2';
        else if (x < pEmpty + pSteel + pBomb + pTough3 + pTough2 + pDrop) ch = '?';
        half.push(ch);
      }
      lines.push(half.join('') + half.slice().reverse().join(''));
    }
    const map = '\n' + lines.join('\n');
    const cells = parseMap(map);
    const breakable = cells.flat().filter((c) => c && c.kind !== 'steel').length;
    if (breakable >= 18 && unreachableCount(cells) === 0) return { name: `Stage ${stage}`, act: -1, tip: '', map };
  }
  return { name: `Stage ${stage}`, act: -1, tip: '', map: LEVELS[(stage - 1) % LEVELS.length].map };
}
