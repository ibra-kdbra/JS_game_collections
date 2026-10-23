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
let theme = 'auto';     // terrain look saved with the map ('auto' picks one from the tiles)

let terrainCanvas = null;   // map picture from ../TowerDefense/scripts/terrain.js
let terrainKey = '';
let terrainAt = 0;


// Misc functions

// Draw an arrow (white with a dark edge so it reads on any terrain)
const arrow = () => {
    const length = 0.6 * ts;
    const back = 0.1 * ts;
    const width = 0.42 * ts;
    [[9, Math.max(3, ts / 7)], [255, Math.max(1.5, ts / 14)]].forEach(([c, w]) => {
        stroke(c);
        strokeWeight(w);
        line(-length / 2, 0, length / 2, 0);
        line(-length / 2, 0, -back, -width / 2);
        line(-length / 2, 0, -back, width / 2);
    });
    strokeWeight(1);
};

// Return map string, or null (with a message) if the map is not playable yet
const exportMap = () => {
    if (!spawnpoints || spawnpoints.length === 0) {
        toast('Add at least one spawnpoint first', 'error');
        return null;
    }
    if (!exit) {
        toast('Add an exit point first', 'error');
        return null;
    }

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
    if (theme !== 'auto') mapData.theme = theme;

    return LZString.compressToBase64(JSON.stringify(mapData));
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
        theme = m.theme && Terrain.THEMES[m.theme] ? m.theme : 'auto';
        document.getElementById('theme').value = theme;

        resizeFit();
        toast('Map imported', 'ok');
    } catch (err) {
        toast('That is not a valid map string', 'error');
    }
};

function showImportMapPrompt() {
    textDialog({
        title: 'Paste a map string',
        placeholder: 'Map string from the game or this editor',
        confirmLabel: 'Import'
    }).then(str => {
        if (str) importMap(str);
    });
}

function showExportMap() {
    const str = exportMap();
    if (str) textDialog({ title: 'Map string', value: str, readOnly: true });
}

// Check that every spawnpoint can reach the exit, then open the map in the game
function playMap() {
    if (!exit || spawnpoints.length === 0) {
        exportMap();
        return;
    }
    const walk = getWalkMap();
    const seen = new Set([vts(exit)]);
    const frontier = [vts(exit)];
    while (frontier.length) {
        const t = stv(frontier.shift());
        neighbors(walk, t.x, t.y, true).forEach(n => {
            if (!seen.has(n)) {
                seen.add(n);
                frontier.push(n);
            }
        });
    }
    if (spawnpoints.some(s => !seen.has(vts(s)))) {
        toast('A spawnpoint cannot reach the exit', 'error');
        return;
    }
    GameKit.createStore('tower-defense').set('customMap', exportMap());
    location.href = '../TowerDefense/index.html?map=custom';
}

// Recalculate pathfinding maps
// Algorithm from https://www.redblobgames.com/pathfinding/tower-defense/
function recalculate() {
    if (!exit) return;
    const walkMap = getWalkMap();
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
    if (!div.clientWidth || !div.clientHeight) return;
    const ts1 = Math.floor(div.clientWidth / cols);
    const ts2 = Math.floor(div.clientHeight / rows);
    ts = Math.max(2, Math.min(ts1, ts2));
    resizeCanvas(cols * ts, rows * ts, true);
    updateStatus();
}

// Resizes cols, rows, and canvas based on tile size
function resizeMax() {
    const div = document.getElementById('sketch-holder');
    cols = Math.max(4, Math.floor(div.clientWidth / ts));
    rows = Math.max(4, Math.floor(div.clientHeight / ts));
    resizeCanvas(cols * ts, rows * ts, true);
    updateStatus();
}

// Add or remove columns and rows (resets the map)
function changeSize(dc, dr) {
    cols = constrain(cols + dc, 4, 60);
    rows = constrain(rows + dr, 4, 60);
    resizeFit();
    resetMap(0);
}

function resetZoom() {
    ts = zoomDefault;
    resizeMax();
    resetMap(0);
}

function toggleDispMode() {
    dispMode = !dispMode;
    updateDivs();
}

function toggleAutogen() {
    autogen = !autogen;
    document.getElementById('autogen').textContent = `Turn Autogen ${autogen ? 'Off' : 'On'} (D)`;
}

// Store selected tile in appropriate location
function selectTile(t, d) {
    if (d === undefined) {
        dispMode ? deco = t : tile = t;
    } else {
        dispMode ? deco = d : tile = t;
    }
    markSelected();
}

// Highlight the buttons of the current tile and decoration
function markSelected() {
    document.querySelectorAll('[data-tile]').forEach(b => b.classList.toggle('active', b.dataset.tile === tile));
    document.querySelectorAll('[data-deco]').forEach(b => b.classList.toggle('active', b.dataset.deco === deco));
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
    document.querySelectorAll('[data-layer]').forEach(b => {
        b.setAttribute('aria-pressed', String((b.dataset.layer === 'deco') === dispMode));
    });
}

// Update map status display
function updateStatus() {
    document.getElementById('dim').textContent = `Size: ${cols} x ${rows}`;
}

