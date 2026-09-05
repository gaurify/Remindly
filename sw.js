// Remindly service worker.
// Registered from js/dashboard.js. Handles two things:
//   1. Showing a system notification when a push arrives (this is
//      what fires even when the Remindly tab isn't open).
//   2. Focusing/opening the dashboard when that notification is clicked.
//
// This file does NOT schedule reminders itself — scheduling and
// sending is done server-side, see supabase/functions/send-reminders.

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

// A no-op fetch handler is required for reliable "Add to Home Screen"
// install prompts on Chrome/Android. It intentionally does not call
// respondWith(), so every request just falls through to the network.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
    let payload = { title: "Remindly", body: "Time to hydrate.", url: "/dashboard.html" };

    if (event.data) {
        try {
            payload = { ...payload, ...event.data.json() };
        } catch (err) {
            payload.body = event.data.text();
        }
    }

    const options = {
        body: payload.body,
        icon: "/assets/logo.svg",
        badge: "/assets/logo.svg",
        tag: "remindly-hydration",
        renotify: true,
        data: { url: payload.url },
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || "/dashboard.html";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
            const existing = clientsArr.find((c) => c.url.includes("dashboard.html"));
            if (existing) return existing.focus();
            return self.clients.openWindow(targetUrl);
        })
    );
});
