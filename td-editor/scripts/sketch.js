let cols;
let rows;
let ts = 24;            // tile size
let zoomDefault = ts;

let display;            // graphical display tiles
let displayDir;         // direction graphical display tiles are facing
                        // (0 = none, 1 = left, 2 = up, 3 = right, 4 = down)
let grid;               // (0 = empty, 1 = wall, 2 = path, 3 = tower,
                        //  4 = enemy-only pathing)
let metadata;           // tile metadata
let paths;              // direction to travel

let exit;
let spawnpoints = [];

let bg = [0, 0, 0];     // background color
let border = 255;       // fill color for tile borders
let borderAlpha = 31;   // tile border alpha

let autogen = true;     // automatically generate display layer
let deco = 'empty';     // decoration to draw
let dispMode = false;   // whether or not to show display tiles
let tile = 'empty';     // tile to draw


// Misc functions

// Draw an arrow
const arrow = () => {
    stroke(0);
    const length = 0.7 * ts;
    const back = 0.1 * ts;
    const width = 0.5 * ts;
    line(-length / 2, 0, length / 2, 0);
    line(-length / 2, 0, -back, -width / 2);
    line(-length / 2, 0, -back, width / 2);
};

const exportMap = () => {
    if (!spawnpoints || spawnpoints.length === 0) {
        Toastify({
            text: "Warning: No spawnpoints defined!",
            backgroundColor: "red",
            duration: 3000
        }).showToast();
        return;
    }
    if (!exit || !exit.x || !exit.y) {
        Toastify({
            text: "Warning: No exit defined!",
            backgroundColor: "red",
            duration: 3000
        }).showToast();
        return;
    }

    // Convert spawnpoints into a JSON-friendly format
    const spawns = spawnpoints.map(s => [s.x, s.y]);
    const mapData = {
        // Grids
        display,
        displayDir,
        grid,
        metadata,
        paths,
        // Important tiles
        exit: [exit.x, exit.y],
        spawnpoints: spawns,
        // Colors
        bg,
        border,
        borderAlpha,
        // Misc
        cols,
        rows
    };

    const compressedMap = LZString.compressToBase64(JSON.stringify(mapData));

    // Display success notification
    Toastify({
        text: "Map exported successfully!",
        backgroundColor: "green",
        duration: 3000
    }).showToast();

    return compressedMap;
};

// Generate display layer
const genDisplay = () => {
    display = replaceArray(
        grid, [0, 1, 2, 3, 4], ['empty', 'wall', 'empty', 'tower', 'empty']
    );
    displayDir = buildArray(cols, rows, 0);
    // Colors
    bg = [0, 0, 0];
    border = 255;
    borderAlpha = 31;
    // Misc
    metadata = buildArray(cols, rows, null);
};

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
};

// Load a map from a map string
const importMap = (str) => {
    try {
        const m = JSON.parse(LZString.decompressFromBase64(str));

        // Grids
        display = m.display;
        displayDir = m.displayDir;
        grid = m.grid;
        metadata = m.metadata;
        paths = m.paths;
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

        resizeFit();

        // Display success notification
        Toastify({
            text: "Map imported successfully!",
            backgroundColor: "green",
            duration: 3000
        }).showToast();
    } catch (err) {
        console.error('Error importing map:', err);

        // Display error notification
        Toastify({
            text: "Failed to import map. Please check the input.",
            backgroundColor: "red",
            duration: 3000
        }).showToast();
    }
};

function showImportMapPrompt() {
    Swal.fire({
        title: 'Input map string:',
        input: 'textarea',
        inputPlaceholder: 'Paste your map string here...',
        showCancelButton: true,
        confirmButtonText: 'Import',
        cancelButtonText: 'Cancel',
        inputValidator: (value) => {
            if (!value) {
                return 'Please enter a map string!';
            }
        },
        customClass: {
            popup: 'custom-swal-popup',
            header: 'custom-swal-header',
            title: 'custom-swal-title',
            input: 'custom-swal-input',
            cancelButton: 'custom-swal-cancel-btn',
            confirmButton: 'custom-swal-confirm-btn',
            actions: 'custom-swal-actions'
        },
        background: '#013243',
        color: '#fff',
        buttonsStyling: false,
        width: '400px'
    }).then((result) => {
        if (result.isConfirmed) {
            const mapString = result.value;
            importMap(mapString);
        }
    });
}



