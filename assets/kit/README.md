# Game Lab kit

Small, dependency-free helpers every game can opt into. Plain ES modules, no build step.

| Module | What it gives you |
| --- | --- |
| `storage.js` | `createStore(slug)` namespaced, never-throwing `get/set/remove`; `recordBest(slug, value, { lowerIsBetter, mode, label })` saves personal bests the hub can display; `migrateKey` moves old un-namespaced keys. |
| `loop.js` | `createLoop({ update(dt), render(alpha) })` fixed-timestep loop (60 steps/s by default) that pauses when the tab is hidden. `createStepper()` does the same for engines that own their loop (p5, LittleJS). |
| `input.js` | `createTouchControls({ dpad, buttons })` on-screen controls that dispatch real `KeyboardEvent`s with `key`, `code`, `keyCode` and `which`, so existing keyboard handlers work unchanged. Optional `repeatMs` repeats a held button; `repeatDelayMs` sets the wait before the first repeat so a tap never counts twice. `onSwipe(el, cb)` and `tapKey(key)`. |
| `shell.js` | `initShell({ slug })` loads the kit styles and records the game as recently played for the hub. It adds nothing to the page: games open in their own tab and fill the whole window. |
| `index.js` | Loads everything and exposes `window.GameKit` for classic-script games. |

## Typical setup

```html
<script type="module">
  import { initShell } from '../assets/kit/shell.js';
  import { createTouchControls } from '../assets/kit/input.js';

  initShell({ slug: 'tetris' });
  createTouchControls({
    dpad: { left: 'ArrowLeft', right: 'ArrowRight', down: 'ArrowDown' },
    buttons: [{ label: 'Rotate', key: 'ArrowUp' }, { label: 'Hold', key: 'c', small: true }],
  });
</script>
```

Classic scripts:

```html
<script type="module" src="../assets/kit/index.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    const store = GameKit.createStore('raven');
    GameKit.initShell({ slug: 'raven' });
  });
</script>
```

## Rules of thumb

- Storage keys are `<slug>.<key>`; bests live in `gamelab.best.<slug>`. Slugs match `assets/js/data.js`.
- Touch controls render only on touch-first devices (`pointer: coarse`) unless `show: 'always'`.
  Leave room for them: the class `gk-has-touch` is set on `<html>` when they are visible.
- Game logic should advance in fixed steps, never once per animation frame.
