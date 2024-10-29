// this will be run in a web worker

var Module = {  // using let will cause issues with redefinition of Module
    onRuntimeInitialized: function () {
        const controller = new AiController();

        onmessage = function(e) {
            const messageType = e.data[0];
            if (messageType === 0) {
                controller.update_strategy(e.data[1], e.data[2], e.data[3]);
            } else if (messageType === 1) {
                const board = e.data[1];
                const move = controller.pick_move(board);
                postMessage(move);
            } else if (messageType === 2) {
                const board = e.data[1];
                console.log(`Score: ${Module.score_heuristic(board)}\n` +
                            `Merge: ${Module.merge_heuristic(board)}\n` +
                            `Corner: ${Module.corner_heuristic(board)}\n` +
                            `Wall Gap: ${Module.wall_gap_heuristic(board)}\n` +
                            `Full Wall: ${Module.full_wall_heuristic(board)}\n` +
                            `Strict Wall: ${Module.strict_wall_heuristic(board)}\n` +
                            `Skewed Corner: ${Module.skewed_corner_heuristic(board)}\n` +
                            `Monotonicity: ${Module.monotonicity_heuristic(board)}`);
            }
        }

        postMessage("ready!");
    }
};

importScripts("players.js");


function AiController() {
    // this.player and this.heuristicId should be updated once the main thread is ready
    this.player = new Module.RandomPlayer();
    this.heuristicId = 0;
}

AiController.prototype.update_strategy = function(strategyId, heuristicId, strength) {
    this.player.delete();
    switch (strategyId) {
        case 0:
            this.player = new Module.RandomPlayer();
            break;
        case 1:
            this.player = new Module.SpamCornerPlayer();
            break;
        case 2:
            this.player = new Module.OrderedPlayer();
            break;
        case 3:
            this.player = new Module.RotatingPlayer();
            break;
        case 4:
            this.player = new Module.RandomTrialsStrategy([4,5,5][strength], [5,4,5][strength], heuristicId);
            this.heuristicId = heuristicId;
            break;
        case 5:
            this.player = new Module.MinimaxStrategy([0,-1,-2][strength], heuristicId);
            this.heuristicId = heuristicId;
            break;
        case 6:
            this.player = new Module.ExpectimaxDepthStrategy([0,-1,-2][strength], heuristicId);
            this.heuristicId = heuristicId;
            break;
        case 7:
            this.player = new Module.ExpectimaxProbabilityStrategy([0.004, 0.001, 0.0004][strength], heuristicId);
            this.heuristicId = heuristicId;
            break;
        case 8:
            this.player = new Module.MonteCarloPlayer([5000,10000,15000][strength]);
            break;
        case 9:
            this.player = new Module.ExportedTD0();
            break;
    }
}

AiController.prototype.pick_move = function(board) {
    const move = this.player.pick_move(board);

    return (move + 3) & 3;  // convert from LURD to URDL
}
