// Check if number falls within range
const between = (num, min, max) => num > Math.min(min, max) && num < Math.max(min, max);

// Build 2d array of value
const buildArray = (cols, rows, val) => {
    return Array.from({ length: cols }, () => Array.from({ length: rows }, () => val));
};

// Return position at center of tile
const center = (col, row) => createVector(col * ts + ts / 2, row * ts + ts / 2);

// Copy 2d array
const copyArray = (arr) => arr.map(row => [...row]);

// Copy text to clipboard
const copyToClipboard = (str) => {
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = 0;
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';

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

// Return grid coordinate
const gridPos = (x, y) => createVector(Math.floor(x / ts), Math.floor(y / ts));

const mouseInMap = () => between(mouseX, 0, width) && between(mouseY, 0, height);

// Return orthogonal neighbors of a certain value
const neighbors = (grid, col, row, val) => {
    const directions = [
        [-1, 0], [0, -1], [1, 0], [0, 1] // left, up, right, down
    ];

    return directions.reduce((acc, [dx, dy]) => {
        const newCol = col + dx;
        const newRow = row + dy;
        if (newCol >= 0 && newCol < grid.length && newRow >= 0 && newRow < grid[newCol].length && grid[newCol][newRow] === val) {
            acc.push(cts(newCol, newRow));
        }
        return acc;
    }, []);
};

// Replace values in copy of 2d array
const replaceArray = (arr, vals, subs) => arr.map((row, x) => 
    row.map((curVal, y) => {
        const i = vals.indexOf(curVal);
        if (i === -1) {
            return curVal;
        } else {
            return vals.length === subs.length ? subs[i] : subs[0];
        }
    })
);

// Convert string to vector
const stv = (str) => {
    const [x, y] = str.split(',').map(Number);
    return createVector(x, y);
};

// Convert vector to string
const vts = (v) => `${v.x},${v.y}`;
