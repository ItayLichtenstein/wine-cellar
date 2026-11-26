-- =====================================================================
-- App admin (spec: "עמוד ניהול", ADR 0011).
--
-- Principle: the admin sees COUNTS, never contents. No bottle, note,
-- price, photo or email of another cellar is readable through any of
-- this. The admin can ban, unban, sign out and delete a user, and make
-- another admin. Every such action is written to admin_actions.
--
-- Who is an admin: a row in app_admins. The table has RLS on and no
-- policies, so nobody can read or change it through the API; only these
-- SECURITY DEFINER functions look at it. Adding the first admin is done
-- once, in SQL, by the owner.
--
-- AI clients (an OAuth token has a client_id claim) are never admins,
-- even when acting for the owner.
-- =====================================================================

create table public.app_admins (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  added_at  timestamptz not null default now()
);
alter table public.app_admins enable row level security;
-- No policies on purpose: invisible to the API.

create table public.admin_actions (
  id           bigint generated always as identity primary key,
  admin_id     uuid references auth.users (id) on delete set null,
  action       text not null check (action in ('ban', 'unban', 'sign_out', 'delete_user', 'add_admin', 'remove_admin')),
  target_user  uuid,             -- no foreign key: the log outlives a deleted user
  target_name  text check (char_length(target_name) <= 120),
  reason       text check (char_length(reason) <= 300),
  created_at   timestamptz not null default now()
);
alter table public.admin_actions enable row level security;

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ? 'client_id', false)
     and exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create policy "admins read the action log" on public.admin_actions
  for select to authenticated using ((select public.is_app_admin()));

-- Raises unless the caller is an admin. Every admin function starts with it.
create function public.require_app_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'admins only' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Last time a user did anything: a sign-in or a session refresh.
create function public.user_last_active(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    (select last_sign_in_at from auth.users where id = p_user),
    (select max(coalesce(refreshed_at, updated_at)) from auth.sessions where user_id = p_user)
  );
$$;

