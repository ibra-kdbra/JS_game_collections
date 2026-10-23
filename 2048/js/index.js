GameKit.initShell({ slug: "2048" });

const savedSize = Number(GameKit.createStore("2048").get("size", 4));
const boardSize = GameManager.WIN_TILE[savedSize] ? savedSize : 4;
const playerWorker = new Worker("js/ai_controller.js");
main(new GameManager(boardSize, KeyboardInputManager, HTMLActuator, LocalStorageManager), playerWorker);

// Phones: size the board so it fits below the controls without scrolling
// (beside them in landscape). Runs at most once per frame while resizing.
(function fitBoard() {
  const board = document.querySelector(".game-container");
  let queued = false;
  const fit = () => {
    queued = false;
    const top = board.getBoundingClientRect().top + window.scrollY;
    const avail = Math.floor(window.innerHeight - top - 12);
    document.documentElement.style.setProperty("--board-max", Math.max(avail, 220) + "px");
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(fit);
  };
  window.addEventListener("resize", queue);
  window.addEventListener("orientationchange", queue);
  if (document.fonts) document.fonts.ready.then(queue);
  fit();
})();
