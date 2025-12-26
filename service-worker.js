const CACHE_NAME = 'kate-christmas-v2';
const urlsToCache = [
    '.',
    'index.html',
    'style.css',
    'game.js',
    'manifest.json',
    'assets/background.png',
    'assets/cranberry.svg',
    'assets/sprout.svg',
    'assets/carrot.svg',
    'assets/cabbage.svg',
    'assets/potato.svg',
    'assets/broccoli.svg',
    'assets/yorkshire.svg',
    'assets/sausage.svg',
    'assets/stuffing.svg',
    'assets/turkey.svg',
    'assets/pudding.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => {
                    return name !== CACHE_NAME;
                }).map((name) => {
                    return caches.delete(name);
                })
            );
        })
    );
});
