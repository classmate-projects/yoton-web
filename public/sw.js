// Minimal service worker: no offline caching (Next.js pages/data are dynamic and
// per-role, so blanket caching here would risk serving stale/wrong-role content).
// Its only job is to (a) exist and be registered, which is what makes the app
// installable as a PWA, and (b) show real OS-level notifications for the app's
// existing SignalR-driven alerts (see lib/notifications.ts) so a backgrounded tab
// still surfaces them the way a push notification would.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const navLink = event.notification.data?.navLink || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(navLink);
        return;
      }
      await self.clients.openWindow(navLink);
    })()
  );
});
