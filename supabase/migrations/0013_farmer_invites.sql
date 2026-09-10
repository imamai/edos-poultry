-- EDOS Poultry360 Phase 6: attaching additional farmers to a tenant
-- (cooperative/network mode), and inviting them to claim their own login.
--
-- DESIGN NOTE on "who is the main farmer": we deliberately do NOT add an
-- is_primary flag to poultryedos_farmers. For an individual smallholder
-- tenant, "the main farmer" already just means "whoever holds the owner
-- role" (poultryedos_tenant_memberships), which is true today. For a
-- cooperative/network tenant with many farmers, there ISN'T a "main
-- farmer" in reality -- there's an admin/owner (an operator, not
-- necessarily a farmer themselves) and a set of equal member farmers,
-- optionally visited by field officers. Modeling a fake hierarchy among
-- farmers would misrepresent how cooperatives actually work.

create table if not exists public.poultryedos_farmer_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.poultryedos_tenants (id) on delete cascade,
  farmer_id uuid not null references public.poultryedos_farmers (id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days')
);

create unique index if not exists poultryedos_farmer_invites_token_idx
  on public.poultryedos_farmer_invites (token);
create index if not exists poultryedos_farmer_invites_tenant_idx
  on public.poultryedos_farmer_invites (tenant_id, status);

alter table public.poultryedos_farmer_invites enable row level security;

-- Only owner/admin can see or create invites for their tenant. Note there
-- is deliberately NO public/anon select policy here -- an invite is looked
-- up only via the poultryedos_view_invite / accept RPCs below (SECURITY
-- DEFINER), the same pattern as the booking system's manage_token, so an
-- unauthenticated visitor never gets a raw row, only what the RPC chooses
-- to expose.
create policy poultryedos_farmer_invites_member_read
  on public.poultryedos_farmer_invites for select
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

create policy poultryedos_farmer_invites_member_write
  on public.poultryedos_farmer_invites for all
  to authenticated
  using (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']))
  with check (public.poultryedos_is_tenant_member(tenant_id, array['owner', 'admin']));

-- Look up an invite by token without needing to already be a tenant member
-- (the whole point -- the invitee isn't one yet). Returns only what's safe
-- to show on an "accept invite" screen.
create or replace function public.poultryedos_view_invite(p_token uuid)
returns table (
  invite_id uuid,
  status text,
  farmer_name text,
  tenant_name text,
  email text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  return query
  select i.id, i.status, f.full_name, t.name, i.email
  from poultryedos_farmer_invites i
  join poultryedos_farmers f on f.id = i.farmer_id
  join poultryedos_tenants t on t.id = i.tenant_id
  where i.token = p_token
    and i.expires_at > now();
end;
$$;

grant execute on function public.poultryedos_view_invite(uuid) to anon, authenticated;
revoke execute on function public.poultryedos_view_invite(uuid) from public;

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

grant execute on function public.poultryedos_accept_farmer_invite(uuid) to authenticated;
revoke execute on function public.poultryedos_accept_farmer_invite(uuid) from public, anon;
