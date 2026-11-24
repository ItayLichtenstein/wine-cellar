-- =====================================================================
-- Households: profiles, cellars and membership.
--
-- Every user belongs to exactly one cellar (ADR 0004). The cellar is
-- created automatically when the user signs up, so the UI never shows a
-- "create cellar" step.
-- =====================================================================

-- ---------- Shared helpers ----------

-- Keeps updated_at current on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Types ----------

create type public.member_role as enum ('member', 'viewer');

-- ---------- Tables ----------

-- Profile data that is not part of authentication.
-- The id is the same as auth.users.id; Supabase owns emails and logins.
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  locale        text not null default 'he' check (locale in ('he', 'en')),
  theme         text not null default 'system' check (theme in ('light', 'dark', 'system')),
  onboarded_at  timestamptz,            -- null = has not seen the tour yet
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.cellars (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  name_is_custom  boolean not null default false,  -- false = name follows the members' names
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.cellar_members (
  cellar_id  uuid not null references public.cellars (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role       public.member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (cellar_id, user_id),
  -- One cellar per user. Remove this constraint to allow several (ADR 0004).
  constraint cellar_members_one_cellar_per_user unique (user_id)
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger cellars_updated_at before update on public.cellars
  for each row execute function public.set_updated_at();

-- ---------- Permission helpers ----------
-- Every RLS policy calls one of these, so the rule lives in one place.
-- SECURITY DEFINER lets them read cellar_members without being blocked by
-- that table's own RLS (which would otherwise recurse into itself).

-- Can the current user see this cellar? (any role)
create function public.is_cellar_member(p_cellar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cellar_members
    where cellar_id = p_cellar_id and user_id = (select auth.uid())
  );
$$;

-- Can the current user change this cellar? (role = member, not viewer)
create function public.is_cellar_editor(p_cellar_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cellar_members
    where cellar_id = p_cellar_id
      and user_id = (select auth.uid())
      and role = 'member'
  );
$$;

-- The current user's cellar (there is exactly one).
create function public.my_cellar_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cellar_id from public.cellar_members where user_id = (select auth.uid());
$$;

-- ---------- Sign-up: create profile, cellar and membership ----------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name      text;
  v_cellar_id uuid;
begin
  -- Google sends full_name. Magic-link users only have an email, and we
  -- never derive a name from it (that would show part of the email to the
  -- household and friends). They get a placeholder and are asked for a
  -- name on first login.
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    'משתמש חדש'
  );

  insert into public.profiles (id, display_name) values (new.id, v_name);

  insert into public.cellars (name) values ('המרתף של ' || v_name)
  returning id into v_cellar_id;

  insert into public.cellar_members (cellar_id, user_id, role)
  values (v_cellar_id, new.id, 'member');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------

alter table public.profiles       enable row level security;
alter table public.cellars        enable row level security;
alter table public.cellar_members enable row level security;

-- Profiles: you see yourself and the people in your cellar.
create policy "profiles: read self and household"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.cellar_members m
      where m.user_id = profiles.id and public.is_cellar_member(m.cellar_id)
    )
  );

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Cellars: members read; editors rename.
create policy "cellars: members read"
  on public.cellars for select to authenticated
  using (public.is_cellar_member(id));

create policy "cellars: editors update"
  on public.cellars for update to authenticated
  using (public.is_cellar_editor(id))
  with check (public.is_cellar_editor(id));

-- Membership: members see who is in their cellar.
-- Joining and leaving go through server functions (stage 2), never direct writes.
create policy "cellar_members: members read"
  on public.cellar_members for select to authenticated
  using (public.is_cellar_member(cellar_id));
