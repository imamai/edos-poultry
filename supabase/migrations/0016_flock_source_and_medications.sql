-- Addresses audit gaps found against real-world requirements (Naomi's
-- brooding/egg-production/sales lists):
--   1. poultryedos_flocks was missing a distinct "supplier" field -- the
--      original spec (section 18) always called for breed/source/supplier
--      as three separate fields, but only breed+source were ever added.
--      "Company" (who produced the chicks, e.g. Kenchic) and "Source of
--      birds" (who you actually bought/collected from, e.g. an agrovet --
--      often a different party) are genuinely different in practice.
--   2. Vaccination schedules had no way to express "due at day 14" --
--      only an absolute date. Age-specific vaccination needs the
--      schedule to be computable from placement_date + an age in days.
--   3. Medications (antibiotics, multivitamins, dewormers) were only a
--      free-text field buried inside a health event, with no category
--      and no way to log a routine medication that isn't tied to any
--      illness. Naomi's list treats it as its own thing, parallel to
--      vaccination -- so it gets its own table, the same shape as
--      poultryedos_vaccination_schedules.

alter table public.poultryedos_flocks add column if not exists supplier text;

alter table public.poultryedos_vaccination_schedules
  add column if not exists age_days int check (age_days >= 0);

create table if not exists public.poultryedos_medication_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  flock_id uuid not null references public.poultryedos_flocks (id) on delete cascade,
  medication_type text not null check (medication_type in ('antibiotic', 'multivitamin', 'dewormer', 'other')),
  medication_name text not null,
  dosage text,
  given_date date not null default current_date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_medication_records_flock_idx
  on public.poultryedos_medication_records (flock_id, given_date desc);

alter table public.poultryedos_medication_records enable row level security;

create policy poultryedos_medication_records_read
  on public.poultryedos_medication_records for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_medication_records_write
  on public.poultryedos_medication_records for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer', 'veterinary_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer', 'veterinary_officer']));
