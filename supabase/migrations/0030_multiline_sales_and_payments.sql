-- EDOS Poultry360: multi-item sales + a real payments/balance ledger
-- (spec §30/31 -- discount, balance, invoice, receipt were all explicitly
-- called for and none existed; the spec's own schema-naming section also
-- already anticipates poultryedos_sale_items and poultryedos_payments).
--
-- Migration 0010's purchase-order note applies here too, now that a real
-- "sell several products to one client in one transaction" need exists:
-- this reshapes poultryedos_sales the same way 0024 reshaped purchase
-- orders. UNLIKE purchase orders at the time of 0024, this table already
-- has real production rows -- verified live before this migration ran
-- that every existing row's total_amount_cents equals quantity *
-- unit_price_cents exactly (no pre-existing discounts to lose), so the
-- data-preservation insert below reproduces every figure exactly.

create table if not exists public.poultryedos_sale_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  sale_id uuid not null references public.poultryedos_sales (id) on delete cascade,
  product text not null check (product in (
    'eggs', 'live_birds', 'processed_birds', 'spent_layers', 'chicks', 'manure', 'other'
  )),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null default 'piece',
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  -- Same "never hand-computed, can't drift" generated-column pattern as
  -- poultryedos_purchase_order_items.line_total_cost_cents.
  line_total_cents bigint generated always as (round(quantity * unit_price_cents)::bigint - discount_cents) stored,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_sale_items_sale_idx on public.poultryedos_sale_items (sale_id);
create index if not exists poultryedos_sale_items_tenant_idx on public.poultryedos_sale_items (tenant_id);

-- Data preservation: one line item per existing sale, before the header
-- loses the columns it's copied from.
insert into public.poultryedos_sale_items (tenant_id, sale_id, product, quantity, unit, unit_price_cents)
select tenant_id, id, product, quantity, unit, unit_price_cents
from public.poultryedos_sales;

alter table public.poultryedos_sales
  drop column product,
  drop column quantity,
  drop column unit,
  drop column unit_price_cents,
  alter column total_amount_cents drop not null,
  alter column total_amount_cents set default 0;

-- total_amount_cents is now trigger-maintained, same shape as
-- poultryedos_purchase_orders.total_cost_cents -- every existing reader
-- that only ever selects total_amount_cents (getFinancialReport,
-- getFlockFinance) keeps working completely unchanged.
create or replace function public.poultryedos_recompute_sale_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_total bigint;
begin
  v_sale_id := coalesce(new.sale_id, old.sale_id);

  select coalesce(sum(line_total_cents), 0) into v_total
  from poultryedos_sale_items
  where sale_id = v_sale_id;

  update poultryedos_sales set total_amount_cents = v_total where id = v_sale_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.poultryedos_recompute_sale_total() from public, anon, authenticated;

create trigger poultryedos_sale_items_recompute
  after insert or update or delete on public.poultryedos_sale_items
  for each row execute function public.poultryedos_recompute_sale_total();

-- Backfill: every existing sale's header total, computed by the trigger
-- above once it fired for the inserted rows, already reflects the
-- migrated line items -- no separate backfill statement needed.