// Recalculate pathfinding maps
// Algorithm from https://www.redblobgames.com/pathfinding/tower-defense/
function recalculate() {
    if (!exit) return;
    walkMap = getWalkMap();
    const frontier = [];
    const target = vts(exit);
    frontier.push(target);
    const cameFrom = {};
    cameFrom[target] = null;

    // Fill cameFrom and distance for every tile
    while (frontier.length !== 0) {
        const current = frontier.shift();
        const t = stv(current);
        const adj = neighbors(walkMap, t.x, t.y, true);

        adj.forEach(next => {
            if (next in cameFrom) return;
            frontier.push(next);
            cameFrom[next] = current;
        });
    }

    // Generate usable maps
    const newPaths = buildArray(cols, rows, 0);
    const keys = Object.keys(cameFrom);
    keys.forEach(key => {
        const current = stv(key);
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
    });

    // Preserve old paths on path tiles
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            if (grid[x][y] === 2) newPaths[x][y] = paths[x][y];
        }
    }

    paths = newPaths;
}

// Clear grid
function resetMap(t) {
    dispMode = false;
    updateDivs();

    const d = ['empty', 'wall', 'empty', 'tower', 'empty'][t];
    display = buildArray(cols, rows, d);
    displayDir = buildArray(cols, rows, 0);
    grid = buildArray(cols, rows, t);
    metadata = buildArray(cols, rows, null);
    paths = buildArray(cols, rows, 0);

    exit = null;
    spawnpoints = [];
}

// Changes tile size to fit everything onscreen
function resizeFit() {
    const div = document.getElementById('sketch-holder');
    const ts1 = Math.floor(div.offsetWidth / cols);
    const ts2 = Math.floor(div.offsetHeight / rows);
    ts = Math.min(ts1, ts2);
    resizeCanvas(cols * ts, rows * ts, true);
    updateStatus();
}

// Resizes cols, rows, and canvas based on tile size
function resizeMax() {
    const div = document.getElementById('sketch-holder');
    cols = Math.floor(div.offsetWidth / ts);
    rows = Math.floor(div.offsetHeight / ts);
    resizeCanvas(cols * ts, rows * ts, true);
    updateStatus();
}

// Store selected tile in appropriate location
function selectTile(t, d) {
    if (d === undefined) {
        dispMode ? deco = t : tile = t;
    } else {
        dispMode ? deco = d : tile = t;
    }
}

// Update tile- and decoration-selection divs
function updateDivs() {
    const t = document.getElementById('tile-picker').style;
    const d = document.getElementById('deco-picker').style;
    if (dispMode) {
        t.display = 'none';
        d.display = 'block';
    } else {
        t.display = 'block';
        d.display = 'none';
    }
}

// Update map status display
function updateStatus() {
    document.getElementById('dim').innerHTML = `Dim: ${cols}x${rows}`;
}

// User drawing on map
function userDraw() {
    if (!mouseInMap()) return;
    const p = gridPos(mouseX, mouseY);
    const g = grid[p.x][p.y];

    if (dispMode) {
        const d = ['none', 'left', 'up', 'right', 'down'].indexOf(deco);
        if (d !== -1) {
            displayDir[p.x][p.y] = d;
            return;
        }
        display[p.x][p.y] = tiles.hasOwnProperty(deco) ? deco : 'empty';
    } else {
        const d = ['none', 'left', 'up', 'right', 'down'].indexOf(tile);
        if (d !== -1) {
            paths[p.x][p.y] = g !== 1 && g !== 3 ? d : 0;
            return;
        } else if (tile === 'exit') {
            exit = createVector(p.x, p.y);
            spawnpoints = spawnpoints.filter(spawn => !exit.equals(spawn));
            grid[p.x][p.y] = 0;
            paths[p.x][p.y] = 0;
        } else if (tile === 'spawn') {
            const s = createVector(p.x, p.y);
            if (spawnpoints.some(spawn => spawn.equals(s) || spawn.equals(exit))) return;
            spawnpoints.push(s);
            if (!walkable(p.x, p.y)) grid[p.x][p.y] = 0;
        } else {
            const t = ['empty', 'wall', 'path', 'tower', 'enemy'].indexOf(tile);
            if (t === -1) return;
            if ([1, 3].includes(t)) {
                if (p.equals(exit)) return;
                if (spawnpoints.some(spawn => spawn.equals(p))) return;
            }
            grid[p.x][p.y] = t;
            if ([1, 3].includes(t)) paths[p.x][p.y] = 0;
            if (autogen) display[p.x][p.y] = ['empty', 'wall', 'empty', 'tower', 'empty'][t];
        }
    }
}

// Filling tiles
function userFill() {
    const sel = dispMode ? deco : tile;
    const d = ['none', 'left', 'up', 'right', 'down'].indexOf(sel);

    if (dispMode) {
        if (d === -1) {
            display = buildArray(cols, rows, sel);
        } else {
            displayDir = buildArray(cols, rows, d);
        }
    } else {
        if (d === -1) {
            const t = ['empty', 'wall', 'path', 'tower', 'enemy'].indexOf(sel);
            if (t === -1) return;
            grid = buildArray(cols, rows, t);
        } else {
            paths = buildArray(cols, rows, d);
        }
    }
}

// Return whether tile is walkable
const walkable = (col, row) => grid[col][row] !== 1 && grid[col][row] !== 3;

