-- EDOS Poultry360: poultryedos_accept_farmer_invite() let a real Postgres
-- constraint-violation message ("duplicate key value violates unique
-- constraint poultryedos_farmers_user_idx") leak straight to the farmer
-- accepting an invite, instead of a readable error.
--
-- Reproduced live: a real user who is already a farmer in a tenant
-- (poultryedos_farmers_user_idx enforces one farmer profile per user per
-- tenant, migration 0002) opened an invite link meant for a *different*
-- farmer profile in the same tenant while still logged in as themselves.
-- The function's own "already claimed" check only covers the invite's
-- target row already having a user_id — it never checked whether the
-- accepting user themselves already holds a different farmer row in that
-- tenant, so the UPDATE fell through to the bare unique-index violation.

create or replace function public.poultryedos_accept_farmer_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select * into v_invite from poultryedos_farmer_invites
    where token = p_token and status = 'pending' and expires_at > now();
  if not found then
    raise exception 'invite_not_found_or_expired' using errcode = 'P0001';
  end if;

  -- The accepting account may already be a *different* farmer in this
  -- same tenant (e.g. the tenant owner testing/opening the link while
  -- still logged in as themselves) -- poultryedos_farmers_user_idx would
  -- reject that combination outright, so check it explicitly first and
  -- give a message that actually explains what to do.
  if exists (
    select 1 from poultryedos_farmers
    where tenant_id = v_invite.tenant_id
      and user_id = auth.uid()
      and id <> v_invite.farmer_id
  ) then
    raise exception 'already_a_farmer_in_tenant' using errcode = 'P0001';
  end if;

  -- never let an invite hijack a farmer record that's already claimed
  update poultryedos_farmers
    set user_id = auth.uid()
    where id = v_invite.farmer_id and user_id is null;
  if not found then
    raise exception 'farmer_already_claimed' using errcode = 'P0001';
  end if;

  insert into poultryedos_tenant_memberships (tenant_id, user_id, role, status)
  values (v_invite.tenant_id, auth.uid(), 'farmer', 'active')
  on conflict (tenant_id, user_id) do nothing;

  update poultryedos_farmer_invites
    set status = 'accepted', accepted_at = now()
    where id = v_invite.id;

  return v_invite.tenant_id;
end;
$$;