-- A sale's balance is always DERIVED (total_amount_cents minus the sum of
-- its payments), never stored -- same "derive at read time" convention as
-- biosecurityScore()/deriveSubscriptionStatus(). "credit" stays a valid
-- poultryedos_sales.payment_method value (what the client intends/agreed
-- to), but is never a payments.method value -- credit is the absence of
-- a payment, not a way of making one.
create table if not exists public.poultryedos_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  sale_id uuid not null references public.poultryedos_sales (id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  method text not null check (method in ('cash', 'mpesa', 'bank', 'other')),
  paid_at date not null default current_date,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_payments_sale_idx on public.poultryedos_payments (sale_id);
create index if not exists poultryedos_payments_tenant_idx on public.poultryedos_payments (tenant_id);

alter table public.poultryedos_sale_items enable row level security;
alter table public.poultryedos_payments enable row level security;

create policy poultryedos_sale_items_read
  on public.poultryedos_sale_items for select
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_sale_items_write
  on public.poultryedos_sale_items for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

create policy poultryedos_payments_read
  on public.poultryedos_payments for select
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_payments_write
  on public.poultryedos_payments for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

-- Atomic header + line items + an optional first payment, mirroring
-- poultryedos_create_purchase_order's "one RPC, one transaction" shape.
create or replace function public.poultryedos_create_sale(
  p_tenant_id uuid,
  p_flock_id uuid,
  p_customer_id uuid,
  p_items jsonb, -- array of {product, quantity, unit, unit_price_cents, discount_cents}
  p_amount_paid_now_cents bigint,
  p_payment_method text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one item.' using errcode = 'P0001';
  end if;

  insert into poultryedos_sales (tenant_id, flock_id, customer_id, payment_method)
  values (p_tenant_id, p_flock_id, p_customer_id, coalesce(p_payment_method, 'cash'))
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into poultryedos_sale_items (tenant_id, sale_id, product, quantity, unit, unit_price_cents, discount_cents)
    values (
      p_tenant_id,
      v_sale_id,
      v_item->>'product',
      (v_item->>'quantity')::numeric,
      coalesce(v_item->>'unit', 'piece'),
      (v_item->>'unit_price_cents')::bigint,
      coalesce((v_item->>'discount_cents')::bigint, 0)
    );
  end loop;

  if p_amount_paid_now_cents is not null and p_amount_paid_now_cents > 0 then
    insert into poultryedos_payments (tenant_id, sale_id, amount_cents, method)
    values (p_tenant_id, v_sale_id, p_amount_paid_now_cents, coalesce(nullif(p_payment_method, 'credit'), 'cash'));
  end if;

  return v_sale_id;
end;
$$;

revoke execute on function public.poultryedos_create_sale(uuid, uuid, uuid, jsonb, bigint, text) from public, anon;
grant execute on function public.poultryedos_create_sale(uuid, uuid, uuid, jsonb, bigint, text) to authenticated;

-- Records a later payment against an existing sale's balance (e.g.
-- settling a credit sale). Runs as definer only to give a friendly,
-- specific error instead of a raw constraint violation when a payment
-- would overpay the sale -- RLS on poultryedos_payments still applies via
-- the explicit membership check below, mirroring the invite-accept fix's
-- "check first, raise a specific error" discipline (migration 0027).
create or replace function public.poultryedos_record_sale_payment(
  p_sale_id uuid,
  p_amount_cents bigint,
  p_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_total bigint;
  v_paid bigint;
  v_currency text;
  v_payment_id uuid;
begin
  select s.tenant_id, s.total_amount_cents, t.currency into v_tenant_id, v_total, v_currency
  from poultryedos_sales s
  join poultryedos_tenants t on t.id = s.tenant_id
  where s.id = p_sale_id;

  if v_tenant_id is null then
    raise exception 'sale_not_found' using errcode = 'P0001';
  end if;

  if not poultryedos_is_tenant_member(v_tenant_id, array['owner','admin','farmer','field_officer']) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not poultryedos_is_subscription_active(v_tenant_id) then
    raise exception 'subscription_inactive' using errcode = 'P0001';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Payment amount must be greater than zero.' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount_cents), 0) into v_paid from poultryedos_payments where sale_id = p_sale_id;

  if v_paid + p_amount_cents > v_total then
    raise exception 'This payment would exceed the sale''s remaining balance of % %.', v_currency, to_char((v_total - v_paid) / 100.0, 'FM999999990.00')
      using errcode = 'P0001';
  end if;

  insert into poultryedos_payments (tenant_id, sale_id, amount_cents, method)
  values (v_tenant_id, p_sale_id, p_amount_cents, p_method)
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

revoke execute on function public.poultryedos_record_sale_payment(uuid, bigint, text) from public, anon;
grant execute on function public.poultryedos_record_sale_payment(uuid, bigint, text) to authenticated;
