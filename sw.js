const CACHE = 'world-bible-v0.1.0';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/data/db.js', './js/data/backup.js',
  './js/domain/schema.js', './js/domain/search.js', './js/domain/relations.js'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
