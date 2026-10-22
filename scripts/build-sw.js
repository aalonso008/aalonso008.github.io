const fs = require('fs');
const path = require('path');

const site = (process.env.SITE_URL || 'https://aalonso008.github.io').replace(/\/$/, '');
const scopePath = new URL(site + '/').pathname;

const sw = `/* tu-rutina-v41: la información vive en la base, no en la caché. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;
  event.respondWith(fetch(event.request));
});
`;

fs.writeFileSync(path.join(__dirname, '..', 'sw.js'), sw);
console.log('Service worker generado con scope', scopePath);
