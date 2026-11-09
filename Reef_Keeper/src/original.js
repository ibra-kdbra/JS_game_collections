/**
 * Optional original art and sound. A player who owns Insaniquarium Deluxe can
 * point the game at their own copy: the install folder, or a .zip of it. The
 * files are read here in the browser and kept in this browser's IndexedDB;
 * they are never uploaded, and none of them ship with Reef Keeper. Without
 * them the game uses its own art.
 *
 * PopCap's images keep colour and transparency in separate files: `name.gif`
 * (or .jpg) for colour and `_name.gif` or `name_.gif` for a greyscale alpha
 * mask. They are joined into one canvas per sheet when the game loads.
 */

/** Sheets: our name -> [file, columns, rows]. */
export const SHEETS = {
  swim: ['smallswim', 10, 5],
  turn: ['smallturn', 10, 5],
  eat: ['smalleat', 10, 5],
  die: ['smalldie', 10, 5],
  hswim: ['hungryswim', 10, 5],
  hturn: ['hungryturn', 10, 5],
  heat: ['hungryeat', 10, 5],
  breeder: ['breeder', 10, 9],
  hbreeder: ['hungrybreeder', 10, 12],
  ultra: ['ultravore', 10, 4],
  grubber: ['grubgrubber', 10, 5],
  gekko: ['gekko', 10, 7],
  starcatcher: ['starcatcher', 10, 3],
  money: ['money', 10, 6],
  pearl: ['pearl', 1, 1],
  food: ['food', 10, 5],
  sylv: ['sylv', 10, 2],
  balrog: ['balrog', 10, 2],
  smallsylv: ['smallsylv', 10, 2],
  gus: ['gus', 10, 3],
  destructor: ['destructor', 10, 2],
  psychosquid: ['psychosquid', 10, 5],
  missile: ['missile', 16, 1],
  stinky: ['stinky', 10, 3],
  niko: ['niko', 10, 3],
  zorf: ['zorf', 10, 3],
  clyde: ['clyde', 10, 1],
  seymour: ['seymour', 10, 2],
  itchy: ['itchy', 10, 4],
  angie: ['angie', 10, 2],
  amp: ['amp', 10, 2],
  ampcharge: ['ampcharge', 10, 2],
  meryl: ['meryl', 10, 4],
  rufus: ['rufus', 10, 2],
  warphole: ['warphole', 17, 1],
  explosion: ['explosion', 10, 1],
  menubar: ['menubar', 1, 1],
  guns: ['lazergunz', 10, 1],
  eggpieces: ['eggpieces', 3, 1],
  healthbar: ['healthbar', 1, 1],
  healthtube: ['healthbartube', 1, 1],
  scl_breeder: ['scl_breeder', 10, 1],
  scl_starcatcher: ['scl_starcatcher', 10, 1],
  scl_grubber: ['scl_grubber', 10, 1],
  scl_gekko: ['scl_gekko', 10, 1],
  scl_ultra: ['scl_ultra', 10, 1],
  scl_stinky: ['scl_stinky', 10, 1],
  scl_niko: ['scl_niko', 10, 1],
  scl_zorf: ['scl_zorf', 10, 1],
  scl_clyde: ['scl_clyde', 10, 1],
  scl_seymour: ['scl_seymour', 10, 1],
  scl_itchy: ['scl_itchy', 10, 1],
  scl_angie: ['scl_angie', 10, 1],
  scl_amp: ['scl_amp', 10, 1],
  scl_meryl: ['scl_meryl', 10, 1],
  scl_rufus: ['scl_rufus', 10, 1],
  aquarium1: ['aquarium1', 1, 1],
  aquarium2: ['aquarium2', 1, 1],
  aquarium3: ['aquarium3', 1, 1],
  aquarium4: ['aquarium4', 1, 1],
  aquarium5: ['aquarium5', 1, 1],
  aquarium6: ['aquarium6', 1, 1],
  title: ['titlescreen', 1, 1],
};

