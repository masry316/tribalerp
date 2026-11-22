const CACHE_NAME = 'tw-erp-pwa-v7-react';
const PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/apple-touch-icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Handle Web Push events from Push Service
self.addEventListener('push', (event) => {
  let payload = {
    title: 'تنبيه حرب القبائل ERP',
    body: 'لديك تحديث ميداني عاجل في إحدى القرى',
    tag: 'tw-erp-push-' + Date.now(),
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = Object.assign(payload, parsed);
    } catch (_) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || ('tw-erp-push-' + Date.now()),
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: payload.vibrate || [200, 100, 200, 100, 350],
    dir: 'rtl',
    lang: 'ar',
    data: payload.data || { url: '/' },
    actions: payload.actions || [
      { action: 'open_village', title: 'فتح القرية والوصول السريع' },
      { action: 'dismiss', title: 'مسح الإشعار' }
    ]
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// Handle direct messages from the ERP client to trigger native Service Worker notifications
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SHOW_PUSH_NOTIFICATION') {
    const title = msg.title || 'حرب القبائل ERP';
    const options = Object.assign({
      body: '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag: 'tw-erp-notif-' + Date.now(),
      renotify: true,
      vibrate: [200, 100, 200, 100, 350],
      dir: 'rtl',
      lang: 'ar',
      data: { url: '/' },
      actions: [
        { action: 'open_village', title: 'فتح القرية والوصول السريع' },
        { action: 'dismiss', title: 'مسح الإشعار' }
      ]
    }, msg.options || {});

    event.waitUntil(self.registration.showNotification(title, options));
  } else if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle user tapping on the notification or its action buttons on mobile/desktop
self.addEventListener('notificationclick', (event) => {
  const notif = event.notification;
  const data = notif.data || {};
  const action = event.action;
  notif.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (action === 'dismiss' && data.vilId) {
        for (const client of clientList) {
          client.postMessage({
            type: 'SW_DISMISS_VILLAGE_ALERT',
            vilId: data.vilId
          });
        }
        return;
      }

      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'SW_FOCUS_VILLAGE',
            vilId: data.vilId || '',
            accId: data.accId || '',
            accName: data.accName || '',
            device: data.device || '',
            browser: data.browser || ''
          });
          return client.focus();
        }
      }

      const targetUrl = data.vilId
        ? `/?focusVilId=${encodeURIComponent(data.vilId)}`
        : (data.url || '/');
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
