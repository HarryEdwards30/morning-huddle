// Offline support. Keeps a copy of the app and the latest edition on the phone, so Morning Huddle
// opens straight away and still works without a connection (showing the last edition it loaded).
//
// - Files from this site: fetched fresh when online, and the copy kept up to date. If the network
//   fails or is very slow, the kept copy is used.
// - Fonts: kept after the first download.
//
// scripts/build-site.js fills in VERSION and the list of files to keep when it builds the site.

const VERSION = '__BUILD_VERSION__';
const FILES = ['__FILES__'];
const CACHE = `huddle-${VERSION}`;
const FONTS = 'huddle-fonts';
const SLOW_MS = 6000; // after this long, use the kept copy rather than keep waiting

self.addEventListener('install', event => {
  // Add files one at a time, so one missing file (like status.json) doesn't stop the rest.
  event.waitUntil(caches.open(CACHE)
    .then(cache => Promise.all(FILES.map(f => cache.add(new Request(f, { cache: 'reload' })).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) event.respondWith(networkFirst(request));
  else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  // Opening the app (index.html, with or without a #tab) always matches the kept page.
  const key = request.mode === 'navigate' ? new URL('./', self.location).href : request;
  const kept = () => cache.match(key, { ignoreSearch: true });
  const fresh = fetch(request).then(response => {
    if (response.ok) cache.put(key, response.clone());
    return response;
  });
  fresh.catch(() => {}); // a failure is handled below; this just stops a console warning
  const slow = new Promise(resolve => setTimeout(resolve, SLOW_MS)).then(kept);
  try {
    // Whichever comes first: the network, or (if it's slow) a kept copy.
    const first = await Promise.race([fresh, slow]);
    return first || await fresh;
  } catch {
    const copy = await kept();
    if (copy) return copy;
    throw new Error('offline and not saved on this phone');
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(FONTS);
  const kept = await cache.match(request);
  if (kept) return kept;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}
