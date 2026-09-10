-- EDOS Poultry360 Phase 5: customers and itemized sales (spec section 30/31).
--
-- SCOPE NOTE: this is genuinely additive to, not a replacement for,
-- poultryedos_daily_records.sales_amount_cents. That field stays the fast,
-- unattributed "sales today" number for the 60-second Record Today flow.
-- This table is for when a farmer wants to log a real sale — what was
-- sold, to whom, how it was paid. The Sales page totals both together and
-- labels them separately so a farmer never has to wonder if they're
-- double-counting the same sale.

create table if not exists public.poultryedos_customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  name text not null,
  phone text,
  customer_type text not null default 'individual' check (customer_type in (
    'hotel', 'restaurant', 'school', 'hospital', 'supermarket', 'wholesaler',
    'retailer', 'individual', 'aggregator', 'processor'
  )),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_customers_tenant_idx on public.poultryedos_customers (tenant_id);

create table if not exists public.poultryedos_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  flock_id uuid references public.poultryedos_flocks (id) on delete set null,
  customer_id uuid references public.poultryedos_customers (id) on delete set null,
  product text not null check (product in (
    'eggs', 'live_birds', 'processed_birds', 'spent_layers', 'chicks', 'manure', 'other'
  )),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null default 'piece',
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  total_amount_cents bigint not null check (total_amount_cents >= 0),
  payment_method text not null default 'cash' check (payment_method in ('cash', 'mpesa', 'bank', 'credit', 'other')),
  sale_date date not null default current_date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_sales_tenant_idx on public.poultryedos_sales (tenant_id, sale_date desc);
create index if not exists poultryedos_sales_customer_idx on public.poultryedos_sales (customer_id);
create index if not exists poultryedos_sales_flock_idx on public.poultryedos_sales (flock_id);

alter table public.poultryedos_customers enable row level security;
alter table public.poultryedos_sales enable row level security;

create policy poultryedos_customers_read
  on public.poultryedos_customers for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_customers_write
  on public.poultryedos_customers for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_sales_read
  on public.poultryedos_sales for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_sales_write
  on public.poultryedos_sales for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));
