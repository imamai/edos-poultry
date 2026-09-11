-- EDOS Poultry360 Phase 7: M-Pesa payment transaction log (spec §44).
--
-- SCOPE NOTE: this table and its policies assume the architecture in
-- src/lib/payments/mpesa.ts — a real Daraja STK-push request/response
-- shape, gated entirely behind MPESA_* env vars that are unset in this
-- environment (no sandbox credentials available here). Rows are written
-- from two places with very different trust levels:
--   1. POST /api/mpesa/stk-push — an authenticated owner/admin initiating
--      a payment. Runs as that user, so normal RLS applies (insert policy
--      below).
--   2. POST /api/mpesa/callback — Safaricom's server calling back with no
--      Supabase session at all. This route uses a service-role admin
--      client (src/lib/supabase/admin.ts) that bypasses RLS entirely, and
--      is the only place allowed to transition a transaction to
--      success/failed. There is deliberately no RLS policy that would let
--      an authenticated *user* mark their own transaction "success" —
--      that must only ever happen from a verified callback.

create table if not exists public.poultryedos_mpesa_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  subscription_id uuid references public.poultryedos_subscriptions (id) on delete set null,
  phone text not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'initiated' check (status in ('initiated', 'pending', 'success', 'failed', 'cancelled')),
  checkout_request_id text unique,
  merchant_request_id text,
  mpesa_receipt_number text,
  result_desc text,
  initiated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists poultryedos_mpesa_transactions_tenant_idx
  on public.poultryedos_mpesa_transactions (tenant_id, created_at desc);

create trigger poultryedos_mpesa_transactions_set_updated_at
  before update on public.poultryedos_mpesa_transactions
  for each row execute function public.poultryedos_set_updated_at();

alter table public.poultryedos_mpesa_transactions enable row level security;

create policy poultryedos_mpesa_transactions_read
  on public.poultryedos_mpesa_transactions for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

create policy poultryedos_mpesa_transactions_insert
  on public.poultryedos_mpesa_transactions for insert
  to authenticated
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

-- No update/delete policy for the authenticated role on purpose — only the
-- service-role callback route (which bypasses RLS) transitions status.
