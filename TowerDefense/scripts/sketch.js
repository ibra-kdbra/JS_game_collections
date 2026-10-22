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
        if (!godMode) {
            cash -= t.cost;
            toPlace = false;
        }
        selected = t;
        if (grid[t.gridPos.x][t.gridPos.y] === 0) toPathfind = true;
        updateInfo(t);
        newTowers.push(t);
    } else {
        toast(`Not enough cash: ${t.title} costs $${t.cost}`, 'error');
    }
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

// Check if all conditions for placing a tower are true
const canPlace = (col, row) => {
    if (!toPlace) return false;
    const g = grid[col][row];
    if (g === 3) return !getTower(col, row);
    if (g === 1 || g === 2 || g === 4) return false;
    if (!empty(col, row) || !placeable(col, row)) return false;
    return true;
}

// Check if spawn cooldown is done and enemies are available to spawn
const canSpawn = () => {
    return newEnemies.length > 0 && scd === 0;
}

// Clear tower information
const clearInfo = () => {
    $('info-div').style.display = 'none';
    updateHint();
}

// Next authored wave, or nothing once the campaign is over
const customWave = () => campaignWaves[wave];

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
    $('custom').disabled = false;
    $('map').value = 'custom';
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
    let name = $('map').value;
    if (name === 'custom' && !custom) name = $('map').value = 'sparse2';

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
    addWave(gameMode === 'campaign' ? customWave() : randomWave());
    wave++;
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
    if ($('end-dialog').open) $('end-dialog').close();
    difficulty = difficulties[$('difficulty').value] || difficulties.normal;
    gameMode = $('mode').value;
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
    clearInfo();
    // Start game
    nextWave();
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
    clearInfo();
    cash += t.sellPrice();
    t.kill();
}

// Set a tower to place
function setPlace(t) {
    towerType = t;
    toPlace = true;
    selected = null;
    ghost = null;
    updateInfo(createTower(0, 0, tower[towerType]));
}

// Leave placement mode and deselect
function cancelPlace() {
    toPlace = false;
    selected = null;
    ghost = null;
    clearInfo();
}

// Visualize range of tower
function showRange(t, cx, cy) {
    stroke(255);
    fill(t.color[0], t.color[1], t.color[2], 63);
    const r = (t.range + 0.5) * ts * 2;
    ellipse(cx, cy, r, r);
}

// Display tower information
function updateInfo(t) {
    const name = $('name');
    name.textContent = t.title;
    name.style.color = `rgb(${t.color})`;

    $('damage').textContent = t.getDamage();
    $('type').textContent = t.type.toUpperCase();
    $('range').textContent = t.range;
    $('cooldown').textContent = `${t.getCooldown().toFixed(2)}s`;
    $('sellPrice').textContent = toPlace ? `costs $${t.totalCost}` : `sells for $${t.sellPrice()}`;

    $('info-buttons').style.display = toPlace ? 'none' : 'flex';
    $('place-buttons').style.display = toPlace ? 'flex' : 'none';
    $('info-div').style.display = 'block';
    updateHint();
    updateControls();
}

// Contextual help under the tower info
function updateHint() {
    const touch = lastPointer !== 'mouse';
    let hint = '';
    if (toPlace) {
        hint = touch ? 'Tap a tile to aim, tap it again to build.' : 'Click a free tile to build. Esc cancels.';
    } else if (!selected) {
        hint = touch ? 'Pick a tower, then tap the map. Tap a built tower to upgrade or sell it.'
            : 'Pick a tower from the store (keys 1-7), then click the map. Click a tower to upgrade or sell it.';
        if (touch && ts < 12 && innerHeight > innerWidth) hint += ' Turn your phone sideways for bigger tiles.';
    }
    $('hint').textContent = hint;
}

// Update buttons and status text; only touches the DOM when something changed
const shown = {};
function setText(id, value) {
    if (shown[id] === value) return;
    shown[id] = value;
    $(id).textContent = value;
}

function updateControls() {
    setText('pause', gameOver ? 'Game over' : paused ? (wave <= 1 && enemies.length === 0 ? 'Start' : 'Resume') : 'Pause');
    setText('speed', `${speed}x`);
    setText('mute', muteSounds ? 'Sound off' : 'Sound on');
    $('next-wave').disabled = !toWait || gameOver;
}

