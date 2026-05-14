const CACHE_NAME = 'sagittarius-v2'
const PRECACHE_URLS = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest']

// Cache strategies:
// - NetworkFirst: Always fetch fresh, fallback to cache (for HTML/JS/CSS)
// - StaleWhileRevalidate: Serve cache immediately, update in background (for images/fonts)
// - CacheFirst: Serve from cache, only network if miss (for static assets)

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    try {
      await cache.addAll(PRECACHE_URLS)
    } catch {
      // Ignore shell precache failures; runtime caching still applies.
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    // Delete ALL old caches to ensure fresh content
    await Promise.all(keys.map(key => {
      if (key !== CACHE_NAME) {
        console.log('[SW] Deleting old cache:', key)
        return caches.delete(key)
      }
    }))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and JMAP API calls
  if (url.origin !== self.location.origin || request.method !== 'GET') return
  if (url.pathname.startsWith('/jmap')) return

  // HTML navigation: Network first, then cache
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirst(request))
    return
  }

  // JS/CSS: Network first with cache fallback (critical for updates)
  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(networkFirstWithTimeout(request, 3000))
    return
  }

  // Images/Fonts: Stale while revalidate (ok to show cached, update in background)
  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(staleWhileRevalidate(request))
    return
  }

  // Everything else: Network first
  event.respondWith(networkFirst(request))
})

// Network first strategy - always try fresh, fallback to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    const cached = await caches.match(request)
    if (cached) return cached
    throw error
  }
}

// Network first with timeout - if network is slow, use cache
async function networkFirstWithTimeout(request, timeoutMs) {
  return new Promise((resolve, reject) => {
    let resolved = false

    // Try network first
    fetch(request)
      .then(response => {
        if (!resolved && response.ok) {
          resolved = true
          const cache = caches.open(CACHE_NAME)
          cache.then(c => c.put(request, response.clone()))
          resolve(response)
        }
      })
      .catch(() => {
        // Network failed, will try cache below
      })

    // Timeout fallback
    setTimeout(async () => {
      if (!resolved) {
        const cached = await caches.match(request)
        if (cached) {
          resolved = true
          console.log('[SW] Using cached version due to slow network:', request.url)
          resolve(cached)
          
          // Still update cache in background
          try {
            const networkResponse = await fetch(request)
            if (networkResponse.ok) {
              const cache = await caches.open(CACHE_NAME)
              cache.put(request, networkResponse.clone())
            }
          } catch {}
        }
      }
    }, timeoutMs)
  })
}

// Stale while revalidate - serve cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request)
  
  // Always try to fetch fresh in background
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(CACHE_NAME)
      cache.then(c => c.put(request, response.clone()))
    }
    return response
  }).catch(() => null)

  // Return cached version immediately if available
  if (cached) {
    // Wait a bit then return cached (let fetch happen in background)
    return cached
  }

  // No cache, wait for network
  const networkResponse = await fetchPromise
  if (networkResponse) return networkResponse
  
  throw new Error('Network and cache both failed')
}

// Push notification handler (RFC 9749 WebPush)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const { title, body, icon, tag, url } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'New email', {
      body: body || 'You have a new message',
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: tag || 'sagittarius-email',
      data: { url: url || '/' },
      requireInteraction: false,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Message handler for cache clearing
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting()
  }
  if (event.data === 'clearCache') {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key))
    })
  }
})
