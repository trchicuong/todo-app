const CACHE_NAME = 'todo-app-cache';
const urlsToCache = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/css/style.css',
  '/css/landing.css',
  '/js/app.js',
  '/js/landing.js',
  '/js/particles-config.js',
  '/js/sw-register.js',
  'sound/notification.mp3',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js',
  'https://cdn.jsdelivr.net/npm/flatpickr/dist/flatpickr.min.css',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify/dist/purify.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        const promises = urlsToCache.map(urlToCache => {
          const request = new Request(urlToCache, { mode: 'no-cors' });
          return fetch(request).then(response => {
            if (response.status === 200 || response.type === 'opaque') {
              return cache.put(urlToCache, response);
            }
            console.warn(`Skipping caching for ${urlToCache} - Status: ${response.status}`);
          }).catch(err => {
            console.error(`Failed to fetch and cache ${urlToCache}`, err);
          });
        });
        return Promise.all(promises);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
