import { games, thumbSet } from './data.js';

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
    initElements();
    restoreFiltersFromUrl();
    initSearch();
    initFilters();
    initArtLabStrip();
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
 * The Art Lab showcase is one big link; its preview tiles open individual experiments.
 */
function initArtLabStrip() {
    document.querySelectorAll('#artlab-showcase .strip-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(item.dataset.link, '_blank', 'noopener');
        });
    });
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
        link.className = 'recent-chip';
        link.href = `./${game.href}`;
        link.target = '_blank';
        link.rel = 'noopener';
        link.dataset.slug = slug;
        img.src = thumbSet(slug, './').src;
        img.alt = '';
        img.width = 36;
        img.height = 36;
        link.append(img, game.title);
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
