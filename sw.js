const CACHE_NAME = 'ituultimate-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/about.html',
    '/programlayici.html',
    '/yts.html',
    '/ortalamahesaplayici.html',
    '/duyurular.html',
    '/profil.html',
    '/login.html',
    '/register.html',
    '/base.css',
    '/style.css',
    '/scheduler-style.css',
    '/attendance-style.css',
    '/gpa-calculator-style.css',
    '/nav-menu.js',
    '/auth-manager.js',
    '/scheduler-script.js',
    '/attendance-script.js',
    '/gpa-calculator-script.js',
    '/firebase-config.js',
    '/site.webmanifest',
    '/favicon.ico',
    '/favicon-96x96.png',
    '/favicon.svg',
    '/apple-touch-icon.png',
    '/web-app-manifest-192x192.png',
    '/web-app-manifest-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request).then(
                    (response) => {
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    }
                );
            })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});