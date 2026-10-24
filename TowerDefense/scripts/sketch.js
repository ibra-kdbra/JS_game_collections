let enemies = [];
let projectiles = [];
let towers = [];
let newEnemies = [];
let newProjectiles = [];
let newTowers = [];

let cols;
let rows;
let ts = 24;            // tile size in pixels, fitted to the screen
let tileZoom = 2;
let zoomDefault = 24;
let randomTs = zoomDefault; // preferred tile size when generating random maps

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
let flowPaths;          // shortest-way direction on every tile (ignores the roads' own directions)
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

let bg;                 // background color (kept in map strings)
let border;             // color to draw on tile borders (kept in map strings)
let borderAlpha;        // alpha of tile borders (kept in map strings)
let mapTheme = 'meadow';// terrain look (terrain.js)
let mapStamp = 0;       // bumped when the map's tiles change, to redraw the terrain
let pathVersion = 0;    // bumped when enemy paths change, to redraw the route hints

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
let clearBonus = 0;     // gold paid for the wave that was just cleared
let mapHp = 1;          // enemy health tuning of the campaign map (CAMPAIGN in maps.js)
let floaters = [];      // floating numbers: { x, y, text, color, life, size }
let hurt = 0;           // ticks left of the red edge flash after losing lives
let damageNumbers = true;
let shakeLevel = 1;     // screen shake: 0 off, 1 subtle (big hits only), 2 full
let haptics = true;     // vibrate on phones for key events
let stats;              // per-game totals for the end screen
let dmgSource = null;   // tower whose shot is being resolved, credited with damage and kills

let godMode = false;    // make player immortal for test purposes
let healthBar = true;   // display enemy health bar
let muteSounds = false; // whether to mute sounds
let paused;             // whether to update or not
let scd;                // number of ticks until next spawn cycle
let showEffects = true; // whether or not to display particle effects
let skipToNext = false; // whether or not to immediately start next wave
let stopFiring = false; // whether or not to pause towers firing
let toCooldown;         // flag to reset spawning cooldown
let toPathfind;         // flag to update enemy pathfinding
let toPlace;            // flag to place a tower
let toWait;             // flag to wait before next wave
let wcd;                // number of ticks until next wave

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
        FX.buzz(12);
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
    FX.death(e);
    stats.kills++;
    stats.earned += e.cash;
    if (e.cash > 0) addFloater(e.pos.x, e.pos.y, `+$${e.cash}`, [250, 204, 21], 0.8);
}

function onEnemyLeaked(e) {
    if (godMode) return;
    stats.leaked += e.damage;
    hurt = 24;
    sfx('leak');
    FX.leak();
    const c = center(exit.x, exit.y);
    addFloater(c.x, c.y - ts * 0.4, `-${e.damage}`, [248, 113, 113], 1.2);
    flashLives();
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

// placeReason for the preview, recomputed at most every few frames per tile
// (it runs a path search, too slow to repeat every frame)
const placeCache = { key: '', at: -99, value: null };
function placeReasonCached(col, row) {
    const key = `${col},${row},${towers.length},${newTowers.length},${pathVersion}`;
    const now = frameCount;
    if (placeCache.key !== key || now - placeCache.at > 12) {
        placeCache.key = key;
        placeCache.at = now;
        placeCache.value = placeReason(col, row);
    }
    return placeCache.value;
}

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
        rows,
        theme: mapTheme
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
    for (let i = 0; i < towers.length; i++) {
        const t = towers[i];
        if (t.alive && t.gridPos.x === col && t.gridPos.y === row) return t;
    }
    for (let i = 0; i < newTowers.length; i++) {
        const t = newTowers[i];
        if (t.alive && t.gridPos.x === col && t.gridPos.y === row) return t;
    }
    return null;
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
    const tuning = CAMPAIGN.find(m => m.id === name);
    mapHp = tuning && tuning.hp ? tuning.hp : 1;
    mapTheme = Terrain.themeFor(name === 'custom' ? custom : maps[name] || null, name === 'custom' ? null : name);
    mapStamp++;
    fitCanvas();
    recalculate();
    Renderer.mapChanged(mapTheme);

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
    return outsideRect(e.pos.x, e.pos.y, 0, 0, cols * ts, rows * ts);
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

    // Shortest way from every tile, also kept for road tiles without a direction
    // (crossings), where an enemy that starts there (a Hive portal) has no way to go
    flowPaths = newPaths.map(col => col.slice());

    // Preserve old paths on path tiles
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            if (grid[x][y] === 2) newPaths[x][y] = paths[x][y];
        }
    }

    paths = newPaths;
    pathVersion++;
}

function resetGame() {
    closeOverlay('end');
    difficulty = difficulties[diffId] || difficulties.normal;
    gameMode = modeId;
    // Clear all entities
    enemies = [];
    projectiles = [];
    towers = [];
    newEnemies = [];
    FX.clear();
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
    cash = difficulty.cash + portalCash * Math.max(0, spawnpoints.length - 1);
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
        p.topSpeed *= k;
    });
    floaters.forEach(f => {
        f.x *= k;
        f.y *= k;
    });
    FX.clear();
}

