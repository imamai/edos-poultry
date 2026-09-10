-- EDOS Poultry360 Phase 5: expenses, configurable categories (spec section 33/97).

create table if not exists public.poultryedos_expense_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.poultryedos_tenants (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists public.poultryedos_expenses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  category_id uuid references public.poultryedos_expense_categories (id) on delete set null,
  flock_id uuid references public.poultryedos_flocks (id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  expense_date date not null default current_date,
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_expenses_tenant_idx
  on public.poultryedos_expenses (tenant_id, expense_date desc);
create index if not exists poultryedos_expenses_flock_idx
  on public.poultryedos_expenses (flock_id);

alter table public.poultryedos_expense_categories enable row level security;
alter table public.poultryedos_expenses enable row level security;

create policy poultryedos_expense_categories_read
  on public.poultryedos_expense_categories for select
  to authenticated
  using (tenant_id is null or public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_expense_categories_write
  on public.poultryedos_expense_categories for all
  to authenticated
  using (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

create policy poultryedos_expenses_read
  on public.poultryedos_expenses for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_expenses_write
  on public.poultryedos_expenses for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));
