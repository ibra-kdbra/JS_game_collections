// 3D view: the map as a small lit diorama seen from a fixed angle, like mobile
// tower defense games. WebGL through three.js (vendored in assets/vendor/three,
// loaded by index.html as window.THREE). The game rules never see any of this:
// positions come from the same towers / enemies / projectiles the flat view draws.
//
// Units: one tile is one world unit. Game x maps to world X, game y to world Z,
// and height is Y. The camera looks down at PITCH from the +Z side, so the screen
// keeps the flat view's layout (right is +x, down is +y).
//
// Layers:
// - WebGL: ground (the flat view's terrain picture as a texture, unlit so its
//   colours stay true, with real shadows laid over it), walls as solid blocks with
//   their tops and sides textured, props on the walls (trees, rocks, crystals,
//   rooftop machines) that sway, towers built from parts with turrets that turn and
//   recoil, enemies as instanced bodies that walk, bob and flash when hit, missiles,
//   route arrows, portals, the gate, ranges and the tower being placed.
// - A 2D canvas on top for what reads best flat on the glass: health bars, gold and
//   damage numbers, the price tag, beams, sparks, smoke and blast rings (projected
//   to where they happen), and the vignette.

const Renderer3D = (() => {
    const TAU = Math.PI * 2;
    const params = new URLSearchParams(location.search);
    const perfMode = params.get('perf') === '1';
    let T3 = null;

    let holder = null;
    let canvas = null;
    let overlay = null;
    let octx = null;
    let gl = null;
    let scene = null;
    let camera = null;
    let inited = false;
    let composer = null;        // bloom (high quality only)
    let bloom = null;
    const bloomOn = () => composer && FX.quality === 2;
    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    let holderH = 0;

    // Camera: a point on the ground it looks at, and its distance (zoom 1 = the
    // whole map fits)
    const PITCH = 56 * Math.PI / 180;
    const FOV = 28;
    const target = { x: 0, z: 0 };
    let fit = { dist: 10, x: 0, z: 0 };
    let zoom = 1;
    let fillZoom = 1;
    let fillPending = false;

    let theme = 'meadow';
    let mapKey = '';
    let hover = null;
    let shakeX = 0;
    let shakeY = 0;
    let time = 0;
    let last = performance.now();
    let upgradeRange = 0;
    let drawCalls = 0;

    // Heights in tiles
    const FX_H = 0.5;           // beams, missiles and blasts
    const TOP_H = 0.34;         // top of a tower's body, where the turret sits

    // Adaptive quality
    const frameTimes = new Float32Array(90);
    let frameIdx = 0;
    let qualityAuto = true;
    let slowFor = 0;
    let fastFor = 0;
    const perf = { el: null, lastShow: 0, renderAcc: 0, logicAcc: 0, n: 0 };

    // Scene parts
    let world = null;           // rebuilt per map: board, ground, walls, props
    let dyn = null;             // towers, enemies and the rest
    let sun = null;
    let hemi = null;
    let props = [];             // { mesh, base: Matrix4[], sway: bool, phase: [] }

    // ---------- Small helpers ----------

    const V = () => new T3.Vector3();
    let tmpM = null;
    let tmpM2 = null;
    let tmpQ = null;
    let tmpV = null;
    let tmpS = null;
    let tmpC = null;
    let ray = null;
    let tint = null;
    const vp = new Float32Array(16);
    let fx = 1;                 // projection focal length in CSS px

    const hashT = (x, y, s) => Terrain.hash(x, y, s);

    const matCache = new Map();
    function mat(color, o = {}) {
        const key = `${color}|${o.emissive || ''}|${o.ei || 0}|${o.rough || 0}|${o.metal || 0}|${o.vc ? 1 : 0}`;
        let m = matCache.get(key);
        if (!m) {
            m = new T3.MeshStandardMaterial({
                color, roughness: o.rough ?? 0.62, metalness: o.metal ?? 0.18, flatShading: true,
                emissive: o.emissive || 0x000000, emissiveIntensity: o.ei ?? 1, vertexColors: !!o.vc
            });
            matCache.set(key, m);
        }
        return m;
    }

    // Merge parts ({ geo, color, m: Matrix4 }) into one geometry with vertex colours
    function merge(parts) {
        const pos = [];
        const nrm = [];
        const col = [];
        const c = new T3.Color();
        parts.forEach(p => {
            const g = (p.geo.index ? p.geo.toNonIndexed() : p.geo.clone());
            if (p.m) g.applyMatrix4(p.m);
            g.computeVertexNormals();
            const P = g.attributes.position.array;
            const N = g.attributes.normal.array;
            c.set(p.color);
            for (let i = 0; i < P.length; i++) pos.push(P[i]);
            for (let i = 0; i < N.length; i++) nrm.push(N[i]);
            for (let i = 0; i < P.length / 3; i++) col.push(c.r, c.g, c.b);
            g.dispose();
        });
        const g = new T3.BufferGeometry();
        g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new T3.Float32BufferAttribute(nrm, 3));
        g.setAttribute('color', new T3.Float32BufferAttribute(col, 3));
        return g;
    }

    // Matrix from position, Euler rotation and scale
    function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
        const m = new T3.Matrix4();
        m.compose(new T3.Vector3(x, y, z), new T3.Quaternion().setFromEuler(new T3.Euler(rx, ry, rz)), new T3.Vector3(sx, sy, sz));
        return m;
    }

    function disposeTree(o) {
        o.traverse(n => {
            if (n.geometry && !n.geometry._shared) n.geometry.dispose();
            if (n.material && n.material._own) {
                if (n.material.map) n.material.map.dispose();
                if (n.material.emissiveMap) n.material.emissiveMap.dispose();
                n.material.dispose();
            }
        });
    }

    // Soft round glow texture for sprites
    let glowTex = null;
    function glowTexture() {
        if (glowTex) return glowTex;
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(0, 0, 128, 128);
        glowTex = new T3.CanvasTexture(c);
        glowTex.colorSpace = T3.SRGBColorSpace;
        return glowTex;
    }
    function glowSprite(color, size, opacity = 1) {
        const m = new T3.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: T3.AdditiveBlending, depthWrite: false, toneMapped: false });
        m._own = true;
        m.color.multiplyScalar(2.2);
        const s = new T3.Sprite(m);
        s.scale.set(size, size, 1);
        return s;
    }

    // ---------- Setup ----------

    function available() {
        if (!window.THREE) return false;
        try {
            const c = document.createElement('canvas');
            return !!(c.getContext('webgl2') || c.getContext('webgl'));
        } catch (e) {
            return false;
        }
    }

    function init(holderEl) {
        if (inited) {
            canvas.style.display = '';
            overlay.style.display = '';
            zoomEls.forEach(b => (b.style.display = ''));
            resize(true);
            return;
        }
        T3 = window.THREE;
        holder = holderEl;
        tmpM = new T3.Matrix4();
        tmpM2 = new T3.Matrix4();
        tmpQ = new T3.Quaternion();
        tmpV = new T3.Vector3();
        tmpS = new T3.Vector3();
        tmpC = new T3.Color();
        tint = new T3.Color();
        mz = new T3.Vector3();
        ray = new T3.Raycaster();
        canvas = document.createElement('canvas');
        canvas.id = 'map';
        canvas.setAttribute('aria-label', 'Game map');
        canvas.className = 'map3d';
        holder.prepend(canvas);
        overlay = document.createElement('canvas');
        overlay.className = 'map-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        canvas.after(overlay);
        octx = overlay.getContext('2d');
        gl = new T3.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
        gl.toneMapping = T3.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        Units3D.init(T3);
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = T3.PCFSoftShadowMap;
        // Shadows only change when the map or the towers do; enemies get blob shadows
        gl.shadowMap.autoUpdate = false;
        scene = new T3.Scene();
        camera = new T3.PerspectiveCamera(FOV, 1, 0.1, 400);
        hemi = new T3.HemisphereLight(0xf2f6ff, 0x50566a, 0.55);
        scene.add(hemi);
        sun = new T3.DirectionalLight(0xffeccc, 2.6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0008;
        sun.shadow.normalBias = 0.02;
        scene.add(sun);
        scene.add(sun.target);
        dyn = new T3.Group();
        scene.add(dyn);
        scene.environment = makeEnvironment();
        gl.info.autoReset = false;
        if (window.PP) {
            composer = new window.PP.EffectComposer(gl);
            composer.addPass(new window.PP.RenderPass(scene, camera));
            bloom = new window.PP.UnrealBloomPass(new T3.Vector2(256, 256), 0.6, 0.4, 1.6);
            composer.addPass(bloom);
            composer.addPass(new window.PP.OutputPass());
        }
        buildDynamic();
        buildBlasts();
        loadKit();
        bindInput();
        buildZoomControls();
        if (perfMode) {
            perf.el = document.createElement('div');
            perf.el.className = 'perf';
            holder.append(perf.el);
        }
        inited = true;
        resize(true);
    }

    // Hide while the flat view is shown
    function suspend() {
        if (!inited) return;
        canvas.style.display = 'none';
        overlay.style.display = 'none';
        zoomEls.forEach(b => (b.style.display = 'none'));
        hover = null;
    }

    const PHONE_STRIP = 60;
    const GUTTER = 54;

    function resize(force) {
        if (!holder) return;
        const w = holder.clientWidth;
        const hh = holder.clientHeight;
        let h = hh;
        if (compactView.matches) h = Math.max(120, hh - PHONE_STRIP);
        const q = FX.quality;
        const nd = Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][q]);
        if (!force && w === cssW && h === cssH && nd === dpr && hh === holderH) return;
        cssW = w;
        cssH = h;
        holderH = hh;
        dpr = nd;
        gl.setPixelRatio(dpr);
        gl.setSize(w, h, false);
        if (composer) {
            composer.setPixelRatio(dpr);
            composer.setSize(w, h);
        }
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        overlay.width = Math.max(1, Math.round(w * dpr));
        overlay.height = Math.max(1, Math.round(h * dpr));
        overlay.style.width = `${w}px`;
        overlay.style.height = `${h}px`;
        sun.shadow.mapSize.set(q === 2 ? 2048 : 1024, q === 2 ? 2048 : 1024);
        if (sun.shadow.map) {
            sun.shadow.map.dispose();
            sun.shadow.map = null;
        }
        gl.shadowMap.enabled = q > 0;
        gl.shadowMap.needsUpdate = true;
        vignette = null;
        camera.aspect = w / Math.max(1, h);
        camera.updateProjectionMatrix();
        refit();
    }

    // ---------- Camera ----------

    function placeCamera(cam, tx, tz, dist) {
        cam.position.set(tx, Math.sin(PITCH) * dist, tz + Math.cos(PITCH) * dist);
        cam.lookAt(tx, 0, tz);
        cam.updateMatrixWorld();
    }

    // Distance and look-at point that fit the map's box into w x h CSS px whose
    // centre is at (cx, cy); onlyH fits the height and lets the width overflow
    function fitBox(w, h, cx, cy, onlyH) {
        const cam = camera.clone();
        cam.aspect = cssW / Math.max(1, cssH);
        cam.updateProjectionMatrix();
        const pts = [];
        for (const X of [0, cols]) for (const Z of [0, rows]) for (const Y of [0, 0.45]) pts.push(new T3.Vector3(X, Y, Z));
        let tx = cols / 2;
        let tz = rows / 2;
        let dist = 10;
        const v = new T3.Vector3();
        const box = () => {
            let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
            for (const p of pts) {
                v.copy(p).project(cam);
                const sx = (v.x * 0.5 + 0.5) * cssW;
                const sy = (-v.y * 0.5 + 0.5) * cssH;
                x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
            }
            return { x0, x1, y0, y1 };
        };
        for (let pass = 0; pass < 4; pass++) {
            let lo = 0.5;
            let hi = 600;
            for (let i = 0; i < 36; i++) {
                const mid = (lo + hi) / 2;
                placeCamera(cam, tx, tz, mid);
                const b = box();
                const ok = (onlyH || b.x1 - b.x0 <= w) && b.y1 - b.y0 <= h;
                if (ok) hi = mid; else lo = mid;
            }
            dist = hi;
            placeCamera(cam, tx, tz, dist);
            const b = box();
            // Move the look-at point so the box's centre lands on (cx, cy)
            const k = pxPerTileAt(cam, tx, tz);
            if (!onlyH) tx += ((b.x0 + b.x1) / 2 - cx) / k;
            tz += ((b.y0 + b.y1) / 2 - cy) / (k * Math.sin(PITCH));
        }
        return { dist, x: tx, z: tz };
    }

    function pxPerTileAt(cam, x, z) {
        const a = new T3.Vector3(x, 0, z).project(cam);
        const b = new T3.Vector3(x + 1, 0, z).project(cam);
        return Math.abs(b.x - a.x) * 0.5 * cssW;
    }

    let gutterKey = '';
    function refit() {
        if (!cols || !rows || !cssW) return;
        const compact = compactView.matches;
        const bottom = compact ? 0 : GUTTER;
        const pad = 8;
        fit = fitBox(cssW - pad * 2, cssH - bottom - pad * 2, cssW / 2, (cssH - bottom) / 2, false);
        measureZoomMax();
        if (fillPending) {
            fillPending = false;
            zoom = 1;
            if (compact) {
                const f = fitBox(cssW - pad * 2, cssH - pad * 2, cssW / 2, cssH / 2, true);
                fillZoom = Math.max(1, Math.min(maxZoom(), fit.dist / f.dist));
                zoom = fillZoom;
                target.x = cols / 2;
                target.z = f.z;
            }
        }
        // Gutter for the hint and the zoom buttons (style.css reads these)
        const g = compact ? { side: 'bottom', size: holderH - cssH } : { side: 'bottom', size: GUTTER };
        const key = `${g.side}|${Math.round(g.size)}`;
        if (key !== gutterKey) {
            gutterKey = key;
            holder.dataset.gutter = g.side;
            holder.dataset.wide = '0';
            holder.style.setProperty('--gutter', `${Math.round(g.size)}px`);
        }
        clampCamera();
        updateZoomButtons();
    }

    // Zoom in until a tile is about 96 CSS px wide (worked out by refit)
    let zoomMax = 3;
    function maxZoom() {
        return zoomMax;
    }
    function measureZoomMax() {
        const cam = camera.clone();
        placeCamera(cam, fit.x, fit.z, fit.dist);
        const k = pxPerTileAt(cam, fit.x, fit.z);
        zoomMax = Math.max(1.5, Math.min(5, 96 / Math.max(4, k)));
    }

    function clampCamera() {
        zoom = Math.max(1, Math.min(maxZoom(), zoom));
        if (zoom <= 1.001) {
            target.x = fit.x;
            target.z = fit.z;
        } else {
            // The further in, the more of the map the camera may travel over
            const f = 1 - 1 / zoom;
            const cx = cols / 2;
            const cz = rows / 2;
            const hx = cols / 2 * f + Math.abs(fit.x - cx);
            const hz = rows / 2 * f + Math.abs(fit.z - cz) + 0.6;
            target.x = Math.max(cx - hx, Math.min(cx + hx, target.x));
            target.z = Math.max(fit.z - hz, Math.min(fit.z + hz, target.z));
        }
        placeCamera(camera, target.x, target.z, fit.dist / zoom);
        updateVP();
    }

    function updateVP() {
        camera.updateMatrixWorld();
        tmpM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        vp.set(tmpM.elements);
        fx = camera.projectionMatrix.elements[0] * cssW / 2;
    }

    // Screen point (CSS px in the canvas) and size of one tile there
    const P = { x: 0, y: 0, k: 1, ok: true };
    function proj(X, Y, Z) {
        const e = vp;
        const x = e[0] * X + e[4] * Y + e[8] * Z + e[12];
        const y = e[1] * X + e[5] * Y + e[9] * Z + e[13];
        const w = e[3] * X + e[7] * Y + e[11] * Z + e[15];
        P.ok = w > 0.01;
        const iw = 1 / Math.max(0.01, w);
        P.x = (x * iw * 0.5 + 0.5) * cssW;
        P.y = (-y * iw * 0.5 + 0.5) * cssH;
        P.k = fx * iw;
        return P;
    }

    // Ground point (tiles) under a CSS point of the canvas
    function groundAt(sx, sy, out) {
        ray.setFromCamera({ x: sx / cssW * 2 - 1, y: -(sy / cssH * 2 - 1) }, camera);
        const o = ray.ray.origin;
        const d = ray.ray.direction;
        const t = d.y < -1e-6 ? -o.y / d.y : 0;
        out.x = o.x + d.x * t;
        out.z = o.z + d.z * t;
        return out;
    }

    // ---------- Input ----------

    const pointers = new Map();
    let pinch = null;
    let dragging = false;
    const PAN_START = { mouse: 12, pen: 14, touch: 16 };
    const TAP_SLOP = 28;

    function local(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    // World point (game pixels) under a page point: a tower when the press is on one
    // (its body stands over the tiles behind it), else the ground
    const hitList = [];
    let overTower = false;
    function toWorld(clientX, clientY) {
        const r = canvas.getBoundingClientRect();
        const sx = clientX - r.left;
        const sy = clientY - r.top;
        ray.setFromCamera({ x: sx / cssW * 2 - 1, y: -(sy / cssH * 2 - 1) }, camera);
        hitList.length = 0;
        towerModels.forEach(m => hitList.push(m.hit));
        const hits = ray.intersectObjects(hitList, false);
        overTower = false;
        if (hits.length) {
            const t = hits[0].object.userData.tower;
            if (t && t.alive) {
                overTower = true;
                return { x: t.pos.x, y: t.pos.y };
            }
        }
        const g = groundAt(sx, sy, {});
        return { x: g.x * ts, y: g.z * ts };
    }

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
            const l = local(e);
            pointers.set(e.pointerId, { x: l.x, y: l.y, sx: l.x, sy: l.y, cx: e.clientX, cy: e.clientY, moved: false });
            if (pointers.size === 2) {
                const [a, b] = [...pointers.values()];
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom, ground: groundAt(mid.x, mid.y, {}) };
                dragging = true;
            }
        });
        canvas.addEventListener('pointermove', e => {
            if (e.pointerType === 'mouse') {
                hover = toWorld(e.clientX, e.clientY);
                canvas.classList.toggle('over-tower', overTower);
                FX.calm(500);
            }
            const p = pointers.get(e.pointerId);
            if (!p) return;
            const l = local(e);
            const px = p.x;
            const py = p.y;
            p.x = l.x;
            p.y = l.y;
            if (!p.moved && Math.hypot(p.x - p.sx, p.y - p.sy) > (PAN_START[e.pointerType] || 14)) p.moved = true;
            if (pinch && pointers.size >= 2) {
                const [a, b] = [...pointers.values()];
                const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                zoom = Math.max(1, Math.min(maxZoom(), pinch.zoom * d / pinch.d));
                clampCamera();
                // keep the ground point under the fingers in place
                const g = groundAt(mid.x, mid.y, {});
                target.x += pinch.ground.x - g.x;
                target.z += pinch.ground.z - g.z;
                clampCamera();
                updateZoomButtons();
            } else if (p.moved && zoom > 1.001) {
                dragging = true;
                const g0 = groundAt(px, py, {});
                const g1 = groundAt(p.x, p.y, {});
                target.x += g0.x - g1.x;
                target.z += g0.z - g1.z;
                clampCamera();
            }
        });
        const end = e => {
            const p = pointers.get(e.pointerId);
            pointers.delete(e.pointerId);
            if (pointers.size < 2) pinch = null;
            if (!p) return;
            const l = local(e);
            if (!dragging && Math.hypot(l.x - p.sx, l.y - p.sy) < TAP_SLOP) onMapTap(toWorld(p.cx, p.cy), e);
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
            const l = local(e);
            zoomAt(zoom * Math.exp(-e.deltaY * 0.0015), l.x, l.y);
        }, { passive: false });
    }

    // Zoom keeping the ground point under (sx, sy) in place (the centre by default)
    function zoomAt(z, sx = cssW / 2, sy = cssH / 2) {
        const g0 = groundAt(sx, sy, {});
        zoom = Math.max(1, Math.min(maxZoom(), z));
        clampCamera();
        const g1 = groundAt(sx, sy, {});
        target.x += g0.x - g1.x;
        target.z += g0.z - g1.z;
        clampCamera();
        updateZoomButtons();
    }

    function setZoom(z) {
        zoomAt(z);
    }

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
                zoomAt(b.dataset.z === 'in' ? zoom * 1.5 : zoom / 1.5);
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

    // Bring a world point (game px) into view if it is off screen
    function reveal(wx, wy) {
        if (zoom <= 1.001 || !camera) return;
        const p = proj(wx / ts, 0.3, wy / ts);
        if (p.x > 0 && p.x < cssW && p.y > 0 && p.y < cssH) return;
        target.x = wx / ts;
        target.z = wy / ts;
        clampCamera();
    }

    // Page coordinates of a world point (game px), at a tower's middle height
    function toScreen(wx, wy) {
        const r = canvas.getBoundingClientRect();
        const p = proj(wx / ts, 0.25, wy / ts);
        return { x: r.left + p.x, y: r.top + p.y };
    }

    // ---------- The kit: Kenney's Tower Defense Kit (CC0), models/kenney-tower-defense ----------
    //
    // Every model shares one small palette texture (colormap.png). Map themes and
    // tower and enemy colours are made by recolouring that palette: grass and path
    // colours per theme, accent colours (purple, orange, red) per tower or enemy.

    const KIT_DIR = 'models/kenney-tower-defense/';
    const KIT_MODELS = [
        'tile', 'tile-dirt', 'tile-straight', 'tile-corner-round', 'tile-end-round', 'tile-split', 'tile-crossing',
        'tile-spawn', 'tile-spawn-end', 'tile-hill',
        'snow-tile', 'snow-tile-dirt', 'snow-tile-straight', 'snow-tile-corner-round', 'snow-tile-end-round', 'snow-tile-split',
        'snow-tile-crossing', 'snow-tile-spawn', 'snow-tile-spawn-end', 'snow-tile-hill',
        'detail-rocks', 'detail-rocks-large', 'detail-crystal', 'detail-crystal-large', 'detail-dirt', 'detail-dirt-large',
        'snow-detail-rocks', 'snow-detail-rocks-large', 'snow-detail-crystal',
        'tower-square-bottom-b', 'tower-square-middle-a', 'tower-square-top-a',
        'weapon-ammo-bullet', 'weapon-ammo-cannonball', 'selection-a'
    ];
    let kit = null;             // name -> [{ geo, m: Matrix4 (part in the model), name }]
    let kitRoots = null;        // name -> loaded scene (for towers, which keep their parts)
    let kitImage = null;        // the palette picture
    let kitLoading = false;
    let kitFailed = false;
    let kitError = '';

    // Quaternius (CC0): rocks and flowers in models/quaternius/nature. Towers and
    // enemies are built in code (units3d.js), so there is nothing else to load.
    const QT_DIR = 'models/quaternius/';
    const QT_MODELS = {
        nature: ['Rock_Medium_1', 'Flower_3_Group']
    };
    // Height of each nature model in tiles
    const NATURE_SIZE = {
        Rock_Medium_1: 0.36, Flower_3_Group: 0.26
    };
    let qt = null;
    // Kenney's map parts are in once this is true; turrets once towersReady

    // Only the map's models are files (small, compressed with meshopt; see README:
    // 3D models). Once they are in, every shader the battle uses is compiled before
    // the view shows, so nothing stalls when a new enemy kind or effect first appears.
    const load = { done: 0, total: 0, mapReady: false, towersReady: false, started: 0, readyAt: 0 };

    function loadKit() {
        if (kitLoading || kit) return;
        kitLoading = true;
        load.started = performance.now();
        T3.Cache.enabled = true;
        const loader = new window.GLTFLoader();
        if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
        const counted = (p) => p.then(v => { load.done++; showLoading(); return v; });
        load.total = KIT_MODELS.length + QT_MODELS.nature.length + 1;
        showLoading();
        const img = new Image();
        // Some hosts serve files from another origin: ask for CORS so the palette can be read
        img.crossOrigin = 'anonymous';
        const imgReady = counted(new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('colormap.png')); }));
        img.src = KIT_DIR + 'Textures/colormap.png';
        const get = (url) => counted(loader.loadAsync(url));
        const mapLoads = Promise.all([
            imgReady,
            Promise.all(KIT_MODELS.map(n => get(KIT_DIR + n + '.glb').then(g => [n, g.scene]))),
            Promise.all(QT_MODELS.nature.map(n => get(`${QT_DIR}nature/${n}.glb`).then(g => [n, g.scene])))
        ]);
        qt = { turret: {}, monster: {}, nature: {} };
        mapLoads.then(([, kitList, natureList]) => {
            kitImage = img;
            kit = {};
            kitRoots = {};
            kitList.forEach(([n, root]) => {
                root.updateMatrixWorld(true);
                kitRoots[n] = root;
                const parts = [];
                root.traverse(o => {
                    if (!o.isMesh) return;
                    o.geometry._shared = true;
                    parts.push({ geo: o.geometry, m: o.matrixWorld.clone(), name: o.name });
                });
                kit[n] = parts;
            });
            natureList.forEach(([n, root]) => addNature(n, root));
            ['Pine', 'PineLarge', 'snowPine', 'snowPineLarge'].forEach(k => {
                const geo = Units3D.tree(k);
                geo._shared = true;
                kit['n:' + k] = [{ geo, m: new T3.Matrix4(), name: k, mat: Units3D.materials().solid }];
            });
            load.mapReady = true;
            mapKey = '';
            load.towersReady = true;
            load.readyAt = performance.now();
            showLoading();
        }).catch((e) => {
            console.warn('3D models failed to load, using Flat:', e);
            kitError = 'a model did not load: ' + String(e && e.message || e).replace(/^.*\//, '').slice(0, 60);
            kitFailed = true;
            showLoading();
        }).finally(() => { kitLoading = false; });
    }

    // Build every enemy kind and every tower once and compile their shaders now, so
    // nothing stalls mid-battle when a new kind or effect first shows up
    let warmed = false;
    function warmUp() {
        Object.keys(Art.ENEMY_ART).forEach(n => {
            const K = kindOf(n);
            K.mesh.count = 1;
        });
        makeMissiles();
        missiles.forEach(list => list.forEach(p => { p.mesh.count = 1; }));
        const hold = new T3.Group();
        Object.keys(Art.TOWER_ART).forEach(n => {
            hold.add(buildTowerModel(n, false).root);
            hold.add(buildTowerModel(n, true).root);
        });
        dyn.add(hold);
        // Hidden pools (blasts, sparks, debris) count too: show everything for the compile
        const hidden = [];
        scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
        try {
            gl.compile(scene, camera);
            // and one real frame, so the shadow pass and the effect variants are built too
            // (through the same path as a frame: with bloom the scene draws into a
            // linear target, a different shader variant from drawing to the screen)
            hold.position.set(cols / 2, 0, rows / 2);
            hold.traverse(o => { o.frustumCulled = false; });
            gl.shadowMap.needsUpdate = true;
            gl.render(scene, camera);
            if (composer) composer.render();
        } catch (e) {
            console.warn('Shader warm-up:', e);
        }
        hidden.forEach(o => { o.visible = false; });
        dyn.remove(hold);
        hold.traverse(o => { if (o.material && o.material._own) o.material.dispose(); });
        Object.keys(kinds).forEach(n => { kinds[n].mesh.count = 0; });
        missiles.forEach(list => list.forEach(p => { p.mesh.count = 0; }));
    }

    // Image-based light: a soft sky, a warm sun patch and two fill panels, blurred
    // into an environment map. Metal reflects it; everything gets gentle sky light.
    function makeEnvironment() {
        const pm = new T3.PMREMGenerator(gl);
        const es = new T3.Scene();
        const g = new T3.SphereGeometry(10, 32, 16);
        const pos = g.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const zen = new T3.Color('#6f8fb4');
        const hor = new T3.Color('#d5dbe0');
        const gnd = new T3.Color('#4a4538');
        const c = new T3.Color();
        for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i) / 10;
            if (y >= 0) c.copy(hor).lerp(zen, Math.pow(y, 0.6));
            else c.copy(hor).lerp(gnd, Math.min(1, -y * 3));
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new T3.BufferAttribute(col, 3));
        es.add(new T3.Mesh(g, new T3.MeshBasicMaterial({ vertexColors: true, side: T3.BackSide })));
        const panel = (x, y, z, w, h, hex, k) => {
            const m = new T3.MeshBasicMaterial({ color: hex, side: T3.DoubleSide });
            m.color.multiplyScalar(k);
            const q = new T3.Mesh(new T3.PlaneGeometry(w, h), m);
            q.position.set(x, y, z);
            q.lookAt(0, 0, 0);
            es.add(q);
        };
        panel(-4, 7, -4.5, 3, 3, 0xfff1d8, 5);
        panel(6, 4, -3, 5, 2, 0xdfe8ff, 2.2);
        panel(-6, 3, -5, 4, 2, 0xffffff, 1.4);
        const rt = pm.fromScene(es, 0.035);
        pm.dispose();
        es.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
        return rt.texture;
    }

    // Nature models keep their own textured materials, scaled to tiles
    function addNature(n, root) {
        root.updateMatrixWorld(true);
        const box = new T3.Box3().setFromObject(root);
        const k = NATURE_SIZE[n] / Math.max(0.01, box.max.y - box.min.y);
        const fix = new T3.Matrix4().makeScale(k, k, k).multiply(new T3.Matrix4().makeTranslation(0, -box.min.y, 0));
        const parts = [];
        root.traverse(o => {
            if (!o.isMesh) return;
            o.geometry._shared = true;
            [].concat(o.material).forEach(mm => {
                mm.roughness = 0.9;
                mm.metalness = 0;
                if (mm.map) mm.map.anisotropy = 4;
                if (mm.transparent || mm.alphaTest) {
                    mm.transparent = false;
                    mm.alphaTest = 0.35;
                    mm.alphaToCoverage = true;
                    mm.side = T3.DoubleSide;
                }
            });
            parts.push({ geo: o.geometry, m: fix.clone().multiply(o.matrixWorld), name: o.name, mat: o.material });
        });
        kit['n:' + n] = parts;
        qt.nature[n] = root;
    }

    // "Loading 3D... n%" over the map until the map and the towers are in
    let loadEl = null;
    function showLoading() {
        if (!holder) return;
        const busy = !load.towersReady && !kitFailed;
        if (!loadEl) {
            loadEl = document.createElement('div');
            loadEl.className = 'load3d';
            loadEl.setAttribute('role', 'status');
            loadEl.innerHTML = '<span>Loading 3D</span><i><b></b></i>';
            holder.append(loadEl);
        }
        loadEl.hidden = !busy || canvas.style.display === 'none';
        const pct = load.total ? Math.round(100 * load.done / load.total) : 0;
        loadEl.querySelector('b').style.width = `${pct}%`;
        loadEl.querySelector('span').textContent = `Loading 3D ${pct}%`;
    }

    // Pictures of each tower's and enemy's model for the build menu, the tower panel
    // and the wave preview
    const portraits = {};
    const enemyPortraits = {};
    function makePortraits() {
        const S = 160;
        const rt = new T3.WebGLRenderTarget(S, S, { samples: 4 });
        rt.texture.colorSpace = T3.SRGBColorSpace;
        const sc = new T3.Scene();
        sc.add(new T3.HemisphereLight(0xf2f6ff, 0x50566a, 0.8));
        sc.environment = scene.environment;
        const d = new T3.DirectionalLight(0xfff2de, 2.4);
        d.position.set(-2, 5, 3);
        sc.add(d);
        const cam = new T3.PerspectiveCamera(26, 1, 0.1, 60);
        const px = new Uint8Array(S * S * 4);
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        const img = g.createImageData(S, S);
        const box = new T3.Box3();
        const sph = new T3.Sphere();
        const shoot = (root, dir, fill) => {
            sc.add(root);
            root.updateMatrixWorld(true);
            box.setFromObject(root).getBoundingSphere(sph);
            cam.position.copy(sph.center).addScaledVector(dir, sph.radius / Math.sin(13 * Math.PI / 180) * fill);
            cam.lookAt(sph.center);
            gl.setRenderTarget(rt);
            gl.setClearColor(0x000000, 0);
            gl.clear();
            gl.render(sc, cam);
            gl.readRenderTargetPixels(rt, 0, 0, S, S, px);
            for (let y = 0; y < S; y++) {
                for (let x = 0; x < S; x++) {
                    const i = ((S - 1 - y) * S + x) * 4;
                    const o = (y * S + x) * 4;
                    const a = px[i + 3];
                    const k = a ? 255 / a : 0;
                    img.data[o] = Math.min(255, px[i] * k);
                    img.data[o + 1] = Math.min(255, px[i + 1] * k);
                    img.data[o + 2] = Math.min(255, px[i + 2] * k);
                    img.data[o + 3] = a;
                }
            }
            g.putImageData(img, 0, 0);
            sc.remove(root);
            return c.toDataURL('image/webp', 0.92);
        };
        const towerDir = new T3.Vector3(0.9, 1.05, 1.5).normalize();
        Object.keys(Art.TOWER_ART).forEach(name => {
            const b = buildTowerModel(name, false);
            if (b.aim) b.gun.rotation.y = -Math.PI * 0.3;
            if (b.glow) b.root.remove(b.glow);
            portraits[name] = shoot(b.root, towerDir, 0.98);
        });
        // Enemies a little from the front, mid-stride
        const enemyDir = new T3.Vector3(0.5, 0.55, 1.5).normalize();
        Object.keys(Art.ENEMY_ART).forEach(name => {
            const u = Units3D.enemy(name);
            const root = new T3.Group();
            root.add(new T3.Mesh(u.geo, Units3D.materials().solid));
            root.rotation.y = -0.35;
            enemyPortraits[name] = shoot(root, enemyDir, 0.9);
        });
        gl.setRenderTarget(null);
        rt.dispose();
    }

    // ---------- Palette recolouring ----------

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const l = (mx + mn) / 2;
        let h = 0;
        let s = 0;
        if (mx !== mn) {
            const d = mx - mn;
            s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (mx === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        return [h, s, l];
    }
    function hslToRgb(h, s, l) {
        const c = new T3.Color().setHSL(((h % 360) + 360) % 360 / 360, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)));
        return [c.r * 255, c.g * 255, c.b * 255];
    }
    // What a palette colour is: grass, path, accent (the coloured trims) or other
    function paletteClass(h, s, l) {
        if (h >= 95 && h <= 175 && s > 0.25) return 'grass';
        if (h >= 10 && h <= 42 && s > 0.35 && s < 0.9 && l > 0.55) return 'path';
        if (((h >= 245 && h <= 295) && s > 0.35 && l < 0.74) || ((h <= 22 || h >= 345) && s > 0.62 && l > 0.45 && l < 0.7) || (h > 14 && h < 32 && s > 0.95)) return 'accent';
        return 'other';
    }

    const texCache = new Map();
    // Palette texture with colours changed by fn(class, h, s, l) -> [h, s, l] or null
    function paletteTex(key, fn) {
        if (texCache.has(key)) return texCache.get(key);
        const c = document.createElement('canvas');
        c.width = kitImage.width;
        c.height = kitImage.height;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(kitImage, 0, 0);
        if (fn) {
            const d = g.getImageData(0, 0, c.width, c.height);
            const a = d.data;
            const memo = new Map();
            for (let i = 0; i < a.length; i += 4) {
                const k = (a[i] << 16) | (a[i + 1] << 8) | a[i + 2];
                let out = memo.get(k);
                if (out === undefined) {
                    const [h, s, l] = rgbToHsl(a[i], a[i + 1], a[i + 2]);
                    const r = fn(paletteClass(h, s, l), h, s, l);
                    out = r ? hslToRgb(r[0], r[1], r[2]) : null;
                    memo.set(k, out);
                }
                if (out) {
                    a[i] = out[0];
                    a[i + 1] = out[1];
                    a[i + 2] = out[2];
                }
            }
            g.putImageData(d, 0, 0);
        }
        const t = new T3.CanvasTexture(c);
        t.colorSpace = T3.SRGBColorSpace;
        t.flipY = false;
        t.magFilter = T3.NearestFilter;
        t.minFilter = T3.NearestFilter;
        t.generateMipmaps = false;
        texCache.set(key, t);
        return t;
    }

    // Ground grain: soft patches and fine speckle in world space, so flat kit colours
    // read as earth, grass and stone rather than paint
    function groundGrain(m) {
        if (m._grain) return m;
        m._grain = true;
        m.envMapIntensity = Math.min(m.envMapIntensity, 0.55);
        m.onBeforeCompile = (sh) => {
            sh.vertexShader = 'varying vec3 vGW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
                vec4 gwp = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                gwp = instanceMatrix * gwp;
                #endif
                vGW = (modelMatrix * gwp).xyz;`);
            sh.fragmentShader = `varying vec3 vGW;
                float g3h(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
                float g3n(vec3 x) {
                    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(mix(g3h(i), g3h(i + vec3(1, 0, 0)), f.x), mix(g3h(i + vec3(0, 1, 0)), g3h(i + vec3(1, 1, 0)), f.x), f.y),
                               mix(mix(g3h(i + vec3(0, 0, 1)), g3h(i + vec3(1, 0, 1)), f.x), mix(g3h(i + vec3(0, 1, 1)), g3h(i + vec3(1, 1, 1)), f.x), f.y), f.z);
                }
            ` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
                float gpat = g3n(vGW * 0.9) * 0.55 + g3n(vGW * 3.1) * 0.25 + g3n(vGW * 13.0) * 0.12 + g3n(vGW * 41.0) * 0.08;
                diffuseColor.rgb *= 0.78 + 0.4 * gpat;
                diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.1, 1.0, 0.78), smoothstep(0.45, 0.8, g3n(vGW * 0.45 + 7.0)) * 0.6);`);
        };
        m.customProgramCacheKey = () => 'grain';
        return m;
    }

    const kitMats = new Map();
    function kitMat(key, fn, o = {}) {
        const k = `${key}|${o.emissive || ''}`;
        let m = kitMats.get(k);
        if (!m) {
            m = groundGrain(new T3.MeshStandardMaterial({ map: paletteTex(key, fn), roughness: 0.86, metalness: 0.02, envMapIntensity: 0.55 }));
            if (o.emissive) {
                m.emissive = new T3.Color(o.emissive);
                m.emissiveMap = m.map;
                m.emissiveIntensity = o.ei ?? 0.6;
            }
            kitMats.set(k, m);
        }
        return m;
    }

    // Ground colours per map theme (Frost uses the kit's own snow models)
    const THEME_GROUND = {
        meadow: { grass: [92, 0.3, 0.36], path: [30, 0.3, 0.44] },
        frost: null,
        desert: { grass: [42, 0.5, 0.66], path: [20, 0.48, 0.58] },
        city: { grass: [128, 0.32, 0.4], path: [222, 0.07, 0.36] },
        void: { grass: [262, 0.32, 0.3], path: [272, 0.42, 0.56] },
        ash: { grass: [24, 0.07, 0.3], path: [16, 0.28, 0.44] }
    };
    function groundMat(themeId) {
        const t = THEME_GROUND[themeId];
        if (!t) return kitMat('base');
        return kitMat(`ground-${themeId}`, (cls, h, s, l) => {
            if (cls !== 'grass' && cls !== 'path') return null;
            const [th, ts_, tl] = t[cls];
            // keep the kit's light and dark steps around the new colour
            const base = cls === 'grass' ? 0.5 : 0.72;
            return [th, ts_, tl + (l - base) * 0.9];
        });
    }
    // Trims recoloured to a hex colour (towers, enemies, the gate)
    function accentMat(hex, o) {
        const c = new T3.Color(hex);
        const hsl = {};
        c.getHSL(hsl);
        return kitMat(`accent-${hex}`, (cls, h, s, l) => {
            if (cls !== 'accent') return null;
            return [hsl.h * 360, Math.max(0.35, hsl.s), hsl.l * 0.55 + l * 0.45];
        }, o);
    }

    // One instanced mesh per model part, for many copies of a model
    function instances(name, mats, material, parent, opts = {}) {
        const parts = kit[name];
        if (!parts || !mats.length) return [];
        return parts.map(p => {
            const mesh = new T3.InstancedMesh(p.geo, material || p.mat, mats.length);
            mats.forEach((m, i) => mesh.setMatrixAt(i, tmpM.multiplyMatrices(m, p.m)));
            mesh.castShadow = opts.cast !== false;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            parent.add(mesh);
            return mesh;
        });
    }

    // A copy of a model as a group of meshes with one material
    function kitClone(name, material) {
        const root = kitRoots[name].clone(true);
        root.traverse(o => {
            if (!o.isMesh) return;
            o.material = material;
            o.castShadow = true;
            o.receiveShadow = true;
        });
        return root;
    }

    // ---------- The map: board, tiles, obstacles, details ----------

    function mapChanged(themeId) {
        if (themeId) theme = themeId;
        mapKey = '';
        fillPending = true;
        routeKey = '';
        previewKey = '';
        if (inited && cols && kit) {
            buildWorld();
            refit();
        }
    }

    // Road tiles: which of the four sides (N E S W) connect to another road tile
    const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    // Sides each road model connects at rotation 0 (checked against the models)
    const ROAD = {
        straight: [0, 2],
        'corner-round': [1, 2],
        'end-round': [2],
        split: [1, 2, 3],
        crossing: [0, 1, 2, 3]
    };
    function roadPick(conn) {
        const n = conn.filter(Boolean).length;
        const want = conn.map(Boolean);
        for (const [name, sides] of Object.entries(ROAD)) {
            if (sides.length !== n) continue;
            for (let k = 0; k < 4; k++) {
                const got = [false, false, false, false];
                sides.forEach(s => (got[(s + k) % 4] = true));
                if (got.every((v, i) => v === want[i])) return { name, k };
            }
        }
        return { name: 'dirt', k: 0 };
    }

    let wallH = null;
    let groundY = null;         // per tile: height of the ground top (hills are higher)
    function buildWorld() {
        if (!kit) return;
        if (world) {
            scene.remove(world);
            disposeTree(world);
        }
        world = new T3.Group();
        scene.add(world);
        props = [];
        const th = Terrain.THEMES[theme] || Terrain.THEMES.meadow;
        const snow = theme === 'frost';
        const pre = snow ? 'snow-' : '';
        const gm = groundMat(theme);
        // Props share the ground's colours on themes without green (no meadow bushes in the desert)
        const dm = theme === 'frost' ? kitMat('base') : gm;
        scene.background = new T3.Color(th.frame);

        // The board the map sits on
        const board = new T3.Mesh(new T3.BoxGeometry(cols + 0.6, 1.4, rows + 0.6), mat(shadeHex(th.frame, 0.7), { rough: 0.95 }));
        board.position.set(cols / 2, -0.9, rows / 2);
        board.receiveShadow = true;
        world.add(board);
        const rimTop = new T3.Mesh(new T3.BoxGeometry(cols + 0.6, 0.08, rows + 0.6), mat(shadeHex(th.frame, 1.3), { rough: 0.8 }));
        rimTop.position.set(cols / 2, -0.23, rows / 2);
        rimTop.receiveShadow = true;
        world.add(rimTop);

        const cls = [];
        for (let x = 0; x < cols; x++) {
            cls[x] = [];
            for (let y = 0; y < rows; y++) cls[x][y] = Terrain.tileClass(mapView(), x, y);
        }
        const spawnAt = new Set(spawnpoints.map(s => `${s.x},${s.y}`));
        const exitKey = `${exit.x},${exit.y}`;
        const isRoad = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows &&
            (cls[x][y] === 'r' || spawnAt.has(`${x},${y}`) || `${x},${y}` === exitKey);
        const byModel = {};
        const put = (name, x, y, rotK, h = 0, s = 1, jx = 0, jz = 0, ry = null) => {
            (byModel[name] = byModel[name] || []).push(M(x + 0.5 + jx, h, y + 0.5 + jz, 0, ry === null ? -rotK * Math.PI / 2 : ry, 0, s));
        };
        wallH = [];
        groundY = [];
        for (let x = 0; x < cols; x++) {
            wallH[x] = new Float32Array(rows);
            groundY[x] = new Float32Array(rows);
            for (let y = 0; y < rows; y++) {
                const c = cls[x][y];
                const key = `${x},${y}`;
                const r = hashT(x, y, 11);
                if (spawnAt.has(key) || key === exitKey) {
                    const conn = SIDES.map(([dx, dy]) => isRoad(x + dx, y + dy));
                    const pick = roadPick(conn);
                    // Spawn and gate tiles face the road that leaves them
                    const k = conn.findIndex(Boolean);
                    put(pre + (key === exitKey ? 'tile-spawn-end' : 'tile-spawn'), x, y, k < 0 ? 0 : (k + 2) % 4, -0.2);
                    void pick;
                } else if (c === 'r') {
                    const conn = SIDES.map(([dx, dy]) => isRoad(x + dx, y + dy));
                    let pick = roadPick(conn);
                    // Wide roads: inside an area of road, plain dirt
                    const diag = (a, b) => isRoad(x + SIDES[a][0] + SIDES[b][0], y + SIDES[a][1] + SIDES[b][1]);
                    const n = conn.filter(Boolean).length;
                    if (n >= 2) {
                        for (let a = 0; a < 4; a++) {
                            const b = (a + 1) % 4;
                            if (conn[a] && conn[b] && diag(a, b)) pick = { name: 'dirt', k: 0 };
                        }
                    }
                    put(pre + 'tile-' + pick.name, x, y, pick.k, -0.2);
                } else if (c === 'w') {
                    const inner = x > 0 && y > 0 && x < cols - 1 && y < rows - 1 &&
                        cls[x - 1][y] === 'w' && cls[x + 1][y] === 'w' && cls[x][y - 1] === 'w' && cls[x][y + 1] === 'w';
                    const hill = inner && r < 0.3;
                    put(pre + (hill ? 'tile-hill' : 'tile'), x, y, Math.floor(hashT(x, y, 19) * 4), -0.2);
                    const top = hill ? 0.4 : 0;
                    groundY[x][y] = top;
                    wallH[x][y] = top;
                    obstacles(x, y, top, inner, put, snow);
                } else if (c === 'p') {
                    put(pre + 'tile', x, y, 0, -0.2);
                    (byModel.__pad = byModel.__pad || []).push(M(x + 0.5, 0.0, y + 0.5));
                } else {
                    put(pre + 'tile', x, y, Math.floor(hashT(x, y, 19) * 4), -0.2);
                    // Grass tufts and flowers, or a few small details, on open ground
                    const lush = theme === 'meadow' || theme === 'city';
                    if (lush && r < 0.05) {
                        put('n:Flower_3_Group', x, y, 0, 0, 0.8 + hashT(x, y, 16) * 0.5,
                            (hashT(x, y, 13) - 0.5) * 0.6, (hashT(x, y, 14) - 0.5) * 0.6, hashT(x, y, 17) * TAU);
                    } else if (!lush && r < 0.07) {
                        const list = snow ? ['snow-detail-rocks', 'snow-detail-crystal'] : theme === 'void' ? ['detail-crystal', 'detail-rocks'] : ['detail-rocks', 'detail-dirt'];
                        const name = list[Math.floor(hashT(x, y, 12) * list.length)];
                        put(name, x, y, 0, 0, 0.6 + hashT(x, y, 16) * 0.3, (hashT(x, y, 13) - 0.5) * 0.5, (hashT(x, y, 14) - 0.5) * 0.5, hashT(x, y, 17) * TAU);
                    }
                }
            }
        }
        Object.keys(byModel).forEach(name => {
            const list = byModel[name];
            if (name === '__pad') {
                const g = new T3.CylinderGeometry(0.6, 0.64, 0.06, 4).rotateY(Math.PI / 4);
                g.translate(0, 0.03, 0);
                const mesh = new T3.InstancedMesh(g, groundGrain(mat('#8c887d', { rough: 0.9 })), list.length);
                list.forEach((m, i) => mesh.setMatrixAt(i, m));
                mesh.receiveShadow = true;
                mesh.frustumCulled = false;
                world.add(mesh);
                const g2 = new T3.CylinderGeometry(0.5, 0.52, 0.02, 4).rotateY(Math.PI / 4);
                g2.translate(0, 0.07, 0);
                const inset = new T3.InstancedMesh(g2, groundGrain(mat('#7b776c', { rough: 0.95 })), list.length);
                list.forEach((m, i) => inset.setMatrixAt(i, m));
                inset.receiveShadow = true;
                inset.frustumCulled = false;
                world.add(inset);
                return;
            }
            const isTile = name.includes('tile');
            const own = name.startsWith('n:');
            const material = own ? null : isTile ? gm : dm;
            const meshes = instances(name, list, material, world, { cast: !isTile || name.includes('hill') });
            if (own && /Grass|Flower/.test(name)) meshes.forEach(mesh => (mesh.castShadow = false));
            if (/tree|Tree|Pine|Bush/.test(name)) meshes.forEach(mesh => props.push({ mesh, base: list.map((m, i) => { mesh.getMatrixAt(i, tmpM); return tmpM.clone(); }), amp: name.includes('large') ? 0.7 : 1, phase: list.map((m, i) => i * 1.7 + m.elements[12] * 0.9 + m.elements[14] * 0.4) }));
        });

        // Sun over the map's upper left, its shadow box around the map
        const span = Math.max(cols, rows);
        sun.position.set(cols / 2 - span * 0.45, span * 0.95, rows / 2 - span * 0.5);
        sun.target.position.set(cols / 2, 0, rows / 2);
        const sc = sun.shadow.camera;
        const rr = span * 0.8;
        sc.left = -rr; sc.right = rr; sc.top = rr; sc.bottom = -rr;
        sc.near = 0.5; sc.far = span * 3;
        sc.updateProjectionMatrix();
        hemi.groundColor.set(shadeHex(th.frame, 1.6));

        buildGate();
        gl.shadowMap.needsUpdate = true;
        mapKey = `${theme}|${cols}x${rows}`;
        // Once, with the map in place (so the shadow box covers the warm-up models)
        if (!warmed) {
            warmed = true;
            warmUp();
        }
    }

    // Trees, rocks and crystals on a wall tile, by theme
    function obstacles(x, y, top, inner, put, snow) {
        const r = (s) => hashT(x, y, s);
        const t = theme;
        const pick = (list) => list[Math.floor(r(31) * list.length)];
        let set;
        if (snow) set = [['n:snowPineLarge'], ['n:snowPine', 'n:snowPine'], ['snow-detail-rocks-large'], ['n:snowPine', 'snow-detail-crystal']];
        else if (t === 'desert') set = [['n:Rock_Medium_1'], ['detail-rocks', 'n:Rock_Medium_1'], ['detail-rocks-large'], ['n:Rock_Medium_1', 'detail-rocks'], ['detail-crystal']];
        else if (t === 'void') set = [['detail-crystal-large'], ['detail-crystal', 'detail-crystal'], ['detail-crystal-large', 'detail-rocks'], ['detail-rocks-large']];
        else if (t === 'ash') set = [['n:Rock_Medium_1'], ['n:Rock_Medium_1', 'detail-rocks'], ['detail-rocks-large', 'detail-dirt'], ['detail-rocks-large']];
        else set = [['n:PineLarge'], ['n:Pine', 'n:Pine', 'n:Pine'], ['n:PineLarge', 'n:Rock_Medium_1'],
            ['n:Rock_Medium_1', 'n:Pine'], ['n:PineLarge', 'n:Flower_3_Group'], ['n:Pine', 'n:Pine', 'n:Flower_3_Group']];
        const group = pick(set);
        const spots = group.length === 1 ? [[0, 0]] : group.length === 2 ? [[-0.2, -0.12], [0.18, 0.16]] : [[-0.22, -0.16], [0.2, -0.1], [-0.02, 0.22]];
        group.forEach((name, i) => {
            const [sx, sz] = spots[i];
            const jx = sx + (r(40 + i) - 0.5) * 0.12;
            const jz = sz + (r(50 + i) - 0.5) * 0.12;
            const big = /tree|Pine/.test(name) ? 1.55 : /rock|crystal/i.test(name) ? 1.25 : 1;
            const s = big * (0.85 + r(60 + i) * 0.35) * (inner ? 1.1 : 1);
            put(name, x, y, 0, top, s, jx, jz, r(70 + i) * TAU);
        });
    }

    function shadeHex(hex, k) {
        const c = new T3.Color(hex);
        c.r = Math.min(1, c.r * k); c.g = Math.min(1, c.g * k); c.b = Math.min(1, c.b * k);
        return c.getHex();
    }

    function swayProps() {
        if (FX.quality === 0) return;
        for (const p of props) {
            for (let i = 0; i < p.base.length; i++) {
                const a = Math.sin(time * 1.6 + p.phase[i]) * 0.04 * p.amp;
                const b = Math.cos(time * 1.3 + p.phase[i] * 0.7) * 0.03 * p.amp;
                tmpQ.setFromAxisAngle(tmpV.set(1, 0, 0), b);
                tmpM2.makeRotationFromQuaternion(tmpQ);
                tmpM.makeRotationZ(a).multiply(tmpM2);
                tmpM2.multiplyMatrices(p.base[i], tmpM);
                p.mesh.setMatrixAt(i, tmpM2);
            }
            p.mesh.instanceMatrix.needsUpdate = true;
        }
    }

    // ---------- Towers: built to match the flat art (units3d.js), one model per tower and upgrade ----------

    const towerModels = new Map();      // tower -> model
    let shadowsAt = 0;
    // The parts that glow get a soft halo too
    const GLOW_PART = { slow: '#9fdcff', poison: '#9cff3a', tesla: '#ffe066', lightningStrike: '#6ff3ff', laser: '#60b8ff', beamEmitter: '#5ff0e0' };
    const STILL_TOWER = /^(slow|poison|tesla|lightningStrike)$/;
    const PLINTH_H = 0.175;

    function buildTowerModel(name, ghost) {
        const u = Units3D.tower(name);
        u.fixed._shared = true;
        if (u.gun) u.gun._shared = true;
        const mats = Units3D.materials();
        const mat = ghost ? mats.ghost : mats.solid;
        const root = new T3.Group();
        const base = new T3.Mesh(u.fixed, mat);
        base.castShadow = !ghost;
        base.receiveShadow = true;
        root.add(base);
        const still = STILL_TOWER.test(name);
        let gun = null;
        if (u.gun) {
            gun = new T3.Group();
            const m = new T3.Mesh(u.gun, mat);
            m.castShadow = !ghost;
            m.receiveShadow = true;
            gun.add(m);
            root.add(gun);
        }
        let glow = null;
        if (GLOW_PART[name] && u.glowAt && !ghost) {
            glow = glowSprite(new T3.Color(GLOW_PART[name]).getHex(), 0.42, 0.35);
            glow.position.copy(u.glowAt);
            root.add(glow);
        }
        const aim = gun && !still ? { f0: 0 } : null;
        // A muzzle flash that sits at the barrel that fired
        let flash = null;
        if (aim && !ghost) {
            flash = glowSprite(0xfff0b0, 0.4, 0);
            flash.visible = false;
            gun.add(flash);
        }
        return { root, turret: root, inner: root, gun, aim, glow, orb: null, top: u.top, still, tips: u.tips, flash };
    }

    // Invisible hit volume for picking a tower by its body
    let hitGeo = null;
    let hitMat = null;
    function makeModel(t, ghost) {
        const b = buildTowerModel(t.name, ghost);
        const m = { name: t.name, root: b.root, turret: b.turret, inner: b.inner, gun: b.gun, aim: b.aim, glow: b.glow, orb: b.orb, top: b.top, still: b.still, tips: b.tips, flash: b.flash, hit: null, tower: t, spin: null };
        if (!ghost) {
            if (!hitGeo) {
                hitGeo = new T3.CylinderGeometry(0.46, 0.46, 1, 10);
                hitGeo.translate(0, 0.5, 0);
                hitGeo._shared = true;
                hitMat = new T3.MeshBasicMaterial({ visible: false });
            }
            m.hit = new T3.Mesh(hitGeo, hitMat);
            m.hit.scale.y = Math.max(0.9, b.top + 0.3);
            m.hit.userData.tower = t;
            m.root.add(m.hit);
        }
        return m;
    }

    // Turn something that faces +Z towards a game angle
    const yawFor = (a) => Math.atan2(Math.cos(a), Math.sin(a));

    // Ease towards a target at rate k per second, the same at any frame rate
    const damp = (k, dt) => 1 - Math.exp(-k * dt);

    // ---- Tower motion ----
    // The gun turns towards the game's aim at a limited speed (heavy guns slower),
    // kicks back on a spring when it fires, and sweeps slowly when nothing is in
    // range. Spires and crystals turn and bob. A new tower rises out of the ground
    // with a puff of dust; an upgrade pops with a gold ring; a sold one sinks.
    const TURN_SPEED = { sniper: 5, railgun: 4.5, rocket: 6, missileSilo: 5.5, bomb: 4, clusterBomb: 3.5 };
    const leaving = [];                 // sold or replaced towers sinking away

    function moveTower(m, t, i, dt, gdt) {
        if (m.gun && m.aim) {
            // Aim: the game's angle, or a slow sweep once it has not moved for a while
            // (nothing in range)
            if (t.angle !== m.lastAngle || t._recoil > 0) {
                m.lastAngle = t.angle;
                m.lastAim = time;
            }
            const idle = time - (m.lastAim || 0) > 1.5;
            const want = idle ? m.yaw + Math.sin(time * 0.6 + i) * 0.6 * gdt : m.aim.f0 - t.angle;
            const rate = (TURN_SPEED[t.name] || 9) * gdt;
            const d = angDiff(want - m.yaw);
            m.yaw += Math.max(-rate, Math.min(rate, d));
            m.gun.rotation.y = m.yaw;
            // Recoil: a fresh shot sets t._recoil to 1; push the spring back
            const r = t._recoil || 0;
            if (r > (m.lastRecoil || 0) + 0.3) m.kickV -= 2.6 * (t.name === 'bomb' || t.name === 'clusterBomb' ? 1.4 : 1);
            m.lastRecoil = r;
            // Spring: stiff, a little bouncy
            m.kickV += (-260 * m.kick - 18 * m.kickV) * Math.min(gdt, 0.033);
            m.kick += m.kickV * Math.min(gdt, 0.033);
            const k = Math.max(-0.09, Math.min(0.02, m.kick));
            const fa = m.yaw - m.aim.f0;          // = -t.angle when on target
            m.gun.position.set(Math.cos(-fa) * k, 0, Math.sin(-fa) * k);
        } else if (m.gun) {
            // Spires: turn slowly, faster just after a pulse
            m.spin += gdt * (0.8 + (t._flash || 0) * 0.6);
            m.gun.rotation.y = m.spin;
            m.gun.position.y = Math.sin(time * 2 + i) * 0.012;
        }
        if (m.glow) {
            const k = 0.75 + 0.25 * Math.sin(time * 5 + i) + (t._flash || 0) * 0.1;
            m.glow.material.opacity = Math.min(1, 0.3 * k);
            const sz = 0.36 + 0.1 * k;
            m.glow.scale.set(sz, sz, 1);
        }
        // Building: rise out of the ground, overshoot and settle
        if (m.rise < 1) {
            m.rise = Math.min(1, m.rise + dt * 2.6);
            const e = m.rise;
            const back = 1 + 2.2 * Math.pow(e - 1, 3) + 1.2 * Math.pow(e - 1, 2);
            m.root.position.y += (back - 1) * 0.6;
            const sq = 1 + Math.sin(e * Math.PI) * 0.12;
            m.root.scale.set(sq, 2 - sq, sq);
        } else if (m.pop > 0) {
            m.pop = Math.max(0, m.pop - dt * 3);
            const s = 1 + Math.sin(m.pop * Math.PI) * 0.14;
            m.root.scale.set(s, 1 + (s - 1) * 1.5, s);
        } else {
            m.root.scale.set(1, 1, 1);
        }
    }

    // World point (tiles) where tower t's shot leaves barrel i; the 2D muzzle at gun
    // height when its model is not there
    const MUZZLE_H = TOP_H + 0.12;
    function muzzle3D(t, i, out) {
        const m = t && towerModels.get(t);
        if (!m || !m.tips) {
            const q = t ? FX2.muzzle(t, i) : { x: 0, y: 0 };
            return out.set(q.x / ts, MUZZLE_H, q.y / ts);
        }
        const tip = m.tips[(i || 0) % m.tips.length];
        const node = m.aim ? m.gun : m.root;
        node.updateWorldMatrix(true, false);
        return out.copy(tip).applyMatrix4(node.matrixWorld);
    }
    let mz = null;              // scratch point (made in init, when three.js is there)

    function syncTowers(dt) {
        if (!load.towersReady) return;
        const gdt = dt * gameRate();
        const seen = new Set();
        for (let i = 0; i < towers.length; i++) {
            const t = towers[i];
            if (!t.alive) continue;
            seen.add(t);
            let m = towerModels.get(t);
            let upgraded = false;
            if (m && m.name !== t.name) {
                sinkTower(m, true);
                towerModels.delete(t);
                m = null;
                upgraded = true;
            }
            if (!m) {
                m = makeModel(t, false);
                m.yaw = m.aim ? m.aim.f0 - t.angle : 0;
                m.kick = m.kickV = 0;
                m.spin = Math.random() * TAU;
                m.rise = upgraded ? 1 : 0;
                m.pop = upgraded ? 1 : 0;
                towerModels.set(t, m);
                dyn.add(m.root);
                shadowsAt = time + 0.5;
                const X = t.pos.x / ts;
                const Z = t.pos.y / ts;
                if (upgraded) startBlast(X, Z, 'upgrade', 0.7, true, '#facc15');
                else startBlast(X, Z, 'dust', 0.65, true, '#cbbfa6');
            }
            const gy = groundY && groundY[t.gridPos.x] ? groundY[t.gridPos.x][t.gridPos.y] : 0;
            m.root.position.set(t.pos.x / ts, gy, t.pos.y / ts);
            moveTower(m, t, i, dt, gdt);
            if (m.flash) {
                const f = t._flash || 0;
                m.flash.visible = f > 0;
                if (f > 0) {
                    const tip = m.tips[(t._barrel || 0) % m.tips.length];
                    m.flash.position.copy(tip);
                    const big = t.name === 'sniper' || t.name === 'railgun' || t.name === 'bomb' || t.name === 'clusterBomb';
                    const sz = (big ? 0.55 : 0.36) * (0.7 + 0.3 * Math.random());
                    m.flash.scale.set(sz, sz, 1);
                    m.flash.material.opacity = Math.min(1, f / 3);
                    m.flash.material.color.setHex(t.name === 'railgun' ? 0xe0a0ff : t.name === 'sniper' ? 0xffb0a0 : 0xfff0b0).multiplyScalar(2.5);
                }
            }
            const hov = hover && !toPlace && Math.abs(hover.x - t.pos.x) < ts * 0.5 && Math.abs(hover.y - t.pos.y) < ts * 0.5;
            if (hov) m.root.position.y += 0.03;
        }
        if (shadowsAt && time >= shadowsAt) {
            shadowsAt = 0;
            gl.shadowMap.needsUpdate = true;
        }
        towerModels.forEach((m, t) => {
            if (seen.has(t)) return;
            towerModels.delete(t);
            sinkTower(m, false);
            startBlast(t.pos.x / ts, t.pos.y / ts, 'dust', 0.6, true, '#cbbfa6');
        });
        for (let i = leaving.length - 1; i >= 0; i--) {
            const m = leaving[i];
            m.out += dt * (m.quick ? 8 : 3);
            const f = Math.min(1, m.out);
            m.root.position.y = m.y0 - f * f * 0.7;
            m.root.scale.setScalar(1 - f * 0.4);
            if (f >= 1) {
                dyn.remove(m.root);
                if (m.glow) m.glow.material.dispose();
                leaving.splice(i, 1);
                gl.shadowMap.needsUpdate = true;
            }
        }
    }

    function sinkTower(m, quick) {
        if (m.hit) m.root.remove(m.hit);
        m.out = 0;
        m.quick = quick;
        m.y0 = m.root.position.y;
        leaving.push(m);
    }

    // Game ticks per real second over 60: 0 while paused, 2 or 3 when sped up
    function gameRate() {
        if (paused || gameOver) return 0;
        return typeof speed === 'number' ? speed : 1;
    }

    // ---------- Enemies: built to match the flat art (units3d.js) ----------
    //
    // One instanced draw per enemy kind. Legs, treads, flames and rotors move on the
    // GPU from each instance's walk phase; here each enemy gets its place, facing,
    // lean, squash, hit flash, status glow and, once killed, how far it has burned
    // away. Nothing is loaded or cloned, so a new kind arriving late costs nothing.

    const kinds = {};                   // enemy name -> { info, mesh, fx, mv, cap, n, k }
    const enemyState = new Map();       // enemy -> its motion
    const dying = [];                   // killed: falling, toppling, burning away
    const clones = 0;                   // (kept for the tests: no per-enemy models now)
    let tmpE = null;

    function kindOf(name) {
        let K = kinds[name];
        if (K) return K;
        const info = Units3D.enemy(name);
        info.geo._shared = true;
        const art = Art.ENEMY_ART[name];
        K = kinds[name] = { name, info, art, k: art.r * (art.boss ? 1.25 : 1), mesh: null, cap: 0, n: 0 };
        growKind(K, 24);
        return K;
    }
    function growKind(K, cap) {
        if (K.mesh) {
            dyn.remove(K.mesh);
            K.mesh.dispose();
        }
        const geo = K.info.geo;
        K.fx = new T3.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
        K.mv = new T3.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
        K.fx.setUsage(T3.DynamicDrawUsage);
        K.mv.setUsage(T3.DynamicDrawUsage);
        geo.setAttribute('aFx', K.fx);
        geo.setAttribute('aMove', K.mv);
        const mesh = new T3.InstancedMesh(geo, Units3D.materials().crowd, cap);
        mesh.instanceMatrix.setUsage(T3.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.count = 0;
        dyn.add(mesh);
        K.mesh = mesh;
        K.cap = cap;
    }
    // One instance: place, yaw / pitch / roll, scale, glow, dissolve, walk
    function putUnit(K, x, y, z, yaw, pitch, roll, sx, sy, sz, r, g, b, dis, walk, seed, boost) {
        if (K.n >= K.cap) growKind(K, K.cap * 2);
        const i = K.n++;
        tmpE.set(roll, yaw, pitch, 'YZX');
        tmpQ.setFromEuler(tmpE);
        tmpV.set(x, y, z);
        tmpS.set(sx * K.k, sy * K.k, sz * K.k);
        tmpM.compose(tmpV, tmpQ, tmpS);
        K.mesh.setMatrixAt(i, tmpM);
        const f = K.fx.array;
        f[i * 4] = r; f[i * 4 + 1] = g; f[i * 4 + 2] = b; f[i * 4 + 3] = dis;
        const m = K.mv.array;
        m[i * 4] = walk; m[i * 4 + 1] = seed; m[i * 4 + 2] = boost; m[i * 4 + 3] = 1;
    }

    let enemyId = 0;
    function angDiff(a) {
        while (a > Math.PI) a -= TAU;
        while (a < -Math.PI) a += TAU;
        return a;
    }
    // Facing and distance walked, from how the enemy moved since the last frame
    function trackEnemy(e, dt) {
        if (e._lx === undefined) {
            e._lx = e.pos.x;
            e._ly = e.pos.y;
            e._rot = Math.atan2(e.vel.y, e.vel.x) || 0;
            e._ph = Math.random() * TAU;
            e._id = enemyId++;
            e._spd = 0;
        }
        const dx = e.pos.x - e._lx;
        const dy = e.pos.y - e._ly;
        const d = Math.hypot(dx, dy);
        // tiles per real second, smoothed
        if (dt > 0) e._spd += (d / ts / dt - e._spd) * damp(8, dt);
        if (d > 0.0001) {
            e._ph += d / ts * 10;
            e._rot += angDiff(Math.atan2(dy, dx) - e._rot) * damp(10, dt);
            e._lx = e.pos.x;
            e._ly = e.pos.y;
        }
        return d / ts;
    }

    // Soft round shadows under enemies, one instanced mesh
    let blobs = null;
    function blobMesh() {
        if (blobs) return blobs;
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(0,0,0,0.6)');
        gr.addColorStop(0.6, 'rgba(0,0,0,0.32)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        const m = new T3.MeshBasicMaterial({ map: new T3.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false });
        blobs = new T3.InstancedMesh(new T3.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m, 512);
        blobs.instanceMatrix.setUsage(T3.DynamicDrawUsage);
        blobs.frustumCulled = false;
        blobs.renderOrder = 1;
        blobs.count = 0;
        dyn.add(blobs);
        return blobs;
    }

    const seenEnemies = new Set();
    function syncEnemies(stepped, dt) {
        if (!tmpE) tmpE = new T3.Euler();
        const bm = blobMesh();
        let nb = 0;
        const gdt = dt * gameRate();
        for (const name in kinds) kinds[name].n = 0;
        seenEnemies.clear();
        const blob = (X, Z, size) => {
            if (nb >= 512) return;
            tmpV.set(X, 0.012, Z);
            tmpS.set(size, 1, size);
            tmpM.compose(tmpV, tmpQ.identity(), tmpS);
            bm.setMatrixAt(nb++, tmpM);
        };
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const art = Art.ENEMY_ART[e.name];
            if (!art) continue;
            const moved = trackEnemy(e, gdt);
            if (stepped) FX.status(e);
            seenEnemies.add(e);
            const K = kindOf(e.name);
            const info = K.info;
            let s = enemyState.get(e);
            if (!s) {
                s = { spawn: 0, flinch: 0, flinchV: 0, lastHit: 0, walk: Math.random() * TAU, roll: 0, prev: e._rot, seed: Math.random() * 50 };
                enemyState.set(e, s);
            }
            // Coming out of a portal: grow from nothing and drop in
            if (s.spawn < 1) s.spawn = Math.min(1, s.spawn + dt * 3.5);
            const grow = s.spawn < 1 ? 1 - Math.pow(1 - s.spawn, 3) : 1;
            // Hit: a springy flinch that tips it back
            if (e.hit > 0 && e.hit > s.lastHit) s.flinchV += art.boss ? 3 : 7;
            s.lastHit = e.hit || 0;
            s.flinchV += (-220 * s.flinch - 14 * s.flinchV) * Math.min(gdt, 0.033);
            s.flinch += s.flinchV * Math.min(gdt, 0.033);
            const fl = Math.max(-0.25, Math.min(0.25, s.flinch));
            // Walk: legs and treads keep pace with the ground covered
            if (info.stride) s.walk += moved / K.k / info.stride * TAU;
            // Fliers bank into turns
            if (gdt > 0) {
                const turn = angDiff(e._rot - s.prev) / gdt;
                const want = info.fly ? Math.max(-0.6, Math.min(0.6, -turn * 0.22)) : 0;
                s.roll += (want - s.roll) * damp(5, dt);
            }
            s.prev = e._rot;
            const X = e.pos.x / ts - Math.cos(e._rot) * fl * 0.1;
            const Z = e.pos.y / ts - Math.sin(e._rot) * fl * 0.1;
            let y = 0;
            let sx = 1, sy = 1, sz = 1;
            if (info.fly) y = info.fly * K.k + Math.sin(time * 2.6 + s.seed) * 0.025;
            if (info.hop) {
                const w = Math.sin(s.walk);
                sy = 1 + w * 0.1;
                sx = sz = 1 - w * 0.05;
            }
            if (info.bob) y += Math.abs(Math.sin(s.walk)) * info.bob * K.k;
            y = y * grow + (1 - grow) * 0.5;
            const yaw = info.spin ? time * 0.9 + s.seed : -e._rot;
            sx *= grow * (1 + fl * 0.3);
            sy *= grow * (1 - fl * 0.4);
            sz *= grow * (1 + fl * 0.3);
            // Slowed, poisoned, healing: a glow in that colour; a white flash when hit
            let er = 0, eg = 0, eb = 0;
            const efx = e.effects;
            for (let n = 0; n < efx.length; n++) {
                const nm = efx[n].name;
                if (nm === 'slow') { er += 0.03; eg += 0.18; eb += 0.45; }
                else if (nm === 'poison') { er += 0.06; eg += 0.35; eb += 0.03; }
                else if (nm === 'regen') { const w = 0.2 + 0.15 * Math.sin(time * 8); er += w; eg += w * 0.3; eb += w * 0.6; }
            }
            const hit = e.hit > 0 ? Math.min(1, e.hit / 6) : 0;
            er += hit * 0.5; eg += hit * 0.45; eb += hit * 0.4;
            // Arriving: a portal-coloured shimmer while it grows
            const arr = 1 - grow;
            er += arr * 0.8; eg += arr * 0.4; eb += arr * 1.6;
            putUnit(K, X, y, Z, yaw, fl * 0.7, s.roll, sx, sy, sz, er, eg, eb, 0, s.walk, s.seed, Math.min(1, e._spd / 2.5));
            blob(X, Z, art.r * 2 * (info.fly ? 0.85 : 1.15) * (art.boss ? 1.25 : 1) * grow * (info.fly ? 1 / (1 + y) : 1));
        }
        // Gone: killed ones fall, topple and burn away; ones that reached the gate vanish
        enemyState.forEach((s, e) => {
            if (seenEnemies.has(e)) return;
            enemyState.delete(e);
            if (e.health <= 0 && dying.length < 80) {
                const K = kindOf(e.name);
                dying.push({
                    K, x: e.pos.x / ts, z: e.pos.y / ts, yaw: K.info.spin ? time * 0.9 + s.seed : -e._rot,
                    y: K.info.fly ? K.info.fly * K.k : 0, vy: K.info.fly ? 0 : 1.2,
                    roll: s.roll, side: Math.random() < 0.5 ? -1 : 1, t: 0, walk: s.walk, seed: s.seed,
                    boss: !!K.art.boss, fly: !!K.info.fly
                });
            }
        });
        for (let i = dying.length - 1; i >= 0; i--) {
            const d = dying[i];
            d.t += gdt;
            // A little hop, then gravity; fliers drop out of the air and bounce once
            d.vy -= 9.8 * gdt;
            d.y += d.vy * gdt;
            if (d.y <= 0) {
                d.y = 0;
                d.vy = d.vy < -1.2 ? -d.vy * 0.3 : 0;
            }
            // Topple onto its side (bosses just sag), then burn away from the edges
            const tip = Math.min(1, d.t / 0.35);
            const roll = d.roll + d.side * tip * tip * (d.boss ? 0.2 : d.fly ? 0.9 : 1.15);
            const pitch = d.fly ? -tip * 0.5 : tip * 0.15;
            const dis = Math.max(0, Math.min(1, (d.t - 0.28) / 0.7));
            const w = d.t < 0.14 ? 1 - d.t / 0.14 : 0;
            const sink = dis * dis * 0.12 * d.K.k;
            putUnit(d.K, d.x, d.y - sink, d.z, d.yaw, pitch, roll, 1, 1, 1, w * 1.1, w * 1.0, w * 0.9, dis, d.walk, d.seed, 0);
            if (dis < 0.6) blob(d.x, d.z, d.K.art.r * 2 * (1 - dis));
            if (dis >= 1) dying.splice(i, 1);
        }
        for (const name in kinds) {
            const K = kinds[name];
            K.mesh.count = K.n;
            if (K.n) {
                K.mesh.instanceMatrix.needsUpdate = true;
                K.fx.needsUpdate = true;
                K.mv.needsUpdate = true;
            }
        }
        bm.count = nb;
        bm.instanceMatrix.needsUpdate = true;
    }

    // ---------- Effects in the scene: sparks, smoke, beams, rings, debris, embers ----------
    //
    // The game's FX module keeps its pools of particles, beams and rings (positions on
    // the ground, in game pixels). This view draws them in the WebGL scene as quads
    // that face the camera, so they sort with the models and glow through the bloom.
    // Heights come from where they start: at a barrel, a missile or an enemy.
    // On top of that, its own physics: chunks of debris that fly, bounce and settle,
    // embers that arc and fall, and wisps that rise from a killed enemy.

    let fxSprites = null;       // the game's sprite atlas (glows, smoke, rings) as a texture
    let fxS = null;             // sprite name -> uv rect
    const batches = {};
    const camR = new Float32Array(3);
    const camU = new Float32Array(3);
    const camP = new Float32Array(3);
    const GLOW = 2.4;           // additive colours go over 1 so the bloom picks them up

    function makeBatch(max, map, additive) {
        const g = new T3.BufferGeometry();
        const pos = new Float32Array(max * 12);
        const uv = new Float32Array(max * 8);
        const col = new Float32Array(max * 16);
        const idx = new Uint32Array(max * 6);
        for (let i = 0; i < max; i++) {
            const a = i * 4;
            idx.set([a, a + 1, a + 2, a, a + 2, a + 3], i * 6);
        }
        g.setIndex(new T3.BufferAttribute(idx, 1));
        g.setAttribute('position', new T3.BufferAttribute(pos, 3).setUsage(T3.DynamicDrawUsage));
        g.setAttribute('uv', new T3.BufferAttribute(uv, 2).setUsage(T3.DynamicDrawUsage));
        g.setAttribute('color', new T3.BufferAttribute(col, 4).setUsage(T3.DynamicDrawUsage));
        const mat = new T3.MeshBasicMaterial({
            map, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: T3.DoubleSide,
            blending: additive ? T3.AdditiveBlending : T3.NormalBlending
        });
        const mesh = new T3.Mesh(g, mat);
        mesh.frustumCulled = false;
        mesh.renderOrder = additive ? 6 : 5;
        dyn.add(mesh);
        return { mesh, g, pos, uv, col, n: 0, max };
    }

    function flushBatch(b) {
        b.g.setDrawRange(0, b.n * 6);
        b.g.attributes.position.needsUpdate = true;
        b.g.attributes.uv.needsUpdate = true;
        b.g.attributes.color.needsUpdate = true;
        b.n = 0;
    }

    // One quad: corners a b c d (counter-clockwise), uv rect, colour with alpha
    function quad(b, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0, v0, u1, v1, r, g, bl, a) {
        if (b.n >= b.max || a <= 0.003) return;
        const i = b.n++;
        const P = b.pos;
        const o = i * 12;
        P[o] = ax; P[o + 1] = ay; P[o + 2] = az;
        P[o + 3] = bx; P[o + 4] = by; P[o + 5] = bz;
        P[o + 6] = cx; P[o + 7] = cy; P[o + 8] = cz;
        P[o + 9] = dx; P[o + 10] = dy; P[o + 11] = dz;
        const U = b.uv;
        const q = i * 8;
        U[q] = u0; U[q + 1] = v0; U[q + 2] = u1; U[q + 3] = v0;
        U[q + 4] = u1; U[q + 5] = v1; U[q + 6] = u0; U[q + 7] = v1;
        const C = b.col;
        const k = i * 16;
        for (let j = 0; j < 4; j++) {
            C[k + j * 4] = r; C[k + j * 4 + 1] = g; C[k + j * 4 + 2] = bl; C[k + j * 4 + 3] = a;
        }
    }

    // A sprite from the atlas facing the camera, w tiles wide, turned by rot
    function billboard(b, name, x, y, z, w, rot, r, g, bl, a) {
        const s = fxS[name];
        if (!s) return;
        const hw = w / 2;
        const hh = hw * s.h / s.w;
        const c = Math.cos(rot);
        const n = Math.sin(rot);
        const rx = camR[0] * c + camU[0] * n, ry = camR[1] * c + camU[1] * n, rz = camR[2] * c + camU[2] * n;
        const ux = camU[0] * c - camR[0] * n, uy = camU[1] * c - camR[1] * n, uz = camU[2] * c - camR[2] * n;
        quad(b,
            x - rx * hw - ux * hh, y - ry * hw - uy * hh, z - rz * hw - uz * hh,
            x + rx * hw - ux * hh, y + ry * hw - uy * hh, z + rz * hw - uz * hh,
            x + rx * hw + ux * hh, y + ry * hw + uy * hh, z + rz * hw + uz * hh,
            x - rx * hw + ux * hh, y - ry * hw + uy * hh, z - rz * hw + uz * hh,
            s.u0, s.v0, s.u1, s.v1, r, g, bl, a);
    }

    // A strip from p to q, w tiles wide, turned to face the camera
    function ribbon(b, px, py, pz, qx, qy, qz, w, r, g, bl, a) {
        const dx = qx - px, dy = qy - py, dz = qz - pz;
        const vx = camP[0] - px, vy = camP[1] - py, vz = camP[2] - pz;
        let sx = dy * vz - dz * vy, sy = dz * vx - dx * vz, sz = dx * vy - dy * vx;
        const l = Math.hypot(sx, sy, sz) || 1;
        const k = w / 2 / l;
        sx *= k; sy *= k; sz *= k;
        quad(b, px - sx, py - sy, pz - sz, qx - sx, qy - sy, qz - sz, qx + sx, qy + sy, qz + sz, px + sx, py + sy, pz + sz,
            0, 0, 1, 1, r, g, bl, a);
    }

    // A sprite lying flat on the ground (blast rings)
    function flat(b, name, x, z, w, y, r, g, bl, a) {
        const s = fxS[name];
        if (!s) return;
        const h = w / 2;
        quad(b, x - h, y, z + h, x + h, y, z + h, x + h, y, z - h, x - h, y, z - h, s.u0, s.v0, s.u1, s.v1, r, g, bl, a);
    }

    function buildFx() {
        const A = Art.build(128);
        const W = A.atlas.width;
        const H = A.atlas.height;
        fxS = {};
        Object.entries(A.s).forEach(([k, s]) => {
            fxS[k] = { u0: s.x / W, u1: (s.x + s.w) / W, v0: 1 - (s.y + s.h) / H, v1: 1 - s.y / H, w: s.w, h: s.h };
        });
        fxSprites = new T3.CanvasTexture(A.atlas);
        fxSprites.colorSpace = T3.SRGBColorSpace;
        // A soft strip, bright in the middle, for beams and streaks
        const c = document.createElement('canvas');
        c.width = 4;
        c.height = 64;
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
        gr.addColorStop(0.5, 'rgba(255,255,255,1)');
        gr.addColorStop(0.65, 'rgba(255,255,255,0.55)');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 4, 64);
        const strip = new T3.CanvasTexture(c);
        batches.glow = makeBatch(1600, fxSprites, true);
        batches.smoke = makeBatch(700, fxSprites, false);
        batches.beam = makeBatch(500, strip, true);
        // Debris: little blocks that tumble, bounce and settle
        const box = new T3.BoxGeometry(1, 1, 1);
        debris.mesh = new T3.InstancedMesh(box, new T3.MeshStandardMaterial({ roughness: 0.7, metalness: 0.1 }), DEBRIS_MAX);
        debris.mesh.instanceMatrix.setUsage(T3.DynamicDrawUsage);
        debris.mesh.frustumCulled = false;
        debris.mesh.castShadow = false;
        debris.mesh.count = 0;
        for (let i = 0; i < DEBRIS_MAX; i++) debris.mesh.setColorAt(i, tmpC.set(0xffffff));
        dyn.add(debris.mesh);
    }

    // ---- Debris and embers (this view's own physics) ----
    const DEBRIS_MAX = 220;
    const debris = { mesh: null, list: [] };
    const embers = [];
    const EMBER_MAX = 400;

    function spawnDebris(x, y, z, n, colors, speed, size) {
        if (FX.quality === 0 || !FX.enabled) return;
        for (let i = 0; i < n; i++) {
            if (debris.list.length >= DEBRIS_MAX) debris.list.shift();
            const a = Math.random() * TAU;
            const v = speed * (0.4 + Math.random() * 0.6);
            debris.list.push({
                x, y, z, vx: Math.cos(a) * v, vy: speed * (1.2 + Math.random() * 1.4), vz: Math.sin(a) * v,
                rx: Math.random() * TAU, ry: Math.random() * TAU, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18,
                s: size * (0.5 + Math.random() * 0.7), life: 1.4 + Math.random() * 0.8, t: 0,
                color: colors[i % colors.length]
            });
        }
    }

    function spawnEmbers(x, y, z, n, color, speed, rise, size, life) {
        if (!FX.enabled) return;
        const c = new T3.Color(color);
        for (let i = 0; i < n; i++) {
            if (embers.length >= EMBER_MAX) embers.shift();
            const a = Math.random() * TAU;
            const v = speed * (0.3 + Math.random() * 0.7);
            embers.push({
                x, y, z, vx: Math.cos(a) * v, vy: rise * (0.5 + Math.random()), vz: Math.sin(a) * v,
                grav: rise > 0 && speed < 0.6 ? -0.4 : 6, r: c.r, g: c.g, b: c.b,
                s: size * (0.6 + Math.random() * 0.6), life: life * (0.6 + Math.random() * 0.6), t: 0
            });
        }
    }

    let dq = null;
    let de = null;
    function syncDebris(gdt) {
        if (!dq) {
            dq = new T3.Quaternion();
            de = new T3.Euler();
        }
        const L = debris.list;
        let n = 0;
        for (let i = L.length - 1; i >= 0; i--) {
            const d = L[i];
            d.t += gdt;
            if (d.t >= d.life) {
                L.splice(i, 1);
                continue;
            }
            d.vy -= 9.8 * gdt;
            d.x += d.vx * gdt;
            d.y += d.vy * gdt;
            d.z += d.vz * gdt;
            d.rx += d.wx * gdt;
            d.ry += d.wy * gdt;
            const floor = d.s * 0.5;
            if (d.y < floor) {
                d.y = floor;
                if (d.vy < -0.6) {
                    d.vy = -d.vy * 0.32;
                    d.vx *= 0.6;
                    d.vz *= 0.6;
                    d.wx *= 0.6;
                    d.wy *= 0.6;
                } else {
                    // resting: slide to a stop
                    d.vy = 0;
                    d.vx *= Math.max(0, 1 - gdt * 8);
                    d.vz *= Math.max(0, 1 - gdt * 8);
                    d.wx *= Math.max(0, 1 - gdt * 8);
                    d.wy *= Math.max(0, 1 - gdt * 8);
                }
            }
            const fade = Math.min(1, (d.life - d.t) / 0.4);
            de.set(d.rx, d.ry, 0);
            dq.setFromEuler(de);
            tmpV.set(d.x, d.y, d.z);
            tmpS.set(d.s * fade, d.s * fade, d.s * fade);
            tmpM.compose(tmpV, dq, tmpS);
            debris.mesh.setMatrixAt(n, tmpM);
            debris.mesh.setColorAt(n, tmpC.set(d.color));
            n++;
        }
        debris.mesh.count = n;
        debris.mesh.instanceMatrix.needsUpdate = true;
        if (debris.mesh.instanceColor) debris.mesh.instanceColor.needsUpdate = true;
    }

    // Height at which a new FX particle starts: a missile's, a barrel's, or an
    // enemy's middle; smoke and sparks then rise or arc from there
    function startHeight(px, py) {
        let best = 0.25;
        let h = 0.35;
        for (let i = 0; i < projectiles.length; i++) {
            const q = projectiles[i];
            const d = Math.hypot(q.pos.x - px, q.pos.y - py) / ts;
            if (d < best && q._h !== undefined) { best = d; h = q._h; }
        }
        if (best < 0.25) return h;
        best = 0.75;
        towerModels.forEach((m, t) => {
            const d = Math.hypot(t.pos.x - px, t.pos.y - py) / ts;
            if (d < best) { best = d; h = m.top * 0.85; }
        });
        return h;
    }

    function syncFx(gdt) {
        if (!fxS) buildFx();
        const e = camera.matrixWorld.elements;
        camR[0] = e[0]; camR[1] = e[1]; camR[2] = e[2];
        camU[0] = e[4]; camU[1] = e[5]; camU[2] = e[6];
        camP[0] = e[12]; camP[1] = e[13]; camP[2] = e[14];
        const G = batches.glow;
        const S = batches.smoke;
        const B = batches.beam;

        // The game's particles: sparks, glows, smoke (its debris rects are replaced by ours)
        const P = FX.particles;
        for (let i = 0; i < P.n; i++) {
            const p = P.items[i];
            if (p.color) continue;
            if (p._ll === undefined || p.life > p._ll) p._h3 = startHeight(p.x, p.y);
            p._ll = p.life;
            const f = 1 - p.life / p.max;
            const size = p.s0 + (p.s1 - p.s0) * f;
            if (size <= 0.01) continue;
            const smoke = p.sprite === 'smoke';
            const y = smoke ? p._h3 + f * 0.45 : Math.max(0.04, p._h3 + 0.5 * f - 0.9 * f * f);
            const a = Math.max(0, p.a0 * (1 - f));
            if (p.add) billboard(G, p.sprite, p.x / ts, y, p.y / ts, size, p.rot, GLOW, GLOW, GLOW, a);
            else billboard(S, p.sprite, p.x / ts, y, p.y / ts, size * 1.15, p.rot, 1, 1, 1, a * 0.85);
        }

        // Blast and pulse rings, flat on the ground
        const R = FX.rings;
        for (let i = 0; i < R.n; i++) {
            const r = R.items[i];
            const f = 1 - r.life / r.max;
            const rad = (r.r0 + (r.r1 - r.r0) * (1 - (1 - f) * (1 - f))) / ts;
            flat(G, r.sprite, r.x / ts, r.y / ts, rad / 0.43, 0.04, GLOW, GLOW, GLOW, Math.max(0, r.a0 * (1 - f)));
        }

        // Shots
        const BM = FX.beams;
        for (let i = 0; i < BM.n; i++) {
            const b = BM.items[i];
            const f = b.life / b.max;
            switch (b.kind) {
                case 'tracer': {
                    const p = 1 - (b.life - 1) / Math.max(1, b.max - 1);
                    muzzle3D(b.src, b.barrel, mz);
                    const ex = b.x2 / ts, ey = 0.32, ez = b.y2 / ts;
                    const hx = mz.x + (ex - mz.x) * p, hy = mz.y + (ey - mz.y) * p, hz = mz.z + (ez - mz.z) * p;
                    const tl = Math.min(p, 0.4);
                    const tx = hx - (ex - mz.x) * tl, ty = hy - (ey - mz.y) * tl, tz = hz - (ez - mz.z) * tl;
                    ribbon(B, tx, ty, tz, hx, hy, hz, 0.09 * b.w, 2.2, 1.5, 0.5, 0.9);
                    ribbon(B, tx, ty, tz, hx, hy, hz, 0.03 * b.w, 2.6, 2.5, 2.2, 1);
                    billboard(G, 'glow_yellow', hx, hy, hz, 0.14, 0, GLOW, GLOW, GLOW, 0.9);
                    break;
                }
                case 'laser':
                case 'emitter': {
                    const t = b.tower;
                    const en = b.target;
                    if (!t || !t.alive || !en || !en.alive) break;
                    muzzle3D(t, 0, mz);
                    const ex = en.pos.x / ts, ey = enemyHeight(en), ez = en.pos.y / ts;
                    const flick = 0.85 + 0.15 * Math.sin(time * 40 + i);
                    const laser = b.kind === 'laser';
                    const cr = laser ? 0.3 : 0.3, cg = laser ? 0.75 : 1.0, cb = laser ? 1.6 : 0.95;
                    ribbon(B, mz.x, mz.y, mz.z, ex, ey, ez, (laser ? 0.2 : 0.24) * b.w * flick, cr * GLOW, cg * GLOW, cb * GLOW, 0.75);
                    ribbon(B, mz.x, mz.y, mz.z, ex, ey, ez, 0.05 * b.w, 2.4, 2.6, 2.6, 1);
                    billboard(G, 'glow_cyan', mz.x, mz.y, mz.z, 0.28 * flick, 0, GLOW, GLOW, GLOW, 0.9);
                    billboard(G, laser ? 'glow_blue' : 'glow_cyan', ex, ey, ez, 0.5 * flick * b.w, time * 4, GLOW, GLOW, GLOW, 0.9);
                    break;
                }
                case 'snipe':
                case 'rail': {
                    muzzle3D(b.src, b.barrel, mz);
                    const ex = b.x2 / ts, ey = 0.32, ez = b.y2 / ts;
                    if (b.kind === 'snipe') {
                        ribbon(B, mz.x, mz.y, mz.z, ex, ey, ez, 0.16 * f, 2.4, 0.5, 0.4, 0.8 * f);
                        ribbon(B, mz.x, mz.y, mz.z, ex, ey, ez, 0.035, 2.6, 2.4, 2.3, f);
                    } else {
                        ribbon(B, mz.x, mz.y, mz.z, ex, ey, ez, 0.36 * f, 1.6, 0.6, 2.4, 0.8 * f);
                        ribbon(B, mz.x, mz.y, mz.z, ex, ey, ez, 0.07 * f, 2.6, 2.3, 2.6, f);
                        // sparkles along the rail
                        for (let j = 1; j < 6; j++) {
                            const u = (j + (1 - f) * 2) / 6 % 1;
                            billboard(G, 'glow_purple', mz.x + (ex - mz.x) * u, mz.y + (ey - mz.y) * u + Math.sin(j * 7) * 0.05, mz.z + (ez - mz.z) * u, 0.18 * f, 0, GLOW, GLOW, GLOW, f);
                        }
                    }
                    break;
                }
                case 'shell': {
                    const p = 1 - (b.life - 1) / Math.max(1, b.max - 1);
                    muzzle3D(b.src, b.barrel, mz);
                    const ex = b.x2 / ts, ez = b.y2 / ts;
                    const arc = (u) => Math.sin(u * Math.PI) * 1.0;
                    const x = mz.x + (ex - mz.x) * p, y = mz.y + (0.3 - mz.y) * p + arc(p), z = mz.z + (ez - mz.z) * p;
                    billboard(G, 'glow_orange', x, y, z, 0.42, 0, GLOW, GLOW, GLOW, 1);
                    billboard(G, 'glow_white', x, y, z, 0.16, 0, GLOW, GLOW, GLOW, 1);
                    // a short fiery trail behind it
                    for (let j = 1; j <= 4; j++) {
                        const u = Math.max(0, p - j * 0.05);
                        billboard(G, 'glow_orange', mz.x + (ex - mz.x) * u, mz.y + (0.3 - mz.y) * u + arc(u), mz.z + (ez - mz.z) * u, 0.3 - j * 0.05, 0, GLOW, GLOW, GLOW, 0.7 - j * 0.15);
                    }
                    break;
                }
                case 'bolt': {
                    const flick = (Math.random() < 0.25 ? 0.4 : 1) * f;
                    const pts = b.pts;
                    const n = pts.length - 1;
                    muzzle3D(b.src, 0, mz);
                    const x1 = mz.x, z1 = mz.z, h1 = mz.y;
                    const x2 = b.x2 / ts, z2 = b.y2 / ts;
                    const dx = x2 - x1, dz = z2 - z1;
                    const len = Math.hypot(dx, dz) || 1;
                    const sx = -dz / len, sz = dx / len;
                    const blue = b.w >= 1.5;
                    let px = x1, py = h1, pz = z1;
                    for (let j = 1; j <= n; j++) {
                        const u = j / n;
                        const o = pts[j] / ts * Math.min(1, len / 2);
                        const x = x1 + dx * u + sx * o, y = h1 * (1 - u) + 0.32 * u + o * 0.6, z = z1 + dz * u + sz * o;
                        ribbon(B, px, py, pz, x, y, z, 0.16 * b.w, blue ? 0.6 : 2.2, blue ? 2.2 : 2.0, blue ? 2.6 : 0.6, 0.6 * flick);
                        ribbon(B, px, py, pz, x, y, z, 0.045 * b.w, 2.6, 2.6, 2.4, flick);
                        px = x; py = y; pz = z;
                    }
                    billboard(G, blue ? 'glow_cyan' : 'glow_yellow', x1, h1, z1, 0.45 * flick, 0, GLOW, GLOW, GLOW, 1);
                    break;
                }
            }
        }

        // Embers and wisps
        for (let i = embers.length - 1; i >= 0; i--) {
            const m = embers[i];
            m.t += gdt;
            if (m.t >= m.life) {
                embers.splice(i, 1);
                continue;
            }
            m.vy -= m.grav * gdt;
            m.x += m.vx * gdt;
            m.y += m.vy * gdt;
            m.z += m.vz * gdt;
            if (m.y < 0.03) {
                m.y = 0.03;
                m.vy = -m.vy * 0.3;
                m.vx *= 0.5;
                m.vz *= 0.5;
            }
            const f = m.t / m.life;
            billboard(G, 'glow_white', m.x, m.y, m.z, m.s * (1 - f * 0.6), 0, m.r * GLOW, m.g * GLOW, m.b * GLOW, 1 - f);
        }

        flushBatch(G);
        flushBatch(S);
        flushBatch(B);
        syncDebris(gdt);
    }

    // ---------- Explosions: fireballs, shockwaves and light flashes ----------
    //
    // FX.blast and FX.death (the game's effect hooks) also start these. Pools of a
    // fixed size, and a fixed number of lights, so nothing is created while playing.

    const BLAST_COLORS = {
        rocket: [0xffb347, 0xff5a1f], silo: [0x9ff3ff, 0x2a8cff], bomb: [0xe0b0ff, 0x8a3dff],
        cluster: [0xffc46b, 0xff6a1a], sub: [0xffc46b, 0xff6a1a], rail: [0xf0b8ff, 0xa04dff]
    };
    const blastPool = [];
    const FX2 = {};                     // the game's own FX functions this view wraps
    const lights = [];
    let lightNext = 0;
    function buildBlasts() {
        const ballGeo = new T3.IcosahedronGeometry(1, 2);
        const ringGeo = new T3.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
        const glowMat = (c) => new T3.MeshBasicMaterial({ color: c, transparent: true, blending: T3.AdditiveBlending, depthWrite: false, toneMapped: false, side: T3.DoubleSide });
        for (let i = 0; i < 24; i++) {
            const core = new T3.Mesh(ballGeo, glowMat(0xffffff));
            const shell = new T3.Mesh(ballGeo, glowMat(0xff8a3a));
            const ring = new T3.Mesh(ringGeo, glowMat(0xffd08a));
            const smoke = new T3.Mesh(ballGeo, new T3.MeshLambertMaterial({ color: 0x3a3a40, transparent: true, depthWrite: false }));
            [core, shell, ring, smoke].forEach(m => { m.visible = false; m.renderOrder = 4; dyn.add(m); });
            blastPool.push({ core, shell, ring, smoke, t: 0, life: 1, r: 1, x: 0, z: 0, death: false, on: false });
        }
        for (let i = 0; i < 3; i++) {
            const l = new T3.PointLight(0xff9a40, 0, 4, 1.6);
            l.position.y = 0.8;
            scene.add(l);
            lights.push(l);
        }
        const blast = FX.blast;
        FX.blast = (x, y, kind, radiusTiles = 1) => {
            const out = blast(x, y, kind, radiusTiles);
            if (Renderer.view === '3d') {
                startBlast(x / ts, y / ts, kind, radiusTiles, false);
                const X = x / ts, Z = y / ts;
                const th = Terrain.THEMES[theme] || Terrain.THEMES.meadow;
                spawnDebris(X, 0.15, Z, 5 + Math.round(radiusTiles * 2), [th.ground[0], th.speck, th.road || '#7a6a55'], 1.6, 0.09);
                const c = (BLAST_COLORS[kind] || BLAST_COLORS.rocket)[1];
                spawnEmbers(X, 0.3, Z, 10 + Math.round(radiusTiles * 4), c, 2.2, 2.6, 0.12, 0.8);
            }
            return out;
        };
        FX2.muzzle = FX.muzzle;
        FX.muzzle = (t, i = 0) => {
            if (Renderer.view !== '3d' || !towerModels.get(t)) return FX2.muzzle(t, i);
            muzzle3D(t, i, mz);
            return { x: mz.x * ts, y: mz.z * ts };
        };
        const death = FX.death;
        FX.death = (e) => {
            const out = death(e);
            if (Renderer.view === '3d') {
                const art = Art.ENEMY_ART[e.name];
                startBlast(e.pos.x / ts, e.pos.y / ts, 'death', art ? art.r * (art.boss ? 2.4 : 1.4) : 0.4, true, art && art.color);
                const X = e.pos.x / ts, Z = e.pos.y / ts;
                const col = art ? art.color : '#cccccc';
                const dark = '#' + new T3.Color(col).multiplyScalar(0.5).getHexString();
                spawnDebris(X, 0.3, Z, art && art.boss ? 14 : 6, [col, dark, col], art && art.boss ? 2.2 : 1.5, art && art.boss ? 0.12 : 0.07);
                // wisps that drift up and fade
                spawnEmbers(X, 0.35, Z, art && art.boss ? 16 : 6, col, 0.35, 1.1, 0.16, 1.1);
            }
            return out;
        };
    }

    function startBlast(x, z, kind, radius, isDeath, color) {
        let b = blastPool.find(q => !q.on);
        if (!b) b = blastPool.reduce((a, q) => (q.t / q.life > a.t / a.life ? q : a));
        b.on = true;
        b.t = 0;
        b.death = isDeath;
        b.life = isDeath ? 0.45 : 0.7;
        b.r = isDeath ? radius : Math.max(0.6, radius * 0.7);
        b.x = x;
        b.z = z;
        const [c1, c2] = kind === 'dust' ? [0x6b6152, new T3.Color(color).getHex()] : isDeath ? [0xffffff, new T3.Color(color || '#ffffff').getHex()] : (BLAST_COLORS[kind] || BLAST_COLORS.rocket);
        b.kind = kind;
        // Brighter than white so the bloom catches them (dust stays dull)
        const hot = kind === 'dust' ? 1 : 2.8;
        b.core.material.color.setHex(c1).multiplyScalar(hot);
        b.shell.material.color.setHex(c2).multiplyScalar(hot * 0.8);
        b.ring.material.color.setHex(isDeath ? c2 : c1).multiplyScalar(hot * 0.7);
        [b.core, b.shell, b.ring].forEach(m => { m.visible = true; });
        b.smoke.visible = !isDeath && FX.quality > 0;
        if (!isDeath && FX.quality > 0) {
            const l = lights[lightNext++ % lights.length];
            l.color.setHex(c2);
            l.position.set(x, 0.9, z);
            l.userData.t = 0;
            l.userData.peak = 5 + radius * 3;
            l.distance = 2.5 + radius * 2.5;
        }
    }

    function syncBlasts(dt) {
        for (const b of blastPool) {
            if (!b.on) continue;
            b.t += dt;
            const f = b.t / b.life;
            if (f >= 1) {
                b.on = false;
                [b.core, b.shell, b.ring, b.smoke].forEach(m => { m.visible = false; });
                continue;
            }
            const ease = 1 - (1 - f) * (1 - f);
            const h = b.death ? 0.35 : 0.3;
            // A hot core that shrinks fast, a coloured shell that swells and fades
            const cs = b.r * 0.55 * Math.max(0, 1 - f * 2.2) + 0.02;
            b.core.position.set(b.x, h, b.z);
            b.core.scale.setScalar(cs);
            b.core.material.opacity = Math.max(0, 1 - f * 2) * (b.kind === 'dust' ? 0.25 : 1);
            const ss = b.r * (0.35 + ease * 0.75);
            b.shell.position.set(b.x, h + f * 0.25, b.z);
            b.shell.scale.set(ss, ss * 0.8, ss);
            b.shell.material.opacity = 0.75 * (1 - f) * (1 - f) * (b.kind === 'dust' ? 0.4 : 1);
            // The shockwave runs along the ground
            const rs = b.r * (0.3 + ease * (b.death ? 0.9 : 1.3));
            b.ring.position.set(b.x, 0.03, b.z);
            b.ring.scale.set(rs, 1, rs);
            b.ring.material.opacity = 0.85 * (1 - f);
            if (b.smoke.visible) {
                const sm = b.r * (0.4 + ease * 0.6);
                b.smoke.position.set(b.x, h + 0.2 + f * 0.6, b.z);
                b.smoke.scale.set(sm, sm * 0.7, sm);
                b.smoke.material.opacity = 0.45 * Math.min(1, f * 3) * (1 - f);
            }
        }
        for (const l of lights) {
            if (l.userData.t === undefined) continue;
            l.userData.t += dt;
            l.intensity = Math.max(0, l.userData.peak * (1 - l.userData.t / 0.35));
        }
    }

    // ---------- Missiles, route arrows, portals, gate, ranges ----------

    let missiles = null;
    let routeMesh = null;
    let routeGold = null;
    let selRing = null;
    let rangeFill = null;
    let rangeLine = null;
    let upLine = null;
    let placeTile = null;
    let placeCross = null;
    let gate = null;
    const portalObjs = [];
    let portalsKey = '';

    function dashedRing(segments = 56, inner = 0.965) {
        const pos = [];
        for (let i = 0; i < segments; i++) {
            const a0 = i / segments * TAU;
            const a1 = (i + 0.55) / segments * TAU;
            const p = (a, r) => [Math.cos(a) * r, 0, Math.sin(a) * r];
            const A = p(a0, inner), B = p(a0, 1), C = p(a1, 1), D = p(a1, inner);
            pos.push(...A, ...D, ...C, ...A, ...C, ...B);
        }
        const g = new T3.BufferGeometry();
        g.setAttribute('position', new T3.Float32BufferAttribute(pos, 3));
        return g;
    }

    function basic(color, opacity, add = false) {
        const m = new T3.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, side: T3.DoubleSide });
        if (add) m.blending = T3.AdditiveBlending;
        return m;
    }

    function buildDynamic() {
        missiles = null;
        // Route arrows
        const sh = new T3.Shape();
        const pts = [-0.15, -0.22, 0.09, 0, -0.15, 0.22, -0.04, 0.22, 0.2, 0, -0.04, -0.22];
        sh.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) sh.lineTo(pts[i], pts[i + 1]);
        const cg = new T3.ShapeGeometry(sh).rotateX(Math.PI / 2);
        const mkRoute = (c) => {
            const m = new T3.InstancedMesh(cg, basic(c, 1, true), 1);
            m.frustumCulled = false;
            m.count = 0;
            m.renderOrder = 2;
            dyn.add(m);
            return m;
        };
        routeMesh = mkRoute(0xffffff);
        routeGold = mkRoute(0xffd23f);
        // Selection ring, range circle, upgrade range, placement tile and cross
        selRing = new T3.Mesh(new T3.RingGeometry(0.55, 0.63, 48).rotateX(-Math.PI / 2), basic(0xfacc15, 0.95));
        selRing.visible = false;
        selRing.renderOrder = 3;
        dyn.add(selRing);
        rangeFill = new T3.Mesh(new T3.CircleGeometry(1, 64).rotateX(-Math.PI / 2), basic(0xffffff, 0.12));
        rangeFill.visible = false;
        rangeFill.renderOrder = 1;
        dyn.add(rangeFill);
        rangeLine = new T3.Mesh(dashedRing(), basic(0xffffff, 0.85));
        rangeLine.visible = false;
        rangeLine.renderOrder = 2;
        dyn.add(rangeLine);
        upLine = new T3.Mesh(dashedRing(64, 0.955), basic(0x4ade80, 0.95));
        upLine.visible = false;
        upLine.renderOrder = 2;
        dyn.add(upLine);
        placeTile = new T3.Mesh(new T3.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2), basic(0x4ade80, 0.35));
        placeTile.visible = false;
        placeTile.renderOrder = 2;
        dyn.add(placeTile);
        const cross = new T3.Group();
        [Math.PI / 4, -Math.PI / 4].forEach(a => {
            const b = new T3.Mesh(new T3.BoxGeometry(0.6, 0.06, 0.1), basic(0xf87171, 0.95));
            b.rotation.y = a;
            cross.add(b);
        });
        cross.visible = false;
        placeCross = cross;
        dyn.add(cross);
    }

    // Height at which the next kit tower part sits on this one (tops hold at their floor)
    function partHeight(name) {
        const box = new T3.Box3().setFromObject(kitRoots[name]);
        return /top/.test(name) ? 0.2 : box.max.y;
    }

    function buildGate() {
        if (gate) dyn.remove(gate.root);
        const root = new T3.Group();
        const gold = accentMat('#facc15');
        const keep = new T3.Group();
        keep.scale.set(0.8, 0.72, 0.8);
        let y = 0;
        ['tower-square-bottom-b', 'tower-square-middle-a', 'tower-square-top-a'].forEach(part => {
            const o = kitClone(part, gold);
            o.position.y = y;
            keep.add(o);
            y += partHeight(part);
        });
        root.add(keep);
        const crystalMat = new T3.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.1, flatShading: true });
        crystalMat._own = true;
        const crystal = new T3.Mesh(new T3.OctahedronGeometry(0.15, 0), crystalMat);
        crystal.scale.set(1, 1.6, 1);
        crystal.castShadow = true;
        const top = y * 0.72 + 0.25;
        crystal.position.y = top;
        root.add(crystal);
        const glow = glowSprite(0xffe066, 1.6, 0.6);
        glow.position.y = top;
        root.add(glow);
        dyn.add(root);
        gate = { root, crystal, glow, mat: crystalMat, top };
    }

    function syncGate() {
        if (!gate || !exit) return;
        gate.root.position.set(exit.x + 0.5, 0, exit.y + 0.5);
        gate.crystal.rotation.y = time * 1.2;
        gate.crystal.position.y = gate.top + Math.sin(time * 2) * 0.05;
        const hit = FX.gateHit > 0 ? FX.gateHit / 24 : 0;
        gate.mat.emissive.setRGB(0.98, 0.8 * (1 - hit) + 0.2 * hit, 0.08 * (1 - hit) + 0.2 * hit);
        gate.mat.color.copy(gate.mat.emissive);
        gate.glow.material.color.setRGB(1, 0.88 - hit * 0.6, 0.4 - hit * 0.3);
        const s = 1.4 + 0.15 * Math.sin(time * 3) + hit * 1.2;
        gate.glow.scale.set(s, s, 1);
    }

    function portalObj() {
        const root = new T3.Group();
        const ringM = mat('#7c4dff', { emissive: new T3.Color('#7c4dff'), ei: 1.8, rough: 0.3 });
        const ring = new T3.Mesh(new T3.TorusGeometry(0.36, 0.055, 8, 32), ringM);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.06;
        root.add(ring);
        const ring2 = new T3.Mesh(new T3.TorusGeometry(0.24, 0.03, 6, 28), mat('#c38bff', { emissive: new T3.Color('#c38bff'), ei: 1.6 }));
        ring2.rotation.x = Math.PI / 2;
        ring2.position.y = 0.1;
        root.add(ring2);
        const core = new T3.Mesh(new T3.CircleGeometry(0.34, 32).rotateX(-Math.PI / 2), basic(0x2a1460, 0.95));
        core.position.y = 0.02;
        root.add(core);
        // Light column
        const colG = new T3.CylinderGeometry(0.3, 0.34, 1.1, 24, 1, true);
        colG.translate(0, 0.55, 0);
        const colM = new T3.MeshBasicMaterial({ color: 0x9a6bff, transparent: true, opacity: 0.22, blending: T3.AdditiveBlending, depthWrite: false, side: T3.DoubleSide, toneMapped: false });
        colM._own = true;
        // fade towards the top
        const cnv = document.createElement('canvas');
        cnv.width = 4;
        cnv.height = 64;
        const g = cnv.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 64);
        gr.addColorStop(0, 'rgba(255,255,255,0)');
        gr.addColorStop(1, 'rgba(255,255,255,1)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 4, 64);
        colM.alphaMap = new T3.CanvasTexture(cnv);
        const column = new T3.Mesh(colG, colM);
        root.add(column);
        const glow = glowSprite(0x9a6bff, 1.3, 0.55);
        glow.position.y = 0.25;
        root.add(glow);
        dyn.add(root);
        return { root, ring, ring2, column, glow };
    }

    function syncPortals() {
        const list = spawnpoints.map(s => [s.x, s.y, 1]).concat(tempSpawns.map(([s]) => [s.x, s.y, 0.75]));
        while (portalObjs.length < list.length) portalObjs.push(portalObj());
        portalObjs.forEach((p, i) => {
            const it = list[i];
            p.root.visible = !!it;
            if (!it) return;
            p.root.position.set(it[0] + 0.5, 0, it[1] + 0.5);
            p.root.scale.setScalar(it[2]);
            p.ring.rotation.z = time * 1.4 + i;
            p.ring2.rotation.z = -time * 2.2 - i;
            p.column.material.opacity = 0.16 + 0.08 * Math.sin(time * 3 + i);
            const s = 1.1 + 0.12 * Math.sin(time * 4 + i);
            p.glow.scale.set(s, s, 1);
        });
    }

    function makeMissiles() {
        if (!missiles) {
            missiles = [['weapon-ammo-bullet', '#e0313b'], ['weapon-ammo-cannonball', '#3d7fe0']].map(([name, c]) => {
                const parts = kit[name] || [];
                return parts.map(p => {
                    const mesh = new T3.InstancedMesh(p.geo, accentMat(c), 64);
                    mesh.instanceMatrix.setUsage(T3.DynamicDrawUsage);
                    mesh.castShadow = true;
                    mesh.frustumCulled = false;
                    mesh.count = 0;
                    dyn.add(mesh);
                    return { mesh, m: p.m };
                });
            });
        }
    }

    function syncMissiles(gdt) {
        makeMissiles();
        const n = [0, 0];
        const q = new T3.Quaternion();
        const e = new T3.Euler();
        const p3 = new T3.Vector3();
        const one = new T3.Vector3(1.3, 1.3, 1.3);
        for (let i = 0; i < projectiles.length; i++) {
            const p = projectiles[i];
            if (!p.alive) continue;
            const k = p.blastRadius > 1 ? 1 : 0;
            if (n[k] >= 64) continue;
            if (p._h === undefined) {
                // New missile: start it at the barrel of the tower it came out of
                let src = null;
                let best = ts * 0.6;
                for (let j = 0; j < towers.length; j++) {
                    const d = Math.hypot(towers[j].pos.x - p.pos.x, towers[j].pos.y - p.pos.y);
                    if (d < best) { best = d; src = towers[j]; }
                }
                muzzle3D(src, src ? src._barrel || 0 : 0, mz);
                p._ox = src ? mz.x - p.pos.x / ts : 0;
                p._oz = src ? mz.z - p.pos.y / ts : 0;
                p._h = src ? mz.y : FX_H;
            }
            // ...then ease onto its flight path
            const ease = damp(6, gdt);
            p._ox -= p._ox * ease;
            p._oz -= p._oz * ease;
            p._h += (FX_H - p._h) * ease;
            const pitch = (FX_H - p._h) * 1.5;
            e.set(0, yawFor(Math.atan2(p.vel.y, p.vel.x)), 0);
            q.setFromEuler(e);
            void pitch;
            p3.set(p.pos.x / ts + p._ox, p._h, p.pos.y / ts + p._oz);
            tmpM.compose(p3, q, one);
            const j = n[k]++;
            missiles[k].forEach(part => part.mesh.setMatrixAt(j, tmpM2.multiplyMatrices(tmpM, part.m)));
        }
        missiles.forEach((parts, k) => parts.forEach(part => {
            part.mesh.count = n[k];
            part.mesh.instanceMatrix.needsUpdate = true;
        }));
    }

    // Route arrows, with the preview of the new way while placing on open ground
    let routeKey = '';
    let route = null;
    let previewKey = '';
    let previewRoute = null;
    const DIR_ANGLE = [0, Math.PI, -Math.PI / 2, 0, Math.PI / 2];
    const DX = [0, -1, 0, 1, 0];
    const DY = [0, 0, -1, 0, 1];

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
        for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) if (grid[x][y] === 2) dir[x * rows + y] = paths[x][y] || 0;
        return (x, y) => dir[x * rows + y];
    }

    function syncRoute() {
        const key = `${pathVersion}|${tempSpawns.length}|${cols}x${rows}`;
        if (key !== routeKey) {
            routeKey = key;
            route = traceRoute((x, y) => paths[x][y]);
        }
        const strong = !started || toPlace;
        let r = route;
        let gold = false;
        const p = toPlace ? placementTile() : null;
        if (p && grid[p.x][p.y] === 0 && !placeReasonCached(p.x, p.y)) {
            const k = `${p.x},${p.y},${pathVersion}`;
            if (k !== previewKey) {
                previewKey = k;
                previewRoute = traceRoute(flowWithBlock(p.x, p.y));
            }
            r = previewRoute;
            gold = true;
        }
        const mesh = gold ? routeGold : routeMesh;
        (gold ? routeMesh : routeGold).count = 0;
        if (!r || !r.n || (FX.quality === 0 && !strong)) {
            mesh.count = 0;
            return;
        }
        if (mesh.instanceMatrix.count < r.n) {
            const m2 = new T3.InstancedMesh(mesh.geometry, mesh.material, Math.max(r.n, cols * rows));
            m2.frustumCulled = false;
            m2.renderOrder = 2;
            dyn.remove(mesh);
            dyn.add(m2);
            if (gold) routeGold = m2; else routeMesh = m2;
            return syncRoute();
        }
        const tt = time * 6;
        const baseA = gold ? 0.75 : strong ? 0.26 : 0.12;
        const amp = gold ? 0.3 : strong ? 0.5 : 0.25;
        let n = 0;
        const q = new T3.Quaternion();
        const up = new T3.Vector3(0, 1, 0);
        const sc = new T3.Vector3(0.9, 1, 0.9);
        for (let j = 0; j < r.n; j++) {
            const ph = ((r.i[j] - tt) % 8 + 8) % 8;
            const a = Math.min(1, baseA + amp * Math.max(0, 1 - ph / 3));
            if (a < 0.06) continue;
            q.setFromAxisAngle(up, -r.a[j]);
            tmpV.set(r.x[j] + 0.5, 0.02, r.y[j] + 0.5);
            tmpM.compose(tmpV, q, sc);
            mesh.setMatrixAt(n, tmpM);
            mesh.setColorAt(n, tmpC.setRGB(a, a, a));
            n++;
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // Selection, ranges and the tower being placed
    let ghostModel = null;
    let brackets = null;
    function syncOverlays3D() {
        const sel = selected && !toPlace && selected.alive ? selected : null;
        if (!brackets && kit) {
            brackets = kitClone('selection-a', kitMat('base'));
            brackets.traverse(o => { o.castShadow = false; });
            dyn.add(brackets);
            selRing.visible = false;
        }
        const mark = brackets || selRing;
        mark.visible = !!sel;
        rangeFill.visible = rangeLine.visible = false;
        upLine.visible = false;
        if (sel) {
            const X = sel.pos.x / ts;
            const Z = sel.pos.y / ts;
            const s = (brackets ? 1.08 : 1) + 0.06 * Math.sin(time * 5);
            const gy = groundY && groundY[sel.gridPos.x] ? groundY[sel.gridPos.x][sel.gridPos.y] : 0;
            mark.position.set(X, gy + 0.02, Z);
            mark.scale.set(s, 1, s);
            showRange(X, Z, sel.range + 1, sel.color, true);
            if (upgradeRange && upgradeRange !== sel.range) {
                upLine.visible = true;
                upLine.position.set(X, 0.04, Z);
                upLine.scale.setScalar(upgradeRange + 1);
            }
        }
        // Placement
        const p = placementTile();
        const key = p ? `${p.x},${p.y},${towerType}` : '';
        if (key !== lastPlaceKey) {
            lastPlaceKey = key;
            updatePlaceStatus();
        }
        placeTile.visible = placeCross.visible = false;
        const wantGhost = p && towerType;
        if (ghostModel && (!wantGhost || ghostModel.name !== towerType)) {
            dyn.remove(ghostModel.root);
            ghostModel = null;
        }
        if (!p) return;
        const tpl = tower[towerType];
        const reason = placeReasonCached(p.x, p.y);
        const afford = godMode || cash >= tpl.cost;
        const ok = !reason;
        const X = p.x + 0.5;
        const Z = p.y + 0.5;
        const lift = grid[p.x][p.y] === 1 && wallH ? wallH[p.x][p.y] : 0;
        showRange(X, Z, (tpl.range || 3) + 1, tpl.color, ok && afford);
        placeTile.visible = true;
        placeTile.position.set(X, lift + 0.025, Z);
        placeTile.material.color.set(ok && afford ? 0x4ade80 : 0xf87171);
        placeTile.material.opacity = ghost ? 0.5 : 0.32;
        if (ok && load.towersReady) {
            if (!ghostModel) {
                ghostModel = makeModel({ name: towerType, angle: -Math.PI / 2 }, true);
                dyn.add(ghostModel.root);
            }
            ghostModel.root.position.set(X, 0, Z);
            if (ghostModel.gun) ghostModel.gun.rotation.y = (ghostModel.aim ? ghostModel.aim.f0 + Math.PI / 2 : time) + Math.sin(time * 1.5) * 0.4;
            ghostModel.root.traverse(o => { if (o.isMesh) o.material.opacity = afford ? 0.7 : 0.35; });
        } else if (!ok) {
            if (ghostModel) {
                dyn.remove(ghostModel.root);
                ghostModel = null;
            }
            placeCross.visible = true;
            placeCross.position.set(X, lift + 0.08, Z);
        }
    }

    function showRange(X, Z, r, color, ok) {
        rangeFill.visible = rangeLine.visible = true;
        rangeFill.position.set(X, 0.012, Z);
        rangeFill.scale.setScalar(r);
        rangeLine.position.set(X, 0.016, Z);
        rangeLine.scale.setScalar(r);
        rangeLine.rotation.y = time * 0.25;
        if (ok) rangeFill.material.color.setRGB(color[0] / 255, color[1] / 255, color[2] / 255);
        else rangeFill.material.color.set(0xf87171);
        rangeFill.material.opacity = ok ? 0.13 : 0.16;
        rangeLine.material.color.set(ok ? 0xffffff : 0xf87171);
    }

    // ---------- Overlay (2D, projected) ----------

    function enemyHeight(e) {
        const art = Art.ENEMY_ART[e.name];
        return (art ? art.r : 0.3) * 0.85;
    }

    function drawOverlay() {
        const W = overlay.width;
        const H = overlay.height;
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.globalAlpha = 1;
        octx.globalCompositeOperation = 'source-over';
        octx.clearRect(0, 0, W, H);
        if (healthBar) drawBars();
        drawTag();
        drawFloaters();
        drawVignette();
        octx.globalAlpha = 1;
        octx.globalCompositeOperation = 'source-over';
    }

    function drawBars() {
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const art = Art.ENEMY_ART[e.name];
            const left = Math.max(0, e.health / e.maxHealth);
            const boss = art && art.boss;
            if (left >= 1 && !boss) continue;
            const r = art ? art.r : 0.3;
            const c = proj(e.pos.x / ts, r * 1.75 + 0.12, e.pos.y / ts);
            const w = Math.min(boss ? 84 : 56, Math.max(c.k * 0.7, c.k * r * 2) * (boss ? 1.35 : 1));
            const h = Math.min(boss ? 9 : 7, Math.max(3, c.k * 0.09) * (boss ? 1.4 : 1));
            const x = c.x - w / 2;
            const y = c.y - h;
            const pad = Math.max(1, c.k * 0.025);
            octx.fillStyle = 'rgba(9,9,11,0.85)';
            octx.fillRect((x - pad) * dpr, (y - pad) * dpr, (w + pad * 2) * dpr, (h + pad * 2) * dpr);
            octx.fillStyle = left > 0.6 ? '#4ade80' : left > 0.3 ? '#facc15' : '#f87171';
            octx.fillRect(x * dpr, y * dpr, w * left * dpr, h * dpr);
        }
    }

    function drawTag() {
        const p = placementTile();
        if (!p) return;
        const tpl = tower[towerType];
        const afford = godMode || cash >= tpl.cost;
        const c = proj(p.x + 0.5, 1.15, p.y + 0.5);
        const size = Math.max(12, Math.min(17, c.k * 0.42));
        octx.font = `700 ${size * dpr}px "Chakra Petch", system-ui, sans-serif`;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        const label = `$${tpl.cost}`;
        const w = octx.measureText(label).width / dpr + size * 0.9;
        const h = size * 1.5;
        let ty = c.y - h / 2;
        if (ty - h / 2 < 2) ty = proj(p.x + 0.5, 0, p.y + 1.2).y + h / 2;
        const tx = Math.max(w / 2 + 2, Math.min(cssW - w / 2 - 2, c.x));
        octx.fillStyle = 'rgba(9,9,11,0.9)';
        octx.beginPath();
        if (octx.roundRect) octx.roundRect((tx - w / 2) * dpr, (ty - h / 2) * dpr, w * dpr, h * dpr, h / 4 * dpr);
        else octx.rect((tx - w / 2) * dpr, (ty - h / 2) * dpr, w * dpr, h * dpr);
        octx.fill();
        octx.strokeStyle = afford ? 'rgba(250,204,21,0.7)' : 'rgba(248,113,113,0.7)';
        octx.lineWidth = dpr;
        octx.stroke();
        octx.fillStyle = afford ? '#facc15' : '#f87171';
        octx.fillText(label, tx * dpr, (ty + size * 0.05) * dpr);
    }

    function drawFloaters() {
        if (!floaters.length) return;
        octx.textAlign = 'center';
        octx.textBaseline = 'middle';
        octx.lineJoin = 'round';
        octx.strokeStyle = '#09090b';
        const cap = FX.quality === 0 ? 30 : FX.quality === 1 ? 60 : 120;
        const from = Math.max(0, floaters.length - cap);
        let lastSize = 0;
        for (let i = from; i < floaters.length; i++) {
            const f = floaters[i];
            const c = proj(f.x / ts, 0.9, f.y / ts);
            const size = Math.round(Math.max(11, Math.min(20, c.k * 0.42)) * f.size * dpr);
            if (size !== lastSize) {
                octx.font = `700 ${size}px "Chakra Petch", system-ui, sans-serif`;
                octx.lineWidth = size * 0.28;
                lastSize = size;
            }
            octx.globalAlpha = Math.min(1, f.life / 20);
            octx.fillStyle = f.css || (f.css = `rgb(${f.color[0]},${f.color[1]},${f.color[2]})`);
            octx.strokeText(f.text, c.x * dpr, c.y * dpr);
            octx.fillText(f.text, c.x * dpr, c.y * dpr);
        }
        octx.globalAlpha = 1;
    }

    let vignette = null;
    let hurtVignette = null;
    function radial(inner, outer) {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(128, 128, 80, 128, 128, 182);
        grad.addColorStop(0, inner);
        grad.addColorStop(1, outer);
        g.fillStyle = grad;
        g.fillRect(0, 0, 256, 256);
        return c;
    }
    function drawVignette() {
        if (!vignette) {
            vignette = radial('rgba(0,0,0,0)', 'rgba(0,0,0,0.32)');
            hurtVignette = radial('rgba(248,113,113,0)', 'rgba(248,80,80,0.75)');
        }
        const W = overlay.width;
        const H = overlay.height;
        if (FX.quality > 0) octx.drawImage(vignette, 0, 0, W, H);
        let a = hurt > 0 ? hurt / 24 : 0;
        if (!gameOver && health > 0 && health <= maxHealth * 0.25) a = Math.max(a, 0.18 + 0.12 * Math.sin(time * 4));
        if (a > 0) {
            octx.globalAlpha = Math.min(1, a);
            octx.drawImage(hurtVignette, 0, 0, W, H);
            octx.globalAlpha = 1;
        }
    }

    // ---------- Frame ----------

    function mapView() {
        return {
            cols, rows, grid, display,
            spawnpoints: spawnpoints.map(s => [s.x, s.y]),
            exit: [exit.x, exit.y]
        };
    }

    let terrainStamp = '';
    function frame(stepped) {
        const now = performance.now();
        const dt = Math.min(100, now - last);
        last = now;
        time += dt / 1000;
        Units3D.uTime.value = time;
        trackQuality(dt);
        if (!inited || !cols) return;
        if (kitFailed) {
            Renderer.fallback(kitError);
            return;
        }
        if (!kit) {
            showLoading();
            gl.render(scene, camera);
            return;
        }
        // A changed grid (editor, imported map) means a new world
        const stamp = `${theme}|${cols}x${rows}|${typeof mapStamp === 'undefined' ? '' : mapStamp}`;
        if (!world || mapKey === '' || stamp !== terrainStamp) {
            terrainStamp = stamp;
            try {
                buildWorld();
            } catch (e) {
                // Something the 3D view needs is missing: the flat view always works
                console.warn('3D view failed, using Flat:', e);
                kitFailed = true;
                Renderer.fallback(String(e && e.message || e).slice(0, 80));
                return;
            }
            refit();
        }
        FX.frame(stepped);
        drawCalls = 0;

        // Shake moves the picture only (CSS), never what the pointer hits
        const sh = FX.shakeOffset(now);
        shakeX = sh.x;
        shakeY = sh.y;
        const tr = sh.x || sh.y ? `translate(${sh.x}px,${sh.y}px)` : '';
        if (canvas.style.transform !== tr) {
            canvas.style.transform = tr;
            overlay.style.transform = tr;
        }

        swayProps();
        syncTowers(dt / 1000);
        syncEnemies(stepped, dt / 1000);
        syncMissiles(dt / 1000 * gameRate());
        syncBlasts(stepped ? dt / 1000 * (typeof speed === 'number' ? speed : 1) : 0);
        syncFx(dt / 1000 * gameRate());
        syncPortals();
        syncGate();
        syncRoute();
        syncOverlays3D();
        updateVP();
        gl.info.reset();
        if (bloomOn()) composer.render();
        else gl.render(scene, camera);
        drawCalls += gl.info.render.calls;
        drawOverlay();
        fadeTip();

        perf.lastFrameMs = performance.now() - now;
        perf.renderAcc += perf.lastFrameMs;
        perf.n++;
        if (perf.el && now - perf.lastShow > 400) showPerf(now);
    }

    let tipEl = null;
    let tipFaded = false;
    function fadeTip() {
        if (!tipEl) tipEl = document.getElementById('map-tip');
        if (!tipEl) return;
        const near = !!hover && holder.dataset.gutter !== 'bottom' && proj(hover.x / ts, 0, hover.y / ts).y > cssH - 80;
        if (near !== tipFaded) {
            tipFaded = near;
            tipEl.classList.toggle('faded', near);
        }
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
            resize(true);
        } else if (fastFor > 8000 && FX.quality < 2) {
            FX.setQuality(FX.quality + 1);
            fastFor = 0;
            resize(true);
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
        perf.el.textContent =
            `${(1000 / avg).toFixed(0)} fps · frame ${avg.toFixed(1)} ms (p95 ${sorted[Math.floor(sorted.length * 0.95)].toFixed(1)})\n` +
            `render ${(perf.renderAcc / n).toFixed(2)} ms · logic ${(perf.logicAcc / n).toFixed(2)} ms · draws ${drawCalls}\n` +
            `enemies ${enemies.length} · towers ${towers.length} · missiles ${projectiles.length}\n` +
            `particles ${FX.particles.n} · beams ${FX.beams.n} · rings ${FX.rings.n} · floaters ${floaters.length}\n` +
            `3D · quality ${['low', 'medium', 'high'][FX.quality]} · zoom ${zoom.toFixed(2)} · ${canvas.width}x${canvas.height} · tris ${gl.info.render.triangles}`;
        perf.lastShow = now;
        perf.renderAcc = perf.logicAcc = 0;
        perf.n = 0;
    }

    function togglePerf() {
        if (perf.el) {
            perf.el.remove();
            perf.el = null;
        } else {
            perf.el = document.createElement('div');
            perf.el.className = 'perf';
            holder.append(perf.el);
        }
    }

    return {
        available, init, suspend,
        // Used by tools/make-portraits.mjs to render the pictures in models/portraits
        renderPortraits: () => { makePortraits(); return { towers: { ...portraits }, enemies: { ...enemyPortraits } }; },
        // How far each turret is from the game's aim, in radians (for tests)
        aimErrors: () => [...towerModels.entries()].filter(([, m]) => m.aim).map(([t, m]) => Math.abs(angDiff(m.yaw - (m.aim.f0 - t.angle)))),
        get loadState() { return { ...load, failed: kitFailed, monsters: load.towersReady ? Object.keys(Art.ENEMY_ART) : [] }; },
        programs: () => gl ? gl.info.programs.length : 0,
        get counts() { return { clones, frameMs: perf.lastFrameMs || 0, enemyModels: enemyState.size, dying: dying.length, towers: towerModels.size, leaving: leaving.length, calls: gl ? gl.info.render.calls : 0, tris: gl ? gl.info.render.triangles : 0 }; }, resize: () => resize(false), mapChanged, frame, reveal, logicTime,
        setQualityAuto: (v) => { qualityAuto = v; }, setZoom, togglePerf, toScreen,
        get hover() { return hover; },
        get zoom() { return zoom; },
        get shake() { return { x: shakeX, y: shakeY }; },
        set upgradeRange(v) { upgradeRange = v; },
        get perfMode() { return perfMode; }
    };
})();
