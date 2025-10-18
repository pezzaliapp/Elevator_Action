// sw.js — Elevator Action PWA (cache-first + offline fallback) 
var CACHE = 'elevator-action-v7';
var ASSETS = [
  './','./index.html','./app.js','./manifest.webmanifest',
  './assets/icon-192.png','./assets/icon-512.png',
  './assets/maskable-192.png','./assets/maskable-512.png',
  './assets/sfx/step.wav','./assets/sfx/door.wav','./assets/sfx/pickup.wav','./assets/sfx/shot.wav'
];
self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS); })
      .then(function(){ return self.skipWaiting(); })
      .catch(function(err){ console.warn('[SW] Install warning:', err); })
  );
});
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});
self.addEventListener('fetch', function(e){
  var req=e.request; if (req.method!=='GET') return;
  if (req.mode==='navigate'){ e.respondWith(fetch(req).catch(function(){ return caches.match('./index.html'); })); return; }
  e.respondWith(
    caches.match(req).then(function(r){ if (r) return r;
      return fetch(req).then(function(res){
        try{ if (new URL(req.url).origin===self.location.origin){ caches.open(CACHE).then(function(c){ c.put(req,res.clone()); }); } }catch(err){}
        return res;
      });
    })
  );
});
