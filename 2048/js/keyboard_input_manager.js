function KeyboardInputManager() {
  this.events = {};

  if (window.navigator.msPointerEnabled) {
    //Internet Explorer 10 style
    this.eventTouchstart    = "MSPointerDown";
    this.eventTouchmove     = "MSPointerMove";
    this.eventTouchend      = "MSPointerUp";
  } else {
    this.eventTouchstart    = "touchstart";
    this.eventTouchmove     = "touchmove";
    this.eventTouchend      = "touchend";
  }

  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;

  // Keyed by event.code (the physical key), so WASD and HJKL stay put on any layout
  var map = {
    ArrowUp: 0,
    ArrowRight: 1,
    ArrowDown: 2,
    ArrowLeft: 3,
    KeyK: 0, // Vim up
    KeyL: 1, // Vim right
    KeyJ: 2, // Vim down
    KeyH: 3, // Vim left
    KeyW: 0,
    KeyD: 1,
    KeyS: 2,
    KeyA: 3
  };

  // Respond to direction keys
  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map.hasOwnProperty(event.code) ? map[event.code] : undefined;
    var target    = event.target;

    // Let people type in the settings fields.
    if (target.isContentEditable || target.tagName === "TEXTAREA" ||
        (target.tagName === "INPUT" && target.type !== "radio" && target.type !== "checkbox")) {
      return;
    }

    // U or Ctrl/Cmd+Z undoes the last move (Z as labelled, like the usual undo shortcut)
    if ((!modifiers && event.code === "KeyU") ||
        ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey &&
         (event.key === "z" || event.key === "Z"))) {
      event.preventDefault();
      self.emit("undo");
      return;
    }

    if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }
    }

    // R key restarts the game
    if (!modifiers && event.code === "KeyR") {
      self.restart.call(self, event);
    }
  });

  // Respond to button presses
  this.bindButtonPress(".retry-button", this.restart);
  this.bindButtonPress(".restart-button", this.restart);
  this.bindButtonPress(".keep-playing-button", this.keepPlaying);

  // Respond to swipe events
  var touchStartClientX, touchStartClientY;
  var gameContainer = document.getElementsByClassName("game-container")[0];

  gameContainer.addEventListener(this.eventTouchstart, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 1) ||
        event.targetTouches.length > 1) {
      return; // Ignore if touching with more than 1 finger
    }

    if (window.navigator.msPointerEnabled) {
      touchStartClientX = event.pageX;
      touchStartClientY = event.pageY;
    } else {
      touchStartClientX = event.touches[0].clientX;
      touchStartClientY = event.touches[0].clientY;
    }

    event.preventDefault();
  }, { passive: false });

  gameContainer.addEventListener(this.eventTouchmove, function (event) {
    event.preventDefault();
  }, { passive: false });

  gameContainer.addEventListener(this.eventTouchend, function (event) {
    if ((!window.navigator.msPointerEnabled && event.touches.length > 0) ||
        event.targetTouches.length > 0) {
      return; // Ignore if still touching with one or more fingers
    }

    var touchEndClientX, touchEndClientY;

    if (window.navigator.msPointerEnabled) {
      touchEndClientX = event.pageX;
      touchEndClientY = event.pageY;
    } else {
      touchEndClientX = event.changedTouches[0].clientX;
      touchEndClientY = event.changedTouches[0].clientY;
    }

    var dx = touchEndClientX - touchStartClientX;
    var absDx = Math.abs(dx);

    var dy = touchEndClientY - touchStartClientY;
    var absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 10) {
      // (right : left) : (down : up)
      self.emit("move", absDx > absDy ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }
  });
};

KeyboardInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};

KeyboardInputManager.prototype.keepPlaying = function (event) {
  event.preventDefault();
  this.emit("keepPlaying");
};

KeyboardInputManager.prototype.bindButtonPress = function (selector, fn) {
  var button = document.querySelector(selector);
  button.addEventListener("click", fn.bind(this));
  button.addEventListener(this.eventTouchend, fn.bind(this));
};

function DummyKeyboardInputManager() {}
DummyKeyboardInputManager.prototype.on = function (event, callback) {}
DummyKeyboardInputManager.prototype.emit = function (event, data) {}
DummyKeyboardInputManager.prototype.listen = function (event, data) {}
DummyKeyboardInputManager.prototype.restart = function (event) {}
DummyKeyboardInputManager.prototype.keepPlaying = function (event) {}
DummyKeyboardInputManager.prototype.bindButtonPress = function (selector, fn) {}