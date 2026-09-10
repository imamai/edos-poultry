-- EDOS Poultry360: core tenancy, membership, and shared helpers.
-- All objects for this product use the poultryedos_ prefix to stay isolated
-- inside the shared edos_db project (which hosts several unrelated products).
--
-- SCOPE NOTE: the full product spec calls for a generic, data-driven RBAC
-- engine (poultryedos_roles / permissions / role_permissions / user_roles).
-- This first slice (smallholder farmer mode) only ever exercises a handful
-- of distinct roles, so building a generic permission engine now would be
-- premature abstraction with no real behavior behind it. We use a simple
-- role column here (mirrors the appointment-booking-system's pattern) and
-- defer the generic RBAC tables to the Enterprise/Network phase, when there
-- are actually multiple organizations with different permission needs to
-- justify it.

create extension if not exists "pgcrypto";

create table if not exists public.poultryedos_tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('onboarding', 'active', 'suspended', 'cancelled')),
  timezone text not null default 'Africa/Nairobi',
  currency text not null default 'KES',
  locale text not null default 'en',
  contact_email text,
  contact_phone text,
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_tenants_status_idx on public.poultryedos_tenants (status);

create table if not exists public.poultryedos_tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in (
    'owner', 'admin', 'farm_manager', 'field_officer', 'farmer', 'veterinary_officer'
  )),
  status text not null default 'active' check (status in ('invited', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists poultryedos_memberships_user_idx
  on public.poultryedos_tenant_memberships (user_id);
create index if not exists poultryedos_memberships_tenant_idx
  on public.poultryedos_tenant_memberships (tenant_id, status);

create or replace function public.poultryedos_is_tenant_member(
  p_tenant_id uuid,
  p_roles text[] default null
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.poultryedos_tenant_memberships m
    where m.tenant_id = p_tenant_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (p_roles is null or m.role = any (p_roles))
  );
$$;

grant execute on function public.poultryedos_is_tenant_member(uuid, text[]) to authenticated;
revoke execute on function public.poultryedos_is_tenant_member(uuid, text[]) from anon;

create or replace function public.poultryedos_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger poultryedos_tenants_set_updated_at
  before update on public.poultryedos_tenants
  for each row execute function public.poultryedos_set_updated_at();

create trigger poultryedos_memberships_set_updated_at
  before update on public.poultryedos_tenant_memberships
  for each row execute function public.poultryedos_set_updated_at();

-- Self-serve onboarding: a signed-up user creates their own tenant and
-- becomes its owner in one atomic step (mirrors appbookings_create_tenant).
create or replace function public.poultryedos_create_tenant(
  p_name text,
  p_slug text,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_name), '') = '' then
    raise exception 'missing_tenant_name' using errcode = 'P0001';
  end if;

  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'invalid_slug' using errcode = 'P0001';
  end if;

  insert into poultryedos_tenants (name, slug, status, contact_email, contact_phone)
  values (trim(p_name), p_slug, 'active', nullif(p_contact_email, ''), nullif(p_contact_phone, ''))
  returning id into v_tenant_id;

  insert into poultryedos_tenant_memberships (tenant_id, user_id, role, status)
  values (v_tenant_id, auth.uid(), 'owner', 'active');

  return v_tenant_id;
exception
  when unique_violation then
    raise exception 'slug_taken' using errcode = 'P0001';
end;
$$;

grant execute on function public.poultryedos_create_tenant(text, text, text, text) to authenticated;
revoke execute on function public.poultryedos_create_tenant(text, text, text, text) from anon;

alter table public.poultryedos_tenants enable row level security;
alter table public.poultryedos_tenant_memberships enable row level security;

create policy poultryedos_tenants_member_read
  on public.poultryedos_tenants for select
  to authenticated
  using (public.poultryedos_is_tenant_member(id, null));

create policy poultryedos_tenants_owner_update
  on public.poultryedos_tenants for update
  to authenticated
  using (public.poultryedos_is_tenant_member(id, array['owner', 'admin']))
  with check (public.poultryedos_is_tenant_member(id, array['owner', 'admin']));

create policy poultryedos_memberships_self_read
  on public.poultryedos_tenant_memberships for select
  to authenticated
  using (user_id = auth.uid() or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

create policy poultryedos_memberships_owner_write
  on public.poultryedos_tenant_memberships for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));
