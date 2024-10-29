const gameManager = new GameManager(4, DummyKeyboardInputManager, HTMLActuator, DummyStorageManager);
// clear grid
gameManager.grid = new Grid(gameManager.size);
gameManager.actuate();

const replayTool = {
    gameManager: gameManager,
    currentIndex: 0,
    gameRecord: "",

    getPosition: (c) => {
        const index = c.toLowerCase().charCodeAt(0) - 'a'.charCodeAt(0);
        const x = index % 4;
        const y = Math.floor(index / 4);
        return {x: 3 - x, y: 3 - y};
    },
    getValue: (c) => /^[A-Z]*$/.test(c) ? 4 : 2,  // placing down a 4 is recorded as an uppercase character
    getMove: (c) => "urdl".indexOf(c),
    // recalculating the grid each time is inefficient but should be fast enough
    calculateGrid: function(index) {
        const localGameManager = new GameManager(4, DummyKeyboardInputManager, DummyActuator, DummyStorageManager);
        localGameManager.grid = new Grid(localGameManager.size);  // clear grid
        for (let i = 0; i < index; ++i) {
            if (i === 0 || i % 2 === 1) {
                const position = this.getPosition(this.gameRecord[i]);
                const value = this.getValue(this.gameRecord[i]);
                const tile = new Tile(position, value);
                localGameManager.grid.insertTile(tile);
            } else {
                const move = this.getMove(this.gameRecord[i]);
                if (move === -1) {
                    alert("Record is invalid at position " + i);
                }
                localGameManager.move(move, false);
            }
        }
        return localGameManager.grid;
    },
    copyValues: function(sourceGrid, targetGrid) {
        sourceGrid.eachCell((x, y, tile) => {
            if (tile) {
                if (targetGrid.cells[x][y]) {
                    targetGrid.cells[x][y].value = tile.value;
                } else {
                    targetGrid.insertTile(tile)
                }
            } else {
                targetGrid.removeTile(new Tile({x: x, y: y}, 0));
            }
        });
    },
    goToIndex: function(index) {
        this.setCurrentIndex(index);
        this.copyValues(this.calculateGrid(this.currentIndex), this.gameManager.grid);
        this.gameManager.prepareTiles();  // the animations look backwards, so let's just disable them
        this.gameManager.actuate();
    },
    goBack: function() {
        if (this.currentIndex === 0) return;
        this.goToIndex(this.currentIndex - 1)
    },
    goForward: function() {
        if (this.currentIndex === this.gameRecord.length) return;
        if (this.currentIndex === 0 || this.currentIndex % 2 === 1) {
            const position = this.getPosition(this.gameRecord[this.currentIndex]);
            const value = this.getValue(this.gameRecord[this.currentIndex]);
            const tile = new Tile(position, value);
            this.gameManager.prepareTiles();
            this.gameManager.grid.insertTile(tile);
            this.gameManager.actuate();
        } else {
            const move = this.getMove(this.gameRecord[this.currentIndex]);
            if (move === -1) {
                alert(`Record is invalid at position ${this.currentIndex}. Move is not one of "urdl".`);
            }
            if (this.gameManager.move(move, false) === false) {
                alert(`Record is invalid at position ${this.currentIndex}. Move doesn't change board.`);
            }
        }

        this.setCurrentIndex(this.currentIndex + 1);
    },
    jumpBack:    function() { this.goToIndex(Math.max(0, this.currentIndex - 250)); },
    jumpForward: function() { this.goToIndex(Math.min(this.gameRecord.length, this.currentIndex + 250)) },
    skipToStart: function() { this.goToIndex(0) },
    skipToEnd:   function() { this.goToIndex(this.gameRecord.length) },
    updateRecord: function(changeIndex=true) {
        this.gameRecord = document.getElementById("gameRecord").value;
        this.gameManager.grid = new Grid(this.gameManager.size);
        this.gameManager.actuate();

        const display = document.getElementById("gameRecordDisplay");
        while (display.lastElementChild) display.removeChild(display.lastElementChild);
        [...this.gameRecord].forEach((c, idx) => {
            const span = document.createElement("span");
            span.classList.add("record-display");
            span.setAttribute("data-index", (idx + 1).toString());
            span.textContent = c;
            span.onclick = () => this.goToIndex(idx + 1);

            display.appendChild(span);
        });
        if (changeIndex) this.setCurrentIndex(0);
    },
    setCurrentIndex: function(index) {
        document.querySelector("span.record-display.highlighted")?.classList?.remove("highlighted");
        this.currentIndex = index;
        if (index > 0) {
            const new_highlight = document.querySelector(`span.record-display[data-index="${index}"]`);
            new_highlight.classList.add("highlighted");
            new_highlight.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
        } else {
            document.querySelector(`span.record-display[data-index="1"]`).scrollIntoView({
                behavior: 'auto', block: 'nearest', inline: 'center'
            });
        }

        const label = document.getElementById("gameRecordLabel")
        label.textContent = `${index}/${this.gameRecord.length}`
    }
}

document.getElementById("goBackButton").onclick = replayTool.goBack.bind(replayTool);
document.getElementById("goForwardButton").onclick = replayTool.goForward.bind(replayTool);
document.getElementById("jumpBackButton").onclick = replayTool.jumpBack.bind(replayTool);
document.getElementById("jumpForwardButton").onclick = replayTool.jumpForward.bind(replayTool);
document.getElementById("skipToStartButton").onclick = replayTool.skipToStart.bind(replayTool);
document.getElementById("skipToEndButton").onclick = replayTool.skipToEnd.bind(replayTool);
document.getElementById("gameRecord").onchange = replayTool.updateRecord.bind(replayTool);

document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") replayTool.goBack();
    if (event.key === "ArrowRight") replayTool.goForward();
});

replayTool.updateRecord(false)