/**
 * Service Worker for JS Game Lab
 * Asset Caching & Offline Support
 */

const CACHE_NAME = 'js-game-lab-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './assets/css/cyberpunk.css',
    './assets/css/feedback.css',
    './assets/js/main.js',
    './assets/js/dropEffect.js',
    './assets/js/lazyLoad.js',
    './assets/js/config.js',
    './assets/icons/video_game.png',
    './assets/icons/video_game.svg',
    // Art Lab
    './Art_Lab/index.html',
    './assets/css/artlab.css',
    './assets/js/artlab.js'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all: app shell and content');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Clearing old cache');
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch Event - Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
    // Skip cross-origin requests (like Turso or CDN)
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // Update cache if valid response
                    if (networkResponse.ok) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // console.log('Offline: ', event.request.url);
                });

                // Return cached response if available, else fetch
                return response || fetchPromise;
            });
        })
    );
});
