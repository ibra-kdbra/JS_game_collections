let enemies = [];
let projectiles = [];
let systems = [];
let towers = [];
let flashes = [];
let newEnemies = [];
let newProjectiles = [];
let newTowers = [];

let cols;
let rows;
let ts = 24;            // tile size in pixels, fitted to the screen
let tileZoom = 2;
let zoomDefault = 24;
let randomTs = zoomDefault; // preferred tile size when generating random maps

let particleAmt = 32;   // number of particles to draw per explosion

let tempSpawnCount = 40;

let custom = null;      // custom map JSON (imported or from the editor)
let display;            // graphical display tiles
let displayDir;         // direction display tiles are facing
                        // (0 = none, 1 = left, 2 = up, 3 = right, 4 = down)
let dists;              // distance to exit
let grid;               // tile type
                        // (0 = empty, 1 = wall, 2 = path, 3 = tower,
                        //  4 = enemy-only pathing)
let metadata;           // tile metadata
let paths;              // direction to reach exit
let visitMap;           // whether exit can be reached
let walkMap;            // walkability map

let exit;
let spawnpoints = [];
let tempSpawns = [];

let cash;
let health;
let maxHealth;
let wave;

let spawnCool;          // number of ticks between spawning enemies

let bg;                 // background color
let border;             // color to draw on tile borders
let borderAlpha;        // alpha of tile borders

let selected;
let towerType;
let ghost = null;       // tile chosen by a first tap on touch screens
let lastPointer = matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse';

let difficulty;         // entry of difficulties (waves.js)
let gameMode;           // 'campaign' or 'endless'
let gameOver = false;
let speed = 1;          // logic steps per tick: 1x, 2x or 3x
let mapId = 'sparse2';  // chosen map (MAP_LIST in hud.js)
let modeId = 'campaign';
let diffId = 'normal';
let upcoming = null;    // pattern of the wave after the current one, for the preview
let started = false;    // whether the first wave has been released
let earlyBonus = 0;     // bonus paid for the wave that was just called early
let floaters = [];      // floating numbers: { x, y, text, color, life, size }
let hurt = 0;           // ticks left of the red edge flash after losing lives
let damageNumbers = true;
let stats;              // per-game totals for the end screen

let godMode = false;    // make player immortal for test purposes
let healthBar = true;   // display enemy health bar
let muteSounds = false; // whether to mute sounds
let paused;             // whether to update or not
let scd;                // number of ticks until next spawn cycle
let showEffects = true; // whether or not to display particle effects
let showFPS = false;    // whether or not to display FPS
let skipToNext = false; // whether or not to immediately start next wave
let stopFiring = false; // whether or not to pause towers firing
let toCooldown;         // flag to reset spawning cooldown
let toPathfind;         // flag to update enemy pathfinding
let toPlace;            // flag to place a tower
let toWait;             // flag to wait before next wave
let wcd;                // number of ticks until next wave

let avgFPS = 0;         // current average of all FPS values
let numFPS = 0;         // number of FPS values calculated so far

let minDist = 15;       // minimum distance between spawnpoint and exit
let resistance = 0.5;   // percentage of damage blocked by resistance
let sellConst = 0.8;    // ratio of tower cost to sell price
let wallCover = 0.1;    // percentage of map covered by walls
let weakness = 0.5;     // damage increase from weakness

const SLUG = 'tower-defense';
const store = GameKit.createStore(SLUG);
const stepper = GameKit.createStepper(60);
const holder = document.getElementById('sketch-holder');
const $ = (id) => document.getElementById(id);

GameKit.initShell({ slug: SLUG });


// Misc functions

// Spawn a group of enemies, alternating if multiple types
const addGroup = (group) => {
    const count = group.pop();
    for (let i = 0; i < count; i++) {
        for (let j = 0; j < group.length; j++) {
            newEnemies.push(group[j]);
        }
    }
}

// Prepare a wave (patterns are copied so the templates stay intact)
const addWave = (pattern) => {
    const copy = JSON.parse(JSON.stringify(pattern));
    spawnCool = copy.shift();
    for (let i = 0; i < copy.length; i++) {
        addGroup(copy[i]);
    }
}

// Buy and place a tower if player has enough money
const buy = (t) => {
    if (godMode || cash >= t.cost) {
        if (!godMode) cash -= t.cost;
        if (grid[t.gridPos.x][t.gridPos.y] === 0) toPathfind = true;
        newTowers.push(t);
        stats.built++;
        sfx('build');
        addFloater(t.pos.x, t.pos.y - ts * 0.3, `-$${t.cost}`, [250, 204, 21]);
        ghost = null;
        // Keep building the same tower while another one is affordable
        if (!godMode && cash < t.cost) {
            toPlace = false;
            selected = t;
        }
        updateInfo();
    } else {
        sfx('error');
        toast(`Not enough gold: ${t.title} costs $${t.cost}`, 'error');
    }
}

// Floating text on the map (damage, gold, lives)
function addFloater(x, y, text, color, size = 1) {
    if (floaters.length > 120) floaters.shift();
    floaters.push({ x, y, text, color, size, life: 45 });
}

// Hooks called by enemies (enemy.js)
const typeColors = {
    physical: [244, 244, 245],
    energy: [0, 240, 255],
    explosion: [255, 153, 0],
    piercing: [216, 180, 254],
    poison: [132, 204, 22]
};

