const CACHE_NAME = 'all4one-watcher-v1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './js/app.js',
  './js/trello.js',
  './js/trello-poller.js',
  './js/trello-worker.js',
  './public/workers/trello-worker.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './sounds/bottle_opener.mp3',
  './sounds/carlock.mp3',
  './sounds/doorbell.mp3',
  './sounds/email_notification.mp3',
  './sounds/message_messaaaaaage.mp3',
  './sounds/message_my_lord.mp3',
  './sounds/message_tone.mp3',
  './sounds/zap.mp3',
  './sounds/just_calledf__k_u.mp3',
  './sounds/ping.mp3',
  './sounds/notification.mp3',
  './sounds/sneeze.mp3',
  './sounds/wahwahwahwahhh.mp3',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache).catch(() => undefined)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
