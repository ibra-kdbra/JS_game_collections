import { games } from './data.js';

// DOM Elements
const elements = {
    gameCardsContainer: null,
    artlabPreview: null,
    searchInput: null,
    filterBtns: null,
    navbar: null,
    particles: null,
};

// State
let currentFilter = 'all';
let searchQuery = '';

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', () => {
    initElements();
    initParticles();
    initNavScroll();
    initSearch();
    initFilters();
    renderArtLabPreview();
    renderGameCards();
    initScrollAnimations();
});

/**
 * Cache DOM elements
 */
function initElements() {
    elements.gameCardsContainer = document.getElementById('game-cards-container');
    elements.artlabPreview = document.getElementById('artlab-preview');
    elements.searchInput = document.getElementById('search-input');
    elements.filterBtns = document.querySelectorAll('.filter-btn');
    elements.navbar = document.getElementById('navbar');
    elements.particles = document.getElementById('particles');
}

/**
 * Generate floating particles for background
 */
function initParticles() {
    const container = elements.particles;
    if (!container) return;

    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'cyber-particle';
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 15}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        container.appendChild(particle);
    }
}

/**
 * Handle navbar scroll effect
 */
function initNavScroll() {
    const navbar = elements.navbar;
    if (!navbar) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
}

/**
 * Initialize search functionality
 */
function initSearch() {
    const searchInput = elements.searchInput;
    if (!searchInput) return;

    let debounceTimer;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderGameCards();
        }, 200);
    });
}

/**
 * Initialize filter buttons
 */
function initFilters() {
    const filterBtns = elements.filterBtns;
    if (!filterBtns) return;

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update filter and re-render
            currentFilter = btn.dataset.filter;
            renderGameCards();
        });
    });
}

/**
 * Render Art Lab showcase section using data from games array
 */
function renderArtLabPreview() {
    const container = document.getElementById('artlab-showcase');
    if (!container) return;

    // Get Art Lab experiments (items 0-6 from games array - all 7 experiments)
    const artLabExperiments = games.slice(0, 7).map(item => ({
        ...item,
        // Fix paths for loading from root (prepend Art_Lab/)
        link: `./Art_Lab/${item.link.replace('./', '')}`,
        imgSrc: `./Art_Lab/${item.imgSrc.replace('./', '')}`
    }));

    // Get the Art Lab main entry (find it in the games array)
    const artLabEntry = games.find(g => g.link === './Art_Lab/index.html');

    // Create showcase HTML with clickable card and all 7 preview images
    container.innerHTML = `
        <a href="./Art_Lab/index.html" class="artlab-main-card">
            <div class="artlab-card-glow"></div>
            
            <!-- Left side: Info -->
            <div class="artlab-card-content">
                <div class="artlab-icon">
                    <i class="fas fa-flask"></i>
                </div>
                <h3 class="artlab-card-title">Art Lab</h3>
                <p class="artlab-card-desc">${artLabEntry?.description || 'Math with Art create wonders'}</p>
                <div class="artlab-stats">
                    <span><i class="fas fa-layer-group"></i> ${artLabExperiments.length} Experiments</span>
                </div>
                <div class="artlab-enter-btn">
                    <span>Explore Collection</span>
                    <i class="fas fa-arrow-right"></i>
                </div>
            </div>
            
            <!-- Right side: Horizontal Preview Strip -->
            <div class="artlab-preview-strip">
                ${artLabExperiments.map((exp) => `
                    <div class="strip-item" data-link="${exp.link}" title="${exp.title}">
                        <img class="lazy" data-src="${exp.imgSrc}" alt="${exp.title}" loading="lazy">
                    </div>
                `).join('')}
            </div>
        </a>
    `;

    // Add click handlers for individual preview items
    container.querySelectorAll('.strip-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            window.open(item.dataset.link, '_blank');
        });
    });

}

/**
 * Filter games based on current filter and search
 */
function getFilteredGames() {
    // Get main games (excluding Art Lab experiments which are items 0-6)
    let filteredGames = games.slice(7);

    // Also exclude the Art Lab main entry (it appears elsewhere in the array)
    filteredGames = filteredGames.filter(game => !game.link.includes('Art_Lab'));

    // Apply platform filter
    if (currentFilter !== 'all') {
        const filterTag = currentFilter === 'pc' ? '#PC' : '#Mobile';
        filteredGames = filteredGames.filter(game =>
            game.tags?.includes(filterTag)
        );
    }

    // Apply search filter
    if (searchQuery) {
        filteredGames = filteredGames.filter(game =>
            game.title.toLowerCase().includes(searchQuery) ||
            game.description.toLowerCase().includes(searchQuery)
        );
    }

    return filteredGames;
}

