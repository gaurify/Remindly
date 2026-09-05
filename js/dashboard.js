import { supabase } from "./supabaseClient.js";
import { VAPID_PUBLIC_KEY } from "./config.js";
import { showReminderPopout, randomReminderMessage } from "./reminder-popout.js";

let user = null;
let profile = null;

const els = {
    goalMl: document.getElementById("goal-ml"),
    totalMl: document.getElementById("total-ml"),
    remainingMl: document.getElementById("remaining-ml"),
    percentLabel: document.getElementById("percent-label"),
    ring: document.getElementById("progress-ring-fill"),
    quickAddBtns: document.querySelectorAll("[data-add-ml]"),
    settingsForm: document.getElementById("settings-form"),
    goalInput: document.getElementById("input-goal"),
    intervalInput: document.getElementById("input-interval"),
    intervalCustomInput: document.getElementById("input-interval-custom"),
    startInput: document.getElementById("input-start"),
    endInput: document.getElementById("input-end"),
    enabledInput: document.getElementById("input-enabled"),
    nextReminderLabel: document.getElementById("next-reminder-label"),
    notifStatus: document.getElementById("notif-status"),
    notifEnableBtn: document.getElementById("notif-enable-btn"),
    notifExplainer: document.getElementById("notif-explainer"),
    logoutBtn: document.getElementById("logout-btn"),
    userEmail: document.getElementById("user-email"),
    toast: document.getElementById("toast"),
};

const RING_CIRCUMFERENCE = 2 * Math.PI * 54; // matches r="54" in dashboard.html

init();

async function init() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
        window.location.href = "auth.html";
        return;
    }
    user = data.session.user;
    els.userEmail.textContent = user.email;

    await loadProfile();
    await refreshTotals();
    renderSettingsForm();
    renderNotificationStatus();
    bindEvents();
    startReminderLoop();
}

async function loadProfile() {
    const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        // Fallback: profile row should be created automatically on
        // signup (see supabase/schema.sql trigger). If it's missing,
        // create a sensible default rather than leaving the user stuck.
        const defaults = {
            id: user.id,
            daily_goal_ml: 2000,
            interval_minutes: 60,
            start_time: "08:00",
            end_time: "22:00",
            reminders_enabled: true,
            next_reminder_at: new Date().toISOString(),
        };
        await supabase.from("profiles").upsert(defaults);
        profile = defaults;
        return;
    }
    profile = data;
}

async function refreshTotals() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
        .from("hydration_logs")
        .select("amount_ml")
        .eq("user_id", user.id)
        .gte("logged_at", startOfDay.toISOString());

    const total = error ? 0 : data.reduce((sum, row) => sum + row.amount_ml, 0);
    renderProgress(total);
}

function renderProgress(total) {
    const goal = profile.daily_goal_ml;
    const percent = Math.min(100, Math.round((total / goal) * 100));
    const remaining = Math.max(0, goal - total);

    els.goalMl.textContent = goal.toLocaleString();
    els.totalMl.textContent = total.toLocaleString();
    els.remainingMl.textContent = remaining.toLocaleString();
    els.percentLabel.textContent = `${percent}%`;

    const offset = RING_CIRCUMFERENCE * (1 - percent / 100);
    els.ring.style.strokeDasharray = String(RING_CIRCUMFERENCE);
    els.ring.style.strokeDashoffset = String(offset);
}

function renderSettingsForm() {
    els.goalInput.value = profile.daily_goal_ml;

    const knownIntervals = ["30", "60", "120"];
    const intervalStr = String(profile.interval_minutes);
    if (knownIntervals.includes(intervalStr)) {
        els.intervalInput.value = intervalStr;
        els.intervalCustomInput.classList.add("hidden-init");
    } else {
        els.intervalInput.value = "custom";
        els.intervalCustomInput.value = profile.interval_minutes;
        els.intervalCustomInput.classList.remove("hidden-init");
    }

    els.startInput.value = profile.start_time?.slice(0, 5) ?? "08:00";
    els.endInput.value = profile.end_time?.slice(0, 5) ?? "22:00";
    els.enabledInput.checked = profile.reminders_enabled;
    renderNextReminder();
}

function renderNextReminder() {
    if (!profile.reminders_enabled) {
        els.nextReminderLabel.textContent = "Reminders are off";
        return;
    }
    if (!profile.next_reminder_at) {
        els.nextReminderLabel.textContent = "—";
        return;
    }
    const next = new Date(profile.next_reminder_at);
    els.nextReminderLabel.textContent = next.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function bindEvents() {
    els.quickAddBtns.forEach((btn) => {
        btn.addEventListener("click", () => quickAdd(Number(btn.dataset.addMl)));
    });

    els.settingsForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await saveSettings();
    });

    els.intervalInput.addEventListener("change", () => {
        els.intervalCustomInput.classList.toggle("hidden-init", els.intervalInput.value !== "custom");
    });

    els.notifEnableBtn.addEventListener("click", enableNotifications);

    els.logoutBtn.addEventListener("click", async () => {
        await supabase.auth.signOut();
        window.location.href = "auth.html";
    });
}

