-- Remindly database schema (Supabase / Postgres)
-- Run this once in your Supabase project's SQL editor.

-- ---------- Profiles ----------
-- One row per authenticated user. Holds hydration goal + reminder
-- settings. Auth itself is handled by Supabase's built-in auth.users
-- table — we never store passwords ourselves.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  daily_goal_ml integer not null default 2000,
  interval_minutes integer not null default 60,
  start_time time not null default '08:00',
  end_time time not null default '22:00',
  reminders_enabled boolean not null default true,
  next_reminder_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);


-- ---------- Hydration logs ----------
-- One row per water-intake entry (the +100/+250/+500 ml buttons).

create table if not exists public.hydration_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_ml integer not null check (amount_ml > 0),
  logged_at timestamptz not null default now()
);

create index if not exists hydration_logs_user_day_idx
  on public.hydration_logs (user_id, logged_at);

alter table public.hydration_logs enable row level security;

create policy "Users can view their own logs"
  on public.hydration_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own logs"
  on public.hydration_logs for insert
  with check (auth.uid() = user_id);


-- ---------- Push subscriptions ----------
-- One row per browser/device that has subscribed to push notifications.

create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "Users can view their own subscriptions"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can insert their own subscriptions"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own subscriptions"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);


-- ---------- Auto-create a profile on signup ----------

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, next_reminder_at)
  values (new.id, now());
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ---------- Scheduling background reminders ----------
-- The send-reminders Edge Function (supabase/functions/send-reminders)
-- does the actual sending. This just tells Postgres to call it every
-- 5 minutes.
--
-- One-time setup, in the Supabase SQL editor:
--   1. Dashboard → Database → Extensions → enable "pg_cron" and "pg_net"
--   2. Deploy the Edge Function (see supabase/functions/send-reminders/README)
--   3. Run the statement below, replacing the two placeholders:

-- select cron.schedule(
--   'send-hydration-reminders',
--   '*/5 * * * *',
--   $$
--   select net.http_post(
--     url := 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--       'Content-Type', 'application/json'
--     )
--   );
--   $$
-- );

-- To stop/replace the schedule later:
-- select cron.unschedule('send-hydration-reminders');
