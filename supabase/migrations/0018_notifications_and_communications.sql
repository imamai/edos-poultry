-- EDOS Poultry360 Phase 7: in-app notifications, per-user preferences, and
-- an SMS delivery log (spec §47/48).
--
-- DESIGN NOTE: there is no cron/background worker in this app (see README).
-- Notifications are generated lazily — ensureDueNotifications() in
-- src/lib/data/notifications.ts runs once per app-layout render for the
-- signed-in user and upserts whatever is currently due (vaccination soon,
-- low stock, subscription ending, ...). Because every notification is
-- created by the user it's *for*, RLS can stay simple: every policy here
-- is keyed on user_id = auth.uid(), never a cross-user insert. dedupe_key
-- plus the unique constraint below is what makes repeated runs idempotent
-- instead of spamming duplicate rows every page load. A plain (non-partial)
-- unique constraint is used deliberately: Postgres treats every NULL as
-- distinct, so one-off notifications with dedupe_key = null are correctly
-- never deduplicated against each other, while a real upsert via
-- ON CONFLICT (user_id, dedupe_key) still needs a non-partial constraint
-- as its arbiter (a partial index's WHERE clause would have to be repeated
-- verbatim in every ON CONFLICT call site, which supabase-js's
-- .upsert({ onConflict }) has no way to express).

create table if not exists public.poultryedos_notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in (
    'vaccination_due', 'low_stock', 'mortality_alert', 'subscription',
    'support_ticket', 'task_assigned', 'general'
  )),
  title text not null,
  body text not null,
  link text,
  -- Natural key for idempotent re-generation, e.g.
  -- 'vaccination_due:<schedule_id>' or 'low_stock:<item_id>:<date>'. Null
  -- is allowed for one-off notifications that are never re-derived (e.g. a
  -- task assignment), which never need de-duplication.
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists poultryedos_notifications_user_idx
  on public.poultryedos_notifications (user_id, created_at desc);

create table if not exists public.poultryedos_notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vaccination_due boolean not null default true,
  low_stock boolean not null default true,
  mortality_alert boolean not null default true,
  subscription boolean not null default true,
  support_ticket boolean not null default true,
  task_assigned boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger poultryedos_notification_preferences_set_updated_at
  before update on public.poultryedos_notification_preferences
  for each row execute function public.poultryedos_set_updated_at();

-- SMS delivery log (spec §48) — src/lib/sms/provider.ts writes here
-- regardless of which underlying provider is configured, so delivery
-- history/logs/failures/retries all live in one place no matter the
-- provider swapped in later.
create table if not exists public.poultryedos_sms_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  to_phone text not null,
  message text not null,
  provider text not null default 'console',
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'delivered', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_sms_logs_tenant_idx
  on public.poultryedos_sms_logs (tenant_id, created_at desc);

alter table public.poultryedos_notifications enable row level security;
alter table public.poultryedos_notification_preferences enable row level security;
alter table public.poultryedos_sms_logs enable row level security;

create policy poultryedos_notifications_owner
  on public.poultryedos_notifications for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy poultryedos_notification_preferences_owner
  on public.poultryedos_notification_preferences for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy poultryedos_sms_logs_read
  on public.poultryedos_sms_logs for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_sms_logs_write
  on public.poultryedos_sms_logs for insert
  to authenticated
  with check (public.poultryedos_is_tenant_member(tenant_id, null));
