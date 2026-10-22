import puzzleSystem from './puzzle.js';

let update = (entities, entity) => {
    let sequence = entities.game.levels.sequence;
    let currentPuzzleId = sequence[entities.game.levels.current];
    let dots = [];
    let puzzleIds = [];
    sequence.forEach(puzzleId => {
        let puzzle = entities[puzzleId].puzzle;
        if (puzzle.grid.length) {
            let dot = 0;
            if (puzzleSystem.isSolved(puzzleId)) {
                dot = dot + 1;
            }
            if (puzzleId === currentPuzzleId) {
                dot = dot + 2;
            }
            dots.push(dot);
            puzzleIds.push(puzzleId);
        }
    });
    entity.progress.dots = dots;
    let x = entities.game.pointer.x - entities.game.canvas.gW / 2 + dots.length * 6;
    let y = entities.game.pointer.y - entities.game.canvas.gH / 2 - entity.position.y;
    if (y < 0 || y > 8 || x < 0 || x > dots.length * 12) {
        return;
    }
    entities.game.pointer.pointing = true;
    if (entities.game.pointer.justUp) {
        let target = (x / 12) | 0;
        puzzleSystem.navigate(sequence.indexOf(puzzleIds[target]));
    }
};

export default Object.freeze({
    update
});
