new p5(); // p5.js global mode

// Check if approximately at tile center
const atTileCenter = (x, y, col, row) => {
    const c = center(col, row);
    const t = ts / 24;
    return between(x, c.x - t, c.x + t) && between(y, c.y - t, c.y + t);
};

// Check if number falls within range (exclusive)
const between = (num, min, max) => num > Math.min(min, max) && num < Math.max(min, max);

// Build 2D array of value
const buildArray = (cols, rows, val) => 
    Array.from({ length: cols }, () => Array.from({ length: rows }, () => val));

// Return position at center of tile
const center = (col, row) => createVector(col * ts + ts / 2, row * ts + ts / 2);

// Copy 2D array
const copyArray = (arr) => arr.map(row => [...row]);

// Copy text to clipboard
const copyToClipboard = (str) => {
    const textArea = document.createElement('textarea');

    // Ensure element is as invisible as possible
    Object.assign(textArea.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '2em',
        height: '2em',
        padding: 0,
        border: 'none',
        outline: 'none',
        boxShadow: 'none',
        background: 'transparent',
    });

    textArea.value = str;
    document.body.appendChild(textArea);
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        console.log(`Copying text was ${successful ? 'successful' : 'unsuccessful'}`);
    } catch (err) {
        console.log('Unable to copy to clipboard');
        prompt('Map string:', str);
    }

    document.body.removeChild(textArea);
};

// Convert grid coordinates to string
const cts = (col, row) => `${col},${row}`;

// Returns an array of entities with a certain name
const getByName = (entities, names) => {
    const nameList = typeof names === 'string' ? [names] : names;
    return entities.filter(e => nameList.includes(e.name));
};

// Get first enemy (i.e., closest to exit)
const getFirst = (entities) => {
    let leastDist = 10000;
    let chosen = entities[0];
    entities.forEach(e => {
        const t = gridPos(e.pos.x, e.pos.y);
        const dist = dists[t.x][t.y];
        if (dist < leastDist) {
            leastDist = dist;
            chosen = e;
        }
    });
    return chosen;
};

// Get entities within a range (radius in tiles)
const getInRange = (cx, cy, radius, entities) => 
    entities.filter(e => insideCircle(e.pos.x, e.pos.y, cx, cy, (radius + 1) * ts));

// Nearest to entity
const getNearest = (entities, pos, ignore) => {
    let lowestDist = 10000;
    let chosen = entities[0];
    entities.forEach(e => {
        if (ignore?.includes(e)) return;
        const dist = pos.dist(e.pos);
        if (dist < lowestDist) {
            lowestDist = dist;
            chosen = e;
        }
    });
    return chosen;
};

// Get entities without a certain status effect
const getNoEffect = (entities, effect) => 
    entities.filter(e => !getByName(e.effects, effect).length);

// Get enemy with the most health
const getStrongest = (entities) => 
    entities.reduce((prev, curr) => (curr.health > prev.health ? curr : prev), entities[0]);

// Get all taunting enemies
const getTaunting = (entities) => entities.filter(e => e.taunt);

// Return grid coordinate
const gridPos = (x, y) => createVector(Math.floor(x / ts), Math.floor(y / ts));

const insideCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 < r ** 2;

const mouseInMap = () => between(mouseX, 0, width) && between(mouseY, 0, height);

// Return orthogonal neighbors of a certain value
const neighbors = (grid, col, row, val) => {
    const neighbors = [];
    if (col !== 0 && grid[col - 1][row] === val) neighbors.push(cts(col - 1, row));
    if (row !== 0 && grid[col][row - 1] === val) neighbors.push(cts(col, row - 1));
    if (col !== grid.length - 1 && grid[col + 1][row] === val) neighbors.push(cts(col + 1, row));
    if (row !== grid[col].length - 1 && grid[col][row + 1] === val) neighbors.push(cts(col, row + 1));
    return neighbors;
};

const outsideRect = (x, y, cx, cy, w, h) => x < cx || y < cy || x > cx + w || y > cy + h;

const polygon = (x, y, radius, npoints) => {
    const angle = TWO_PI / npoints;
    beginShape();
    for (let a = 0; a < TWO_PI; a += angle) {
        const sx = x + Math.cos(a) * radius;
        const sy = y + Math.sin(a) * radius;
        vertex(sx, sy);
    }
    endShape(CLOSE);
};

// Returns a random integer, using the same arguments as p5js random()
const randint = (...args) => Math.floor(random(...args));

// Displays a range of numbers
const rangeText = (min, max) => min === max ? String(min) : `${min}-${max}`;

// Remove empty temporary spawnpoints
const removeTempSpawns = () => {
    tempSpawns = tempSpawns.filter(([, count]) => count !== 0);
};

// Replace values in copy of 2D array
const replaceArray = (arr, vals, subs) => 
    arr.map(row => row.map(val => {
        const i = vals.indexOf(val);
        return i === -1 ? val : (vals.length === subs.length ? subs[i] : subs[0]);
    }));

// Convert string to vector
const stv = (str) => {
    const [x, y] = str.split(',').map(Number);
    return createVector(x, y);
};

// Convert vector to string
const vts = (v) => `${v.x},${v.y}`;