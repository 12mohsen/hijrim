const CACHE_NAME = 'hijri-calendar-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];

// Install event - cache files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Check if valid response
            if(!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // If fetch fails, return offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background Sync for offline functionality
self.addEventListener('sync', event => {
  if (event.tag === 'sync-dates') {
    event.waitUntil(syncDates());
  }
});

// Periodic Sync for regular updates
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-dates') {
    event.waitUntil(syncDates());
  }
});

async function syncDates() {
  try {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const response = await fetch(`https://api.aladhan.com/v1/gToH/${day}-${month}-${year}`);
    const data = await response.json();

    if (response.ok && data.code === 200) {
      const hijri = data.data.hijri;
      const hijriDate = `${hijri.weekday.ar}، ${hijri.day} ${hijri.month.ar} ${hijri.year}هـ`;
      
      // Store dates in IndexedDB
      const db = await openDatabase();
      await db.put('dates', {
        id: 'today',
        hijri: hijriDate,
        gregorian: now.toLocaleDateString('ar'),
        lastUpdated: now.toISOString()
      });

      // Show notification if during day hours
      const hour = now.getHours();
      if (hour >= 9 && hour <= 21) {
        self.registration.showNotification('تم تحديث التاريخ', {
          body: `${now.toLocaleDateString('ar')}\n${hijriDate}`,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
          tag: 'date-update',
          renotify: true
        });
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}
