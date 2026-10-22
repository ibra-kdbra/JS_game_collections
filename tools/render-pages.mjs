#!/usr/bin/env node
/**
 * Pre-renders the registry (assets/js/data.js) into the static pages so the
 * hub and Art Lab work, and are indexable, before any JavaScript runs.
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
const { games, experiments, GENRES, INPUTS, thumbSet } = await import(
  pathToFileURL(path.join(root, 'assets/js/data.js')).href
);

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const icon = (id, cls = 'icon') =>
  `<svg class="${cls}" aria-hidden="true"><use href="{base}assets/icons/sprite.svg#i-${id}"></use></svg>`;

const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const spell = (n) => numberWords[n] ?? String(n);
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function inputList(game) {
  const label = game.inputs.map((i) => INPUTS[i]).join(', ');
  return `<span class="inputs" role="img" aria-label="Controls: ${esc(label)}">${game.inputs
    .map((i) => icon(i === 'touch' ? 'touch' : i))
    .join('')}</span>`;
}

function gameCard(game) {
  const t = thumbSet(game.slug, '{base}');
  const wide = !!game.featured;
  const search = [game.title, game.blurb, GENRES[game.genre], ...game.inputs].join(' ').toLowerCase();
  return `
          <li class="game${wide ? ' game--wide' : ''}" data-slug="${esc(game.slug)}" data-genre="${esc(game.genre)}" data-mobile="${game.mobile}" data-search="${esc(search)}">
            <img class="game-thumb" src="${t.src}" srcset="${t.srcset}" sizes="(min-width: 1100px) ${wide ? '48vw' : '32vw'}, (min-width: 700px) 50vw, 100vw" width="480" height="300" alt="" loading="lazy" decoding="async">
            <h3 class="game-title"><a class="game-link" href="{base}${esc(game.href)}">${esc(game.title)}</a></h3>
            <p class="game-blurb">${esc(game.blurb)}</p>
            <p class="game-meta"><span class="genre">${esc(GENRES[game.genre])}</span>${game.mobile ? '<span class="phone-ok">Plays on phone</span>' : ''}${inputList(game)}</p>
          </li>`;
}

function experimentCard(exp) {
  const t = thumbSet(exp.slug, '{base}');
  return `
          <li class="exp">
            <img class="exp-thumb" src="${t.src}" srcset="${t.srcset}" sizes="(min-width: 700px) 320px, 75vw" width="480" height="300" alt="" loading="lazy" decoding="async">
            <h3 class="exp-title"><a class="exp-link" href="{base}${esc(exp.href)}">${esc(exp.title)}</a></h3>
            <p class="exp-blurb">${esc(exp.blurb)}</p>
            <p class="exp-tags">${exp.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>
          </li>`;
}

function galleryCard(exp, index) {
  const t = thumbSet(exp.slug, '{base}');
  return `
          <li class="exp${index === 0 ? ' exp--lead' : ''}">
            <img class="exp-thumb" src="${t.src}" srcset="${t.srcset}" sizes="${index === 0 ? '(min-width: 1320px) 1320px, 100vw' : '(min-width: 800px) 50vw, 100vw'}" width="960" height="600" alt="" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async">
            <h2 class="exp-title"><a class="exp-link" href="{base}${esc(exp.href)}">${esc(exp.title)}</a></h2>
            <p class="exp-blurb">${esc(exp.blurb)}</p>
            <p class="exp-tags">${exp.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</p>
          </li>`;
}

function pick(game) {
  const t = thumbSet(game.slug, '{base}');
  return `
        <a class="pick-shot" href="{base}${esc(game.href)}" tabindex="-1" aria-hidden="true">
          <img src="${t.src}" srcset="${t.srcset}" sizes="(min-width: 960px) 55vw, 100vw" width="960" height="600" alt="" fetchpriority="high" decoding="async">
        </a>
        <figcaption class="pick-caption">
          <p class="pick-label">Today’s pick <span aria-hidden="true">·</span> <span data-pick-genre>${esc(GENRES[game.genre])}</span></p>
          <h2 class="pick-title" data-pick-title>${esc(game.title)}</h2>
          <p class="pick-blurb" data-pick-blurb>${esc(game.blurb)}</p>
          <div class="pick-actions">
            <a class="btn btn-ink" href="{base}${esc(game.href)}" data-pick-play>${icon('play')}<span>Play <span data-pick-name>${esc(game.title)}</span></span></a>
            <button class="pick-next" type="button" data-pick-next hidden>Another pick ${icon('arrow-right')}</button>
          </div>
        </figcaption>`;
}

// Rhythm on wide screens: a pair of featured games (half width each), then a row
// of three regular ones, repeated. Leftovers of either kind follow in order.
function interleave(list) {
  const featured = list.filter((g) => g.featured);
  const regular = list.filter((g) => !g.featured);
  const out = [];
  while (featured.length || regular.length) {
    out.push(...featured.splice(0, 2), ...regular.splice(0, 3));
  }
  return out;
}

const ordered = interleave(games);

const blocks = {
  games: ordered.map(gameCard).join('') + '\n        ',
  experiments: experiments.map(experimentCard).join('') + '\n        ',
  gallery: experiments.map(galleryCard).join('') + '\n        ',
  pick: pick(games.find((g) => g.featured)) + '\n      ',
  lede: `${capitalize(spell(games.length))} browser games and ${spell(experiments.length)} art experiments, hand-built in plain JavaScript. Free to play, nothing to install.`,
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
