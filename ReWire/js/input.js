// Pointer input (mouse, touch and pen) in stage coordinates (1280 x 720).
const createInputControl = (canvas) => {
    let mouseDown = false;
    let activePointer = null;
    const mousePos = { x: 0, y: 0 };

    // Fingers are less precise than a mouse cursor, so grab targets are larger
    let grabScale = 1;
    const touchGrabScale = 1.8;

    const mouseOverTargets = [];
    const mouseOutTargets = [];
    const mouseDownTargets = [];

    // Map a pointer event to the unrotated, unscaled stage
    const setPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (stageRotated) {
            mousePos.x = (e.clientY - rect.top) / rect.height * stageWidth;
            mousePos.y = (rect.right - e.clientX) / rect.width * stageHeight;
        } else {
            mousePos.x = (e.clientX - rect.left) / rect.width * stageWidth;
            mousePos.y = (e.clientY - rect.top) / rect.height * stageHeight;
        }
    };

    const pointerMoveListener = (e) => {
        if (activePointer !== null && e.pointerId !== activePointer) return;
        setPos(e);
    };
    const pointerDownListener = (e) => {
        if (e.target.closest('a, button')) return;
        if (activePointer !== null) return;
        activePointer = e.pointerId;
        grabScale = e.pointerType === 'mouse' ? 1 : touchGrabScale;
        setPos(e);
        // Without hover (touch), find what is under the finger before pressing
        update();
        mouseDown = true;
        mouseOverTargets.forEach(watch => {
            const mouseDownCallback = watch[1].mouseDown;
            mouseDownCallback && mouseDownCallback();
            mouseDownTargets.push(watch);
        });
        e.preventDefault();
    };
    const pointerUpListener = (e) => {
        if (e.pointerId !== activePointer) return;
        activePointer = null;
        mouseDown = false;
        mouseDownTargets.forEach(watch => {
            const mouseUpCallback = watch[1].mouseUp;
            mouseUpCallback && mouseUpCallback();
        });
        mouseDownTargets.length = 0;
    };

    document.addEventListener('pointermove', pointerMoveListener);
    document.addEventListener('pointerdown', pointerDownListener);
    document.addEventListener('pointerup', pointerUpListener);
    document.addEventListener('pointercancel', pointerUpListener);

    const dragControl = (target, callbacks) => {
        mouseOutTargets.push([target, callbacks]);
    };

    const update = () => {
        for (let i = mouseOutTargets.length - 1; i >= 0; --i) {
            const watch = mouseOutTargets[i];
            const callbacks = watch[1];
            if (distV(mousePos, watch[0].pos) <= watch[0].mouseDrag.size * grabScale) {
                callbacks.mouseOver && callbacks.mouseOver();
                mouseOutTargets.splice(i, 1);
                mouseOverTargets.push(watch);
            }
        }
        for (let i = mouseOverTargets.length - 1; i >= 0; --i) {
            const watch = mouseOverTargets[i];
            const callbacks = watch[1];

            mouseDown && callbacks.mouseDownUpdate && callbacks.mouseDownUpdate();
            if (distV(mousePos, watch[0].pos) > watch[0].mouseDrag.size * grabScale) {
                callbacks.mouseOut && callbacks.mouseOut();
                mouseOverTargets.splice(i, 1);
                mouseOutTargets.push(watch);
            }
        }
    };
    const shutdown = () => {
        document.removeEventListener('pointermove', pointerMoveListener);
        document.removeEventListener('pointerdown', pointerDownListener);
        document.removeEventListener('pointerup', pointerUpListener);
        document.removeEventListener('pointercancel', pointerUpListener);
    };

    return {
        update,
        dragControl,
        mousePos,
        isMouseDown: () => (mouseDown),
        shutdown
    };
};
