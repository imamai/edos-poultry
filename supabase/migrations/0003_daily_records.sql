-- EDOS Poultry360: the "Record Today" daily record, and the trigger that
-- keeps poultryedos_flocks.current_quantity correct without ever requiring
-- the farmer or the UI to compute it themselves.
--
-- SCOPE NOTE: the full spec's Sales module (customers, invoices, credit) is
-- Phase 5 / enterprise territory. For the smallholder "Record Today" flow
-- (spec section 8/92), a sale is just an amount for the day — that's what
-- sales_amount_cents captures here. A real CRM-backed sales ledger is a
-- later, separate module once commercial/enterprise farms are in scope.

create table if not exists public.poultryedos_daily_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  flock_id uuid not null references public.poultryedos_flocks (id) on delete cascade,
  record_date date not null,
  mortality int not null default 0 check (mortality >= 0),
  culls int not null default 0 check (culls >= 0),
  birds_sold int not null default 0 check (birds_sold >= 0),
  eggs_collected int check (eggs_collected >= 0),
  feed_consumed_kg numeric(8, 2) check (feed_consumed_kg >= 0),
  water_consumed_liters numeric(8, 2) check (water_consumed_liters >= 0),
  sales_amount_cents bigint not null default 0 check (sales_amount_cents >= 0),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (flock_id, record_date)
);

create index if not exists poultryedos_daily_records_flock_idx
  on public.poultryedos_daily_records (flock_id, record_date desc);
create index if not exists poultryedos_daily_records_tenant_idx
  on public.poultryedos_daily_records (tenant_id, record_date desc);

create trigger poultryedos_daily_records_set_updated_at
  before update on public.poultryedos_daily_records
  for each row execute function public.poultryedos_set_updated_at();

create or replace function public.poultryedos_recompute_flock_quantity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_flock_id uuid;
  v_initial int;
  v_removed int;
begin
  v_flock_id := coalesce(new.flock_id, old.flock_id);

  select initial_quantity into v_initial from poultryedos_flocks where id = v_flock_id;

  select coalesce(sum(mortality + culls + birds_sold), 0) into v_removed
  from poultryedos_daily_records
  where flock_id = v_flock_id;

  update poultryedos_flocks
    set current_quantity = v_initial - v_removed,
        status = case when v_initial - v_removed <= 0 then 'sold_out' else status end
    where id = v_flock_id;

  return coalesce(new, old);
end;
$$;

create trigger poultryedos_daily_records_recompute_flock
  after insert or update or delete on public.poultryedos_daily_records
  for each row execute function public.poultryedos_recompute_flock_quantity();

-- Vaccination reminders (spec section 25) -------------------------------

create table if not exists public.poultryedos_vaccination_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  flock_id uuid not null references public.poultryedos_flocks (id) on delete cascade,
  vaccine_name text not null,
  target_disease text,
  scheduled_date date not null,
  administered_date date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_vaccination_flock_idx
  on public.poultryedos_vaccination_schedules (flock_id, scheduled_date);

-- Farmer help requests (spec section 13) --------------------------------

create table if not exists public.poultryedos_support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farmer_id uuid not null references public.poultryedos_farmers (id) on delete cascade,
  flock_id uuid references public.poultryedos_flocks (id) on delete set null,
  problem text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_support_tickets_tenant_idx
  on public.poultryedos_support_tickets (tenant_id, status);

create trigger poultryedos_support_tickets_set_updated_at
  before update on public.poultryedos_support_tickets
  for each row execute function public.poultryedos_set_updated_at();

-- Knowledge base / advice center (spec section 14) ----------------------

create table if not exists public.poultryedos_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.poultryedos_tenants (id) on delete cascade,
  title text not null,
  category text not null check (category in (
    'brooding', 'feeding', 'vaccination', 'biosecurity', 'housing',
    'egg_handling', 'disease_warning_signs', 'marketing', 'record_keeping',
    'profitability', 'water_management', 'welfare'
  )),
  poultry_type_scope text,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_knowledge_base_category_idx
  on public.poultryedos_knowledge_base (category);

-- RLS ---------------------------------------------------------------------

alter table public.poultryedos_daily_records enable row level security;
alter table public.poultryedos_vaccination_schedules enable row level security;
alter table public.poultryedos_support_tickets enable row level security;
alter table public.poultryedos_knowledge_base enable row level security;

create policy poultryedos_daily_records_read
  on public.poultryedos_daily_records for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_daily_records_write
  on public.poultryedos_daily_records for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_vaccination_read
  on public.poultryedos_vaccination_schedules for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_vaccination_write
  on public.poultryedos_vaccination_schedules for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer', 'veterinary_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer', 'veterinary_officer']));

create policy poultryedos_support_tickets_read
  on public.poultryedos_support_tickets for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_support_tickets_write
  on public.poultryedos_support_tickets for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_knowledge_base_read
  on public.poultryedos_knowledge_base for select
  to authenticated
  using (tenant_id is null or public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_knowledge_base_write
  on public.poultryedos_knowledge_base for all
  to authenticated
  using (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));
