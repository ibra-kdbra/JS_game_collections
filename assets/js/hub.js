import { games, GENRES, thumbSet } from './data.js';
import { storage, initThemeToggle, registerServiceWorker, initFeedbackButtons } from './site.js';

const RECENT_KEY = 'gamelab.recent';
const RECENT_MAX = 4;
const bySlug = new Map(games.map((g) => [g.slug, g]));

initThemeToggle('./assets/icons/sprite.svg');
initFeedbackButtons('main_hub', './');
registerServiceWorker('./sw.js');
initRadio();
initPick();
initFilters();
initRecent();

/* ---------- Today's pick ---------- */

function initPick() {
  const root = document.querySelector('[data-pick]');
  if (!root) return;
  const featured = games.filter((g) => g.featured);
  if (featured.length === 0) return;

  // Same pick for everyone on a given day; "Another pick" steps through the rest.
  const day = Math.floor(Date.now() / 86_400_000);
  let index = day % featured.length;

  const show = (game, animate) => {
    const t = thumbSet(game.slug, './');
    const img = root.querySelector('.pick-shot img');
    if (animate) {
      root.setAttribute('data-swapping', '');
      // Restart the entrance animation on the new image.
      void img.offsetWidth;
      root.removeAttribute('data-swapping');
    }
    img.srcset = t.srcset;
    img.src = t.src;
    for (const a of root.querySelectorAll('.pick-shot, [data-pick-play]')) a.href = `./${game.href}`;
    root.querySelector('[data-pick-title]').textContent = game.title;
    root.querySelector('[data-pick-name]').textContent = game.title;
    root.querySelector('[data-pick-blurb]').textContent = game.blurb;
    root.querySelector('[data-pick-genre]').textContent = GENRES[game.genre];
    root.querySelector('[data-pick-play]').dataset.slug = game.slug;
  };

  if (featured[index] !== featured[0]) show(featured[index], false);
  root.querySelector('[data-pick-play]').dataset.slug = featured[index].slug;
  keepPickOutOfFirstRow(featured[index].slug);

  const next = root.querySelector('[data-pick-next]');
  if (featured.length > 1) {
    next.hidden = false;
    next.addEventListener('click', () => {
      index = (index + 1) % featured.length;
      show(featured[index], true);
    });
  }
}

/** The pick is already the hero; don't repeat it as the first card of the index. */
function keepPickOutOfFirstRow(slug) {
  const wide = [...document.querySelectorAll('[data-games] .game--wide')];
  const card = wide.find((li) => li.dataset.slug === slug);
  const last = wide.at(-1);
  if (!card || !last || card === last || wide.indexOf(card) > 1) return;
  const marker = document.createComment('');
  last.replaceWith(marker);
  card.replaceWith(last);
  marker.replaceWith(card);
}

/* ---------- Search and filters ---------- */

function initFilters() {
  const form = document.querySelector('[data-filters]');
  const list = document.querySelector('[data-games]');
  if (!form || !list) return;

  const items = [...list.querySelectorAll('.game')];
  // Match terms against word starts, so "pac" finds Pac-Man but not "compact".
  const words = new Map(items.map((item) => [item, item.dataset.search.split(/[^\p{L}\p{N}]+/u).filter(Boolean)]));
  const count = document.querySelector('[data-result-count]');
  const noun = document.querySelector('[data-result-noun]');
  const empty = document.querySelector('[data-empty]');
  const search = form.elements.q;

  // Restore filters from the URL so a filtered view can be shared.
  const params = new URLSearchParams(location.search);
  if (params.has('q')) search.value = params.get('q');
  if (params.has('genre') && form.querySelector(`input[name="genre"][value="${CSS.escape(params.get('genre'))}"]`)) {
    form.elements.genre.value = params.get('genre');
  }
  if (params.get('phone') === '1') form.elements.mobile.checked = true;

  const apply = () => {
    const terms = search.value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const genre = form.elements.genre.value;
    const phoneOnly = form.elements.mobile.checked;

    let shown = 0;
    for (const item of items) {
      const match =
        (genre === 'all' || item.dataset.genre === genre) &&
        (!phoneOnly || item.dataset.mobile === 'true') &&
        terms.every((t) => words.get(item).some((w) => w.startsWith(t)));
      item.hidden = !match;
      if (match) shown++;
    }

    const filtered = terms.length > 0 || genre !== 'all' || phoneOnly;
    list.toggleAttribute('data-filtered', filtered);
    count.textContent = shown;
    noun.textContent = shown === 1 ? 'game' : 'games';
    empty.hidden = shown > 0;

    const next = new URLSearchParams();
    if (terms.length) next.set('q', search.value.trim());
    if (genre !== 'all') next.set('genre', genre);
    if (phoneOnly) next.set('phone', '1');
    const query = next.toString();
    history.replaceState(null, '', query ? `?${query}#games` : location.pathname + location.hash);
  };

  form.addEventListener('input', apply);
  form.addEventListener('submit', (e) => e.preventDefault());

  search.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) {
      search.value = '';
      apply();
    }
  });

  // "/" jumps to search, like most sites with a search box.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
    search.focus();
  });

  document.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
    form.reset();
    apply();
    search.focus();
  });

  if (params.size > 0) apply();
}

/* ---------- Recently played ---------- */

function initRecent() {
  const section = document.querySelector('[data-recent]');
  const list = document.querySelector('[data-recent-list]');

  const render = () => {
    const recent = storage.get(RECENT_KEY, []).filter((slug) => bySlug.has(slug));
    list.replaceChildren(
      ...recent.map((slug) => {
        const game = bySlug.get(slug);
        const li = document.createElement('li');
        const a = document.createElement('a');
        const img = document.createElement('img');
        a.href = `./${game.href}`;
        a.dataset.slug = slug;
        img.src = thumbSet(slug, './').src;
        img.alt = '';
        img.width = 64;
        img.height = 40;
        img.loading = 'lazy';
        a.append(img, game.title);
        li.append(a);
        return li;
      }),
    );
    section.hidden = recent.length === 0;
  };

  // Record a play when any game link is followed (click, keyboard or middle-click).
  const remember = (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const slug = link.dataset.slug ?? link.closest('.game')?.dataset.slug;
    if (!slug || !bySlug.has(slug)) return;
    const recent = storage.get(RECENT_KEY, []).filter((s) => s !== slug);
    storage.set(RECENT_KEY, [slug, ...recent].slice(0, RECENT_MAX));
  };
  document.addEventListener('click', remember);
  document.addEventListener('auxclick', remember);

  render();
  // Returning with the back button restores the page from bfcache; refresh the list.
  addEventListener('pageshow', (e) => e.persisted && render());
}

/* ---------- Music (opt-in) ---------- */

function initRadio() {
  const toggle = document.querySelector('[data-radio-toggle]');
  const panel = document.getElementById('radio');
  if (!toggle || !panel) return;

  let radio;
  toggle.addEventListener('click', async () => {
    radio ??= new (await import('./radio.js')).Radio(panel, { spriteBase: './assets/icons/sprite.svg' });
    const open = panel.hidden;
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) radio.start();
    else radio.stop();
  });
}
