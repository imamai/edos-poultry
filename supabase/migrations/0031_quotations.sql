-- EDOS Poultry360: quotations -- a pre-sale offer to a client (existing
-- customer or a prospect not yet saved as one) that can later become a
-- real sale. Same multi-line shape as poultryedos_sale_items (0030) and
-- poultryedos_purchase_order_items (0024), so a quotation and an invoice
-- look and behave the same way to the person filling them in.

create table if not exists public.poultryedos_quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farm_id uuid not null references public.poultryedos_farms (id) on delete cascade,
  customer_id uuid references public.poultryedos_customers (id) on delete set null,
  -- A prospect who isn't (yet) a saved customer -- a quotation shouldn't
  -- force creating a full customer record just to try pricing something.
  prospect_name text,
  prospect_phone text,
  valid_until date,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined', 'expired', 'converted')),
  notes text,
  total_amount_cents bigint not null default 0,
  converted_sale_id uuid references public.poultryedos_sales (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.poultryedos_quotation_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  quotation_id uuid not null references public.poultryedos_quotations (id) on delete cascade,
  product text not null check (product in (
    'eggs', 'live_birds', 'processed_birds', 'spent_layers', 'chicks', 'manure', 'other'
  )),
  quantity numeric(10, 2) not null check (quantity > 0),
  unit text not null default 'piece',
  unit_price_cents bigint not null check (unit_price_cents >= 0),
  discount_cents bigint not null default 0 check (discount_cents >= 0),
  line_total_cents bigint generated always as (round(quantity * unit_price_cents)::bigint - discount_cents) stored,
  created_at timestamptz not null default now()
);

create index if not exists poultryedos_quotations_tenant_idx on public.poultryedos_quotations (tenant_id);
create index if not exists poultryedos_quotation_items_quotation_idx on public.poultryedos_quotation_items (quotation_id);
create index if not exists poultryedos_quotation_items_tenant_idx on public.poultryedos_quotation_items (tenant_id);

create or replace function public.poultryedos_recompute_quotation_total()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_quotation_id uuid;
  v_total bigint;
begin
  v_quotation_id := coalesce(new.quotation_id, old.quotation_id);

  select coalesce(sum(line_total_cents), 0) into v_total
  from poultryedos_quotation_items
  where quotation_id = v_quotation_id;

  update poultryedos_quotations set total_amount_cents = v_total where id = v_quotation_id;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.poultryedos_recompute_quotation_total() from public, anon, authenticated;

create trigger poultryedos_quotation_items_recompute
  after insert or update or delete on public.poultryedos_quotation_items
  for each row execute function public.poultryedos_recompute_quotation_total();

alter table public.poultryedos_quotations enable row level security;
alter table public.poultryedos_quotation_items enable row level security;

create policy poultryedos_quotations_read
  on public.poultryedos_quotations for select
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_quotations_write
  on public.poultryedos_quotations for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

create policy poultryedos_quotation_items_read
  on public.poultryedos_quotation_items for select
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, null));

create policy poultryedos_quotation_items_write
  on public.poultryedos_quotation_items for all
  to authenticated
  using (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id))
  with check (poultryedos_is_tenant_member(tenant_id, array['owner','admin','farmer','field_officer']) and poultryedos_is_subscription_active(tenant_id));

create or replace function public.poultryedos_create_quotation(
  p_tenant_id uuid,
  p_farm_id uuid,
  p_customer_id uuid,
  p_prospect_name text,
  p_prospect_phone text,
  p_valid_until date,
  p_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_quotation_id uuid;
  v_item jsonb;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'A quotation needs at least one item.' using errcode = 'P0001';
  end if;

  insert into poultryedos_quotations (tenant_id, farm_id, customer_id, prospect_name, prospect_phone, valid_until)
  values (p_tenant_id, p_farm_id, p_customer_id, p_prospect_name, p_prospect_phone, p_valid_until)
  returning id into v_quotation_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into poultryedos_quotation_items (tenant_id, quotation_id, product, quantity, unit, unit_price_cents, discount_cents)
    values (
      p_tenant_id,
      v_quotation_id,
      v_item->>'product',
      (v_item->>'quantity')::numeric,
      coalesce(v_item->>'unit', 'piece'),
      (v_item->>'unit_price_cents')::bigint,
      coalesce((v_item->>'discount_cents')::bigint, 0)
    );
  end loop;

  return v_quotation_id;
end;
$$;

revoke execute on function public.poultryedos_create_quotation(uuid, uuid, uuid, text, text, date, jsonb) from public, anon;
grant execute on function public.poultryedos_create_quotation(uuid, uuid, uuid, text, text, date, jsonb) to authenticated;

-- Turns an accepted quotation into a real sale, copying its items across
-- rather than making the user retype them. security definer purely to
-- give specific, friendly errors for the two states that must not
-- convert (already converted / declined or expired) instead of leaving
-- that check to be skipped or half-enforced client-side.
create or replace function public.poultryedos_convert_quotation_to_sale(
  p_quotation_id uuid,
  p_flock_id uuid,
  p_amount_paid_now_cents bigint,
  p_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quotation poultryedos_quotations%rowtype;
  v_sale_id uuid;
begin
  select * into v_quotation from poultryedos_quotations where id = p_quotation_id;

  if v_quotation.id is null then
    raise exception 'quotation_not_found' using errcode = 'P0001';
  end if;
  if not poultryedos_is_tenant_member(v_quotation.tenant_id, array['owner','admin','farmer','field_officer']) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not poultryedos_is_subscription_active(v_quotation.tenant_id) then
    raise exception 'subscription_inactive' using errcode = 'P0001';
  end if;
  if v_quotation.status = 'converted' then
    raise exception 'This quotation has already been converted to a sale.' using errcode = 'P0001';
  end if;
  if v_quotation.status in ('declined', 'expired') then
    raise exception 'A % quotation can''t be converted to a sale.', v_quotation.status using errcode = 'P0001';
  end if;

  insert into poultryedos_sales (tenant_id, flock_id, customer_id, payment_method)
  values (v_quotation.tenant_id, p_flock_id, v_quotation.customer_id, coalesce(p_payment_method, 'cash'))
  returning id into v_sale_id;

  insert into poultryedos_sale_items (tenant_id, sale_id, product, quantity, unit, unit_price_cents, discount_cents)
  select v_quotation.tenant_id, v_sale_id, product, quantity, unit, unit_price_cents, discount_cents
  from poultryedos_quotation_items
  where quotation_id = p_quotation_id;

  if p_amount_paid_now_cents is not null and p_amount_paid_now_cents > 0 then
    insert into poultryedos_payments (tenant_id, sale_id, amount_cents, method)
    values (v_quotation.tenant_id, v_sale_id, p_amount_paid_now_cents, coalesce(nullif(p_payment_method, 'credit'), 'cash'));
  end if;

  update poultryedos_quotations set status = 'converted', converted_sale_id = v_sale_id where id = p_quotation_id;

  return v_sale_id;
end;
$$;

revoke execute on function public.poultryedos_convert_quotation_to_sale(uuid, uuid, bigint, text) from public, anon;
grant execute on function public.poultryedos_convert_quotation_to_sale(uuid, uuid, bigint, text) to authenticated;
