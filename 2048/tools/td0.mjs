/**
 * Helpers for the weights of the "Machine Learning" player, shared by pack-weights.mjs (which
 * writes 2048/model.gz and measures it) and verify-weights.mjs (the CI check):
 *
 *   readModel(bytes)      parse a "qp2048TD0" model file into a dense table of weights
 *   loadDecoder()         js/td0_weights.js's decodeTd0Weights, the unpacker the page uses
 *   loadPlayer(bytes)     the real player (ExportedTD0 from js/players.wasm) on those weights
 *   playGames(player, {games, seed})  seeded games; summarise(results) the statistics
 *
 * players.js is an Emscripten build for the web; it runs here in a vm context with a small
 * XMLHttpRequest stand-in that answers the wasm's one request (for ../model.bmp) with the bytes
 * given. The game rules (slide, merge, 90% 2 / 10% 4 spawns on a uniformly random empty cell)
 * are reimplemented below with a seeded generator, so a seed always gives the same games.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const jsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');

/** Parses a "qp2048TD0" file into { header, tableSize, table: Float32Array (dense), stored }. */
export function readModel(bytes) {
  if (Buffer.from(bytes.subarray(0, 9)).toString('latin1') !== 'qp2048TD0') throw new Error('not a qp2048TD0 model');
  const [m, n, c] = bytes.subarray(9, 12);
  const headerLength = 12 + m * n;
  const tableSize = m * c ** n;
  const maskBytes = Math.ceil(tableSize / 8);
  const mask = bytes.subarray(headerLength, headerLength + maskBytes);
  const weights = new DataView(bytes.buffer, bytes.byteOffset + headerLength + maskBytes,
    bytes.byteLength - headerLength - maskBytes);
  const table = new Float32Array(tableSize);
  let k = 0;
  for (let i = 0; i < tableSize; i++) {
    if ((mask[i >> 3] >> (i & 7)) & 1) table[i] = weights.getFloat32(4 * k++, true);
  }
  if (4 * k !== weights.byteLength) throw new Error('the bitmask and the number of weights disagree');
  return { header: bytes.subarray(0, headerLength), tableSize, table, stored: k };
}

/** Loads js/td0_weights.js (a worker script) and returns its decodeTd0Weights. */
export function loadDecoder() {
  const sandbox = { Math, Uint8Array, Uint32Array, Int32Array, DataView, String, Error };
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(jsDir, 'td0_weights.js'), 'utf8'), sandbox, { filename: 'td0_weights.js' });
  return sandbox.decodeTd0Weights;
}

/** Resolves to { pickMove(board: bigint) -> 0 left | 1 up | 2 right | 3 down, requests }. */
export async function loadPlayer(modelBytes) {
  const requests = [];
  class FakeXHR {
    open(method, url) { this.url = String(url); this.readyState = 1; }
    setRequestHeader() {}
    overrideMimeType() {}
    getAllResponseHeaders() { return ''; }
    send() {
      requests.push(this.url);
      setTimeout(() => {
        const ok = this.url.endsWith('model.bmp');
        this.readyState = 4;
        this.status = ok ? 200 : 404;
        this.statusText = ok ? 'OK' : 'Not Found';
        this.response = ok ? modelBytes.buffer.slice(modelBytes.byteOffset, modelBytes.byteOffset + modelBytes.byteLength) : null;
        this.onreadystatechange?.({});
        (ok ? this.onload : this.onerror)?.({ loaded: modelBytes.byteLength, total: modelBytes.byteLength });
      }, 0);
    }
  }
  const quiet = { ...console, log() {}, warn() {}, error() {} };
  let ready;
  const readyP = new Promise((r) => (ready = r));
  const sandbox = {
    console: quiet, XMLHttpRequest: FakeXHR, WebAssembly, setTimeout, clearTimeout, performance,
    TextDecoder, TextEncoder, Date, Math,
    Module: { wasmBinary: readFileSync(path.join(jsDir, 'players.wasm')), onRuntimeInitialized: () => ready() },
  };
  sandbox.self = sandbox;
  sandbox.location = { href: 'http://localhost/2048/js/ai_controller.js' };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(path.join(jsDir, 'players.js'), 'utf8'), sandbox, { filename: 'players.js' });
  await readyP;
  const M = sandbox.Module;
  const td = new M.ExportedTD0();  // starts the model request
  // Wait until the fake request has answered and the model has been parsed.
  for (let i = 0; i < 200 && !requests.length; i++) await new Promise((r) => setTimeout(r, 5));
  await new Promise((r) => setTimeout(r, 20));
  return { pickMove: (board) => td.pick_move(board), requests };
}

