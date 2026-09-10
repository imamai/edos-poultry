-- Performance advisor: poultryedos_memberships_self_read re-evaluated
-- auth.uid() per row instead of once per query. Wrap it in a subselect so
-- Postgres can cache it (standard Supabase RLS performance guidance).

drop policy if exists poultryedos_memberships_self_read on public.poultryedos_tenant_memberships;

create policy poultryedos_memberships_self_read
  on public.poultryedos_tenant_memberships for select
  to authenticated
  using (user_id = (select auth.uid()) or public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));
