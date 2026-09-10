-- EDOS Poultry360: poultry types (configurable reference data), farmers,
-- farms, houses, and flocks.

create table if not exists public.poultryedos_poultry_types (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.poultryedos_tenants (id) on delete cascade,
  name text not null,
  code text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- null tenant_id = a global system default available to every tenant;
  -- a tenant can add its own custom types alongside the defaults.
  unique (tenant_id, code)
);

create index if not exists poultryedos_poultry_types_tenant_idx
  on public.poultryedos_poultry_types (tenant_id);

-- A "farmer" is a distinct record from a tenant membership: for an
-- individual smallholder they are 1:1 with the tenant (and its owner), but
-- this table is what lets a future cooperative/network tenant hold many
-- farmers, most without their own login (user_id null, managed by a field
-- officer instead). See PRODUCT_SPEC.md section 39/40 for that later phase.
create table if not exists public.poultryedos_farmers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null,
  phone text,
  email text,
  county text,
  sub_county text,
  ward text,
  experience_level text default 'new' check (experience_level in ('new', 'experienced', 'expert')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_farmers_tenant_idx on public.poultryedos_farmers (tenant_id);
create unique index if not exists poultryedos_farmers_user_idx
  on public.poultryedos_farmers (tenant_id, user_id) where user_id is not null;

create table if not exists public.poultryedos_farms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farmer_id uuid not null references public.poultryedos_farmers (id) on delete cascade,
  name text not null,
  county text,
  sub_county text,
  ward text,
  gps_lat numeric(9, 6),
  gps_lng numeric(9, 6),
  water_source text,
  has_electricity boolean,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_farms_tenant_idx on public.poultryedos_farms (tenant_id);
create index if not exists poultryedos_farms_farmer_idx on public.poultryedos_farms (farmer_id);

create table if not exists public.poultryedos_houses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farm_id uuid not null references public.poultryedos_farms (id) on delete cascade,
  name text not null,
  capacity int check (capacity > 0),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_houses_farm_idx on public.poultryedos_houses (farm_id);

create table if not exists public.poultryedos_flocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farm_id uuid not null references public.poultryedos_farms (id) on delete cascade,
  house_id uuid references public.poultryedos_houses (id) on delete set null,
  poultry_type_id uuid references public.poultryedos_poultry_types (id) on delete set null,
  batch_code text not null,
  breed text,
  source text,
  placement_date date not null,
  initial_quantity int not null check (initial_quantity > 0),
  current_quantity int not null check (current_quantity >= 0),
  status text not null default 'active' check (status in ('active', 'sold_out', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, batch_code)
);

create index if not exists poultryedos_flocks_farm_idx on public.poultryedos_flocks (farm_id, status);
create index if not exists poultryedos_flocks_house_idx on public.poultryedos_flocks (house_id);

create trigger poultryedos_farmers_set_updated_at
  before update on public.poultryedos_farmers
  for each row execute function public.poultryedos_set_updated_at();
create trigger poultryedos_farms_set_updated_at
  before update on public.poultryedos_farms
  for each row execute function public.poultryedos_set_updated_at();
create trigger poultryedos_houses_set_updated_at
  before update on public.poultryedos_houses
  for each row execute function public.poultryedos_set_updated_at();
create trigger poultryedos_flocks_set_updated_at
  before update on public.poultryedos_flocks
  for each row execute function public.poultryedos_set_updated_at();

-- RLS -------------------------------------------------------------------

alter table public.poultryedos_poultry_types enable row level security;
alter table public.poultryedos_farmers enable row level security;
alter table public.poultryedos_farms enable row level security;
alter table public.poultryedos_houses enable row level security;
alter table public.poultryedos_flocks enable row level security;

create policy poultryedos_poultry_types_read
  on public.poultryedos_poultry_types for select
  to authenticated
  using (tenant_id is null or public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_poultry_types_write
  on public.poultryedos_poultry_types for all
  to authenticated
  using (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

create policy poultryedos_farmers_read
  on public.poultryedos_farmers for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_farmers_write
  on public.poultryedos_farmers for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'field_officer']));

create policy poultryedos_farms_read
  on public.poultryedos_farms for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_farms_write
  on public.poultryedos_farms for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_houses_read
  on public.poultryedos_houses for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_houses_write
  on public.poultryedos_houses for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_flocks_read
  on public.poultryedos_flocks for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_flocks_write
  on public.poultryedos_flocks for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));
