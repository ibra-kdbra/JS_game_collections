/**
 * Packs the weights of the "Machine Learning" player (a TD(0) n-tuple network by Stanley Zhong,
 * qpwoeirut/2048-solver, MIT) into 2048/model.gz, and measures how the player does with them.
 *
 *   node 2048/tools/pack-weights.mjs <original model> [--step 16] [--games 1000]
 *
 * The original is the 46 MB "qp2048TD0" file the game used to ship as 2048/model.bmp. It is no
 * longer in the working tree; get it from git history or from upstream, which is the same file:
 *   git show 6a20afc:2048/model.bmp > /tmp/model.bmp
 *   (or machine_learning/model_8-6_16_0.000150/model_8-6_16_0.000150_1000.dat in 2048-solver)
 *
 * What it does:
 * 1. Rounds every weight to a whole multiple of --step (default 16, so each weight moves by at
 *    most 8; the weights run from about -41000 to 22000, and a position is scored by adding 64
 *    of them). Weights that round to 0 drop out of the table, which reads them as 0 anyway.
 * 2. Writes the result in the layout js/td0_weights.js documents (entries grouped by the size
 *    of their already coded neighbours, then gzip), so the browser can unpack it with its own
 *    DecompressionStream and hand players.wasm a normal model file. players.wasm is unchanged.
 * 3. Unpacks it again with js/td0_weights.js and checks every weight is within step / 2.
 * 4. Plays --games seeded games (seeds 1, 2, ...) with the real player (players.wasm, run in
 *    Node) on the original and on the packed weights, and prints both. Steps of 28 and 32
 *    already scored about 3% lower over 1000 games; 16 and 24 matched the original.
 * 5. Writes 2048/model.gz; 2048/tools/weights-stats.json (sizes, checksums, the error, the
 *    comparison, and the scores of the first 30 games, which verify-weights.mjs, the CI check,
 *    replays exactly); and the new size into MODEL_BYTES in js/ai_controller.js and js/main.js.
 *
 * The gzip step uses Node's zlib at level 9, so another Node version may write a slightly
 * different model.gz; the unpacked weights are the same either way. Takes about a minute
 * with the default 1000 games.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import zlib from 'node:zlib';
import { readModel, loadDecoder, loadPlayer, playGames, summarise } from './td0.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.resolve(here, '..');
const CHECK_GAMES = 30;  // replayed by verify-weights.mjs

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const input = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!input) {
  console.error('usage: node 2048/tools/pack-weights.mjs <original model> [--step 16] [--games 1000]');
  process.exit(2);
}
const STEP = opt('step', 16);
const GAMES = opt('games', 1000);
const CAP = 6;                    // size classes per sign
const OFFSETS = [1, 16, 256];     // neighbours: the entries differing by one in the last three tiles

const sha256 = (b) => createHash('sha256').update(b).digest('hex');

function pack({ header, table }, step) {
  let coded = table.length;
  while (coded > 0 && Math.round(table[coded - 1] / step) === 0) coded--;
  const width = 2 * CAP + 1;
  const streams = Array.from({ length: width ** OFFSETS.length }, () => []);
  const sizeClass = new Uint8Array(coded);
  for (let i = 0; i < coded; i++) {
    const v = Math.round(table[i] / step);
    let c = 0;
    for (const d of OFFSETS) c = c * width + (i >= d ? sizeClass[i - d] : 0);
    const z = v >= 0 ? 2 * v : -2 * v - 1;
    if (z > 0xffff) throw new Error(`weight ${table[i]} is too large for step ${step}`);
    if (z < 255) streams[c].push(z);
    else streams[c].push(255, z & 255, z >> 8);
    if (v !== 0) {
      const bits = 32 - Math.clz32(Math.abs(v));
      sizeClass[i] = Math.min(bits, CAP) + (v < 0 ? CAP : 0);
    }
  }
  const head = Buffer.alloc(5 + 2 + header.length + 4 + 4 + 2 + 4 * OFFSETS.length + 4 * streams.length);
  let p = head.write('TD0Q', 0, 'latin1');
  p = head.writeUInt8(1, p);
  p = head.writeUInt16LE(header.length, p);
  p += Buffer.from(header).copy(head, p);
  p = head.writeFloatLE(step, p);
  p = head.writeUInt32LE(coded, p);
  p = head.writeUInt8(CAP, p);
  p = head.writeUInt8(OFFSETS.length, p);
  for (const d of OFFSETS) p = head.writeUInt32LE(d, p);
  for (const s of streams) p = head.writeUInt32LE(s.length, p);
  const payload = Buffer.concat([head, ...streams.map((s) => Buffer.from(s))]);
  return zlib.gzipSync(payload, { level: 9 });
}

const originalBytes = readFileSync(input);
const original = readModel(originalBytes);
const gz = pack(original, STEP);
const decoded = Buffer.from(loadDecoder()(zlib.gunzipSync(gz)));
const unpacked = readModel(decoded);

let maxError = 0, sumSq = 0;
for (let i = 0; i < original.tableSize; i++) {
  const e = Math.abs(unpacked.table[i] - original.table[i]);
  if (e > maxError) maxError = e;
  sumSq += e * e;
}
if (maxError > STEP / 2) throw new Error(`a weight moved by ${maxError}, more than step / 2`);
const rmsError = Math.sqrt(sumSq / original.stored);
console.log(`original ${originalBytes.length} bytes, ${original.stored} weights`);
console.log(`model.gz ${gz.length} bytes (${(originalBytes.length / gz.length).toFixed(1)}x smaller), ` +
  `${unpacked.stored} weights after rounding to multiples of ${STEP}; max error ${maxError}, rms ${rmsError.toFixed(2)}`);

const games = Math.max(GAMES, CHECK_GAMES);
console.log(`playing ${games} games with each…`);
const before = playGames(await loadPlayer(originalBytes), { games, seed: 1 });
const after = playGames(await loadPlayer(decoded), { games, seed: 1 });
const comparison = { games, seeds: `1..${games}`, original: summarise(before), packed: summarise(after) };
console.table({ original: comparison.original, packed: comparison.packed });

writeFileSync(path.join(gameDir, 'model.gz'), gz);
// The page shows download progress against this size when the server sends no length.
for (const file of ['js/ai_controller.js', 'js/main.js']) {
  const full = path.join(gameDir, file);
  const src = readFileSync(full, 'utf8');
  const out = src.replace(/(const MODEL_BYTES = )\d+/, `$1${gz.length}`);
  if (out === src && !src.includes(`MODEL_BYTES = ${gz.length}`)) throw new Error(`no MODEL_BYTES in ${file}`);
  writeFileSync(full, out);
}
const stats = {
  about: 'Written by 2048/tools/pack-weights.mjs; checked by 2048/tools/verify-weights.mjs.',
  original: { bytes: originalBytes.length, sha256: sha256(originalBytes), weights: original.stored },
  packed: {
    file: '2048/model.gz', bytes: gz.length, sha256: sha256(gz), step: STEP,
    unpackedBytes: decoded.length, unpackedSha256: sha256(decoded), weights: unpacked.stored,
  },
  error: { max: maxError, rms: Number(rmsError.toFixed(4)) },
  comparison,
  check: { seed: 1, games: CHECK_GAMES, scores: after.slice(0, CHECK_GAMES).map((g) => g.score),
    maxTiles: after.slice(0, CHECK_GAMES).map((g) => g.maxTile) },
};
writeFileSync(path.join(here, 'weights-stats.json'), JSON.stringify(stats, null, 2) + '\n');
console.log('wrote 2048/model.gz, 2048/tools/weights-stats.json and MODEL_BYTES in js/ai_controller.js and js/main.js');
