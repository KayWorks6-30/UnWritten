const CACHE = 'unwritten-v3.1.1';
const SHELL = [
  './', './index.html', './styles.css?v=3.1.1', './manifest.webmanifest', './assets/favicon.ico', './assets/unwritten-icon-32.png', './assets/unwritten-icon-180.png', './assets/unwritten-icon-192.png', './assets/unwritten-icon-512.png',
  './js/app.js',
  './js/data/db.js', './js/data/drafts.js', './js/data/legacy.js', './js/data/backup.js', './js/data/migrations.js', './js/data/validation.js', './js/data/zip.js', './js/data/markdown.js',
  './js/domain/schema.js', './js/domain/search.js', './js/domain/relations.js', './js/domain/timeline.js', './js/domain/story.js', './js/domain/graphs.js', './js/domain/intelligence.js',
  './js/ui/v3.js'
];

self.addEventListener('install', event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
));

self.addEventListener('activate', event => event.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim())
));

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Cloud-backed UnWritten needs the network anyway. Prefer the newest deployed shell
  // and use the cache only as a fallback, so CSS/JS hotfixes are not trapped behind
  // an older cache-first service worker.
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(event.request, { ignoreSearch: true });
      if (cached) return cached;
      throw error;
    }
  })());
});