// Update game status display with wave, health, and cash
function updateStatus() {
    const total = gameMode === 'campaign' ? `/${campaignWaves.length}` : '';
    setText('wave', `Wave ${wave}${total}`);
    setText('health', `♥ ${health}/${maxHealth}`);
    setText('cash', `$${cash}`);
    let note = '';
    if (gameOver) note = '';
    else if (toWait) note = `Next wave in ${Math.ceil(wcd / 60)}s`;
    else if (paused && wave === 1 && enemies.length === 0) note = 'Build towers, then press Start.';
    else if (paused) note = 'Paused';
    setText('wave-note', note);
    $('next-wave').disabled = !toWait || gameOver;

    // Grey out what the player cannot afford
    const cashKey = `${cash}|${selected ? selected.upgrades.length : -1}`;
    if (shown.cashKey !== cashKey) {
        shown.cashKey = cashKey;
        document.querySelectorAll('[data-tower]').forEach(b => {
            b.classList.toggle('poor', cash < tower[b.dataset.tower].cost && !godMode);
        });
        const up = $('upgrade');
        if (selected && selected.upgrades.length > 0) {
            const u = selected.upgrades[0];
            up.textContent = `Upgrade $${u.cost}`;
            up.disabled = false;
            up.classList.toggle('poor', cash < u.cost && !godMode);
        } else {
            up.textContent = 'Max level';
            up.disabled = true;
        }
        if (selected) $('sell').textContent = `Sell $${selected.sellPrice()}`;
    }
}

// Upgrade tower
function upgrade(t) {
    if (godMode || cash >= t.cost) {
        if (!godMode) cash -= t.cost;
        selected.upgrade(t);
        selected.upgrades = t.upgrades ? t.upgrades : [];
        updateInfo(selected);
    } else {
        toast(`Not enough cash: upgrade costs $${t.cost}`, 'error');
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
    if (bonus > 0) {
        cash += bonus;
        toast(`Early call bonus: $${bonus}`, 'ok');
    }
    wcd = 0;
    if (paused) pause();
}

function cycleSpeed() {
    speed = speed % 3 + 1;
    updateControls();
}

function toggleMute() {
    muteSounds = !muteSounds;
    savePrefs();
    updateControls();
}


// Results and personal bests

const bestMode = () => `${$('map').value}-${gameMode}-${$('difficulty').value}`;

function mapTitle() {
    const opt = $('map').selectedOptions[0];
    return opt ? opt.textContent.replace(/ \(.*\)$/, '') : '';
}

function recordWave(cleared) {
    if (cleared < 1) return false;
    return GameKit.recordBest(SLUG, cleared, {
        mode: bestMode(),
        label: `Wave ${cleared} on ${mapTitle()} (${difficulty.title})`
    }).isNew;
}

function updateBest() {
    const best = GameKit.readBests(SLUG)[bestMode()];
    $('best').textContent = best
        ? `Best here: ${best.value} wave${best.value === 1 ? '' : 's'} cleared`
        : 'No waves cleared on this setup yet.';
}

function endGame(won) {
    gameOver = true;
    paused = true;
    const cleared = won ? wave : wave - 1;
    const isNew = recordWave(cleared);
    const best = GameKit.readBests(SLUG)[bestMode()];
    $('end-title').textContent = won ? 'Victory!' : 'The base has fallen';
    $('end-text').textContent = won
        ? `All ${campaignWaves.length} waves cleared on ${mapTitle()} (${difficulty.title}) with ${health} lives left.`
        : `You cleared ${cleared} wave${cleared === 1 ? '' : 's'}. ${isNew ? 'New personal best!' : best ? `Best: ${best.value}.` : ''}`;
    $('end-dialog').returnValue = '';
    $('end-dialog').showModal();
    updateControls();
    updateBest();
}


// Game logic: one fixed step (1/60 s)

function tick() {
    if (scd > 0) scd--;
    if (wcd > 0 && toWait) wcd--;

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
    textFont('monospace');

    loadPrefs();
    if (matchMedia('(max-width: 899px) and (orientation: portrait)').matches) $('options').open = false;
    resetGame();

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

    // Draw spawnpoints
    for (let i = 0; i < spawnpoints.length; i++) {
        stroke(255);
        fill(0, 230, 64);
        const s = spawnpoints[i];
        rect(s.x * ts, s.y * ts, ts, ts);
    }

    // Draw exit
    stroke(255);
    fill(207, 0, 15);
    rect(exit.x * ts, exit.y * ts, ts, ts);

    // Draw temporary spawnpoints
    for (let i = 0; i < tempSpawns.length; i++) {
        stroke(255);
        fill(155, 32, 141);
        const s = tempSpawns[i][0];
        rect(s.x * ts, s.y * ts, ts, ts);
    }

    enemies.forEach(e => e.draw());
    if (healthBar) enemies.forEach(e => e.drawHealth());

    // Range of the selected tower
    if (selected && !toPlace && selected.alive) showRange(selected, selected.pos.x, selected.pos.y);

    towers.forEach(t => t.draw());
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

    // Draw range of tower being placed
    const p = placementTile();
    if (p) {
        const c = center(p.x, p.y);
        showRange(createTower(0, 0, tower[towerType]), c.x, c.y);

        // Draw a red X if tower cannot be placed
        if (!canPlace(p.x, p.y)) {
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
        } else if (ghost) {
            noFill();
            stroke(255);
            strokeWeight(2);
            rect(p.x * ts, p.y * ts, ts, ts);
            strokeWeight(1);
        }
    }

    // Update FPS meter
    if (showFPS) calcFPS();

    // Show if god mode active
    if (godMode) {
        noStroke();
        fill(0);
        rect(0, 0, 102, 22);
        fill(255);
        text('God Mode Active', 5, 15);
    }

    // Show if towers are disabled
    if (stopFiring) {
        noStroke();
        fill(0);
        rect(width - 60, 0, 60, 22);
        fill(255);
        text('Firing off', width - 55, 15);
    }
}

// Tile where the tower being placed would go: mouse hover or the first tap
function placementTile() {
    if (!toPlace || typeof towerType === 'undefined') return null;
    if (ghost) return ghost;
    if (lastPointer === 'mouse' && mouseInMap()) return gridPos(mouseX, mouseY);
    return null;
}


// User input

function onCanvasPointer(e) {
    if (e.button !== 0) return;
    lastPointer = e.pointerType;
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
        updateInfo(selected);
        return;
    }

    if (!toPlace) {
        if (selected) cancelPlace();
        return;
    }

    // Mouse builds on click; touch shows the range first and builds on a second tap
    if (e.pointerType !== 'mouse' && !(ghost && ghost.equals(p.x, p.y))) {
        ghost = p;
        return;
    }
    ghost = null;
    if (canPlace(p.x, p.y)) {
        buy(createTower(p.x, p.y, tower[towerType]));
    } else {
        toast('You cannot build there', 'error');
    }
}

