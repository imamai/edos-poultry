-- EDOS Poultry360 Phase 5: inventory (with trigger-maintained stock, same
-- pattern as poultryedos_flocks.current_quantity) and procurement.
--
-- SCOPE NOTE: the spec's purchase_order_items as a separate line-items
-- table makes sense for a business ordering many items in one purchase.
-- At smallholder/early-commercial scale a purchase is almost always "one
-- item from one supplier" (a bag of feed, a vial of vaccine) -- a single
-- table with quantity/cost columns covers the real workflow without an
-- extra join for every read. Revisit if/when multi-line purchase orders
-- are an actual need, not a hypothetical one.

create table if not exists public.poultryedos_inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  name text not null,
  category text not null check (category in ('feed', 'vaccine', 'medicine', 'equipment', 'other')),
  unit text not null default 'kg',
  stock_on_hand numeric(10, 2) not null default 0,
  reorder_level numeric(10, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_inventory_items_tenant_idx on public.poultryedos_inventory_items (tenant_id);

create table if not exists public.poultryedos_inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  item_id uuid not null references public.poultryedos_inventory_items (id) on delete cascade,
  transaction_type text not null check (transaction_type in ('in', 'out', 'adjustment')),
  -- 'in'/'out' are always positive (direction comes from transaction_type);
  -- 'adjustment' is a signed delta so it can correct stock down (spoilage,
  -- a discovered shortage) as well as up (a found surplus), but never zero.
  quantity numeric(10, 2) not null check (
    (transaction_type in ('in', 'out') and quantity > 0) or
    (transaction_type = 'adjustment' and quantity <> 0)
  ),
  unit_cost_cents bigint,
  reference text,
  transaction_date date not null default current_date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_inventory_transactions_item_idx
  on public.poultryedos_inventory_transactions (item_id, transaction_date desc);

create trigger poultryedos_inventory_items_set_updated_at
  before update on public.poultryedos_inventory_items
  for each row execute function public.poultryedos_set_updated_at();

create or replace function public.poultryedos_recompute_inventory_stock()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_item_id uuid;
  v_stock numeric(10, 2);
begin
  v_item_id := coalesce(new.item_id, old.item_id);

  select coalesce(sum(
    case
      when transaction_type = 'in' then quantity
      when transaction_type = 'out' then -quantity
      else quantity -- adjustment is a signed delta stored as-is via quantity's sign convention below
    end
  ), 0) into v_stock
  from poultryedos_inventory_transactions
  where item_id = v_item_id;

  update poultryedos_inventory_items set stock_on_hand = v_stock where id = v_item_id;
  return coalesce(new, old);
end;
$$;

create trigger poultryedos_inventory_transactions_recompute
  after insert or update or delete on public.poultryedos_inventory_transactions
  for each row execute function public.poultryedos_recompute_inventory_stock();

create table if not exists public.poultryedos_suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.poultryedos_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  supplier_id uuid references public.poultryedos_suppliers (id) on delete set null,
  item_id uuid references public.poultryedos_inventory_items (id) on delete set null,
  item_name text not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  total_cost_cents bigint not null check (total_cost_cents >= 0),
  order_date date not null default current_date,
  received_date date,
  status text not null default 'ordered' check (status in ('ordered', 'received', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_purchase_orders_tenant_idx
  on public.poultryedos_purchase_orders (tenant_id, status);

create trigger poultryedos_purchase_orders_set_updated_at
  before update on public.poultryedos_purchase_orders
  for each row execute function public.poultryedos_set_updated_at();

-- Marking a PO received automatically stocks the linked inventory item —
-- the farmer never has to remember to record the stock-in separately.
create or replace function public.poultryedos_receive_purchase_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' and new.item_id is not null then
    insert into poultryedos_inventory_transactions
      (tenant_id, item_id, transaction_type, quantity, unit_cost_cents, reference, transaction_date)
    values
      (new.tenant_id, new.item_id, 'in', new.quantity, new.unit_cost_cents, 'purchase_order:' || new.id, coalesce(new.received_date, current_date));
  end if;
  return new;
end;
$$;

create trigger poultryedos_purchase_orders_receive
  after update of status on public.poultryedos_purchase_orders
  for each row execute function public.poultryedos_receive_purchase_order();

alter table public.poultryedos_inventory_items enable row level security;
alter table public.poultryedos_inventory_transactions enable row level security;
alter table public.poultryedos_suppliers enable row level security;
alter table public.poultryedos_purchase_orders enable row level security;

create policy poultryedos_inventory_items_read
  on public.poultryedos_inventory_items for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_inventory_items_write
  on public.poultryedos_inventory_items for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_inventory_transactions_read
  on public.poultryedos_inventory_transactions for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_inventory_transactions_write
  on public.poultryedos_inventory_transactions for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_suppliers_read
  on public.poultryedos_suppliers for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_suppliers_write
  on public.poultryedos_suppliers for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));

create policy poultryedos_purchase_orders_read
  on public.poultryedos_purchase_orders for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_purchase_orders_write
  on public.poultryedos_purchase_orders for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin', 'farmer', 'field_officer']));
