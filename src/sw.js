const CACHE_NAME = 'anildash-blog-v1';
const STATIC_CACHE = 'anildash-static-v1';

// Files to cache immediately when service worker installs
const STATIC_ASSETS = [
  '/',
  '/public/styles.css',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('Service worker installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service worker activated');
      return self.clients.claim();
    })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip external requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    // Try network first
    fetch(event.request)
      .then(response => {
        // If successful, cache the response and return it
        if (response.status === 200) {
          const responseClone = response.clone();
          
          // Determine which cache to use
          const url = new URL(event.request.url);
          const cacheName = isStaticAsset(url.pathname) ? STATIC_CACHE : CACHE_NAME;
          
          caches.open(cacheName).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              console.log('Serving from cache:', event.request.url);
              return response;
            }
            
            // If it's a page request and we can't serve it, show offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/');
            }
            
            // For other requests, we don't have anything
            throw new Error('No cached version available');
          });
      })
  );
});

// Helper function to determine if a request is for a static asset
function isStaticAsset(pathname) {
  return pathname.startsWith('/public/') || 
         pathname.startsWith('/images/') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.js') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.webp') ||
         pathname === '/manifest.json';
}