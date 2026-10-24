#!/usr/bin/env node
/**
 * Pre-renders the registry (assets/js/data.js) into the static pages, so the
 * game grid, Art Lab showcase and the Art Lab's "All pieces" list are in the HTML before
 * any JavaScript runs (faster first paint, works without JS, indexable).
 *
 * Usage: node tools/render-pages.mjs          (writes files)
 *        node tools/render-pages.mjs --check  (exits 1 if output is stale; for CI)
 *
 * Each page holds marker pairs like <!-- render:games --> ... <!-- /render:games -->
 * and only the content between them is replaced.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { games, experiments, GENRES, thumbSet, platformTags } = await import(
  pathToFileURL(path.join(root, 'assets/js/data.js')).href
);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const TAG = {
  pc: '<span class="tag tag-pc"><i class="fas fa-desktop" aria-hidden="true"></i> PC</span>',
  mobile: '<span class="tag tag-mobile"><i class="fas fa-mobile-alt" aria-hidden="true"></i> Mobile</span>',
};

const INPUT_LABEL = {
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  touch: 'Touch',
  gamepad: 'Gamepad',
};

const inputChip = (input) =>
  `<li class="meta-chip meta-chip--input" title="${INPUT_LABEL[input]}"><svg class="ico" aria-hidden="true"><use href="#i-${input}"></use></svg><span class="sr-only">${INPUT_LABEL[input]}</span></li>`;

function gameCard(game, index) {
  const t = thumbSet(game.slug, '{base}');
  const tags = platformTags(game);
  const search = [game.title, game.blurb, GENRES[game.genre], ...game.inputs].join(' ').toLowerCase();
  return `
        <a class="game-card" href="{base}${esc(game.href)}" target="_blank" rel="noopener" data-slug="${esc(game.slug)}" data-genre="${esc(game.genre)}" data-platforms="${tags.join(' ')}" data-search="${esc(search)}">
          <div class="game-card-inner">
            <div class="game-card-preview">
              <div class="game-card-tags">${tags.map((tag) => TAG[tag]).join('')}</div>
              <img src="${t.src}" srcset="${t.srcset}" sizes="(min-width: 1200px) 400px, (min-width: 700px) 50vw, 100vw" width="480" height="300" alt="" loading="${index < 3 ? 'eager' : 'lazy'}"${index === 0 ? ' fetchpriority="high"' : ''} decoding="async">
              <span class="game-card-best" hidden></span>
            </div>
            <div class="game-card-content">
              <h3 class="game-card-title">${esc(game.title)}</h3>
              <p class="game-card-description">${esc(game.blurb)}</p>
              <ul class="game-card-meta" aria-label="Genre and controls">
                <li class="meta-chip meta-chip--genre">${esc(GENRES[game.genre])}</li>${game.inputs.map(inputChip).join('')}
              </ul>
              <div class="game-card-action">
                <span class="play-btn">Play Now <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                <span class="game-card-genre">New tab</span>
              </div>
            </div>
          </div>
        </a>`;
}

/**
 * The hub's Art Lab teaser: the sealed booster pack from the Art Lab opening,
 * drawn in CSS (no artwork, no images), and a button into the Art Lab.
 * Both the sealed and the opened copy are rendered; script.js sets data-state
 * to "opened" once this browser has opened the pack (artlab.opened).
 */
