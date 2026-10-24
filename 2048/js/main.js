const STRATEGY_KEY = "aiStrategy"
const HEURISTIC_KEY = "aiHeuristic"
const STRENGTH_KEY = "aiStrength"
const PAUSE_TIME_KEY = "pauseTime"
const SIZE_KEY = "size"

// Settings saved by older builds under un-namespaced keys
const LEGACY_SETTINGS = {
    "2048-aiStrategy": STRATEGY_KEY,
    "2048-aiHeuristic": HEURISTIC_KEY,
    "2048-aiStrength": STRENGTH_KEY,
    "2048-pauseTime": PAUSE_TIME_KEY,
}

// The WASM players work on a 64-bit bitboard, so they only understand 4x4.
const AI_SIZE = 4
const MODEL_BYTES = 45946360
const MOVE_NAMES = ["↑ up", "→ right", "↓ down", "← left"]

function main(gameManager, playerWorker) {
    const store = GameKit.createStore("2048");
    for (const [oldKey, newKey] of Object.entries(LEGACY_SETTINGS)) {
        GameKit.migrateKey(store, oldKey, newKey);
    }
    // The page now always opens in Play mode, so the old AI on/off flag is unused.
    try {
        localStorage.removeItem("2048-aiOn");
    } catch {}

    const byId = (id) => document.getElementById(id);
    const selected = (name) => document.querySelector(`input[name="${name}"]:checked`);
    const heuristicContainer = byId("heuristicContainer");
    const aiOn = byId("aiOn");
    const aiOff = byId("aiOff");
    const hintButton = byId("hintButton");
    const undoButtons = document.querySelectorAll("[data-undo]");
    const status = byId("status");
    const goal = byId("goalTile");
    const modelStatus = byId("modelStatus");
    const modelProgress = byId("modelProgress");
    const sizeInputs = document.querySelectorAll('input[name="board_size"]');

    let workerReady = false;
    let aiActive = aiOn.checked;
    let requestId = 0;
    let pending = null;  // { id, kind: "play" | "hint", board }
    let nextMove = -1;
    let modelLoading = false;

    const aiSupported = () => gameManager.size === AI_SIZE;

    const request = (kind) => {
        if (!workerReady || !aiSupported()) return;
        requestId += 1;
        const board = gameManager.grid.toBitboard();
        pending = { id: requestId, kind: kind, board: board };
        playerWorker.postMessage([1, board, requestId]);
    };

    const setStatus = (text, kind = "") => {
        if (!status) return;
        status.textContent = text;
        status.dataset.kind = kind;
    };

    const updateStrategy = () => {
        const strategy = selected("ai_strategy");
        const heuristic = selected("ai_heuristic");
        const strength = selected("ai_strength");

        heuristicContainer.classList.toggle("hidden", strategy.getAttribute("data-heuristic") !== "true");

        store.set(STRATEGY_KEY, strategy.id);
        store.set(HEURISTIC_KEY, heuristic.id);
        store.set(STRENGTH_KEY, strength.id);

        if (!workerReady) return;
        playerWorker.postMessage([0, parseInt(strategy.value), parseInt(heuristic.value), parseInt(strength.value)]);
        // Anything asked of the old strategy is stale now.
        pending = null;
        nextMove = -1;
    }

    const syncControls = () => {
        const supported = aiSupported();
        aiOn.disabled = !supported;
        if (!supported) {
            setStatus("Watch AI and hints work on 4\u00d74 only.", "note");
        } else if (status && status.dataset.kind === "note") {
            setStatus("");
        }
        if (hintButton) {
            hintButton.disabled = !supported || aiActive || !workerReady || gameManager.isGameTerminated();
            hintButton.title = supported ? "Ask the AI for a move (?)" : "The AI plays 4×4 only";
        }
        undoButtons.forEach((button) => {
            button.disabled = aiActive || !gameManager.canUndo();
            const label = button.querySelector("[data-undo-count]");
            if (label) label.textContent = gameManager.undosLeft;
        });
        if (goal) goal.textContent = gameManager.winTile();
        document.documentElement.classList.toggle("watching-ai", aiActive);
    };

    const setMode = (watch) => {
        aiActive = watch && aiSupported();
        aiOn.checked = aiActive;
        aiOff.checked = !aiActive;
        pending = null;
        nextMove = -1;
        setStatus(aiActive ? "The AI is playing. Switch to Play to take over." : "");
        syncControls();
    };

    aiOn.onchange = () => setMode(aiOn.checked);
    aiOff.onchange = () => setMode(!aiOff.checked);

    let pauseTime = Number(store.get(PAUSE_TIME_KEY, 50));
    if (isNaN(pauseTime)) pauseTime = 50;
    const pauseTimeElem = byId("pauseTime");
    pauseTimeElem.value = pauseTime.toString()
    pauseTimeElem.onchange = () => {
        if (pauseTimeElem.checkValidity()) {
            pauseTime = parseInt(pauseTimeElem.value);
            store.set(PAUSE_TIME_KEY, pauseTime);
        }
    }

    // select previous strategies from saved settings, if they exist
    for (const key of [STRATEGY_KEY, HEURISTIC_KEY, STRENGTH_KEY]) {
        const saved = store.get(key);
        if (saved) document.getElementById(saved)?.click();
    }
    updateStrategy();

    document.querySelectorAll('input[name="ai_strategy"], input[name="ai_heuristic"], input[name="ai_strength"]')
        .forEach(elem => {
            elem.onchange = updateStrategy
        });

    sizeInputs.forEach((input) => {
        input.checked = parseInt(input.value) === gameManager.size;
        input.onchange = () => {
            const size = parseInt(input.value);
            store.set(SIZE_KEY, size);
            gameManager.setSize(size);
            setMode(aiActive);
            input.blur();
        };
    });

    const showModelProgress = (model) => {
        if (!modelStatus) return;
        if (model.done) {
            modelLoading = false;
            modelStatus.hidden = false;
            modelStatus.querySelector("span").textContent = model.ok
                ? "AI model ready."
                : "The AI model failed to download; random moves are played instead.";
            modelProgress.hidden = true;
            if (model.ok) setTimeout(() => { modelStatus.hidden = true; }, 4000);
            return;
        }
        modelLoading = true;
        const total = model.total || MODEL_BYTES;
        modelStatus.hidden = false;
        modelProgress.hidden = false;
        modelProgress.max = total;
        modelProgress.value = model.loaded;
        const mb = (bytes) => (bytes / 1e6).toFixed(1);
        modelStatus.querySelector("span").textContent =
            `Downloading AI model: ${mb(model.loaded)} / ${mb(total)} MB`;
    };

    const showHint = (move) => {
        if (move < 0 || move > 3) {
            setStatus("The AI has no suggestion here.");
            return;
        }
        const note = modelLoading ? " (model still loading, this one is a guess)" : "";
        setStatus(`AI suggests ${MOVE_NAMES[move]}${note}`, "hint");
    };

    playerWorker.onmessage = (e) => {
        const data = e.data;
        if (!workerReady) {
            workerReady = true;
            updateStrategy();
            syncControls();
            return;
        }
        if (data.model) {
            showModelProgress(data.model);
            return;
        }
        if (!pending || data.id !== pending.id) return;
        const kind = pending.kind;
        const askedFor = pending.board;
        pending = null;
        if (askedFor !== gameManager.grid.toBitboard()) return;  // the board moved on meanwhile
        if (kind === "hint") {
            showHint(data.move);
        } else {
            nextMove = data.move;
        }
    }
    playerWorker.onerror = console.error;

    hintButton?.addEventListener("click", () => {
        if (hintButton.disabled) return;
        setStatus("Thinking…");
        request("hint");
    });

    undoButtons.forEach((button) => {
        button.addEventListener("click", (e) => {
            e.preventDefault();
            gameManager.undo();
        });
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && hintButton && !hintButton.disabled) {
            e.preventDefault();
            hintButton.click();
        }
    });

    let lastBoard = null;
    gameManager.onChange(() => {
        const board = gameManager.grid.size === AI_SIZE ? gameManager.grid.toBitboard() : null;
        if (board !== lastBoard && status && status.dataset.kind === "hint") setStatus("");
        lastBoard = board;
        syncControls();
    });

    let lastMoveTime = 0;
    const playGame = (timestamp) => {
        if (aiActive && workerReady && aiSupported() && !gameManager.isGameTerminated()) {
            if (nextMove !== -1 && lastMoveTime + pauseTime <= timestamp) {
                gameManager.aiPlayed = true;
                if (0 <= nextMove && nextMove < 4) {
                    gameManager.move(nextMove);
                }
                nextMove = -1;
                lastMoveTime = timestamp;
            }
            if (nextMove === -1 && pending === null) {
                request("play");
            }
        }
        window.requestAnimationFrame(playGame);
    }

    window.requestAnimationFrame(playGame);
    syncControls();

    window.printEvals = () => playerWorker.postMessage([2, gameManager.grid.toBitboard()])
}
