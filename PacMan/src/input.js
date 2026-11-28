// (Handles all key presses and touches)

(function(){

    // A Key Listener class (each key maps to an array of callbacks)
    var KeyEventListener = function() {
        this.listeners = {};
    };
    KeyEventListener.prototype = {
        add: function(key, callback, isActive) {
            this.listeners[key] = this.listeners[key] || [];
            this.listeners[key].push({
                isActive: isActive,
                callback: callback,
            });
        },
        exec: function(key, e) {
            var keyListeners = this.listeners[key];
            if (!keyListeners) {
                return;
            }
            var i,l;
            var numListeners = keyListeners.length;
            for (i=0; i<numListeners; i++) {
                l = keyListeners[i];
                if (!l.isActive || l.isActive()) {
                    e.preventDefault();
                    if (l.callback()) { // do not propagate keys if returns true
                        break;
                    }
                }
            }
        },
    };

    // declare key event listeners
    var keyDownListeners = new KeyEventListener();
    var keyUpListeners = new KeyEventListener();

    // helper functions for adding custom key listeners
    var addKeyDown = function(key,callback,isActive) { keyDownListeners.add(key,callback,isActive); };
    var addKeyUp   = function(key,callback,isActive) { keyUpListeners.add(key,callback,isActive); };

    // boolean states of each key
    var keyStates = {};

    // keys are identified by KeyboardEvent.code (the physical key, whatever the layout);
    // left/right modifier keys and the keypad Enter count as one key, as they did before
    var KEY_ALIASES = {
        ShiftRight: "ShiftLeft",
        ControlRight: "ControlLeft",
        AltRight: "AltLeft",
        NumpadEnter: "Enter",
    };
    var getKey = function(e) {
        e = e||window.event;
        return KEY_ALIASES[e.code] || e.code;
    };

    // hook my key listeners to the window's listeners
    window.addEventListener("keydown", function(e) {
        var key = getKey(e);

        // only execute at first press event
        if (!keyStates[key]) {
            keyStates[key] = true;
            keyDownListeners.exec(key, e);
        }
    });
    window.addEventListener("keyup",function(e) {
        var key = getKey(e);

        keyStates[key] = false;
        keyUpListeners.exec(key, e);
    });


    // key enumerations

    var KEY_ENTER = "Enter";
    var KEY_ESC = "Escape";

    var KEY_LEFT = "ArrowLeft";
    var KEY_RIGHT = "ArrowRight";
    var KEY_UP = "ArrowUp";
    var KEY_DOWN = "ArrowDown";

    var KEY_SHIFT = "ShiftLeft";
    var KEY_CTRL = "ControlLeft";
    var KEY_ALT = "AltLeft";

    var KEY_SPACE = "Space";

    var KEY_M = "KeyM";
    var KEY_N = "KeyN";
    var KEY_Q = "KeyQ";
    var KEY_W = "KeyW";
    var KEY_E = "KeyE";
    var KEY_R = "KeyR";
    var KEY_T = "KeyT";

    var KEY_A = "KeyA";
    var KEY_S = "KeyS";
    var KEY_D = "KeyD";
    var KEY_F = "KeyF";
    var KEY_G = "KeyG";

    var KEY_I = "KeyI";
    var KEY_O = "KeyO";
    var KEY_P = "KeyP";

    var KEY_1 = "Digit1";
    var KEY_2 = "Digit2";

    var KEY_END = "End";

    // Custom Key Listeners

    // Menu Navigation Keys
    var menu;
    var isInMenu = function() {
        menu = (state.getMenu && state.getMenu());
        if (!menu && inGameMenu.isOpen()) {
            menu = inGameMenu.getMenu();
        }
        return menu;
    };
    addKeyDown(KEY_ESC,   function(){ menu.backButton ? menu.backButton.onclick():0; return true; }, isInMenu);
    addKeyDown(KEY_ENTER, function(){ menu.clickCurrentOption(); }, isInMenu);
    var isMenuKeysAllowed = function() {
        var menu = isInMenu();
        return menu && !menu.noArrowKeys;
    };
    addKeyDown(KEY_UP,    function(){ menu.selectPrevOption(); }, isMenuKeysAllowed);
    addKeyDown(KEY_DOWN,  function(){ menu.selectNextOption(); }, isMenuKeysAllowed);
    var isInGameMenuButtonClickable = function() {
        return hud.isValidState() && !inGameMenu.isOpen();
    };
    addKeyDown(KEY_ESC, function() { inGameMenu.getMenuButton().onclick(); return true; }, isInGameMenuButtonClickable);

    // Move Pac-Man
    var isPlayState = function() { return state == learnState || state == newGameState || state == playState || state == readyNewState || state == readyRestartState; };
    addKeyDown(KEY_LEFT,  function() { pacman.setInputDir(DIR_LEFT); },  isPlayState);
    addKeyDown(KEY_RIGHT, function() { pacman.setInputDir(DIR_RIGHT); }, isPlayState);
    addKeyDown(KEY_UP,    function() { pacman.setInputDir(DIR_UP); },    isPlayState);
    addKeyDown(KEY_DOWN,  function() { pacman.setInputDir(DIR_DOWN); },  isPlayState);
    addKeyUp  (KEY_LEFT,  function() { pacman.clearInputDir(DIR_LEFT); },  isPlayState);
    addKeyUp  (KEY_RIGHT, function() { pacman.clearInputDir(DIR_RIGHT); }, isPlayState);
    addKeyUp  (KEY_UP,    function() { pacman.clearInputDir(DIR_UP); },    isPlayState);
    addKeyUp  (KEY_DOWN,  function() { pacman.clearInputDir(DIR_DOWN); },  isPlayState);

    // Slow-Motion
    var isPracticeMode = function() { return isPlayState() && practiceMode; };
    //isPracticeMode = function() { return true; };
    addKeyDown(KEY_1, function() { executive.setUpdatesPerSecond(30); }, isPracticeMode);
    addKeyDown(KEY_2,  function() { executive.setUpdatesPerSecond(15); }, isPracticeMode);
    addKeyUp  (KEY_1, function() { executive.setUpdatesPerSecond(60); }, isPracticeMode);
    addKeyUp  (KEY_2,  function() { executive.setUpdatesPerSecond(60); }, isPracticeMode);

    // Toggle VCR
    var canSeek = function() { return !isInMenu() && vcr.getMode() != VCR_NONE; };
    addKeyDown(KEY_SHIFT, function() { vcr.startSeeking(); },   canSeek);
    addKeyUp  (KEY_SHIFT, function() { vcr.startRecording(); }, canSeek);

    // Adjust VCR seeking
    var isSeekState = function() { return vcr.isSeeking(); };
    addKeyDown(KEY_UP,   function() { vcr.nextSpeed(1); },  isSeekState);
    addKeyDown(KEY_DOWN, function() { vcr.nextSpeed(-1); }, isSeekState);

    // Skip Level
    var canSkip = function() {
        return isPracticeMode() && 
            (state == newGameState ||
            state == readyNewState ||
            state == readyRestartState ||
            state == playState ||
            state == deadState ||
            state == finishState ||
            state == overState);
    };
    addKeyDown(KEY_N, function() { switchState(readyNewState, 60); }, canSkip);
    addKeyDown(KEY_M, function() { switchState(finishState); }, function() { return state == playState; });

    // Draw Actor Targets (fishpoles)
    addKeyDown(KEY_Q, function() { blinky.isDrawTarget = !blinky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_W, function() { pinky.isDrawTarget = !pinky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_E, function() { inky.isDrawTarget = !inky.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_R, function() { clyde.isDrawTarget = !clyde.isDrawTarget; }, isPracticeMode);
    addKeyDown(KEY_T, function() { pacman.isDrawTarget = !pacman.isDrawTarget; }, isPracticeMode);

    // Draw Actor Paths
    addKeyDown(KEY_A, function() { blinky.isDrawPath = !blinky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_S, function() { pinky.isDrawPath = !pinky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_D, function() { inky.isDrawPath = !inky.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_F, function() { clyde.isDrawPath = !clyde.isDrawPath; }, isPracticeMode);
    addKeyDown(KEY_G, function() { pacman.isDrawPath = !pacman.isDrawPath; }, isPracticeMode);

    // Miscellaneous Cheats
    addKeyDown(KEY_I, function() { pacman.invincible = !pacman.invincible; }, isPracticeMode);
    addKeyDown(KEY_O, function() { turboMode = !turboMode; }, isPracticeMode);
    addKeyDown(KEY_P, function() { pacman.ai = !pacman.ai; }, isPracticeMode);

    addKeyDown(KEY_END, function() { executive.togglePause(); });

})();

var initSwipe = function() {

    // position of anchor
    var x = 0;
    var y = 0;

    // current distance from anchor
    var dx = 0;
    var dy = 0;

    // minimum distance from anchor before direction is registered
    var r = 4;

    // touches on the Game Lab kit's own buttons (back link, D-pad) are not swipes
    var onKitControls = false;
    var isKitControl = function(event) {
        return !!(event.target.closest && event.target.closest('.gk-touch'));
    };

    var touchStart = function(event) {
        onKitControls = isKitControl(event);
        if (onKitControls) {
            return;
        }
        var fingerCount = event.touches.length;
        if (fingerCount == 1) {

            // commit new anchor
            x = event.touches[0].pageX;
            y = event.touches[0].pageY;

        }
        else {
            touchCancel(event);
        }
    };

    var touchMove = function(event) {
        if (onKitControls) {
            return;
        }
        var fingerCount = event.touches.length;
        if (fingerCount == 1) {

            // get current distance from anchor
            dx = event.touches[0].pageX - x;
            dy = event.touches[0].pageY - y;

            // if minimum move distance is reached
            if (dx*dx+dy*dy >= r*r) {

                // commit new anchor
                x += dx;
                y += dy;

                // register direction
                if (Math.abs(dx) >= Math.abs(dy)) {
                    pacman.setInputDir(dx>0 ? DIR_RIGHT : DIR_LEFT);
                }
                else {
                    pacman.setInputDir(dy>0 ? DIR_DOWN : DIR_UP);
                }
            }
        }
        else {
            touchCancel(event);
        }
    };

    var touchEnd = function(event) {
        if (onKitControls) {
            return;
        }
        event.preventDefault();
    };

    var touchCancel = function(event) {
        // Also called from the passive touchstart/touchmove handlers on multi-touch.
        if (event.type === "touchcancel") event.preventDefault();
        x=y=dx=dy=0;
    };

    var touchTap = function(event) {
        // tap to clear input directions
        pacman.clearInputDir(undefined);
    };
    
    // register touch events
    document.onclick = touchTap;
    // Passive (as browsers treat them anyway): `touch-action: none` stops scrolling.
    document.addEventListener('touchstart', touchStart, { passive: true });
    document.ontouchend = touchEnd;
    document.addEventListener('touchmove', touchMove, { passive: true });
    document.ontouchcancel = touchCancel;
};