function onEnemyHit(e, dealt, type) {
    if (!damageNumbers || dealt < 25) return;
    addFloater(e.pos.x + (Math.random() - 0.5) * ts * 0.4, e.pos.y - ts * 0.35,
        String(Math.round(dealt)), typeColors[type] || typeColors.physical, 0.9);
}

function onEnemyKilled(e) {
    stats.kills++;
    stats.earned += e.cash;
    if (e.cash > 0) addFloater(e.pos.x, e.pos.y, `+$${e.cash}`, [250, 204, 21], 0.8);
}

function onEnemyLeaked(e) {
    if (godMode) return;
    stats.leaked += e.damage;
    hurt = 24;
    sfx('leak');
    const c = center(exit.x, exit.y);
    addFloater(c.x, c.y - ts * 0.4, `-${e.damage}`, [248, 113, 113], 1.2);
    flashLives();
}

// Calculate and display current and average FPS
const calcFPS = () => {
    const fps = frameRate();
    avgFPS += (fps - avgFPS) / ++numFPS;

    // Draw black rect under text
    noStroke();
    fill(0);
    rect(0, height - 40, 70, 40);

    // Update FPS meter
    fill(255);
    const fpsText = `FPS: ${fps.toFixed(2)}\nAvg: ${avgFPS.toFixed(2)}`;
    text(fpsText, 5, height - 25);
}

// Why a tower cannot go on a tile, or null if it can
const placeReason = (col, row) => {
    const g = grid[col][row];
    if (getTower(col, row)) return 'A tower is already here';
    if (g === 3) return null;
    if (g === 1) return 'Cannot build on walls';
    if (g === 2 || g === 4) return 'Enemy road: no building';
    if (!empty(col, row)) return 'Spawn and exit tiles stay clear';
    if (!placeable(col, row)) return 'That would block the only path';
    return null;
}

// Check if all conditions for placing a tower are true
const canPlace = (col, row) => toPlace && placeReason(col, row) === null;

// Check if spawn cooldown is done and enemies are available to spawn
const canSpawn = () => {
    return newEnemies.length > 0 && scd === 0;
}

// Pattern for the wave after the current one
const rollWave = () => gameMode === 'campaign' ? (campaignWaves[wave] || null) : randomWave();

// Check if tile is empty
const empty = (col, row) => {
    // Check if not walkable
    if (!walkable(col, row)) return false;

    // Check if spawnpoint
    for (let i = 0; i < spawnpoints.length; i++) {
        const s = spawnpoints[i];
        if (s.x === col && s.y === row) return false;
    }

    // Check if exit
    if (exit !== undefined) {
        if (exit.x === col && exit.y === row) return false;
    }

    return true;
}

// Return map string
const exportMap = () => {
    const mapData = {
        // Grids
        display,
        displayDir,
        grid,
        metadata,
        paths,
        // Important tiles
        exit: [exit.x, exit.y],
        spawnpoints: spawnpoints.map(s => [s.x, s.y]),
        // Colors
        bg,
        border,
        borderAlpha,
        // Misc
        cols,
        rows
    };
    return LZString.compressToBase64(JSON.stringify(mapData));
};

// Get an empty tile
const getEmpty = () => {
    while (true) {
        const t = randomTile();
        if (empty(t.x, t.y)) return t;
    }
}

// Find tower at specific tile, otherwise return null
const getTower = (col, row) => {
    return towers.concat(newTowers).find(t => t.alive && t.gridPos.x === col && t.gridPos.y === row) || null;
}

// Return map of visitability
const getVisitMap = (walkMap) => {
    const frontier = [];
    const target = vts(exit);
    frontier.push(target);
    const visited = {};
    visited[target] = true;

    // Fill visited for every tile
    while (frontier.length !== 0) {
        const current = frontier.shift();
        const t = stv(current);
        const adj = neighbors(walkMap, t.x, t.y, true);

        adj.forEach(next => {
            if (!(next in visited)) {
                frontier.push(next);
                visited[next] = true;
            }
        });
    }

    return visited;
}

// Return walkability map
const getWalkMap = () => {
    const walkMap = [];
    for (let x = 0; x < cols; x++) {
        walkMap[x] = [];
        for (let y = 0; y < rows; y++) {
            walkMap[x][y] = walkable(x, y);
        }
    }
    return walkMap;
}

// Decode a map string; returns null if it is not a valid map
const parseMap = (str) => {
    try {
        const m = JSON.parse(LZString.decompressFromBase64(str.trim()));
        const ok = m && Array.isArray(m.grid) && Array.isArray(m.spawnpoints) && m.spawnpoints.length > 0 &&
            Array.isArray(m.exit) && m.cols === m.grid.length && m.rows === m.grid[0].length;
        return ok ? m : null;
    } catch (err) {
        return null;
    }
};

// Make a map string the Custom map and start playing it
const importMap = (str) => {
    const m = parseMap(str);
    if (!m) {
        toast('That is not a valid map string', 'error');
        return false;
    }
    custom = m;
    store.set('customMap', str.trim());
    mapId = 'custom';
    savePrefs();
    resetGame();
    toast('Map imported', 'ok');
    return true;
};

function showImportMapPrompt() {
    textDialog({
        title: 'Paste a map string',
        placeholder: 'Map string from Export or the map editor',
        confirmLabel: 'Import and play'
    }).then(str => {
        if (str) importMap(str);
    });
}

function showExportMap() {
    textDialog({ title: 'Map string', value: exportMap(), readOnly: true });
}

// Check if wave is at least min and less than max
const isWave = (min, max) => {
    if (max === undefined) return wave >= min;
    return wave >= min && wave < max;
}


