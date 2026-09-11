-- EDOS Poultry360: multi-line purchase orders (spec §32).
--
-- Migration 0010 deliberately kept a purchase order as one item from one
-- supplier, with an explicit note to revisit "when there's an actual
-- business ordering many items in one purchase, not before." That need is
-- now real. poultryedos_purchase_orders had zero rows in production at
-- the time of this migration, so this reshapes the table directly rather
-- than needing a data-preserving backfill step.

create table if not exists public.poultryedos_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  purchase_order_id uuid not null references public.poultryedos_purchase_orders (id) on delete cascade,
  item_id uuid references public.poultryedos_inventory_items (id) on delete set null,
  item_name text not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  unit_cost_cents bigint not null check (unit_cost_cents >= 0),
  -- Pure per-row arithmetic, no cross-row aggregation -- a generated
  -- column means the app never computes it by hand and it can never drift
  -- from quantity/unit_cost_cents.
  line_total_cost_cents bigint generated always as (round(quantity * unit_cost_cents)::bigint) stored,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_purchase_order_items_po_idx
  on public.poultryedos_purchase_order_items (purchase_order_id);
create index if not exists poultryedos_purchase_order_items_tenant_idx
  on public.poultryedos_purchase_order_items (tenant_id);

-- Preserve any pre-existing single-line orders as a one-item line (defensive
-- — this table had zero rows when written, but makes the migration correct
-- regardless of when it actually runs).
insert into public.poultryedos_purchase_order_items (tenant_id, purchase_order_id, item_id, item_name, quantity, unit_cost_cents)
select tenant_id, id, item_id, item_name, quantity, unit_cost_cents
from public.poultryedos_purchase_orders;

alter table public.poultryedos_purchase_orders
  drop column item_id,
  drop column item_name,
  drop column quantity,
  drop column unit_cost_cents,
  alter column total_cost_cents drop not null,
  alter column total_cost_cents set default 0;

-- total_cost_cents on the header is now trigger-maintained, the same
-- recompute-on-child-change pattern as poultryedos_flocks.current_quantity
-- and poultryedos_inventory_items.stock_on_hand.
create or replace function public.poultryedos_recompute_po_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_po_id uuid;
  v_total bigint;
begin
  v_po_id := coalesce(new.purchase_order_id, old.purchase_order_id);

  select coalesce(sum(line_total_cost_cents), 0) into v_total
  from poultryedos_purchase_order_items
  where purchase_order_id = v_po_id;

  update poultryedos_purchase_orders set total_cost_cents = v_total where id = v_po_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.poultryedos_recompute_po_total() from public, anon, authenticated;

create trigger poultryedos_purchase_order_items_recompute
  after insert or update or delete on public.poultryedos_purchase_order_items
  for each row execute function public.poultryedos_recompute_po_total();

-- Marking a PO "received" now stocks every line item, not just one.
create or replace function public.poultryedos_receive_purchase_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'received' and old.status is distinct from 'received' then
    insert into poultryedos_inventory_transactions
      (tenant_id, item_id, transaction_type, quantity, unit_cost_cents, reference, transaction_date)
    select new.tenant_id, poi.item_id, 'in', poi.quantity, poi.unit_cost_cents,
           'purchase_order:' || new.id, coalesce(new.received_date, current_date)
    from poultryedos_purchase_order_items poi
    where poi.purchase_order_id = new.id and poi.item_id is not null;
  end if;
  return new;
end;
$$;

-- Atomic header + line-items creation, mirroring poultryedos_create_tenant's
-- "one RPC, one transaction" pattern -- a client-side "insert header, then
-- insert N lines" would risk an orphaned empty order if the line insert
-- failed partway through.
create or replace function public.poultryedos_create_purchase_order(
  p_tenant_id uuid,
  p_supplier_id uuid,
  p_items jsonb -- array of {item_id, item_name, quantity, unit_cost_cents}
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_po_id uuid;
  v_item jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A purchase order needs at least one item.' using errcode = 'P0001';
  end if;

  insert into poultryedos_purchase_orders (tenant_id, supplier_id, status)
  values (p_tenant_id, p_supplier_id, 'ordered')
  returning id into v_po_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into poultryedos_purchase_order_items (tenant_id, purchase_order_id, item_id, item_name, quantity, unit_cost_cents)
    values (
      p_tenant_id,
      v_po_id,
      nullif(v_item->>'item_id', '')::uuid,
      v_item->>'item_name',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_cost_cents')::bigint
    );
  end loop;

  return v_po_id;
end;
$$;

revoke execute on function public.poultryedos_create_purchase_order(uuid, uuid, jsonb) from public, anon;
grant execute on function public.poultryedos_create_purchase_order(uuid, uuid, jsonb) to authenticated;

alter table public.poultryedos_purchase_order_items enable row level security;

create policy poultryedos_purchase_order_items_read
  on public.poultryedos_purchase_order_items for select
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_purchase_order_items_write
  on public.poultryedos_purchase_order_items for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));
