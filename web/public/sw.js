/*
 * Minimal service worker. Its job is to make the site installable and to show a
 * readable page when the device is offline — not to be an offline-first app.
 *
 * Hard rule: nothing belonging to a signed-in session is ever cached. The panel
 * holds someone's follower list, and a cached copy of it sitting in the browser
 * profile is exactly the kind of leftover this app should not create.
 */

const VERSION = 'v1';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([OFFLINE, '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.endsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Paths that must never touch the cache. */
function isPrivate(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/panel') ||
    url.pathname.includes('/giris')
  );
}

function isStatic(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isPrivate(url)) return;

  // Pages: always go to the network, fall back to the offline card. Caching HTML
  // would show stale marketing copy and, worse, a stale signed-in state.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Build output is content-hashed, so it can be served from the cache and
  // refreshed in the background without ever going stale.
  if (isStatic(url)) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
  }
});
