const CACHE_NAME = 'athlesense-cache-v1';
const urlsToCache = [
  './index.html',
  './admin.html'
];

// インストール時にファイルをキャッシュ（保存）する
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache);
      })
  );
});

// 画面を開くたびに、キャッシュがあればそれを返し、なければネットから取得する
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // キャッシュ内にデータがあればそれを返す
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
