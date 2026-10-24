import { games, thumbSet, GENRES } from './data.js';

const RECENT_KEY = 'gamelab.recent';
const RECENT_MAX = 4;
const bySlug = new Map(games.map(game => [game.slug, game]));
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

// DOM Elements
const elements = {
    gameCardsContainer: null,
    cards: [],
    searchInput: null,
    platformBtns: null,
    genreBtns: null,
    empty: null,
};

// State
let currentFilter = 'all';
let currentGenre = null;
let searchTerms = [];

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', () => {
    initArtlabTeaser();
    initElements();
    restoreFiltersFromUrl();
    initSearch();
    initFilters();
    initBests();
    initRecent();
    applyFilters({ animate: false });
    initScrollAnimations();
    registerServiceWorker();
});

/**
 * Cache DOM elements. The cards are rendered into the HTML by tools/render-pages.mjs.
 */
function initElements() {
    elements.gameCardsContainer = document.getElementById('game-cards-container');
    elements.cards = [...elements.gameCardsContainer.querySelectorAll('.game-card')];
    elements.searchInput = document.getElementById('search-input');
    elements.platformBtns = document.querySelectorAll('.filter-btn[data-filter]');
    elements.genreBtns = document.querySelectorAll('.filter-btn[data-genre]');
    elements.empty = document.getElementById('games-empty');

    // Word lists for prefix search: "pac" finds PacMan but not "compact".
    for (const card of elements.cards) {
        card.words = card.dataset.search.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    }
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchInput = elements.searchInput;

    searchInput.addEventListener('input', () => {
        searchTerms = toTerms(searchInput.value);
        applyFilters();
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchInput.value) {
            searchInput.value = '';
            searchTerms = [];
            applyFilters();
        }
    });

    // "/" jumps to search from anywhere on the page.
    document.addEventListener('keydown', (e) => {
        if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
        e.preventDefault();
        searchInput.focus();
    });
}

function toTerms(value) {
    return value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/**
 * Initialize filter buttons: one platform filter and an optional genre filter.
 */
function initFilters() {
    elements.platformBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            currentFilter = btn.dataset.filter;
            applyFilters();
        });
    });

    elements.genreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Clicking the active genre again turns the genre filter off.
            currentGenre = currentGenre === btn.dataset.genre ? null : btn.dataset.genre;
            applyFilters();
        });
    });

    document.getElementById('clear-filters')?.addEventListener('click', () => {
        currentFilter = 'all';
        currentGenre = null;
        searchTerms = [];
        elements.searchInput.value = '';
        applyFilters();
        elements.searchInput.focus();
    });
}

function restoreFiltersFromUrl() {
    const params = new URLSearchParams(location.search);
    if (['pc', 'mobile'].includes(params.get('platform'))) currentFilter = params.get('platform');
    if (document.querySelector(`.filter-btn[data-genre="${CSS.escape(params.get('genre') ?? '')}"]`)) {
        currentGenre = params.get('genre');
    }
    if (params.has('q')) {
        elements.searchInput.value = params.get('q');
        searchTerms = toTerms(params.get('q'));
    }
}

