const STRATEGY_KEY = "2048-aiStrategy"
const HEURISTIC_KEY = "2048-aiHeuristic"
const STRENGTH_KEY = "2048-aiStrength"
const ACTIVE_KEY = "2048-aiOn"
const PAUSE_TIME_KEY = "2048-pauseTime"

function main(gameManager, playerWorker) {
    const heuristicContainer = document.getElementById("heuristicContainer");
    const updateStrategy = () => {
        const selectedStrategy = document.querySelector('input[name="ai_strategy"]:checked');
        const strategyId = parseInt(selectedStrategy.value);

        const hasHeuristic = selectedStrategy.getAttribute("data-heuristic") === "true";
        if (hasHeuristic) {
            heuristicContainer.classList.remove("hidden");
        } else {
            heuristicContainer.classList.add("hidden");
        }

        const selectedHeuristic = document.querySelector('input[name="ai_heuristic"]:checked')
        const heuristicId = parseInt(selectedHeuristic.value);

        const selectedStrength = document.querySelector('input[name="ai_strength"]:checked')
        const strengthVal = parseInt(selectedStrength.value)

        playerWorker.postMessage([0, strategyId, heuristicId, strengthVal]);

        localStorage.setItem(STRATEGY_KEY, selectedStrategy.id);
        localStorage.setItem(HEURISTIC_KEY, selectedHeuristic.id);
        localStorage.setItem(STRENGTH_KEY, selectedStrength.id);
    }

    // initialize settings, read values from localStorage if they exist
    const aiOn = document.getElementById("aiOn");
    const aiOff = document.getElementById("aiOff");
    let aiActive = localStorage.getItem(ACTIVE_KEY) !== "false";
    if (aiActive) {
        aiOn.checked = true;
        aiOff.checked = false;
    } else {
        aiOn.checked = false;
        aiOff.checked = true;
    }
    aiOn.onchange = () => {
        aiActive = aiOn.checked
        localStorage.setItem(ACTIVE_KEY, aiActive.toString())
    }
    aiOff.onchange = () => {
        aiActive = !aiOff.checked
        localStorage.setItem(ACTIVE_KEY, aiActive.toString())
    }

    let pauseTime = parseInt(localStorage.getItem(PAUSE_TIME_KEY));
    if (isNaN(pauseTime)) pauseTime = 50;
    const pauseTimeElem = document.getElementById("pauseTime");
    pauseTimeElem.value = pauseTime.toString()
    pauseTimeElem.onchange = () => {
        if (pauseTimeElem.checkValidity()) {
            pauseTime = parseInt(pauseTimeElem.value);
            localStorage.setItem(PAUSE_TIME_KEY, pauseTime.toString());
        }
    }

    // select previous strategies from saved settings, if they exist
    document.getElementById(localStorage.getItem(STRATEGY_KEY))?.click();
    document.getElementById(localStorage.getItem(HEURISTIC_KEY))?.click();
    document.getElementById(localStorage.getItem(STRENGTH_KEY))?.click();

    document.querySelectorAll('input[name="ai_strategy"]').forEach(elem => {
        elem.onchange = updateStrategy
    })
    document.querySelectorAll('input[name="ai_heuristic"]').forEach(elem => {
        elem.onchange = updateStrategy
    })
    document.querySelectorAll('input[name="ai_strength"]').forEach(elem => {
        elem.onchange = updateStrategy
    })

    let workerReady = false;

    let nextMove = -1;  // -1 is waiting for response, -2 is waiting for game to restart
    playerWorker.onmessage = (e) => {
        if (!workerReady) {
            workerReady = true;
            updateStrategy();
            playerWorker.postMessage([1, gameManager.grid.toBitboard()]);
        } else {
            nextMove = e.data
        }
    }
    playerWorker.onerror = console.error;

    const MAX_WAIT_TIME = 10000;
    let lastMoveTime = 0;
    const playGame = (timestamp) => {
        if (aiActive && workerReady && !gameManager.isGameTerminated() &&
            lastMoveTime + pauseTime <= timestamp && nextMove !== -1)
        {
            if (0 <= nextMove && nextMove < 4) {
                gameManager.move(nextMove);
            }
            nextMove = -1;

            if (!gameManager.isGameTerminated()) {
                playerWorker.postMessage([1, gameManager.grid.toBitboard()]);
                lastMoveTime = timestamp;
            } else {
                nextMove = -2;
            }
        } else if (aiActive && !gameManager.isGameTerminated() && lastMoveTime + MAX_WAIT_TIME <= timestamp) {
            console.warn("No move in the last 10 seconds!");
            playerWorker.postMessage([1, gameManager.grid.toBitboard()]);
            lastMoveTime = timestamp;
        }
        window.requestAnimationFrame(playGame);
    }

    window.requestAnimationFrame(playGame);

    window.printEvals = () => playerWorker.postMessage([2, gameManager.grid.toBitboard()])
}
