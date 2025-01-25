import { Board } from './board.js';

export class View {
  constructor(rootEl, players = 1) {
    this.rootEl = rootEl;
    this.players = players;
    this.board = new Board(100, 70);
    // Speed depends on the difficulty setting
    this.speed = window.speed ? window.speed : 35;
    this.setupGrid();
  }

  startGame() {
    this.intervalId = window.setInterval(
      this.step.bind(this),
      this.speed
    );

    window.addEventListener("keydown", this.handleKeyEvent.bind(this));
    window.addEventListener("click", this.handleDifficultyChange.bind(this));
  }

  static KEYS1 = {
    38: "N", // Up
    39: "E", // Right
    40: "S", // Down
    37: "W"  // Left
  };

  static KEYS2 = {
    87: "N", // W
    68: "E", // D
    83: "S", // S
    65: "W"  // A
  };

  handleKeyEvent(event) {
    if (View.KEYS1[event.keyCode]) {
      this.board.player1.turn(View.KEYS1[event.keyCode]);
    } else if (this.players === 2 && View.KEYS2[event.keyCode]) {
      this.board.player2.turn(View.KEYS2[event.keyCode]);
    } else {
      // Ignore other keys or implement additional functionality
    }
  }

  handleDifficultyChange(event) {
    const target = event.target.className;
    const easyBtn = document.querySelector('.easy');
    const mediumBtn = document.querySelector('.medium');
    const hardBtn = document.querySelector('.hard');

    if (target === "easy") {
      easyBtn.style.color = 'red';
      mediumBtn.style.color = 'white';
      hardBtn.style.color = 'white';
      window.difficulty = 1;
      window.speed = 35;
    } else if (target === "medium") {
      easyBtn.style.color = 'white';
      mediumBtn.style.color = 'red';
      hardBtn.style.color = 'white';
      window.difficulty = 2;
      window.speed = 30;
    } else if (target === "hard") {
      easyBtn.style.color = 'white';
      mediumBtn.style.color = 'white';
      hardBtn.style.color = 'red';
      window.difficulty = 3;
      window.speed = 25;
    }
  }

  setupGrid() {
    let html = "";

    for (let i = 0; i < this.board.dimY; i++) {
      html += "<ul>";
      for (let j = 0; j < this.board.dimX; j++) {
        html += "<li></li>";
      }
      html += "</ul>";
    }

    this.rootEl.innerHTML = html;
    this.$li = this.rootEl.querySelectorAll("li");
  }

  step() {
    const { player1, player2 } = this.board;

    if (player1.alive && player2.alive) {
      player1.move();
      if (this.players === 2) {
        player2.move();
      } else {
        player2.computerMove();
      }
      this.render();
    } else {
      window.clearInterval(this.intervalId);
      document.getElementById('replay').style.display = 'block';

      if (this.players === 2) {
        if (this.checkWinner() === "Player 1") {
          document.getElementById('player1-win').style.display = 'block';
          window.wins.blue++;
        } else {
          document.getElementById('player2-win').style.display = 'block';
          window.wins.red++;
        }
      } else {
        if (this.checkWinner() === "Player 1") {
          document.getElementById('you-win').style.display = 'block';
          window.wins.blue++;
        } else {
          document.getElementById('computer-win').style.display = 'block';
          window.wins.red++;
        }
      }
      this.updateScore();
    }
  }

  updateScore() {
    document.querySelector('.red-wins').textContent = window.wins.red;
    document.querySelector('.blue-wins').textContent = window.wins.blue;
  }

  render() {
    this.updateClasses(this.board.player1.segments, "player");
    this.updateClasses(this.board.player2.segments, "player2");
  }

  updateClasses(coords, className) {
    coords.forEach(coord => {
      const coordIdx = (coord.i * this.board.dimX) + coord.j;
      if (this.$li[coordIdx]) {
        this.$li[coordIdx].classList.add(className);
      }
    });
  }

  checkWinner() {
    if (!this.board.player1.alive) {
      return "Player 2";
    } else {
      return "Player 1";
    }
  }
}
