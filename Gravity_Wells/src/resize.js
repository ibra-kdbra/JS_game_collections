let targetRatio = 1;
let actualRatio = 1;
let offsetX = 0;
let offsetY = 0;
let w = 0;
let h = 0;
let dpr = 0;

// Backing-store scale. Phones report 3 or more; 2 is already sharp for this
// flat art and keeps the per-frame clear and redraw cheap.
const MAX_DPR = 2;
let pixelRatio = () => Math.min(MAX_DPR, window.devicePixelRatio || 1);

let resize = (game, canvas) => {
    if (w === window.innerWidth && h === window.innerHeight && dpr === pixelRatio()) {
        return;
    }
    dpr = pixelRatio();
//    if (/(iPhone|iPad)/i.test(navigator.userAgent)) {
//        w = document.body.clientWidth;
//        h = document.body.clientHeight;
//    } else {
        w = window.innerWidth;
        h = window.innerHeight;
//    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    game.canvas.w = canvas.width;
    game.canvas.h = canvas.height;
    targetRatio = game.canvas.tW / game.canvas.tH;
    actualRatio = game.canvas.w / game.canvas.h;
    if (targetRatio < actualRatio) {
        game.canvas.zoom = game.canvas.h / game.canvas.tH;
        game.canvas.gH = game.canvas.tH;
        game.canvas.gW = game.canvas.tH * game.canvas.w / game.canvas.h;
    } else {
        game.canvas.zoom = game.canvas.w / game.canvas.tW;
        game.canvas.gW = game.canvas.tW;
        game.canvas.gH = game.canvas.tW * game.canvas.h / game.canvas.w;
    }
    offsetX = (game.canvas.gW - game.canvas.tW) / 2;
    offsetY = (game.canvas.gH - game.canvas.tH) / 2;
    game.canvas.gX = offsetX;
    game.canvas.gY = offsetY;
};

export default Object.freeze({
    resize,
    // The scale between CSS pixels and canvas pixels, for pointer mapping.
    ratio: () => dpr || pixelRatio()
});
