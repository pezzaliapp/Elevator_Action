// sw.js — Elevator Action PWA (cache-first)
var CACHE = 'elevator-action-v2';
var ASSETS = [
  './','./index.html','./styles.css','./app.js','./manifest.webmanifest',
  './assets/icon-192.png','./assets/icon-512.png','./assets/maskable-192.png','./assets/maskable-512.png'
];
self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
});
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);})); 
  }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(function(r){ return r || fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE).then(function(c){ c.put(req, copy); });
      return res;
    }); })
  );
});
