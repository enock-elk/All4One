const CACHE_NAME = 'all4one-v2';
const SHELL_URLS = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function isBundledAsset(url) {
  return url.pathname.includes('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer network for HTML and hashed bundles so deploys are not stuck on stale JS.
  if (request.mode === 'navigate' || url.pathname.endsWith('.html') || isBundledAsset(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && request.mode === 'navigate') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html'))),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request)),
  );
});
