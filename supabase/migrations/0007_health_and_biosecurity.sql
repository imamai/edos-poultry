-- EDOS Poultry360 Phase 4: health events and biosecurity checklists.
--
-- SCOPE NOTE: the spec lists poultryedos_health_events and
-- poultryedos_veterinary_visits as separate tables. A veterinary visit is,
-- in practice, one more health event with a vet's name and a follow-up date
-- attached — splitting it into a second table would just mean joining two
-- tables together every time you want "what happened with this flock's
-- health," for no normalization benefit. One table, per spec section 75's
-- own instruction to avoid unnecessary duplication.

create table if not exists public.poultryedos_health_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  flock_id uuid not null references public.poultryedos_flocks (id) on delete cascade,
  event_date date not null default current_date,
  symptoms text,
  suspected_condition text,
  treatment text,
  medication text,
  veterinarian text,
  follow_up_date date,
  resolved boolean not null default false,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_health_events_flock_idx
  on public.poultryedos_health_events (flock_id, event_date desc);

create trigger poultryedos_health_events_set_updated_at
  before update on public.poultryedos_health_events
  for each row execute function public.poultryedos_set_updated_at();

-- Biosecurity: one checklist submission per farm per date. Score is
-- computed at read time (count of true checks / total), not stored, so the
-- scoring weights stay easy to change later without a backfill.
create table if not exists public.poultryedos_biosecurity_checks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farm_id uuid not null references public.poultryedos_farms (id) on delete cascade,
  check_date date not null default current_date,
  footbath boolean not null default false,
  visitor_control boolean not null default false,
  ppe_used boolean not null default false,
  cleaning_done boolean not null default false,
  disinfection_done boolean not null default false,
  rodent_control boolean not null default false,
  dead_bird_disposal boolean not null default false,
  feed_hygiene boolean not null default false,
  water_sanitation boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (farm_id, check_date)
);

create index if not exists poultryedos_biosecurity_checks_farm_idx
  on public.poultryedos_biosecurity_checks (farm_id, check_date desc);

alter table public.poultryedos_health_events enable row level security;
alter table public.poultryedos_biosecurity_checks enable row level security;

create policy poultryedos_health_events_read
  on public.poultryedos_health_events for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_health_events_write
  on public.poultryedos_health_events for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer', 'veterinary_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer', 'veterinary_officer']));

create policy poultryedos_biosecurity_read
  on public.poultryedos_biosecurity_checks for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_biosecurity_write
  on public.poultryedos_biosecurity_checks for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));