// Size the tiles so the whole map fits the space available
function fitCanvas() {
    if (!cols || !rows) return;
    const w = holder.clientWidth;
    const h = holder.clientHeight;
    if (!w || !h) return;
    const newTs = Math.max(4, Math.floor(Math.min(w / cols, h / rows)));
    if (newTs !== ts) {
        rescale(newTs);
        Renderer.mapChanged();
    }
    Renderer.resize();
    coveredFrameDrawn = false;
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
    tipEvent('placing');
}

// Leave placement mode and deselect
function cancelPlace() {
    toPlace = false;
    selected = null;
    ghost = null;
    updateInfo();
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
    let mult = difficulty.hp * mapHp;
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
            const e = scaleEnemy(createEnemy(c.x, c.y, enemy[name]));
            if (s[2] && s[2].magSq() > 0) e.vel.set(s[2].x, s[2].y).normalize().mult(e.pxSpeed());
            enemies.push(e);
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
        dmgSource = t;
        t.target(enemies);
        t.update();
    }
    dmgSource = null;

    // Visual effects advance with the game
    FX.tick();

    // Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        dmgSource = p.source;
        p.steer();
        p.update();

        // Attack target
        if (p.alive && p.reachedTarget()) p.explode();
        dmgSource = null;

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
        // Portals opened by Hives close with the wave
        tempSpawns = [];
        if (gameMode === 'campaign' && wave >= campaignWaves.length) {
            endGame(true);
            return;
        }
        clearBonus = waveBonus(wave, spawnpoints.length);
        cash += clearBonus;
        stats.earned += clearBonus;
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


// Main p5 functions (p5 runs the loop; drawing is done by render.js)

function setup() {
    noCanvas();
    Renderer.init(holder);
    buildStore();

    const fromLink = loadPrefs();
    resetGame();
    if (!fromLink) openLevels();
    else maybeStartTips();

    new ResizeObserver(() => fitCanvas()).observe(holder);
}

// While a menu covers the map and nothing is running, draw one frame and idle
// (saves the phone's battery and GPU; the map behind the menu doesn't move).
let coveredFrameDrawn = false;

function draw() {
    const covered = (paused || gameOver) && openOverlayId() !== null;
    if (covered && coveredFrameDrawn) return;
    coveredFrameDrawn = covered;
    let steps = 0;
    const t0 = performance.now();
    if (!paused && !gameOver) {
        steps = stepper.advance(t0, () => {
            for (let i = 0; i < speed && !gameOver; i++) tick();
        }) * speed;
    } else {
        stepper.reset();
        applyPending();
    }
    Renderer.logicTime(performance.now() - t0);
    Renderer.frame(steps);
    updateStatus();
    // Floating text drifts in real time, so it also clears while paused
    for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.y -= ts / 48;
        if (--f.life <= 0) floaters.splice(i, 1);
    }
}

// Tile where the tower being placed would go: mouse hover or the first tap
function placementTile() {
    if (!toPlace || typeof towerType === 'undefined') return null;
    if (ghost) return ghost;
    const h = Renderer.hover;
    if (lastPointer === 'mouse' && h) {
        const x = Math.floor(h.x / ts);
        const y = Math.floor(h.y / ts);
        if (x >= 0 && y >= 0 && x < cols && y < rows) return createVector(x, y);
    }
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
        FX.buzz([20, 40, 20]);
        updateInfo();
        return;
    }
    buy(createTower(p.x, p.y, tower[towerType]));
    tipEvent('built');
}


// User input

// A tap or click on the map (w in world pixels; null for a right click)
function onMapTap(w, e) {
    lastPointer = e.pointerType;
    // Right click cancels building and deselects
    if (!w || e.button === 2) {
        cancelPlace();
        return;
    }
    const p = createVector(Math.floor(w.x / ts), Math.floor(w.y / ts));
    if (p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows) return;

    const t = getTower(p.x, p.y);
    if (t) {
        // Clicked on tower
        selected = t;
        toPlace = false;
        ghost = null;
        sfx('click');
        updateInfo();
        tipEvent('selected');
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
            Renderer.togglePerf();
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
            FX.enabled = showEffects;
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
    if (typeof prefs.shake === 'boolean') shakeLevel = prefs.shake ? 1 : 0;
    if (typeof prefs.shake === 'number') shakeLevel = Math.max(0, Math.min(2, prefs.shake | 0));
    if (typeof prefs.haptics === 'boolean') haptics = prefs.haptics;
    FX.enabled = showEffects;
    FX.shakeLevel = shakeLevel;
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
        autosend: skipToNext,
        shake: shakeLevel,
        haptics
    });
    syncSettings();
}


// Events

document.addEventListener('keydown', onKey);
// Switching between mouse and touch: restyle at once, but leave the side panel's
// buttons alone until this press is over (rebuilding them now would eat the click)
document.addEventListener('pointerdown', e => {
    if (e.pointerType !== lastPointer) {
        lastPointer = e.pointerType;
        document.body.classList.toggle('touch', isTouch());
        updatePlaceStatus();
        document.addEventListener('click', () => setTimeout(updateInfo, 0), { once: true });
    }
}, { capture: true });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !paused) pause();
});
