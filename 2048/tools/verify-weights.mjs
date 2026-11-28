/**
 * Checks 2048/model.gz, the packed weights of the "Machine Learning" player (Node, no browser):
 *   node 2048/tools/verify-weights.mjs [--original <the 46 MB model.bmp>]
 *
 * 1. model.gz is the file pack-weights.mjs measured (size and SHA-256 in weights-stats.json),
 *    and MODEL_BYTES in js/ai_controller.js and js/main.js is its size.
 * 2. It gunzips with DecompressionStream (the API the page uses) and unpacks with
 *    js/td0_weights.js into a well-formed "qp2048TD0" model, byte for byte the one measured,
 *    with every weight a whole multiple of the step.
 * 3. With --original (from git history: git show 6a20afc:2048/model.bmp > /tmp/model.bmp):
 *    every weight is within step / 2 of the original. Without it, the error that pack-weights
 *    measured against the original (stored in weights-stats.json) must be within step / 2.
 * 4. The real player (js/players.wasm, in Node) asks for ../model.bmp, the URL the worker
 *    catches, and replays the 30 seeded games pack-weights recorded with the same scores and
 *    tiles; over those games it averages 100000 points or more and reaches 2048 at least 90%.
 * Exits non-zero on any failure. Takes a few seconds.
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readModel, loadDecoder, loadPlayer, playGames, summarise } from './td0.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, '..');
const stats = JSON.parse(readFileSync(path.join(here, 'weights-stats.json'), 'utf8'));
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const argOriginal = process.argv.indexOf('--original');
const originalPath = argOriginal >= 0 ? process.argv[argOriginal + 1] : null;

let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures++;
};

// 1. The file
const gz = readFileSync(path.join(gameDir, 'model.gz'));
check(gz.length === stats.packed.bytes && sha256(gz) === stats.packed.sha256,
  `model.gz is the measured file (${gz.length} bytes, ${(stats.original.bytes / gz.length).toFixed(1)}x smaller than the original)`);
for (const file of ['js/ai_controller.js', 'js/main.js']) {
  const m = readFileSync(path.join(gameDir, file), 'utf8').match(/const MODEL_BYTES = (\d+)/);
  check(m && Number(m[1]) === gz.length, `MODEL_BYTES in ${file} is the size of model.gz (${m?.[1]})`);
}

// 2. Unpack it the way the page does
const payload = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
const decoded = Buffer.from(loadDecoder()(payload));
check(decoded.length === stats.packed.unpackedBytes && sha256(decoded) === stats.packed.unpackedSha256,
  `unpacks to the measured model (${decoded.length} bytes)`);
const model = readModel(decoded);
const step = stats.packed.step;
let offGrid = 0;
for (const v of model.table) if (v !== Math.round(v / step) * step) offGrid++;
check(model.stored === stats.packed.weights && offGrid === 0,
  `${model.stored} weights stored, all multiples of ${step} (${offGrid} are not)`);

// 3. Against the original
if (originalPath) {
  const originalBytes = readFileSync(originalPath);
  check(sha256(originalBytes) === stats.original.sha256, `${originalPath} is the original model`);
  const original = readModel(originalBytes);
  let maxError = 0, sumSq = 0;
  for (let i = 0; i < original.tableSize; i++) {
    const e = Math.abs(model.table[i] - original.table[i]);
    if (e > maxError) maxError = e;
    sumSq += e * e;
  }
  const rms = Math.sqrt(sumSq / original.stored);
  check(maxError <= step / 2, `every weight within ${step / 2} of the original (max error ${maxError}, rms ${rms.toFixed(2)})`);
} else {
  check(stats.error.max <= step / 2,
    `the measured error is within step / 2 (max ${stats.error.max}, rms ${stats.error.rms}; pass --original to check every weight)`);
}

// 4. The player
const player = await loadPlayer(decoded);
check(player.requests.length === 1 && player.requests[0].endsWith('model.bmp'),
  `the wasm asks for ${JSON.stringify(player.requests)}, which ai_controller.js answers with model.gz`);
const results = playGames(player, { games: stats.check.games, seed: stats.check.seed });
const same = results.every((r, i) => r.score === stats.check.scores[i] && r.maxTile === stats.check.maxTiles[i]);
const s = summarise(results);
check(same, `${s.games} seeded games replay as recorded`);
check(s.mean >= 100000 && s.reach2048 >= 0.9,
  `plays well: mean ${s.mean}, median ${s.median}, best tile ${s.maxTile}, 2048 or better in ${(100 * s.reach2048).toFixed(0)}% ` +
  `(over ${stats.comparison.games} games the original averaged ${stats.comparison.original.mean}, these weights ${stats.comparison.packed.mean})`);

if (failures) {
  console.error(`${failures} check(s) failed`);
  process.exit(1);
}
console.log('All weight checks passed.');
