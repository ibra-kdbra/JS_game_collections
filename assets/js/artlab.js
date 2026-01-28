import { games } from './data.js';

(function () {
    'use strict';

    // Prevent double execution via global flag
    if (window.artLabInitialized) return;
    window.artLabInitialized = true;

    // Filter experiments from shared data source
    const experiments = games
        .filter(item => item.type === 'experiment')
        .map((item, index) => ({
            id: index + 1,
            link: item.link,
            imgSrc: item.imgSrc,
            title: item.title,
            description: item.description,
            tags: item.experimentTags || []
        }));

    // Core Init Function
    function init() {
        const track = document.getElementById('carousel-track');
        if (!track) return;

        // 1. Clear existing content immediately
        track.innerHTML = '';

        // 2. Render Cards efficiently
        const html = experiments.map((exp, i) => `
            <article class="experiment-card">
                <a href="${exp.link}" target="_blank" rel="noopener noreferrer" style="text-decoration: none; color: inherit; display: block;">
                    <div class="experiment-card-inner">
                        <div class="experiment-card-preview">
                            <span class="experiment-number">${String(i + 1).padStart(2, '0')}</span>
                            <img src="${exp.imgSrc}" alt="${exp.title}" loading="lazy">
                        </div>
                        <div class="experiment-card-content">
                            <h3 class="experiment-card-title">${exp.title}</h3>
                            <p class="experiment-card-description">${exp.description}</p>
                            <div class="experiment-tags">
                                ${exp.tags.map(t => `<span class="experiment-tag">${t}</span>`).join('')}
                            </div>
                            <div class="experiment-card-action">
                                <span class="experiment-link">View Experiment <i class="fas fa-arrow-right"></i></span>
                            </div>
                        </div>
                    </div>
                </a>
            </article>
        `).join('');

        track.innerHTML = html;

        // 3. Setup Navigation
        setupNavigation(track);

        // 4. Trigger Animations (CSS Transition based)
        requestAnimationFrame(() => {
            const cards = track.querySelectorAll('.experiment-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('appear');
                }, index * 100);
            });
        });

        // 5. Run Hero Animations (if GSAP available)
        runHeroAnimations();
    }

    function setupNavigation(track) {
        const prevBtn = document.getElementById('carousel-prev');
        const nextBtn = document.getElementById('carousel-next');
        if (!prevBtn || !nextBtn) return;

        const scrollAmount = 380;

        prevBtn.onclick = () => track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        nextBtn.onclick = () => track.scrollBy({ left: scrollAmount, behavior: 'smooth' });

        // Simple drag support
        let isDown = false;
        let startX;
        let scrollLeft;

        track.addEventListener('mousedown', (e) => {
            isDown = true;
            track.classList.add('active');
            startX = e.pageX - track.offsetLeft;
            scrollLeft = track.scrollLeft;
            track.style.cursor = 'grabbing';
        });

        track.addEventListener('mouseleave', () => {
            isDown = false;
            track.style.cursor = 'grab';
        });

        track.addEventListener('mouseup', () => {
            isDown = false;
            track.style.cursor = 'grab';
        });

        track.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - track.offsetLeft;
            const walk = (x - startX) * 1.5;
            track.scrollLeft = scrollLeft - walk;
        });
    }

    function runHeroAnimations() {
        if (typeof gsap === 'undefined') return;

        gsap.from('.artlab-hero-badge', { opacity: 0, y: 30, duration: 0.8, delay: 0.2 });
        gsap.from('.artlab-hero-title', { opacity: 0, y: 40, duration: 1, delay: 0.4 });
        gsap.from('.artlab-hero-subtitle', { opacity: 0, y: 30, duration: 0.8, delay: 0.6 });
        gsap.from('.artlab-hero-cta', { opacity: 0, y: 20, duration: 0.6, delay: 0.8 });
    }

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
