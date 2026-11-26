-- =====================================================================
-- Deleting my account (spec: "מחיקת חשבון"; promised on the privacy page).
--
-- What happens depends on who else is in the cellar:
--   alone                       -> the whole cellar goes too (fridges, wines,
--                                  bottles, history, wishlist, friends, links).
--   other full members          -> the cellar stays with them; only my own
--                                  things go (profile, membership, my
--                                  personal ratings). Shared data stays.
--   I am the only full member,
--   and viewers remain          -> refused: a cellar needs a full member.
--                                  Promote someone, or remove the viewers.
-- Label photos in storage are removed by the app before this runs (the
-- storage API deletes the files themselves, not just their rows).
-- AI clients can never call this: the OAuth pre-request hook allows them
-- no writes, and the function checks the claim again.
-- =====================================================================

create function public.account_deletion_plan()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then 'not_signed_in'
    when (select count(*) from public.cellar_members where cellar_id = public.my_cellar_id()) = 1 then 'delete_cellar'
    when exists (select 1 from public.cellar_members
                  where cellar_id = public.my_cellar_id() and user_id = auth.uid() and role = 'member')
     and not exists (select 1 from public.cellar_members
                      where cellar_id = public.my_cellar_id() and user_id <> auth.uid() and role = 'member')
      then 'last_member'
    else 'leave'
  end;
$$;

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_cellar uuid := public.my_cellar_id();
  v_plan   text := public.account_deletion_plan();
begin
  if nullif(current_setting('request.jwt.claims', true), '')::jsonb ? 'client_id' then
    raise exception 'AI clients cannot delete accounts' using errcode = 'insufficient_privilege', hint = 'oauth_read_only';
  end if;
  if v_user is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if v_plan = 'last_member' then
    raise exception 'promote another member first' using errcode = 'check_violation', hint = 'last_member';
  end if;
  if v_plan = 'delete_cellar' then
    delete from public.cellars where id = v_cellar;
  end if;
  -- Cascades: profile -> membership, personal ratings; set null on
  -- created_by / used_by columns elsewhere.
  delete from auth.users where id = v_user;
end;
$$;

revoke execute on function public.account_deletion_plan() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.account_deletion_plan() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
