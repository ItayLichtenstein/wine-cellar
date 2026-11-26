-- A friend invite can be sent to a group: it now works for up to 10 cellars
-- (was: once) and still expires after 7 days. used_at = the last use.

alter table public.friend_invites
  add column max_uses  int not null default 10 check (max_uses between 1 and 50),
  add column use_count int not null default 0 check (use_count >= 0);

-- Invites already used stay used up (they were sent as one-time links).
update public.friend_invites set max_uses = 1, use_count = 1 where used_at is not null;

create or replace function public.peek_friend_invite(p_token text)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(select p.display_name from public.cellar_members m join public.profiles p on p.id = m.user_id
                where m.cellar_id = i.cellar_id and m.role = 'member' order by m.joined_at)
    from public.friend_invites i
   where i.token_hash = public.hash_token(coalesce(p_token, ''))
     and i.use_count < i.max_uses and i.expires_at > now()
     and auth.uid() is not null;
$$;

create or replace function public.accept_friend_invite(p_token text, p_shows_prices boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mine   uuid := public.my_cellar_id();
  v_invite public.friend_invites;
begin
  if v_mine is null or not public.is_cellar_editor(v_mine) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  -- for update: two friends accepting at the same moment cannot both take the last use.
  select * into v_invite from public.friend_invites
   where token_hash = public.hash_token(coalesce(p_token, ''))
     and use_count < max_uses and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid invite' using errcode = 'no_data_found';
  end if;
  if v_invite.cellar_id = v_mine then
    raise exception 'own cellar' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.friend_links where owner_cellar_id = v_mine and friend_cellar_id = v_invite.cellar_id) then
    raise exception 'already friends' using errcode = 'unique_violation';
  end if;

  update public.friend_invites set use_count = use_count + 1, used_at = now() where id = v_invite.id;
  insert into public.friend_links (owner_cellar_id, friend_cellar_id, shows_prices) values
    (v_invite.cellar_id, v_mine, v_invite.shows_prices),
    (v_mine, v_invite.cellar_id, p_shows_prices);
  return v_invite.cellar_id;
end;
$$;
