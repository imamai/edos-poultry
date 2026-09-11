-- EDOS Poultry360: marketplace groundwork (spec §42), farmer-listing side.
--
-- SCOPE NOTE: the full spec also wants buyer accounts that "publish
-- demand." Building a second identity system just to receive listings
-- was more than this first slice needed — instead the browse side is
-- public (see grants below), so a buyer never needs a Poultry360 account
-- at all to find a listing and call the number on it. Buyer-side demand
-- posts, contract farming (§41), and a distinct cooperative org type
-- with input distribution (§40) are separate, larger pieces of work, not
-- attempted here.
--
-- Every other table in this schema keeps reads tenant-scoped and exposes
-- any cross-cutting view through an audited SECURITY DEFINER RPC rather
-- than loosening a base policy (see poultryedos_list_tenant_members,
-- poultryedos_super_admin_list_tenants). This is the same shape, except
-- the RPC here is deliberately grantable to `anon` too, mirroring
-- poultryedos_view_invite — a marketplace board only has value if people
-- who aren't already signed in as a tenant member can see it.

create table if not exists public.poultryedos_marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farm_id uuid not null references public.poultryedos_farms (id) on delete cascade,
  flock_id uuid references public.poultryedos_flocks (id) on delete set null,
  category text not null check (category in ('eggs', 'birds', 'manure', 'feed_request', 'other')),
  title text not null,
  description text,
  quantity numeric(10, 2),
  unit text,
  price_cents bigint check (price_cents is null or price_cents >= 0), -- null = negotiable
  location text,
  contact_name text,
  contact_phone text,
  status text not null default 'active' check (status in ('active', 'fulfilled', 'expired', 'cancelled')),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists poultryedos_marketplace_listings_tenant_idx
  on public.poultryedos_marketplace_listings (tenant_id);
create index if not exists poultryedos_marketplace_listings_browse_idx
  on public.poultryedos_marketplace_listings (status, expires_at, category, created_at desc);

alter table public.poultryedos_marketplace_listings enable row level security;

-- Base table stays tenant-scoped like everything else -- owner/admin/farmer
-- manage their own tenant's listings (field officers excluded: they don't
-- own the commercial relationship a listing represents). Subscription-gated
-- on write, same hard-enforcement shape as expenses/sales/purchase orders.
create policy poultryedos_marketplace_listings_manage
  on public.poultryedos_marketplace_listings for all
  to authenticated
  using (
    poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer'])
    and poultryedos_is_subscription_active(tenant_id)
  )
  with check (
    poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer'])
    and poultryedos_is_subscription_active(tenant_id)
  );

-- Public browse: a curated projection only, never raw table access. Runs
-- as definer so it can read across every tenant without granting anon or
-- authenticated any direct SELECT on the base table above.
create or replace function public.poultryedos_marketplace_browse(p_category text default null)
returns table (
  id uuid,
  category text,
  title text,
  description text,
  quantity numeric,
  unit text,
  price_cents bigint,
  location text,
  contact_name text,
  contact_phone text,
  seller_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    l.id, l.category, l.title, l.description, l.quantity, l.unit,
    l.price_cents, l.location, l.contact_name, l.contact_phone,
    t.name, l.created_at
  from poultryedos_marketplace_listings l
  join poultryedos_tenants t on t.id = l.tenant_id
  where l.status = 'active'
    and l.expires_at > now()
    and (p_category is null or l.category = p_category)
  order by l.created_at desc
  limit 200;
$$;

revoke execute on function public.poultryedos_marketplace_browse(text) from public;
grant execute on function public.poultryedos_marketplace_browse(text) to anon, authenticated;
