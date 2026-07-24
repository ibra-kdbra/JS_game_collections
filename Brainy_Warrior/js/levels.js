export const TILE_TYPES = {
    WATER: 0,
    FLOOR: 1,
    WALL: 2,
    FENCE: 3,
    START: 4
};

export const ENTITY_TYPES = {
    ENEMY: 'enemy',
    STRONG_ENEMY: 'strong_enemy',
    SWORD: 'sword'
};

export const LEVELS = [
    {
        name: "Level 1: The Slide",
        grid: [
            [0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 0],
            [0, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0]
        ],
        spawn: { x: 1, z: 1 },
        entities: [
            { type: ENTITY_TYPES.ENEMY, x: 4, z: 1 },
            { type: ENTITY_TYPES.ENEMY, x: 4, z: 3 }
        ],
        wizard: null
    },
    {
        name: "Level 2: The Blockers",
        grid: [
            [2, 2, 2, 2, 2, 2],
            [2, 1, 1, 1, 1, 2],
            [2, 1, 0, 0, 1, 2],
            [2, 1, 1, 1, 3, 2],
            [2, 2, 2, 2, 2, 2]
        ],
        spawn: { x: 1, z: 1 },
        entities: [
            { type: ENTITY_TYPES.ENEMY, x: 4, z: 1 },
            { type: ENTITY_TYPES.ENEMY, x: 1, z: 3 }
        ],
        wizard: null
    },
    {
        name: "Level 5: Wizard's Help",
        grid: [
            [0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 1, 0, 0, 0, 1, 1, 0],
            [0, 1, 1, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0]
        ],
        spawn: { x: 1, z: 1 },
        wizard: {
            positions: [
                { x: 4, z: 1 },
                { x: 4, z: 3 }
            ]
        },
        entities: [
            { type: ENTITY_TYPES.ENEMY, x: 6, z: 1 },
            { type: ENTITY_TYPES.ENEMY, x: 6, z: 3 }
        ]
    },
    {
        name: "Level 10: The Stronghold",
        grid: [
            [2, 2, 2, 2, 2, 2, 2],
            [2, 1, 1, 1, 1, 1, 2],
            [2, 1, 3, 1, 3, 1, 2],
            [2, 1, 1, 1, 1, 1, 2],
            [2, 2, 2, 2, 2, 2, 2]
        ],
        spawn: { x: 1, z: 1 },
        entities: [
            { type: ENTITY_TYPES.SWORD, x: 5, z: 2 },
            { type: ENTITY_TYPES.STRONG_ENEMY, x: 3, z: 3 },
            { type: ENTITY_TYPES.ENEMY, x: 1, z: 3 }
        ],
        wizard: {
            positions: [
                { x: 3, z: 1 },
                { x: 5, z: 3 }
            ]
        }
    }
];
