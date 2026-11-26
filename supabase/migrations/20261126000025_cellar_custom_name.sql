-- =====================================================================
-- A cellar may have its own name (spec: the title comes from the members'
-- names, "and can be changed"). custom_name null = the automatic title,
-- built in the app from the full members' names ("המרתף של נועה ויונתן").
-- Editors change it (the existing "cellars: editors update" policy).
-- Friends and share-link guests read it through two small functions, so
-- the bigger my_friends() / shared_cellar() stay as they are.
-- =====================================================================

alter table public.cellars
  add column custom_name text check (custom_name is null or char_length(trim(custom_name)) between 1 and 60);

-- Custom names of my friend cellars (only those that have one).
create function public.friend_cellar_names()
returns table (cellar_id uuid, custom_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.custom_name
    from public.friend_links fl
    join public.cellars c on c.id = fl.friend_cellar_id
   where fl.owner_cellar_id = public.my_cellar_id() and c.custom_name is not null;
$$;

-- The custom name behind a live share link (null if none, or no such link).
create function public.shared_cellar_name(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.custom_name
    from public.share_links l
    join public.cellars c on c.id = l.cellar_id
   where l.token_hash = public.hash_token(coalesce(p_token, '')) and l.revoked_at is null;
$$;

revoke execute on function public.friend_cellar_names() from public, anon;
grant execute on function public.friend_cellar_names() to authenticated;
revoke execute on function public.shared_cellar_name(text) from public;
grant execute on function public.shared_cellar_name(text) to anon, authenticated;