/** Our sound names -> the original files (one is picked at random). */
export const SOUNDS = {
  food: ['dropfood'],
  eat: ['slurp', 'slurp2', 'slurp3'],
  grow: ['grow'],
  'coin:silver': ['points'],
  'coin:gold': ['points2'],
  'coin:star': ['points3'],
  'coin:diamond': ['diamond'],
  'coin:pearl': ['pearl'],
  'coin:chest': ['treasure'],
  buy: ['buy'],
  splash: ['splash', 'splash2', 'splash3'],
  nope: ['buzzer'],
  starve: ['die'],
  gulp: ['chomp', 'chomp2'],
  warning: ['awooga'],
  invader: ['roar', 'roar2', 'roar3'],
  hit: ['hit'],
  defeat: ['explode'],
  boom: ['explosion1'],
  heal: ['heal'],
  clear: ['applause'],
  lost: ['die'],
};

const IMAGE_FILES = new Set(Object.values(SHEETS).map(([f]) => f));
const SOUND_FILES = new Set(Object.values(SOUNDS).flat());
const MUST_HAVE = ['smallswim', 'menubar', 'aquarium1'];
const MUST_BUILD = ['swim', 'menubar', 'aquarium1'];

/** Which stored key (if any) a file in the game folder becomes. */
function keyFor(path) {
  const name = path.split(/[\\/]/).pop().toLowerCase();
  const dot = name.lastIndexOf('.');
  if (dot < 1) return null;
  const base = name.slice(0, dot);
  const ext = name.slice(dot + 1);
  if (['gif', 'jpg', 'png'].includes(ext)) {
    const bare = base.replace(/^_/, '').replace(/_$/, '');
    return IMAGE_FILES.has(bare) ? name : null;
  }
  if (['ogg', 'au'].includes(ext)) return SOUND_FILES.has(base) ? name : null;
  return null;
}

/* ---------- Storage ---------- */

const DB = 'reef-keeper-original';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('files', mode);
    const out = fn(t.objectStore('files'));
    t.oncomplete = () => resolve(out?.result ?? out);
    t.onerror = () => reject(t.error);
  }).finally(() => db.close());
}

async function readAll() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const files = {};
      const req = db.transaction('files').objectStore('files').openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(files);
        files[c.key] = c.value;
        c.continue();
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/* ---------- Reading a folder or a .zip ---------- */

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** The files we need from a .zip (stored or deflated entries). */
async function fromZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let end = buf.length - 22;
  while (end >= 0 && dv.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error('That file is not a .zip.');
  const count = dv.getUint16(end + 10, true);
  let p = dv.getUint32(end + 16, true);
  const out = {};
  for (let i = 0; i < count && dv.getUint32(p, true) === 0x02014b50; i++) {
    const method = dv.getUint16(p + 10, true);
    const size = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const skip = nameLen + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    const offset = dv.getUint32(p + 42, true);
    const key = keyFor(new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen)));
    p += 46 + skip;
    if (!key || (method !== 0 && method !== 8)) continue;
    const start = offset + 30 + dv.getUint16(offset + 26, true) + dv.getUint16(offset + 28, true);
    const data = buf.subarray(start, start + size);
    out[key] = new Blob([method === 8 ? await inflate(data) : data.slice()]);
  }
  return out;
}

/**
 * Take the player's files (a folder's FileList, or a single .zip), keep what
 * the game uses and store it. Resolves to the number of files kept.
 */
export async function importOriginal(fileList) {
  const list = [...fileList];
  let files = {};
  for (const f of list) {
    if (/\.zip$/i.test(f.name)) Object.assign(files, await fromZip(f));
    else {
      const key = keyFor(f.webkitRelativePath || f.name);
      if (key) files[key] = f;
    }
  }
  const have = (base) => Object.keys(files).some((k) => k.startsWith(`${base}.`));
  if (!MUST_HAVE.every(have)) throw new Error("That doesn't look like Insaniquarium Deluxe. Pick the game's install folder or a .zip of it.");
  await tx('readwrite', (s) => {
    s.clear();
    for (const [k, v] of Object.entries(files)) s.put(v, k);
  });
  await build(files);
  return Object.keys(files).length;
}