// Copy a map template into the game state
function applyMap(m) {
    // Grids
    display = copyArray(m.display);
    displayDir = copyArray(m.displayDir);
    grid = copyArray(m.grid);
    metadata = copyArray(m.metadata);
    paths = copyArray(m.paths);
    // Important tiles
    exit = createVector(m.exit[0], m.exit[1]);
    spawnpoints = m.spawnpoints.map(s => createVector(s[0], s[1]));
    // Colors
    bg = m.bg;
    border = m.border;
    borderAlpha = m.borderAlpha;
    // Misc
    cols = m.cols;
    rows = m.rows;
}

// Load map from template
// Always have an exit and spawnpoints if you do not have a premade grid
function loadMap() {
    let name = mapId;
    if (name === 'custom' && !custom) name = mapId = 'sparse2';

    if (name === 'custom') {
        applyMap(custom);
    } else if (name in maps) {
        applyMap(maps[name]);
    } else {
        const w = holder.clientWidth || 600;
        const h = holder.clientHeight || 400;
        cols = Math.max(8, Math.floor(w / randomTs));
        rows = Math.max(8, Math.floor(h / randomTs));
        const numSpawns = name.endsWith('3') ? 3 : 2;
        if (name.startsWith('empty')) wallCover = 0;
        if (name.startsWith('sparse')) wallCover = 0.1;
        if (name.startsWith('dense')) wallCover = 0.2;
        if (name.startsWith('solid')) wallCover = 0.3;
        minDist = Math.min(15, Math.floor(Math.max(cols, rows) * 0.6));
        randomMap(numSpawns);
        display = replaceArray(
            grid, [0, 1, 2, 3, 4], ['empty', 'wall', 'empty', 'tower', 'empty']
        );
        displayDir = buildArray(cols, rows, 0);
        paths = buildArray(cols, rows, 0);
        // Colors
        bg = [0, 0, 0];
        border = 255;
        borderAlpha = 31;
        // Misc
        metadata = buildArray(cols, rows, null);
    }

    tempSpawns = [];
    fitCanvas();
    recalculate();

    if (spawnpoints.some(s => dists[s.x][s.y] === null)) {
        toast('Warning: a spawnpoint cannot reach the exit on this map', 'error');
    }
}

// Increment wave counter and prepare wave
function nextWave() {
    if (gameMode === 'campaign' && wave >= campaignWaves.length) return;
    addWave(upcoming || rollWave());
    wave++;
    upcoming = rollWave();
}

// Check if no more enemies
function noMoreEnemies() {
    return enemies.length === 0 && newEnemies.length === 0;
}

function outsideMap(e) {
    return outsideRect(e.pos.x, e.pos.y, 0, 0, width, height);
}

// Toggle pause state
function pause() {
    if (gameOver) return;
    paused = !paused;
    if (!paused && !started) {
        started = true;
        announceWave();
    }
    stepper.reset();
    updateControls();
}

// Return false if blocking a tile would invalidate paths to exit
function placeable(col, row) {
    const walkMap = getWalkMap();
    walkMap[col][row] = false;
    const visitMap = getVisitMap(walkMap);

    // Check spawnpoints
    if (spawnpoints.some(s => !visitMap[vts(s)])) return false;

    // Check each enemy
    if (enemies.some(e => {
        const p = gridPos(e.pos.x, e.pos.y);
        return !p.equals(col, row) && !visitMap[vts(p)];
    })) return false;

    return true;
}

// Generate random map
function randomMap(numSpawns) {
    // Generate empty tiles and walls
    grid = Array.from({ length: cols }, () =>
        Array.from({ length: rows }, () => random() < wallCover ? 1 : 0)
    );
    walkMap = getWalkMap();

    // Generate exit and remove walls that are adjacent
    exit = getEmpty();
    const adj = neighbors(walkMap, exit.x, exit.y, false);
    adj.forEach(n => {
        const coord = stv(n);
        grid[coord.x][coord.y] = 0;
    });

    // Generate enemy spawnpoints and ensure exit is possible
    spawnpoints = [];
    const visitMap = getVisitMap(getWalkMap());
    for (let i = 0; i < numSpawns; i++) {
        let s;
        // Try to place spawnpoint
        for (let j = 0; j < 100; j++) {
            s = getEmpty();
            while (!visitMap[vts(s)]) s = getEmpty();
            if (s.dist(exit) >= minDist) break;
        }
        spawnpoints.push(s);
    }
}

// Random grid coordinate
function randomTile() {
    return createVector(randint(cols), randint(rows));
}


