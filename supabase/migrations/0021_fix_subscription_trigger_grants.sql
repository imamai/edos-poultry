-- EDOS Poultry360: lock down poultryedos_create_trial_subscription()'s
-- function grants, the same fix already applied to every other trigger
-- function in this schema (see 0004/0005/0011). Postgres grants EXECUTE to
-- PUBLIC (which includes anon) on every new function by default; a
-- SECURITY DEFINER trigger function should never be callable directly as
-- an RPC (`/rest/v1/rpc/poultryedos_create_trial_subscription`) — only the
-- AFTER INSERT trigger on poultryedos_tenants should ever invoke it, and
-- trigger invocation does not require an EXECUTE grant. Caught by
-- Supabase's own security advisor after 0017 was applied.

revoke execute on function public.poultryedos_create_trial_subscription() from public, anon, authenticated;
