-- =====================================================================
-- Household: invite links, joining, leaving, members and roles (stage 2).
--
-- Invite link security (docs/security.md):
-- - The token is 32 random bytes; only its SHA-256 hash is stored, so a
--   leaked table (or backup) cannot be used to join anyone's cellar.
-- - One use, 7 days. Accepting requires a signed-in user.
-- - accept_invite gives the same error for unknown / used / expired
--   tokens, so it cannot be used to probe which tokens exist.
--
-- Joining: an empty cellar (no bottles, no history) is dropped and the user
-- joins. A cellar with data is refused for now (hint 'has_data'); moving
-- those bottles into the shared cellar comes next.
-- Leaving / being removed: the data stays in the cellar; the user gets a
-- new, empty cellar. A cellar always keeps at least one full member.
-- =====================================================================

create table public.cellar_invites (
  id          uuid primary key default gen_random_uuid(),
  cellar_id   uuid not null references public.cellars (id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role        public.member_role not null default 'member',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  used_at     timestamptz,
  used_by     uuid references public.profiles (id) on delete set null
);

alter table public.cellar_invites enable row level security;

-- Members see their cellar's invites (to show and revoke open links).
-- The hash is useless without the token, but stays inside the household.
create policy "invites: members read"
  on public.cellar_invites for select to authenticated
  using (public.is_cellar_member(cellar_id));
create policy "invites: editors revoke"
  on public.cellar_invites for delete to authenticated
  using (public.is_cellar_editor(cellar_id));
-- No insert/update policies: invites are created and used only through
-- the functions below.

-- ---------- helpers ----------

create function public.hash_token(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$ select encode(extensions.digest(p_token, 'sha256'), 'hex') $$;

-- A fresh empty cellar for a user who left (or was removed).
create function public.give_new_cellar(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid;
begin
  insert into public.cellars (name)
  values ('המרתף של ' || (select display_name from public.profiles where id = p_user_id))
  returning id into v_cellar;
  insert into public.cellar_members (cellar_id, user_id, role) values (v_cellar, p_user_id, 'member');
  return v_cellar;
end;
$$;
revoke execute on function public.give_new_cellar(uuid) from public, anon, authenticated;

-- ---------- create / accept ----------

create function public.create_invite(p_role public.member_role default 'member')
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
  values (v_cellar, public.hash_token(v_token), p_role, auth.uid());
  return v_token; -- shown once, never stored
end;
$$;

create function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_invite public.cellar_invites;
  v_old    uuid;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;

  select * into v_invite from public.cellar_invites
   where token_hash = public.hash_token(coalesce(p_token, ''))
     and used_at is null and expires_at > now()
   for update;
  if not found then
    raise exception 'invalid invite' using errcode = 'no_data_found';
  end if;

  v_old := public.my_cellar_id();
  if v_old = v_invite.cellar_id then
    raise exception 'already a member' using errcode = 'unique_violation';
  end if;

  if (select count(*) from public.cellar_members where cellar_id = v_old) = 1 then
    -- Alone in the old cellar: it is dropped, so it must be empty.
    if exists (select 1 from public.bottles where cellar_id = v_old)
       or exists (select 1 from public.tastings where cellar_id = v_old) then
      raise exception 'your cellar has data' using errcode = 'check_violation', hint = 'has_data';
    end if;
    delete from public.cellar_members where user_id = v_user;
    delete from public.cellars where id = v_old;
  else
    -- Others stay in the old cellar (with its data); keep a full member there.
    if not exists (select 1 from public.cellar_members
                    where cellar_id = v_old and user_id <> v_user and role = 'member') then
      raise exception 'the old cellar needs another member first' using errcode = 'check_violation', hint = 'last_member';
    end if;
    delete from public.cellar_members where user_id = v_user;
  end if;

  insert into public.cellar_members (cellar_id, user_id, role) values (v_invite.cellar_id, v_user, v_invite.role);
  update public.cellar_invites set used_at = now(), used_by = v_user where id = v_invite.id;
  return v_invite.cellar_id;
end;
$$;

-- ---------- leave / remove / role ----------

create function public.leave_cellar()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_cellar uuid := public.my_cellar_id();
begin
  if v_cellar is null then
    raise exception 'not signed in' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.cellar_members where cellar_id = v_cellar) = 1 then
    raise exception 'you are the only member' using errcode = 'check_violation', hint = 'alone';
  end if;
  if not exists (select 1 from public.cellar_members
                  where cellar_id = v_cellar and user_id <> v_user and role = 'member') then
    raise exception 'promote another member first' using errcode = 'check_violation', hint = 'last_member';
  end if;
  delete from public.cellar_members where user_id = v_user;
  return public.give_new_cellar(v_user);
end;
$$;

create function public.remove_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'use leave_cellar to leave' using errcode = 'check_violation';
  end if;
  delete from public.cellar_members where user_id = p_user_id and cellar_id = v_cellar;
  if not found then
    raise exception 'not a member of this cellar' using errcode = 'no_data_found';
  end if;
  perform public.give_new_cellar(p_user_id);
end;
$$;

create function public.set_member_role(p_user_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cellar uuid := public.my_cellar_id();
begin
  if v_cellar is null or not public.is_cellar_editor(v_cellar) then
    raise exception 'not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.cellar_members set role = p_role where user_id = p_user_id and cellar_id = v_cellar;
  if not found then
    raise exception 'not a member of this cellar' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.cellar_members where cellar_id = v_cellar and role = 'member') then
    raise exception 'a cellar needs at least one full member' using errcode = 'check_violation', hint = 'last_member';
  end if;
end;
$$;

revoke execute on function public.hash_token(text) from public, anon, authenticated;
revoke execute on function public.create_invite(public.member_role) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
revoke execute on function public.leave_cellar() from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.set_member_role(uuid, public.member_role) from public, anon;
grant execute on function public.create_invite(public.member_role) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.leave_cellar() to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;
