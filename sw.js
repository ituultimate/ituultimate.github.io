// Self-destructing service worker - v2
// This clears all caches and unregisters itself to fix stale content issues

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            // Clear all caches
            caches.keys().then(names =>
                Promise.all(names.map(name => caches.delete(name)))
            ),
            // Unregister this service worker
            self.registration.unregister()
        ]).then(() => {
            // Notify all clients to refresh
            self.clients.matchAll().then(clients => {
                clients.forEach(client => client.navigate(client.url));
            });
        })
    );
});

// Don't cache anything - just pass through to network
self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});