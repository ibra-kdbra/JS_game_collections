export function initTouchControls(canvasId = 'game') {
    const canvas = document.getElementById(canvasId);

    if (typeof Hammer === 'undefined' || !canvas) {
        console.warn('Hammer.js not loaded or canvas missing. Touch controls disabled.');
        return;
    }

    const hammer = new Hammer(canvas);

    hammer.on('tap', (e) => {
        const mouseEvent = new MouseEvent('click', {
            clientX: e.center.x,
            clientY: e.center.y,
            bubbles: true,
        });
        canvas.dispatchEvent(mouseEvent);
    });

    hammer.on('pan', (e) => {
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: e.center.x,
            clientY: e.center.y,
            bubbles: true,
        });
        canvas.dispatchEvent(mouseEvent);
    });
}