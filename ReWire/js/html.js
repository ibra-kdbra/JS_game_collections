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
const stageWidth = 1280;
const stageHeight = 720;
let stageScale = 1;
let stageRotated = false;

const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    stageRotated = height > width && width < 700;
    const fitW = stageRotated ? height : width;
    const fitH = stageRotated ? width : height;
    stageScale = Math.min(fitW / stageWidth, fitH / stageHeight);
    gameElement.style.transform = `${stageRotated ? 'rotate(90deg) ' : ''}scale(${stageScale})`;
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
