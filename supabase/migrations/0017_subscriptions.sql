-- EDOS Poultry360 Phase 7: SaaS subscription plans and per-tenant
-- subscription lifecycle (spec §45/46).
--
-- SCOPE NOTE: there is no cross-tenant super-admin role yet (see README
-- "Deliberately deferred"), so plan management is seed-only for now — no
-- write policy exists on poultryedos_subscription_plans because nothing in
-- the app writes to it. The four plans below are inserted by
-- supabase/seed.sql, the same place poultry types and expense categories
-- are seeded.
--
-- SCOPE NOTE on enforcement: this migration tracks subscription state
-- accurately, but does NOT hard-enforce plan limits or suspension at the
-- RLS/trigger level — that would touch the write policy of every
-- farmer/farm/flock/etc. table and risk breaking existing flows in a pass
-- that can't be live-verified this session. Enforcement here is
-- deliberately UI-level only (usage bars, upgrade prompts); see README.

create table if not exists public.poultryedos_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_cents bigint not null default 0 check (price_cents >= 0),
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'annual')),
  -- Configurable limits (spec §45): null means "unlimited" for that
  -- resource. Kept as jsonb rather than one column per resource so new
  -- limit types (storage, AI usage, SMS, ...) don't need a migration.
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.poultryedos_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  plan_id uuid not null references public.poultryedos_subscription_plans (id),
  -- The stored status is the tenant's *base* intent (trial/active/cancelled).
  -- Time-sensitive states (grace_period/past_due/expired) are derived at
  -- read time from the dates below by deriveSubscriptionStatus() in
  -- src/lib/data/subscriptions.ts, the same "compute, don't pre-store"
  -- approach as biosecurityScore() — there is no cron job to flip this
  -- column on a timer.
  status text not null default 'trial' check (status in ('trial', 'active', 'cancelled')),
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create index if not exists poultryedos_subscriptions_plan_idx
  on public.poultryedos_subscriptions (plan_id);

create trigger poultryedos_subscriptions_set_updated_at
  before update on public.poultryedos_subscriptions
  for each row execute function public.poultryedos_set_updated_at();

-- Every tenant gets a 14-day trial on the starter plan automatically —
-- mirrors the farmer-invite 14-day expiry pattern in migration 0013, and
-- means poultryedos_create_tenant() never needed to change.
create or replace function public.poultryedos_create_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_starter_plan_id uuid;
begin
  select id into v_starter_plan_id
  from poultryedos_subscription_plans
  where code = 'starter'
  limit 1;

  if v_starter_plan_id is null then
    -- Seed hasn't run yet in this environment — don't block tenant
    -- creation over it; billing pages handle a tenant with no
    -- subscription row by treating it as "not started."
    return new;
  end if;

  insert into poultryedos_subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end)
  values (new.id, v_starter_plan_id, 'trial', now() + interval '14 days', now() + interval '14 days')
  on conflict (tenant_id) do nothing;

  return new;
end;
$$;

create trigger poultryedos_tenants_create_subscription
  after insert on public.poultryedos_tenants
  for each row execute function public.poultryedos_create_trial_subscription();

alter table public.poultryedos_subscription_plans enable row level security;
alter table public.poultryedos_subscriptions enable row level security;

-- Plan catalog is readable by anyone signed in (pricing/upgrade UI); no
-- write policy is defined at all — see SCOPE NOTE above.
create policy poultryedos_subscription_plans_read
  on public.poultryedos_subscription_plans for select
  to authenticated
  using (is_active);

create policy poultryedos_subscriptions_read
  on public.poultryedos_subscriptions for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_subscriptions_write
  on public.poultryedos_subscriptions for update
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));
