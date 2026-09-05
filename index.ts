// Supabase Edge Function: send-reminders
//
// Runs on a schedule (see supabase/schema.sql's pg_cron job — every 5
// minutes by default) and sends a push notification to every user
// whose next_reminder_at has passed and who is inside their
// configured reminder window (start_time–end_time).
//
// This is the piece that makes reminders work even when a user's
// browser tab is closed — the dashboard only handles reminders while
// the tab is open (see js/dashboard.js).
//
// Deploy with the Supabase CLI:
//   supabase functions deploy send-reminders
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   SUPABASE_URL               your project URL
//   SUPABASE_SERVICE_ROLE_KEY  service role key — server-only, NEVER expose client-side
//   VAPID_PUBLIC_KEY           from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY          same command — keep this one secret
//   VAPID_SUBJECT               e.g. "mailto:you@example.com"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT")!,
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!
);

const MESSAGES = [
    "Sip check! Time to hydrate.",
    "Your body's asking for water — answer it.",
    "Small sip, big difference. Grab some water.",
    "Hydration break. You've earned it.",
];

Deno.serve(async () => {
    const now = new Date();
    const nowTime = now.toISOString().slice(11, 16); // "HH:MM"

    const { data: dueProfiles, error } = await supabaseAdmin
        .from("profiles")
        .select("id, interval_minutes, start_time, end_time, next_reminder_at")
        .eq("reminders_enabled", true)
        .lte("next_reminder_at", now.toISOString());

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    let sent = 0;

    for (const profile of dueProfiles ?? []) {
        // Outside the user's configured window — push next_reminder_at
        // to the start of their next window instead of sending now.
        if (nowTime < profile.start_time || nowTime > profile.end_time) {
            await supabaseAdmin
                .from("profiles")
                .update({ next_reminder_at: nextWindowStart(now, profile.start_time) })
                .eq("id", profile.id);
            continue;
        }

        const { data: subs } = await supabaseAdmin
            .from("push_subscriptions")
            .select("*")
            .eq("user_id", profile.id);

        const message = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

        for (const sub of subs ?? []) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify({ title: "Remindly", body: message, url: "/dashboard.html" })
                );
                sent++;
            } catch (err) {
                // Subscription is expired/revoked — clean it up.
                if (err?.statusCode === 404 || err?.statusCode === 410) {
                    await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
                }
            }
        }

        const next = new Date(now.getTime() + profile.interval_minutes * 60_000);
        await supabaseAdmin
            .from("profiles")
            .update({ next_reminder_at: next.toISOString() })
            .eq("id", profile.id);
    }

    return new Response(JSON.stringify({ sent }), {
        headers: { "Content-Type": "application/json" },
    });
});

function nextWindowStart(now: Date, startTime: string): string {
    const [h, m] = startTime.split(":").map(Number);
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
}
