/**
 * Art Lab - Creative Experiments Application
 * Completely rewritten for stability and performance
 */
(function () {
    'use strict';

    // Prevent double execution via global flag
    if (window.artLabInitialized) return;
    window.artLabInitialized = true;

    // Experiment Data
    const experiments = [
        {
            id: 1,
            link: './BlossomingFlowers/index.html',
            imgSrc: './BlossomingFlowers/assets/captured.png',
            title: 'Blossoming Flowers',
            description: 'Pure CSS blossoming flowers animation. Watch as petals unfold in a mesmerizing dance of color and motion.',
            tags: ['CSS Art', 'Animation']
        },
        {
            id: 2,
            link: './Simple/index.html',
            imgSrc: './Simple/captured.png',
            title: 'Flow Fields',
            description: 'Experiment with flow fields. Press D to debug or double touch. Watch particles dance through invisible currents.',
            tags: ['Canvas', 'Particles']
        },
        {
            id: 3,
            link: './Text_Fields/index.html',
            imgSrc: './Text_Fields/captured.png',
            title: 'Text Fields',
            description: 'Typography meets generative art. Text rendered as particle systems moving through flow fields.',
            tags: ['Typography', 'Canvas']
        },
        {
            id: 4,
            link: './Experimental_math/index.html',
            imgSrc: './Experimental_math/captured.png',
            title: 'Experimental Math',
            description: 'Low-level mathematical explorations with flow fields. Visualize equations in motion.',
            tags: ['Math', 'Generative']
        },
        {
            id: 5,
            link: './Adaptive/index.html',
            imgSrc: './Adaptive/images/result3.png',
            title: 'Adaptive Fields',
            description: 'Try multiple variations with adaptive flow fields that respond to your interaction.',
            tags: ['Interactive', 'Canvas']
        },
        {
            id: 6,
            link: './LSD/index.html',
            imgSrc: './LSD/assets/captured.png',
            title: 'LSD',
            description: 'Create psychedelic animations in real-time. A trip through color and form.',
            tags: ['Psychedelic', 'Real-time']
        },
        {
            id: 7,
            link: './ParticularDrift/index.html',
            imgSrc: './ParticularDrift/assets/captured.png',
            title: 'Particular Drift',
            description: 'Watch particles drift through space in this meditative visual experience.',
            tags: ['Particles', 'Ambient']
        }
    ];

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
        // Use a small timeout to allow DOM to paint first, ensuring transition runs
        requestAnimationFrame(() => {
            const cards = track.querySelectorAll('.experiment-card');
            cards.forEach((card, index) => {
                setTimeout(() => {
                    card.classList.add('appear');
                }, index * 100); // Stagger effect
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

        // Simple Hero Animations only - Only run once
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
