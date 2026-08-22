/* PocketNinja Service Worker — push notifications (PROJECT_PLAN.md §10.1).
 *
 * The server's cron job sends a JSON payload via web-push; this file turns it
 * into an OS notification and routes a click back into the app. It runs even
 * when no tab is open, which is the whole point of push over an in-app bell.
 */

const DEFAULT_TITLE = "PocketNinja";
const FALLBACK_URL = "/planning";

self.addEventListener("install", () => {
  // Take over immediately instead of waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      // A plain-text push is still worth showing.
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || DEFAULT_TITLE;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      // One tag per kind, so a second reminder replaces the first rather than
      // stacking a pile of notifications the user has to dismiss one by one.
      tag: payload.tag || "pocketninja-reminder",
      renotify: true,
      data: { url: payload.url || FALLBACK_URL },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || FALLBACK_URL;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Focus an already-open tab rather than opening a duplicate.
        for (const client of windowClients) {
          if ("focus" in client) {
            if ("navigate" in client) client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
