-- EDOS Poultry360 Phase 7: announcements (spec §67 CMS, scoped to
-- tenant-level admin — see README "Deliberately deferred" on why there's
-- no cross-tenant super-admin yet). Same read/write RLS shape as
-- poultryedos_knowledge_base (migration 0003): tenant_id null = global,
-- writable only via direct SQL/seed for now; tenant_id set = that tenant's
-- own announcement, writable by its owner/admin.

create table if not exists public.poultryedos_announcements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.poultryedos_tenants (id) on delete cascade,
  title text not null,
  body text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_announcements_tenant_idx
  on public.poultryedos_announcements (tenant_id, starts_at desc);

create trigger poultryedos_announcements_set_updated_at
  before update on public.poultryedos_announcements
  for each row execute function public.poultryedos_set_updated_at();

alter table public.poultryedos_announcements enable row level security;

create policy poultryedos_announcements_read
  on public.poultryedos_announcements for select
  to authenticated
  using (tenant_id is null or public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_announcements_write
  on public.poultryedos_announcements for all
  to authenticated
  using (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (tenant_id is not null and public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));
