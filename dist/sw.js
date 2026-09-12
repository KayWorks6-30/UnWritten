const CACHE = 'unwritten-kayworks-v2.0.0';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js',
  './js/data/db.js', './js/data/drafts.js', './js/data/legacy.js', './js/data/backup.js', './js/data/migrations.js', './js/data/validation.js', './js/data/zip.js', './js/data/markdown.js',
  './js/domain/schema.js', './js/domain/search.js', './js/domain/relations.js', './js/domain/timeline.js', './js/domain/story.js', './js/domain/graphs.js'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url=new URL(event.request.url);
  if(url.pathname.startsWith('/api/')) { event.respondWith(fetch(event.request)); return; }
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
