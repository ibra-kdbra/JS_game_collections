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

const saveLevel = (level) => {
    try {
        localStorage.setItem('level', '' + level);
    } catch (e) {
        // IE and edge don't support localstorage when opening the file from disk
    }
};

const loadLevel = () => {
    try {
        return parseInt(localStorage.getItem('level')) || 0;
    } catch (e) {
        return 0;
    }
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

const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const gameWidth = 1280;
    const gameHeight = 720;
    const scale = Math.min(width / gameWidth, height / gameHeight);
    gameElement.style.transform = `scale(${scale})`;
};

window.addEventListener('resize', resize);
resize();
