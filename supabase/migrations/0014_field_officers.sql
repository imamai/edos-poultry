-- EDOS Poultry360 Phase 6: field officer assignments, visits, and tasks
-- (spec sections 37/38).

create table if not exists public.poultryedos_field_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  field_officer_user_id uuid not null references auth.users (id) on delete cascade,
  farmer_id uuid not null references public.poultryedos_farmers (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (field_officer_user_id, farmer_id)
);

create index if not exists poultryedos_field_assignments_officer_idx
  on public.poultryedos_field_assignments (field_officer_user_id);
create index if not exists poultryedos_field_assignments_farmer_idx
  on public.poultryedos_field_assignments (farmer_id);

create table if not exists public.poultryedos_field_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  field_officer_user_id uuid not null references auth.users (id) on delete set null,
  farmer_id uuid not null references public.poultryedos_farmers (id) on delete cascade,
  farm_id uuid references public.poultryedos_farms (id) on delete set null,
  status text not null default 'assigned' check (status in (
    'assigned', 'traveling', 'visited', 'assessment', 'recommendation',
    'action_required', 'follow_up', 'resolved'
  )),
  scheduled_date date not null default current_date,
  visited_at timestamptz,
  gps_lat numeric(9, 6),
  gps_lng numeric(9, 6),
  assessment text,
  recommendation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_field_visits_officer_idx
  on public.poultryedos_field_visits (field_officer_user_id, scheduled_date);
create index if not exists poultryedos_field_visits_farmer_idx
  on public.poultryedos_field_visits (farmer_id, scheduled_date desc);

create trigger poultryedos_field_visits_set_updated_at
  before update on public.poultryedos_field_visits
  for each row execute function public.poultryedos_set_updated_at();

create table if not exists public.poultryedos_field_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  assigned_to uuid references auth.users (id) on delete set null,
  farmer_id uuid references public.poultryedos_farmers (id) on delete cascade,
  visit_id uuid references public.poultryedos_field_visits (id) on delete set null,
  title text not null,
  description text,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_field_tasks_assigned_idx
  on public.poultryedos_field_tasks (assigned_to, status);

create trigger poultryedos_field_tasks_set_updated_at
  before update on public.poultryedos_field_tasks
  for each row execute function public.poultryedos_set_updated_at();

alter table public.poultryedos_field_assignments enable row level security;
alter table public.poultryedos_field_visits enable row level security;
alter table public.poultryedos_field_tasks enable row level security;

-- Field officers see only their own assignments/visits/tasks; owner/admin
-- see everything in the tenant (network oversight). This is the one place
-- a role narrower than "owner/admin" needs row-level scoping beyond plain
-- tenant membership, since a field officer should not see another field
-- officer's unrelated farmer visits.

create policy poultryedos_field_assignments_read
  on public.poultryedos_field_assignments for select
  to authenticated
  using (
    field_officer_user_id = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  );

create policy poultryedos_field_assignments_write
  on public.poultryedos_field_assignments for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

create policy poultryedos_field_visits_read
  on public.poultryedos_field_visits for select
  to authenticated
  using (
    field_officer_user_id = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  );

create policy poultryedos_field_visits_officer_write
  on public.poultryedos_field_visits for all
  to authenticated
  using (
    field_officer_user_id = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  )
  with check (
    field_officer_user_id = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  );

create policy poultryedos_field_tasks_read
  on public.poultryedos_field_tasks for select
  to authenticated
  using (
    assigned_to = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  );

create policy poultryedos_field_tasks_write
  on public.poultryedos_field_tasks for all
  to authenticated
  using (
    assigned_to = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  )
  with check (
    assigned_to = (select auth.uid())
    or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin'])
  );
