/**
 * Art Lab page behaviour. The experiment cards are rendered into the HTML by
 * tools/render-pages.mjs; this adds carousel navigation and the hero entrance.
 */
(function () {
    'use strict';

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function init() {
        const track = document.getElementById('carousel-track');
        if (track) setupNavigation(track);
        runHeroAnimations();
        registerServiceWorker();
    }

    function setupNavigation(track) {
        const prevBtn = document.getElementById('carousel-prev');
        const nextBtn = document.getElementById('carousel-next');
        const scrollAmount = 380;
        const behavior = reduceMotion ? 'auto' : 'smooth';

        prevBtn?.addEventListener('click', () => track.scrollBy({ left: -scrollAmount, behavior }));
        nextBtn?.addEventListener('click', () => track.scrollBy({ left: scrollAmount, behavior }));

        // Arrow keys scroll the carousel when it has focus.
        track.tabIndex = 0;
        track.setAttribute('aria-label', 'Experiments carousel');
        track.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') track.scrollBy({ left: scrollAmount, behavior });
            if (e.key === 'ArrowLeft') track.scrollBy({ left: -scrollAmount, behavior });
        });

        // Drag to scroll with a mouse; touch devices scroll natively.
        let isDown = false;
        let dragged = false;
        let startX;
        let scrollLeft;

        track.addEventListener('mousedown', (e) => {
            isDown = true;
            dragged = false;
            startX = e.pageX - track.offsetLeft;
            scrollLeft = track.scrollLeft;
            track.style.cursor = 'grabbing';
        });

        const stop = () => {
            isDown = false;
            track.style.cursor = 'grab';
        };
        track.addEventListener('mouseleave', stop);
        track.addEventListener('mouseup', stop);

        track.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const walk = (e.pageX - track.offsetLeft - startX) * 1.5;
            if (Math.abs(walk) > 5) dragged = true;
            track.scrollLeft = scrollLeft - walk;
        });

        // A drag shouldn't also open the card it ended on.
        track.addEventListener('click', (e) => {
            if (dragged) {
                e.preventDefault();
                dragged = false;
            }
        }, true);
    }

    function runHeroAnimations() {
        if (typeof gsap === 'undefined' || reduceMotion) return;

        gsap.from('.artlab-hero-badge', { opacity: 0, y: 30, duration: 0.8, delay: 0.2 });
        gsap.from('.artlab-hero-title', { opacity: 0, y: 40, duration: 1, delay: 0.4 });
        gsap.from('.artlab-hero-subtitle', { opacity: 0, y: 30, duration: 0.8, delay: 0.6 });
        gsap.from('.artlab-hero-cta', { opacity: 0, y: 20, duration: 0.6, delay: 0.8 });
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('../sw.js').catch(() => {});
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