/**
 * Create a single game card element
 */
function createGameCard(game) {
    const card = document.createElement('a');
    card.href = game.link;
    card.className = 'game-card';
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    // Generate tags HTML from the game.tags array
    const tagsHtml = (game.tags || []).map(tag => {
        const tagText = tag.replace('#', '');
        const isPC = tagText.toLowerCase() === 'pc';
        const tagClass = isPC ? 'tag-pc' : 'tag-mobile';
        const tagIcon = isPC ? 'fa-desktop' : 'fa-mobile-alt';
        return `<span class="tag ${tagClass}"><i class="fas ${tagIcon}"></i> ${tagText}</span>`;
    }).join('');

    // The structure: Card > Inner > [Preview, Content]
    card.innerHTML = `
      <div class="game-card-inner">
          <div class="game-card-preview">
            <div class="game-card-tags">${tagsHtml}</div>
            <img class="lazy" data-src="${game.imgSrc}" alt="${game.title}" loading="lazy">
          </div>
          
          <div class="game-card-content">
            <h3 class="game-card-title">${game.title}</h3>
            <p class="game-card-description">${game.description}</p>
            <div class="game-card-action">
                <span class="play-btn">
                  Play Now <i class="fas fa-arrow-right"></i>
                </span>
            </div>
          </div>
      </div>
    `;

    return card;
}

/**
 * Render game cards with animation
 */
function renderGameCards() {
    const container = elements.gameCardsContainer;
    if (!container) return;

    const filteredGames = getFilteredGames();

    // Fade out existing cards
    const existingCards = container.querySelectorAll('.game-card');

    if (existingCards.length > 0 && typeof gsap !== 'undefined') {
        gsap.to(existingCards, {
            opacity: 0,
            y: 20,
            duration: 0.2,
            stagger: 0.02,
            onComplete: () => {
                renderCards(filteredGames);
            }
        });
    } else {
        renderCards(filteredGames);
    }
}

/**
 * Actually render the cards (after fade out)
 */
function renderCards(games) {
    const container = elements.gameCardsContainer;
    container.innerHTML = '';

    if (games.length === 0) {
        container.innerHTML = `
      <div class="text-center" style="grid-column: 1 / -1; padding: 4rem 2rem;">
        <i class="fas fa-search" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
        <p style="color: var(--text-secondary); font-size: 1.1rem;">No games found matching your search.</p>
      </div>
    `;
        return;
    }

    games.forEach((game, index) => {
        const card = createGameCard(game);
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        container.appendChild(card);
    });

    // Animate cards in
    if (typeof gsap !== 'undefined') {
        const cards = container.querySelectorAll('.game-card');
        gsap.to(cards, {
            opacity: 1,
            y: 0,
            duration: 0.4,
            stagger: 0.05,
            ease: 'power2.out'
        });
    } else {
        const cards = container.querySelectorAll('.game-card');
        cards.forEach(card => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        });
    }
}

/**
 * Initialize scroll-triggered animations
 */
function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    // Animate sections on scroll
    gsap.utils.toArray('.section').forEach(section => {
        gsap.from(section, {
            scrollTrigger: {
                trigger: section,
                start: 'top 80%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 50,
            duration: 0.8,
            ease: 'power2.out'
        });
    });

    // Art Lab feature animation
    const artlabFeature = document.querySelector('.artlab-feature');
    if (artlabFeature) {
        gsap.from('.artlab-content', {
            scrollTrigger: {
                trigger: artlabFeature,
                start: 'top 70%'
            },
            x: -50,
            opacity: 0,
            duration: 0.8,
            ease: 'power2.out'
        });

        gsap.from('.artlab-preview-item', {
            scrollTrigger: {
                trigger: artlabFeature,
                start: 'top 70%'
            },
            x: 50,
            opacity: 0,
            duration: 0.8,
            stagger: 0.1,
            ease: 'power2.out'
        });
    }
}

// Update game count stat
document.addEventListener('DOMContentLoaded', () => {
    const gameCount = document.getElementById('game-count');
    if (gameCount) {
        const mainGamesCount = games.slice(7).length;
        gameCount.textContent = `${mainGamesCount}+`;
    }
});