async function quickAdd(amountMl) {
    const { error } = await supabase
        .from("hydration_logs")
        .insert({ user_id: user.id, amount_ml: amountMl });

    if (error) {
        showToast("Couldn't save that — try again.");
        return;
    }
    await refreshTotals();
    showToast(`+${amountMl} ml logged`);
}

async function saveSettings() {
    const nextInterval =
        els.intervalInput.value === "custom"
            ? Number(els.intervalCustomInput.value)
            : Number(els.intervalInput.value);

    if (!nextInterval || nextInterval < 5) {
        showToast("Enter a valid interval (5 minutes or more)");
        return;
    }

    const updates = {
        daily_goal_ml: Number(els.goalInput.value),
        interval_minutes: nextInterval,
        start_time: els.startInput.value,
        end_time: els.endInput.value,
        reminders_enabled: els.enabledInput.checked,
        next_reminder_at: new Date(Date.now() + nextInterval * 60_000).toISOString(),
    };

    const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);

    if (error) {
        showToast("Couldn't save settings — try again.");
        return;
    }

    profile = { ...profile, ...updates };
    renderNextReminder();
    showToast("Settings saved");
}

// ---------- Reminders (while this tab is open) ----------
// Server-side scheduling (supabase/functions/send-reminders) is what
// delivers a push notification when the tab is closed. While the tab
// IS open and visible, we show the animated pop-out instead, then
// push next_reminder_at forward — which also tells the server this
// interval is already handled, so the user doesn't get double-pinged.

function startReminderLoop() {
    setInterval(checkReminder, 15_000);
}

async function checkReminder() {
    if (!profile.reminders_enabled || !profile.next_reminder_at) return;
    if (document.visibilityState !== "visible") return;

    const now = new Date();
    const due = new Date(profile.next_reminder_at) <= now;
    if (!due) return;

    const nowTime = now.toTimeString().slice(0, 5);
    if (nowTime < profile.start_time || nowTime > profile.end_time) return;

    showReminderPopout(randomReminderMessage());

    const next = new Date(now.getTime() + profile.interval_minutes * 60_000).toISOString();
    profile.next_reminder_at = next;
    renderNextReminder();
    await supabase.from("profiles").update({ next_reminder_at: next }).eq("id", user.id);
}

// ---------- Push notifications ----------

function renderNotificationStatus() {
    if (!("Notification" in window)) {
        els.notifStatus.textContent = "Not supported in this browser";
        els.notifEnableBtn.classList.add("hidden");
        return;
    }

    if (Notification.permission === "granted") {
        els.notifStatus.textContent = "✓ Enabled";
        els.notifStatus.classList.add("text-green-400");
        els.notifEnableBtn.classList.add("hidden");
        els.notifExplainer.classList.add("hidden");
        ensurePushSubscription();
    } else if (Notification.permission === "denied") {
        els.notifStatus.textContent = "✕ Disabled";
        els.notifStatus.classList.add("text-red-400");
        els.notifEnableBtn.classList.add("hidden");
        els.notifExplainer.textContent =
            "Notifications are blocked for this site. Enable them from your browser's site settings to get hydration reminders while you're away.";
    } else {
        els.notifStatus.textContent = "✕ Not enabled yet";
        els.notifExplainer.textContent =
            "Allow notifications so Remindly can remind you to hydrate even when you're not viewing the website.";
    }
}

async function enableNotifications() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    renderNotificationStatus();
    if (permission === "granted") {
        await ensurePushSubscription();
    }
}

async function ensurePushSubscription() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (VAPID_PUBLIC_KEY.startsWith("YOUR_")) return; // not configured yet

    try {
        // sw.js is already registered on page load (js/register-sw.js) —
        // just wait for it to be ready.
        const registration = await navigator.serviceWorker.ready;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
        }

        const json = subscription.toJSON();
        await supabase.from("push_subscriptions").upsert(
            {
                user_id: user.id,
                endpoint: json.endpoint,
                p256dh: json.keys.p256dh,
                auth: json.keys.auth,
            },
            { onConflict: "endpoint" }
        );
    } catch (err) {
        console.error("Push subscription failed:", err);
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

// ---------- Toast ----------

let toastTimer;
function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2500);
}
