/**
 * Fixed-timestep game loop.
 *
 * Game logic advances in constant steps (default 60 per second) no matter how
 * fast the display refreshes, so a 120 Hz or 144 Hz screen doesn't double the
 * game speed. Rendering happens once per animation frame with an interpolation
 * factor for smooth motion.
 *
 * The loop pauses itself when the tab is hidden and drops the time that passed
 * while hidden, so players never come back to a lost life.
 *
 *   const loop = createLoop({
 *     update(dt) { world.step(dt); },          // dt in seconds, constant
 *     render(alpha) { draw(world, alpha); },   // alpha in [0, 1)
 *   });
 *   loop.start();
 */
export function createLoop({
  update,
  render = () => {},
  stepsPerSecond = 60,
  maxStepsPerFrame = 5,
  autoPause = true,
  onPauseChange = () => {},
} = {}) {
  if (typeof update !== 'function') throw new TypeError('createLoop needs an update(dt) function');

  const stepMs = 1000 / stepsPerSecond;
  const dt = 1 / stepsPerSecond;
  let frame = 0;
  let last = 0;
  let accumulator = 0;
  let running = false;
  let paused = false;
  let pausedByVisibility = false;

  function tick(now) {
    frame = requestAnimationFrame(tick);
    if (paused) {
      last = now;
      render(0);
      return;
    }
    let elapsed = now - last;
    last = now;
    // A long gap (debugger, slow device) shouldn't fast-forward the game.
    if (elapsed > stepMs * maxStepsPerFrame) elapsed = stepMs * maxStepsPerFrame;
    accumulator += elapsed;
    while (accumulator >= stepMs) {
      update(dt);
      accumulator -= stepMs;
    }
    render(accumulator / stepMs);
  }

  function setPaused(value) {
    if (paused === value) return;
    paused = value;
    accumulator = 0;
    onPauseChange(paused);
  }

  function onVisibility() {
    if (document.hidden) {
      if (!paused) {
        pausedByVisibility = true;
        setPaused(true);
      }
    } else if (pausedByVisibility) {
      pausedByVisibility = false;
      setPaused(false);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      accumulator = 0;
      frame = requestAnimationFrame(tick);
      if (autoPause) document.addEventListener('visibilitychange', onVisibility);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    },
    pause() {
      pausedByVisibility = false;
      setPaused(true);
    },
    resume() {
      pausedByVisibility = false;
      setPaused(false);
    },
    toggle() {
      pausedByVisibility = false;
      setPaused(!paused);
    },
    get paused() {
      return paused;
    },
    get running() {
      return running;
    },
  };
}

/**
 * For engines that already own their loop (p5, LittleJS, custom rAF code):
 * converts frame callbacks into a fixed number of logic steps.
 *
 *   const stepper = createStepper(60);
 *   function draw() { stepper.advance(performance.now(), () => updateOneTick()); render(); }
 */
export function createStepper(stepsPerSecond = 60, maxSteps = 5) {
  const stepMs = 1000 / stepsPerSecond;
  let last = null;
  let accumulator = 0;
  return {
    advance(now, step) {
      if (last === null) last = now;
      let elapsed = Math.min(now - last, stepMs * maxSteps);
      last = now;
      accumulator += elapsed;
      let steps = 0;
      while (accumulator >= stepMs) {
        step();
        accumulator -= stepMs;
        steps++;
      }
      return steps;
    },
    reset() {
      last = null;
      accumulator = 0;
    },
  };
}
