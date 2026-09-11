-- EDOS Poultry360 Phase 7 follow-up: hard-enforce subscription status and
-- plan limits, closing the gap the Phase 7 README section explicitly
-- called out ("no hard RLS or trigger block ... deliberately left for a
-- pass that can be live-verified end to end").
--
-- Two independent mechanisms, chosen deliberately for the operation they
-- fit:
--
-- 1. SUSPENSION gate (blocks ALL writes: insert/update/delete) — added as
--    an extra AND condition to existing write policies' using/with_check.
--    This is uniform across operations (a suspended tenant can't write
--    anything, full stop), so one shared predicate in the existing "for
--    all" policies is the right shape — no new policies, just an extra AND.
--
-- 2. PLAN LIMIT gate (blocks only NEW rows once a resource count is at its
--    plan's limit) — implemented as BEFORE INSERT triggers, not RLS. RLS's
--    WITH CHECK can't cleanly distinguish "creating a new row" (where the
--    limit should apply) from "editing an existing one" (where it must
--    NOT — a plan downgrade should never retroactively block editing rows
--    that already exceed the new, lower limit). A trigger also raises a
--    specific, readable error message, which every manager component in
--    this app already surfaces via `error.message` — no new UI needed.
--
-- Deliberately EXCLUDED from both gates: poultryedos_tenants,
-- poultryedos_tenant_memberships' broader write policy, poultryedos_subscriptions,
-- poultryedos_mpesa_transactions, poultryedos_farmer_invites,
-- poultryedos_notifications*, poultryedos_sms_logs, poultryedos_announcements,
-- poultryedos_knowledge_base, poultryedos_field_* — a suspended tenant must
-- always be able to reach its own billing page and pay to reactivate (the
-- chicken-and-egg lockout this list avoids), and field-officer/network
-- workflows and CMS content were kept out of scope to limit blast radius
-- on a first pass, matching this migration's own "verify everything you
-- touch" standard rather than touching all ~30 tenant-scoped tables at once.

-- 1. Subscription-active check --------------------------------------------

create or replace function public.poultryedos_is_subscription_active(p_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (
      select case
        when s.status = 'cancelled' then false
        when s.status = 'trial' then s.trial_ends_at is null or s.trial_ends_at >= now()
        when s.status = 'active' then
          -- Mirrors PAST_DUE_DAYS (3) + GRACE_PERIOD_DAYS (7) in
          -- src/lib/data/subscriptions.ts's deriveSubscriptionStatus() —
          -- keep both in sync if either changes. Past this window the
          -- effective status is "suspended".
          s.current_period_end is null or s.current_period_end >= now() - interval '10 days'
        else false
      end
      from poultryedos_subscriptions s
      where s.tenant_id = p_tenant_id
    ),
    -- No subscription row at all: fail open. A tenant should never be
    -- locked out of its own data because of a missing accounting row this
    -- schema itself is responsible for creating.
    true
  );
$$;

grant execute on function public.poultryedos_is_subscription_active(uuid) to authenticated;
revoke execute on function public.poultryedos_is_subscription_active(uuid) from public, anon;

-- 2. Plan limit triggers ----------------------------------------------------

create or replace function public.poultryedos_check_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resource text := TG_ARGV[0];
  v_limit int;
  v_count int;
begin
  select (p.limits ->> v_resource)::int into v_limit
  from poultryedos_subscriptions s
  join poultryedos_subscription_plans p on p.id = s.plan_id
  where s.tenant_id = new.tenant_id;

  if v_limit is null then
    return new; -- unlimited for this plan, or no subscription row yet
  end if;

  execute format('select count(*) from public.%I where tenant_id = $1', TG_TABLE_NAME)
    into v_count
    using new.tenant_id;

  if v_count >= v_limit then
    raise exception 'plan_limit_exceeded: your plan allows up to % %. Upgrade your plan to add more.', v_limit, v_resource
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.poultryedos_check_plan_limit() from public, anon, authenticated;

create or replace function public.poultryedos_check_membership_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_users_limit int;
  v_fo_limit int;
  v_count int;
begin
  select p.limits into v_limits
  from poultryedos_subscriptions s
  join poultryedos_subscription_plans p on p.id = s.plan_id
  where s.tenant_id = new.tenant_id;

  if v_limits is null then
    return new;
  end if;

  v_users_limit := (v_limits ->> 'users')::int;
  if v_users_limit is not null then
    select count(*) into v_count from poultryedos_tenant_memberships
      where tenant_id = new.tenant_id and status = 'active';
    if v_count >= v_users_limit then
      raise exception 'plan_limit_exceeded: your plan allows up to % team member(s). Upgrade your plan to add more.', v_users_limit
        using errcode = 'P0001';
    end if;
  end if;

  if new.role = 'field_officer' then
    v_fo_limit := (v_limits ->> 'field_officers')::int;
    if v_fo_limit is not null then
      select count(*) into v_count from poultryedos_tenant_memberships
        where tenant_id = new.tenant_id and status = 'active' and role = 'field_officer';
      if v_count >= v_fo_limit then
        raise exception 'plan_limit_exceeded: your plan allows up to % field officer(s). Upgrade your plan to add more.', v_fo_limit
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.poultryedos_check_membership_limits() from public, anon, authenticated;

create trigger poultryedos_farmers_check_limit
  before insert on public.poultryedos_farmers
  for each row execute function public.poultryedos_check_plan_limit('farmers');

create trigger poultryedos_farms_check_limit
  before insert on public.poultryedos_farms
  for each row execute function public.poultryedos_check_plan_limit('farms');

create trigger poultryedos_houses_check_limit
  before insert on public.poultryedos_houses
  for each row execute function public.poultryedos_check_plan_limit('houses');

create trigger poultryedos_flocks_check_limit
  before insert on public.poultryedos_flocks
  for each row execute function public.poultryedos_check_plan_limit('flocks');

create trigger poultryedos_memberships_check_limit
  before insert on public.poultryedos_tenant_memberships
  for each row execute function public.poultryedos_check_membership_limits();

-- 3. Add the suspension gate to existing write policies ---------------------
-- Same predicate array as each policy already had, plus
-- "and poultryedos_is_subscription_active(tenant_id)". Reproduced exactly
-- from the live pg_policies definitions, not retyped from the original
-- migration files, to guarantee no drift.

drop policy poultryedos_farmers_write on public.poultryedos_farmers;
create policy poultryedos_farmers_write
  on public.poultryedos_farmers for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_farms_write on public.poultryedos_farms;
create policy poultryedos_farms_write
  on public.poultryedos_farms for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_houses_write on public.poultryedos_houses;
create policy poultryedos_houses_write
  on public.poultryedos_houses for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_flocks_write on public.poultryedos_flocks;
create policy poultryedos_flocks_write
  on public.poultryedos_flocks for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_daily_records_write on public.poultryedos_daily_records;
create policy poultryedos_daily_records_write
  on public.poultryedos_daily_records for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_health_events_write on public.poultryedos_health_events;
create policy poultryedos_health_events_write
  on public.poultryedos_health_events for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer','veterinary_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer','veterinary_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_vaccination_write on public.poultryedos_vaccination_schedules;
create policy poultryedos_vaccination_write
  on public.poultryedos_vaccination_schedules for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer','veterinary_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer','veterinary_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_medication_records_write on public.poultryedos_medication_records;
create policy poultryedos_medication_records_write
  on public.poultryedos_medication_records for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer','veterinary_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer','veterinary_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_biosecurity_write on public.poultryedos_biosecurity_checks;
create policy poultryedos_biosecurity_write
  on public.poultryedos_biosecurity_checks for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_expenses_write on public.poultryedos_expenses;
create policy poultryedos_expenses_write
  on public.poultryedos_expenses for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_customers_write on public.poultryedos_customers;
create policy poultryedos_customers_write
  on public.poultryedos_customers for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_sales_write on public.poultryedos_sales;
create policy poultryedos_sales_write
  on public.poultryedos_sales for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_inventory_items_write on public.poultryedos_inventory_items;
create policy poultryedos_inventory_items_write
  on public.poultryedos_inventory_items for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_inventory_transactions_write on public.poultryedos_inventory_transactions;
create policy poultryedos_inventory_transactions_write
  on public.poultryedos_inventory_transactions for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_suppliers_write on public.poultryedos_suppliers;
create policy poultryedos_suppliers_write
  on public.poultryedos_suppliers for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_purchase_orders_write on public.poultryedos_purchase_orders;
create policy poultryedos_purchase_orders_write
  on public.poultryedos_purchase_orders for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

drop policy poultryedos_support_tickets_write on public.poultryedos_support_tickets;
create policy poultryedos_support_tickets_write
  on public.poultryedos_support_tickets for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

-- 4. Loosen the starter plan's limits slightly ------------------------------
-- The originally-seeded starter limits (farmers=1, farms=1, houses=3,
-- flocks=3) were tight enough to immediately block a real smallholder
-- running two farms or more than 3 concurrent batches -- both completely
-- normal (a smallholder commonly runs several concurrent flocks; see the
-- flock switcher feature). farmers stays at 1 (that's the actual
-- definition of the starter/individual tier); everything else gets more
-- realistic headroom before hard enforcement goes live.
update poultryedos_subscription_plans
set limits = '{"farmers": 1, "farms": 2, "houses": 5, "flocks": 5, "users": 2, "field_officers": 0}'::jsonb
where code = 'starter';
