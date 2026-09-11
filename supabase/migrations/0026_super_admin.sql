-- EDOS Poultry360: cross-tenant super admin (spec §5/67), deliberately
-- deferred until now — every other RLS policy in this schema is scoped to
-- "members of one tenant." This adds exactly one narrow, audited bypass
-- rather than loosening the base RLS of every tenant-scoped table.
--
-- DESIGN NOTE: the obvious-looking approach — add a
-- poultryedos_is_super_admin() OR clause to the read policies of
-- poultryedos_tenants/subscriptions/farmers/farms/flocks — was rejected.
-- That would permanently loosen five tables' base security posture to
-- support one narrow, rarely-used admin screen, and spread the
-- "can-see-across-tenants" logic across five separate policies instead of
-- one auditable place. Instead this follows the same pattern already used
-- for poultryedos_list_tenant_members (migration 0015): a SECURITY
-- DEFINER RPC that checks authorization itself and reads across tenants
-- internally, without any base table's RLS ever granting that access
-- directly.
--
-- Suspend/reactivate deliberately reuses the subscription-based write
-- block already built and live-verified in migration 0022
-- (poultryedos_is_subscription_active()) rather than inventing a second,
-- independent enforcement mechanism.

create table if not exists public.poultryedos_super_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.poultryedos_super_admins enable row level security;

-- No write policy at all, anywhere — this table can only ever be changed
-- by direct SQL (the same way its one seed row is inserted below), so a
-- compromised session can never grant itself super admin access.
create policy poultryedos_super_admins_read_own
  on public.poultryedos_super_admins for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.poultryedos_is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from poultryedos_super_admins where user_id = auth.uid()
  );
$$;

grant execute on function public.poultryedos_is_super_admin() to authenticated;
revoke execute on function public.poultryedos_is_super_admin() from public, anon;

create or replace function public.poultryedos_super_admin_list_tenants()
returns table (
  tenant_id uuid,
  name text,
  slug text,
  status text,
  plan text,
  created_at timestamptz,
  subscription_status text,
  plan_name text,
  farmer_count bigint,
  farm_count bigint,
  flock_count bigint
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not poultryedos_is_super_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  return query
  select
    t.id,
    t.name,
    t.slug,
    t.status,
    t.plan,
    t.created_at,
    s.status,
    p.name,
    (select count(*) from poultryedos_farmers f where f.tenant_id = t.id),
    (select count(*) from poultryedos_farms fa where fa.tenant_id = t.id),
    (select count(*) from poultryedos_flocks fl where fl.tenant_id = t.id)
  from poultryedos_tenants t
  left join poultryedos_subscriptions s on s.tenant_id = t.id
  left join poultryedos_subscription_plans p on p.id = s.plan_id
  order by t.created_at desc;
end;
$$;

grant execute on function public.poultryedos_super_admin_list_tenants() to authenticated;
revoke execute on function public.poultryedos_super_admin_list_tenants() from public, anon;

create or replace function public.poultryedos_super_admin_set_tenant_status(
  p_tenant_id uuid,
  p_suspend boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not poultryedos_is_super_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update poultryedos_tenants
    set status = case when p_suspend then 'suspended' else 'active' end
    where id = p_tenant_id;

  update poultryedos_subscriptions
    set status = case when p_suspend then 'cancelled' else 'active' end,
        current_period_start = case when p_suspend then current_period_start else now() end,
        current_period_end = case when p_suspend then current_period_end else now() + interval '30 days' end
    where tenant_id = p_tenant_id;
end;
$$;

grant execute on function public.poultryedos_super_admin_set_tenant_status(uuid, boolean) to authenticated;
revoke execute on function public.poultryedos_super_admin_set_tenant_status(uuid, boolean) from public, anon;

-- Seed the platform's sole owner as the one super admin.
insert into poultryedos_super_admins (user_id)
select id from auth.users where email = 'walter.imamai@edoscentre.co.ke'
on conflict (user_id) do nothing;
