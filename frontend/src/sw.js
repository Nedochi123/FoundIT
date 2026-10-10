import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

// Take over as soon as a new version has installed. Without this a phone keeps showing the OLD app until every
// FoundIT window is fully closed (an installed app that is only backgrounded counts as open), so students
// would not see new features for days. src/main.jsx reloads the page once when the new version takes over.
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FoundIT", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "FoundIT";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192.png",
      badge: data.badge || "/icons/icon-192.png",
      data: { url: data.url || "/" },
      // an urgent alert (someone needs a lost item and is offering a reward) stays until it is dealt with and
      // buzzes the phone; the tag makes a repeat of the same alert replace the old one instead of stacking
      ...(data.urgent ? { requireInteraction: true, vibrate: [250, 120, 250, 120, 250] } : {}),
      ...(data.tag ? { tag: data.tag } : {}),
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