// Generate a random wave
function randomWave() {
    const waves = [];

    if (isWave(0, 3)) waves.push([40, ['weak', 50]]);
    if (isWave(2, 4)) waves.push([20, ['weak', 25]]);
    if (isWave(2, 7)) {
        waves.push([30, ['weak', 25], ['strong', 25]]);
        waves.push([20, ['strong', 25]]);
    }
    if (isWave(3, 7)) waves.push([40, ['fast', 25]]);
    if (isWave(4, 14)) waves.push([20, ['fast', 50]]);
    if (isWave(5, 6)) waves.push([20, ['strong', 50], ['fast', 25]]);
    if (isWave(8, 12)) waves.push([20, ['medic', 'strong', 'strong', 25]]);
    if (isWave(10, 13)) {
        waves.push([20, ['medic', 'strong', 'strong', 50]]);
        waves.push([30, ['medic', 'strong', 'strong', 50], ['fast', 50]]);
        waves.push([5, ['fast', 50]]);
    }
    if (isWave(12, 16)) {
        waves.push([20, ['medic', 'strong', 'strong', 50], ['strongFast', 50]]);
        waves.push([10, ['strong', 50], ['strongFast', 50]]);
        waves.push([10, ['medic', 'strongFast', 50]]);
        waves.push([10, ['strong', 25], ['stronger', 25], ['strongFast', 50]]);
        waves.push([10, ['strong', 25], ['medic', 25], ['strongFast', 50]]);
        waves.push([20, ['medic', 'stronger', 'stronger', 50]]);
        waves.push([10, ['medic', 'stronger', 'strong', 50]]);
        waves.push([10, ['medic', 'strong', 50], ['medic', 'strongFast', 50]]);
        waves.push([5, ['strongFast', 100]]);
        waves.push([20, ['stronger', 50]]);
    }
    if (isWave(13, 20)) {
        waves.push([40, ['tank', 'stronger', 'stronger', 'stronger', 10]]);
        waves.push([10, ['medic', 'stronger', 'stronger', 50]]);
        waves.push([40, ['tank', 25]]);
        waves.push([20, ['tank', 'stronger', 'stronger', 50]]);
        waves.push([20, ['tank', 'medic', 50], ['strongFast', 25]]);
    }
    if (isWave(14, 20)) {
        waves.push([20, ['tank', 'stronger', 'stronger', 50]]);
        waves.push([20, ['tank', 'medic', 'medic', 50]]);
        waves.push([20, ['tank', 'medic', 50], ['strongFast', 25]]);
        waves.push([10, ['tank', 50], ['strongFast', 25]]);
        waves.push([10, ['faster', 50]]);
        waves.push([20, ['tank', 50], ['faster', 25]]);
    }
    if (isWave(17, 25)) {
        waves.push([20, ['taunt', 'stronger', 'stronger', 'stronger', 25]]);
        waves.push([20, ['spawner', 'stronger', 'stronger', 'stronger', 25]]);
        waves.push([20, ['taunt', 'tank', 'tank', 'tank', 25]]);
        waves.push([40, ['taunt', 'tank', 'tank', 'tank', 25]]);
    }
    if (isWave(19)) {
        waves.push([20, ['spawner', 1], ['tank', 20], ['stronger', 25]]);
        waves.push([20, ['spawner', 1], ['faster', 25]]);
    }
    if (isWave(23)) {
        waves.push([20, ['taunt', 'medic', 'tank', 25]]);
        waves.push([20, ['spawner', 2], ['taunt', 'medic', 'tank', 25]]);
        waves.push([10, ['spawner', 1], ['faster', 100]]);
        waves.push([5, ['faster', 100]]);
        waves.push([20, ['tank', 100], ['faster', 50], ['taunt', 'tank', 'tank', 'tank', 50]]);
        waves.push([10, ['taunt', 'stronger', 'tank', 'stronger', 50], ['faster', 50]]);
    }
    if (isWave(25)) {
        waves.push([5, ['taunt', 'medic', 'tank', 50], ['faster', 50]]);
        waves.push([5, ['taunt', 'faster', 'faster', 'faster', 50]]);
        waves.push([10, ['taunt', 'tank', 'tank', 'tank', 50], ['faster', 50]]);
    }
    if (isWave(30)) {
        waves.push([5, ['taunt', 'faster', 'faster', 'faster', 50]]);
        waves.push([5, ['taunt', 'tank', 'tank', 'tank', 50]]);
        waves.push([5, ['taunt', 'medic', 'tank', 'tank', 50]]);
        waves.push([1, ['faster', 200]]);
    }
    if (isWave(35)) waves.push([0, ['taunt', 'faster', 200]]);

    return random(waves);
}

// Recalculate pathfinding maps
// Algorithm from https://www.redblobgames.com/pathfinding/tower-defense/
function recalculate() {
    walkMap = getWalkMap();
    const frontier = [];
    const target = vts(exit);
    frontier.push(target);

    const cameFrom = {};
    const distance = {};
    cameFrom[target] = null;
    distance[target] = 0;

    // Fill cameFrom and distance for every tile
    while (frontier.length !== 0) {
        const current = frontier.shift();
        const t = stv(current);
        const adj = neighbors(walkMap, t.x, t.y, true);

        for (let i = 0; i < adj.length; i++) {
            const next = adj[i];
            if (!(next in cameFrom) || !(next in distance)) {
                frontier.push(next);
                cameFrom[next] = current;
                distance[next] = distance[current] + 1;
            }
        }
    }

    // Generate usable maps
    dists = buildArray(cols, rows, null);
    const newPaths = buildArray(cols, rows, 0);
    const keys = Object.keys(cameFrom);
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const current = stv(key);

        // Distance map
        dists[current.x][current.y] = distance[key];

        // Generate path direction for every tile
        const val = cameFrom[key];
        if (val !== null) {
            // Subtract vectors to determine direction
            const next = stv(val);
            const dir = next.sub(current);
            // Fill tile with direction
            if (dir.x < 0) newPaths[current.x][current.y] = 1;
            if (dir.y < 0) newPaths[current.x][current.y] = 2;
            if (dir.x > 0) newPaths[current.x][current.y] = 3;
            if (dir.y > 0) newPaths[current.x][current.y] = 4;
        }
    }

    // Preserve old paths on path tiles
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            if (grid[x][y] === 2) newPaths[x][y] = paths[x][y];
        }
    }

    paths = newPaths;
}

