// The map's renderer: the 3D view (render3d.js, WebGL) by default, or the flat
// top-down view (render.js, 2D canvas), switched in the menu. Both draw the same
// game and take the same calls; this passes each call to the one in use. Without
// WebGL the flat view is the only one.

const Renderer = (() => {
    let view = '3d';
    let chosen = '3d';          // what the player picked; a fallback to Flat never changes it
    let failed = '';            // why the 3D view could not run, if it could not
    let holder = null;
    let active = null;
    let upgradeRange = 0;
    const has3D = () => typeof Renderer3D !== 'undefined' && Renderer3D.available();
    const pick = () => (view === '3d' && has3D() ? Renderer3D : RendererFlat);

    function init(h) {
        holder = h;
        if (view === '3d' && !has3D()) {
            view = 'flat';
            failed = !window.THREE ? 'three.js did not load' : 'WebGL is off or blocked in this browser';
            setTimeout(() => typeof toast === 'function' && toast(`The 3D view could not start (${failed}), showing Flat`, 'error'), 800);
        }
        active = pick();
        active.init(holder);
    }

    // '3d' or 'flat' (older saved settings said 'raised' for the angled view)
    function setView(v) {
        v = v === 'flat' ? 'flat' : '3d';
        chosen = v;
        if (v === '3d' && failed) return;
        if (v === '3d' && holder && !has3D()) v = 'flat';
        if (v === view && active) return;
        view = v;
        if (!holder) return;
        const next = pick();
        if (next === active) return;
        active.suspend();
        active = next;
        active.init(holder);
        active.upgradeRange = upgradeRange;
        active.mapChanged();
    }

    // The 3D view could not load or draw: show Flat for this visit, say why, and keep
    // the player's choice so the next visit tries 3D again
    function fallback(reason) {
        if (failed) return;
        failed = reason || 'unknown error';
        if (active === Renderer3D) {
            view = 'flat';
            active.suspend();
            active = RendererFlat;
            active.init(holder);
            active.upgradeRange = upgradeRange;
            active.mapChanged();
        }
        if (typeof toast === 'function') toast(`The 3D view could not load (${failed}), showing Flat`, 'error');
        if (typeof syncSettings === 'function') syncSettings();
    }

    return {
        init, setView, fallback,
        get chosen() { return chosen; },
        get failed() { return failed; },
        resize: () => active && active.resize(),
        mapChanged: (t) => {
            RendererFlat.mapChanged(t);
            if (active === Renderer3D) Renderer3D.mapChanged(t);
            else if (has3D() && t) Renderer3D.mapChanged(t);
        },
        frame: (s) => active && active.frame(s),
        reveal: (x, y) => active && active.reveal(x, y),
        logicTime: (ms) => active && active.logicTime(ms),
        setQualityAuto: (v) => { RendererFlat.setQualityAuto(v); if (has3D()) Renderer3D.setQualityAuto(v); },
        setZoom: (z) => active && active.setZoom(z),
        togglePerf: () => active && active.togglePerf(),
        toScreen: (x, y) => active.toScreen(x, y),
        get view() { return active === Renderer3D ? '3d' : view === '3d' && !holder ? '3d' : 'flat'; },
        get available3D() { return has3D(); },
        get hover() { return active ? active.hover : null; },
        get zoom() { return active ? active.zoom : 1; },
        get shake() { return active ? active.shake : { x: 0, y: 0 }; },
        set upgradeRange(v) { upgradeRange = v; if (active) active.upgradeRange = v; },
        get perfMode() { return RendererFlat.perfMode; }
    };
})();
