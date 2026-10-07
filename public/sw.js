// Service worker for TASKS' push notifications (PWA) — intentionally does
// NOT cache or intercept any fetch() calls. This is a task-management app
// where every page must always show live, current data; a caching service
// worker risks serving a stale dashboard/task list while offline or
// between deploys, which would be actively misleading here. Its only job
// is receiving push events (see lib/push.ts for what sends them) and
// handling clicks on the resulting OS notification.

self.addEventListener("install", () => {
  // Activate this version immediately instead of waiting for every open
  // tab to close first — there's no cached content to risk mixing
  // versions of, so there's nothing to lose by switching right away.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  const { title, body, url, tag } = payload || {};
  if (!title) return;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      // Same push arriving twice for the same task (e.g. two threshold
      // notifications in quick succession) replaces the previous one
      // instead of stacking, since they share a tag — see
      // pushPayloadForTask() in lib/push.ts.
      renotify: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: url || "/dashboard" },
    })
  );
});

// Focuses an already-open TASKS tab and navigates it to the notification's
// task, rather than always opening a new one — most people keep the app
// open in a tab or as an installed PWA window.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
