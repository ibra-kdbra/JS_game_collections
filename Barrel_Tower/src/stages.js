/**
 * Stage geometry. The field is 224 x 256 logical pixels, y pointing down;
 * every y below is where feet stand.
 *
 * Girders are straight segments { x1, y1, x2, y2 }. A ladder joins two girders
 * at one x; `broken` ladders are drawn with missing rungs and only barrels and
 * sparks use them.
 */

export const FIELD = { w: 224, h: 256 };

export const segY = (s, x) => (s.x1 === s.x2 ? s.y1 : s.y1 + ((s.y2 - s.y1) * (x - s.x1)) / (s.x2 - s.x1));

function ladder(lower, upper, x, broken = false) {
  return { x, top: Math.round(segY(upper, x)), bottom: Math.round(segY(lower, x)), broken };
}

/* ---------- Stage 1: Ramps. Barrels roll down six sloping girders. ---------- */

function ramps() {
  const g = [
    { x1: 0, y1: 244, x2: 224, y2: 238 }, // 0 ground: rolls left to the oil drum
    { x1: 0, y1: 198, x2: 208, y2: 206 }, // 1 rolls right
    { x1: 16, y1: 172, x2: 224, y2: 164 }, // 2 rolls left
    { x1: 0, y1: 132, x2: 208, y2: 140 }, // 3 rolls right
    { x1: 16, y1: 108, x2: 224, y2: 100 }, // 4 rolls left
    { x1: 0, y1: 72, x2: 168, y2: 76 }, // 5 the boss's girder, rolls right
    { x1: 72, y1: 40, x2: 120, y2: 40 }, // 6 the top: reach it to clear
  ];
  return {
    id: 'ramps',
    name: 'The Ramps',
    girders: g,
    ladders: [
      ladder(g[0], g[1], 180),
      ladder(g[0], g[1], 76, true),
      ladder(g[1], g[2], 40),
      ladder(g[1], g[2], 104),
      ladder(g[2], g[3], 188),
      ladder(g[2], g[3], 96, true),
      ladder(g[3], g[4], 76),
      ladder(g[3], g[4], 32),
      ladder(g[4], g[5], 160),
      ladder(g[4], g[5], 120, true),
      ladder(g[5], g[6], 112),
    ],
    start: { x: 44, seg: 0 },
    boss: { x: 30, y: 72 },
    drum: { x: 14, y: 244 },
    hammers: [
      { x: 168, y: 205 },
      { x: 24, y: 107 },
    ],
    goal: { x1: 72, x2: 120, y: 40 },
    beacon: { x: 92, y: 40 },
  };
}

/* ---------- Stage 2: Lifts. Ride the elevators while springs bounce down. ---------- */

function lifts() {
  const g = [
    { x1: 0, y1: 236, x2: 46, y2: 236 }, // 0 start ledge
    { x1: 8, y1: 196, x2: 46, y2: 196 }, // 1 left ledge
    { x1: 90, y1: 156, x2: 124, y2: 156 }, // 2 middle, low
    { x1: 90, y1: 116, x2: 124, y2: 116 }, // 3 middle, high
    { x1: 164, y1: 104, x2: 216, y2: 104 }, // 4 right ledge
    { x1: 112, y1: 56, x2: 224, y2: 56 }, // 5 the spring girder, out of jump reach from the left lift
    { x1: 0, y1: 48, x2: 50, y2: 48 }, // 6 the boss's perch
    { x1: 152, y1: 24, x2: 200, y2: 24 }, // 7 the top: reach it to clear
  ];
  return {
    id: 'lifts',
    name: 'The Lifts',
    girders: g,
    ladders: [
      { x: 24, top: 196, bottom: 236, broken: false },
      { x: 106, top: 116, bottom: 156, broken: false },
      { x: 200, top: 56, bottom: 104, broken: false },
      { x: 176, top: 24, bottom: 56, broken: false },
    ],
    shafts: [
      // Platforms rise in the left shaft and sink in the right one, 64 px apart.
      { x: 66, dir: -1, top: 68, bottom: 252, gap: 64 },
      { x: 144, dir: 1, top: 68, bottom: 252, gap: 64 },
    ],
    start: { x: 14, seg: 0 },
    boss: { x: 26, y: 48 },
    springs: { y: 56, dropX: 214 },
    patrols: [{ seg: 4 }, { seg: 2 }],
    goal: { x1: 152, x2: 200, y: 24 },
    beacon: { x: 192, y: 24 },
  };
}

/* ---------- Stage 3: Rivets. Pull all eight rivets and the boss falls. ---------- */

const RIVET_FLOORS = [200, 160, 120, 80];
export const RIVET_XS = [56, 168];

function rivets() {
  const floors = [{ x1: 0, y1: 240, x2: 224, y2: 240 }];
  for (const y of RIVET_FLOORS) floors.push({ x1: 16, y1: y, x2: 208, y2: y });
  const L = (x, a, b) => ({ x, top: floors[b].y1, bottom: floors[a].y1, broken: false });
  return {
    id: 'rivets',
    name: 'The Rivets',
    floors,
    rivets: RIVET_FLOORS.flatMap((y, i) => RIVET_XS.map((x) => ({ x, y, floor: i + 1, popped: false, touched: false }))),
    ladders: [
      L(24, 0, 1), L(112, 0, 1), L(200, 0, 1),
      L(32, 1, 2), L(140, 1, 2), L(192, 1, 2),
      L(24, 2, 3), L(88, 2, 3), L(200, 2, 3),
      L(36, 3, 4), L(80, 3, 4), L(188, 3, 4),
    ],
    start: { x: 72, seg: 0 },
    boss: { x: 112, y: 80 },
    hammers: [
      { x: 20, y: 160 },
      { x: 204, y: 120 },
    ],
    vents: [
      { x: 20, floor: 1 }, { x: 204, floor: 2 }, { x: 20, floor: 3 }, { x: 204, floor: 1 },
    ],
  };
}

export const STAGES = { ramps, lifts, rivets };

/** Stage order for a round (1-based): the first round skips the lifts. */
export function roundStages(round) {
  return round === 1 ? ['ramps', 'rivets'] : ['ramps', 'lifts', 'rivets'];
}

/** Difficulty for a round, 1-based. Everything levels off by round 5. */
export function difficulty(round) {
  const r = Math.min(round, 5) - 1;
  return {
    barrelSpeed: 0.9 + 0.09 * r,
    throwMin: 150 - 18 * r, // steps between barrels
    throwMax: 260 - 30 * r,
    ladderChance: 0.25 + 0.05 * r, // a barrel takes a ladder it passes
    sparkCap: 2 + r,
    sparkSpeed: 0.42 + 0.06 * r,
    springEvery: 150 - 15 * r,
    springSpeed: 1.0 + 0.12 * r,
    liftSpeed: 0.45 + 0.05 * r,
    bonus: Math.min(8000, 5000 + 1000 * r),
  };
}