export async function forgetOriginal() {
  await tx('readwrite', (s) => s.clear());
  for (const k of Object.keys(sheets)) delete sheets[k];
  for (const k of Object.keys(sounds)) delete sounds[k];
  state.ready = false;
  changed();
}

/* ---------- Building the sheets ---------- */

const sheets = {};
const sounds = {};
const state = { ready: false };
const listeners = new Set();
const changed = () => listeners.forEach((fn) => fn(state.ready));

async function image(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function sheet(files, base) {
  const colour = files[`${base}.gif`] ?? files[`${base}.jpg`] ?? files[`${base}.png`];
  if (!colour) return null;
  const alpha = files[`_${base}.gif`] ?? files[`${base}_.gif`] ?? files[`_${base}.jpg`] ?? files[`${base}_.jpg`];
  const img = await image(colour);
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  if (alpha) {
    const mask = document.createElement('canvas');
    mask.width = c.width;
    mask.height = c.height;
    const mg = mask.getContext('2d', { willReadFrequently: true });
    mg.drawImage(await image(alpha), 0, 0, c.width, c.height);
    const px = g.getImageData(0, 0, c.width, c.height);
    const m = mg.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < px.data.length; i += 4) px.data[i] = m[i - 3];
    g.putImageData(px, 0, 0);
  }
  return c;
}

async function build(files) {
  await Promise.all(
    Object.entries(SHEETS).map(async ([name, [base, cols, rows]]) => {
      try {
        const canvas = await sheet(files, base);
        if (canvas) sheets[name] = { canvas, cols, rows, fw: canvas.width / cols, fh: canvas.height / rows };
      } catch {
        // A broken file just leaves that sheet to our own art.
      }
    }),
  );
  for (const [k, v] of Object.entries(files)) if (/\.(ogg|au)$/.test(k)) sounds[k.replace(/\.\w+$/, '')] = { blob: v, au: k.endsWith('.au') };
  state.ready = MUST_BUILD.every((n) => sheets[n]);
  changed();
}

/** Load the stored files, if the player gave us some before. */
export async function loadOriginal() {
  if (typeof indexedDB === 'undefined') return false;
  try {
    const files = await readAll();
    if (Object.keys(files).length) await build(files);
  } catch {
    // Private windows and blocked storage: carry on with our own art.
  }
  return state.ready;
}

export const original = {
  get ready() {
    return state.ready;
  },
  sheet: (name) => sheets[name] ?? null,
  /** Raw sound files by original name: { blob, au }. */
  sound: (name) => sounds[name] ?? null,
  onChange: (fn) => listeners.add(fn),
};

/* ---------- Sun .au files (8-bit mu-law or linear PCM) ---------- */

/** Decode a .au file to mono float samples: { rate, data }. */
export function decodeAu(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0) !== 0x2e736e64) return null;
  const offset = dv.getUint32(4);
  const encoding = dv.getUint32(12);
  const rate = dv.getUint32(16);
  const channels = dv.getUint32(20);
  const bytes = new Uint8Array(buf, offset);
  const width = encoding === 3 ? 2 : 1;
  const n = Math.floor(bytes.length / width / channels);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const j = i * width * channels;
    if (encoding === 1) {
      const u = ~bytes[j] & 0xff;
      const t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
      data[i] = ((u & 0x80 ? 0x84 - t : t - 0x84) / 32768);
    } else if (encoding === 2) data[i] = ((bytes[j] << 24) >> 24) / 128;
    else if (encoding === 3) data[i] = dv.getInt16(offset + j) / 32768;
    else return null;
  }
  return { rate, data };
}
