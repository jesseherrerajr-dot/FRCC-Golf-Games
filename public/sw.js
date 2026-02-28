// Service Worker for FRCC Golf Games — Web Push Notifications
// This is a static file served from /public. It handles push events
// and notification clicks for Android Chrome (and other supporting browsers).

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "FRCC Golf Games",
      body: event.data.text(),
      url: "/dashboard",
    };
  }

  const { title = "FRCC Golf Games", body, url, tag } = payload;

  const options = {
    body,
    icon: "/icon-192x192.png",
    badge: "/icon-192x192.png",
    tag: tag || "frcc-default",
    renotify: true,
    data: { url: url || "/dashboard" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // Focus an existing tab if one is open
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new tab
      return clients.openWindow(url);
    })
  );
});