function artlabShowcase() {
  const n = experiments.length;
  const holo = experiments.filter((exp) => exp.rarity === 3).length;
  const back = '<span class="tz-back"><i></i></span>';
  return `
        <div class="artlab-teaser" id="artlab-teaser" data-state="sealed">
          <a class="tz-stage" href="{base}Art_Lab/index.html" tabindex="-1" aria-hidden="true">
            <span class="tz-tilt">
              <span class="tz-cards">${back.repeat(3)}</span>
              <span class="tz-pack">
                <span class="tz-shadow"></span>
                <span class="tz-half tz-top"><span class="tz-skin"><span class="tz-crimp"></span><span class="tz-sheen"></span></span></span>
                <span class="tz-half tz-body"><span class="tz-skin">
                  <span class="tz-head"><span class="tz-series">Series 01</span><span class="tz-count">${n} cards</span></span>
                  <span class="tz-name">Art<br>Lab</span>
                  <span class="tz-sub">Generative edition</span>
                  <span class="tz-window"><span class="tz-strip">${back.repeat(8)}</span></span>
                  <span class="tz-foot"><span>Holo inside</span><span class="tz-barcode"></span></span>
                  <span class="tz-crimp tz-crimp-bottom"></span>
                  <span class="tz-sheen"></span>
                </span></span>
                <span class="tz-tear"><span class="tz-tear-tag">Tear</span></span>
              </span>
            </span>
          </a>
          <div class="tz-copy">
            <p class="tz-eyebrow"><span class="tz-badge"><span data-when="sealed">Sealed</span><span data-when="opened">Opened</span></span> Series 01 &middot; ${n} cards</p>
            <h3 class="tz-title"><span data-when="sealed">${n} cards. One sealed pack.</span><span data-when="opened">Your deck is waiting.</span></h3>
            <p class="tz-desc">Flow fields, particle storms and live shaders: generative pieces you can play with. <span data-when="sealed">Tear the pack open to see what you pull.</span><span data-when="opened">Your cards are where you left them.</span></p>
            <p class="tz-meter">
              <span class="tz-pips" aria-hidden="true">${'<i></i>'.repeat(n)}</span>
              <span data-when="sealed">${n} sealed cards &middot; ${holo} holo inside</span><span data-when="opened">Set complete &middot; ${n}/${n}</span>
            </p>
            <a class="btn btn-primary tz-cta" href="{base}Art_Lab/index.html">
              <span data-when="sealed">Open the pack</span><span data-when="opened">Back to the deck</span>
              <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      `;
}

const RARITY = ['', 'Common', 'Uncommon', 'Holo'];

/** One piece in the Art Lab's "All pieces" list. */
function artlabTile(exp, i) {
  const t = thumbSet(exp.slug, '{base}');
  const no = `${String(i + 1).padStart(2, '0')} / ${String(experiments.length).padStart(2, '0')}`;
  const rarity = exp.rarity || 1;
  return `
          <li class="tile" data-rarity="${rarity}">
            <img class="tile-art" src="${t.src}" srcset="${t.srcset}" sizes="(min-width: 1100px) 340px, (min-width: 640px) 45vw, 100vw" width="480" height="300" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async">
            <div class="tile-body">
              <p class="tile-meta"><span class="tile-no">${no}</span><span class="tile-engine">${esc(exp.engine || 'Canvas')}</span><span class="tile-rarity">${RARITY[rarity]} <span aria-hidden="true">${'◆'.repeat(rarity)}${'◇'.repeat(3 - rarity)}</span></span></p>
              <h3 class="tile-title">${esc(exp.title)}</h3>
              <p class="tile-desc">${esc(exp.blurb)}</p>
              <p class="tile-tags">${exp.tags.map(esc).join(' · ')}</p>
              <a class="btn btn-primary tile-enter" href="{base}${esc(exp.href)}" target="_blank" rel="noopener" aria-label="Enter ${esc(exp.title)} (opens in a new tab)">Enter <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
            </div>
          </li>`;
}

const blocks = {
  games: games.map(gameCard).join('') + '\n      ',
  'artlab-showcase': artlabShowcase(),
  'artlab-grid': experiments.map(artlabTile).join('') + '\n        ',
  'game-count': String(games.length),
  'exp-count': String(experiments.length),
};

const pages = [
  { file: 'index.html', base: './' },
  { file: 'Art_Lab/index.html', base: '../' },
];

const check = process.argv.includes('--check');
let stale = false;

for (const page of pages) {
  const file = path.join(root, page.file);
  const before = await readFile(file, 'utf8');
  let after = before;
  for (const [name, html] of Object.entries(blocks)) {
    const re = new RegExp(`(<!-- render:${name} -->)[\\s\\S]*?(<!-- /render:${name} -->)`, 'g');
    after = after.replace(re, (_, open, close) => open + html.replaceAll('{base}', page.base) + close);
  }
  if (after !== before) {
    stale = true;
    if (!check) {
      await writeFile(file, after);
      console.log(`rendered ${page.file}`);
    } else {
      console.error(`${page.file} is out of date; run: node tools/render-pages.mjs`);
    }
  }
}

if (check && stale) process.exit(1);
