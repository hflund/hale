const CACHE = 'hale-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './src/styles/tokens.css',
  './src/styles/layout.css',
  './src/styles/components.css',
  './src/app.js',
  './src/data/db.js',
  './src/data/schema.js',
  './src/data/export.js',
  './src/components/Charts.js',
  './src/components/BottomNav.js',
  './src/components/Onboarding.js',
  './src/components/Dashboard.js',
  './src/components/LogSession.js',
  './src/components/Progress.js',
  './src/components/Tools.js',
  './src/components/ExerciseLibrary.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network-first for navigation, cache-first for assets
  const url = new URL(event.request.url);
  const isLocal = url.origin === location.origin;

  if (!isLocal) {
    // Pass through external requests (Google Fonts, Lucide CDN)
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
        }
        return res;
      });
      return cached || network;
    })
  );
});
