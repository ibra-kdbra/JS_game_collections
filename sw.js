/**
 * Game Lab service worker.
 *
 * - The hub shell (pages, CSS, JS, fonts, icons) is precached per version, so the
 *   collection opens instantly and offline. Bump VERSION whenever a shell file changes.
 * - Everything else same-origin is served network-first and cached as it is used,
 *   capped by entry count and file size so heavy games can't fill the disk.
 * - Navigations always try the network first, so a deploy shows up on the next visit.
 */

const VERSION = 'v7';
const SHELL_CACHE = `gamelab-shell-${VERSION}`;
const RUNTIME_CACHE = `gamelab-runtime-${VERSION}`;
const RUNTIME_MAX_ENTRIES = 300;
const RUNTIME_MAX_BYTES = 5 * 1024 * 1024;

const SHELL = [
  './',
  './index.html',
  './Art_Lab/',
  './Art_Lab/index.html',
  './assets/css/cyberpunk.css',
  './assets/css/fonts.css',
  './assets/css/variables.css',
  './assets/css/base.css',
  './assets/css/responsive.css',
  './assets/css/components/navigation.css',
  './assets/css/components/hero.css',
  './assets/css/components/cards.css',
  './assets/css/components/artlab-showcase.css',
  './assets/css/components/search-filter.css',
  './assets/css/components/recent.css',
  './assets/css/components/footer.css',
  './assets/css/components/music-player.css',
  './Art_Lab/css/deck.css',
  './assets/css/feedback.css',
  './assets/vendor/fontawesome/fontawesome.css',
  './assets/vendor/fontawesome/fa-solid-900.woff2',
  './assets/vendor/fontawesome/fa-brands-400.woff2',
  './assets/vendor/gsap/gsap.min.js',
  './assets/vendor/gsap/ScrollTrigger.min.js',
  './assets/vendor/three/three.module.min.js',
  './assets/js/data.js',
  './assets/js/script.js',
  './Art_Lab/js/deck.js',
  './Art_Lab/js/cards.js',
  './Art_Lab/js/pack.js',
  './Art_Lab/js/stack.js',
  './assets/kit/storage.js',
  './assets/js/dropEffect.js',
  './assets/js/videoPlayer.js',
  './assets/js/musicPlayer.js',
  './assets/js/youtube.js',
  './assets/js/feedback/FeedbackUI.js',
  './assets/js/feedback/feedbackAPI.js',
  './assets/icons/video_game.svg',
  './assets/icons/video_game.png',
  './assets/fonts/albert-sans-latin-400-normal.woff2',
  './assets/fonts/albert-sans-latin-500-normal.woff2',
  './assets/fonts/albert-sans-latin-600-normal.woff2',
  './assets/fonts/albert-sans-latin-700-normal.woff2',
  './assets/fonts/chakra-petch-latin-400-normal.woff2',
  './assets/fonts/chakra-petch-latin-600-normal.woff2',
  './assets/fonts/chakra-petch-latin-700-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Leave cross-origin requests (CDNs, YouTube, the feedback API) to the browser.
  if (url.origin !== self.location.origin) return;
  // Media streams use range requests, which the Cache API can't answer correctly.
  if (request.headers.has('range')) return;

  event.respondWith(networkFirst(event, request));
});

async function networkFirst(event, request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      event.waitUntil(store(request, response.clone()));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('./index.html');
      if (shell) return shell;
    }
    throw error;
  }
}

async function store(request, response) {
  // Shell files are refreshed in place; everything else goes to the bounded runtime cache.
  const shell = await caches.open(SHELL_CACHE);
  if (await shell.match(request)) {
    await shell.put(request, response);
    return;
  }

  const length = Number(response.headers.get('content-length'));
  if (length > RUNTIME_MAX_BYTES) return;
  const body = await response.blob();
  if (body.size > RUNTIME_MAX_BYTES) return;

  const runtime = await caches.open(RUNTIME_CACHE);
  await runtime.put(request, new Response(body, response));

  const keys = await runtime.keys();
  // Cache keys come back in insertion order; drop the oldest beyond the cap.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - RUNTIME_MAX_ENTRIES)).map((key) => runtime.delete(key)));
}
