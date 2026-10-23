// Map terrain: paints ground, roads, build pads, walls and decorations into a
// canvas once, so the game and the map editor only copy a finished picture each
// frame. Shared with the map editor (td-editor), which loads this file directly.
//
// Tiles are read from a map's grid (0 ground, 1 wall, 2 path, 3 tower pad,
// 4 enemy-only road) and its decoration layer (road, sidewalk and grass tiles
// change the material). Everything random is seeded from the tile position, so
// the same map always looks the same.

const Terrain = (() => {
    // ---------- Themes ----------

    const THEMES = {
        meadow: {
            title: 'Meadow',
            ground: ['#5c9443', '#619a47', '#58903f', '#669e4b'],
            speck: '#4d8137', light: '#7cb65a', blotch: ['#4f8a39', '#76ad55'],
            road: '#c9a46b', roadEdge: '#80613a', roadSpeck: '#b28d58', roadLight: '#dcbc86', roadKind: 'dirt',
            pad: '#a5acb4', padHi: '#c8cdd3', padLo: '#6b727b', padMark: '#8b929a', padKind: 'stone',
            wallTop: '#8b8d84', wallSide: '#5b5c55', wallHi: '#b3b2a7', wallLo: '#45463f', wallKind: 'rock',
            groundDeco: ['tuft', 'tuft', 'flower', 'pebble'], wallDeco: ['tree', 'tree', 'bush', 'rock'],
            leaf: ['#2e6a2a', '#3f8236', '#5ba24a'], frame: '#2d4a22'
        },
        city: {
            title: 'City',
            ground: ['#558d42', '#5a9346', '#51893f', '#5e9649'],
            speck: '#477a36', light: '#71a956', blotch: ['#4a8139', '#68a04f'],
            road: '#41454d', roadEdge: '#24272c', roadSpeck: '#4c515a', roadLight: '#555a63', roadKind: 'asphalt',
            pad: '#b7bbc1', padHi: '#cfd3d8', padLo: '#868b92', padMark: '#9da2a9', padKind: 'pave',
            wallTop: '#5d6472', wallSide: '#383d47', wallHi: '#7b8494', wallLo: '#2a2e36', wallKind: 'building',
            groundDeco: ['tuft', 'flower', 'tuft'], wallDeco: ['ac', 'vent', 'tank', 'ac', 'solar'],
            leaf: ['#2b6328', '#3a7b33', '#55994a'], frame: '#1e2128'
        },
        desert: {
            title: 'Desert',
            ground: ['#d8b67c', '#dcbb82', '#d3b076', '#e0bf88'],
            speck: '#c4a067', light: '#ead09c', blotch: ['#cba66d', '#e6c992'],
            road: '#b6875a', roadEdge: '#7b5432', roadSpeck: '#a57850', roadLight: '#c99a6a', roadKind: 'dirt',
            pad: '#c8a170', padHi: '#e0be8e', padLo: '#94703f', padMark: '#b08a5a', padKind: 'stone',
            wallTop: '#c06a40', wallSide: '#8a4628', wallHi: '#dc8c5e', wallLo: '#6b3520', wallKind: 'mesa',
            groundDeco: ['pebble', 'dry', 'pebble'], wallDeco: ['cactus', 'rock', 'cactus', 'bones'],
            leaf: ['#3f7a3a', '#55934a', '#77b264'], frame: '#6b4a2a'
        },
        frost: {
            title: 'Frost',
            ground: ['#e1eaf2', '#e6eef5', '#dbe5ee', '#eaf1f7'],
            speck: '#cbd8e4', light: '#f7fbfe', blotch: ['#d2dfea', '#f3f8fc'],
            road: '#8ea8c2', roadEdge: '#5a7491', roadSpeck: '#9fb7cf', roadLight: '#b3c8dc', roadKind: 'ice',
            pad: '#b9d3e7', padHi: '#e0eef9', padLo: '#7f9fbb', padMark: '#9dbcd6', padKind: 'stone',
            wallTop: '#a9d4ee', wallSide: '#6a9fc6', wallHi: '#dcf1fd', wallLo: '#4f7fa6', wallKind: 'ice',
            groundDeco: ['snow', 'pebble', 'snow'], wallDeco: ['pine', 'pine', 'iceCrystal', 'rock'],
            leaf: ['#24543f', '#2f6a4f', '#3f8462'], frame: '#5d7f9c'
        },
        void: {
            title: 'Void',
            ground: ['#2f2447', '#33284d', '#2b2142', '#372b52'],
            speck: '#3d3060', light: '#4c3d74', blotch: ['#271d3b', '#40336a'],
            road: '#6c58a3', roadEdge: '#3a2a64', roadSpeck: '#7a66b2', roadLight: '#8a77c4', roadKind: 'glow',
            pad: '#4a3b72', padHi: '#66559a', padLo: '#2a2047', padMark: '#5a4a88', padKind: 'stone',
            wallTop: '#4f3582', wallSide: '#31205a', wallHi: '#8669cf', wallLo: '#22163f', wallKind: 'crystal',
            groundDeco: ['glow', 'pebble', 'glow'], wallDeco: ['crystal', 'crystal', 'shroom', 'crystal'],
            leaf: ['#5b3f9a', '#7a5cc4', '#a68af0'], frame: '#1a1230'
        },
        ash: {
            title: 'Ashlands',
            ground: ['#4b4542', '#4f4845', '#46403d', '#544c48'],
            speck: '#3e3835', light: '#5f5753', blotch: ['#403a37', '#5a514c'],
            road: '#7b6b5f', roadEdge: '#2f2826', roadSpeck: '#6c5d52', roadLight: '#8a796c', roadKind: 'dirt',
            pad: '#646160', padHi: '#827e7c', padLo: '#3c3a39', padMark: '#55524f', padKind: 'stone',
            wallTop: '#3b3433', wallSide: '#241f1f', wallHi: '#57504e', wallLo: '#171313', wallKind: 'basalt',
            groundDeco: ['ember', 'pebble', 'pebble'], wallDeco: ['lava', 'deadTree', 'lava', 'rock'],
            leaf: ['#4a3a30', '#5c4a3c', '#6e5a49'], frame: '#1c1716'
        }
    };

    const MAP_THEMES = {
        spiral: 'meadow', loops: 'city', branch: 'desert', branchAlt: 'frost',
        fork: 'void', walls: 'ash', city: 'city', freeway: 'city',
        empty2: 'meadow', sparse2: 'meadow', dense2: 'desert', solid2: 'frost',
        empty3: 'meadow', sparse3: 'frost', dense3: 'desert', solid3: 'ash'
    };

    // Pick a theme for a map: explicit, by campaign id, or guessed from its decoration tiles
    function themeFor(m, id) {
        if (m && m.theme && THEMES[m.theme]) return m.theme;
        if (id && MAP_THEMES[id]) return MAP_THEMES[id];
        if (!m || !m.display) return 'meadow';
        const count = {};
        m.display.forEach(col => col.forEach(d => { count[d] = (count[d] || 0) + 1; }));
        const has = (re) => Object.keys(count).some(k => re.test(k));
        if (has(/^(road|lCorner|rCorner|sidewalk)$/)) return 'city';
        if (has(/^c1_|neon_(pink|purple)/)) return 'frost';
        if (has(/^c0_|neon_/)) return 'void';
        if (has(/^c2_/)) return 'desert';
        return 'meadow';
    }

    // ---------- Helpers ----------

    // Seeded random in [0, 1) for a tile and a salt
    function hash(x, y, s = 0) {
        let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    const ROAD_DECO = new Set(['road', 'lCorner', 'rCorner']);

    // Visual class of a tile: 'w' wall, 'r' road, 'p' pad, 'g' ground
    function tileClass(m, x, y) {
        const g = m.grid[x][y];
        if (g === 1) return 'w';
        if (g === 3) return 'p';
        if (g === 2 || g === 4) return 'r';
        const d = m.display && m.display[x] ? m.display[x][y] : null;
        if (ROAD_DECO.has(d)) return 'r';
        return 'g';
    }

    function makeCanvas(w, h) {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(w));
        c.height = Math.max(1, Math.ceil(h));
        return c;
    }

    // Rounded rectangle path with its own radius per corner (tl, tr, br, bl)
    function roundRectPath(ctx, x, y, w, h, tl, tr, br, bl) {
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr); else ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h - br);
        if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br); else ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + bl, y + h);
        if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl); else ctx.lineTo(x, y + h);
        ctx.lineTo(x, y + tl);
        if (tl) ctx.arcTo(x, y, x + tl, y, tl); else ctx.lineTo(x, y);
        ctx.closePath();
    }

    // One path covering every tile where inside(x, y) holds, with rounded outer
    // corners and filleted inner corners. inset shrinks it on open sides and
    // lift raises the bottom edge of the lowest row (wall tops).
    function blobPath(ctx, cols, rows, inside, px, inset, radius, lift = 0) {
        const In = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && inside(x, y);
        const e = 0.6;      // overlap between neighbours so no seams show
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (!In(x, y)) continue;
                const n = In(x, y - 1), s = In(x, y + 1), w = In(x - 1, y), ea = In(x + 1, y);
                const bottom = s ? 0 : inset + lift;
                const l = w ? -e : inset;
                const t = n ? -e : inset;
                const r = ea ? -e : inset;
                const b = s ? -e : bottom;
                const X = x * px + l;
                const Y = y * px + t;
                const W = px - l - r;
                const H = px - t - b;
                const rr = Math.max(0, Math.min(radius, W / 2, H / 2));
                roundRectPath(ctx, X, Y, W, H,
                    !n && !w ? rr : 0, !n && !ea ? rr : 0, !s && !ea ? rr : 0, !s && !w ? rr : 0);
                // Fillets where two sides continue but the diagonal does not
                const R = radius * 0.8;
                if (R > 0.5) {
                    if (n && w && !In(x - 1, y - 1)) fillet(ctx, x * px, y * px, -1, -1, R, inset);
                    if (n && ea && !In(x + 1, y - 1)) fillet(ctx, (x + 1) * px, y * px, 1, -1, R, inset);
                    if (s && w && !In(x - 1, y + 1)) fillet(ctx, x * px, (y + 1) * px, -1, 1, R, inset);
                    if (s && ea && !In(x + 1, y + 1)) fillet(ctx, (x + 1) * px, (y + 1) * px, 1, 1, R, inset);
                }
            }
        }
    }

    // Fills the outside corner of a missing diagonal tile so inner corners curve
    function fillet(ctx, px0, py0, dx, dy, R, inset) {
        // P is the sharp inner corner; the missing tile lies towards (dx, dy)
        const Px = px0 - dx * inset;
        const Py = py0 - dy * inset;
        ctx.moveTo(Px, Py + dy * R);
        ctx.lineTo(Px, Py);
        ctx.lineTo(Px + dx * R, Py);
        ctx.arcTo(Px, Py, Px, Py + dy * R, R);
        ctx.closePath();
    }

    function circle(ctx, x, y, r, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.3, r), 0, Math.PI * 2);
        ctx.fill();
    }

    function ellipse(ctx, x, y, rx, ry, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.max(0.3, rx), Math.max(0.3, ry), 0, 0, Math.PI * 2);
        ctx.fill();
    }

    function poly(ctx, pts, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
        ctx.closePath();
        ctx.fill();
    }

    // ---------- Decorations (drawn at tile centre cx, cy with tile size s) ----------

    const DECO = {
        tuft(ctx, cx, cy, s, th, r) {
            ctx.strokeStyle = r < 0.5 ? th.light : th.speck;
            ctx.lineWidth = Math.max(1, s * 0.04);
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = -1; i <= 1; i++) {
                ctx.moveTo(cx + i * s * 0.06, cy);
                ctx.lineTo(cx + i * s * 0.1, cy - s * (0.12 + 0.04 * (1 - Math.abs(i))));
            }
            ctx.stroke();
        },
        flower(ctx, cx, cy, s, th, r) {
            const c = ['#f9f3d8', '#f6d24a', '#f08ab0', '#b9a7f2'][Math.floor(r * 4)];
            for (let i = 0; i < 3; i++) {
                const a = r * 9 + i * 2.1;
                circle(ctx, cx + Math.cos(a) * s * 0.12, cy + Math.sin(a) * s * 0.1, s * 0.035, c);
            }
        },
        pebble(ctx, cx, cy, s, th, r) {
            ellipse(ctx, cx + s * 0.02, cy + s * 0.03, s * 0.08, s * 0.05, 'rgba(0,0,0,0.18)');
            ellipse(ctx, cx, cy, s * 0.07, s * 0.05, th.padLo);
            ellipse(ctx, cx - s * 0.015, cy - s * 0.015, s * 0.04, s * 0.025, th.padHi);
        },
        dry(ctx, cx, cy, s, th) {
            ctx.strokeStyle = '#a4834f';
            ctx.lineWidth = Math.max(1, s * 0.03);
            ctx.beginPath();
            for (let i = 0; i < 4; i++) {
                const a = -Math.PI / 2 + (i - 1.5) * 0.45;
                ctx.moveTo(cx, cy);
                ctx.lineTo(cx + Math.cos(a) * s * 0.14, cy + Math.sin(a) * s * 0.14);
            }
            ctx.stroke();
        },
        snow(ctx, cx, cy, s) {
            ellipse(ctx, cx, cy, s * 0.12, s * 0.06, '#ffffff');
            ellipse(ctx, cx + s * 0.03, cy + s * 0.025, s * 0.08, s * 0.03, 'rgba(120,150,180,0.25)');
        },
        glow(ctx, cx, cy, s, th, r) {
            circle(ctx, cx, cy, s * 0.07, 'rgba(170,130,255,0.18)');
            circle(ctx, cx, cy, s * 0.025, r < 0.5 ? '#c7b2ff' : '#7ef0ff');
        },
        ember(ctx, cx, cy, s, th, r) {
            circle(ctx, cx, cy, s * 0.06, 'rgba(255,120,30,0.18)');
            circle(ctx, cx, cy, s * 0.022, r < 0.5 ? '#ff9a3c' : '#ffcf5a');
        },
        tree(ctx, cx, cy, s, th, r) {
            const k = 0.85 + r * 0.3;
            ellipse(ctx, cx + s * 0.1, cy + s * 0.14, s * 0.36 * k, s * 0.22 * k, 'rgba(0,0,0,0.25)');
            circle(ctx, cx, cy, s * 0.36 * k, th.leaf[0]);
            circle(ctx, cx - s * 0.05, cy - s * 0.06, s * 0.28 * k, th.leaf[1]);
            circle(ctx, cx - s * 0.1, cy - s * 0.12, s * 0.15 * k, th.leaf[2]);
            circle(ctx, cx + s * 0.13, cy + s * 0.02, s * 0.1 * k, th.leaf[1]);
        },
        pine(ctx, cx, cy, s, th, r) {
            const k = 0.8 + r * 0.35;
            ellipse(ctx, cx + s * 0.1, cy + s * 0.18, s * 0.3 * k, s * 0.14 * k, 'rgba(30,50,80,0.22)');
            for (let i = 0; i < 3; i++) {
                const w = s * (0.34 - i * 0.09) * k;
                const y = cy + s * (0.22 - i * 0.17) * k;
                poly(ctx, [cx - w, y, cx + w, y, cx, y - s * 0.3 * k], th.leaf[i]);
                poly(ctx, [cx - w * 0.5, y - s * 0.1 * k, cx + w * 0.2, y - s * 0.12 * k, cx, y - s * 0.3 * k], '#f4f9fd');
            }
        },
        bush(ctx, cx, cy, s, th) {
            ellipse(ctx, cx + s * 0.06, cy + s * 0.1, s * 0.3, s * 0.14, 'rgba(0,0,0,0.22)');
            circle(ctx, cx - s * 0.12, cy, s * 0.15, th.leaf[0]);
            circle(ctx, cx + s * 0.1, cy + s * 0.02, s * 0.16, th.leaf[0]);
            circle(ctx, cx, cy - s * 0.08, s * 0.16, th.leaf[1]);
            circle(ctx, cx - s * 0.04, cy - s * 0.13, s * 0.07, th.leaf[2]);
            circle(ctx, cx + s * 0.08, cy - s * 0.05, s * 0.03, '#e05a5a');
        },
        rock(ctx, cx, cy, s, th, r) {
            const k = 0.8 + r * 0.4;
            ellipse(ctx, cx + s * 0.08, cy + s * 0.12, s * 0.28 * k, s * 0.14 * k, 'rgba(0,0,0,0.28)');
            poly(ctx, [cx - s * 0.26 * k, cy + s * 0.1 * k, cx - s * 0.18 * k, cy - s * 0.14 * k, cx + s * 0.04 * k, cy - s * 0.22 * k,
                cx + s * 0.24 * k, cy - s * 0.06 * k, cx + s * 0.2 * k, cy + s * 0.14 * k], th.wallLo);
            poly(ctx, [cx - s * 0.2 * k, cy + s * 0.04 * k, cx - s * 0.14 * k, cy - s * 0.12 * k, cx + s * 0.03 * k, cy - s * 0.18 * k,
                cx + s * 0.18 * k, cy - s * 0.06 * k, cx + s * 0.04 * k, cy + s * 0.02 * k], th.wallHi);
        },
        cactus(ctx, cx, cy, s, th, r) {
            ellipse(ctx, cx + s * 0.1, cy + s * 0.16, s * 0.22, s * 0.08, 'rgba(0,0,0,0.25)');
            ctx.lineCap = 'round';
            ctx.strokeStyle = th.leaf[0];
            ctx.lineWidth = s * 0.16;
            ctx.beginPath();
            ctx.moveTo(cx, cy + s * 0.18);
            ctx.lineTo(cx, cy - s * 0.24);
            ctx.moveTo(cx - s * 0.17, cy - s * 0.12);
            ctx.lineTo(cx - s * 0.17, cy + s * 0.02);
            ctx.lineTo(cx, cy + s * 0.02);
            ctx.moveTo(cx + s * 0.16, cy - s * 0.04);
            ctx.lineTo(cx + s * 0.16, cy + s * 0.08);
            ctx.lineTo(cx, cy + s * 0.08);
            ctx.stroke();
            ctx.strokeStyle = th.leaf[2];
            ctx.lineWidth = s * 0.04;
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.03, cy + s * 0.12);
            ctx.lineTo(cx - s * 0.03, cy - s * 0.24);
            ctx.stroke();
            if (r > 0.6) circle(ctx, cx, cy - s * 0.3, s * 0.05, '#f08ab0');
        },
        bones(ctx, cx, cy, s) {
            ctx.strokeStyle = '#efe6d2';
            ctx.lineWidth = s * 0.05;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.18, cy - s * 0.05);
            ctx.lineTo(cx + s * 0.16, cy + s * 0.06);
            ctx.moveTo(cx - s * 0.1, cy + s * 0.12);
            ctx.lineTo(cx + s * 0.08, cy - s * 0.12);
            ctx.stroke();
            circle(ctx, cx + s * 0.2, cy - s * 0.12, s * 0.07, '#efe6d2');
            circle(ctx, cx + s * 0.18, cy - s * 0.12, s * 0.02, '#6b4a2a');
        },
        iceCrystal(ctx, cx, cy, s) {
            ellipse(ctx, cx + s * 0.06, cy + s * 0.16, s * 0.26, s * 0.08, 'rgba(40,80,120,0.22)');
            const spikes = [[-0.14, 0.14, 0.32], [0.02, 0.16, 0.44], [0.16, 0.14, 0.28]];
            spikes.forEach(([dx, y0, h]) => {
                poly(ctx, [cx + (dx - 0.07) * s, cy + y0 * s, cx + (dx + 0.07) * s, cy + y0 * s, cx + (dx + 0.04) * s, cy + (y0 - h) * s, cx + dx * s, cy + (y0 - h - 0.06) * s], '#8fd0f5');
                poly(ctx, [cx + (dx - 0.07) * s, cy + y0 * s, cx + dx * s, cy + y0 * s, cx + dx * s, cy + (y0 - h - 0.06) * s], '#e6f7ff');
            });
        },
        crystal(ctx, cx, cy, s, th, r) {
            circle(ctx, cx, cy, s * 0.36, 'rgba(160,110,255,0.14)');
            ellipse(ctx, cx + s * 0.06, cy + s * 0.16, s * 0.26, s * 0.08, 'rgba(0,0,0,0.3)');
            const hue = r < 0.5 ? ['#9f7bf0', '#d9c9ff', '#6a48c4'] : ['#58d8f0', '#c9f7ff', '#2a8fb4'];
            const spikes = [[-0.15, 0.14, 0.26], [0.02, 0.18, 0.42], [0.17, 0.12, 0.3]];
            spikes.forEach(([dx, y0, h]) => {
                poly(ctx, [cx + (dx - 0.08) * s, cy + y0 * s, cx + (dx + 0.08) * s, cy + y0 * s, cx + (dx + 0.05) * s, cy + (y0 - h) * s, cx + dx * s, cy + (y0 - h - 0.08) * s], hue[2]);
                poly(ctx, [cx + (dx - 0.08) * s, cy + y0 * s, cx + dx * s, cy + y0 * s, cx + dx * s, cy + (y0 - h - 0.08) * s, cx + (dx - 0.05) * s, cy + (y0 - h) * s], hue[0]);
                poly(ctx, [cx + (dx - 0.02) * s, cy + (y0 - 0.04) * s, cx + dx * s, cy + (y0 - h - 0.04) * s, cx + (dx - 0.04) * s, cy + (y0 - h + 0.02) * s], hue[1]);
            });
        },
        shroom(ctx, cx, cy, s, th, r) {
            circle(ctx, cx, cy - s * 0.04, s * 0.3, 'rgba(120,240,255,0.12)');
            [[-0.12, 0.06, 0.12], [0.1, 0.1, 0.09], [0.02, -0.08, 0.14]].forEach(([dx, dy, k]) => {
                ellipse(ctx, cx + dx * s, cy + (dy + 0.04) * s, k * 0.4 * s, k * 0.6 * s, '#cfc2e8');
                ellipse(ctx, cx + dx * s, cy + dy * s, k * s, k * 0.62 * s, r < 0.5 ? '#46d9e8' : '#c86cf0');
                circle(ctx, cx + (dx - k * 0.3) * s, cy + (dy - k * 0.15) * s, k * 0.22 * s, '#e8fbff');
            });
        },
        lava(ctx, cx, cy, s, th, r) {
            circle(ctx, cx, cy, s * 0.3, 'rgba(255,90,20,0.16)');
            ellipse(ctx, cx, cy, s * 0.22, s * 0.15, '#2a1a14');
            ellipse(ctx, cx, cy, s * 0.17, s * 0.11, '#e8571a');
            ellipse(ctx, cx - s * 0.03, cy - s * 0.02, s * 0.1, s * 0.06, '#ffb43c');
            circle(ctx, cx + s * 0.06 * (r - 0.5), cy - s * 0.01, s * 0.025, '#fff1a8');
        },
        deadTree(ctx, cx, cy, s, th, r) {
            ellipse(ctx, cx + s * 0.08, cy + s * 0.12, s * 0.2, s * 0.08, 'rgba(0,0,0,0.3)');
            ctx.strokeStyle = '#2a211c';
            ctx.lineCap = 'round';
            ctx.lineWidth = s * 0.07;
            ctx.beginPath();
            ctx.moveTo(cx, cy + s * 0.12);
            ctx.lineTo(cx + s * 0.02, cy - s * 0.12);
            ctx.lineTo(cx - s * 0.14, cy - s * 0.28);
            ctx.moveTo(cx + s * 0.02, cy - s * 0.08);
            ctx.lineTo(cx + s * 0.18, cy - s * 0.22 - r * s * 0.06);
            ctx.stroke();
        },
        ac(ctx, cx, cy, s) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(cx - s * 0.16, cy - s * 0.1, s * 0.36, s * 0.3);
            ctx.fillStyle = '#9aa2ad';
            ctx.fillRect(cx - s * 0.2, cy - s * 0.16, s * 0.36, s * 0.3);
            circle(ctx, cx - s * 0.02, cy - s * 0.01, s * 0.1, '#4b525c');
            ctx.strokeStyle = '#7d8590';
            ctx.lineWidth = Math.max(1, s * 0.025);
            ctx.beginPath();
            ctx.moveTo(cx - s * 0.11, cy - s * 0.01);
            ctx.lineTo(cx + s * 0.07, cy - s * 0.01);
            ctx.moveTo(cx - s * 0.02, cy - s * 0.1);
            ctx.lineTo(cx - s * 0.02, cy + s * 0.08);
            ctx.stroke();
        },
        vent(ctx, cx, cy, s, th) {
            circle(ctx, cx + s * 0.03, cy + s * 0.04, s * 0.11, 'rgba(0,0,0,0.3)');
            circle(ctx, cx, cy, s * 0.11, th.wallHi);
            circle(ctx, cx, cy, s * 0.06, th.wallLo);
        },
        tank(ctx, cx, cy, s) {
            circle(ctx, cx + s * 0.05, cy + s * 0.06, s * 0.17, 'rgba(0,0,0,0.3)');
            circle(ctx, cx, cy, s * 0.17, '#8b6a4c');
            circle(ctx, cx, cy, s * 0.12, '#a5825f');
            circle(ctx, cx - s * 0.04, cy - s * 0.04, s * 0.04, '#c39e78');
        },
        solar(ctx, cx, cy, s) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(cx - s * 0.2, cy - s * 0.12, s * 0.44, s * 0.3);
            ctx.fillStyle = '#26406b';
            ctx.fillRect(cx - s * 0.24, cy - s * 0.16, s * 0.44, s * 0.28);
            ctx.strokeStyle = '#4f74ad';
            ctx.lineWidth = Math.max(1, s * 0.015);
            ctx.beginPath();
            for (let i = 1; i < 4; i++) {
                ctx.moveTo(cx - s * 0.24 + i * s * 0.11, cy - s * 0.16);
                ctx.lineTo(cx - s * 0.24 + i * s * 0.11, cy + s * 0.12);
            }
            ctx.moveTo(cx - s * 0.24, cy - s * 0.02);
            ctx.lineTo(cx + s * 0.2, cy - s * 0.02);
            ctx.stroke();
        }
    };

    // ---------- Tile textures ----------

    // A few ground tiles with speckles and grass, picked per tile by hash
    function groundTiles(th, px) {
        return th.ground.map((base, v) => {
            const c = makeCanvas(px, px);
            const g = c.getContext('2d');
            // Variants stay close to the first colour so the grid does not show
            g.fillStyle = th.ground[0];
            g.fillRect(0, 0, px, px);
            g.globalAlpha = 0.4;
            g.fillStyle = base;
            g.fillRect(0, 0, px, px);
            g.globalAlpha = 1;
            const n = 7;
            for (let i = 0; i < n; i++) {
                const r = hash(v, i, 3);
                const x = hash(v, i, 4) * px;
                const y = hash(v, i, 5) * px;
                g.fillStyle = r < 0.5 ? th.speck : th.light;
                g.globalAlpha = 0.55;
                g.fillRect(x, y, Math.max(1, px * 0.05), Math.max(1, px * 0.05));
            }
            g.globalAlpha = 1;
            return c;
        });
    }

    // ---------- Main render ----------

    // opts: { m: map data (cols, rows, grid, display, spawnpoints, exit),
    //         theme, px: pixels per tile, decorations (default true) }
    function render(opts) {
        const m = opts.m;
        const px = opts.px;
        const th = THEMES[opts.theme] || THEMES.meadow;
        const cols = m.cols;
        const rows = m.rows;
        const canvas = opts.canvas || makeCanvas(cols * px, rows * px);
        if (canvas.width !== Math.ceil(cols * px) || canvas.height !== Math.ceil(rows * px)) {
            canvas.width = Math.ceil(cols * px);
            canvas.height = Math.ceil(rows * px);
        }
        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.lineJoin = 'round';

        const cls = [];
        for (let x = 0; x < cols; x++) {
            cls[x] = [];
            for (let y = 0; y < rows; y++) cls[x][y] = tileClass(m, x, y);
        }
        const deco = (x, y) => (m.display && m.display[x] ? m.display[x][y] : null);
        const isWall = (x, y) => cls[x][y] === 'w';
        const isRoad = (x, y) => cls[x][y] === 'r';
        const isPad = (x, y) => cls[x][y] === 'p';
        const special = new Set();
        (m.spawnpoints || []).forEach(s => special.add(`${s[0]},${s[1]}`));
        if (m.exit) special.add(`${m.exit[0]},${m.exit[1]}`);

        // 1. Ground everywhere
        const gt = groundTiles(th, Math.ceil(px));
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const v = Math.floor(hash(x, y, 1) * gt.length);
                ctx.drawImage(gt[v], x * px, y * px, px + 0.5, px + 0.5);
            }
        }
        // Large soft patches so the ground does not look tiled
        const patches = Math.ceil(cols * rows / 5);
        for (let i = 0; i < patches; i++) {
            const x = hash(i, 7, 8) * cols * px;
            const y = hash(i, 9, 8) * rows * px;
            ctx.globalAlpha = 0.18;
            circle(ctx, x, y, px * (0.8 + hash(i, 2, 8) * 1.6), th.blotch[i % 2]);
        }
        ctx.globalAlpha = 1;

        // 2. Tower pads
        const padKind = (x, y) => {
            const d = deco(x, y);
            if (d === 'grass') return 'grass';
            if (d === 'sidewalk') return 'pave';
            return th.padKind;
        };
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const c = cls[x][y];
                const d = deco(x, y);
                if (c === 'g' && d === 'sidewalk') drawPave(ctx, x, y, px, th, isPadOrPave);
                if (c !== 'p') continue;
                const k = padKind(x, y);
                if (k === 'grass') drawPlot(ctx, x, y, px, th);
                else if (k === 'pave') drawPave(ctx, x, y, px, th, isPadOrPave);
                else drawSlab(ctx, x, y, px, th);
            }
        }
        function isPadOrPave(x, y) {
            if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
            const d = deco(x, y);
            return (cls[x][y] === 'p' && padKind(x, y) === 'pave') || (cls[x][y] === 'g' && d === 'sidewalk');
        }

        // 3. Roads: edge band, surface, texture
        const roadInset = px * 0.04;
        ctx.beginPath();
        blobPath(ctx, cols, rows, isRoad, px, roadInset, px * 0.32);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.save();
        ctx.translate(px * 0.03, px * 0.05);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = th.roadEdge;
        ctx.fill();
        const roadPath = new Path2D();
        blobPath(roadPath, cols, rows, isRoad, px, roadInset + px * 0.08, px * 0.26);
        ctx.fillStyle = th.road;
        ctx.fill(roadPath);
        ctx.save();
        ctx.clip(roadPath);
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (!isRoad(x, y)) continue;
                roadTexture(ctx, x, y, px, th, isRoad, cols, rows, deco(x, y));
            }
        }
        ctx.restore();
        // Soft shadow under the road's upper edge so it reads as worn into the ground
        innerShadow(ctx, roadPath, cols * px, rows * px, px * 0.09, 'rgba(0,0,0,0.2)');

        // 4. Walls: shadow, side face, top face with a lit rim
        const lift = px * (th.wallKind === 'building' ? 0.3 : 0.24);
        const wallR = th.wallKind === 'building' ? px * 0.08 : px * 0.3;
        const outer = new Path2D();
        blobPath(outer, cols, rows, isWall, px, px * 0.02, wallR);
        ctx.save();
        ctx.translate(px * 0.12, px * 0.1);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fill(outer);
        ctx.restore();
        ctx.fillStyle = th.wallSide;
        ctx.fill(outer);
        const top = new Path2D();
        blobPath(top, cols, rows, isWall, px, px * 0.02, wallR, lift);
        ctx.save();
        ctx.translate(-px * 0.025, -px * 0.03);
        ctx.fillStyle = th.wallHi;
        ctx.fill(top);
        ctx.restore();
        ctx.fillStyle = th.wallTop;
        ctx.fill(top);
        ctx.save();
        ctx.clip(top);
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (isWall(x, y)) wallTexture(ctx, x, y, px, th, isWall);
            }
        }
        ctx.restore();
        // Side face detail: dark line at the foot and vertical cracks or windows
        ctx.save();
        ctx.clip(outer);
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (!isWall(x, y) || (y + 1 < rows && isWall(x, y + 1))) continue;
                wallSide(ctx, x, y, px, th, lift);
            }
        }
        ctx.restore();

        // 5. Decorations
        if (opts.decorations !== false) {
            for (let x = 0; x < cols; x++) {
                for (let y = 0; y < rows; y++) {
                    const c = cls[x][y];
                    const key = `${x},${y}`;
                    if (special.has(key)) continue;
                    const r = hash(x, y, 11);
                    if (c === 'w') {
                        // Fewer, bigger props deep inside large wall areas
                        const inner = x > 0 && y > 0 && x < cols - 1 && y < rows - 1 &&
                            isWall(x - 1, y) && isWall(x + 1, y) && isWall(x, y - 1) && isWall(x, y + 1);
                        if (r < (inner ? 0.3 : 0.38)) {
                            const list = th.wallDeco;
                            const name = list[Math.floor(hash(x, y, 12) * list.length)];
                            const ox = (hash(x, y, 13) - 0.5) * px * (inner ? 0.5 : 0.24);
                            const oy = (hash(x, y, 14) - 0.5) * px * (inner ? 0.5 : 0.16) - lift * 0.5;
                            const k = inner ? 0.85 + hash(x, y, 16) * 0.45 : 1;
                            DECO[name](ctx, (x + 0.5) * px + ox, (y + 0.5) * px + oy, px * k, th, hash(x, y, 15));
                        }
                    } else if (c === 'g' && deco(x, y) !== 'sidewalk' && r < 0.3) {
                        const list = th.groundDeco;
                        const name = list[Math.floor(hash(x, y, 12) * list.length)];
                        const ox = (hash(x, y, 13) - 0.5) * px * 0.6;
                        const oy = (hash(x, y, 14) - 0.5) * px * 0.6;
                        DECO[name](ctx, (x + 0.5) * px + ox, (y + 0.5) * px + oy, px, th, hash(x, y, 15));
                    } else if (c === 'p' && padKind(x, y) === 'grass' && r < 0.18) {
                        DECO.flower(ctx, (x + 0.5) * px, (y + 0.5) * px, px * 0.8, th, hash(x, y, 15));
                    }
                }
            }
        }

        // 6. Stone plates under the portals and the gate
        (m.spawnpoints || []).forEach(s => plate(ctx, s[0], s[1], px, '#2a2238', '#4b3d66'));
        if (m.exit) plate(ctx, m.exit[0], m.exit[1], px, '#3a3220', '#6b5a2e');

        // Thin dark rim around the map
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = Math.max(1, px * 0.06);
        ctx.strokeRect(0, 0, cols * px, rows * px);
        return canvas;
    }

    // Darkens the strip of a shape that a copy shifted down by d does not cover
    function innerShadow(ctx, path, w, h, d, color) {
        const c = makeCanvas(w, h);
        const g = c.getContext('2d');
        g.fillStyle = color;
        g.fill(path);
        g.globalCompositeOperation = 'destination-out';
        g.translate(0, d);
        g.fillStyle = '#000';
        g.fill(path);
        ctx.drawImage(c, 0, 0);
    }

    function drawSlab(ctx, x, y, px, th) {
        const i = px * 0.07;
        const X = x * px + i;
        const Y = y * px + i;
        const S = px - i * 2;
        const r = px * 0.12;
        ctx.beginPath();
        roundRectPath(ctx, X + px * 0.02, Y + px * 0.04, S, S, r, r, r, r);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fill();
        ctx.beginPath();
        roundRectPath(ctx, X, Y, S, S, r, r, r, r);
        ctx.fillStyle = th.padLo;
        ctx.fill();
        ctx.beginPath();
        roundRectPath(ctx, X, Y, S - px * 0.04, S - px * 0.05, r, r, r, r);
        ctx.fillStyle = th.padHi;
        ctx.fill();
        ctx.beginPath();
        roundRectPath(ctx, X + px * 0.03, Y + px * 0.035, S - px * 0.07, S - px * 0.08, r * 0.8, r * 0.8, r * 0.8, r * 0.8);
        ctx.fillStyle = th.pad;
        ctx.fill();
        // Faint build mark: four corner ticks
        ctx.strokeStyle = th.padMark;
        ctx.lineWidth = Math.max(1, px * 0.035);
        ctx.lineCap = 'round';
        const a = px * 0.24;
        const b = px * 0.36;
        const cx = (x + 0.5) * px - px * 0.015;
        const cy = (y + 0.5) * px - px * 0.02;
        ctx.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy]) => {
            ctx.moveTo(cx + sx * b, cy + sy * a);
            ctx.lineTo(cx + sx * b, cy + sy * b);
            ctx.lineTo(cx + sx * a, cy + sy * b);
        });
        ctx.stroke();
        if (hash(x, y, 21) < 0.25) {
            ctx.strokeStyle = th.padLo;
            ctx.lineWidth = Math.max(1, px * 0.02);
            ctx.beginPath();
            const sx = X + S * (0.2 + hash(x, y, 22) * 0.5);
            ctx.moveTo(sx, Y + S * 0.15);
            ctx.lineTo(sx + S * 0.08, Y + S * 0.35);
            ctx.lineTo(sx + S * 0.02, Y + S * 0.5);
            ctx.stroke();
        }
    }

    function drawPave(ctx, x, y, px, th, same) {
        ctx.fillStyle = th.padLo;
        ctx.fillRect(x * px, y * px, px + 0.5, px + 0.5);
        const h = px / 2;
        const g = Math.max(1, px * 0.035);
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                const v = hash(x * 2 + i, y * 2 + j, 31);
                ctx.fillStyle = v < 0.3 ? th.padHi : v > 0.85 ? th.padMark : th.pad;
                ctx.fillRect(x * px + i * h + g / 2, y * px + j * h + g / 2, h - g, h - g);
            }
        }
        // Kerb on edges next to something else
        ctx.fillStyle = th.padHi;
        const k = Math.max(1, px * 0.06);
        if (!same(x, y - 1)) ctx.fillRect(x * px, y * px, px, k);
        if (!same(x - 1, y)) ctx.fillRect(x * px, y * px, k, px);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        if (!same(x, y + 1)) ctx.fillRect(x * px, (y + 1) * px - k, px, k);
        if (!same(x + 1, y)) ctx.fillRect((x + 1) * px - k, y * px, k, px);
    }

    // A grassy build plot: a darker trimmed square with corner stones
    function drawPlot(ctx, x, y, px, th) {
        const i = px * 0.08;
        ctx.fillStyle = 'rgba(0,0,0,0.07)';
        ctx.fillRect(x * px + i, y * px + i, px - i * 2, px - i * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x * px + i, y * px + i, px - i * 2, Math.max(1, px * 0.04));
    }

    function roadTexture(ctx, x, y, px, th, isRoad, cols, rows, d) {
        const kind = ROAD_DECO.has(d) ? 'asphalt' : th.roadKind;
        if (kind === 'asphalt') {
            for (let i = 0; i < 5; i++) {
                ctx.fillStyle = i % 2 ? th.roadSpeck : th.roadLight;
                ctx.globalAlpha = 0.5;
                ctx.fillRect(x * px + hash(x, y, 40 + i) * px, y * px + hash(x, y, 50 + i) * px, Math.max(1, px * 0.04), Math.max(1, px * 0.04));
            }
            ctx.globalAlpha = 1;
            // Lane dashes on straight stretches
            const R = (a, b) => a >= 0 && b >= 0 && a < cols && b < rows && isRoad(a, b);
            const h = R(x - 1, y) && R(x + 1, y) && !R(x, y - 1) && !R(x, y + 1);
            const v = R(x, y - 1) && R(x, y + 1) && !R(x - 1, y) && !R(x + 1, y);
            ctx.fillStyle = '#e6c84a';
            if (h) ctx.fillRect(x * px + px * 0.25, (y + 0.5) * px - px * 0.03, px * 0.5, px * 0.06);
            if (v) ctx.fillRect((x + 0.5) * px - px * 0.03, y * px + px * 0.25, px * 0.06, px * 0.5);
            return;
        }
        if (kind === 'glow') {
            ctx.fillStyle = th.roadLight;
            for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = 0.5;
                circle(ctx, x * px + hash(x, y, 40 + i) * px, y * px + hash(x, y, 50 + i) * px, px * 0.03, '#d9cbff');
            }
            ctx.globalAlpha = 1;
            return;
        }
        // Dirt, ice: pebbles and wheel ruts
        for (let i = 0; i < 4; i++) {
            const r = hash(x, y, 40 + i);
            const ex = x * px + hash(x, y, 50 + i) * px;
            const ey = y * px + hash(x, y, 60 + i) * px;
            ellipse(ctx, ex, ey, px * (0.03 + r * 0.03), px * (0.02 + r * 0.02), r < 0.5 ? th.roadSpeck : th.roadLight);
        }
        if (kind === 'ice' && hash(x, y, 70) < 0.4) {
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = Math.max(1, px * 0.02);
            ctx.beginPath();
            const sx = x * px + hash(x, y, 71) * px;
            const sy = y * px + hash(x, y, 72) * px;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + px * 0.2, sy + px * 0.08);
            ctx.lineTo(sx + px * 0.3, sy - px * 0.05);
            ctx.stroke();
        }
    }

    function wallTexture(ctx, x, y, px, th, isWall) {
        const kind = th.wallKind;
        if (kind === 'building') {
            // Roof panels with a seam grid
            ctx.strokeStyle = th.wallLo;
            ctx.globalAlpha = 0.35;
            ctx.lineWidth = Math.max(1, px * 0.025);
            ctx.strokeRect(x * px + px * 0.12, y * px + px * 0.1, px * 0.76, px * 0.62);
            ctx.globalAlpha = 1;
            return;
        }
        for (let i = 0; i < 4; i++) {
            const r = hash(x, y, 80 + i);
            const ex = x * px + hash(x, y, 90 + i) * px;
            const ey = y * px + hash(x, y, 100 + i) * px * 0.8;
            ctx.globalAlpha = 0.6;
            ellipse(ctx, ex, ey, px * (0.04 + r * 0.06), px * (0.025 + r * 0.035), r < 0.5 ? th.wallLo : th.wallHi);
        }
        ctx.globalAlpha = 1;
        if (kind === 'basalt' && hash(x, y, 110) < 0.45) {
            ctx.strokeStyle = '#ff7a1a';
            ctx.lineWidth = Math.max(1, px * 0.03);
            ctx.beginPath();
            const sx = x * px + px * (0.2 + hash(x, y, 111) * 0.4);
            const sy = y * px + px * 0.2;
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + px * 0.12, sy + px * 0.18);
            ctx.lineTo(sx + px * 0.05, sy + px * 0.38);
            ctx.stroke();
        }
        if (kind === 'ice') {
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fillRect(x * px + px * 0.15, y * px + px * 0.12, px * 0.08, px * 0.3);
        }
    }

    function wallSide(ctx, x, y, px, th, lift) {
        const y0 = (y + 1) * px - lift;
        if (th.wallKind === 'building') {
            ctx.fillStyle = '#f6d36b';
            for (let i = 0; i < 3; i++) {
                if (hash(x, y, 120 + i) < 0.45) continue;
                ctx.globalAlpha = 0.85;
                ctx.fillRect(x * px + px * (0.12 + i * 0.28), y0 + lift * 0.3, px * 0.14, lift * 0.4);
            }
            ctx.globalAlpha = 1;
        } else {
            ctx.strokeStyle = th.wallLo;
            ctx.lineWidth = Math.max(1, px * 0.03);
            ctx.beginPath();
            for (let i = 0; i < 2; i++) {
                const sx = x * px + px * (0.25 + 0.5 * i + (hash(x, y, 130 + i) - 0.5) * 0.2);
                ctx.moveTo(sx, y0 + lift * 0.15);
                ctx.lineTo(sx + px * 0.03, y0 + lift * 0.85);
            }
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x * px, (y + 1) * px - Math.max(1, px * 0.05), px, Math.max(1, px * 0.05));
    }

    function plate(ctx, x, y, px, dark, light) {
        const cx = (x + 0.5) * px;
        const cy = (y + 0.5) * px;
        ellipse(ctx, cx + px * 0.03, cy + px * 0.05, px * 0.47, px * 0.45, 'rgba(0,0,0,0.3)');
        circle(ctx, cx, cy, px * 0.46, light);
        circle(ctx, cx, cy, px * 0.4, dark);
    }

    return { THEMES, MAP_THEMES, themeFor, render, hash, tileClass, makeCanvas, roundRectPath, DECO };
})();