const towerKeys = { 1: 'gun', 2: 'laser', 3: 'slow', 4: 'sniper', 5: 'rocket', 6: 'bomb', 7: 'tesla' };

function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

    if (towerKeys[key]) {
        setPlace(towerKeys[key]);
        return;
    }
    switch (key) {
        case 'Escape':
            cancelPlace();
            break;
        case ' ':
            // Drop focus from any clicked button so it isn't also activated
            e.preventDefault();
            if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
            pause();
            break;
        case 'f':
            showFPS = !showFPS;
            break;
        case 'g':
            godMode = !godMode;
            break;
        case 'h':
            healthBar = !healthBar;
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


// Preferences

function loadPrefs() {
    const prefs = store.get('prefs', {});
    const saved = store.get('customMap');
    if (saved) custom = parseMap(saved);
    $('custom').disabled = !custom;

    const params = new URLSearchParams(location.search);
    const map = params.get('map') || prefs.map;
    if (map && $('map').querySelector(`option[value="${map}"]:not([disabled])`)) $('map').value = map;
    if (prefs.mode) $('mode').value = prefs.mode;
    if (prefs.difficulty) $('difficulty').value = prefs.difficulty;
    muteSounds = !!prefs.muted;
}

function savePrefs() {
    store.set('prefs', {
        map: $('map').value,
        mode: $('mode').value,
        difficulty: $('difficulty').value,
        muted: muteSounds
    });
}


// Events

document.addEventListener('keydown', onKey);
document.addEventListener('pointerdown', e => {
    if (e.pointerType !== lastPointer) {
        lastPointer = e.pointerType;
        updateHint();
    }
}, { capture: true });
document.addEventListener('visibilitychange', () => {
    if (document.hidden && !paused) pause();
});

document.querySelectorAll('[data-tower]').forEach(b => {
    b.addEventListener('click', () => setPlace(b.dataset.tower));
});
['map', 'mode', 'difficulty'].forEach(id => {
    $(id).addEventListener('change', () => {
        savePrefs();
        resetGame();
        $(id).blur();
    });
});
$('pause').addEventListener('click', pause);
$('speed').addEventListener('click', cycleSpeed);
$('next-wave').addEventListener('click', callNextWave);
$('restart').addEventListener('click', resetGame);
$('mute').addEventListener('click', toggleMute);
$('import').addEventListener('click', showImportMapPrompt);
$('export').addEventListener('click', showExportMap);
$('sell').addEventListener('click', () => { if (selected) sell(selected); });
$('upgrade').addEventListener('click', () => {
    if (selected && selected.upgrades.length > 0) upgrade(selected.upgrades[0]);
});
$('cancel').addEventListener('click', cancelPlace);
$('end-dialog').addEventListener('close', () => {
    if ($('end-dialog').returnValue === 'retry') resetGame();
});