function resetGame() {
    closeOverlay('end');
    difficulty = difficulties[diffId] || difficulties.normal;
    gameMode = modeId;
    // Clear all entities
    enemies = [];
    projectiles = [];
    systems = [];
    towers = [];
    flashes = [];
    newEnemies = [];
    newProjectiles = [];
    newTowers = [];
    selected = null;
    ghost = null;
    floaters = [];
    hurt = 0;
    upcoming = null;
    started = false;
    earlyBonus = 0;
    stats = { kills: 0, leaked: 0, built: 0, earned: 0, upgrades: 0 };
    loadMap();
    // Reset all stats
    health = difficulty.health;
    maxHealth = health;
    cash = difficulty.cash;
    wave = 0;
    // Reset all flags
    gameOver = false;
    paused = true;
    scd = 0;
    wcd = 0;
    toCooldown = false;
    toPathfind = false;
    toPlace = false;
    toWait = false;
    stepper.reset();
    // Start game
    nextWave();
    updateInfo();
    updateControls();
    updateBest();
}

// Change the tile size, keeping every entity on the same tile
function rescale(newTs) {
    const k = newTs / ts;
    ts = newTs;
    enemies.forEach(e => {
        e.pos.mult(k);
        e.vel.mult(k);
    });
    towers.concat(newTowers).forEach(t => {
        t.pos = center(t.gridPos.x, t.gridPos.y);
    });
    projectiles.concat(newProjectiles).forEach(p => {
        p.pos.mult(k);
        p.vel.mult(k);
        p.length *= k;
        p.width *= k;
        p.topSpeed /= k;
    });
    floaters.forEach(f => {
        f.x *= k;
        f.y *= k;
    });
    systems = [];
    flashes = [];
}

// Size the tiles so the whole map fits the space available
function fitCanvas() {
    if (!cols || !rows) return;
    const w = holder.clientWidth;
    const h = holder.clientHeight;
    if (!w || !h) return;
    const newTs = Math.max(4, Math.floor(Math.min(w / cols, h / rows)));
    if (newTs !== ts) rescale(newTs);
    if (width !== cols * ts || height !== rows * ts) resizeCanvas(cols * ts, rows * ts, true);
}

// Sell a tower
function sell(t) {
    selected = null;
    if (grid[t.gridPos.x][t.gridPos.y] === 0) toPathfind = true;
    const price = t.sellPrice();
    cash += price;
    t.kill();
    sfx('sell');
    addFloater(t.pos.x, t.pos.y, `+$${price}`, [250, 204, 21]);
    updateInfo();
}

// Set a tower to place
function setPlace(t) {
    // Picking the same tower again puts it away
    if (toPlace && towerType === t) {
        cancelPlace();
        return;
    }
    towerType = t;
    toPlace = true;
    selected = null;
    ghost = null;
    sfx('click');
    updateInfo();
}

// Leave placement mode and deselect
function cancelPlace() {
    toPlace = false;
    selected = null;
    ghost = null;
    updateInfo();
}

// Visualize range of tower: the circle enemies' centres must enter (see getInRange)
function showRange(t, cx, cy, ok = true) {
    const d = (t.range + 1) * ts * 2;
    noStroke();
    if (ok) fill(t.color[0], t.color[1], t.color[2], 46);
    else fill(248, 113, 113, 40);
    ellipse(cx, cy, d, d);
    noFill();
    stroke(255, 255, 255, 170);
    strokeWeight(Math.max(1, ts / 20));
    drawingContext.setLineDash([Math.max(3, ts / 4), Math.max(3, ts / 5)]);
    ellipse(cx, cy, d, d);
    drawingContext.setLineDash([]);
    strokeWeight(1);
}

// Upgrade tower
function upgrade(t) {
    if (godMode || cash >= t.cost) {
        if (!godMode) cash -= t.cost;
        selected.upgrade(t);
        selected.upgrades = t.upgrades ? t.upgrades : [];
        stats.upgrades++;
        sfx('upgrade');
        addFloater(selected.pos.x, selected.pos.y - ts * 0.3, 'UP!', [250, 204, 21], 0.9);
        updateInfo();
    } else {
        sfx('error');
        toast(`Not enough gold: the upgrade costs $${t.cost}`, 'error');
    }
}

// Return whether tile is walkable
function walkable(col, row) {
    // Check if wall or tower-only tile
    if (grid[col][row] === 1 || grid[col][row] === 3) return false;
    // Check if tower
    if (getTower(col, row)) return false;
    return true;
}

// Give an enemy its difficulty and endless-mode health
function scaleEnemy(e) {
    let mult = difficulty.hp;
    if (gameMode === 'endless' && wave > campaignWaves.length) {
        mult *= 1 + endlessHpGrowth * (wave - campaignWaves.length);
    }
    e.health *= mult;
    e.maxHealth = e.health;
    return e;
}

// Call the next wave now for a little bonus cash
function callNextWave() {
    if (!toWait || gameOver) return;
    const bonus = Math.ceil(wcd / earlyCallTicks);
    cash += bonus;
    earlyBonus = bonus;
    wcd = 0;
    if (paused) pause();
}

// Gold for calling the next wave right now
const earlyCallBonus = () => toWait && !gameOver ? Math.ceil(wcd / earlyCallTicks) : 0;

function setSpeed(n) {
    speed = n;
    updateControls();
}

function cycleSpeed() {
    setSpeed(speed % 3 + 1);
}


