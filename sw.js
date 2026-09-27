/* Nimbus Radio — app shell v3.1 */
const CACHE_PREFIX = 'nimbus-radio-';
const CACHE_NAME = `${CACHE_PREFIX}v3.1`;
const SHELL = [
  './', './index.html', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './apple-touch-icon.png', './favicon-32.png'
].map(path => new URL(path, self.registration.scope).href);
const HOME = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  // Existing listeners choose when to activate through the update banner.
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Audio, remote streams, external fonts and feedback bypass this cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.destination === 'audio') return;
  const navigation = request.mode === 'navigate';
  const legacyEntry = new URL('./nimbus-radio.html', self.registration.scope).pathname;
  const appEntry = navigation && (
    url.pathname === new URL(self.registration.scope).pathname ||
    url.pathname === new URL(HOME).pathname || url.pathname === legacyEntry
  );
  if (!appEntry && !SHELL.includes(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const target = appEntry ? HOME : request;
    try {
      const response = await fetch(target, { cache: 'no-cache' });
      if (response.ok) await cache.put(target, response.clone());
      // Prefer the last working shell to a temporary host error.
      if (!response.ok) return (await cache.match(target)) || response;
      return response;
    } catch (error) {
      const cached = await cache.match(target);
      if (cached) return cached;
      throw error;
    }
  })());
});
