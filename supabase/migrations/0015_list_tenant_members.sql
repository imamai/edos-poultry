-- Owner/admin need to see member emails to make sense of "who is this field
-- officer" when assigning farmers to visit. auth.users isn't exposed to
-- regular authenticated queries (correctly), so expose only what's needed,
-- scoped to people already in the caller's own tenant.

create or replace function public.poultryedos_list_tenant_members(p_tenant_id uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  status text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not poultryedos_is_tenant_member(p_tenant_id, array['owner', 'admin']) then
    raise exception 'not_authorized' using errcode = 'P0001';
  end if;

  return query
  select m.user_id, u.email::text, m.role, m.status
  from poultryedos_tenant_memberships m
  join auth.users u on u.id = m.user_id
  where m.tenant_id = p_tenant_id
  order by m.role, u.email;
end;
$$;

grant execute on function public.poultryedos_list_tenant_members(uuid) to authenticated;
revoke execute on function public.poultryedos_list_tenant_members(uuid) from public, anon;