/* ---- the game, on 16 exponents: cell (r, c), r = 0 top, c = 0 left, is nibble 15 - 4r - c ---- */

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const toBitboard = (cells) => {
  let b = 0n;
  for (let i = 0; i < 16; i++) b |= BigInt(cells[i]) << BigInt(60 - 4 * i);
  return b;
};

// Lines of cell indices, each ordered from the side tiles move towards. 0 left, 1 up, 2 right, 3 down.
const LINES = [0, 1, 2, 3].map((dir) => [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => {
  if (dir === 0) return 4 * i + j;
  if (dir === 2) return 4 * i + 3 - j;
  if (dir === 1) return 4 * j + i;
  return 4 * (3 - j) + i;
})));

function move(cells, dir) {
  const out = cells.slice();
  let gained = 0;
  for (const line of LINES[dir]) {
    const vals = line.map((k) => cells[k]).filter(Boolean);
    const merged = [];
    for (let k = 0; k < vals.length; k++) {
      if (k + 1 < vals.length && vals[k] === vals[k + 1]) { merged.push(vals[k] + 1); gained += 2 ** (vals[k] + 1); k++; }
      else merged.push(vals[k]);
    }
    line.forEach((k, n) => (out[k] = merged[n] ?? 0));
  }
  return { cells: out, gained, moved: out.some((v, k) => v !== cells[k]) };
}

function spawn(cells, rand) {
  const empty = [];
  for (let k = 0; k < 16; k++) if (!cells[k]) empty.push(k);
  cells[empty[Math.floor(rand() * empty.length)]] = rand() < 0.9 ? 1 : 2;
}

/**
 * Plays `games` games; game i uses seed `seed + i`. Returns [{ score, maxTile, moves }].
 * randomStart: the first that many moves are random (as if someone else had started the game
 * and handed it to the player), to try the player on boards it would not reach by itself.
 */
export function playGames(player, { games = 30, seed = 1, maxMoves = 100000, randomStart = 0 } = {}) {
  const results = [];
  for (let g = 0; g < games; g++) {
    const rand = mulberry32(seed + g);
    let cells = new Array(16).fill(0);
    spawn(cells, rand); spawn(cells, rand);
    let score = 0, moves = 0;
    while (moves < maxMoves) {
      if (![0, 1, 2, 3].some((d) => move(cells, d).moved)) break;
      let dir;
      if (moves < randomStart) {
        const legal = [0, 1, 2, 3].filter((d) => move(cells, d).moved);
        dir = legal[Math.floor(rand() * legal.length)];
      } else dir = player.pickMove(toBitboard(cells));
      const r = move(cells, dir);
      if (!r.moved) throw new Error(`game ${g}, move ${moves}: the player chose ${dir}, which does not move the board`);
      cells = r.cells; score += r.gained; moves++;
      spawn(cells, rand);
    }
    results.push({ score, maxTile: 2 ** Math.max(...cells), moves });
  }
  return results;
}

/** Average and median score, best tile, and the share of games reaching 2048 / 4096 / 8192. */
export function summarise(results) {
  const scores = results.map((r) => r.score).sort((a, b) => a - b);
  const n = scores.length;
  const median = n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2;
  const rate = (t) => results.filter((r) => r.maxTile >= t).length / n;
  return {
    games: n,
    mean: Math.round(scores.reduce((a, b) => a + b, 0) / n),
    median,
    maxTile: Math.max(...results.map((r) => r.maxTile)),
    reach2048: rate(2048), reach4096: rate(4096), reach8192: rate(8192),
    meanMoves: Math.round(results.reduce((a, r) => a + r.moves, 0) / n),
  };
}