// Main p5 functions
function setup() {
    const div = document.getElementById('sketch-holder');
    const canvas = createCanvas(div.offsetWidth, div.offsetHeight);
    canvas.parent('sketch-holder');
    resizeMax();
    resetMap(0);
}

function draw() {
    background(dispMode ? bg : 255);

    // Update mouse coordinates
    if (mouseInMap()) {
        const t = gridPos(mouseX, mouseY);
        const coordText = `Mouse: (${t.x}, ${t.y})`;
        document.getElementById('coord').innerHTML = coordText;
    }

    // Draw basic tiles
    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            if (dispMode) {
                const t = tiles[display[x][y]];
                if (typeof t === 'function') {
                    t(x, y, displayDir[x][y]);
                } else {
                    stroke(border, borderAlpha);
                    t ? fill(t) : noFill();
                    rect(x * ts, y * ts, ts, ts);
                }
            } else {
                stroke(0, 63);
                const t = grid[x][y];
                if (t === 0) {
                    noFill();
                } else {
                    fill([[108, 122, 137], [191, 85, 236], [25, 181, 254], [233, 212, 96]][t - 1]);
                }
                rect(x * ts, y * ts, ts, ts);
            }
        }
    }

    // Draw spawnpoints
    spawnpoints.forEach(s => {
        stroke(dispMode ? 255 : 0);
        fill(0, 230, 64);
        rect(s.x * ts, s.y * ts, ts, ts);
    });

    // Draw exit
    if (exit) {
        stroke(dispMode ? 255 : 0);
        fill(207, 0, 15);
        rect(exit.x * ts, exit.y * ts, ts, ts);
    }

    // Draw paths
    if (!dispMode) {
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (!walkable(x, y) || (exit && x === exit.x && y === exit.y)) {
                    paths[x][y] = 0;
                    continue;
                }
                const d = paths[x][y];
                if (d === 0) continue;
                push();
                const c = center(x, y);
                translate(c.x, c.y);
                rotate([0, PI / 2, PI, PI * 3 / 2][d - 1]);
                arrow();
                pop();
            }
        }
    }
}

// User input

function keyPressed() {
    switch (keyCode) {
        case 32:
            // Spacebar
            dispMode = !dispMode;
            updateDivs();
            break;
        case 37:
            // Left arrow
            selectTile('left');
            break;
        case 38:
            // Up arrow
            selectTile('up');
            break;
        case 39:
            // Right arrow
            selectTile('right');
            break;
        case 40:
            // Down arrow
            selectTile('down');
            break;
        case 48:
            // 0
            selectTile('none');
            break;
        case 49:
            // 1
            selectTile('empty');
            break;
        case 50:
            // 2
            selectTile('wall');
            break;
        case 51:
            // 3
            selectTile('path', 'tower');
            break;
        case 52:
            // 4
            selectTile('tower', 'grass');
            break;
        case 53:
            // 5
            selectTile('enemy', 'road');
            break;
        case 54:
            // 6
            selectTile('spawn', 'lCorner');
            break;
        case 55:
            // 7
            selectTile('exit', 'rCorner');
            break;
        case 56:
            // 8
            if (dispMode) deco = 'sidewalk';
            break;
        case 67:
            // C
            display = buildArray(cols, rows, 'empty');
            displayDir = buildArray(cols, rows, 0);
            break;
        case 68:
            // D
            autogen = !autogen;
            var state = autogen ? 'Off' : 'On';
            var a = document.getElementById('autogen');
            a.innerHTML = 'Turn Autogen ' + state + ' (D)';
            break;
        case 70:
            // F
            userFill();
            break;
        case 76:
            // L
            displayDir = copyArray(paths);
            break;
        case 77:
            // M
            importMap(prompt('Input map string:'));
            break;
        case 80:
            // P
            recalculate();
            break;
        case 81:
            // Q
            paths = buildArray(cols, rows, 0);
            break;
        case 82:
            // R
            resetMap(0);
            break;
        case 83:
            // S
            spawnpoints = [];
            break;
        case 85:
            // U
            genDisplay();
            break;
        case 88:
            // X
            copyToClipboard(exportMap());
            break;
        case 90:
            // Z
            ts = zoomDefault;
            resizeMax();
            resetMap(0);
            break;
        case 219:
            // Left bracket
            if (keyIsDown(SHIFT)) {
                if (rows > 1) {
                    rows--;
                    resizeFit();
                    resetMap(0);
                }
            } else {
                if (cols > 1) {
                    cols--;
                    resizeFit();
                    resetMap(0);
                }
            }
            break;
        case 221:
            // Right bracket
            if (keyIsDown(SHIFT)) {
                rows++;
            } else {
                cols++;
            }
            resizeFit();
            resetMap(0);
            break;
    }
}

function mouseDragged() {
    userDraw();
}

function mousePressed() {
    userDraw();
}
