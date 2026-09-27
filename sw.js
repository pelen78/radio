/* Nimbus Radio — app shell v3.1.1 */
const CACHE_PREFIX = 'nimbus-radio-';
const CACHE_NAME = `${CACHE_PREFIX}v3.1.1`;
const SHELL = [
  './', './manifest.json',
  './icons/icon-192.png', './icons/icon-512.png',
  './apple-touch-icon.png', './favicon-32.png'
].map(path => new URL(path, self.registration.scope).href);
// Static hosts redirect index.html to the directory URL. Cache that canonical URL.
const HOME = self.registration.scope;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL);
    // Repair release: replace the worker that prevents existing users opening the app.
    await self.skipWaiting();
  })());
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
    url.pathname === new URL('./index.html', self.registration.scope).pathname || url.pathname === legacyEntry
  );
  if (!appEntry && !SHELL.includes(url.href)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const target = appEntry ? HOME : request;
    try {
      let response = await fetch(target, { cache: 'no-cache' });
      // Navigation requests can reject followed-redirect responses from a worker.
      if (appEntry && response.redirected) {
        response = new Response(response.body, {
          status: response.status, statusText: response.statusText, headers: response.headers
        });
      }
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
