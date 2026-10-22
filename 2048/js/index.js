GameKit.initShell({ slug: "2048" });

const savedSize = Number(GameKit.createStore("2048").get("size", 4));
const boardSize = GameManager.WIN_TILE[savedSize] ? savedSize : 4;
const playerWorker = new Worker("js/ai_controller.js");
main(new GameManager(boardSize, KeyboardInputManager, HTMLActuator, LocalStorageManager), playerWorker);
