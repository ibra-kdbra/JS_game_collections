export const TILE_TYPES = {
    WATER: 0,
    FLOOR: 1,
    WALL: 2,
    FENCE: 3,
};

export const ENTITY_TYPES = {
    ENEMY: 'enemy',
    STRONG_ENEMY: 'strong_enemy',
    SWORD: 'sword',
};

/*
 * Levels are drawn as text, one character per tile:
 *   ~ water (falling in restarts the level)   . floor   # rock wall   = fence
 *   P hero start   E enemy   S strong enemy (needs a sword)   / sword
 *   W wizard (starts here)   w another spot the wizard can teleport to
 * `par` is the fewest moves possible, as found by the solver (see README).
 */
const MAPS = [
    {
        name: 'First Steps',
        hint: 'You slide until something stops you. Enemies stop you too.',
        par: 2,
        map: [
            '~~~~~~',
            '~P..E~',
            '~....~',
            '~...E~',
            '~~~~~~',
        ],
    },
    {
        name: 'Island Ring',
        hint: 'Sliding off the edge means a swim. Plan where you stop.',
        par: 3,
        map: [
            '~~~~~~~',
            '~P...E~',
            '~.~~~.~',
            '~E...E~',
            '~~~~~~~',
        ],
    },
    {
        name: 'Rock Walls',
        hint: 'Rocks stop you safely. Use them to line up a hit.',
        par: 4,
        map: [
            '#######',
            '#P.#..#',
            '#....E#',
            '#.#...#',
            '#E..#.#',
            '#######',
        ],
    },
    {
        name: 'Corners',
        hint: 'Sometimes the long way round is the only way.',
        par: 5,
        map: [
            '#######',
            '#P..#E#',
            '#.....#',
            '#E...##',
            '#######',
        ],
    },
    {
        name: 'Hedge Maze',
        hint: 'Hedges block you just like rocks.',
        par: 7,
        map: [
            '~~~~~~~',
            '~...=E~',
            '~.E..P~',
            '~E.=..~',
            '~~==.=~',
            '~~~~~~~',
        ],
    },
    {
        name: 'The Sword',
        hint: 'Armoured enemies only fall to a sword. Slide over one to pick it up.',
        par: 3,
        map: [
            '#######',
            '#P.../#',
            '#.....#',
            '#S...E#',
            '#######',
        ],
    },
    {
        name: 'Armoury',
        hint: 'Without a sword, an armoured enemy is just a wall.',
        par: 8,
        map: [
            '#######',
            '#.....#',
            '#.PE./#',
            '#...E.#',
            '#.S...#',
            '#######',
        ],
    },
    {
        name: 'The Wizard',
        hint: 'Press the Wizard button (Space) to teleport the wizard. It stops you like a wall.',
        par: 5,
        map: [
            '~~~~~~',
            '~.EPw~',
            '~E..W~',
            '~..#.~',
            '~~~~~~',
        ],
    },
    {
        name: 'Blink',
        hint: 'Teleports count as moves too.',
        par: 9,
        map: [
            '~~~~~~~',
            '~#.E.W~',
            '~....E~',
            '~E.Pw.~',
            '~.....~',
            '~~~~~~~',
        ],
    },
    {
        name: 'Courtyard',
        hint: 'Four enemies, one safe order.',
        par: 11,
        map: [
            '########',
            '#......#',
            '#...E..#',
            '#....E.#',
            '#..#EP.#',
            '##.E#..#',
            '########',
        ],
    },
    {
        name: 'Spellblade',
        hint: 'The wizard and the sword, together.',
        par: 12,
        map: [
            '~~~~~~~~',
            '~..SwE.~',
            '~##./..~',
            '~~...#.~',
            '~.P..E.~',
            '~..W...~',
            '~~~~~~~~',
        ],
    },
    {
        name: 'Twin Guards',
        hint: 'Each sword breaks one armour.',
        par: 14,
        map: [
            '########',
            '#../...#',
            '#......#',
            '#..P./S#',
            '#.E.~E.#',
            '#S#....#',
            '########',
        ],
    },
    {
        name: 'The Long Way',
        hint: 'Every stop matters.',
        par: 15,
        map: [
            '########',
            '#...#.E#',
            '#..E~.##',
            '##...EE#',
            '#......#',
            '#...P#.#',
            '########',
        ],
    },
    {
        name: 'Brainy Warrior',
        hint: 'Everything you have learned.',
        par: 17,
        map: [
            '#########',
            '#..#...##',
            '#......w#',
            '#.#.EP.W#',
            '#.E~/...#',
            '#E.S....#',
            '#########',
        ],
    },
];

const TILE_CHARS = { '~': TILE_TYPES.WATER, '#': TILE_TYPES.WALL, '=': TILE_TYPES.FENCE };
const ENTITY_CHARS = { E: ENTITY_TYPES.ENEMY, S: ENTITY_TYPES.STRONG_ENEMY, '/': ENTITY_TYPES.SWORD };

export function parseLevel({ name, hint, par, map }) {
    const level = { name, hint, par, grid: [], spawn: null, entities: [], wizard: null };
    const wizardSpots = [];
    map.forEach((row, z) => {
        level.grid.push([...row].map((ch, x) => {
            if (ch === 'P') level.spawn = { x, z };
            if (ENTITY_CHARS[ch]) level.entities.push({ type: ENTITY_CHARS[ch], x, z });
            if (ch === 'W') wizardSpots.unshift({ x, z });
            if (ch === 'w') wizardSpots.push({ x, z });
            return TILE_CHARS[ch] ?? TILE_TYPES.FLOOR;
        }));
    });
    if (wizardSpots.length) level.wizard = { positions: wizardSpots };
    return level;
}

export const LEVELS = MAPS.map(parseLevel);
