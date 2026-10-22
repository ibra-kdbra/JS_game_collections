// Arrow keys or WASD to move, Enter or Space to roll.
const KEY_ALIASES = {
  ArrowDown: "ArrowDown",
  ArrowUp: "ArrowUp",
  ArrowLeft: "ArrowLeft",
  ArrowRight: "ArrowRight",
  Enter: "Enter",
  " ": "Enter",
  w: "ArrowUp",
  a: "ArrowLeft",
  s: "ArrowDown",
  d: "ArrowRight",
};
const toAction = (e) => KEY_ALIASES[e.key.length === 1 ? e.key.toLowerCase() : e.key];

export class InputHandler {
  constructor() {
    this.keys = [];
    window.addEventListener("keydown", (e) => {
      const key = toAction(e);
      // Let Enter/Space activate a focused menu button instead of rolling.
      if (!key || e.target.closest?.("button, a")) return;
      e.preventDefault();
      if (this.keys.indexOf(key) === -1) this.keys.push(key);
    });
    window.addEventListener("keyup", (e) => {
      const index = this.keys.indexOf(toAction(e));
      if (index !== -1) this.keys.splice(index, 1);
    });
  }
  reset() {
    this.keys.length = 0;
  }
}
