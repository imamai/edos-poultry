-- Every poultryedos_sales row that predates the payments ledger (migration
-- 0030) has zero payment rows, so poultryedos_record_sale_payment's
-- derived balance would show them as fully unpaid ("Invoice, balance due
-- in full") even though a non-credit payment_method meant the money
-- already changed hands at the time of the sale under the old schema's
-- implicit assumption. Backfill exactly one payment per pre-existing
-- sale whose payment_method isn't 'credit', dated at the sale's own
-- sale_date, so existing real sales correctly show as paid receipts
-- rather than appearing to newly owe money they were already paid for.
-- A pre-existing 'credit' sale is left with no payment row, correctly
-- still showing a full balance due -- that was never paid before, and
-- nothing about this migration changes that.

insert into poultryedos_payments (tenant_id, sale_id, amount_cents, method, paid_at)
select tenant_id, id, total_amount_cents, payment_method, sale_date
from poultryedos_sales
where payment_method <> 'credit'
  and not exists (select 1 from poultryedos_payments where sale_id = poultryedos_sales.id);
