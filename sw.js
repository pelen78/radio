/* ============================================
   Nimbus Radio — Service Worker v1.0
   ============================================ */

const CACHE_NAME = 'nimbus-radio-v1';

// Files to cache immediately on install (app shell)
const SHELL = [
  '/nimbus-radio.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon-32.png'
];

// ── Install: cache the app shell ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(SHELL);
    })
  );
  // Take control immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── Activate: clean up old caches ─────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────
// Audio streams → always network (never cache streams)
// App shell    → cache-first, then network fallback
// Everything else → network-first, then cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept audio streams — let them go straight to network
  const isAudioStream =
    event.request.destination === 'audio' ||
    url.pathname.endsWith('.mp3') ||
    url.pathname.endsWith('.aac') ||
    url.pathname.includes('stream') ||
    url.hostname.includes('streamtheworld') ||
    url.hostname.includes('cdnstream') ||
    url.hostname.includes('infomaniak') ||
    url.hostname.includes('streamguys') ||
    url.hostname.includes('musicradio') ||
    url.hostname.includes('181fm') ||
    url.hostname.includes('pureplay') ||
    url.hostname.includes('rfienespagnol') ||
    url.hostname.includes('npr-ice');

  if (isAudioStream) {
    // Pass through — don't even respond, let browser handle it
    return;
  }

  // App shell files → cache-first
  const isShell = SHELL.some(path => url.pathname.endsWith(path.replace(/^\//, '')));
  if (isShell) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Everything else → network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