// User drawing on map at a canvas pixel position
function userDraw(x, y) {
    const p = gridPos(x, y);
    if (p.x < 0 || p.y < 0 || p.x >= cols || p.y >= rows) return;
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
    const canvas = createCanvas(div.clientWidth || 300, div.clientHeight || 300);
    canvas.parent('sketch-holder');
    resizeMax();
    resetMap(0);
    markSelected();

    // Paint with mouse, pen or finger
    const el = canvas.elt;
    const toCanvas = (e) => {
        const r = el.getBoundingClientRect();
        return [(e.clientX - r.left) * width / r.width, (e.clientY - r.top) * height / r.height];
    };
    let painting = false;
    let last = null;
    // Paint every tile between two pointer positions so fast strokes leave no gaps
    const paintTo = (x, y) => {
        const steps = last ? Math.ceil(Math.max(Math.abs(x - last[0]), Math.abs(y - last[1])) / (ts / 2)) : 0;
        for (let i = 1; i <= steps; i++) {
            userDraw(lerp(last[0], x, i / steps), lerp(last[1], y, i / steps));
        }
        if (!steps) userDraw(x, y);
        last = [x, y];
    };
    el.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        painting = true;
        last = null;
        el.setPointerCapture(e.pointerId);
        paintTo(...toCanvas(e));
    });
    el.addEventListener('pointermove', e => {
        const [x, y] = toCanvas(e);
        const t = gridPos(x, y);
        if (t.x >= 0 && t.y >= 0 && t.x < cols && t.y < rows) {
            document.getElementById('coord').textContent = `Tile: (${t.x}, ${t.y})`;
        }
        if (painting) paintTo(x, y);
    });
    ['pointerup', 'pointercancel'].forEach(type => el.addEventListener(type, () => { painting = false; }));

    new ResizeObserver(() => resizeFit()).observe(div);
}

// The map in the shape the terrain renderer expects
function mapView() {
    return {
        cols, rows, grid, display,
        spawnpoints: spawnpoints.map(s => [s.x, s.y]),
        exit: exit ? [exit.x, exit.y] : null,
        theme: theme === 'auto' ? undefined : theme
    };
}

function draw() {
    // Redraw the terrain when the tiles change (at most about ten times a second while painting)
    const now = performance.now();
    const key = `${cols}x${rows}|${ts}|${theme}|${grid.map(c => c.join('')).join('/')}|${display.map(c => c.join(',')).join('/')}|` +
        `${spawnpoints.map(s => s.x + ',' + s.y).join(';')}|${exit ? exit.x + ',' + exit.y : ''}`;
    if (!terrainCanvas || key !== terrainKey && now - terrainAt > 90) {
        terrainKey = key;
        terrainAt = now;
        const view = mapView();
        terrainCanvas = Terrain.render({
            m: view, px: ts * pixelDensity(), theme: Terrain.themeFor(view, null), canvas: terrainCanvas || undefined
        });
    }
    background(9);
    const g = drawingContext;
    g.drawImage(terrainCanvas, 0, 0, width, height);

    if (dispMode) {
        // Colour decoration tiles show through so they stay editable
        noStroke();
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const t = tiles[display[x][y]];
                if (!Array.isArray(t)) continue;
                fill(t[0], t[1], t[2], 90);
                rect(x * ts, y * ts, ts, ts);
            }
        }
    } else {
        // Enemy-only tiles get a light tint so they differ from path tiles
        noStroke();
        fill(250, 204, 21, 40);
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (grid[x][y] === 4) rect(x * ts, y * ts, ts, ts);
            }
        }
    }

    // Portals and the gate
    spawnpoints.forEach(s => {
        const c = center(s.x, s.y);
        g.fillStyle = '#3b1d7a';
        g.beginPath();
        g.arc(c.x, c.y, ts * 0.4, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#c38bff';
        g.lineWidth = Math.max(1.5, ts * 0.08);
        for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.arc(c.x, c.y, ts * 0.3, i * 2.1 + frameCount * 0.03, i * 2.1 + 1.4 + frameCount * 0.03);
            g.stroke();
        }
    });
    if (exit) {
        const c = center(exit.x, exit.y);
        g.save();
        g.translate(c.x, c.y);
        g.scale(ts, ts);
        Art.drawGate(g);
        g.restore();
    }

    // Path arrows
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

    // Outline the tile under the mouse
    if (hoverOutline && mouseInMap()) {
        const p = gridPos(mouseX, mouseY);
        noFill();
        stroke(250, 204, 21);
        strokeWeight(2);
        rect(p.x * ts + 1, p.y * ts + 1, ts - 2, ts - 2);
        strokeWeight(1);
    }
}

const hoverOutline = matchMedia('(hover: hover)').matches;

// User input

document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === ' ') e.preventDefault();
    onKey(e.keyCode, e.shiftKey);
});

document.getElementById('theme').addEventListener('change', e => {
    theme = e.target.value;
});

document.querySelectorAll('[data-tile]').forEach(b => {
    b.addEventListener('click', () => { tile = b.dataset.tile; markSelected(); });
});
document.querySelectorAll('[data-deco]').forEach(b => {
    b.addEventListener('click', () => { deco = b.dataset.deco; markSelected(); });
});

function onKey(code, shift) {
    switch (code) {
        case 32:
            // Spacebar
            toggleDispMode();
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
            if (dispMode) {
                deco = 'sidewalk';
                markSelected();
            }
            break;
        case 67:
            // C
            display = buildArray(cols, rows, 'empty');
            displayDir = buildArray(cols, rows, 0);
            break;
        case 68:
            // D
            toggleAutogen();
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
            showImportMapPrompt();
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
            showExportMap();
            break;
        case 90:
            // Z
            resetZoom();
            break;
        case 219:
            // Left bracket
            shift ? changeSize(0, -1) : changeSize(-1, 0);
            break;
        case 221:
            // Right bracket
            shift ? changeSize(0, 1) : changeSize(1, 0);
            break;
    }
}

GameKit.initShell();