// Game logic: one fixed step (1/60 s)

function tick() {
    if (scd > 0) scd--;
    if (wcd > 0 && toWait) wcd--;
    if (hurt > 0) hurt--;

    // Spawn enemies
    if (canSpawn()) {
        // Spawn same enemy for each spawnpoint
        const name = newEnemies.shift();
        for (let i = 0; i < spawnpoints.length; i++) {
            const s = spawnpoints[i];
            const c = center(s.x, s.y);
            enemies.push(scaleEnemy(createEnemy(c.x, c.y, enemy[name])));
        }

        // Temporary spawnpoints
        for (let i = 0; i < tempSpawns.length; i++) {
            const s = tempSpawns[i];
            if (s[1] === 0) continue;
            s[1]--;
            const c = center(s[0].x, s[0].y);
            enemies.push(scaleEnemy(createEnemy(c.x, c.y, enemy[name])));
        }

        // Reset cooldown
        toCooldown = true;
    }

    // Update enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.steer();
        e.update();
        e.onTick();

        // Kill if outside map
        if (outsideMap(e)) e.kill();

        // If at exit tile, kill and reduce player health
        if (atTileCenter(e.pos.x, e.pos.y, exit.x, exit.y)) e.onExit();

        if (e.isDead()) enemies.splice(i, 1);
    }

    // Towers target enemies and update cooldowns
    for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.isDead()) {
            towers.splice(i, 1);
            continue;
        }
        t.target(enemies);
        t.update();
    }

    // Particle systems
    for (let i = systems.length - 1; i >= 0; i--) {
        systems[i].update();
        if (systems[i].isDead()) systems.splice(i, 1);
    }

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.steer();
        p.update();

        // Attack target
        if (p.alive && p.reachedTarget()) p.explode();

        // Kill if outside map
        if (outsideMap(p)) p.kill();

        if (p.isDead()) projectiles.splice(i, 1);
    }

    removeTempSpawns();
    applyPending();

    if (health <= 0) {
        health = 0;
        endGame(false);
        return;
    }

    // Start next wave
    if (toWait && wcd === 0 || skipToNext && newEnemies.length === 0) {
        toWait = false;
        wcd = 0;
        nextWave();
        announceWave();
    }

    // Wave cleared: wait for the next one
    if (noMoreEnemies() && !toWait) {
        recordWave(wave);
        if (gameMode === 'campaign' && wave >= campaignWaves.length) {
            endGame(true);
            return;
        }
        wcd = difficulty.waveCool;
        toWait = true;
        waveCleared();
        updateControls();
    }

    // Reset spawn cooldown
    if (toCooldown) {
        scd = spawnCool;
        toCooldown = false;
    }
}

// Changes that must apply even while paused (building, selling)
function applyPending() {
    if (newProjectiles.length) projectiles = projectiles.concat(newProjectiles);
    if (newTowers.length) towers = towers.concat(newTowers);
    newProjectiles = [];
    newTowers = [];
    if (towers.some(t => t.isDead())) towers = towers.filter(t => !t.isDead());

    // Recalculate pathfinding
    if (toPathfind) {
        recalculate();
        toPathfind = false;
    }
}


// Main p5 functions

function setup() {
    const canvas = createCanvas(holder.clientWidth || 300, holder.clientHeight || 300);
    canvas.parent('sketch-holder');
    canvas.elt.addEventListener('pointerdown', onCanvasPointer);
    canvas.elt.addEventListener('contextmenu', e => e.preventDefault());
    textFont('Chakra Petch');
    textStyle(BOLD);

    const fromLink = loadPrefs();
    resetGame();
    if (!fromLink) openLevels();

    new ResizeObserver(() => fitCanvas()).observe(holder);
}

function draw() {
    if (!paused && !gameOver) {
        stepper.advance(performance.now(), () => {
            for (let i = 0; i < speed && !gameOver; i++) tick();
        });
    } else {
        stepper.reset();
        applyPending();
    }
    render();
    updateStatus();
    // Floating text drifts in real time, so it also clears while paused
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.y -= ts / 48;
        if (--f.life <= 0) floaters.splice(i, 1);
    }
}

