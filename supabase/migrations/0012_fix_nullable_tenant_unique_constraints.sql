-- Bug: unique(tenant_id, code) / unique(tenant_id, name) do NOT actually
-- deduplicate global rows (tenant_id is null), because SQL's unique
-- constraints treat every NULL as distinct from every other NULL -- two
-- rows (null, 'LAYER') and (null, 'LAYER') do not violate the constraint,
-- and ON CONFLICT (tenant_id, code) DO NOTHING never detects a "conflict"
-- between them either. Re-running the seed would have silently duplicated
-- every global poultry type and expense category. Replace with partial
-- unique indexes that treat all-global-rows and per-tenant rows correctly.

alter table public.poultryedos_poultry_types drop constraint if exists poultryedos_poultry_types_tenant_id_code_key;
create unique index if not exists poultryedos_poultry_types_global_code_idx
  on public.poultryedos_poultry_types (code) where tenant_id is null;
create unique index if not exists poultryedos_poultry_types_tenant_code_idx
  on public.poultryedos_poultry_types (tenant_id, code) where tenant_id is not null;

alter table public.poultryedos_expense_categories drop constraint if exists poultryedos_expense_categories_tenant_id_name_key;
create unique index if not exists poultryedos_expense_categories_global_name_idx
  on public.poultryedos_expense_categories (name) where tenant_id is null;
create unique index if not exists poultryedos_expense_categories_tenant_name_idx
  on public.poultryedos_expense_categories (tenant_id, name) where tenant_id is not null;
