#!/usr/bin/env node
/**
 * Pre-renders the registry (assets/js/data.js) into the static pages, so the
 * game grid, Art Lab showcase and experiment carousel are in the HTML before
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

function gameCard(game, index) {
  const t = thumbSet(game.slug, '{base}');
  const tags = platformTags(game);
  const search = [game.title, game.blurb, GENRES[game.genre], ...game.inputs].join(' ').toLowerCase();
  return `
        <a class="game-card" href="{base}${esc(game.href)}" target="_blank" rel="noopener" data-slug="${esc(game.slug)}" data-genre="${esc(game.genre)}" data-platforms="${tags.join(' ')}" data-search="${esc(search)}">
          <div class="game-card-inner">
            <div class="game-card-preview">
              <div class="game-card-tags">${tags.map((tag) => TAG[tag]).join('')}</div>
              <img src="${t.src}" srcset="${t.srcset}" sizes="(min-width: 1200px) 400px, (min-width: 700px) 50vw, 100vw" width="480" height="300" alt="" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async">
            </div>
            <div class="game-card-content">
              <h3 class="game-card-title">${esc(game.title)}</h3>
              <p class="game-card-description">${esc(game.blurb)}</p>
              <div class="game-card-action">
                <span class="play-btn">Play Now <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                <span class="game-card-genre">${esc(GENRES[game.genre])}</span>
              </div>
            </div>
          </div>
        </a>`;
}

function artlabShowcase() {
  return `
        <a href="{base}Art_Lab/index.html" class="artlab-main-card">
          <div class="artlab-card-glow"></div>
          <div class="artlab-card-content">
            <div class="artlab-icon"><i class="fas fa-flask" aria-hidden="true"></i></div>
            <h3 class="artlab-card-title">Art Lab</h3>
            <p class="artlab-card-desc">Math with Art create wonders</p>
            <div class="artlab-stats">
              <span><i class="fas fa-layer-group" aria-hidden="true"></i> ${experiments.length} Experiments</span>
            </div>
            <div class="artlab-enter-btn">
              <span>Explore Collection</span>
              <i class="fas fa-arrow-right" aria-hidden="true"></i>
            </div>
          </div>
          <div class="artlab-preview-strip">${experiments
            .map((exp) => {
              const t = thumbSet(exp.slug, '{base}');
              return `
            <div class="strip-item" data-link="{base}${esc(exp.href)}" title="${esc(exp.title)}">
              <img src="${t.src}" width="85" height="85" alt="${esc(exp.title)}" loading="lazy" decoding="async">
            </div>`;
            })
            .join('')}
          </div>
        </a>
      `;
}

function experimentCard(exp, i) {
  const t = thumbSet(exp.slug, '{base}');
  return `
          <article class="experiment-card" style="animation-delay: ${(i * 0.08).toFixed(2)}s;">
            <a href="{base}${esc(exp.href)}" target="_blank" rel="noopener" class="experiment-card-link">
              <div class="experiment-card-inner">
                <div class="experiment-card-preview">
                  <span class="experiment-number">${String(i + 1).padStart(2, '0')}</span>
                  <img src="${t.src}" srcset="${t.srcset}" sizes="340px" width="480" height="300" alt="" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async">
                </div>
                <div class="experiment-card-content">
                  <h3 class="experiment-card-title">${esc(exp.title)}</h3>
                  <p class="experiment-card-description">${esc(exp.blurb)}</p>
                  <div class="experiment-tags">${exp.tags.map((tag) => `<span class="experiment-tag">${esc(tag)}</span>`).join('')}</div>
                  <div class="experiment-card-action">
                    <span class="experiment-link">View Experiment <i class="fas fa-arrow-right" aria-hidden="true"></i></span>
                  </div>
                </div>
              </div>
            </a>
          </article>`;
}

const blocks = {
  games: games.map(gameCard).join('') + '\n      ',
  'artlab-showcase': artlabShowcase(),
  experiments: experiments.map(experimentCard).join('') + '\n        ',
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