function render() {
    background(bg);

    // Draw basic tiles
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            const t = tiles[display[x][y]];
            if (typeof t === 'function') {
                t(x, y, displayDir[x][y]);
            } else {
                stroke(border, borderAlpha);
                t ? fill(t) : noFill();
                rect(x * ts, y * ts, ts, ts);
            }
        }
    }

    // Spawnpoints (green), temporary spawnpoints (purple) and the exit (red)
    spawnpoints.forEach(s => drawMarker(s.x, s.y, [0, 230, 64]));
    tempSpawns.forEach(([s]) => drawMarker(s.x, s.y, [155, 32, 141]));
    drawMarker(exit.x, exit.y, [207, 0, 15], true);

    enemies.forEach(e => e.draw());
    enemies.forEach(e => e.drawHit());
    if (healthBar) enemies.forEach(e => e.drawHealth());

    // Range of the selected tower
    if (selected && !toPlace && selected.alive) showRange(selected, selected.pos.x, selected.pos.y);

    towers.forEach(t => t.draw());

    // Outline the selected tower
    if (selected && !toPlace && selected.alive) {
        noFill();
        stroke(250, 204, 21);
        strokeWeight(Math.max(2, ts / 10));
        rect(selected.gridPos.x * ts + 1, selected.gridPos.y * ts + 1, ts - 2, ts - 2);
        strokeWeight(1);
    }

    if (showEffects) systems.forEach(s => s.draw());
    projectiles.forEach(p => p.draw());

    // Shots and blasts queued by the last logic steps
    flashes.forEach(f => {
        if (f.line) {
            stroke(f.color);
            strokeWeight(f.weight);
            line(...f.line);
            strokeWeight(1);
        } else {
            noStroke();
            fill(f.color);
            ellipse(f.circle[0], f.circle[1], f.circle[2], f.circle[2]);
        }
    });
    if (!paused) flashes = [];

    drawPlacement();
    drawFloaters();

    // Red edge when lives are lost
    if (hurt > 0) {
        noFill();
        stroke(248, 113, 113, hurt * 9);
        strokeWeight(Math.max(6, ts / 3));
        rect(0, 0, width, height);
        strokeWeight(1);
    }

    // Update FPS meter
    if (showFPS) calcFPS();

    // Show if god mode active
    if (godMode) {
        noStroke();
        fill(0);
        rect(0, 0, 112, 22);
        fill(255);
        textSize(12);
        textAlign(LEFT, BASELINE);
        text('God Mode Active', 5, 15);
    }

    // Show if towers are disabled
    if (stopFiring) {
        noStroke();
        fill(0);
        rect(width - 70, 0, 70, 22);
        fill(255);
        textSize(12);
        textAlign(LEFT, BASELINE);
        text('Firing off', width - 65, 15);
    }
}

// Spawn and exit tiles with an inner ring so they read at any size
function drawMarker(x, y, color, isExit = false) {
    stroke(255);
    strokeWeight(1);
    fill(color);
    rect(x * ts, y * ts, ts, ts);
    if (ts < 10) return;
    noFill();
    stroke(9, 9, 11, 200);
    strokeWeight(Math.max(1.5, ts / 12));
    const c = center(x, y);
    if (isExit) {
        rect(c.x - ts * 0.22, c.y - ts * 0.22, ts * 0.44, ts * 0.44);
    } else {
        ellipse(c.x, c.y, ts * 0.45, ts * 0.45);
    }
    strokeWeight(1);
}

// Preview of the tower being placed: range, ghost, buildable tint and price
let lastPlaceKey = '';
function drawPlacement() {
    const p = placementTile();
    const key = p ? `${p.x},${p.y},${towerType}` : '';
    if (key !== lastPlaceKey) {
        lastPlaceKey = key;
        updatePlaceStatus();
    }
    if (!p) return;

    const t = createTower(p.x, p.y, tower[towerType]);
    const c = t.pos;
    const reason = placeReason(p.x, p.y);
    const afford = godMode || cash >= t.cost;
    const ok = !reason;
    showRange(t, c.x, c.y, ok && afford);

    noStroke();
    if (ok && afford) fill(74, 222, 128, 80);
    else fill(248, 113, 113, 110);
    rect(p.x * ts, p.y * ts, ts, ts);

    if (ok) {
        drawingContext.save();
        drawingContext.globalAlpha = afford ? 0.8 : 0.45;
        t.draw();
        drawingContext.restore();
    } else {
        // Red X
        push();
        translate(c.x, c.y);
        rotate(PI / 4);
        noStroke();
        fill(207, 0, 15);
        const edge = 0.1 * ts;
        const len = 0.9 * ts / 2;
        rect(-edge, len, edge * 2, -len * 2);
        rotate(PI / 2);
        rect(-edge, len, edge * 2, -len * 2);
        pop();
    }

    // Tile chosen by a first tap waits for confirmation
    if (ghost) {
        noFill();
        stroke(255);
        strokeWeight(2);
        rect(p.x * ts, p.y * ts, ts, ts);
        strokeWeight(1);
    }

    // Price tag above the tile
    const label = `$${t.cost}`;
    const size = Math.max(11, Math.min(16, ts * 0.5));
    textSize(size);
    textAlign(CENTER, CENTER);
    const w = textWidth(label) + 10;
    const h = size + 6;
    let ty = p.y * ts - h / 2 - 3;
    if (ty - h / 2 < 0) ty = (p.y + 1) * ts + h / 2 + 3;
    const tx = constrain(c.x, w / 2, width - w / 2);
    noStroke();
    fill(9, 9, 11, 230);
    rect(tx - w / 2, ty - h / 2, w, h, 4);
    fill(afford ? color(250, 204, 21) : color(248, 113, 113));
    text(label, tx, ty + 1);
}

function drawFloaters() {
    if (!floaters.length) return;
    textAlign(CENTER, CENTER);
    stroke(9, 9, 11);
    floaters.forEach(f => {
        const a = Math.min(255, f.life * 12);
        textSize(Math.max(10, Math.min(18, ts * 0.5)) * f.size);
        strokeWeight(3);
        fill(f.color[0], f.color[1], f.color[2], a);
        stroke(9, 9, 11, a);
        text(f.text, f.x, f.y);
    });
    strokeWeight(1);
}

// Tile where the tower being placed would go: mouse hover or the first tap
function placementTile() {
    if (!toPlace || typeof towerType === 'undefined') return null;
    if (ghost) return ghost;
    if (lastPointer === 'mouse' && mouseInMap()) return gridPos(mouseX, mouseY);
    return null;
}

// Build on the tile chosen by a first tap (the inspector's Build button)
function confirmGhost() {
    if (!ghost) return;
    const p = ghost;
    ghost = null;
    tryBuild(p);
}

