/*
width = 800
height = 450
*/

// The original hand-made terrain.
const classicTerrain = [
    [0,28],
    [10,15],
    [20,12],
    [40,12],
    [50,24],
    [60,50],
    [65,70],
    [80,70],
    [85,100],
    [90,110],
    [100,150],
    [110,140],
    [120,135],
    [135,135],
    [140,100],
    [150,105],
    [160,108],
    [170,100],
    [190,100],
    [200,60],
    [210,30],
    [215,25],
    [230,25],
    [240,30],
    [250,75],
    [260,80],
    [270,100],
    [280,120],
    [300,120],
    [310,160],
    [320,180],
    [340,180],
    [350,212],
    [360,215],
    [370,217],
    [380,215],
    [390,200],
    [400,140],
    [405,110],
    [410,140],
    [425,140],
    [430,70],
    [440,10],
    [460,10],
    [465,15],
    [470,20],
    [480,40],
    [495,40],
    [500,65],
    [510,80],
    [530,80],
    [540,70],
    [550,72],
    [560,70],
    [580,70],
    [590,45],
    [600,20],
    [610,18],
    [620,20],
    [640,20],
    [650,80],
    [660,92],
    [670,95],
    [690,95],
    [695,100],
    [700,140],
    [715,140],
    [720,130],
    [730,100],
    [740,105],
    [760,105],
    [770,108],
    [780,110],
    [790,115],
    [800,117]
    ];

// Small, fast seeded random number generator (mulberry32), so a seed always
// produces the same terrain.
function seededRandom(seed) {
    let a = seed >>> 0;
    return function() {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Rough slopes with a handful of flat landing pads spread across the width.
function generateTerrain(seed) {
    const random = seededRandom(seed);
    const between = (min, max) => min + random() * (max - min);

    const padCount = Math.floor(between(terrainPadCountMin, terrainPadCountMax + 1));
    const slot = gameWidth / padCount;
    const pads = [];
    for(let i = 0; i < padCount; i++) {
        const width = Math.round(between(terrainPadWidthMin, terrainPadWidthMax));
        const start = Math.round(i * slot + between(10, slot - width - 10));
        pads.push([start, start + width]);
    }

    // Heights drift around a slow wave so the ground has hills and valleys, and
    // bounce off the limits instead of flattening against them.
    const phase = between(0, Math.PI * 2);
    const waves = between(1.5, 3);
    const bounce = (h) => h < terrainHeightMin ? 2 * terrainHeightMin - h : h > terrainHeightMax ? 2 * terrainHeightMax - h : h;
    const targetAt = (px) => 120 + 80 * Math.sin(phase + px / gameWidth * waves * Math.PI * 2);
    const nextHeight = (px, y, spread) => {
        let h = bounce(y + (targetAt(px) - y) * 0.25 + between(-spread, spread));
        // Only pads are flat; nudge accidental flats into a slope.
        if(Math.abs(h - y) < 2) h = bounce(y + (random() < 0.5 ? -3 : 3));
        return Math.round(h);
    };

    const result = [];
    let x = 0;
    let y = Math.round(targetAt(0));
    let pad = 0;
    result.push([0, y]);
    while(x < gameWidth) {
        if(pad < pads.length && x + 20 >= pads[pad][0]) {
            // Climb or drop to the pad, then run flat across it.
            const [start, end] = pads[pad++];
            y = nextHeight(start, y, 50);
            if(start > x) result.push([start, y]);
            result.push([end, y]);
            x = end;
            continue;
        }
        x = Math.min(gameWidth, x + Math.round(between(8, 20)));
        // Mostly gentle, sometimes a cliff.
        y = nextHeight(x, y, random() < 0.15 ? 60 : 16);
        result.push([x, y]);
    }
    return result;
}
