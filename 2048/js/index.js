const playerWorker = new Worker("js/ai_controller.js");
main(new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager), playerWorker);
