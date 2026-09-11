-- Fix a cosmetic bug caught during live verification of migration 0030:
-- poultryedos_record_sale_payment()'s friendly over-payment error used
-- to_char(..., 'FM999999999.00'), which drops the leading zero for a
-- balance of exactly 0 -- "KES .00" instead of "KES 0.00". FM999999990.00
-- keeps the fill-mode (no padding blanks) while guaranteeing at least one
-- digit before the decimal point.

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
