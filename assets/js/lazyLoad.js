/**
 * Lazy Loading & SW Registration Utility
 * Uses IntersectionObserver to load images + MutationObserver for dynamic content.
 * Registers Service Worker for PWA capabilities.
 */

// 1. Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Register sw.js relative to the root
        const isArtLab = window.location.pathname.includes('/Art_Lab/');
        const swPath = isArtLab ? '../sw.js' : './sw.js';

        navigator.serviceWorker.register(swPath)
            .then(registration => {
                // console.log('SW registered: ', registration.scope);
            })
            .catch(err => {
                console.log('SW registration failed: ', err);
            });
    });
}

// 2. Lazy Loading Logic
export function initLazyLoading() {
    if (!('IntersectionObserver' in window)) {
        loadAllImages();
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '50px 0px',
        threshold: 0.01
    };

    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                loadImage(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    function observeImages(root = document) {
        const images = root.querySelectorAll('img.lazy:not(.observed)');
        images.forEach(img => {
            img.classList.add('observed');
            // Init styles
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.6s ease-out';
            imageObserver.observe(img);
        });
    }

    // Initial observation
    observeImages();

    // Watch for new images (dynamic rendering)
    const mutationObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                shouldUpdate = true;
            }
        });
        if (shouldUpdate) {
            observeImages();
        }
    });

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function loadImage(img) {
    const src = img.getAttribute('data-src');
    if (!src) {
        // Fallback if class lazy is present but no data-src (e.g. native lazy only)
        img.style.opacity = '1';
        return;
    }

    // Preload
    const tempImage = new Image();
    tempImage.src = src;
    tempImage.onload = () => {
        img.src = src;
        img.style.opacity = '1';
        img.classList.add('loaded');
        img.removeAttribute('data-src');
    };
    tempImage.onerror = () => {
        // Show placeholder or keep default
        img.style.opacity = '1';
    };
}

function loadAllImages() {
    document.querySelectorAll('img.lazy').forEach(img => {
        if (img.getAttribute('data-src')) {
            img.src = img.getAttribute('data-src');
        }
        img.style.opacity = '1';
    });
}

// Init when module loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyLoading);
} else {
    initLazyLoading();
}

// Global exposure
window.initLazyLoading = initLazyLoading;
