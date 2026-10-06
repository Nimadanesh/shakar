/* Shekaar Web Push service worker (M5).
 * Shows the kamin «N آگهی تازه» notification; tap deep-links to /saved?tab=fresh.
 * No caching here — the app shell has its own PWA story; this worker only
 * handles push.
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "شکار";
  const options = {
    body: data.body || "",
    tag: data.tag || "shekaar",
    data: { url: data.url || "/saved?tab=fresh" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/saved?tab=fresh";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        for (const w of windows) {
          if (w.url.includes("/saved")) return w.focus();
        }
        return self.clients.openWindow(url);
      })
  );
});
