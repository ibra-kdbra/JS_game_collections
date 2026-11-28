// this will be run in a web worker

// The "Machine Learning" player (ExportedTD0 in players.wasm) fetches its weights itself, with
// an XHR for ../model.bmp, as soon as that strategy is picked. That file was 46 MB; the
// weights now ship rounded and packed as ../model.gz (about 4.3 MB, see td0_weights.js and
// tools/pack-weights.mjs). So the wasm's request is caught here: model.gz is downloaded
// (reporting progress to the page), gunzipped with the browser's DecompressionStream,
// unpacked into the model.bmp layout, and the wasm's XHR is pointed at that, as a blob URL.
// The wasm itself is unchanged.
importScripts("td0_weights.js");

const MODEL_URL = "../model.gz";
const MODEL_BYTES = 4267976;  // size of model.gz, for servers that send no Content-Length
let modelBlobUrl = null;  // one download per worker, even when the strategy is picked again

function fetchModel() {
    if (!modelBlobUrl) {
        modelBlobUrl = (async () => {
            if (typeof DecompressionStream === "undefined") {
                // Chrome 80, Firefox 113 and Safari 16.4 have it.
                throw Object.assign(new Error("no DecompressionStream"), {
                    forPage: "This browser is too old to unpack the AI model",
                });
            }
            const response = await fetch(MODEL_URL);
            if (!response.ok) {
                throw Object.assign(new Error(`HTTP ${response.status} for ${MODEL_URL}`), {
                    forPage: `The AI model failed to download (HTTP ${response.status})`,
                });
            }
            const total = Number(response.headers.get("content-length")) || MODEL_BYTES;
            const reader = response.body.getReader();
            const chunks = [];
            let loaded = 0;
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                loaded += value.byteLength;
                postMessage({ model: { loaded: loaded, total: Math.max(total, loaded) } });
            }
            let packed = new Blob(chunks);
            const head = new Uint8Array(await packed.slice(0, 2).arrayBuffer());
            // A server that labels .gz files Content-Encoding: gzip has had it gunzipped already.
            if (head[0] === 0x1f && head[1] === 0x8b) {
                packed = await new Response(packed.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
            }
            const model = decodeTd0Weights(new Uint8Array(await packed.arrayBuffer()));
            return URL.createObjectURL(new Blob([model]));
        })();
        modelBlobUrl.catch(() => { modelBlobUrl = null; });  // picking the strategy again retries
    }
    return modelBlobUrl;
}

const openRequest = XMLHttpRequest.prototype.open;
const sendRequest = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (method, url) {
    this.isModel = String(url).endsWith("model.bmp");
    return openRequest.apply(this, arguments);
};
XMLHttpRequest.prototype.send = function () {
    if (!this.isModel) return sendRequest.apply(this, arguments);
    const xhr = this;
    xhr.isModel = false;
    fetchModel().then((url) => {
        xhr.addEventListener("loadend", () => {
            postMessage({ model: { done: true, ok: xhr.status === 200 } });
        }, { once: true });
        // Opening again keeps the handlers and responseType the wasm has set.
        openRequest.call(xhr, "GET", url, true);
        sendRequest.call(xhr);
    }, (error) => {
        console.error(error);
        postMessage({ model: { done: true, ok: false, reason: error.forPage } });
        // Fail the wasm's request as a finished one (readyState 4, status 0): Emscripten's
        // fetch treats a request closed before it is done as aborted and reports it again.
        Object.defineProperty(xhr, "readyState", { value: 4 });
        if (xhr.onerror) xhr.onerror(new ProgressEvent("error"));
    });
};

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
                postMessage({ id: e.data[2], move: move });
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
