const CACHE = 'tu-rutina-v20';
const ASSETS = [
  "./",
  "./index.html",
  "./privacy.html",
  "./css/main.css",
  "./css/extra.css",
  "./js/config.js",
  "./js/model.js",
  "./js/body-calc.js",
  "./js/progression-calc.js",
  "./js/storage.js",
  "./js/routine-store.js",
  "./js/routine-render.js",
  "./js/routine-editor.js",
  "./js/routine-generator.js",
  "./js/routine-wizard.js",
  "./js/log.js",
  "./js/workout.js",
  "./js/progress.js",
  "./js/body.js",
  "./js/settings.js",
  "./js/sync.js",
  "./js/app.js",
  "./js/pwa.js",
  "./content/log.html",
  "./content/progression.html",
  "./data/default-routine.json",
  "./data/exercise-catalog.json",
  "./manifest.webmanifest",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
  "https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname.endsWith('supabase.co') || url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('supabase')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (url.origin === self.location.origin && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      });
    })
  );
});
