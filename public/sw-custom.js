/* Custom SW events for push notifications */
self.addEventListener('push', (event) => {
  try {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Thông báo';
    const body = data.body || 'Bạn có thông báo mới';
    const icon = data.icon || '/images/android-chrome-192x192.png';
    const badge = data.badge || '/images/android-chrome-192x192.png';
    const url = data.url || '/dashboard';

    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data: { url },
        actions: data.actions || [],
      }),
    );
  } catch (e) {
    event.waitUntil(
      self.registration.showNotification('Thông báo', {
        body: 'Bạn có thông báo mới',
        icon: '/images/android-chrome-192x192.png',
      }),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  const urlToOpen =
    (event.notification && event.notification.data && event.notification.data.url) || '/dashboard';
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(urlToOpen)) return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(urlToOpen);
    }),
  );
});
