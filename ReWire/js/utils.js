const nextFrame = requestAnimationFrame;
const startFrameLoop = (callback) => {

    let requestId;
    let stopLoop = false;
    let lastTime = 0;
    const update = (time) => {
        callback(time * 0.001);
        if (!stopLoop) {
            requestId = nextFrame(update);
        }
        lastTime = time;
    };
    requestId = nextFrame(update);

    return () => {
        stopLoop = true;
    };
};

const tween = (from, to, duration, onUpdate, onComplete) => {
    const startTime = performance.now();
    const update = (time) => {
        let t = 1 / duration * (time - startTime) * 0.001;
        if (t < 1) {
            onUpdate(from + (to - from) * t);
            nextFrame(update);
        } else {
            onUpdate(to);
            nextFrame(onComplete);
        }
    };
    update(startTime);
};
