// Saves are namespaced by the Game Lab kit (window.GameKit) as "2048.<key>",
// with one game state and one best score per board size.
function LocalStorageManager() {
  this.store = GameKit.createStore("2048");

  // Older builds kept a single 4x4 game under un-namespaced keys.
  GameKit.migrateKey(this.store, "bestScore", "best-4", { parse: Number });
  GameKit.migrateKey(this.store, "gameState", "state-4", { parse: JSON.parse });
}

LocalStorageManager.prototype.getBestScore = function (size) {
  return Number(this.store.get("best-" + size, 0)) || 0;
};

LocalStorageManager.prototype.setBestScore = function (size, score) {
  this.store.set("best-" + size, score);
  GameKit.recordBest("2048", score, {
    mode: size + "x" + size,
    label: score + " on " + size + "×" + size
  });
};

LocalStorageManager.prototype.getGameState = function (size) {
  return this.store.get("state-" + size);
};

LocalStorageManager.prototype.setGameState = function (size, gameState) {
  this.store.set("state-" + size, gameState);
};

LocalStorageManager.prototype.clearGameState = function (size) {
  this.store.remove("state-" + size);
};

function DummyStorageManager() {}
DummyStorageManager.prototype.getBestScore = () => { return 0 }
DummyStorageManager.prototype.setBestScore = () => {}
DummyStorageManager.prototype.getGameState = () => { return null }
DummyStorageManager.prototype.setGameState = () => {}
DummyStorageManager.prototype.clearGameState = () => {}
