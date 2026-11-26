-- The invite page needs to tell "you are already friends" apart from
-- "the link expired / is used up" (before: both looked like an invalid link).
-- One call answers what the page should show:
--   'ok'      – the invite can be accepted (names = who invites)
--   'friends' – this cellar and mine are already friends (even if the link expired)
--   'own'     – it is my own cellar's link
--   'invalid' – unknown token, expired or used up
-- cellar_id is returned only for 'friends', so the page can link to their fridge.

create function public.friend_invite_status(p_token text)
returns table (status text, names text[], cellar_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mine   uuid := public.my_cellar_id();
  v_invite public.friend_invites;
begin
  if auth.uid() is null then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.friend_invites
   where token_hash = public.hash_token(coalesce(p_token, ''));
  if not found then
    return query select 'invalid'::text, null::text[], null::uuid;
    return;
  end if;
  if v_invite.cellar_id = v_mine then
    return query select 'own'::text, null::text[], null::uuid;
    return;
  end if;
  if exists (select 1 from public.friend_links
              where owner_cellar_id = v_mine and friend_cellar_id = v_invite.cellar_id) then
    return query select 'friends'::text, public.peek_cellar_names(v_invite.cellar_id), v_invite.cellar_id;
    return;
  end if;
  if v_invite.use_count >= v_invite.max_uses or v_invite.expires_at <= now() then
    return query select 'invalid'::text, null::text[], null::uuid;
    return;
  end if;
  return query select 'ok'::text, public.peek_cellar_names(v_invite.cellar_id), null::uuid;
end;
$$;

-- Display names of a cellar's members (internal helper, not callable by clients).
create function public.peek_cellar_names(p_cellar uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array(select p.display_name from public.cellar_members m join public.profiles p on p.id = m.user_id
                where m.cellar_id = p_cellar and m.role = 'member' order by m.joined_at);
$$;

revoke execute on function public.peek_cellar_names(uuid) from public, anon, authenticated;
revoke execute on function public.friend_invite_status(text) from public, anon;
grant execute on function public.friend_invite_status(text) to authenticated;
