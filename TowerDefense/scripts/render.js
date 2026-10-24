// Frame renderer: draws the cached terrain, route hints, portals, towers,
// enemies, effects and overlays on one 2D canvas, and owns the camera
// (pinch / wheel zoom and drag to pan) and the pointer input on the map.
//
// World units are the game's pixels (a tile is `ts` wide); the camera maps them
// to the screen. Sprites come from Art.build at the current on-screen tile size.

// Small phones held upright (the same query as the compact layout in style.css):
// short side panels, and the map sits at the top of its box
const compactView = matchMedia('(orientation: portrait) and (max-width: 380px), (orientation: portrait) and (max-width: 899px) and (max-height: 700px)');
// Short side panels (selected tower, placing): those phones, and phones held sideways
const compactPanels = matchMedia(`${compactView.media}, (orientation: landscape) and (max-height: 560px)`);

const Renderer = (() => {
    const TAU = Math.PI * 2;
    const params = new URLSearchParams(location.search);
    const perfMode = params.get('perf') === '1';

    let holder = null;
    let canvas = null;
    let ctx = null;
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let holderH = 0;        // the map's box; taller than the canvas on small phones

    // Camera: world point at the centre of the view, and zoom (1 = whole map fits)
    let zoom = 1;
    let camX = 0;
    let camY = 0;
    let ox = 0;
    let oy = 0;

    let SP = null;          // { atlas, s, tile }
    let terrain = null;
    let terrainPx = 0;
    let terrainKey = '';
    let gridLayer = null;
    let gridKey = '';
    let theme = 'meadow';
    let rebuildAt = 0;
    let vignette = null;
    let hurtVignette = null;

    let hover = null;       // mouse position in world units, or null
    let shakeX = 0;         // shake offset of the last frame in CSS pixels (tests read it)
    let shakeY = 0;
    let drawCalls = 0;
    let last = performance.now();
    let time = 0;           // seconds, for idle animation

    // Upgrade preview: range to show for the selected tower while the upgrade is hovered
    let upgradeRange = 0;

    // Route hints
    let routeKey = '';
    let route = null;       // { x: Int16Array, y, a: Float32Array, i: Int16Array, n }
    let previewKey = '';
    let previewRoute = null;

    // Adaptive quality
    const frameTimes = new Float32Array(90);
    let frameIdx = 0;
    let qualityAuto = true;
    let slowFor = 0;
    let fastFor = 0;

    // Perf numbers
    const perf = { fps: 0, frameMs: 0, p95: 0, renderMs: 0, logicMs: 0, el: null, lastShow: 0, renderAcc: 0, logicAcc: 0, n: 0 };

    // ---------- Setup ----------

    function init(holderEl) {
        holder = holderEl;
        canvas = document.createElement('canvas');
        canvas.id = 'map';
        canvas.setAttribute('aria-label', 'Game map');
        holder.prepend(canvas);
        ctx = canvas.getContext('2d', { alpha: false });
        bindInput();
        buildZoomControls();
        if (perfMode) {
            perf.el = document.createElement('div');
            perf.el.className = 'perf';
            holder.append(perf.el);
        }
        resize();
    }

    function resize() {
        if (!holder) return;
        const w = holder.clientWidth;
        let h = holder.clientHeight;
        // Small phones: the canvas only covers the map (it sits at the top); the
        // strip under it is page, not canvas pixels the GPU has to fill every frame
        if (compactView.matches && cols && rows) h = Math.min(h, Math.ceil(rows * ts) + 4);
        const q = FX.quality;
        // The narrowest phones show the map much bigger than the old layout did: draw
        // it at 1.5 device pixels per CSS pixel there, so a frame costs no more than before
        const nd = Math.min(window.devicePixelRatio || 1, q === 0 ? 1.25 : compactView.matches && w < 340 ? 1.5 : 2);
        const hh = holder.clientHeight;
        if (w === cssW && h === cssH && nd === dpr && hh === holderH) return;
        holderH = hh;
        cssW = w;
        cssH = h;
        dpr = nd;
        canvas.width = Math.max(1, Math.round(w * dpr));
        canvas.height = Math.max(1, Math.round(h * dpr));
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        vignette = null;
        clampCamera();
        scheduleRebuild(0);
    }

    // Map changed (new game, new tiles, new size): rebuild the cached layers
    function mapChanged(themeId) {
        if (themeId) theme = themeId;
        terrainKey = '';
        gridKey = '';
        routeKey = '';
        previewKey = '';
        zoom = 1;
        camX = cols * ts / 2;
        camY = rows * ts / 2;
        clampCamera();
        updateZoomButtons();
        scheduleRebuild(0);
    }

    function scheduleRebuild(delay) {
        rebuildAt = performance.now() + delay;
    }

    function maxZoom() {
        return Math.max(1.5, Math.min(4, 60 / Math.max(4, ts)));
    }

    function clampCamera() {
        if (!cols || !rows) return;
        const mw = cols * ts;
        const mh = rows * ts;
        zoom = Math.max(1, Math.min(maxZoom(), zoom));
        const hw = cssW / 2 / zoom;
        const hh = cssH / 2 / zoom;
        camX = mw <= hw * 2 ? mw / 2 : Math.max(hw, Math.min(mw - hw, camX));
        camY = mh <= hh * 2 ? mh / 2 : Math.max(hh, Math.min(mh - hh, camY));
        ox = cssW / 2 - camX * zoom;
        oy = cssH / 2 - camY * zoom;
        // A map smaller than the view is centred, but keeps a strip free at the bottom
        // (or the right) for the hint and the zoom buttons, so they never cover it.
        // On small phones the map sits at the top and the canvas ends under it: the
        // strip below (holder, not canvas) holds the tips, the hint and the zoom buttons
        const sx = cssW - mw * zoom;
        const sy = cssH - mh * zoom;
        let g = gutterFor(mw, mh);
        if (holderH - cssH >= GUTTER) g = { side: 'bottom', size: holderH - cssH + (sy > 0 ? sy - Math.min(sy / 2, 2) : 0) };
        if (g.side === 'bottom' && sy > 0) oy = compactView.matches ? Math.min(sy / 2, 2) : Math.min(sy / 2, sy - GUTTER);
        if (g.side === 'right' && sx > 0) ox = Math.min(sx / 2, sx - GUTTER);
        layoutGutter(g);
    }

    // Free strip next to the whole map (zoom 1) for the overlays: bottom if there is
    // room, else right, else none (the overlays then sit small over the map)
    const GUTTER = 54;
    function gutterFor(mw, mh) {
        const sy = cssH - mh;
        const sx = cssW - mw;
        if (sy >= GUTTER) return { side: 'bottom', size: Math.max(GUTTER, sy / 2) };
        if (sx >= GUTTER) return { side: 'right', size: Math.max(GUTTER, sx / 2) };
        return { side: 'none', size: 0 };
    }

    let gutterKey = '';
    function layoutGutter(g) {
        const key = `${g.side}|${Math.round(g.size)}`;
        if (key === gutterKey || !holder) return;
        gutterKey = key;
        holder.dataset.gutter = g.side;
        holder.dataset.wide = g.size >= 170 ? '1' : g.size < 110 ? 'narrow' : '0';
        holder.style.setProperty('--gutter', `${Math.round(g.size)}px`);
    }

    function rebuild() {
        const tile = ts * zoom * dpr;
        if (!SP || Math.abs(SP.tile - tile) / tile > 0.12) SP = Art.build(tile);
        // Terrain: same resolution, capped so big maps stay small in memory
        const cap = Math.floor(Math.sqrt(7e6 / (cols * rows)));
        const px = Math.max(4, Math.min(Math.round(tile), cap));
        const key = `${theme}|${cols}x${rows}|${px}|${mapStamp}`;
        if (key !== terrainKey) {
            terrainKey = key;
            terrainPx = px;
            terrain = Terrain.render({ m: mapView(), px, theme, canvas: terrain || undefined });
            gridKey = '';
        }
        rebuildAt = 0;
    }

    // The current map in the shape Terrain.render expects
    function mapView() {
        return {
            cols, rows, grid, display,
            spawnpoints: spawnpoints.map(s => [s.x, s.y]),
            exit: [exit.x, exit.y]
        };
    }

    // Lines on the tiles a tower may use, shown while placing
    function buildGrid() {
        const px = terrainPx;
        const c = Terrain.makeCanvas(cols * px, rows * px);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = Math.max(1, px * 0.03);
        g.beginPath();
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                const v = grid[x][y];
                if (v !== 0 && v !== 3) continue;
                g.rect(x * px + px * 0.06, y * px + px * 0.06, px * 0.88, px * 0.88);
            }
        }
        g.stroke();
        gridLayer = c;
        gridKey = terrainKey;
    }

    // ---------- Camera input ----------

    const pointers = new Map();
    let pinch = null;
    let dragging = false;

    function toWorld(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        return { x: (clientX - r.left - ox) / zoom, y: (clientY - r.top - oy) / zoom };
    }

    // A press only turns into a pan after the pointer travels this far (CSS px), so
    // a click or tap with a shaky hand still lands. Below TAP_SLOP it is a tap even
    // when it moved (there is nothing to pan at zoom 1).
    const PAN_START = { mouse: 12, pen: 14, touch: 16 };
    const TAP_SLOP = 28;

    function bindInput() {
        canvas.addEventListener('contextmenu', e => e.preventDefault());
        canvas.addEventListener('pointerdown', e => {
            canvas.setPointerCapture(e.pointerId);
            if (e.pointerType === 'mouse') hover = toWorld(e.clientX, e.clientY);
            FX.calm(700);
            if (e.pointerType === 'mouse' && e.button !== 0) {
                if (e.button === 2) onMapTap(null, e);
                return;
            }
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false });
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom, mid: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
                dragging = true;
            }
        });
        canvas.addEventListener('pointermove', e => {
            if (e.pointerType === 'mouse') {
                hover = toWorld(e.clientX, e.clientY);
                FX.calm(500);
            }
            const p = pointers.get(e.pointerId);
            if (!p) return;
            const dx = e.clientX - p.x;
            const dy = e.clientY - p.y;
            p.x = e.clientX;
            p.y = e.clientY;
            if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > (PAN_START[e.pointerType] || 14)) p.moved = true;
            if (pinch && pointers.size >= 2) {
                const [a, b] = [...pointers.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
                const r = canvas.getBoundingClientRect();
                const mx = (a.x + b.x) / 2 - r.left;
                const my = (a.y + b.y) / 2 - r.top;
                zoom = Math.max(1, Math.min(maxZoom(), pinch.zoom * d / pinch.d));
                // keep the world point under the fingers in place
                camX = pinch.mid.x - (mx - cssW / 2) / zoom;
                camY = pinch.mid.y - (my - cssH / 2) / zoom;
                clampCamera();
                scheduleRebuild(160);
                updateZoomButtons();
            } else if (p.moved && zoom > 1.001) {
                dragging = true;
                camX -= dx / zoom;
                camY -= dy / zoom;
                clampCamera();
            }
        });
        const end = e => {
            const p = pointers.get(e.pointerId);
            pointers.delete(e.pointerId);
            if (pointers.size < 2) pinch = null;
            if (!p) return;
            // No pan or pinch happened: it's a tap on the tile under the press
            // (where the player aimed), whatever the pointer drifted to since
            if (!dragging && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < TAP_SLOP) {
                onMapTap(toWorld(p.sx, p.sy), e);
            }
            if (pointers.size === 0) dragging = false;
        };
        canvas.addEventListener('pointerup', end);
        canvas.addEventListener('pointercancel', e => {
            pointers.delete(e.pointerId);
            pinch = null;
            if (pointers.size === 0) dragging = false;
        });
        canvas.addEventListener('pointerleave', e => {
            if (e.pointerType === 'mouse') hover = null;
        });
        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const w = toWorld(e.clientX, e.clientY);
            const r = canvas.getBoundingClientRect();
            setZoom(zoom * Math.exp(-e.deltaY * 0.0015), w, e.clientX - r.left, e.clientY - r.top);
        }, { passive: false });
    }

    // Zoom keeping world point w under screen point (sx, sy)
    function setZoom(z, w, sx, sy) {
        const nz = Math.max(1, Math.min(maxZoom(), z));
        if (!w) {
            w = { x: camX, y: camY };
            sx = cssW / 2;
            sy = cssH / 2;
        }
        zoom = nz;
        camX = w.x - (sx - cssW / 2) / zoom;
        camY = w.y - (sy - cssH / 2) / zoom;
        clampCamera();
        scheduleRebuild(160);
        updateZoomButtons();
    }

    // Zoom buttons for touch screens: next to the map, or in the top bar on phones
    // held upright (no room beside the map there; the CSS shows one of the two)
    let zoomEls = [];
    function buildZoomControls() {
        const make = (cls, parent, first) => {
            if (!parent) return;
            const box = document.createElement('div');
            box.className = `zoom-ctl ${cls}`;
            box.innerHTML = `<button type="button" data-z="in" aria-label="Zoom in">+</button>
                <button type="button" data-z="out" aria-label="Zoom out">&minus;</button>`;
            box.addEventListener('click', e => {
                const b = e.target.closest('[data-z]');
                if (!b) return;
                setZoom(b.dataset.z === 'in' ? zoom * 1.5 : zoom / 1.5);
                b.blur();
            });
            if (first) parent.prepend(box); else parent.append(box);
            zoomEls.push(box);
        };
        make('on-map', holder);
        make('in-hud', document.querySelector('.hud-buttons'), true);
    }

    function updateZoomButtons() {
        zoomEls.forEach(box => {
            box.querySelector('[data-z="in"]').disabled = zoom >= maxZoom() - 0.01;
            box.querySelector('[data-z="out"]').disabled = zoom <= 1.001;
        });
    }

    // Bring the selected tower into view if it is off screen (never moves the map
    // under a tower that was just clicked or tapped: that one is on screen)
    function reveal(wx, wy) {
        if (zoom <= 1.001) return;
        const sx = ox + wx * zoom;
        const sy = oy + wy * zoom;
        if (sx > 0 && sx < cssW && sy > 0 && sy < cssH) return;
        camX = wx;
        camY = wy;
        clampCamera();
    }

    // ---------- Sprite helpers ----------

    let K = 1;              // device pixels per world unit
    let baseE = 0;
    let baseF = 0;
    let curAlpha = 1;
    let curOp = 'source-over';

    function setAlpha(a) {
        if (a !== curAlpha) {
            ctx.globalAlpha = a;
            curAlpha = a;
        }
    }

    function setOp(op) {
        if (op !== curOp) {
            ctx.globalCompositeOperation = op;
            curOp = op;
        }
    }

    function resetTransform() {
        ctx.setTransform(K, 0, 0, K, baseE, baseF);
    }

    // Draw sprite `name` centred on world (x, y), rotated, scaled by sx/sy
    function spr(name, x, y, rot = 0, sx = 1, sy = sx) {
        const s = SP.s[name];
        if (!s) return;
        const k = ts / SP.tile;
        const w = s.w * k;
        const h = s.h * k;
        drawCalls++;
        if (rot === 0 && sx === sy) {
            const W = w * sx;
            const H = h * sx;
            ctx.drawImage(SP.atlas, s.x, s.y, s.w, s.h, x - W / 2, y - H / 2, W, H);
            return;
        }
        const c = Math.cos(rot);
        const n = Math.sin(rot);
        ctx.setTransform(K * c * sx, K * n * sx, -K * n * sy, K * c * sy, baseE + x * K, baseF + y * K);
        ctx.drawImage(SP.atlas, s.x, s.y, s.w, s.h, -w / 2, -h / 2, w, h);
        ctx.setTransform(K, 0, 0, K, baseE, baseF);
    }

    // Natural sprite width in tiles
    const natural = (name) => SP.s[name].w / SP.tile;

    // ---------- Routes ----------

    const DIR_ANGLE = [0, Math.PI, -Math.PI / 2, 0, Math.PI / 2];
    const DX = [0, -1, 0, 1, 0];
    const DY = [0, 0, -1, 0, 1];

    // Follow direction arrows from every spawn to the exit; one entry per tile
    function traceRoute(dirAt) {
        const n = cols * rows;
        const best = new Int16Array(n).fill(-1);
        const starts = spawnpoints.map(s => [s.x, s.y]).concat(tempSpawns.map(([s]) => [s.x, s.y]));
        starts.forEach(([x, y]) => {
            let i = 0;
            const seen = new Uint8Array(n);
            while (x >= 0 && y >= 0 && x < cols && y < rows) {
                const k = x * rows + y;
                if (seen[k]) break;
                seen[k] = 1;
                if (x === exit.x && y === exit.y) break;
                if (best[k] === -1 || i < best[k]) best[k] = i;
                const d = dirAt(x, y);
                if (!d) break;
                x += DX[d];
                y += DY[d];
                i++;
            }
        });
        const out = { x: [], y: [], a: [], i: [], n: 0 };
        for (let k = 0; k < n; k++) {
            if (best[k] < 0) continue;
            const x = Math.floor(k / rows);
            const y = k % rows;
            const d = dirAt(x, y);
            if (!d) continue;
            out.x.push(x);
            out.y.push(y);
            out.a.push(DIR_ANGLE[d]);
            out.i.push(best[k]);
            out.n++;
        }
        return out;
    }

    // Directions enemies would take if tile (bx, by) were blocked (same search as recalculate)
    function flowWithBlock(bx, by) {
        const n = cols * rows;
        const occ = new Uint8Array(n);
        for (let i = 0; i < towers.length; i++) if (towers[i].alive) occ[towers[i].gridPos.x * rows + towers[i].gridPos.y] = 1;
        for (let i = 0; i < newTowers.length; i++) if (newTowers[i].alive) occ[newTowers[i].gridPos.x * rows + newTowers[i].gridPos.y] = 1;
        occ[bx * rows + by] = 1;
        const walk = (x, y) => grid[x][y] !== 1 && grid[x][y] !== 3 && !occ[x * rows + y];
        const dir = new Uint8Array(n);
        const seen = new Uint8Array(n);
        const q = new Int32Array(n);
        let h = 0;
        let t = 0;
        const start = exit.x * rows + exit.y;
        q[t++] = start;
        seen[start] = 1;
        while (h < t) {
            const k = q[h++];
            const x = Math.floor(k / rows);
            const y = k % rows;
            // Same neighbour order as neighbors(): left, up, right, down
            const nb = [[x - 1, y, 3], [x, y - 1, 4], [x + 1, y, 1], [x, y + 1, 2]];
            for (let j = 0; j < 4; j++) {
                const [nx, ny, d] = nb[j];
                if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                const nk = nx * rows + ny;
                if (seen[nk] || !walk(nx, ny)) continue;
                seen[nk] = 1;
                dir[nk] = d;
                q[t++] = nk;
            }
        }
        // Path tiles keep their authored direction
        for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (grid[x][y] === 2) dir[x * rows + y] = paths[x][y] || 0;
        return (x, y) => dir[x * rows + y];
    }

    // ---------- Frame ----------

    function frame(stepped) {
        const now = performance.now();
        const dt = Math.min(100, now - last);
        last = now;
        time += dt / 1000;
        trackQuality(dt);
        if (!cols || !SP && !canvas) return;
        if (rebuildAt && now >= rebuildAt || !SP || !terrain) rebuild();
        if (gridKey !== terrainKey && toPlace) buildGrid();
        FX.frame(stepped);
        drawCalls = 0;

        // Background
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        setAlpha(1);
        setOp('source-over');
        ctx.fillStyle = (Terrain.THEMES[theme] || Terrain.THEMES.meadow).frame;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Camera, plus the screen shake. The shake only moves the picture of the
        // world: hover, clicks and taps go through toWorld, which never sees it.
        const sh = FX.shakeOffset(now);
        shakeX = sh.x;
        shakeY = sh.y;
        K = zoom * dpr;
        baseE = (ox + sh.x) * dpr;
        baseF = (oy + sh.y) * dpr;
        resetTransform();
        ctx.imageSmoothingEnabled = true;

        const mw = cols * ts;
        const mh = rows * ts;
        // Keep effects inside the map
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, mw, mh);
        ctx.clip();
        ctx.drawImage(terrain, 0, 0, mw, mh);
        drawCalls++;
        if (toPlace && gridLayer) {
            setAlpha(0.28);
            ctx.drawImage(gridLayer, 0, 0, mw, mh);
            setAlpha(1);
        }

        drawRoute();
        drawPortals();
        drawRanges();
        drawTowerBases();
        drawEnemies(stepped);
        drawTurrets();
        drawRings();
        drawBeams();
        drawProjectiles();
        drawParticles();
        if (healthBar) drawBars();
        drawPlacement();
        drawSelection();
        drawFloaters();
        ctx.restore();
        curAlpha = ctx.globalAlpha;
        curOp = ctx.globalCompositeOperation;

        // Screen-space overlays
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        drawOverlays();
        fadeTip();
        setAlpha(1);
        setOp('source-over');

        const rt = performance.now() - now;
        perf.renderAcc += rt;
        perf.n++;
        if (perf.el && now - perf.lastShow > 400) showPerf(now);
    }

    // ---------- Layers ----------

    function drawRoute() {
        const key = `${pathVersion}|${tempSpawns.length}|${cols}x${rows}`;
        if (key !== routeKey) {
            routeKey = key;
            route = traceRoute((x, y) => paths[x][y]);
        }
        const strong = !started || toPlace;
        if (FX.quality === 0 && !strong) return;
        // Placement preview: the way enemies would go with the new tower
        let r = route;
        let tint = false;
        const p = toPlace ? placementTile() : null;
        if (p && grid[p.x][p.y] === 0 && !placeReasonCached(p.x, p.y)) {
            const k = `${p.x},${p.y},${pathVersion}`;
            if (k !== previewKey) {
                previewKey = k;
                previewRoute = traceRoute(flowWithBlock(p.x, p.y));
            }
            r = previewRoute;
            tint = true;
        }
        if (!r || !r.n) return;
        const tt = time * 6;
        const base = tint ? 0.7 : strong ? 0.22 : 0.1;
        const amp = tint ? 0.3 : strong ? 0.5 : 0.25;
        const name = tint ? 'chevronGold' : 'chevron';
        for (let j = 0; j < r.n; j++) {
            const ph = ((r.i[j] - tt) % 8 + 8) % 8;
            const a = base + amp * Math.max(0, 1 - ph / 3);
            if (a < 0.06) continue;
            setAlpha(Math.min(1, a));
            spr(name, (r.x[j] + 0.5) * ts, (r.y[j] + 0.5) * ts, r.a[j], 0.9);
        }
        setAlpha(1);
    }

    function drawPortals() {
        const t = time;
        for (let i = 0; i < spawnpoints.length; i++) portal(spawnpoints[i].x, spawnpoints[i].y, t + i, 1);
        for (let i = 0; i < tempSpawns.length; i++) portal(tempSpawns[i][0].x, tempSpawns[i][0].y, t + i * 1.7, 0.75);
        // The gate, with a glow that turns red when lives are lost
        const ex = (exit.x + 0.5) * ts;
        const ey = (exit.y + 0.5) * ts;
        setOp('lighter');
        setAlpha(0.35 + 0.1 * Math.sin(t * 3));
        spr('glow_yellow', ex, ey, 0, 1.4);
        if (FX.gateHit > 0) {
            setAlpha(FX.gateHit / 24);
            spr('glow_red', ex, ey, 0, 2.2);
        }
        setOp('source-over');
        setAlpha(1);
        spr('gate', ex, ey);
    }

    function portal(x, y, t, s) {
        const cx = (x + 0.5) * ts;
        const cy = (y + 0.5) * ts;
        spr('portalCore', cx, cy, 0, s * (1 + 0.06 * Math.sin(t * 4)));
        setOp('lighter');
        setAlpha(0.9);
        spr('portal', cx, cy, t * 2.2, s);
        setAlpha(0.6);
        spr('portal', cx, cy, -t * 1.4, s * 0.7);
        setOp('source-over');
        setAlpha(1);
    }

    function circlePath(x, y, r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
    }

    // Range of the selected tower, and the upgraded range while previewing
    function drawRanges() {
        const sel = selected && !toPlace && selected.alive ? selected : null;
        if (!sel) return;
        rangeCircle(sel.pos.x, sel.pos.y, (sel.range + 1) * ts, sel.color, true);
        if (upgradeRange && upgradeRange !== sel.range) {
            ctx.setLineDash([ts * 0.25, ts * 0.18]);
            circlePath(sel.pos.x, sel.pos.y, (upgradeRange + 1) * ts);
            ctx.strokeStyle = '#4ade80';
            ctx.lineWidth = Math.max(1.5 / zoom, ts * 0.07);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    function rangeCircle(x, y, r, color, ok) {
        circlePath(x, y, r);
        ctx.fillStyle = ok ? `rgba(${color[0]},${color[1]},${color[2]},0.14)` : 'rgba(248,113,113,0.14)';
        ctx.fill();
        ctx.setLineDash([ts * 0.25, ts * 0.18]);
        ctx.strokeStyle = ok ? 'rgba(255,255,255,0.75)' : 'rgba(248,113,113,0.9)';
        ctx.lineWidth = Math.max(1, ts * 0.05);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawTowerBases() {
        for (let i = 0; i < towers.length; i++) {
            const t = towers[i];
            spr('base_' + t.name, t.pos.x, t.pos.y);
        }
    }

    function drawTurrets() {
        for (let i = 0; i < towers.length; i++) {
            const t = towers[i];
            const still = t.name === 'tesla' || t.name === 'lightningStrike';
            const rec = (t._recoil || 0) * ts * 0.1;
            const c = Math.cos(t.angle);
            const n = Math.sin(t.angle);
            spr('turret_' + t.name, t.pos.x - c * rec, t.pos.y - n * rec, still ? 0 : t.angle);
            if (still) {
                setOp('lighter');
                setAlpha(0.45 + 0.2 * Math.sin(time * 5 + i) + (t._flash || 0) * 0.08);
                spr(t.name === 'tesla' ? 'glow_yellow' : 'glow_cyan', t.pos.x, t.pos.y - ts * 0.05, 0, 0.55 + (t._flash || 0) * 0.06);
                setOp('source-over');
                setAlpha(1);
            } else if (t._flash > 0) {
                const m = FX.muzzle(t, t._barrel || 0);
                setOp('lighter');
                setAlpha(Math.min(1, t._flash / 3));
                spr('flash', m.x, m.y, t.angle, t.name === 'railgun' || t.name === 'sniper' ? 1.1 : 0.8);
                setOp('source-over');
                setAlpha(1);
            }
        }
    }

    function angDiff(a) {
        while (a > Math.PI) a -= TAU;
        while (a < -Math.PI) a += TAU;
        return a;
    }

    let enemyId = 0;
    function drawEnemies(stepped) {
        const shadowNat = natural('shadow');
        const bosses = [];
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const art = Art.ENEMY_ART[e.name];
            if (!art) continue;
            if (e._lx === undefined) {
                e._lx = e.pos.x;
                e._ly = e.pos.y;
                e._rot = Math.atan2(e.vel.y, e.vel.x) || 0;
                e._ph = Math.random() * TAU;
                e._id = enemyId++;
            }
            const dx = e.pos.x - e._lx;
            const dy = e.pos.y - e._ly;
            const d = Math.abs(dx) + Math.abs(dy);
            if (d > 0.0001) {
                e._ph += d / ts * 10;
                e._rot += angDiff(Math.atan2(dy, dx) - e._rot) * 0.35;
                e._lx = e.pos.x;
                e._ly = e.pos.y;
            }
            if (stepped) FX.status(e);
            const r = art.r * ts;
            const bob = Math.sin(e._ph);
            spr('shadow', e.pos.x + ts * 0.04, e.pos.y + r * 0.45, 0, r * 2.1 / ts / shadowNat);
            if (art.boss) {
                setOp('lighter');
                setAlpha(0.35 + 0.15 * Math.sin(time * 4 + i));
                spr(e.name === 'taunt' ? 'glow_orange' : 'glow_yellow', e.pos.x, e.pos.y, 0, (r * 3.2) / ts / natural('glow_orange'));
                setOp('source-over');
                setAlpha(1);
                bosses.push(e);
            }
            const squash = e.name === 'weak' || e.name === 'spawner' ? 0.09 : e.name === 'tank' ? 0.015 : 0.05;
            const sx = 1 + squash * bob;
            const sy = 1 - squash * bob;
            const lift = e.name === 'weak' ? Math.abs(bob) * r * 0.08 : 0;
            spr('enemy_' + e.name, e.pos.x, e.pos.y - lift, e._rot, sx, sy);
            // Status tint and hit flash
            const efx = e.effects;
            for (let j = 0; j < efx.length; j++) {
                const nm = efx[j].name;
                const tint = nm === 'slow' ? 'ice' : nm === 'poison' ? 'poison' : nm === 'regen' ? 'regen' : null;
                if (!tint) continue;
                setAlpha(tint === 'regen' ? 0.18 + 0.1 * Math.sin(time * 8) : 0.42);
                spr(`enemy_${e.name}_${tint}`, e.pos.x, e.pos.y - lift, e._rot, sx, sy);
            }
            if (e.hit > 0) {
                setAlpha(Math.min(1, e.hit / 6) * 0.85);
                spr(`enemy_${e.name}_white`, e.pos.x, e.pos.y - lift, e._rot, sx, sy);
            }
            setAlpha(1);
        }
    }

    function drawProjectiles() {
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p.alive) continue;
            const a = Math.atan2(p.vel.y, p.vel.x);
            const blue = p.blastRadius > 1;
            spr(blue ? 'missileBlue' : 'missile', p.pos.x, p.pos.y, a, 1.2);
        }
    }

    function drawRings() {
        const R = FX.rings;
        if (!R.n) return;
        setOp('lighter');
        for (let i = 0; i < R.n; i++) {
            const r = R.items[i];
            const f = 1 - r.life / r.max;
            const rad = r.r0 + (r.r1 - r.r0) * (1 - (1 - f) * (1 - f));
            setAlpha(r.a0 * (1 - f));
            spr(r.sprite, r.x, r.y, 0, rad / ts / (natural(r.sprite) * 0.43));
        }
        setOp('source-over');
        setAlpha(1);
    }

    function drawBeams() {
        const B = FX.beams;
        if (!B.n) return;
        setOp('lighter');
        ctx.lineCap = 'round';
        for (let i = 0; i < B.n; i++) {
            const b = B.items[i];
            const f = b.life / b.max;
            switch (b.kind) {
                case 'tracer': {
                    const p = 1 - (b.life - 1) / Math.max(1, b.max - 1);
                    const hx = b.x1 + (b.x2 - b.x1) * p;
                    const hy = b.y1 + (b.y2 - b.y1) * p;
                    const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1) || 1;
                    const tl = Math.min(len * p, ts * 0.45);
                    const ux = (b.x2 - b.x1) / len;
                    const uy = (b.y2 - b.y1) / len;
                    line(hx - ux * tl, hy - uy * tl, hx, hy, 'rgba(255,214,90,0.95)', ts * 0.07 * b.w);
                    break;
                }
                case 'laser':
                case 'emitter': {
                    const t = b.tower;
                    const e = b.target;
                    if (!t || !t.alive || !e || !e.alive) break;
                    const m = FX.muzzle(t, 0);
                    const col = b.kind === 'laser' ? 'rgba(60,170,255,0.45)' : 'rgba(60,240,220,0.5)';
                    const flick = 0.85 + 0.15 * Math.sin(time * 40 + i);
                    line(m.x, m.y, e.pos.x, e.pos.y, col, ts * (b.kind === 'laser' ? 0.18 : 0.2) * b.w * flick);
                    line(m.x, m.y, e.pos.x, e.pos.y, 'rgba(235,255,255,0.95)', ts * 0.05 * b.w);
                    break;
                }
                case 'snipe':
                    line(b.x1, b.y1, b.x2, b.y2, `rgba(255,70,60,${0.55 * f})`, ts * 0.16 * f);
                    line(b.x1, b.y1, b.x2, b.y2, `rgba(255,240,230,${f})`, ts * 0.04);
                    break;
                case 'rail':
                    line(b.x1, b.y1, b.x2, b.y2, `rgba(200,90,255,${0.6 * f})`, ts * 0.32 * f);
                    line(b.x1, b.y1, b.x2, b.y2, `rgba(255,230,255,${f})`, ts * 0.07 * f);
                    break;
                case 'shell': {
                    const p = 1 - (b.life - 1) / Math.max(1, b.max - 1);
                    const x = b.x1 + (b.x2 - b.x1) * p;
                    const y = b.y1 + (b.y2 - b.y1) * p - Math.sin(p * Math.PI) * ts * 0.8;
                    setAlpha(0.9);
                    spr('glow_orange', x, y, 0, 0.35);
                    setAlpha(1);
                    break;
                }
                case 'bolt': {
                    const flick = (Math.random() < 0.25 ? 0.4 : 1) * f;
                    const pts = b.pts;
                    const n = pts.length - 1;
                    const dx = b.x2 - b.x1;
                    const dy = b.y2 - b.y1;
                    const len = Math.hypot(dx, dy) || 1;
                    const px = -dy / len;
                    const py = dx / len;
                    ctx.beginPath();
                    for (let j = 0; j <= n; j++) {
                        const u = j / n;
                        const o = pts[j] * Math.min(1, len / (ts * 2));
                        const x = b.x1 + dx * u + px * o;
                        const y = b.y1 + dy * u + py * o;
                        if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                    }
                    ctx.strokeStyle = b.w >= 1.5 ? `rgba(80,235,255,${0.55 * flick})` : `rgba(255,230,80,${0.55 * flick})`;
                    ctx.lineWidth = ts * 0.16 * b.w;
                    ctx.stroke();
                    ctx.strokeStyle = `rgba(255,255,240,${flick})`;
                    ctx.lineWidth = ts * 0.045 * b.w;
                    ctx.stroke();
                    drawCalls += 2;
                    break;
                }
            }
        }
        setOp('source-over');
        setAlpha(1);
    }

    function line(x1, y1, x2, y2, color, w) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
        drawCalls++;
    }

    function drawParticles() {
        const P = FX.particles;
        if (!P.n) return;
        // Normal blend first (smoke, debris), then additive glows
        for (let pass = 0; pass < 2; pass++) {
            const add = pass === 1;
            setOp(add ? 'lighter' : 'source-over');
            for (let i = 0; i < P.n; i++) {
                const p = P.items[i];
                if (p.add !== add) continue;
                const f = 1 - p.life / p.max;
                if (p.color) {
                    setAlpha(Math.min(1, (1 - f) * 1.6));
                    const c = Math.cos(p.rot);
                    const n = Math.sin(p.rot);
                    ctx.setTransform(K * c, K * n, -K * n, K * c, baseE + p.x * K, baseF + p.y * K);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    drawCalls++;
                    continue;
                }
                const size = p.s0 + (p.s1 - p.s0) * f;
                if (size <= 0.01) continue;
                setAlpha(p.a0 * (1 - f));
                spr(p.sprite, p.x, p.y, p.rot, size / natural(p.sprite));
            }
            resetTransform();
        }
        setOp('source-over');
        setAlpha(1);
    }

    // Health bars, batched: one path for the backs and one per colour
    const barG = [];
    const barY = [];
    const barR = [];
    function drawBars() {
        barG.length = barY.length = barR.length = 0;
        const bh = Math.max(2.5 / zoom, ts * 0.11);
        ctx.beginPath();
        let any = false;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const art = Art.ENEMY_ART[e.name];
            const left = Math.max(0, e.health / e.maxHealth);
            const boss = art && art.boss;
            if (left >= 1 && !boss) continue;
            const r = (art ? art.r : 0.3) * ts;
            const w = Math.max(ts * 0.8, r * 2) * (boss ? 1.4 : 1);
            const h = boss ? bh * 1.5 : bh;
            const x = e.pos.x - w / 2;
            const y = e.pos.y - r - h - ts * 0.08;
            const pad = Math.max(1 / zoom, ts * 0.03);
            ctx.rect(x - pad, y - pad, w + pad * 2, h + pad * 2);
            (left > 0.6 ? barG : left > 0.3 ? barY : barR).push(x, y, w * left, h);
            any = true;
        }
        if (!any) return;
        ctx.fillStyle = 'rgba(9,9,11,0.85)';
        ctx.fill();
        fillRects(barG, '#4ade80');
        fillRects(barY, '#facc15');
        fillRects(barR, '#f87171');
        drawCalls += 4;
    }

    function fillRects(arr, color) {
        if (!arr.length) return;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i += 4) ctx.rect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3]);
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawSelection() {
        const sel = selected && !toPlace && selected.alive ? selected : null;
        if (!sel) return;
        const r = ts * (0.56 + 0.04 * Math.sin(time * 5));
        circlePath(sel.pos.x, sel.pos.y, r);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = Math.max(1.5 / zoom, ts * 0.07);
        ctx.stroke();
    }

    // Ghost of the tower being placed, its range, the tile tint and the price
    function drawPlacement() {
        const p = placementTile();
        const key = p ? `${p.x},${p.y},${towerType}` : '';
        if (key !== lastPlaceKey) {
            lastPlaceKey = key;
            updatePlaceStatus();
        }
        if (!p) return;
        const tpl = tower[towerType];
        const cx = (p.x + 0.5) * ts;
        const cy = (p.y + 0.5) * ts;
        const reason = placeReasonCached(p.x, p.y);
        const afford = godMode || cash >= tpl.cost;
        const ok = !reason;
        rangeCircle(cx, cy, ((tpl.range || 3) + 1) * ts, tpl.color, ok && afford);
        ctx.fillStyle = ok && afford ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.35)';
        ctx.fillRect(p.x * ts, p.y * ts, ts, ts);
        if (ok) {
            setAlpha(afford ? 0.85 : 0.45);
            spr('base_' + towerType, cx, cy);
            spr('turret_' + towerType, cx, cy, towerType === 'tesla' ? 0 : -Math.PI / 2);
            setAlpha(1);
        } else {
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = ts * 0.12;
            ctx.lineCap = 'round';
            const d = ts * 0.24;
            ctx.beginPath();
            ctx.moveTo(cx - d, cy - d);
            ctx.lineTo(cx + d, cy + d);
            ctx.moveTo(cx + d, cy - d);
            ctx.lineTo(cx - d, cy + d);
            ctx.stroke();
        }
        if (ghost) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1.5 / zoom, ts * 0.06);
            ctx.strokeRect(p.x * ts, p.y * ts, ts, ts);
        }
        // Price tag, kept readable on small tiles
        const size = Math.max(11, Math.min(16, ts * zoom * 0.5)) / zoom;
        ctx.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = `$${tpl.cost}`;
        const w = ctx.measureText(label).width + size * 0.8;
        const h = size * 1.45;
        let ty = p.y * ts - h / 2 - ts * 0.12;
        if (ty - h / 2 < 0) ty = (p.y + 1) * ts + h / 2 + ts * 0.12;
        const tx = Math.max(w / 2, Math.min(cols * ts - w / 2, cx));
        ctx.fillStyle = 'rgba(9,9,11,0.9)';
        ctx.beginPath();
        Terrain.roundRectPath(ctx, tx - w / 2, ty - h / 2, w, h, h / 4, h / 4, h / 4, h / 4);
        ctx.fill();
        ctx.fillStyle = afford ? '#facc15' : '#f87171';
        ctx.fillText(label, tx, ty + size * 0.05);
    }

    function drawFloaters() {
        if (!floaters.length) return;
        const base = Math.max(10, Math.min(18, ts * zoom * 0.5)) / zoom;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#09090b';
        let lastSize = 0;
        const cap = FX.quality === 0 ? 30 : FX.quality === 1 ? 60 : 120;
        const from = Math.max(0, floaters.length - cap);
        for (let i = from; i < floaters.length; i++) {
            const f = floaters[i];
            const size = Math.round(base * f.size * 10) / 10;
            if (size !== lastSize) {
                ctx.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
                ctx.lineWidth = size * 0.28;
                lastSize = size;
            }
            setAlpha(Math.min(1, f.life / 20));
            ctx.fillStyle = f.css || (f.css = `rgb(${f.color[0]},${f.color[1]},${f.color[2]})`);
            ctx.strokeText(f.text, f.x, f.y);
            ctx.fillText(f.text, f.x, f.y);
        }
        setAlpha(1);
    }

    // Vignette, red flash when lives are lost, and a pulse when they run low
    function drawOverlays() {
        const W = canvas.width;
        const H = canvas.height;
        if (!vignette) {
            vignette = radial('rgba(0,0,0,0)', 'rgba(0,0,0,0.38)');
            hurtVignette = radial('rgba(248,113,113,0)', 'rgba(248,80,80,0.75)');
        }
        if (FX.quality > 0) ctx.drawImage(vignette, 0, 0, W, H);
        let a = hurt > 0 ? hurt / 24 : 0;
        if (!gameOver && health > 0 && health <= maxHealth * 0.25) a = Math.max(a, 0.18 + 0.12 * Math.sin(time * 4));
        if (a > 0) {
            setAlpha(Math.min(1, a));
            ctx.drawImage(hurtVignette, 0, 0, W, H);
            setAlpha(1);
        }
    }

    // The hint over the map fades while the mouse works near it
    let tipEl = null;
    let tipFaded = false;
    function fadeTip() {
        if (!tipEl) tipEl = document.getElementById('map-tip');
        if (!tipEl) return;
        const near = !!hover && holder.dataset.gutter !== 'bottom' && oy + hover.y * zoom > cssH - 80;
        if (near !== tipFaded) {
            tipFaded = near;
            tipEl.classList.toggle('faded', near);
        }
    }

    function radial(inner, outer) {
        const c = Terrain.makeCanvas(256, 256);
        const g = c.getContext('2d', { willReadFrequently: true });
        const grad = g.createRadialGradient(128, 128, 70, 128, 128, 182);
        grad.addColorStop(0, inner);
        grad.addColorStop(1, outer);
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
        return c;
    }

    // ---------- Quality and perf ----------

    function trackQuality(dt) {
        frameTimes[frameIdx] = dt;
        frameIdx = (frameIdx + 1) % frameTimes.length;
        if (!qualityAuto || paused || document.hidden) return;
        let sum = 0;
        for (let i = 0; i < frameTimes.length; i++) sum += frameTimes[i];
        const avg = sum / frameTimes.length;
        if (avg > 22) {
            slowFor += dt;
            fastFor = 0;
        } else if (avg < 15) {
            fastFor += dt;
            slowFor = 0;
        } else {
            slowFor = fastFor = 0;
        }
        if (slowFor > 2000 && FX.quality > 0) {
            FX.setQuality(FX.quality - 1);
            slowFor = 0;
            frameTimes.fill(16);
            resize();
        } else if (fastFor > 8000 && FX.quality < 2) {
            FX.setQuality(FX.quality + 1);
            fastFor = 0;
            resize();
        }
    }

    function logicTime(ms) {
        perf.logicAcc += ms;
    }

    function showPerf(now) {
        const sorted = Array.from(frameTimes).sort((a, b) => a - b);
        let sum = 0;
        for (let i = 0; i < sorted.length; i++) sum += sorted[i];
        const avg = sum / sorted.length;
        const n = Math.max(1, perf.n);
        const mem = performance.memory ? ` · heap ${(performance.memory.usedJSHeapSize / 1048576).toFixed(1)} MB` : '';
        perf.el.textContent =
            `${(1000 / avg).toFixed(0)} fps · frame ${avg.toFixed(1)} ms (p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)})\n` +
            `render ${(perf.renderAcc / n).toFixed(2)} ms · logic ${(perf.logicAcc / n).toFixed(2)} ms · draws ${drawCalls}\n` +
            `enemies ${enemies.length} · towers ${towers.length} · missiles ${projectiles.length}\n` +
            `particles ${FX.particles.n} · beams ${FX.beams.n} · rings ${FX.rings.n} · floaters ${floaters.length}\n` +
            `quality ${['low', 'medium', 'high'][FX.quality]} · zoom ${zoom.toFixed(2)} · tile ${(ts * zoom * dpr).toFixed(0)} px · ${canvas.width}x${canvas.height}${mem}`;
        perf.lastShow = now;
        perf.renderAcc = perf.logicAcc = 0;
        perf.n = 0;
    }

    function setQualityAuto(v) {
        qualityAuto = v;
    }

    // Page coordinates of a world point (used by tests and tips)
    function toScreen(wx, wy) {
        const r = canvas.getBoundingClientRect();
        return { x: r.left + ox + wx * zoom, y: r.top + oy + wy * zoom };
    }

    // F key: show or hide the performance numbers
    function togglePerf() {
        if (!perf.el) {
            perf.el = document.createElement('div');
            perf.el.className = 'perf';
            holder.append(perf.el);
            return;
        }
        perf.el.hidden = !perf.el.hidden;
    }

    return {
        init, resize, mapChanged, frame, reveal, logicTime, setQualityAuto, setZoom, togglePerf, toScreen,
        get hover() { return hover; },
        get zoom() { return zoom; },
        get shake() { return { x: shakeX, y: shakeY }; },
        set upgradeRange(v) { upgradeRange = v; },
        get perfMode() { return perfMode; }
    };
})();
