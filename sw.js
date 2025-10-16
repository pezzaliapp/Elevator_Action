// sw.js — Elevator Action PWA (cache-first + offline fallback)
var CACHE = 'elevator-action-v3';
var ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/maskable-192.png',
  './assets/maskable-512.png',
  // SFX (precache)
  './assets/sfx/step.wav',
  './assets/sfx/door.wav',
  './assets/sfx/pickup.wav',
  './assets/sfx/shot.wav'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;

  // Solo GET
  if (req.method !== 'GET') return;

  // Per navigazioni (URL digitate/click) usa fallback index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(function () {
        return caches.match('./index.html');
      })
    );
    return;
  }

  // Cache-first per asset statici
  e.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        // Salva una copia in cache (solo stessa origine)
        try {
          if (new URL(req.url).origin === self.location.origin) {
            var resClone = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, resClone); });
          }
        } catch (err) { /* ignora */ }
        return res;
      });
    })
  );
});