function syncButtons() {
    elements.platformBtns.forEach(btn => {
        const active = btn.dataset.filter === currentFilter;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
    elements.genreBtns.forEach(btn => {
        const active = btn.dataset.genre === currentGenre;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', String(active));
    });
}

function syncUrl() {
    const params = new URLSearchParams();
    if (searchTerms.length) params.set('q', elements.searchInput.value.trim());
    if (currentFilter !== 'all') params.set('platform', currentFilter);
    if (currentGenre) params.set('genre', currentGenre);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}${location.hash}` : location.pathname + location.hash);
}

/**
 * Show the cards that match the platform, genre and search, and fade newly shown ones in.
 */
function applyFilters({ animate = true } = {}) {
    syncButtons();
    syncUrl();

    const appearing = [];
    let shown = 0;

    for (const card of elements.cards) {
        const match =
            (currentFilter === 'all' || card.dataset.platforms.split(' ').includes(currentFilter)) &&
            (!currentGenre || card.dataset.genre === currentGenre) &&
            searchTerms.every(term => card.words.some(word => word.startsWith(term)));

        if (match && card.hidden) appearing.push(card);
        card.hidden = !match;
        if (match) shown++;
    }

    elements.empty.hidden = shown > 0;

    if (animate && appearing.length && typeof gsap !== 'undefined' && !reduceMotion.matches) {
        gsap.fromTo(appearing,
            { opacity: 0, y: 20 },
            { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out', clearProps: 'opacity,transform' }
        );
    }
}

/**
 * Personal bests saved by the games (assets/kit/storage.js, `gamelab.best.<slug>`):
 * `{ <mode>: { value, label, at } }`. The hub shows the overall best when the game
 * has one, otherwise the most recently set.
 */
function readBest(slug) {
    try {
        const all = JSON.parse(localStorage.getItem(`gamelab.best.${slug}`) ?? 'null');
        if (!all || typeof all !== 'object') return null;
        if (all.default?.label) return String(all.default.label);
        const latest = Object.values(all)
            .filter(entry => entry && entry.label)
            .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0];
        return latest ? String(latest.label) : null;
    } catch {
        return null;
    }
}

function initBests() {
    for (const card of elements.cards) {
        const best = readBest(card.dataset.slug);
        const badge = card.querySelector('.game-card-best');
        if (!best || !badge) continue;
        badge.textContent = `Best: ${best}`;
        badge.hidden = false;
    }
}

/**
 * "Continue playing": games opened from this browser, newest first.
 */
function readRecent() {
    try {
        const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
        return Array.isArray(list) ? list.filter(slug => bySlug.has(slug)) : [];
    } catch {
        return [];
    }
}

function rememberGame(slug) {
    const recent = [slug, ...readRecent().filter(s => s !== slug)].slice(0, RECENT_MAX);
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
        // Storage blocked; the row just won't persist.
    }
    renderRecent();
}

function renderRecent() {
    const wrapper = document.getElementById('recent-games');
    const list = document.getElementById('recent-list');
    const recent = readRecent();

    list.replaceChildren(...recent.map(slug => {
        const game = bySlug.get(slug);
        const li = document.createElement('li');
        const link = document.createElement('a');
        const img = document.createElement('img');
        const text = document.createElement('span');
        const title = document.createElement('span');
        link.className = 'recent-chip';
        link.href = `./${game.href}`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.dataset.slug = slug;
        img.src = thumbSet(slug, './').src;
        img.alt = '';
        img.width = 88;
        img.height = 55;
        img.loading = 'lazy';
        img.decoding = 'async';
        text.className = 'recent-text';
        title.className = 'recent-title';
        title.textContent = game.title;
        text.append(title);
        const best = readBest(slug);
        const sub = document.createElement('span');
        sub.className = 'recent-best';
        if (best) {
            const strong = document.createElement('strong');
            strong.textContent = best;
            sub.append('Best: ', strong);
        } else {
            sub.textContent = GENRES[game.genre] ?? '';
        }
        text.append(sub);
        link.append(img, text);
        li.append(link);
        return li;
    }));

    wrapper.hidden = recent.length === 0;
}

function initRecent() {
    // Covers left click, keyboard Enter and middle click on cards and chips.
    const onOpen = (e) => {
        const link = e.target.closest('a[data-slug]');
        if (link) rememberGame(link.dataset.slug);
    };
    document.addEventListener('click', onOpen);
    document.addEventListener('auxclick', onOpen);
    renderRecent();

    // Games run in their own tabs; pick up new bests and plays when they save.
    window.addEventListener('storage', (e) => {
        if (e.key !== null && !e.key.startsWith('gamelab.')) return;
        initBests();
        renderRecent();
    });
}

/**
 * Art Lab teaser: a sealed pack (rendered by tools/render-pages.mjs). Shows the
 * "opened" copy once this browser has opened the pack in the Art Lab
 * (`artlab.opened`, written by Art_Lab/js/deck.js), leans toward a mouse, and
 * teases the tear once when it first scrolls into view.
 */
function readArtlabOpened() {
    try {
        return JSON.parse(localStorage.getItem('artlab.opened') ?? 'false') === true;
    } catch {
        return false;
    }
}

function initArtlabTeaser() {
    const teaser = document.getElementById('artlab-teaser');
    if (!teaser) return;
    const tilt = teaser.querySelector('.tz-tilt');
    const sync = () => {
        teaser.dataset.state = readArtlabOpened() ? 'opened' : 'sealed';
    };
    sync();
    window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === 'artlab.opened') sync();
    });

    // Lean toward a mouse pointer (not touch: a finger is scrolling the page).
    let frame = 0;
    teaser.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || reduceMotion.matches) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const r = teaser.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            tilt.style.setProperty('--ry', `${(x * 16).toFixed(2)}deg`);
            tilt.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
        });
    });
    teaser.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame);
        tilt.style.removeProperty('--rx');
        tilt.style.removeProperty('--ry');
    });

    // The first time the pack scrolls into view, lift the strip and let the cards peek.
    if (!('IntersectionObserver' in window)) return;
    const seen = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        seen.disconnect();
        if (reduceMotion.matches || teaser.dataset.state !== 'sealed') return;
        setTimeout(() => {
            teaser.classList.add('is-peek');
            setTimeout(() => teaser.classList.remove('is-peek'), 1500);
        }, 600);
    }, { threshold: 0.6 });
    seen.observe(teaser.querySelector('.tz-stage'));
}

/**
 * Initialize scroll-triggered animations
 */
function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || reduceMotion.matches) return;

    gsap.registerPlugin(ScrollTrigger);

    // Animate sections on scroll, once each.
    gsap.utils.toArray('.section').forEach(section => {
        gsap.from(section, {
            scrollTrigger: {
                trigger: section,
                start: 'top 85%',
                once: true
            },
            opacity: 0,
            y: 50,
            duration: 0.8,
            ease: 'power2.out'
        });
    });
}

/**
 * Offline support: cache the hub shell and recently played games.
 */
function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // Offline support is optional; the site works without it.
        });
    });
}
