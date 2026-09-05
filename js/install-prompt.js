// Wires up "Install app" buttons to the browser's real install flow.
//
// Chrome/Edge/Android fire `beforeinstallprompt` when install criteria
// are met (manifest + service worker + icons — see manifest.json and
// sw.js). Safari on iOS never fires this event; there, we show a
// short instruction for the manual "Add to Home Screen" steps instead.

let deferredPrompt = null;

const installButtons = document.querySelectorAll("[data-install-button]");
const iosHints = document.querySelectorAll("[data-ios-install-hint]");

window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installButtons.forEach((btn) => btn.classList.remove("hidden-init"));
});

installButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        installButtons.forEach((b) => b.classList.add("hidden-init"));
    });
});

window.addEventListener("appinstalled", () => {
    installButtons.forEach((btn) => btn.classList.add("hidden-init"));
});

const ua = window.navigator.userAgent.toLowerCase();
const isIos = /iphone|ipad|ipod/.test(ua);
const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

if (isIos && !isStandalone) {
    iosHints.forEach((el) => el.classList.remove("hidden-init"));
}
