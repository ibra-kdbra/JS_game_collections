const nextFrame = requestAnimationFrame;

// Runs update(time) in fixed 1/60 s steps and render(time) once per frame;
// time is game seconds, which stop while the tab is hidden. Returns a stop function.
const startFrameLoop = (update, render) => {
    let time = 0;
    let stopped = false;
    const loop = GameKit.createLoop({
        update: (dt) => {
            if (stopped) return;
            time += dt;
            update(time);
        },
        render: () => {
            if (!stopped) render(time);
        }
    });
    update(time);
    loop.start();
    return () => {
        stopped = true;
        loop.stop();
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
