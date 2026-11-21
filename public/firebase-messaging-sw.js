/* Service worker Fokus: notifikasi push (Firebase Cloud Messaging) + cache offline. */
const CACHE = 'fokus-v1';
const params = new URL(self.location).searchParams;
const config = (() => { try { return JSON.parse(params.get('config') || 'null'); } catch { return null; } })();

if (config && config.apiKey) {
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
  firebase.initializeApp(config);
  // Pesan dengan payload "notification" otomatis ditampilkan oleh SDK saat aplikasi tertutup.
  firebase.messaging();
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Cache: halaman = network-first, file statis = cache-first. Hanya same-origin.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match(self.registration.scope))),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.FCM_MSG && e.notification.data.FCM_MSG.notification && e.notification.data.FCM_MSG.notification.click_action) || self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow(target);
    }),
  );
});
