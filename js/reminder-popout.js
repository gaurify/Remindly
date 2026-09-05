// Original "web-dot" pop-out — an on-page reminder that only appears
// while the Remindly tab is actively open. When the tab is closed,
// the real push notification (sw.js) is what reaches the user.

const MESSAGES = [
    "Sip check! Time to hydrate.",
    "Your body's asking for water — answer it.",
    "Small sip, big difference. Grab some water.",
    "Hydration break. You've earned it.",
    "Cue the entrance: it's water o'clock.",
];

export function randomReminderMessage() {
    return MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
}

export function showReminderPopout(message = randomReminderMessage()) {
    const existing = document.querySelector(".reminder-popout");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.className = "reminder-popout";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `
        <div class="thread"></div>
        <div class="bubble">
            <span class="dot" aria-hidden="true"></span>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(el);

    const remove = () => {
        el.classList.add("leaving");
        el.addEventListener("animationend", () => el.remove(), { once: true });
    };

    const timer = setTimeout(remove, 6000);
    el.addEventListener("click", () => {
        clearTimeout(timer);
        remove();
    });
}
