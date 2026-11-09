/**
 * Bundle js/*.js into one classic script (game.js) and the manifest, fonts and
 * game text into assets/data.js, so index.html works when opened straight from disk
 * (browsers block modules and fetch on file:// pages).
 *
 *   node tools/build.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const order = [];
const seen = new Set();

function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  for (const m of src.matchAll(/^import\s+[^;]*?from\s+'\.\/([\w-]+\.js)';/gm)) visit(m[1]);
  order.push(file);
}
visit('main.js');

let out = '// Built by tools/build.mjs from js/*.js. Edit those, then rebuild.\n(() => {\nconst __m = {};\n';
for (const file of order) {
  let src = fs.readFileSync(path.join(root, 'js', file), 'utf8');
  const names = [];
  src = src.replace(/^import\s+\{([^}]*)\}\s+from\s+'\.\/([\w-]+)\.js';/gm, (_, list, mod) => {
    const parts = list.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${parts.join(', ')} } = __m['${mod}'];`;
  });
  src = src.replace(/^export\s+(async\s+function|function|const|let|class)\s+([\w$]+)/gm, (_, kind, name) => {
    names.push(name);
    return `${kind} ${name}`;
  });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`${file}: unsupported import/export form`);
  out += `__m['${file.replace(/\.js$/, '')}'] = (() => {\n${src}\nreturn { ${names.join(', ')} };\n})();\n`;
}
out += '})();\n';
fs.writeFileSync(path.join(root, 'game.js'), out);

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'manifest.json'), 'utf8'));
const fonts = {};
for (const name of manifest.font) fonts[name] = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'font', `${name}.json`), 'utf8'));
const text = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'text.json'), 'utf8'));
fs.writeFileSync(path.join(root, 'assets', 'data.js'), `globalThis.__ASSETS = ${JSON.stringify({ manifest, fonts, text })};\n`);
console.log(`game.js: ${order.join(' > ')}`);
