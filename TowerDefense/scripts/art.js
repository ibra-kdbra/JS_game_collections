// Sprites: towers, enemies and effects drawn in code, then packed into one
// atlas canvas at the current tile size so a frame is mostly drawImage calls.
//
// Every drawing function works in tile units: the context is scaled so 1 unit
// is one tile and the origin is the sprite centre. Turrets and enemies face +x.

const Art = (() => {
    const TAU = Math.PI * 2;

    // ---------- Small drawing helpers ----------

    function rr(g, x, y, w, h, r) {
        g.beginPath();
        g.moveTo(x + r, y);
        g.arcTo(x + w, y, x + w, y + h, r);
        g.arcTo(x + w, y + h, x, y + h, r);
        g.arcTo(x, y + h, x, y, r);
        g.arcTo(x, y, x + w, y, r);
        g.closePath();
    }

    function circ(g, x, y, r) {
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
    }

    function ngon(g, n, r, rot = 0, x = 0, y = 0) {
        g.beginPath();
        for (let i = 0; i < n; i++) {
            const a = rot + i * TAU / n;
            g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        g.closePath();
    }

    function poly(g, pts) {
        g.beginPath();
        g.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
        g.closePath();
    }

    // Fill the current path with an outline
    function fo(g, fill, line = OUT, w = 0.035) {
        g.fillStyle = fill;
        g.fill();
        if (line) {
            g.strokeStyle = line;
            g.lineWidth = w;
            g.stroke();
        }
    }

    const OUT = '#14161c';
    const TURRET_SCALE = 1.2;
    const METAL = '#3b414c';
    const METAL_HI = '#5c6472';
    const METAL_LO = '#262a32';
    const STEEL = '#9aa4b0';

    function bolts(g, pts, r = 0.028) {
        pts.forEach(([x, y]) => {
            circ(g, x, y, r);
            g.fillStyle = METAL_HI;
            g.fill();
        });
    }

    // ---------- Towers ----------
    // Each tower level has a base (fixed) and a turret (turns to aim).

    const TOWER_ART = {
        gun: { main: '#f5b83d', dark: '#a8730f', muzzle: [[0.5, 0]] },
        machineGun: { main: '#f47a1f', dark: '#9c4609', muzzle: [[0.52, -0.075], [0.52, 0.075]], level: 2 },
        laser: { main: '#2fb4ff', dark: '#11609c', muzzle: [[0.42, 0]] },
        beamEmitter: { main: '#38d6c9', dark: '#137a72', muzzle: [[0.46, 0]], level: 2 },
        slow: { main: '#5b8fe0', dark: '#2a4f8f', muzzle: [] },
        poison: { main: '#7dd321', dark: '#3d740b', muzzle: [], level: 2 },
        sniper: { main: '#e0313b', dark: '#7d1218', muzzle: [[0.64, 0]] },
        railgun: { main: '#9a62c4', dark: '#4e2a6b', muzzle: [[0.66, 0]], level: 2 },
        rocket: { main: '#2f9a5c', dark: '#16552f', muzzle: [[0.3, -0.1], [0.3, 0.1]] },
        missileSilo: { main: '#3d7fe0', dark: '#1d3f7a', muzzle: [[0.3, -0.14], [0.3, 0.14], [0.3, -0.045], [0.3, 0.045]], level: 2 },
        bomb: { main: '#8754d1', dark: '#432277', muzzle: [[0.36, 0]] },
        clusterBomb: { main: '#f2802a', dark: '#8a3f0a', muzzle: [[0.38, 0], [0.33, -0.15], [0.33, 0.15]], level: 2 },
        tesla: { main: '#f2e12b', dark: '#8a7d0a', muzzle: [[0, -0.12]] },
        lightningStrike: { main: '#50ebff', dark: '#0f7d91', muzzle: [[0, -0.16]], level: 2 }
    };

    function basePlate(g, shape, main, dark) {
        // soft drop shadow
        g.save();
        g.translate(0.05, 0.07);
        g.globalAlpha = 0.35;
        shapePath(g, shape, 0.46);
        g.fillStyle = '#000';
        g.fill();
        g.restore();
        shapePath(g, shape, 0.44);
        fo(g, METAL_LO, OUT, 0.04);
        g.save();
        g.translate(-0.015, -0.02);
        shapePath(g, shape, 0.4);
        g.fillStyle = METAL_HI;
        g.fill();
        g.restore();
        shapePath(g, shape, 0.39);
        g.fillStyle = METAL;
        g.fill();
        shapePath(g, shape, 0.33);
        g.strokeStyle = main;
        g.lineWidth = 0.035;
        g.stroke();
    }

    function shapePath(g, shape, r) {
        if (shape === 'square') rr(g, -r, -r, r * 2, r * 2, r * 0.28);
        else if (shape === 'hex') ngon(g, 6, r * 1.06, Math.PI / 6);
        else if (shape === 'oct') ngon(g, 8, r * 1.05, Math.PI / 8);
        else if (shape === 'diamond') ngon(g, 4, r * 1.2, 0);
        else circ(g, 0, 0, r);
    }

    const BASES = {
        gun(g, a) {
            basePlate(g, 'square', a.main, a.dark);
            bolts(g, [[-0.29, -0.29], [0.29, -0.29], [0.29, 0.29], [-0.29, 0.29]]);
        },
        machineGun(g, a) {
            basePlate(g, 'square', a.main, a.dark);
            // sandbags round the plate
            for (let i = 0; i < 12; i++) {
                const t = i / 12 * TAU;
                const x = Math.cos(t) * 0.41;
                const y = Math.sin(t) * 0.41;
                g.save();
                g.translate(x, y);
                g.rotate(t + Math.PI / 2);
                g.beginPath();
                g.ellipse(0, 0, 0.1, 0.055, 0, 0, TAU);
                fo(g, i % 2 ? '#c7ad7a' : '#b39765', OUT, 0.025);
                g.restore();
            }
        },
        laser(g, a) {
            basePlate(g, 'hex', a.main, a.dark);
            bolts(g, [0, 1, 2, 3, 4, 5].map(i => [Math.cos(i * TAU / 6 + Math.PI / 6) * 0.3, Math.sin(i * TAU / 6 + Math.PI / 6) * 0.3]));
        },
        beamEmitter(g, a) {
            basePlate(g, 'hex', a.main, a.dark);
            [0, 2, 4].forEach(i => {
                const t = i * TAU / 6 + Math.PI / 6;
                circ(g, Math.cos(t) * 0.36, Math.sin(t) * 0.36, 0.075);
                fo(g, '#bff8ff', OUT, 0.025);
                circ(g, Math.cos(t) * 0.36, Math.sin(t) * 0.36, 0.035);
                g.fillStyle = a.main;
                g.fill();
            });
        },
        slow(g, a) {
            basePlate(g, 'round', a.main, a.dark);
            g.strokeStyle = '#cfe6ff';
            g.lineWidth = 0.03;
            for (let i = 0; i < 6; i++) {
                const t = i * TAU / 6;
                g.beginPath();
                g.moveTo(Math.cos(t) * 0.24, Math.sin(t) * 0.24);
                g.lineTo(Math.cos(t) * 0.32, Math.sin(t) * 0.32);
                g.stroke();
            }
        },
        poison(g, a) {
            basePlate(g, 'round', a.main, a.dark);
            [0, 1, 2].forEach(i => {
                const t = i * TAU / 3 + Math.PI / 6;
                const x = Math.cos(t) * 0.33;
                const y = Math.sin(t) * 0.33;
                circ(g, x, y, 0.1);
                fo(g, '#2f5a10', OUT, 0.03);
                circ(g, x, y, 0.065);
                g.fillStyle = '#a8f25a';
                g.fill();
                circ(g, x - 0.02, y - 0.02, 0.02);
                g.fillStyle = '#eaffc8';
                g.fill();
            });
        },
        sniper(g, a) {
            basePlate(g, 'diamond', a.main, a.dark);
            bolts(g, [[0, -0.33], [0.33, 0], [0, 0.33], [-0.33, 0]]);
        },
        railgun(g, a) {
            basePlate(g, 'oct', a.main, a.dark);
            for (let i = 0; i < 4; i++) {
                const t = i * TAU / 4 + Math.PI / 4;
                g.save();
                g.translate(Math.cos(t) * 0.33, Math.sin(t) * 0.33);
                g.rotate(t);
                rr(g, -0.04, -0.07, 0.08, 0.14, 0.02);
                fo(g, '#e04cf0', OUT, 0.02);
                g.restore();
            }
        },
        rocket(g, a) {
            basePlate(g, 'square', a.main, a.dark);
            hazard(g, a.main, '#1d2320');
        },
        missileSilo(g, a) {
            basePlate(g, 'square', a.main, a.dark);
            hazard(g, '#f6c445', '#1d2320');
            bolts(g, [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]]);
        },
        bomb(g, a) {
            basePlate(g, 'round', a.main, a.dark);
            bolts(g, [0, 1, 2, 3, 4, 5, 6, 7].map(i => [Math.cos(i * TAU / 8) * 0.37, Math.sin(i * TAU / 8) * 0.37]), 0.025);
        },
        clusterBomb(g, a) {
            basePlate(g, 'oct', a.main, a.dark);
            circ(g, 0, 0, 0.38);
            g.setLineDash([0.06, 0.05]);
            g.strokeStyle = '#f6c445';
            g.lineWidth = 0.035;
            g.stroke();
            g.setLineDash([]);
        },
        tesla(g, a) {
            basePlate(g, 'round', a.main, a.dark);
            [0, 1, 2].forEach(i => {
                const t = i * TAU / 3 - Math.PI / 2;
                circ(g, Math.cos(t) * 0.32, Math.sin(t) * 0.32, 0.06);
                fo(g, '#c87533', OUT, 0.025);
            });
        },
        lightningStrike(g, a) {
            basePlate(g, 'hex', a.main, a.dark);
            [0, 1, 2, 3, 4, 5].forEach(i => {
                const t = i * TAU / 6;
                g.save();
                g.translate(Math.cos(t) * 0.36, Math.sin(t) * 0.36);
                g.rotate(t);
                poly(g, [-0.03, -0.05, 0.1, 0, -0.03, 0.05]);
                fo(g, '#bff8ff', OUT, 0.02);
                g.restore();
            });
        }
    };

    function hazard(g, c1, c2) {
        g.save();
        rr(g, -0.33, -0.33, 0.66, 0.66, 0.08);
        g.clip();
        for (let i = -6; i < 6; i++) {
            g.fillStyle = i % 2 ? c1 : c2;
            g.globalAlpha = 0.5;
            poly(g, [i * 0.1, -0.4, i * 0.1 + 0.1, -0.4, i * 0.1 + 0.9, 0.4, i * 0.1 + 0.8, 0.4]);
            g.fill();
        }
        g.restore();
        g.globalAlpha = 1;
        rr(g, -0.27, -0.27, 0.54, 0.54, 0.06);
        g.fillStyle = METAL;
        g.fill();
    }

    // A highlight blob on round parts so they look lit from the top left
    function shine(g, x, y, r, alpha = 0.35) {
        g.globalAlpha = alpha;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.6, -0.6, 0, TAU);
        g.fillStyle = '#ffffff';
        g.fill();
        g.globalAlpha = 1;
    }

    const TURRETS = {
        gun(g, a) {
            rr(g, 0.05, -0.055, 0.45, 0.11, 0.03);
            fo(g, STEEL);
            rr(g, 0.42, -0.07, 0.09, 0.14, 0.03);
            fo(g, METAL_LO);
            circ(g, 0, 0, 0.21);
            fo(g, a.main, OUT, 0.04);
            circ(g, 0, 0, 0.13);
            g.fillStyle = a.dark;
            g.fill();
            shine(g, -0.07, -0.08, 0.08);
        },
        machineGun(g, a) {
            [-0.075, 0.075].forEach(y => {
                rr(g, 0.05, y - 0.045, 0.47, 0.09, 0.025);
                fo(g, STEEL);
                rr(g, 0.46, y - 0.055, 0.07, 0.11, 0.02);
                fo(g, METAL_LO);
            });
            rr(g, -0.16, 0.13, 0.2, 0.13, 0.03);
            fo(g, '#6b5a2a');
            rr(g, -0.22, -0.2, 0.36, 0.4, 0.1);
            fo(g, a.main, OUT, 0.04);
            rr(g, -0.14, -0.12, 0.2, 0.24, 0.05);
            g.fillStyle = a.dark;
            g.fill();
            shine(g, -0.12, -0.12, 0.07);
        },
        laser(g, a) {
            [-0.07, 0.07].forEach(y => {
                rr(g, 0.08, y - 0.03, 0.3, 0.06, 0.02);
                fo(g, STEEL, OUT, 0.025);
            });
            circ(g, 0.38, 0, 0.065);
            fo(g, '#c9fbff', OUT, 0.025);
            rr(g, -0.2, -0.16, 0.34, 0.32, 0.12);
            fo(g, a.main, OUT, 0.04);
            circ(g, 0.02, 0, 0.08);
            fo(g, '#dffcff', a.dark, 0.03);
            shine(g, -0.1, -0.08, 0.07);
        },
        beamEmitter(g, a) {
            [-0.12, 0, 0.12].forEach((y, i) => {
                rr(g, 0.1, y - 0.03, i === 1 ? 0.34 : 0.26, 0.06, 0.02);
                fo(g, STEEL, OUT, 0.025);
            });
            circ(g, 0.44, 0, 0.08);
            fo(g, '#e9fffd', OUT, 0.03);
            rr(g, -0.24, -0.2, 0.42, 0.4, 0.14);
            fo(g, a.main, OUT, 0.04);
            ngon(g, 6, 0.1, 0, 0.0, 0);
            fo(g, '#e9fffd', a.dark, 0.03);
            shine(g, -0.12, -0.1, 0.08);
        },
        slow(g, a) {
            for (let i = 0; i < 3; i++) {
                g.save();
                g.rotate(i * TAU / 3);
                g.beginPath();
                g.ellipse(0.2, 0, 0.18, 0.08, 0.35, 0, TAU);
                fo(g, '#dcefff', OUT, 0.03);
                g.restore();
            }
            circ(g, 0, 0, 0.13);
            fo(g, a.main, OUT, 0.035);
            circ(g, 0, 0, 0.05);
            g.fillStyle = '#ffffff';
            g.fill();
        },
        poison(g, a) {
            for (let i = 0; i < 3; i++) {
                g.save();
                g.rotate(i * TAU / 3);
                rr(g, 0.08, -0.035, 0.24, 0.07, 0.02);
                fo(g, STEEL, OUT, 0.025);
                circ(g, 0.32, 0, 0.045);
                fo(g, '#2f5a10', OUT, 0.02);
                g.restore();
            }
            circ(g, 0, 0, 0.17);
            fo(g, a.main, OUT, 0.035);
            circ(g, 0, 0, 0.11);
            g.fillStyle = '#c4ff7a';
            g.fill();
            circ(g, -0.04, -0.03, 0.03);
            g.fillStyle = '#f2ffe0';
            g.fill();
        },
        sniper(g, a) {
            rr(g, 0.0, -0.035, 0.6, 0.07, 0.02);
            fo(g, '#2a2e36');
            rr(g, 0.56, -0.05, 0.09, 0.1, 0.02);
            fo(g, METAL_LO);
            rr(g, 0.02, -0.15, 0.24, 0.06, 0.03);
            fo(g, '#1d2026');
            circ(g, 0.26, -0.12, 0.03);
            g.fillStyle = '#ff8a8a';
            g.fill();
            rr(g, -0.2, -0.12, 0.3, 0.24, 0.08);
            fo(g, a.main, OUT, 0.04);
            shine(g, -0.1, -0.06, 0.06);
        },
        railgun(g, a) {
            [-0.09, 0.09].forEach(y => {
                rr(g, -0.3, y - 0.035, 0.96, 0.07, 0.02);
                fo(g, '#cfd6de');
            });
            g.globalAlpha = 0.85;
            rr(g, -0.1, -0.03, 0.72, 0.06, 0.02);
            g.fillStyle = '#f08cff';
            g.fill();
            g.globalAlpha = 1;
            [0.1, 0.25, 0.4].forEach(x => {
                rr(g, x - 0.025, -0.14, 0.05, 0.28, 0.015);
                fo(g, '#e04cf0', OUT, 0.02);
            });
            circ(g, -0.1, 0, 0.17);
            fo(g, a.main, OUT, 0.04);
            circ(g, -0.1, 0, 0.08);
            g.fillStyle = '#f6d0ff';
            g.fill();
        },
        rocket(g, a) {
            rr(g, -0.2, -0.22, 0.42, 0.44, 0.07);
            fo(g, a.main, OUT, 0.04);
            [-0.1, 0.1].forEach(y => {
                circ(g, 0.22, y, 0.075);
                fo(g, '#1a1d22');
                poly(g, [0.2, y - 0.06, 0.34, y, 0.2, y + 0.06]);
                fo(g, '#e0313b', OUT, 0.025);
            });
            rr(g, -0.14, -0.15, 0.16, 0.3, 0.04);
            g.fillStyle = a.dark;
            g.fill();
            shine(g, -0.12, -0.13, 0.06);
        },
        missileSilo(g, a) {
            rr(g, -0.22, -0.26, 0.46, 0.52, 0.08);
            fo(g, a.main, OUT, 0.04);
            [-0.14, -0.045, 0.045, 0.14].forEach(y => {
                poly(g, [0.18, y - 0.04, 0.32, y, 0.18, y + 0.04]);
                fo(g, '#f6c445', OUT, 0.02);
            });
            rr(g, -0.16, -0.18, 0.2, 0.36, 0.05);
            g.fillStyle = a.dark;
            g.fill();
            shine(g, -0.14, -0.15, 0.07);
        },
        bomb(g, a) {
            rr(g, 0.02, -0.13, 0.32, 0.26, 0.06);
            fo(g, '#2b2f37');
            rr(g, 0.26, -0.15, 0.1, 0.3, 0.04);
            fo(g, a.main);
            circ(g, 0.31, 0, 0.07);
            g.fillStyle = '#0c0d10';
            g.fill();
            circ(g, -0.04, 0, 0.2);
            fo(g, a.main, OUT, 0.04);
            circ(g, -0.04, 0, 0.1);
            g.fillStyle = a.dark;
            g.fill();
            shine(g, -0.1, -0.08, 0.07);
        },
        clusterBomb(g, a) {
            [-0.42, 0, 0.42].forEach(t => {
                g.save();
                g.rotate(t);
                rr(g, 0.04, -0.08, 0.32, 0.16, 0.04);
                fo(g, '#2b2f37');
                rr(g, 0.28, -0.095, 0.08, 0.19, 0.03);
                fo(g, a.main);
                circ(g, 0.33, 0, 0.045);
                g.fillStyle = '#0c0d10';
                g.fill();
                g.restore();
            });
            circ(g, -0.05, 0, 0.21);
            fo(g, a.main, OUT, 0.04);
            circ(g, -0.05, 0, 0.1);
            g.fillStyle = '#ffd36a';
            g.fill();
            shine(g, -0.11, -0.09, 0.07);
        },
        tesla(g, a) {
            // Copper coil seen from above with a glowing orb on top
            for (let i = 3; i >= 1; i--) {
                circ(g, 0, 0, 0.08 + i * 0.06);
                fo(g, i % 2 ? '#c87533' : '#e0954f', OUT, 0.025);
            }
            circ(g, 0, -0.04, 0.11);
            fo(g, '#fff6a0', '#8a7d0a', 0.03);
            circ(g, -0.03, -0.07, 0.04);
            g.fillStyle = '#ffffff';
            g.fill();
        },
        lightningStrike(g, a) {
            for (let i = 4; i >= 1; i--) {
                circ(g, 0, 0, 0.06 + i * 0.055);
                fo(g, i % 2 ? '#2a6f86' : '#3f97b3', OUT, 0.025);
            }
            [0, 1, 2, 3].forEach(i => {
                g.save();
                g.rotate(i * Math.PI / 2 + Math.PI / 4);
                poly(g, [0.1, -0.04, 0.3, 0, 0.1, 0.04]);
                fo(g, '#bff8ff', OUT, 0.02);
                g.restore();
            });
            circ(g, 0, -0.04, 0.12);
            fo(g, '#e6feff', '#0f7d91', 0.03);
            circ(g, -0.03, -0.08, 0.04);
            g.fillStyle = '#ffffff';
            g.fill();
        }
    };

    // Level chevrons on the front edge of the base
    function levelMark(g, level) {
        if (level < 2) return;
        g.save();
        g.translate(0, 0.37);
        for (let i = 0; i < 2; i++) {
            poly(g, [-0.09 + i * 0.1 - 0.05, -0.04, -0.09 + i * 0.1, 0.03, -0.09 + i * 0.1 + 0.05, -0.04, -0.09 + i * 0.1 + 0.05, 0.0, -0.09 + i * 0.1, 0.07, -0.09 + i * 0.1 - 0.05, 0.0]);
            fo(g, '#facc15', OUT, 0.018);
        }
        g.restore();
    }

    // ---------- Enemies ----------
    // r: drawn radius in tiles. Drawing units: 1 = r.

    const ENEMY_ART = {
        weak: { r: 0.3, color: '#c3ccd2', boss: false },
        strong: { r: 0.34, color: '#6f8094' },
        fast: { r: 0.32, color: '#3df1ff' },
        strongFast: { r: 0.38, color: '#2c8fd0' },
        medic: { r: 0.38, color: '#d9473a' },
        stronger: { r: 0.42, color: '#3a4f66' },
        faster: { r: 0.37, color: '#f9741a' },
        tank: { r: 0.5, color: '#2e8a52' },
        taunt: { r: 0.5, color: '#7340b0', boss: true },
        spawner: { r: 0.5, color: '#f2dd3a', boss: true }
    };

    const ENEMIES = {
        weak(g) {
            g.beginPath();
            g.ellipse(0, 0.05, 0.95, 0.82, 0, 0, TAU);
            fo(g, '#c3ccd2', OUT, 0.1);
            g.beginPath();
            g.ellipse(-0.1, 0.25, 0.6, 0.4, 0, 0, TAU);
            g.fillStyle = '#a5b0b8';
            g.fill();
            shine(g, -0.35, -0.35, 0.28, 0.6);
            eyes(g, 0.45, 0.3, 0.2);
        },
        strong(g) {
            for (let s = -1; s <= 1; s += 2) {
                for (let i = -1; i <= 1; i++) {
                    g.beginPath();
                    g.moveTo(i * 0.4, s * 0.5);
                    g.lineTo(i * 0.4 + 0.15, s * 1.0);
                    g.strokeStyle = OUT;
                    g.lineWidth = 0.14;
                    g.stroke();
                }
            }
            circ(g, 0.68, 0, 0.36);
            fo(g, '#3c4652', OUT, 0.1);
            g.beginPath();
            g.ellipse(-0.08, 0, 0.82, 0.78, 0, 0, TAU);
            fo(g, '#6f8094', OUT, 0.1);
            g.beginPath();
            g.moveTo(-0.85, 0);
            g.lineTo(0.7, 0);
            g.strokeStyle = '#3c4652';
            g.lineWidth = 0.08;
            g.stroke();
            shine(g, -0.35, -0.38, 0.25, 0.45);
            shine(g, -0.35, 0.3, 0.18, 0.25);
            eyes(g, 0.8, 0.18, 0.11);
        },
        fast(g) {
            poly(g, [1.0, 0, -0.8, 0.85, -0.42, 0, -0.8, -0.85]);
            fo(g, '#3df1ff', OUT, 0.1);
            poly(g, [0.75, 0, -0.35, 0.22, -0.35, -0.22]);
            g.fillStyle = '#0e8fa3';
            g.fill();
            shine(g, -0.2, -0.38, 0.22, 0.5);
        },
        strongFast(g) {
            poly(g, [1.0, 0, -0.55, 0.95, -0.85, 0.7, -0.5, 0, -0.85, -0.7, -0.55, -0.95]);
            fo(g, '#2c8fd0', OUT, 0.1);
            poly(g, [0.8, 0, -0.1, 0.42, -0.4, 0.3, -0.4, -0.3, -0.1, -0.42]);
            fo(g, '#7fd0ff', '#145a87', 0.06);
            circ(g, 0.28, 0, 0.13);
            g.fillStyle = '#ffffff';
            g.fill();
        },
        medic(g) {
            circ(g, 0, 0, 0.92);
            fo(g, '#d9473a', OUT, 0.1);
            circ(g, -0.05, 0, 0.55);
            fo(g, '#ffffff', '#a32a20', 0.06);
            g.fillStyle = '#d9473a';
            g.fillRect(-0.2, -0.38, 0.3, 0.76);
            g.fillRect(-0.43, -0.15, 0.76, 0.3);
            g.beginPath();
            g.moveTo(0.7, -0.2);
            g.lineTo(1.0, -0.45);
            g.strokeStyle = OUT;
            g.lineWidth = 0.1;
            g.stroke();
            circ(g, 1.0, -0.45, 0.1);
            g.fillStyle = '#7dff9a';
            g.fill();
            shine(g, -0.45, -0.5, 0.2, 0.35);
        },
        stronger(g) {
            rr(g, -0.62, -1.0, 0.7, 0.42, 0.15);
            fo(g, '#5d7895', OUT, 0.1);
            rr(g, -0.62, 0.58, 0.7, 0.42, 0.15);
            fo(g, '#5d7895', OUT, 0.1);
            rr(g, -0.85, -0.72, 1.6, 1.44, 0.4);
            fo(g, '#3a4f66', OUT, 0.1);
            rr(g, -0.55, -0.45, 0.8, 0.9, 0.2);
            g.fillStyle = '#2b3b4d';
            g.fill();
            [-0.24, 0.24].forEach(y => {
                circ(g, 0.52, y, 0.12);
                g.fillStyle = '#ffd34d';
                g.fill();
            });
            shine(g, -0.4, -0.45, 0.25, 0.3);
        },
        faster(g) {
            poly(g, [-0.55, -0.35, -1.0, 0, -0.55, 0.35]);
            g.fillStyle = '#ffd34d';
            g.fill();
            poly(g, [-0.55, -0.22, -0.82, 0, -0.55, 0.22]);
            g.fillStyle = '#ffffff';
            g.fill();
            g.beginPath();
            g.moveTo(1.0, 0);
            g.quadraticCurveTo(0.4, -0.85, -0.6, -0.55);
            g.lineTo(-0.6, 0.55);
            g.quadraticCurveTo(0.4, 0.85, 1.0, 0);
            g.closePath();
            fo(g, '#f9741a', OUT, 0.1);
            g.fillStyle = '#20232a';
            g.fillRect(-0.45, -0.12, 1.1, 0.08);
            g.fillRect(-0.45, 0.04, 1.1, 0.08);
            circ(g, 0.45, 0, 0.14);
            g.fillStyle = '#9ff3ff';
            g.fill();
        },
        tank(g) {
            [-0.62, 0.62].forEach(y => {
                rr(g, -0.95, y - 0.24, 1.9, 0.48, 0.18);
                fo(g, '#24272d', OUT, 0.08);
                g.fillStyle = '#4a4f58';
                for (let i = 0; i < 7; i++) g.fillRect(-0.85 + i * 0.27, y - 0.2, 0.1, 0.4);
            });
            rr(g, -0.8, -0.45, 1.55, 0.9, 0.18);
            fo(g, '#2e8a52', OUT, 0.08);
            rr(g, 0.1, -0.08, 0.95, 0.16, 0.05);
            fo(g, '#8c969c', OUT, 0.06);
            circ(g, -0.05, 0, 0.36);
            fo(g, '#3fae6a', OUT, 0.08);
            circ(g, -0.05, 0, 0.14);
            g.fillStyle = '#1f5f38';
            g.fill();
            shine(g, -0.2, -0.15, 0.14, 0.4);
        },
        taunt(g) {
            for (let i = 0; i < 8; i++) {
                g.save();
                g.rotate(i * TAU / 8 + Math.PI / 8);
                poly(g, [0.78, -0.16, 1.0, 0, 0.78, 0.16]);
                fo(g, '#e8862a', OUT, 0.06);
                g.restore();
            }
            ngon(g, 8, 0.88, Math.PI / 8);
            fo(g, '#7340b0', OUT, 0.1);
            g.strokeStyle = '#e8862a';
            g.lineWidth = 0.09;
            g.strokeRect(-0.52, -0.52, 1.04, 1.04);
            g.strokeRect(-0.32, -0.32, 0.64, 0.64);
            circ(g, 0, 0, 0.16);
            g.fillStyle = '#ffd34d';
            g.fill();
            shine(g, -0.4, -0.45, 0.24, 0.3);
        },
        spawner(g) {
            for (let i = 0; i < 6; i++) {
                g.save();
                g.rotate(i * TAU / 6 + 0.3);
                g.beginPath();
                g.moveTo(0.7, 0);
                g.lineTo(1.0, 0.18);
                g.strokeStyle = OUT;
                g.lineWidth = 0.1;
                g.stroke();
                g.restore();
            }
            circ(g, 0, 0, 0.9);
            fo(g, '#f2dd3a', OUT, 0.1);
            [[0.3, -0.35, 0.18], [-0.35, 0.25, 0.22], [0.15, 0.4, 0.14], [-0.4, -0.3, 0.12], [0.5, 0.15, 0.1]].forEach(([x, y, r]) => {
                circ(g, x, y, r);
                fo(g, '#b8a01a', null);
                circ(g, x - r * 0.25, y - r * 0.25, r * 0.4);
                g.fillStyle = '#fff6b0';
                g.fill();
            });
            circ(g, 0, 0, 0.2);
            fo(g, '#f2802a', OUT, 0.06);
            shine(g, -0.45, -0.5, 0.22, 0.4);
        }
    };

    function eyes(g, x, dy, r) {
        [-dy, dy].forEach(y => {
            circ(g, x, y, r);
            fo(g, '#ffffff', OUT, r * 0.35);
            circ(g, x + r * 0.35, y, r * 0.5);
            g.fillStyle = '#111';
            g.fill();
        });
    }

    // ---------- Atlas ----------

    class Atlas {
        constructor(width) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = 64;
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            this.items = [];
            this.x = 0;
            this.y = 0;
            this.rowH = 0;
            this.map = {};
            this.pending = [];
        }

        // Reserve room; drawing happens in finish() once the height is known
        add(name, w, h, draw) {
            w = Math.ceil(w) + 2;
            h = Math.ceil(h) + 2;
            if (this.x + w > this.canvas.width) {
                this.x = 0;
                this.y += this.rowH;
                this.rowH = 0;
            }
            const s = { x: this.x + 1, y: this.y + 1, w: w - 2, h: h - 2 };
            this.map[name] = s;
            this.pending.push([s, draw]);
            this.x += w;
            this.rowH = Math.max(this.rowH, h);
            return s;
        }

        finish() {
            this.canvas.height = Math.max(1, this.y + this.rowH);
            const g = this.ctx;
            this.pending.forEach(([s, draw]) => {
                g.save();
                g.beginPath();
                g.rect(s.x, s.y, s.w, s.h);
                g.clip();
                g.translate(s.x + s.w / 2, s.y + s.h / 2);
                draw(g, s);
                g.restore();
            });
            this.pending = [];
        }
    }

    // Draw into a temporary canvas, then copy a recoloured silhouette
    function silhouette(draw, w, h, color) {
        const c = document.createElement('canvas');
        c.width = Math.ceil(w);
        c.height = Math.ceil(h);
        const g = c.getContext('2d', { willReadFrequently: true });
        g.translate(c.width / 2, c.height / 2);
        draw(g);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, c.width, c.height);
        return c;
    }

    function glowSprite(g, s, color, core = '#ffffff') {
        const r = s.w / 2;
        const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
        grad.addColorStop(0, core);
        grad.addColorStop(0.25, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(-r, -r, r * 2, r * 2);
    }

    const GLOWS = {
        white: '#ffffff', yellow: '#ffd23f', orange: '#ff8a1f', red: '#ff4b3e', cyan: '#39e9ff',
        blue: '#4f8dff', green: '#8be33b', purple: '#b678ff', pink: '#ff7ad1', ice: '#bfe6ff'
    };

    // Build every sprite for a tile size of `tile` device pixels
    function build(tile) {
        tile = Math.max(8, Math.min(160, Math.round(tile)));
        const atlas = new Atlas(tile > 90 ? 2048 : 1024);
        const S = {};
        const T = tile;
        const unit = (fn, scale = 1) => (g) => {
            g.scale(T * scale, T * scale);
            g.lineJoin = 'round';
            g.lineCap = 'round';
            fn(g);
        };

        Object.keys(TOWER_ART).forEach(name => {
            const a = TOWER_ART[name];
            const level = a.level || 1;
            S['base_' + name] = atlas.add('base_' + name, T * 1.04, T * 1.04, unit(g => {
                BASES[name](g, a);
                levelMark(g, level);
            }));
            // Turrets are drawn a little larger than their plan so they read on small tiles
            S['turret_' + name] = atlas.add('turret_' + name, T * 1.8, T * 1.8, unit(g => TURRETS[name](g, a), TURRET_SCALE));
        });

        Object.keys(ENEMY_ART).forEach(name => {
            const a = ENEMY_ART[name];
            const d = T * a.r * 2 * 1.12;
            const draw = (g) => {
                g.scale(T * a.r, T * a.r);
                g.lineJoin = 'round';
                g.lineCap = 'round';
                ENEMIES[name](g);
            };
            S['enemy_' + name] = atlas.add('enemy_' + name, d, d, draw);
            ['white', 'ice', 'poison', 'regen'].forEach(tint => {
                const col = { white: '#ffffff', ice: '#9fdcff', poison: '#9cff3a', regen: '#ff6fb7' }[tint];
                const sil = silhouette(draw, d, d, col);
                S[`enemy_${name}_${tint}`] = atlas.add(`enemy_${name}_${tint}`, d, d, (g) => {
                    g.drawImage(sil, -sil.width / 2, -sil.height / 2);
                });
            });
        });

        const gs = Math.max(16, Math.round(T * 1.2));
        Object.keys(GLOWS).forEach(k => {
            S['glow_' + k] = atlas.add('glow_' + k, gs, gs, (g, s) => glowSprite(g, s, GLOWS[k]));
        });
        S.smoke = atlas.add('smoke', gs, gs, (g, s) => {
            const r = s.w / 2;
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, 'rgba(70,70,76,0.9)');
            grad.addColorStop(0.6, 'rgba(70,70,76,0.45)');
            grad.addColorStop(1, 'rgba(70,70,76,0)');
            g.fillStyle = grad;
            g.fillRect(-r, -r, r * 2, r * 2);
        });
        S.shadow = atlas.add('shadow', gs, gs * 0.6, (g, s) => {
            g.scale(1, 0.6);
            const r = s.w / 2;
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, 'rgba(0,0,0,0.5)');
            grad.addColorStop(0.6, 'rgba(0,0,0,0.3)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = grad;
            g.fillRect(-r, -r, r * 2, r * 2);
        });
        ['white', 'ice', 'green', 'orange', 'purple', 'yellow', 'red', 'cyan'].forEach(k => {
            const col = { white: '#ffffff', ice: '#bfe6ff', green: '#a6f25a', orange: '#ff9a3c', purple: '#c58cff', yellow: '#ffe066', red: '#ff6b5e', cyan: '#6ff3ff' }[k];
            S['ring_' + k] = atlas.add('ring_' + k, gs * 1.5, gs * 1.5, (g, s) => {
                const r = s.w / 2;
                g.beginPath();
                g.arc(0, 0, r * 0.86, 0, TAU);
                g.lineWidth = r * 0.08;
                g.strokeStyle = col;
                g.stroke();
                g.globalAlpha = 0.3;
                g.lineWidth = r * 0.22;
                g.stroke();
            });
        });
        S.chevron = atlas.add('chevron', T * 0.6, T * 0.6, unit(g => {
            poly(g, [-0.15, -0.22, 0.09, 0, -0.15, 0.22, -0.04, 0.22, 0.2, 0, -0.04, -0.22]);
            g.fillStyle = '#ffffff';
            g.fill();
        }));
        S.chevronGold = atlas.add('chevronGold', T * 0.6, T * 0.6, unit(g => {
            poly(g, [-0.15, -0.22, 0.09, 0, -0.15, 0.22, -0.04, 0.22, 0.2, 0, -0.04, -0.22]);
            g.fillStyle = '#ffd23f';
            g.fill();
            g.strokeStyle = '#3a2a00';
            g.lineWidth = 0.025;
            g.stroke();
        }));
        S.flash = atlas.add('flash', T * 0.7, T * 0.7, unit(g => {
            g.fillStyle = '#fff3b0';
            poly(g, [0.33, 0, 0.06, 0.08, 0, 0.3, -0.06, 0.08, -0.25, 0, -0.06, -0.08, 0, -0.3, 0.06, -0.08]);
            g.fill();
            g.fillStyle = '#ffffff';
            circ(g, 0, 0, 0.09);
            g.fill();
        }));
        S.missile = atlas.add('missile', T * 0.7, T * 0.35, unit(g => {
            poly(g, [-0.2, -0.05, -0.3, -0.13, -0.12, -0.05]);
            fo(g, '#e0313b', OUT, 0.02);
            poly(g, [-0.2, 0.05, -0.3, 0.13, -0.12, 0.05]);
            fo(g, '#e0313b', OUT, 0.02);
            rr(g, -0.24, -0.055, 0.4, 0.11, 0.04);
            fo(g, '#dfe4ea', OUT, 0.02);
            poly(g, [0.14, -0.055, 0.28, 0, 0.14, 0.055]);
            fo(g, '#e0313b', OUT, 0.02);
        }));
        S.missileBlue = atlas.add('missileBlue', T * 0.8, T * 0.4, unit(g => {
            poly(g, [-0.22, -0.06, -0.34, -0.15, -0.13, -0.06]);
            fo(g, '#3d7fe0', OUT, 0.02);
            poly(g, [-0.22, 0.06, -0.34, 0.15, -0.13, 0.06]);
            fo(g, '#3d7fe0', OUT, 0.02);
            rr(g, -0.26, -0.065, 0.44, 0.13, 0.05);
            fo(g, '#e8edf3', OUT, 0.02);
            poly(g, [0.16, -0.065, 0.32, 0, 0.16, 0.065]);
            fo(g, '#f6c445', OUT, 0.02);
        }));
        S.snow = atlas.add('snow', T * 0.3, T * 0.3, unit(g => {
            g.strokeStyle = '#ffffff';
            g.lineWidth = 0.03;
            for (let i = 0; i < 3; i++) {
                g.beginPath();
                const t = i * Math.PI / 3;
                g.moveTo(Math.cos(t) * 0.12, Math.sin(t) * 0.12);
                g.lineTo(-Math.cos(t) * 0.12, -Math.sin(t) * 0.12);
                g.stroke();
            }
        }));
        S.bubble = atlas.add('bubble', T * 0.25, T * 0.25, unit(g => {
            circ(g, 0, 0, 0.09);
            g.fillStyle = 'rgba(156,255,58,0.55)';
            g.fill();
            g.strokeStyle = '#d8ff9c';
            g.lineWidth = 0.025;
            g.stroke();
            circ(g, -0.03, -0.03, 0.025);
            g.fillStyle = '#ffffff';
            g.fill();
        }));
        S.plus = atlas.add('plus', T * 0.25, T * 0.25, unit(g => {
            g.fillStyle = '#ff8fc8';
            g.fillRect(-0.03, -0.09, 0.06, 0.18);
            g.fillRect(-0.09, -0.03, 0.18, 0.06);
        }));
        S.portal = atlas.add('portal', T * 1.1, T * 1.1, unit(g => {
            for (let i = 0; i < 3; i++) {
                g.save();
                g.rotate(i * TAU / 3);
                g.beginPath();
                g.arc(0, 0, 0.36, 0, Math.PI * 0.75);
                g.strokeStyle = i % 2 ? '#c38bff' : '#7c4dff';
                g.lineWidth = 0.07;
                g.stroke();
                g.beginPath();
                g.arc(0, 0, 0.24, Math.PI * 0.3, Math.PI * 0.95);
                g.strokeStyle = '#e3ccff';
                g.lineWidth = 0.04;
                g.stroke();
                g.restore();
            }
        }));
        S.portalCore = atlas.add('portalCore', T * 0.9, T * 0.9, (g, s) => {
            const r = s.w / 2;
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
            grad.addColorStop(0, '#120a24');
            grad.addColorStop(0.45, '#3b1d7a');
            grad.addColorStop(0.75, 'rgba(124,77,255,0.6)');
            grad.addColorStop(1, 'rgba(124,77,255,0)');
            g.fillStyle = grad;
            g.fillRect(-r, -r, r * 2, r * 2);
        });
        S.gate = atlas.add('gate', T * 1.1, T * 1.1, unit(g => drawGate(g)));
        atlas.finish();
        return { atlas: atlas.canvas, s: S, tile: T };
    }

    // The player's base: a small keep with a crystal heart
    function drawGate(g) {
        g.save();
        g.translate(0.04, 0.06);
        g.globalAlpha = 0.35;
        rr(g, -0.42, -0.42, 0.84, 0.84, 0.12);
        g.fillStyle = '#000';
        g.fill();
        g.restore();
        rr(g, -0.42, -0.42, 0.84, 0.84, 0.12);
        fo(g, '#6b5a2e', OUT, 0.04);
        [[-0.32, -0.32], [0.32, -0.32], [0.32, 0.32], [-0.32, 0.32]].forEach(([x, y]) => {
            rr(g, x - 0.13, y - 0.13, 0.26, 0.26, 0.05);
            fo(g, '#9a8450', OUT, 0.035);
            rr(g, x - 0.07, y - 0.07, 0.14, 0.14, 0.03);
            g.fillStyle = '#c9b06b';
            g.fill();
        });
        ngon(g, 4, 0.2, Math.PI / 4);
        fo(g, '#3a3220', OUT, 0.03);
        ngon(g, 4, 0.15, 0);
        fo(g, '#facc15', '#7a5c0a', 0.03);
        poly(g, [0, -0.15, 0.05, -0.02, 0, 0.02, -0.05, -0.02]);
        g.fillStyle = '#fff3b0';
        g.fill();
    }

    // ---------- Portraits for the page (data URLs) ----------

    const portraitCache = {};

    function towerPortrait(name, size = 64) {
        const key = `t-${name}-${size}`;
        if (portraitCache[key]) return portraitCache[key];
        const a = TOWER_ART[name];
        if (!a) return '';
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.translate(size / 2, size / 2);
        g.scale(size * 0.92, size * 0.92);
        g.lineJoin = 'round';
        g.lineCap = 'round';
        BASES[name](g, a);
        levelMark(g, a.level || 1);
        g.save();
        if (name !== 'tesla' && name !== 'lightningStrike') g.rotate(-Math.PI / 4);
        g.scale(TURRET_SCALE, TURRET_SCALE);
        TURRETS[name](g, a);
        g.restore();
        return (portraitCache[key] = c.toDataURL());
    }

    function enemyPortrait(name, size = 48) {
        const key = `e-${name}-${size}`;
        if (portraitCache[key]) return portraitCache[key];
        const a = ENEMY_ART[name];
        if (!a) return '';
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d', { willReadFrequently: true });
        g.translate(size / 2, size / 2);
        g.scale(size * 0.44, size * 0.44);
        g.lineJoin = 'round';
        g.lineCap = 'round';
        g.rotate(-Math.PI / 2);
        ENEMIES[name](g);
        return (portraitCache[key] = c.toDataURL());
    }

    return { build, TURRET_SCALE, TOWER_ART, ENEMY_ART, towerPortrait, enemyPortrait, drawGate, GLOWS };
})();
