// Registers the service worker as soon as any page loads. This is
// separate from push notifications (js/dashboard.js handles the
// actual push subscription) — registering early is what makes the
// site properly installable as an app, whether or not the visitor
// has granted notification permission yet.

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((err) => {
            console.error("Service worker registration failed:", err);
        });
    });
}
