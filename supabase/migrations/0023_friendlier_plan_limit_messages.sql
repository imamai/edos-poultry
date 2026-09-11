-- EDOS Poultry360: drop the internal "plan_limit_exceeded:" prefix from
-- the plan-limit trigger error messages (migration 0022). Every manager
-- component in this app surfaces a raised exception's message verbatim
-- via `setError(error.message)` with no client-side parsing of an error
-- code prefix -- so the prefix was pure leaked implementation detail with
-- no functional purpose, and would have shown a farmer text like
-- "plan_limit_exceeded: your plan allows up to 1 farmers..." instead of
-- just the readable sentence.

create or replace function public.poultryedos_check_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resource text := TG_ARGV[0];
  v_limit int;
  v_count int;
begin
  select (p.limits ->> v_resource)::int into v_limit
  from poultryedos_subscriptions s
  join poultryedos_subscription_plans p on p.id = s.plan_id
  where s.tenant_id = new.tenant_id;

  if v_limit is null then
    return new;
  end if;

  execute format('select count(*) from public.%I where tenant_id = $1', TG_TABLE_NAME)
    into v_count
    using new.tenant_id;

  if v_count >= v_limit then
    raise exception 'Your plan allows up to % %. Upgrade your plan to add more.', v_limit, v_resource
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.poultryedos_check_plan_limit() from public, anon, authenticated;

create or replace function public.poultryedos_check_membership_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits jsonb;
  v_users_limit int;
  v_fo_limit int;
  v_count int;
begin
  select p.limits into v_limits
  from poultryedos_subscriptions s
  join poultryedos_subscription_plans p on p.id = s.plan_id
  where s.tenant_id = new.tenant_id;

  if v_limits is null then
    return new;
  end if;

  v_users_limit := (v_limits ->> 'users')::int;
  if v_users_limit is not null then
    select count(*) into v_count from poultryedos_tenant_memberships
      where tenant_id = new.tenant_id and status = 'active';
    if v_count >= v_users_limit then
      raise exception 'Your plan allows up to % team member(s). Upgrade your plan to add more.', v_users_limit
        using errcode = 'P0001';
    end if;
  end if;

  if new.role = 'field_officer' then
    v_fo_limit := (v_limits ->> 'field_officers')::int;
    if v_fo_limit is not null then
      select count(*) into v_count from poultryedos_tenant_memberships
        where tenant_id = new.tenant_id and status = 'active' and role = 'field_officer';
      if v_count >= v_fo_limit then
        raise exception 'Your plan allows up to % field officer(s). Upgrade your plan to add more.', v_fo_limit
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.poultryedos_check_membership_limits() from public, anon, authenticated;
