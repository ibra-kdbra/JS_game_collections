const createInputControl = (canvas) => {
    let mouseDown = false;
    const mousePos = { x: 0, y: 0 };

    const mouseOverTargets = [];
    const mouseOutTargets = [];
    const mouseDownTargets = [];

    const mouseMoveListener = (e) => {
        let rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        mousePos.x = (e.clientX - rect.left) / scaleX;
        mousePos.y = (e.clientY - rect.top) / scaleY;
        e.preventDefault();
    };
    const mouseDownListener = (e) => {
        mouseDown = true;
        mouseOverTargets.forEach(watch => {
            const mouseDownCallback = watch[1].mouseDown;
            mouseDownCallback && mouseDownCallback();
            mouseDownTargets.push(watch);
        });
        e.preventDefault();
    };
    const mouseUpListener = (e) => {
        mouseDown = false;
        mouseDownTargets.forEach(watch => {
            const mouseUpCallback = watch[1].mouseUp;
            mouseUpCallback && mouseUpCallback();
        });
        mouseDownTargets.length = 0;
    };

    document.addEventListener('mousemove', mouseMoveListener);
    document.addEventListener('mousedown', mouseDownListener);
    document.addEventListener('mouseup', mouseUpListener);

    const dragControl = (target, callbacks) => {
        mouseOutTargets.push([target, callbacks]);
    };

    const update = () => {
        for (let i = mouseOutTargets.length - 1; i >= 0; --i) {
            const watch = mouseOutTargets[i];
            const callbacks = watch[1];
            if (distV(mousePos, watch[0].pos) <= watch[0].mouseDrag.size) {
                callbacks.mouseOver && callbacks.mouseOver();
                mouseOutTargets.splice(i, 1);
                mouseOverTargets.push(watch);
            }
        }
        for (let i = mouseOverTargets.length - 1; i >= 0; --i) {
            const watch = mouseOverTargets[i];
            const callbacks = watch[1];

            mouseDown && callbacks.mouseDownUpdate && callbacks.mouseDownUpdate();
            if (distV(mousePos, watch[0].pos) > watch[0].mouseDrag.size) {
                callbacks.mouseOut && callbacks.mouseOut();
                mouseOverTargets.splice(i, 1);
                mouseOutTargets.push(watch);
            }
        }
    };
    const shutdown = () => {
        document.removeEventListener('mousemove', mouseMoveListener);
        document.removeEventListener('mousedown', mouseDownListener);
        document.removeEventListener('mouseup', mouseUpListener);
    };

    return {
        update,
        dragControl,
        mousePos,
        isMouseDown: () => (mouseDown),
        shutdown,
        targets: mouseOverTargets
    };
};
