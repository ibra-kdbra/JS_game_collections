const elementById = (id) => document.getElementById(id);

const titleElement = elementById('title');
const gameElement = elementById('game');
const loadingElement = elementById('loading');
const menuElement = elementById('menu');
const levelDoneElement = elementById('levelDone');
const nextMsg = elementById('nextMsg');
const nextBtn = elementById('nextBtn');
const startBtn = elementById('startBtn');
const continueBtn = elementById('continueBtn');
const contentElement = elementById('content');
const resetElement = elementById('reset');
const resetBtn = elementById('resetBtn');
const levelInfo = elementById('levelInfo');
const nodeInfo = elementById('nodeInfo');
const descriptionElement = elementById('description');

const skipBtn = elementById('skipBtn');
const backBtn = elementById('backBtn');

const levelSelectElement = elementById('levelSelect');
const levelGrid = elementById('levelGrid');
const levelsBtn = elementById('levelsBtn');
const menuLevelsBtn = elementById('menuLevelsBtn');
const closeLevelsBtn = elementById('closeLevelsBtn');

const store = GameKit.createStore('rewire');

const saveLevel = (level) => store.set('level', level);
const loadLevel = () => parseInt(store.get('level', 0), 10) || 0;
const loadSolved = () => store.get('solved', []);

// Remember a solved level and report progress to the hub
const markSolved = (level) => {
    const solved = loadSolved();
    if (!solved.includes(level)) {
        solved.push(level);
        store.set('solved', solved);
    }
    GameKit.recordBest('rewire', solved.length, {
        label: `${solved.length} of ${gameData.levels.length} levels`
    });
};

const removeElement = (element) => {
    element.parentNode.removeChild(element);
};

const fadeTime = 0.4;

const showElement = (element, onComplete) => {
    let elements = Array.isArray(element) ? element : [element];
    elements.forEach(e => {
        e.style.visibility = 'visible';
        e.style.opacity = '0';
    });
    tween(0, 1, fadeTime,
        (t) => {
            elements.forEach(e => {
                e.style.opacity = t.toString();
            });
        },
        () => {
            onComplete && onComplete();
        }
    );
};

const hideElement = (element, onComplete) => {
    let elements = Array.isArray(element) ? element : [element];
    tween(1, 0, fadeTime,
        (t) => {
            elements.forEach(e => {
                e.style.opacity = t.toString();
            });
        },
        () => {
            elements.forEach(e => {
                e.style.visibility = 'hidden';
            });
            onComplete && onComplete();
        }
    );
};

// The stage is a fixed 1280 x 720 box scaled to fit the window. On phones held
// upright it is turned sideways so it can use the long side of the screen.
//
// When the stage gets small (phones), its buttons and labels would shrink
// below a usable size, so the page switches to a compact layout: the buttons
// move into a bar next to the stage (below it, or beside it when that leaves
// the stage bigger), and buttons, labels and menus are laid out in real CSS
// pixels (zoomed by 1 / stage scale) so they keep a usable size.
const stageWidth = 1280;
const stageHeight = 720;
let stageScale = 1;
let stageRotated = false;

const COMPACT_BELOW = 0.85; // stage scale under which the compact layout is used
const BAR = 52;             // compact button bar, CSS px (44px buttons + margins)
const SIDE = 120;           // compact side column, CSS px

// Safe-area insets (notches, home indicator) measured from CSS env().
const safeProbe = document.createElement('div');
safeProbe.style.cssText = 'position:fixed;inset:0;visibility:hidden;pointer-events:none;'
    + 'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
document.body.appendChild(safeProbe);

const resize = () => {
    const cs = getComputedStyle(safeProbe);
    const width = window.innerWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const height = window.innerHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    stageRotated = height > width && width < 700;
    // Available box in stage orientation
    const fitW = stageRotated ? height : width;
    const fitH = stageRotated ? width : height;
    const plain = Math.min(fitW / stageWidth, fitH / stageHeight);
    let layout = 'full';
    stageScale = plain;
    if (plain < COMPACT_BELOW) {
        const below = Math.min(fitW / stageWidth, (fitH - BAR) / stageHeight);
        const side = Math.min((fitW - SIDE) / stageWidth, fitH / stageHeight);
        layout = side >= below ? 'side' : 'below';
        stageScale = Math.max(below, side);
    }
    // Offset (stage orientation) that centres stage + bar together
    let ox = 0;
    let oy = 0;
    if (layout === 'below') oy = -BAR / 2;
    if (layout === 'side') ox = -SIDE / 2;
    const [dx, dy] = stageRotated ? [-oy, ox] : [ox, oy];
    const sx = (parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) / 2;
    const sy = (parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / 2;
    gameElement.style.transform = `translate(${dx + sx}px, ${dy + sy}px) ${stageRotated ? 'rotate(90deg) ' : ''}scale(${stageScale})`;
    gameElement.dataset.layout = layout;
    gameElement.style.setProperty('--inv', String(1 / stageScale));
    gameElement.style.setProperty('--s', String(stageScale));
};

// Canvas backing store matching the device pixels the stage covers
const stageResolution = () => Math.min(3, Math.max(1, stageScale * (window.devicePixelRatio || 1)));

const createStageCanvas = () => {
    const [canvas, context] = createCanvas(stageWidth, stageHeight);
    canvas.style.width = stageWidth + 'px';
    canvas.style.height = stageHeight + 'px';
    fitStageCanvas(canvas, context);
    return [canvas, context];
};

const fitStageCanvas = (canvas, context) => {
    const k = stageResolution();
    const w = Math.round(stageWidth * k);
    if (canvas.width !== w) {
        canvas.width = w;
        canvas.height = Math.round(stageHeight * k);
    }
    context.setTransform(canvas.width / stageWidth, 0, 0, canvas.height / stageHeight, 0, 0);
};

const toggleMusicBtn = elementById('toggleMusic');
const toggleFxBtn = elementById('toggleFx');

const setMutedLook = (button, isMuted) => {
    button.classList.toggle('muted', isMuted);
    button.setAttribute('aria-pressed', String(isMuted));
};

toggleMusicBtn.addEventListener('click', () => {
    const isMuted = toggleMusic();
    setMutedLook(toggleMusicBtn, isMuted);
    store.set('musicMuted', isMuted);
});

toggleFxBtn.addEventListener('click', () => {
    const isMuted = toggleFx();
    setMutedLook(toggleFxBtn, isMuted);
    store.set('fxMuted', isMuted);
});

if (store.get('musicMuted', false)) setMutedLook(toggleMusicBtn, toggleMusic());
if (store.get('fxMuted', false)) setMutedLook(toggleFxBtn, toggleFx());

window.addEventListener('resize', resize);
resize();
