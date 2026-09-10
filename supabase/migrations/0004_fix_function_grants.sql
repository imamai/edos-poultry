-- Postgres grants EXECUTE to the PUBLIC pseudo-role by default on every new
-- function (which includes anon, regardless of any explicit per-role grant
-- state) -- this is a different mechanism from the appointment-booking-
-- system's edos_db discovery (there, default privileges granted directly to
-- named roles). Revoke the PUBLIC-level grant explicitly for the two
-- authenticated-only RPCs.

revoke execute on function public.poultryedos_is_tenant_member(uuid, text[]) from public;
grant execute on function public.poultryedos_is_tenant_member(uuid, text[]) to authenticated;

revoke execute on function public.poultryedos_create_tenant(text, text, text, text) from public;
grant execute on function public.poultryedos_create_tenant(text, text, text, text) to authenticated;

revoke execute on function public.poultryedos_set_updated_at() from public;
revoke execute on function public.poultryedos_recompute_flock_quantity() from public;