function tryBuild(p) {
    const reason = placeReason(p.x, p.y);
    if (reason) {
        sfx('error');
        toast(reason, 'error');
        updateInfo();
        return;
    }
    buy(createTower(p.x, p.y, tower[towerType]));
}


// User input

function onCanvasPointer(e) {
    lastPointer = e.pointerType;
    // Right click cancels building and deselects
    if (e.button === 2) {
        cancelPlace();
        return;
    }
    if (e.button !== 0) return;
    const r = e.target.getBoundingClientRect();
    const x = (e.clientX - r.left) * width / r.width;
    const y = (e.clientY - r.top) * height / r.height;
    const p = gridPos(x, y);
    if (p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows) return;

    const t = getTower(p.x, p.y);
    if (t) {
        // Clicked on tower
        selected = t;
        toPlace = false;
        ghost = null;
        sfx('click');
        updateInfo();
        return;
    }

    if (!toPlace) {
        if (selected) cancelPlace();
        return;
    }

    // Mouse builds on click; touch shows the range first and builds on a second tap
    if (e.pointerType !== 'mouse' && !(ghost && ghost.equals(p.x, p.y))) {
        ghost = p;
        updateInfo();
        return;
    }
    ghost = null;
    tryBuild(p);
}

const towerKeys = { 1: 'gun', 2: 'laser', 3: 'slow', 4: 'sniper', 5: 'rocket', 6: 'bomb', 7: 'tesla' };

function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) {
        if (e.key !== 'Escape') return;
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    // Menus take Escape (and Space to resume from the pause menu)
    if (openOverlayId()) {
        if (key === 'Escape') {
            e.preventDefault();
            closeTopOverlay();
        }
        return;
    }

    if (towerKeys[key]) {
        setPlace(towerKeys[key]);
        return;
    }
    switch (key) {
        case 'Escape':
            if (toPlace || selected) cancelPlace();
            else openMenu();
            break;
        case ' ':
            // Drop focus from any clicked button so it isn't also activated
            e.preventDefault();
            if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
            pause();
            break;
        case 'c':
            cycleTarget();
            break;
        case 'f':
            showFPS = !showFPS;
            break;
        case 'g':
            godMode = !godMode;
            break;
        case 'h':
            healthBar = !healthBar;
            savePrefs();
            break;
        case 'm':
            showImportMapPrompt();
            break;
        case 'n':
            callNextWave();
            break;
        case 'p':
            showEffects = !showEffects;
            if (!showEffects) systems = [];
            savePrefs();
            break;
        case 'q':
            stopFiring = !stopFiring;
            break;
        case 'r':
            resetGame();
            break;
        case 's':
            if (selected) sell(selected);
            break;
        case 't':
            cycleSpeed();
            break;
        case 'u':
            if (selected && selected.upgrades.length > 0) upgrade(selected.upgrades[0]);
            break;
        case 'v':
            toggleMute();
            break;
        case 'w':
            skipToNext = !skipToNext;
            savePrefs();
            toast(skipToNext ? 'Waves start back to back' : 'Pause between waves', 'info');
            break;
        case 'x':
            showExportMap();
            break;
        case 'z':
            randomTs = zoomDefault;
            resetGame();
            break;
        case '[':
            if (randomTs > 16) {
                randomTs -= tileZoom;
                resetGame();
            }
            break;
        case ']':
            if (randomTs < 40) {
                randomTs += tileZoom;
                resetGame();
            }
            break;
    }
}

// Selected tower's targeting: First, Last, Strongest, Closest
function cycleTarget() {
    if (!selected || !hasTargeting(selected)) return;
    const modes = Object.keys(targetModes);
    setTarget(modes[(modes.indexOf(selected.targetMode) + 1) % modes.length]);
}

function setTarget(mode) {
    if (!selected || !hasTargeting(selected)) return;
    selected.targetMode = mode;
    sfx('click');
    updateInfo();
}

// The slow and poison towers hit everything in range, so they have no target choice
const hasTargeting = (t) => t.name !== 'slow' && t.name !== 'poison';


// Preferences

// Returns true when the page was opened with a map to play (from the editor)
function loadPrefs() {
    const prefs = store.get('prefs', {});
    const saved = store.get('customMap');
    if (saved) custom = parseMap(saved);

    const params = new URLSearchParams(location.search);
    const linked = params.get('map');
    const map = linked || prefs.map;
    if (map && MAP_LIST.some(m => m.id === map) && (map !== 'custom' || custom)) mapId = map;
    if (prefs.mode in { campaign: 1, endless: 1 }) modeId = prefs.mode;
    if (prefs.difficulty in difficulties) diffId = prefs.difficulty;
    muteSounds = !!prefs.muted;
    if (typeof prefs.numbers === 'boolean') damageNumbers = prefs.numbers;
    if (typeof prefs.bars === 'boolean') healthBar = prefs.bars;
    if (typeof prefs.effects === 'boolean') showEffects = prefs.effects;
    skipToNext = !!prefs.autosend;
    return !!linked && mapId === linked;
}

function savePrefs() {
    store.set('prefs', {
        map: mapId,
        mode: modeId,
        difficulty: diffId,
        muted: muteSounds,
        numbers: damageNumbers,
        bars: healthBar,
        effects: showEffects,
        autosend: skipToNext
    });
    syncSettings();
}


// Events

document.addEventListener('keydown', onKey);
document.addEventListener('pointerdown', e => {
    if (e.pointerType !== lastPointer) {
        lastPointer = e.pointerType;
        updateInfo();
    }
}, { capture: true });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !paused) pause();
});
