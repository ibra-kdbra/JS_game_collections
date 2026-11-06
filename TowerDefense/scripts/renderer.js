// The map's renderer: the 3D view (render3d.js, WebGL) by default, or the flat
// top-down view (render.js, 2D canvas), switched in the menu. Both draw the same
// game and take the same calls; this passes each call to the one in use. Without
// WebGL the flat view is the only one.

const Renderer = (() => {
    let view = '3d';
    let holder = null;
    let active = null;
    let upgradeRange = 0;
    const has3D = () => typeof Renderer3D !== 'undefined' && Renderer3D.available();
    const pick = () => (view === '3d' && has3D() ? Renderer3D : RendererFlat);

    function init(h) {
        holder = h;
        if (view === '3d' && !has3D()) view = 'flat';
        active = pick();
        active.init(holder);
    }

    // '3d' or 'flat' (older saved settings said 'raised' for the angled view)
    function setView(v) {
        v = v === 'flat' ? 'flat' : '3d';
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

    return {
        init, setView,
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