-- ---------- Overview: numbers only ----------
create function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.require_app_admin();
  select jsonb_build_object(
    'users',          (select count(*) from auth.users),
    'new_7d',         (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'new_30d',        (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'active_7d',      (select count(*) from auth.users u where public.user_last_active(u.id) > now() - interval '7 days'),
    'active_30d',     (select count(*) from auth.users u where public.user_last_active(u.id) > now() - interval '30 days'),
    'banned',         (select count(*) from auth.users where banned_until > now()),
    'cellars',        (select count(*) from public.cellars),
    'shared_cellars', (select count(*) from (select cellar_id from public.cellar_members group by cellar_id having count(*) > 1) s),
    'bottles',        (select count(*) from public.bottles where status <> 'consumed'),
    'consumed',       (select count(*) from public.bottles where status = 'consumed'),
    'wines',          (select count(*) from public.wines),
    'fridges',        (select count(*) from public.fridges),
    'friendships',    (select count(*) from public.friend_links) / 2,
    'share_links',    (select count(*) from public.share_links where revoked_at is null),
    'imports_30d',    (select count(*) from public.imports where created_at > now() - interval '30 days' and undone_at is null),
    'ai_connections', (select count(*) from auth.oauth_consents where revoked_at is null),
    'label_files',    (select count(*) from storage.objects where bucket_id = 'labels'),
    'label_bytes',    (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects where bucket_id = 'labels'),
    -- Folders of cellars that no longer exist (left behind when an admin
    -- deletes a user: SQL cannot delete the files themselves).
    'orphan_files',   (select count(*) from storage.objects o
                        where o.bucket_id = 'labels'
                          and not exists (select 1 from public.cellars c where c.id::text = (storage.foldername(o.name))[1])),
    'db_bytes',       pg_database_size(current_database())
  ) into v;
  return v;
end;
$$;

-- ---------- Users: who, when, how much. No email, no contents ----------
create function public.admin_users()
returns table (
  user_id      uuid,
  display_name text,
  created_at   timestamptz,
  last_active  timestamptz,
  cellar_name  text,
  members      int,
  bottles      int,
  banned       boolean,
  is_admin     boolean,
  is_me        boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_app_admin();
  return query
    select u.id,
           coalesce(p.display_name, '—'),
           u.created_at,
           public.user_last_active(u.id),
           c.name,
           (select count(*)::int from public.cellar_members m2 where m2.cellar_id = m.cellar_id),
           (select count(*)::int from public.bottles b where b.cellar_id = m.cellar_id and b.status <> 'consumed'),
           coalesce(u.banned_until > now(), false),
           exists (select 1 from public.app_admins a where a.user_id = u.id),
           u.id = auth.uid()
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.cellar_members m on m.user_id = u.id
      left join public.cellars c on c.id = m.cellar_id
     order by public.user_last_active(u.id) desc nulls last;
end;
$$;

create function public.admin_log(p_action text, p_user uuid, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_actions (admin_id, action, target_user, target_name, reason)
  values (auth.uid(), p_action, p_user,
          (select display_name from public.profiles where id = p_user),
          nullif(btrim(p_reason), ''));
$$;

-- ---------- Actions ----------
-- Ban: no new sign-ins, and every session ends now (an access token that
-- was already issued stays valid until it expires, up to an hour).
create function public.admin_set_ban(p_user uuid, p_ban boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_app_admin();
  if p_user = auth.uid() then
    raise exception 'cannot ban yourself' using errcode = 'check_violation', hint = 'self';
  end if;
  update auth.users
     set banned_until = case when p_ban then now() + interval '100 years' else null end
   where id = p_user;
  if not found then
    raise exception 'no such user' using errcode = 'no_data_found';
  end if;
  if p_ban then
    delete from auth.sessions where user_id = p_user;
  end if;
  perform public.admin_log(case when p_ban then 'ban' else 'unban' end, p_user, p_reason);
end;
$$;

-- Sign out everywhere (for example after a lost phone), without a ban.
create function public.admin_sign_out(p_user uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_app_admin();
  delete from auth.sessions where user_id = p_user;
  perform public.admin_log('sign_out', p_user, p_reason);
end;
$$;

-- Delete a user, like delete_my_account: alone in the cellar -> the cellar
-- goes too; with partners -> the cellar stays with them.
create function public.admin_delete_user(p_user uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid;
begin
  perform public.require_app_admin();
  if p_user = auth.uid() then
    raise exception 'delete your own account from settings' using errcode = 'check_violation', hint = 'self';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'no such user' using errcode = 'no_data_found';
  end if;
  perform public.admin_log('delete_user', p_user, p_reason);
  select cellar_id into v_cellar from public.cellar_members where user_id = p_user;
  if v_cellar is not null and (select count(*) from public.cellar_members where cellar_id = v_cellar) = 1 then
    delete from public.cellars where id = v_cellar;
  end if;
  delete from auth.users where id = p_user;
end;
$$;

create function public.admin_set_admin(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_app_admin();
  if p_on then
    insert into public.app_admins (user_id) values (p_user) on conflict do nothing;
  else
    if p_user = auth.uid() then
      raise exception 'cannot remove yourself' using errcode = 'check_violation', hint = 'self';
    end if;
    delete from public.app_admins where user_id = p_user;
  end if;
  perform public.admin_log(case when p_on then 'add_admin' else 'remove_admin' end, p_user, null);
end;
$$;

-- ---------- Grants ----------
revoke execute on function public.is_app_admin() from public, anon;
revoke execute on function public.require_app_admin() from public, anon, authenticated;
revoke execute on function public.user_last_active(uuid) from public, anon, authenticated;
revoke execute on function public.admin_log(text, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_overview() from public, anon;
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.admin_set_ban(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_sign_out(uuid, text) from public, anon;
revoke execute on function public.admin_delete_user(uuid, text) from public, anon;
revoke execute on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_users() to authenticated;
grant execute on function public.admin_set_ban(uuid, boolean, text) to authenticated;
grant execute on function public.admin_sign_out(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid, text) to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
