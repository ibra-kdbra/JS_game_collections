/**
 * Game Lab service worker.
 *
 * - The hub shell (pages, CSS, JS, fonts, icons) is precached per version, so the
 *   collection opens instantly and offline. Bump VERSION whenever a shell file changes.
 * - Everything else same-origin is served network-first and cached as it is used,
 *   capped by entry count and file size so heavy games can't fill the disk.
 * - Navigations always try the network first, so a deploy shows up on the next visit.
 */

const VERSION = 'v2';
const SHELL_CACHE = `gamelab-shell-${VERSION}`;
const RUNTIME_CACHE = `gamelab-runtime-${VERSION}`;
const RUNTIME_MAX_ENTRIES = 300;
const RUNTIME_MAX_BYTES = 5 * 1024 * 1024;

const SHELL = [
  './',
  './index.html',
  './Art_Lab/',
  './Art_Lab/index.html',
  './assets/css/tokens.css',
  './assets/css/hub.css',
  './assets/css/artlab.css',
  './assets/css/feedback.css',
  './assets/js/data.js',
  './assets/js/site.js',
  './assets/js/hub.js',
  './assets/js/artlab.js',
  './assets/js/radio.js',
  './assets/js/feedback/FeedbackUI.js',
  './assets/js/feedback/feedbackAPI.js',
  './assets/icons/sprite.svg',
  './assets/icons/video_game.svg',
  './assets/icons/video_game.png',
  './assets/fonts/big-shoulders-display-latin-600-normal.woff2',
  './assets/fonts/big-shoulders-display-latin-800-normal.woff2',
  './assets/fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  './assets/fonts/atkinson-hyperlegible-latin-700-normal.woff2',
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
