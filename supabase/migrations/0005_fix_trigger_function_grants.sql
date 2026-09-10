-- The two trigger-only functions still showed an explicit anon grant after
-- the PUBLIC-level revoke in 0004 (a direct per-role grant, same mechanism
-- seen in the booking system project) -- belt-and-suspenders revoke from
-- every non-privileged grantee. Trigger functions don't need EXECUTE
-- granted to any calling role to fire as part of a DML statement, so this
-- is safe.

revoke execute on function public.poultryedos_set_updated_at() from public, anon, authenticated;
revoke execute on function public.poultryedos_recompute_flock_quantity() from public, anon, authenticated;
