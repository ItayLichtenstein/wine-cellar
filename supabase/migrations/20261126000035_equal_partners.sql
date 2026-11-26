-- Every cellar partner has the same rights (26 Nov 2026, product decision):
-- no more "viewer" partners. Someone who should only look gets a friend
-- link or a view link instead.
--
-- The enum value 'viewer' stays (Postgres can't drop an enum value without
-- rebuilding the type), and the RLS rules that check for 'member' stay too,
-- as defense in depth. But nothing in the app can create a viewer any more.

update public.cellar_members set role = 'member' where role = 'viewer';
update public.cellar_invites set role = 'member' where role = 'viewer';

drop function public.set_member_role(uuid, public.member_role);

-- Invites no longer take a role: a new partner is always a full member.
drop function public.create_invite(public.member_role);

create function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
  v_token  text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  insert into public.cellar_invites (cellar_id, token_hash, role, created_by)
  values (v_cellar, public.hash_token(v_token), 'member', auth.uid());
  return v_token; -- shown once, never stored
end;
$$;

revoke execute on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;

-- Replaced by friend_invite_status (migration 34).
drop function public.peek_friend_invite(text);
